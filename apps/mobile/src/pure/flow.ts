import {
  lineage,
  type HistoryState,
  type MaskMode,
  type Stroke,
  type ToolId,
  type VersionNode,
} from '@lookstudio/domain';

export type HistoryVersionRow = {
  id: string;
  parent_id: string | null;
  asset_id: string;
  operation_id: string | null;
  label: string;
  tool: string | null;
  created_at: string;
};

export type HistoryProjectRow = {
  head_version_id: string;
  redo_json: string;
};

export type ImageAssetRef = {
  id: string;
  mime: string;
  bytes_deleted: number;
};

export function rowsToHistory(project: HistoryProjectRow, versions: HistoryVersionRow[]): HistoryState | null {
  if (!project.head_version_id || versions.length === 0) return null;
  const nodes: VersionNode[] = versions.map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    assetId: row.asset_id,
    operationId: row.operation_id,
    label: row.label,
    tool: row.tool,
    createdAt: row.created_at,
  }));
  return { nodes, headId: project.head_version_id, redoIds: parseRedo(project.redo_json) };
}

export function parseRedo(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

export function latestImageAsset<T extends ImageAssetRef>(history: HistoryState, assets: T[], fromId = history.headId): T | null {
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const trail = lineage(history, fromId).slice().reverse();
  for (const node of trail) {
    const asset = byId.get(node.assetId);
    if (!asset || asset.bytes_deleted) continue;
    if (asset.mime.startsWith('image/')) return asset;
  }
  return null;
}

export function disclosureLabel(value: string | null | undefined): string {
  if (value === 'ai-generated') return 'Generado con IA';
  if (value === 'ai-modified') return 'Modificado con IA';
  if (value === 'procedural-local') return 'Procesado en local. No es IA generativa.';
  if (value === 'none' || !value) return 'Original';
  return value;
}

export function canStartJob(input: {
  online: boolean;
  serverUp: boolean;
  hasImage: boolean;
  pendingReview: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (input.pendingReview) return { ok: false, reason: 'Conserva o descarta el resultado pendiente antes de generar otro.' };
  if (!input.hasImage) return { ok: false, reason: 'Importa una foto para empezar.' };
  if (!input.online) return { ok: false, reason: 'Sin conexión. El trabajo se procesa en la API.' };
  if (!input.serverUp) return { ok: false, reason: 'La API no responde. Revisa la URL en Ajustes.' };
  return { ok: true };
}

export type EditJobPayload = {
  projectId: string;
  operationId: string;
  tool: ToolId;
  presetId: string;
  customPrompt: string;
  parameters: Record<string, number | string | boolean>;
  identityLock: boolean;
  maskMode: MaskMode;
  strokes: Stroke[];
  feather: number;
  invert: boolean;
  variation: number;
  consent: true;
};

export function buildEditPayload(input: Omit<EditJobPayload, 'consent' | 'identityLock'> & { identityLock?: boolean }): EditJobPayload {
  return {
    ...input,
    identityLock: input.identityLock !== false,
    consent: true,
  };
}

export function buildAnimatePayload(input: {
  projectId: string;
  operationId: string;
  presetId: string;
  customPrompt: string;
  identityLock?: boolean;
  aspect: string;
  durationSec: number;
  variation: number;
}): Record<string, unknown> {
  return {
    projectId: input.projectId,
    operationId: input.operationId,
    tool: 'animate',
    presetId: input.presetId,
    customPrompt: input.customPrompt,
    identityLock: input.identityLock !== false,
    aspect: input.aspect,
    durationSec: input.durationSec,
    variation: input.variation,
    consent: true,
  };
}

export function oneParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Algo ha fallado.';
}
