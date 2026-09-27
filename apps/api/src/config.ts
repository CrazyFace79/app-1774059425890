import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type ProviderMode = 'mock' | 'http' | 'heuristic' | 'local';

export type AppConfig = {
  port: number;
  host: string;
  dataDir: string;
  monetizationEnabled: boolean;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  jobDelayMs: number;
  serverAssetTtlHours: number;
  log: boolean;
  editProvider: 'mock' | 'http';
  videoProvider: 'mock' | 'http';
  segmentProvider: 'heuristic' | 'http';
  upscaleProvider: 'local' | 'http';
  editBaseUrl: string;
  editApiKey: string;
  editModel: string;
  videoBaseUrl: string;
  videoApiKey: string;
  videoModel: string;
  segmentBaseUrl: string;
  segmentApiKey: string;
  upscaleBaseUrl: string;
  upscaleApiKey: string;
  upscaleModel: string;
  videoFps: number;
  videoLongEdge: number;
  videoDurations: number[];
  fontPath: string;
};

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Booleano inválido: ${value}`);
}

function int(value: string | undefined, fallback: number): number {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Número inválido: ${value}`);
  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv, overrides: Partial<AppConfig> = {}): AppConfig {
  const config: AppConfig = {
    port: int(env.PORT, 8787),
    host: env.HOST || '0.0.0.0',
    dataDir: env.DATA_DIR || path.resolve(process.cwd(), 'data'),
    monetizationEnabled: bool(env.MONETIZATION_ENABLED, false),
    rateLimitMax: int(env.RATE_LIMIT_MAX, 120),
    rateLimitWindowMs: int(env.RATE_LIMIT_WINDOW_MS, 60_000),
    jobDelayMs: int(env.JOB_DELAY_MS, 30),
    serverAssetTtlHours: int(env.SERVER_ASSET_TTL_HOURS, 24),
    log: bool(env.LOG, false),
    editProvider: env.EDIT_PROVIDER === 'http' ? 'http' : 'mock',
    videoProvider: env.VIDEO_PROVIDER === 'http' ? 'http' : 'mock',
    segmentProvider: env.SEGMENT_PROVIDER === 'http' ? 'http' : 'heuristic',
    upscaleProvider: env.UPSCALE_PROVIDER === 'http' ? 'http' : 'local',
    editBaseUrl: env.AI_EDIT_BASE_URL || '',
    editApiKey: env.AI_EDIT_API_KEY || '',
    editModel: env.AI_EDIT_MODEL || 'external-edit',
    videoBaseUrl: env.AI_VIDEO_BASE_URL || '',
    videoApiKey: env.AI_VIDEO_API_KEY || '',
    videoModel: env.AI_VIDEO_MODEL || 'external-video',
    segmentBaseUrl: env.AI_SEGMENT_BASE_URL || '',
    segmentApiKey: env.AI_SEGMENT_API_KEY || '',
    upscaleBaseUrl: env.AI_UPSCALE_BASE_URL || '',
    upscaleApiKey: env.AI_UPSCALE_API_KEY || '',
    upscaleModel: env.AI_UPSCALE_MODEL || 'external-upscale',
    videoFps: int(env.VIDEO_FPS, 12),
    videoLongEdge: int(env.VIDEO_LONG_EDGE, 720),
    videoDurations: [2, 3, 4],
    fontPath: env.FONT_PATH || fileURLToPath(new URL('../assets/fonts/DejaVuSans.ttf', import.meta.url)),
  };
  return { ...config, ...overrides };
}
