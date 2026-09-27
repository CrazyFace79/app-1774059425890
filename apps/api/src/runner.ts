import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  aspectSize,
  assertTransition,
  buildEditPlan,
  buildReelArgs,
  clampDuration,
  type AspectRatio,
  type JobStatus,
  type PlanInput,
  type ReelTimeline,
  type Stroke,
} from '@lookstudio/domain';
import type { AppConfig } from './config';
import type { Store } from './db';
import { assetPath, removePath, workDir } from './files';
import { renderCameraClip, resizePng, runFfmpeg, sha256 } from './media';
import { describeProviders, editImage, requestRemoteUpscale, requestRemoteVideo } from './providers';

type EditPayload = {
  kind: 'edit';
  inputPath: string;
  planInput: PlanInput;
  strokes: Stroke[];
  seed: number;
  feather: number;
  invert: boolean;
  charged: boolean;
  cost: number;
  disclosure?: string;
  plan?: ReturnType<typeof buildEditPlan>;
};

type VideoPayload = {
  kind: 'video';
  inputPath: string;
  presetId: string;
  customPrompt: string;
  identityLock: boolean;
  aspect: AspectRatio;
  durationSec: number;
  charged: boolean;
  cost: number;
  plan?: ReturnType<typeof buildEditPlan>;
  disclosure?: string;
};

type ReelPayload = {
  kind: 'reel';
  timeline: ReelTimeline;
  clipPaths: { id: string; path: string }[];
  audioPath?: string;
  preview: boolean;
  containsAi: boolean;
  charged: boolean;
  cost: number;
  disclosure?: string;
};

export type JobPayload = EditPayload | VideoPayload | ReelPayload;

export class JobRunner {
  private queue: string[] = [];
  private active = false;

  constructor(
    private readonly store: Store,
    private readonly config: AppConfig,
  ) {}

  enqueue(jobId: string): void {
    this.queue.push(jobId);
    void this.pump();
  }

  async flush(): Promise<void> {
    while (this.queue.length > 0 || this.active) {
      if (!this.active) await this.pump();
      else await sleep(5);
    }
  }

  private async pump(): Promise<void> {
    if (this.active) return;
    this.active = true;
    try {
      while (this.queue.length > 0) {
        const jobId = this.queue.shift();
        if (!jobId) continue;
        await this.run(jobId);
      }
    } finally {
      this.active = false;
    }
  }

  private async run(jobId: string): Promise<void> {
    const job = this.store.getJobById(jobId);
    if (!job || job.status === 'CANCELLED') return;
    const payload = JSON.parse(job.payload_json) as JobPayload;
    try {
      this.transition(jobId, 'PROCESSING', 10);
      await sleep(this.config.jobDelayMs);
      if (this.cancelled(jobId)) return;
      if (payload.kind === 'edit') await this.runEdit(jobId, job.user_id, job.project_id, job.operation_id, payload);
      else if (payload.kind === 'video') await this.runVideo(jobId, job.user_id, job.project_id, job.operation_id, payload);
      else await this.runReel(jobId, job.user_id, job.project_id, job.operation_id, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al procesar el trabajo.';
      const current = this.store.getJobById(jobId);
      if (current && current.status !== 'CANCELLED' && current.status !== 'COMPLETED') {
        this.transition(jobId, 'FAILED', current.progress, message);
        this.refund(job.user_id, payload);
      }
    } finally {
      removePath(workDir(this.config, jobId));
    }
  }

  private async runEdit(jobId: string, userId: string, projectId: string, operationId: string, payload: EditPayload): Promise<void> {
    this.progress(jobId, 35);
    const image = fs.readFileSync(payload.inputPath);
    const edited = await editImage({
      config: this.config,
      image,
      planInput: payload.planInput,
      strokes: payload.strokes,
      seed: payload.seed,
      feather: payload.feather,
      invert: payload.invert,
    });
    if (this.cancelled(jobId)) return;
    this.progress(jobId, 70);
    let png = edited.png;
    let width = edited.width;
    let height = edited.height;
    let provider = edited.provider;
    let model = edited.provider.model;
    if (edited.upscaleFactor && edited.upscaleFactor > 1) {
      if (this.config.upscaleProvider === 'http') {
        const remote = await requestRemoteUpscale(this.config, png, edited.upscaleFactor);
        png = remote.buffer;
        model = remote.model;
        provider = describeProviders(this.config).upscale;
        const decoded = await import('sharp').then((mod) => mod.default(png).metadata());
        width = decoded.width ?? width;
        height = decoded.height ?? height;
      } else {
        const resized = await resizePng(png, edited.upscaleFactor);
        png = resized.buffer;
        width = resized.width;
        height = resized.height;
        provider = describeProviders(this.config).upscale;
        model = provider.model;
      }
    }
    const maskId = randomUUID();
    const outputId = randomUUID();
    const maskPath = assetPath(this.config, userId, maskId, 'png');
    const outputPath = assetPath(this.config, userId, outputId, 'png');
    fs.writeFileSync(maskPath, edited.maskPng);
    fs.writeFileSync(outputPath, png);
    const now = new Date().toISOString();
    this.store.insertAsset(assetRow({
      id: maskId,
      projectId,
      userId,
      kind: 'mask',
      filePath: maskPath,
      width: edited.width,
      height: edited.height,
      mime: 'image/png',
      disclosure: 'procedural-local',
      aiModified: false,
      aiGenerated: false,
      operationId,
      provider: 'heuristic-segment',
      model: 'portrait-zones-v1',
      createdAt: now,
      bytes: edited.maskPng,
    }));
    this.store.insertAsset(assetRow({
      id: outputId,
      projectId,
      userId,
      kind: 'derived',
      filePath: outputPath,
      width,
      height,
      mime: 'image/png',
      disclosure: provider.disclosure,
      aiModified: true,
      aiGenerated: false,
      operationId,
      provider: provider.id,
      model,
      createdAt: now,
      bytes: png,
      parentAssetId: null,
    }));
    this.store.updateOperation(operationId, 'COMPLETED', outputId, maskId);
    const nextPayload = { ...payload, plan: edited.plan, disclosure: provider.disclosure };
    this.store.setJobPayload(jobId, JSON.stringify(nextPayload));
    this.transition(jobId, 'COMPLETED', 100, null, outputId, provider.id, model);
  }

  private async runVideo(jobId: string, userId: string, projectId: string, operationId: string, payload: VideoPayload): Promise<void> {
    this.progress(jobId, 30);
    const plan = buildEditPlan({
      tool: 'animate',
      presetId: payload.presetId,
      customPrompt: payload.customPrompt,
      identityLock: payload.identityLock,
      parameters: { aspect: payload.aspect, duration: String(payload.durationSec) },
    });
    const providers = describeProviders(this.config);
    const size = aspectSize(payload.aspect, this.config.videoLongEdge);
    const outputId = randomUUID();
    const outputPath = assetPath(this.config, userId, outputId, 'mp4');
    let model = providers.video.model;
    const disclosure = providers.video.disclosure;
    if (this.config.videoProvider === 'http') {
      const remote = await requestRemoteVideo(this.config, {
        model: this.config.videoModel,
        prompt: plan.prompt,
        negativePrompt: plan.negativePrompt,
        preservationPrompt: plan.preservationPrompt,
        imageBase64: fs.readFileSync(payload.inputPath).toString('base64'),
        aspect: payload.aspect,
        durationSec: payload.durationSec,
        identityLock: payload.identityLock,
        trainingOptOut: true,
      });
      fs.writeFileSync(outputPath, remote.buffer);
      model = remote.model;
    } else {
      await renderCameraClip({
        input: fs.readFileSync(payload.inputPath),
        presetId: payload.presetId,
        width: size.width,
        height: size.height,
        fps: this.config.videoFps,
        durationSec: clampDuration(payload.durationSec, this.config.videoDurations),
        outputPath,
        workDir: workDir(this.config, jobId),
        disclosure: `AI Look Studio | ${disclosure}`,
      });
    }
    if (this.cancelled(jobId)) return;
    const now = new Date().toISOString();
    const bytes = fs.readFileSync(outputPath);
    this.store.insertAsset(assetRow({
      id: outputId,
      projectId,
      userId,
      kind: 'video',
      filePath: outputPath,
      width: size.width,
      height: size.height,
      mime: 'video/mp4',
      disclosure,
      aiModified: true,
      aiGenerated: providers.video.generative,
      operationId,
      provider: providers.video.id,
      model,
      createdAt: now,
      bytes,
    }));
    this.store.updateOperation(operationId, 'COMPLETED', outputId, null);
    this.store.setJobPayload(jobId, JSON.stringify({ ...payload, plan, disclosure }));
    this.transition(jobId, 'COMPLETED', 100, null, outputId, providers.video.id, model);
  }

  private async runReel(jobId: string, userId: string, projectId: string, operationId: string, payload: ReelPayload): Promise<void> {
    this.progress(jobId, 40);
    const outputId = randomUUID();
    const outputPath = assetPath(this.config, userId, outputId, 'mp4');
    const width = payload.preview ? 540 : 1080;
    const height = payload.preview ? 960 : 1920;
    const fps = payload.preview ? 12 : 24;
    const disclosure = payload.containsAi ? 'ai-modified' : 'procedural-local';
    const built = buildReelArgs({
      timeline: payload.timeline,
      clips: payload.clipPaths,
      ...(payload.audioPath ? { audioPath: payload.audioPath } : {}),
      fontPath: this.config.fontPath,
      width,
      height,
      fps,
      outputPath,
      disclosure: `AI Look Studio | ${disclosure}`,
    });
    await runFfmpeg(built.args);
    if (this.cancelled(jobId)) return;
    const now = new Date().toISOString();
    const bytes = fs.readFileSync(outputPath);
    this.store.insertAsset(assetRow({
      id: outputId,
      projectId,
      userId,
      kind: 'export',
      filePath: outputPath,
      width,
      height,
      mime: 'video/mp4',
      disclosure,
      aiModified: payload.containsAi,
      aiGenerated: false,
      operationId,
      provider: 'ffmpeg-reel',
      model: 'reel-timeline-v1',
      createdAt: now,
      bytes,
    }));
    this.store.updateOperation(operationId, 'COMPLETED', outputId, null);
    this.store.setJobPayload(jobId, JSON.stringify({ ...payload, disclosure }));
    this.transition(jobId, 'COMPLETED', 100, null, outputId, 'ffmpeg-reel', 'reel-timeline-v1');
  }

  private progress(jobId: string, progress: number): void {
    const current = this.store.getJobById(jobId);
    if (!current || current.status === 'CANCELLED') return;
    this.store.updateJob(jobId, { progress, updated_at: new Date().toISOString() });
  }

  private transition(
    jobId: string,
    status: JobStatus,
    progress: number,
    error: string | null = null,
    resultAssetId: string | null = null,
    provider?: string,
    model?: string,
  ): void {
    const current = this.store.getJobById(jobId);
    if (!current) return;
    if (current.status === 'CANCELLED' && status !== 'CANCELLED') return;
    assertTransition(current.status as JobStatus, status);
    this.store.updateJob(jobId, {
      status,
      progress,
      error,
      result_asset_id: resultAssetId,
      ...(provider ? { provider } : {}),
      ...(model ? { model } : {}),
      updated_at: new Date().toISOString(),
    });
  }

  private cancelled(jobId: string): boolean {
    return this.store.getJobById(jobId)?.status === 'CANCELLED';
  }

  private refund(userId: string, payload: JobPayload): void {
    if (!payload.charged) return;
    const user = this.store.getUser(userId);
    if (!user) return;
    this.store.setCredits(userId, user.credits + payload.cost);
  }
}

function assetRow(input: {
  id: string;
  projectId: string;
  userId: string;
  kind: string;
  filePath: string;
  width: number;
  height: number;
  mime: string;
  disclosure: string;
  aiModified: boolean;
  aiGenerated: boolean;
  operationId: string | null;
  provider: string;
  model: string;
  createdAt: string;
  bytes: Buffer;
  parentAssetId?: string | null;
}) {
  return {
    id: input.id,
    project_id: input.projectId,
    user_id: input.userId,
    kind: input.kind,
    path: input.filePath,
    width: input.width,
    height: input.height,
    mime: input.mime,
    ai_modified: input.aiModified ? 1 : 0,
    ai_generated: input.aiGenerated ? 1 : 0,
    disclosure: input.disclosure,
    parent_asset_id: input.parentAssetId ?? null,
    operation_id: input.operationId,
    provider: input.provider,
    model: input.model,
    created_at: input.createdAt,
    bytes_deleted: 0,
    sha256: sha256(input.bytes),
    metadata_json: JSON.stringify({
      aiModified: input.aiModified,
      aiGenerated: input.aiGenerated,
      disclosure: input.disclosure,
      provider: input.provider,
      model: input.model,
      operationId: input.operationId,
    }),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function extOf(filePath: string): string {
  return path.extname(filePath).replace('.', '') || 'bin';
}
