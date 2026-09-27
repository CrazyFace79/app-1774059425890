import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import {
  DomainError,
  PRIVACY_SUMMARY,
  authorizeJob,
  buildEditPlan,
  clampDuration,
  creditCost,
  detectImageType,
  isToolId,
  isUuid,
  retentionExpired,
  trainingOptOutRequired,
  type AspectRatio,
  type MaskMode,
  type PlanInput,
  type ReelTimeline,
  type Stroke,
  type ToolId,
} from '@lookstudio/domain';
import type { AppConfig } from './config';
import { Store, type AssetRow, type JobRow, type UserRow } from './db';
import { AppError } from './errors';
import { assetPath, removePath, userDir } from './files';
import { sha256, stampDisclosure } from './media';
import sharp from 'sharp';
import { describeProviders, previewMask } from './providers';
import { JobRunner, type JobPayload } from './runner';

declare module 'fastify' {
  interface FastifyRequest {
    user?: UserRow;
  }
}

export type BuiltApp = {
  app: FastifyInstance;
  store: Store;
  runner: JobRunner;
  config: AppConfig;
};

export async function buildApp(config: AppConfig): Promise<BuiltApp> {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const store = new Store(path.join(config.dataDir, 'lookstudio.sqlite'));
  const runner = new JobRunner(store, config);
  const app = Fastify({ logger: config.log, bodyLimit: 20 * 1024 * 1024 });
  await app.register(cors, { origin: true });
  await app.register(rateLimit, { max: config.rateLimitMax, timeWindow: config.rateLimitWindowMs });
  await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024, files: 16 } });

  app.addHook('preHandler', async (request) => {
    const pathname = request.url.split('?')[0] ?? '';
    if (pathname === '/v1/health' || pathname === '/v1/auth/device') return;
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new AppError(401, 'unauthorized', 'Falta la sesión.');
    const user = store.getUserByToken(header.slice('Bearer '.length));
    if (!user) throw new AppError(401, 'unauthorized', 'Sesión no válida.');
    request.user = user;
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) return reply.status(error.status).send({ error: error.code, message: error.message });
    if (error instanceof DomainError) return reply.status(400).send({ error: error.code, message: error.message });
    const statusCode = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 500;
    if (statusCode === 413) return reply.status(413).send({ error: 'file_too_large', message: 'El archivo supera el límite.' });
    if (config.log) app.log.error(error);
    return reply.status(500).send({ error: 'internal', message: 'Error interno.' });
  });

  app.get('/v1/health', async () => ({
    ok: true,
    service: 'ai-look-studio-api',
    monetizationEnabled: config.monetizationEnabled,
  }));

  app.post('/v1/auth/device', async (request) => {
    const body = record(request.body);
    const deviceId = stringField(body, 'deviceId');
    if (!deviceId || deviceId.length < 8) throw new AppError(400, 'invalid_device', 'Identificador de dispositivo no válido.');
    const now = new Date().toISOString();
    const existing = store.getUserByDevice(deviceId);
    const token = randomUUID();
    if (existing) {
      store.insertSession(token, existing.id, now);
      return sessionBody(token, existing, config);
    }
    const user: UserRow = {
      id: randomUUID(),
      device_id: deviceId,
      plan: 'free',
      credits: 100,
      training_opt_out: 1,
      created_at: now,
    };
    store.insertUser(user, token);
    return sessionBody(token, user, config);
  });

  app.get('/v1/providers/capabilities', async () => {
    const providers = describeProviders(config);
    return {
      monetizationEnabled: config.monetizationEnabled,
      purchasesAvailable: false,
      trainingOptOut: true,
      providers,
    };
  });

  app.get('/v1/privacy', async () => ({
    summary: PRIVACY_SUMMARY,
    trainingOptOut: true,
    serverAssetTtlHours: config.serverAssetTtlHours,
  }));

  app.get('/v1/usage', async (request) => {
    const user = mustUser(request);
    return { plan: user.plan, credits: user.credits, monetizationEnabled: config.monetizationEnabled, ...store.usageFor(user.id) };
  });

  app.post('/v1/projects', async (request) => {
    const user = mustUser(request);
    const body = record(request.body);
    const id = optionalUuid(body.id);
    const existing = store.getProject(user.id, id);
    if (existing) return { id: existing.id, name: existing.name, createdAt: existing.created_at };
    const name = (stringField(body, 'name') || 'Proyecto').slice(0, 80);
    const now = new Date().toISOString();
    store.insertProject({ id, user_id: user.id, name, created_at: now, updated_at: now, retention_days: null, deleted_at: null });
    return { id, name, createdAt: now };
  });

  app.get('/v1/projects', async (request) => ({ projects: store.listProjects(mustUser(request).id) }));

  app.get('/v1/projects/:id', async (request) => {
    const project = mustProject(store, request);
    return { project, assets: store.listAssets(project.id), operations: store.listOperations(project.id) };
  });

  app.patch('/v1/projects/:id', async (request) => {
    const project = mustProject(store, request);
    const body = record(request.body);
    const name = stringField(body, 'name');
    if (name) {
      store.db.prepare(`UPDATE projects SET name = ? WHERE id = ?`).run(name.slice(0, 80), project.id);
    }
    if ('retentionDays' in body) {
      if (body.retentionDays === null) {
        store.touchProject(project.id, new Date().toISOString(), null);
      } else {
        const retentionDays = Number(body.retentionDays);
        if (!Number.isFinite(retentionDays) || retentionDays < 1) throw new AppError(400, 'invalid_retention', 'Retención no válida.');
        store.touchProject(project.id, new Date().toISOString(), retentionDays);
      }
    } else {
      store.touchProject(project.id, new Date().toISOString());
    }
    return { ok: true };
  });

  app.delete('/v1/projects/:id', async (request) => {
    const user = mustUser(request);
    const project = mustProject(store, request);
    for (const asset of store.listAssets(project.id)) {
      if (asset.path) removePath(asset.path);
      store.markAssetDeleted(asset.id);
    }
    store.softDeleteProject(project.id, new Date().toISOString());
    return { ok: true, userId: user.id };
  });

  app.delete('/v1/projects/:id/original', async (request) => {
    const project = mustProject(store, request);
    const original = store.originalAsset(project.id);
    if (!original || original.bytes_deleted) throw new AppError(404, 'not_found', 'No hay original.');
    if (original.path) removePath(original.path);
    store.markAssetDeleted(original.id);
    return { ok: true, assetId: original.id, bytesDeleted: true };
  });

  app.post('/v1/projects/:id/duplicate', async (request) => {
    const user = mustUser(request);
    const project = mustProject(store, request);
    const now = new Date().toISOString();
    const id = randomUUID();
    store.insertProject({
      id,
      user_id: user.id,
      name: `Copia de ${project.name}`.slice(0, 80),
      created_at: now,
      updated_at: now,
      retention_days: project.retention_days,
      deleted_at: null,
    });
    for (const asset of store.listAssets(project.id)) {
      if (asset.bytes_deleted || !asset.path || !fs.existsSync(asset.path)) continue;
      const copyId = randomUUID();
      const ext = path.extname(asset.path).replace('.', '') || 'bin';
      const target = assetPath(config, user.id, copyId, ext);
      fs.copyFileSync(asset.path, target);
      store.insertAsset({ ...asset, id: copyId, project_id: id, path: target, created_at: now, parent_asset_id: asset.id });
    }
    return { id };
  });

  app.post('/v1/projects/:id/assets', async (request, reply) => {
    const user = mustUser(request);
    const project = mustProject(store, request);
    const form = await readForm(request);
    assertConsent(form.fields, request);
    assertTraining(request);
    const image = form.files.image;
    if (!image) throw new AppError(400, 'image_required', 'Falta la imagen.');
    if (store.originalAsset(project.id)) throw new AppError(409, 'original_exists', 'El original ya existe y no se sustituye.');
    const saved = await saveBuffer(config, store, user.id, project.id, image.data, 'original', null, 'original', 'source', 'none');
    store.touchProject(project.id, new Date().toISOString());
    return reply.status(201).send(presentAsset(saved));
  });

  app.get('/v1/assets/:assetId', async (request) => {
    const asset = mustAsset(store, request);
    return presentAsset(asset);
  });

  app.get('/v1/assets/:assetId/file', async (request, reply) => {
    const asset = mustAsset(store, request);
    if (asset.bytes_deleted || !asset.path) throw new AppError(410, 'gone', 'El archivo ya se eliminó.');
    return reply.type(asset.mime).send(fs.readFileSync(asset.path));
  });

  app.delete('/v1/assets/:assetId', async (request) => {
    const asset = mustAsset(store, request);
    if (asset.kind === 'original') throw new AppError(400, 'use_original_endpoint', 'El original se borra desde el proyecto.');
    if (asset.path) removePath(asset.path);
    store.markAssetDeleted(asset.id);
    return { ok: true };
  });

  app.post('/v1/masks/preview', async (request) => {
    const form = await readForm(request);
    assertConsent(form.fields, request);
    assertTraining(request);
    const image = requiredImage(form);
    const payload = parsePayload(form.fields.payload);
    const planInput = planFromPayload(payload);
    const preview = await previewMask({
      config,
      image: image.data,
      planInput,
      strokes: parseStrokes(payload.strokes),
      feather: numberField(payload.feather, 2),
      invert: payload.invert === true,
    });
    return {
      width: preview.width,
      height: preview.height,
      confidence: preview.confidence,
      source: preview.source,
      warnings: preview.warnings,
      overlayPngBase64: preview.overlayPng.toString('base64'),
    };
  });

  app.post('/v1/jobs', async (request, reply) => {
    const user = mustUser(request);
    const form = await readForm(request);
    assertConsent(form.fields, request);
    assertTraining(request);
    const payload = parsePayload(form.fields.payload);
    const project = store.getProject(user.id, stringField(payload, 'projectId'));
    if (!project) throw new AppError(404, 'not_found', 'Proyecto no encontrado.');
    const tool = stringField(payload, 'tool');
    if (tool === 'animate') return reply.status(202).send(await enqueueVideo(config, store, runner, user, project.id, form, payload));
    if (!isToolId(tool) || tool === 'reel') throw new AppError(400, 'invalid_tool', 'Herramienta no válida.');
    const image = requiredImage(form);
    const planInput = planFromPayload(payload);
    const plan = buildEditPlan(planInput);
    const cost = creditCost(plan.tool === 'retouch' && plan.presetId === 'upscale' ? 'upscale' : 'edit');
    const decision = charge(store, user, cost, 'edit', config.monetizationEnabled);
    const input = await saveBuffer(config, store, user.id, project.id, image.data, 'job-input', null, 'upload', 'client', 'none');
    const now = new Date().toISOString();
    const operationId = optionalUuid(payload.operationId);
    const jobId = randomUUID();
    const jobPayload: JobPayload = {
      kind: 'edit',
      inputPath: input.path,
      planInput,
      strokes: parseStrokes(payload.strokes),
      seed: Number(payload.seed ?? hashSeed(operationId, numberField(payload.variation, 0))),
      feather: numberField(payload.feather, 2),
      invert: payload.invert === true,
      charged: decision.charged,
      cost,
      plan,
    };
    insertQueued(store, user.id, project.id, operationId, jobId, 'edit', plan, input.id, jobPayload, now);
    runner.enqueue(jobId);
    store.touchProject(project.id, now);
    return reply.status(202).send({ jobId, operationId, status: 'QUEUED' });
  });

  app.post('/v1/reels/render', async (request, reply) => {
    const user = mustUser(request);
    const form = await readForm(request);
    assertConsent(form.fields, request);
    assertTraining(request);
    const payload = parsePayload(form.fields.payload);
    const project = store.getProject(user.id, stringField(payload, 'projectId'));
    if (!project) throw new AppError(404, 'not_found', 'Proyecto no encontrado.');
    const timeline = payload.timeline as ReelTimeline;
    if (!timeline || !Array.isArray(timeline.clips)) throw new AppError(400, 'invalid_timeline', 'La línea de tiempo no es válida.');
    const clipPaths: { id: string; path: string }[] = [];
    for (const clip of timeline.clips) {
      const file = form.files[`clip_${clip.id}`];
      if (!file) throw new AppError(400, 'clip_required', `Falta el clip ${clip.id}.`);
      const saved = await saveBuffer(config, store, user.id, project.id, file.data, 'job-input', null, file.mime, 'upload', 'none');
      clipPaths.push({ id: clip.id, path: saved.path });
    }
    let audioPath: string | undefined;
    if (form.files.audio) {
      audioPath = (await saveBuffer(config, store, user.id, project.id, form.files.audio.data, 'job-input', null, form.files.audio.mime, 'upload', 'none')).path;
    }
    const cost = creditCost('reel');
    const decision = charge(store, user, cost, 'reel', config.monetizationEnabled);
    const now = new Date().toISOString();
    const operationId = optionalUuid(payload.operationId);
    const jobId = randomUUID();
    const plan = {
      tool: 'reel' as const,
      subTool: null,
      presetId: 'export',
      editScope: 'local' as const,
      identityLock: true,
      prompt: 'Reel export',
      negativePrompt: '',
      preservationPrompt: 'Preserve the supplied frames.',
      summary: payload.preview === true ? 'Previsualización del reel.' : 'Exportación 1080×1920.',
      warnings: [] as string[],
      parameters: {},
      relaxedAttributes: [] as string[],
      maskMode: 'auto' as const,
    };
    const jobPayload: JobPayload = {
      kind: 'reel',
      timeline,
      clipPaths,
      ...(audioPath ? { audioPath } : {}),
      preview: payload.preview === true,
      containsAi: payload.containsAi === true,
      charged: decision.charged,
      cost,
    };
    const inputAssetId = clipPaths[0] ? findAssetIdByPath(store, clipPaths[0].path) : project.id;
    insertQueued(store, user.id, project.id, operationId, jobId, 'reel', plan, inputAssetId, jobPayload, now);
    runner.enqueue(jobId);
    return reply.status(202).send({ jobId, operationId, status: 'QUEUED' });
  });

  app.get('/v1/jobs/:jobId', async (request) => presentJob(mustJob(store, request)));

  app.post('/v1/jobs/:jobId/cancel', async (request) => {
    const job = mustJob(store, request);
    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      throw new AppError(409, 'invalid_transition', 'El trabajo ya terminó.');
    }
    store.updateJob(job.id, { status: 'CANCELLED', updated_at: new Date().toISOString(), error: 'Cancelado por el usuario.' });
    const payload = JSON.parse(job.payload_json) as JobPayload;
    if (payload.charged) {
      const user = mustUser(request);
      store.setCredits(user.id, user.credits + payload.cost);
    }
    return { ok: true, status: 'CANCELLED' };
  });

  app.post('/v1/exports/stamp', async (request, reply) => {
    const form = await readForm(request);
    assertConsent(form.fields, request);
    assertTraining(request);
    const image = requiredImage(form);
    const payload = parsePayload(form.fields.payload);
    const visible = payload.visible !== false;
    const stamped = await stampDisclosure(image.data, visible);
    const user = mustUser(request);
    const projectId = stringField(payload, 'projectId');
    if (projectId && store.getProject(user.id, projectId)) {
      await saveBuffer(config, store, user.id, projectId, stamped, 'export', null, 'image/png', 'ai-look-studio', payload.disclosure === 'ai-generated' ? 'ai-generated' : 'ai-modified');
    }
    return reply.type('image/png').send(stamped);
  });

  app.post('/v1/privacy/delete-all', async (request) => {
    const user = mustUser(request);
    removePath(userDir(config, user.id));
    store.deleteUser(user.id);
    return { ok: true };
  });

  app.post('/v1/privacy/sweep', async () => {
    const removed = sweepExpired(store, Date.now());
    return { removed };
  });

  return { app, store, runner, config };
}

function sweepExpired(store: Store, nowMs: number): number {
  const assets = store.expiredAssets(nowMs);
  for (const asset of assets) {
    if (!retentionExpired(asset.created_at, assetRetention(store, asset), nowMs)) continue;
    if (asset.path) removePath(asset.path);
    store.markAssetDeleted(asset.id);
  }
  return assets.length;
}

function assetRetention(store: Store, asset: AssetRow): number | null {
  const rows = store.db.prepare(`SELECT retention_days FROM projects WHERE id = ?`).get(asset.project_id) as { retention_days: number | null } | undefined;
  return rows?.retention_days ?? null;
}

async function enqueueVideo(
  config: AppConfig,
  store: Store,
  runner: JobRunner,
  user: UserRow,
  projectId: string,
  form: ParsedForm,
  payload: Record<string, unknown>,
) {
  const image = requiredImage(form);
  const presetId = stringField(payload, 'presetId') || 'natural';
  const aspect = (stringField(payload, 'aspect') || '9:16') as AspectRatio;
  if (!['9:16', '1:1', '16:9'].includes(aspect)) throw new AppError(400, 'invalid_aspect', 'Formato no válido.');
  const durationSec = clampDuration(numberField(payload.durationSec, 3), config.videoDurations);
  const identityLock = payload.identityLock !== false;
  const plan = buildEditPlan({
    tool: 'animate',
    presetId,
    customPrompt: stringField(payload, 'customPrompt'),
    identityLock,
    parameters: { aspect, duration: String(durationSec) },
  });
  const cost = creditCost('video');
  const decision = charge(store, user, cost, 'video', config.monetizationEnabled);
  const input = await saveBuffer(config, store, user.id, projectId, image.data, 'job-input', null, 'upload', 'client', 'none');
  const now = new Date().toISOString();
  const operationId = optionalUuid(payload.operationId);
  const jobId = randomUUID();
  const jobPayload: JobPayload = {
    kind: 'video',
    inputPath: input.path,
    presetId,
    customPrompt: stringField(payload, 'customPrompt'),
    identityLock,
    aspect,
    durationSec,
    charged: decision.charged,
    cost,
    plan,
  };
  insertQueued(store, user.id, projectId, operationId, jobId, 'video', plan, input.id, jobPayload, now);
  runner.enqueue(jobId);
  return { jobId, operationId, status: 'QUEUED' as const };
}

function insertQueued(
  store: Store,
  userId: string,
  projectId: string,
  operationId: string,
  jobId: string,
  type: string,
  plan: ReturnType<typeof buildEditPlan>,
  inputAssetId: string,
  payload: JobPayload,
  now: string,
): void {
  store.insertOperation({
    operation_id: operationId,
    project_id: projectId,
    user_id: userId,
    tool: plan.tool,
    prompt: plan.prompt,
    negative_prompt: plan.negativePrompt,
    preservation_prompt: plan.preservationPrompt,
    mask_asset_id: null,
    mask_type: plan.maskMode,
    input_asset_id: inputAssetId,
    output_asset_id: null,
    provider: 'pending',
    model: 'pending',
    created_at: now,
    status: 'QUEUED',
    parameters_json: JSON.stringify(plan.parameters),
    identity_lock: plan.identityLock ? 1 : 0,
    edit_scope: plan.editScope,
    job_id: jobId,
  });
  store.insertJob({
    id: jobId,
    user_id: userId,
    project_id: projectId,
    operation_id: operationId,
    type,
    status: 'QUEUED',
    progress: 0,
    provider: 'pending',
    model: 'pending',
    error: null,
    result_asset_id: null,
    payload_json: JSON.stringify(payload),
    created_at: now,
    updated_at: now,
  });
}

function charge(
  store: Store,
  user: UserRow,
  cost: number,
  kind: 'edit' | 'video' | 'reel' | 'upscale',
  monetizationEnabled: boolean,
): { charged: boolean } {
  const fresh = store.getUser(user.id) ?? user;
  const decision = authorizeJob({ monetizationEnabled, credits: fresh.credits, cost });
  if (!decision.ok) throw new AppError(402, 'insufficient_credits', decision.reason);
  if (decision.charged) store.setCredits(user.id, decision.nextCredits);
  store.insertUsage(randomUUID(), user.id, null, kind, cost, decision.charged, new Date().toISOString());
  return { charged: decision.charged };
}

function presentJob(job: JobRow) {
  const payload = JSON.parse(job.payload_json) as JobPayload & { plan?: ReturnType<typeof buildEditPlan>; disclosure?: string };
  return {
    id: job.id,
    operationId: job.operation_id,
    projectId: job.project_id,
    status: job.status,
    progress: job.progress,
    provider: job.provider,
    model: job.model,
    error: job.error,
    resultAssetId: job.result_asset_id,
    prompt: payload.plan?.prompt ?? '',
    negativePrompt: payload.plan?.negativePrompt ?? '',
    preservationPrompt: payload.plan?.preservationPrompt ?? '',
    summary: payload.plan?.summary ?? '',
    warnings: payload.plan?.warnings ?? [],
    editScope: payload.plan?.editScope ?? null,
    disclosure: payload.disclosure ?? null,
    identityLock: payload.plan?.identityLock ?? null,
  };
}

function presentAsset(asset: AssetRow) {
  return {
    id: asset.id,
    projectId: asset.project_id,
    kind: asset.kind,
    width: asset.width,
    height: asset.height,
    mime: asset.mime,
    aiModified: asset.ai_modified === 1,
    aiGenerated: asset.ai_generated === 1,
    disclosure: asset.disclosure,
    provider: asset.provider,
    model: asset.model,
    operationId: asset.operation_id,
    bytesDeleted: asset.bytes_deleted === 1,
    sha256: asset.sha256,
    createdAt: asset.created_at,
    metadata: JSON.parse(asset.metadata_json) as unknown,
  };
}

async function saveBuffer(
  config: AppConfig,
  store: Store,
  userId: string,
  projectId: string,
  data: Buffer,
  kind: string,
  operationId: string | null,
  provider: string,
  model: string,
  disclosure: string,
): Promise<AssetRow> {
  const type = detectImageType(data);
  const ext = type === 'jpeg' ? 'jpg' : type === 'webp' ? 'webp' : type === 'png' ? 'png' : data.subarray(4, 8).toString() === 'ftyp' ? 'mp4' : 'bin';
  const id = randomUUID();
  const filePath = assetPath(config, userId, id, ext);
  fs.writeFileSync(filePath, data);
  let width = 0;
  let height = 0;
  if (type) {
    const meta = await sharp(data, { failOn: 'none' }).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  }
  const now = new Date().toISOString();
  const row: AssetRow = {
    id,
    project_id: projectId,
    user_id: userId,
    kind,
    path: filePath,
    width,
    height,
    mime: type === 'jpeg' ? 'image/jpeg' : type === 'webp' ? 'image/webp' : type === 'png' ? 'image/png' : ext === 'mp4' ? 'video/mp4' : 'application/octet-stream',
    ai_modified: kind === 'derived' || kind === 'video' || kind === 'export' ? 1 : 0,
    ai_generated: 0,
    disclosure,
    parent_asset_id: null,
    operation_id: operationId,
    provider,
    model,
    created_at: now,
    bytes_deleted: 0,
    sha256: sha256(data),
    metadata_json: JSON.stringify({ disclosure, kind }),
  };
  store.insertAsset(row);
  return row;
}

function findAssetIdByPath(store: Store, filePath: string): string {
  const row = store.db.prepare(`SELECT id FROM assets WHERE path = ?`).get(filePath) as { id: string } | undefined;
  return row?.id ?? randomUUID();
}

type ParsedForm = { fields: Record<string, string>; files: Record<string, { filename: string; mime: string; data: Buffer }> };

async function readForm(request: FastifyRequest): Promise<ParsedForm> {
  if (!request.isMultipart()) throw new AppError(400, 'multipart_required', 'La petición tiene que ser multipart.');
  const fields: Record<string, string> = {};
  const files: ParsedForm['files'] = {};
  const parts = request.parts();
  for await (const part of parts) {
    if (part.type === 'file') {
      files[part.fieldname] = { filename: part.filename, mime: part.mimetype, data: await part.toBuffer() };
    } else {
      fields[part.fieldname] = String(part.value ?? '');
    }
  }
  return { fields, files };
}

function requiredImage(form: ParsedForm): { data: Buffer } {
  const image = form.files.image;
  if (!image) throw new AppError(400, 'image_required', 'Falta la imagen.');
  if (!detectImageType(image.data)) throw new AppError(400, 'invalid_image', 'Formato no soportado. Usa JPEG, PNG o WebP.');
  return image;
}

function assertConsent(fields: Record<string, string>, request: FastifyRequest): void {
  const header = request.headers['x-upload-consent'];
  const ok = fields.consent === 'true' || header === 'true';
  if (!ok) throw new AppError(403, 'consent_required', 'Hace falta el consentimiento antes de subir la foto.');
}

function assertTraining(request: FastifyRequest): void {
  const header = request.headers['x-training-opt-out'];
  const value = Array.isArray(header) ? header[0] : header;
  if (!trainingOptOutRequired(value)) {
    throw new AppError(400, 'training_opt_out_required', 'Las fotos no se pueden usar para entrenar modelos.');
  }
}

function planFromPayload(payload: Record<string, unknown>): PlanInput {
  const tool = stringField(payload, 'tool');
  if (!isToolId(tool)) throw new AppError(400, 'invalid_tool', 'Herramienta no válida.');
  const maskMode: MaskMode = payload.maskMode === 'manual' ? 'manual' : 'auto';
  const parameters = record(payload.parameters);
  const cleanParams: Record<string, number | string | boolean> = {};
  for (const [key, value] of Object.entries(parameters)) {
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') cleanParams[key] = value;
  }
  return {
    tool: tool as ToolId,
    presetId: stringField(payload, 'presetId'),
    customPrompt: stringField(payload, 'customPrompt'),
    parameters: cleanParams,
    identityLock: payload.identityLock !== false,
    maskMode,
  };
}

function parsePayload(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    return record(JSON.parse(raw));
  } catch {
    throw new AppError(400, 'invalid_payload', 'El payload no es JSON.');
  }
}

function parseStrokes(value: unknown): Stroke[] {
  if (!Array.isArray(value)) return [];
  const strokes: Stroke[] = [];
  for (const item of value) {
    const stroke = record(item);
    const points = Array.isArray(stroke.points)
      ? stroke.points.flatMap((point) => {
          const pair = record(point);
          if (typeof pair.x !== 'number' || typeof pair.y !== 'number') return [];
          return [{ x: pair.x, y: pair.y }];
        })
      : [];
    strokes.push({
      mode: stroke.mode === 'erase' ? 'erase' : 'brush',
      size: Math.max(0.005, Math.min(0.25, numberField(stroke.size, 0.04))),
      points,
    });
  }
  return strokes;
}

function mustUser(request: FastifyRequest): UserRow {
  if (!request.user) throw new AppError(401, 'unauthorized', 'Falta la sesión.');
  return request.user;
}

function mustProject(store: Store, request: FastifyRequest) {
  const params = request.params as { id?: string };
  const project = store.getProject(mustUser(request).id, params.id ?? '');
  if (!project) throw new AppError(404, 'not_found', 'Proyecto no encontrado.');
  return project;
}

function mustAsset(store: Store, request: FastifyRequest): AssetRow {
  const params = request.params as { assetId?: string };
  const asset = store.getAsset(mustUser(request).id, params.assetId ?? '');
  if (!asset) throw new AppError(404, 'not_found', 'Archivo no encontrado.');
  return asset;
}

function mustJob(store: Store, request: FastifyRequest): JobRow {
  const params = request.params as { jobId?: string };
  const job = store.getJob(mustUser(request).id, params.jobId ?? '');
  if (!job) throw new AppError(404, 'not_found', 'Trabajo no encontrado.');
  return job;
}

function sessionBody(token: string, user: UserRow, config: AppConfig) {
  return {
    token,
    userId: user.id,
    plan: user.plan,
    credits: user.credits,
    monetizationEnabled: config.monetizationEnabled,
    trainingOptOut: true,
  };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function stringField(source: Record<string, unknown> | undefined, key: string): string {
  const value = source?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function numberField(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalUuid(value: unknown): string {
  if (typeof value !== 'string' || value === '') return randomUUID();
  if (!isUuid(value)) throw new AppError(400, 'invalid_id', 'El identificador tiene que ser un UUID.');
  return value;
}

function hashSeed(operationId: string, variation: number): number {
  let hash = 2166136261;
  const source = `${operationId}:${variation}`;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
