import { JOB_STATUSES, jobProgressLabel, preflightEdit, validateTimeline, type JobStatus, type ReelTimeline } from '@lookstudio/domain';
import { ApiError, type JobView, type LookClient } from '../api/client';
import { buildAnimatePayload, buildEditPayload, type EditJobPayload } from '../pure/flow';
import {
  finishOperation,
  getProject,
  insertOperation,
  insertPendingAsset,
  markServerOriginal,
  type AssetRow,
} from '../storage/library';
import { newId, readUriBytes } from '../storage/files';

export type JobProgress = { label: string; progress: number; status: string };

async function ensureServer(client: LookClient, projectId: string, original: AssetRow | null): Promise<void> {
  const project = await getProject(projectId);
  if (!project) throw new Error('El proyecto no existe.');
  await client.createProject(project.id, project.name);
  if (!original || original.bytes_deleted) return;
  if (project.server_original) return;
  try {
    await client.uploadOriginal(project.id, original.local_uri, 'original', original.mime);
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== 'original_exists') throw error;
  }
  await markServerOriginal(project.id);
}

async function poll(client: LookClient, jobId: string, onProgress: (progress: JobProgress) => void): Promise<JobView> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const job = await client.getJob(jobId);
    const status = job.status;
    const known = (JOB_STATUSES as readonly string[]).includes(status) ? (status as JobStatus) : 'FAILED';
    onProgress({
      status,
      progress: job.progress,
      label: jobProgressLabel(known, job.progress),
    });
    if (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') return job;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('El trabajo tardó demasiado.');
}

async function storeResult(client: LookClient, operationId: string, projectId: string, job: JobView, ext: string, mime: string): Promise<void> {
  if (!job.resultAssetId) throw new Error('El trabajo terminó sin archivo.');
  const meta = await client.getAsset(job.resultAssetId);
  const bytes = await client.downloadAsset(job.resultAssetId);
  const assetId = await insertPendingAsset({
    projectId,
    operationId,
    bytes,
    mime: meta.mime || mime,
    ext,
    width: meta.width,
    height: meta.height,
    disclosure: job.disclosure ?? meta.disclosure ?? 'procedural-local',
    provider: job.provider || meta.provider,
    model: job.model || meta.model,
  });
  await finishOperation({
    id: operationId,
    status: 'review',
    outputAssetId: assetId,
    provider: job.provider,
    model: job.model,
    disclosure: job.disclosure ?? meta.disclosure,
    summary: job.summary,
    warnings: job.warnings,
    prompt: job.prompt,
    negativePrompt: job.negativePrompt,
    preservationPrompt: job.preservationPrompt,
    jobId: job.id,
  });
}

export async function runEdit(input: {
  client: LookClient;
  projectId: string;
  original: AssetRow | null;
  source: AssetRow;
  payload: Omit<EditJobPayload, 'consent' | 'operationId' | 'projectId'>;
  onProgress: (progress: JobProgress) => void;
}): Promise<string> {
  const bytes = await readUriBytes(input.source.local_uri);
  const type = input.source.mime.includes('png') ? 'png' : input.source.mime.includes('webp') ? 'webp' : 'jpeg';
  const preflight = preflightEdit({
    tool: input.payload.tool,
    presetId: input.payload.presetId,
    customPrompt: input.payload.customPrompt,
    parameters: input.payload.parameters,
    identityLock: input.payload.identityLock,
    maskMode: input.payload.maskMode,
    width: input.source.width,
    height: input.source.height,
    bytes: bytes.byteLength,
    type,
  });
  if (!preflight.ok) throw new Error(preflight.errors.join(' '));
  await ensureServer(input.client, input.projectId, input.original);
  const operationId = newId();
  await insertOperation({
    id: operationId,
    projectId: input.projectId,
    tool: input.payload.tool,
    presetId: input.payload.presetId,
    maskMode: input.payload.maskMode,
    identityLock: input.payload.identityLock,
    parameters: input.payload.parameters,
    strokes: input.payload.strokes,
    feather: input.payload.feather,
    invert: input.payload.invert,
    customPrompt: input.payload.customPrompt,
    variation: input.payload.variation,
    inputAssetId: input.source.id,
  });
  try {
    const payload = buildEditPayload({ ...input.payload, projectId: input.projectId, operationId });
    const queued = await input.client.postJob(input.source.local_uri, 'edit.png', input.source.mime, payload);
    const job = await poll(input.client, queued.jobId, input.onProgress);
    if (job.status !== 'COMPLETED') throw new Error(job.error || 'El trabajo no se completó.');
    await storeResult(input.client, operationId, input.projectId, job, 'png', 'image/png');
    return operationId;
  } catch (error) {
    await finishOperation({ id: operationId, status: 'failed', summary: error instanceof Error ? error.message : 'Error' });
    throw error;
  }
}

export async function runAnimate(input: {
  client: LookClient;
  projectId: string;
  original: AssetRow | null;
  source: AssetRow;
  presetId: string;
  customPrompt: string;
  identityLock: boolean;
  aspect: string;
  durationSec: number;
  variation: number;
  onProgress: (progress: JobProgress) => void;
}): Promise<string> {
  await ensureServer(input.client, input.projectId, input.original);
  const operationId = newId();
  await insertOperation({
    id: operationId,
    projectId: input.projectId,
    tool: 'animate',
    presetId: input.presetId,
    maskMode: 'auto',
    identityLock: input.identityLock,
    parameters: { aspect: input.aspect, duration: String(input.durationSec) },
    strokes: [],
    feather: 0,
    invert: false,
    customPrompt: input.customPrompt,
    variation: input.variation,
    inputAssetId: input.source.id,
  });
  try {
    const queued = await input.client.postJob(
      input.source.local_uri,
      'frame.png',
      input.source.mime,
      buildAnimatePayload({
        projectId: input.projectId,
        operationId,
        presetId: input.presetId,
        customPrompt: input.customPrompt,
        identityLock: input.identityLock,
        aspect: input.aspect,
        durationSec: input.durationSec,
        variation: input.variation,
      }),
    );
    const job = await poll(input.client, queued.jobId, input.onProgress);
    if (job.status !== 'COMPLETED') throw new Error(job.error || 'El vídeo no se completó.');
    await storeResult(input.client, operationId, input.projectId, job, 'mp4', 'video/mp4');
    return operationId;
  } catch (error) {
    await finishOperation({ id: operationId, status: 'failed', summary: error instanceof Error ? error.message : 'Error' });
    throw error;
  }
}

export async function runReel(input: {
  client: LookClient;
  projectId: string;
  timeline: ReelTimeline;
  clips: { id: string; asset: AssetRow }[];
  audio: { uri: string; name: string; mime: string } | null;
  preview: boolean;
  containsAi: boolean;
  onProgress: (progress: JobProgress) => void;
}): Promise<string> {
  const validation = validateTimeline(input.timeline);
  if (!validation.ok) throw new Error(validation.errors.join(' '));
  const project = await getProject(input.projectId);
  if (!project) throw new Error('El proyecto no existe.');
  await input.client.createProject(project.id, project.name);
  const operationId = newId();
  const first = input.clips[0]?.asset;
  if (!first) throw new Error('Añade al menos un clip.');
  await insertOperation({
    id: operationId,
    projectId: input.projectId,
    tool: 'reel',
    presetId: input.preview ? 'preview' : 'export',
    maskMode: 'auto',
    identityLock: true,
    parameters: {},
    strokes: [],
    feather: 0,
    invert: false,
    customPrompt: '',
    variation: 0,
    inputAssetId: first.id,
  });
  try {
    const queued = await input.client.postReel(
      input.clips.map((clip) => ({
        id: clip.id,
        uri: clip.asset.local_uri,
        name: `${clip.id}.${clip.asset.mime.includes('mp4') ? 'mp4' : 'png'}`,
        mime: clip.asset.mime,
      })),
      input.audio,
      { projectId: input.projectId, operationId, timeline: input.timeline, preview: input.preview, containsAi: input.containsAi },
    );
    const job = await poll(input.client, queued.jobId, input.onProgress);
    if (job.status !== 'COMPLETED') throw new Error(job.error || 'El reel no se completó.');
    await storeResult(input.client, operationId, input.projectId, job, 'mp4', 'video/mp4');
    return operationId;
  } catch (error) {
    await finishOperation({ id: operationId, status: 'failed', summary: error instanceof Error ? error.message : 'Error' });
    throw error;
  }
}

export async function exportImage(input: {
  client: LookClient | null;
  projectId: string;
  asset: AssetRow;
  online: boolean;
}): Promise<{ uri: string; note: string }> {
  if (input.asset.mime.startsWith('video/')) {
    return { uri: input.asset.local_uri, note: 'El vídeo ya lleva el aviso en los metadatos del archivo.' };
  }
  if (!input.online || !input.client) {
    const { writeSidecar } = await import('../storage/library');
    await writeSidecar(input.projectId, `export-${input.asset.id}.json`, {
      disclosure: input.asset.disclosure,
      provider: input.asset.provider,
      model: input.asset.model,
      note: 'Sin conexión no se estampó el aviso visible. Este JSON acompaña al archivo.',
      exportedAt: new Date().toISOString(),
    });
    return {
      uri: input.asset.local_uri,
      note: 'Sin conexión no se estampó el aviso visible. Se guardó un JSON con los metadatos junto al archivo.',
    };
  }
  const stamped = await input.client.stamp(input.projectId, input.asset.local_uri, 'export.png', input.asset.mime, input.asset.disclosure || 'ai-modified');
  const { writeProjectFile } = await import('../storage/files');
  const uri = await writeProjectFile(input.projectId, `export-${input.asset.id}.png`, stamped);
  return { uri, note: 'Exportación con aviso visible de contenido modificado.' };
}
