import {
  buildEditPlan,
  rasterizeStrokes,
  renderLocalEdit,
  type Disclosure,
  type PlanInput,
  type Stroke,
} from '@lookstudio/domain';
import type { AppConfig } from './config';
import { AppError } from './errors';
import { decodeWorking, encodeOverlay, encodePng } from './media';

export type ProviderInfo = {
  id: string;
  model: string;
  generative: boolean;
  disclosure: Disclosure;
};

export function describeProviders(config: AppConfig): {
  edit: ProviderInfo;
  video: ProviderInfo;
  segment: ProviderInfo;
  upscale: ProviderInfo;
  durations: number[];
  aspects: ['9:16', '1:1', '16:9'];
  fps: number;
} {
  return {
    edit:
      config.editProvider === 'http'
        ? { id: 'http-edit', model: config.editModel, generative: true, disclosure: 'ai-modified' }
        : { id: 'mock-local', model: 'procedural-mask-v1', generative: false, disclosure: 'procedural-local' },
    video:
      config.videoProvider === 'http'
        ? { id: 'http-video', model: config.videoModel, generative: true, disclosure: 'ai-generated' }
        : { id: 'mock-camera', model: 'ffmpeg-camera-v1', generative: false, disclosure: 'procedural-local' },
    segment:
      config.segmentProvider === 'http'
        ? { id: 'http-segment', model: 'external-segment', generative: true, disclosure: 'ai-modified' }
        : { id: 'heuristic-segment', model: 'portrait-zones-v1', generative: false, disclosure: 'procedural-local' },
    upscale:
      config.upscaleProvider === 'http'
        ? { id: 'http-upscale', model: config.upscaleModel, generative: true, disclosure: 'ai-modified' }
        : { id: 'local-lanczos', model: 'sharp-lanczos', generative: false, disclosure: 'procedural-local' },
    durations: config.videoDurations,
    aspects: ['9:16', '1:1', '16:9'],
    fps: config.videoFps,
  };
}

export async function editImage(options: {
  config: AppConfig;
  image: Buffer;
  planInput: PlanInput;
  strokes: Stroke[];
  seed: number;
  feather: number;
  invert?: boolean;
}): Promise<{
  png: Buffer;
  width: number;
  height: number;
  maskPng: Buffer;
  plan: ReturnType<typeof buildEditPlan>;
  provider: ProviderInfo;
  upscaleFactor: number | null;
}> {
  const decoded = await decodeWorking(options.image);
  const plan = buildEditPlan({ ...options.planInput, maskMode: options.planInput.maskMode ?? (options.strokes.length ? 'manual' : 'auto') });
  const userMask =
    options.strokes.length > 0 || plan.maskMode === 'manual'
      ? rasterizeStrokes(decoded.width, decoded.height, options.strokes, { invert: options.invert === true, feather: 0 })
      : null;
  const provider = describeProviders(options.config).edit;
  if (options.config.editProvider === 'http') {
    const localPreview = renderLocalEdit({
      ...options.planInput,
      rgba: decoded.rgba,
      width: decoded.width,
      height: decoded.height,
      userMask,
      seed: options.seed,
      feather: 0,
    });
    const maskPng = await encodePng(maskToRgba(localPreview.mask, decoded.width, decoded.height), decoded.width, decoded.height);
    const remote = await postImage(options.config.editBaseUrl, options.config.editApiKey, options.config.editModel, '/v1/edits', {
      model: options.config.editModel,
      prompt: plan.prompt,
      negativePrompt: plan.negativePrompt,
      preservationPrompt: plan.preservationPrompt,
      imageBase64: (await encodePng(decoded.rgba, decoded.width, decoded.height)).toString('base64'),
      maskBase64: maskPng.toString('base64'),
      parameters: plan.parameters,
      identityLock: plan.identityLock,
      tool: plan.tool,
      seed: options.seed,
      trainingOptOut: true,
    });
    return {
      png: remote.buffer,
      width: decoded.width,
      height: decoded.height,
      maskPng,
      plan,
      provider: { ...provider, model: remote.model },
      upscaleFactor: renderedUpscale(plan),
    };
  }
  const rendered = renderLocalEdit({
    ...options.planInput,
    rgba: decoded.rgba,
    width: decoded.width,
    height: decoded.height,
    userMask,
    seed: options.seed,
    feather: options.feather,
  });
  const description = `AI Look Studio | ${provider.disclosure} | ${plan.tool}`;
  const png = await encodePng(rendered.rgba, decoded.width, decoded.height, description);
  const maskPng = await encodeOverlay(rendered.mask, decoded.width, decoded.height);
  return { png, width: decoded.width, height: decoded.height, maskPng, plan: rendered.plan, provider, upscaleFactor: rendered.upscaleFactor };
}

function renderedUpscale(plan: ReturnType<typeof buildEditPlan>): number | null {
  return plan.tool === 'retouch' && plan.presetId === 'upscale' && typeof plan.parameters.scale === 'number' ? plan.parameters.scale : null;
}

export async function previewMask(options: {
  config: AppConfig;
  image: Buffer;
  planInput: PlanInput;
  strokes: Stroke[];
  feather: number;
  invert: boolean;
}): Promise<{ overlayPng: Buffer; width: number; height: number; confidence: number; source: string; warnings: string[] }> {
  const decoded = await decodeWorking(options.image);
  if (options.config.segmentProvider === 'http' && options.strokes.length === 0) {
    const remote = await postImage(options.config.segmentBaseUrl, options.config.segmentApiKey, 'external-segment', '/v1/segment', {
      imageBase64: options.image.toString('base64'),
      tool: options.planInput.tool,
      trainingOptOut: true,
    });
    const meta = await decodeWorking(remote.buffer);
    return {
      overlayPng: remote.buffer,
      width: meta.width,
      height: meta.height,
      confidence: 1,
      source: 'http',
      warnings: [],
    };
  }
  const strokes = options.invert ? options.strokes : options.strokes;
  const userMask = options.planInput.maskMode === 'manual' || strokes.length > 0
    ? rasterizeStrokes(decoded.width, decoded.height, strokes, { invert: options.invert, feather: 0 })
    : null;
  const rendered = renderLocalEdit({
    ...options.planInput,
    rgba: decoded.rgba,
    width: decoded.width,
    height: decoded.height,
    userMask,
    feather: options.feather,
    seed: 1,
  });
  return {
    overlayPng: await encodeOverlay(rendered.mask, decoded.width, decoded.height),
    width: decoded.width,
    height: decoded.height,
    confidence: rendered.confidence,
    source: rendered.personSource,
    warnings: rendered.plan.warnings,
  };
}

function maskToRgba(mask: Uint8Array, width: number, height: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < mask.length; i += 1) {
    const value = mask[i] ?? 0;
    rgba[i * 4] = value;
    rgba[i * 4 + 1] = value;
    rgba[i * 4 + 2] = value;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

async function postImage(
  baseUrl: string,
  apiKey: string,
  fallbackModel: string,
  pathname: string,
  body: Record<string, unknown>,
): Promise<{ buffer: Buffer; model: string }> {
  if (!baseUrl || !apiKey) {
    throw new AppError(500, 'provider_not_configured', 'Falta la URL o la clave del proveedor. No hay ninguna clave en la app.');
  }
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${pathname}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Training-Opt-Out': 'true',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new AppError(502, 'provider_failed', `El proveedor respondió ${response.status}.`);
  const json = (await response.json()) as { imageBase64?: string; videoBase64?: string; model?: string };
  const encoded = json.imageBase64 || json.videoBase64;
  if (!encoded) throw new AppError(502, 'provider_failed', 'El proveedor no devolvió un archivo.');
  return { buffer: Buffer.from(encoded, 'base64'), model: json.model || fallbackModel };
}

export async function requestRemoteVideo(config: AppConfig, body: Record<string, unknown>): Promise<{ buffer: Buffer; model: string }> {
  return postImage(config.videoBaseUrl, config.videoApiKey, config.videoModel, '/v1/videos', body);
}

export async function requestRemoteUpscale(config: AppConfig, image: Buffer, scale: number): Promise<{ buffer: Buffer; model: string }> {
  return postImage(config.upscaleBaseUrl, config.upscaleApiKey, config.upscaleModel, '/v1/upscale', {
    imageBase64: image.toString('base64'),
    scale,
    trainingOptOut: true,
  });
}
