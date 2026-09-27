import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import type { ReelTimeline } from '@lookstudio/domain';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export type SessionBody = {
  token: string;
  userId: string;
  plan: string;
  credits: number;
  monetizationEnabled: boolean;
  trainingOptOut: boolean;
};

export type JobView = {
  id: string;
  operationId: string;
  projectId: string;
  status: string;
  progress: number;
  provider: string;
  model: string;
  error: string | null;
  resultAssetId: string | null;
  prompt: string;
  negativePrompt: string;
  preservationPrompt: string;
  summary: string;
  warnings: string[];
  editScope: string | null;
  disclosure: string | null;
  identityLock: boolean | null;
};

export type AssetView = {
  id: string;
  width: number;
  height: number;
  mime: string;
  disclosure: string;
  provider: string;
  model: string;
};

export type Capabilities = {
  monetizationEnabled: boolean;
  purchasesAvailable: boolean;
  trainingOptOut: boolean;
  providers: {
    edit: { id: string; model: string; generative: boolean; disclosure: string };
    video: { id: string; model: string; generative: boolean; disclosure: string };
    segment: { id: string; model: string; generative: boolean; disclosure: string };
    upscale: { id: string; model: string; generative: boolean; disclosure: string };
    durations: number[];
    aspects: string[];
  };
};

function trimBase(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

async function readError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    return new ApiError(response.status, body.error ?? 'http', body.message ?? `Error ${response.status}`);
  } catch {
    return new ApiError(response.status, 'http', `Error ${response.status}`);
  }
}

function appendLocalFile(form: FormData, field: string, uri: string, name: string, mime: string): void {
  if (Platform.OS === 'web') {
    form.append(field, new File(uri), name);
    return;
  }
  form.append(field, { uri, name, type: mime } as unknown as Blob);
}

export class LookClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string | null,
  ) {}

  private headers(json: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Upload-Consent': 'true',
      'X-Training-Opt-Out': 'true',
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
  }

  private async json<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${trimBase(this.baseUrl)}${path}`, {
      ...init,
      headers: { ...this.headers(!init?.body || typeof init.body === 'string'), ...(init?.headers as Record<string, string> | undefined) },
    });
    if (!response.ok) throw await readError(response);
    return (await response.json()) as T;
  }

  health(): Promise<{ ok: boolean; monetizationEnabled: boolean }> {
    return this.json('/v1/health');
  }

  auth(deviceId: string): Promise<SessionBody> {
    return this.json('/v1/auth/device', { method: 'POST', body: JSON.stringify({ deviceId }) });
  }

  capabilities(): Promise<Capabilities> {
    return this.json('/v1/providers/capabilities');
  }

  usage(): Promise<{ plan: string; credits: number; monetizationEnabled: boolean }> {
    return this.json('/v1/usage');
  }

  privacy(): Promise<{ summary: string; trainingOptOut: boolean; serverAssetTtlHours: number }> {
    return this.json('/v1/privacy');
  }

  createProject(id: string, name: string): Promise<{ id: string }> {
    return this.json('/v1/projects', { method: 'POST', body: JSON.stringify({ id, name }) });
  }

  patchProject(id: string, body: { name?: string; retentionDays?: number | null }): Promise<{ ok: boolean }> {
    return this.json(`/v1/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  deleteProject(id: string): Promise<{ ok: boolean }> {
    return this.json(`/v1/projects/${id}`, { method: 'DELETE' });
  }

  deleteOriginal(id: string): Promise<{ ok: boolean }> {
    return this.json(`/v1/projects/${id}/original`, { method: 'DELETE' });
  }

  deleteAll(): Promise<{ ok: boolean }> {
    return this.json('/v1/privacy/delete-all', { method: 'POST', body: '{}' });
  }

  sweep(): Promise<{ removed: number }> {
    return this.json('/v1/privacy/sweep', { method: 'POST', body: '{}' });
  }

  async uploadOriginal(projectId: string, uri: string, name: string, mime: string): Promise<void> {
    const form = new FormData();
    form.append('consent', 'true');
    appendLocalFile(form, 'image', uri, name, mime);
    const response = await fetch(`${trimBase(this.baseUrl)}/v1/projects/${projectId}/assets`, {
      method: 'POST',
      headers: this.headers(false),
      body: form,
    });
    if (!response.ok) throw await readError(response);
  }

  async postJob(uri: string, name: string, mime: string, payload: unknown): Promise<{ jobId: string; operationId: string; status: string }> {
    const form = new FormData();
    form.append('consent', 'true');
    form.append('payload', JSON.stringify(payload));
    appendLocalFile(form, 'image', uri, name, mime);
    const response = await fetch(`${trimBase(this.baseUrl)}/v1/jobs`, {
      method: 'POST',
      headers: this.headers(false),
      body: form,
    });
    if (!response.ok) throw await readError(response);
    return (await response.json()) as { jobId: string; operationId: string; status: string };
  }

  async previewMask(uri: string, name: string, mime: string, payload: unknown): Promise<{
    overlayPngBase64: string;
    confidence: number;
    source: string;
    warnings: string[];
  }> {
    const form = new FormData();
    form.append('consent', 'true');
    form.append('payload', JSON.stringify(payload));
    appendLocalFile(form, 'image', uri, name, mime);
    const response = await fetch(`${trimBase(this.baseUrl)}/v1/masks/preview`, {
      method: 'POST',
      headers: this.headers(false),
      body: form,
    });
    if (!response.ok) throw await readError(response);
    return (await response.json()) as { overlayPngBase64: string; confidence: number; source: string; warnings: string[] };
  }

  async postReel(
    clips: { id: string; uri: string; name: string; mime: string }[],
    audio: { uri: string; name: string; mime: string } | null,
    payload: { projectId: string; operationId: string; timeline: ReelTimeline; preview: boolean; containsAi: boolean },
  ): Promise<{ jobId: string; operationId: string; status: string }> {
    const form = new FormData();
    form.append('consent', 'true');
    form.append('payload', JSON.stringify(payload));
    for (const clip of clips) appendLocalFile(form, `clip_${clip.id}`, clip.uri, clip.name, clip.mime);
    if (audio) appendLocalFile(form, 'audio', audio.uri, audio.name, audio.mime);
    const response = await fetch(`${trimBase(this.baseUrl)}/v1/reels/render`, {
      method: 'POST',
      headers: this.headers(false),
      body: form,
    });
    if (!response.ok) throw await readError(response);
    return (await response.json()) as { jobId: string; operationId: string; status: string };
  }

  getJob(jobId: string): Promise<JobView> {
    return this.json(`/v1/jobs/${jobId}`);
  }

  cancelJob(jobId: string): Promise<{ ok: boolean }> {
    return this.json(`/v1/jobs/${jobId}/cancel`, { method: 'POST', body: '{}' });
  }

  getAsset(assetId: string): Promise<AssetView> {
    return this.json(`/v1/assets/${assetId}`);
  }

  async downloadAsset(assetId: string): Promise<Uint8Array> {
    const response = await fetch(`${trimBase(this.baseUrl)}/v1/assets/${assetId}/file`, { headers: this.headers(false) });
    if (!response.ok) throw await readError(response);
    return new Uint8Array(await response.arrayBuffer());
  }

  async stamp(projectId: string, uri: string, name: string, mime: string, disclosure: string): Promise<Uint8Array> {
    const form = new FormData();
    form.append('consent', 'true');
    form.append('payload', JSON.stringify({ projectId, visible: true, disclosure }));
    appendLocalFile(form, 'image', uri, name, mime);
    const response = await fetch(`${trimBase(this.baseUrl)}/v1/exports/stamp`, {
      method: 'POST',
      headers: this.headers(false),
      body: form,
    });
    if (!response.ok) throw await readError(response);
    return new Uint8Array(await response.arrayBuffer());
  }
}
