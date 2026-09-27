import {
  createEmptyReel,
  jumpHistory,
  keepVersion,
  nextVersionLabel,
  redoHistory,
  resetFull,
  resetTool,
  retentionExpired,
  undoHistory,
  type HistoryState,
  type ReelTimeline,
  type VersionNode,
} from '@lookstudio/domain';
import { getDb } from './db';
import { deleteProjectTree, deleteUri, extForBytes, newId, readUriBytes, sha256Hex, writeProjectFile } from './files';
import { rowsToHistory } from '../pure/flow';

export type ProjectRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  retention_days: number | null;
  head_version_id: string;
  redo_json: string;
  deleted: number;
  server_original: number;
};

export type AssetRow = {
  id: string;
  project_id: string;
  kind: string;
  mime: string;
  width: number;
  height: number;
  local_uri: string;
  sha256: string;
  disclosure: string;
  provider: string;
  model: string;
  operation_id: string | null;
  bytes_deleted: number;
  created_at: string;
};

export type VersionRow = {
  id: string;
  project_id: string;
  parent_id: string | null;
  asset_id: string;
  operation_id: string | null;
  label: string;
  tool: string | null;
  created_at: string;
};

export type OperationRow = {
  id: string;
  project_id: string;
  tool: string;
  preset_id: string;
  prompt: string;
  negative_prompt: string;
  preservation_prompt: string;
  mask_mode: string;
  identity_lock: number;
  parameters_json: string;
  strokes_json: string;
  feather: number;
  invert: number;
  custom_prompt: string;
  variation: number;
  input_asset_id: string;
  output_asset_id: string | null;
  provider: string;
  model: string;
  status: string;
  disclosure: string;
  summary: string;
  warnings_json: string;
  job_id: string | null;
  created_at: string;
};

export type ProjectView = {
  project: ProjectRow;
  assets: AssetRow[];
  versions: VersionRow[];
  operations: OperationRow[];
  history: HistoryState | null;
  head: AssetRow | null;
  original: AssetRow | null;
  pending: OperationRow | null;
};

const nowIso = (): string => new Date().toISOString();

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

export async function listProjects(): Promise<ProjectRow[]> {
  const db = await getDb();
  return db.getAllAsync<ProjectRow>('SELECT * FROM projects WHERE deleted = 0 ORDER BY updated_at DESC');
}

export async function getProject(id: string): Promise<ProjectRow | null> {
  const db = await getDb();
  return db.getFirstAsync<ProjectRow>('SELECT * FROM projects WHERE id = ? AND deleted = 0', id);
}

async function requireProject(id: string): Promise<ProjectRow> {
  const project = await getProject(id);
  if (!project) throw new Error('El proyecto no existe.');
  return project;
}

export async function createProject(name: string): Promise<ProjectRow> {
  const db = await getDb();
  const id = newId();
  const now = nowIso();
  const clean = name.trim().slice(0, 80) || 'Proyecto';
  await db.runAsync(
    `INSERT INTO projects (id, name, created_at, updated_at, retention_days, head_version_id, redo_json, deleted, server_original)
     VALUES (?, ?, ?, ?, NULL, '', '[]', 0, 0)`,
    id,
    clean,
    now,
    now,
  );
  const created = await getProject(id);
  if (!created) throw new Error('No se pudo crear el proyecto.');
  return created;
}

export async function renameProject(id: string, name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?', name.trim().slice(0, 80) || 'Proyecto', nowIso(), id);
}

export async function setRetention(id: string, days: number | null): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE projects SET retention_days = ?, updated_at = ? WHERE id = ?', days, nowIso(), id);
}

export async function markServerOriginal(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE projects SET server_original = 1 WHERE id = ?', id);
}

async function setHead(id: string, headId: string, redoIds: string[]): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE projects SET head_version_id = ?, redo_json = ?, updated_at = ? WHERE id = ?',
    headId,
    JSON.stringify(redoIds),
    nowIso(),
    id,
  );
}

export async function listAssets(projectId: string): Promise<AssetRow[]> {
  const db = await getDb();
  return db.getAllAsync<AssetRow>('SELECT * FROM assets WHERE project_id = ? ORDER BY created_at ASC', projectId);
}

export async function getAsset(id: string): Promise<AssetRow | null> {
  const db = await getDb();
  return db.getFirstAsync<AssetRow>('SELECT * FROM assets WHERE id = ?', id);
}

export async function listVersions(projectId: string): Promise<VersionRow[]> {
  const db = await getDb();
  return db.getAllAsync<VersionRow>('SELECT * FROM versions WHERE project_id = ? ORDER BY created_at ASC', projectId);
}

export async function listOperations(projectId: string): Promise<OperationRow[]> {
  const db = await getDb();
  return db.getAllAsync<OperationRow>('SELECT * FROM operations WHERE project_id = ? ORDER BY created_at DESC', projectId);
}

export async function getOperation(id: string): Promise<OperationRow | null> {
  const db = await getDb();
  return db.getFirstAsync<OperationRow>('SELECT * FROM operations WHERE id = ?', id);
}

export async function loadProjectView(projectId: string): Promise<ProjectView | null> {
  const project = await getProject(projectId);
  if (!project) return null;
  const [assets, versions, operations] = await Promise.all([
    listAssets(projectId),
    listVersions(projectId),
    listOperations(projectId),
  ]);
  const history = rowsToHistory(project, versions);
  const head = history ? assets.find((asset) => asset.id === history.nodes.find((node) => node.id === history.headId)?.assetId) ?? null : null;
  const original = assets.find((asset) => asset.kind === 'original') ?? null;
  const pending = operations.find((item) => item.status === 'review') ?? null;
  return { project, assets, versions, operations, history, head: head ?? null, original: original ?? null, pending };
}

export async function importOriginal(projectId: string, sourceUri: string, width: number, height: number): Promise<void> {
  const assets = await listAssets(projectId);
  if (assets.some((asset) => asset.kind === 'original')) {
    throw new Error('El original ya existe. Crea otro proyecto para una foto distinta.');
  }
  const bytes = await readUriBytes(sourceUri);
  if (bytes.byteLength > 15 * 1024 * 1024) throw new Error('La imagen supera 15 MB.');
  const typed = extForBytes(bytes);
  const uri = await writeProjectFile(projectId, `original.${typed.ext}`, bytes);
  const hash = await sha256Hex(bytes);
  const created = nowIso();
  const assetId = newId();
  const versionId = newId();
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO assets (id, project_id, kind, mime, width, height, local_uri, sha256, disclosure, provider, model, operation_id, bytes_deleted, created_at)
     VALUES (?, ?, 'original', ?, ?, ?, ?, ?, 'none', 'device', 'import', NULL, 0, ?)`,
    assetId,
    projectId,
    typed.mime,
    Math.max(1, width),
    Math.max(1, height),
    uri,
    hash,
    created,
  );
  await db.runAsync(
    `INSERT INTO versions (id, project_id, parent_id, asset_id, operation_id, label, tool, created_at)
     VALUES (?, ?, NULL, ?, NULL, 'ORIGINAL', NULL, ?)`,
    versionId,
    projectId,
    assetId,
    created,
  );
  await setHead(projectId, versionId, []);
}

export async function insertPendingAsset(input: {
  projectId: string;
  operationId: string;
  bytes: Uint8Array;
  mime: string;
  ext: string;
  width: number;
  height: number;
  disclosure: string;
  provider: string;
  model: string;
}): Promise<string> {
  const assetId = newId();
  const uri = await writeProjectFile(input.projectId, `pending-${assetId}.${input.ext}`, input.bytes);
  const hash = await sha256Hex(input.bytes);
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO assets (id, project_id, kind, mime, width, height, local_uri, sha256, disclosure, provider, model, operation_id, bytes_deleted, created_at)
     VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    assetId,
    input.projectId,
    input.mime,
    input.width,
    input.height,
    uri,
    hash,
    input.disclosure,
    input.provider,
    input.model,
    input.operationId,
    nowIso(),
  );
  return assetId;
}

export async function insertOperation(input: {
  id: string;
  projectId: string;
  tool: string;
  presetId: string;
  maskMode: string;
  identityLock: boolean;
  parameters: Record<string, number | string | boolean>;
  strokes: unknown;
  feather: number;
  invert: boolean;
  customPrompt: string;
  variation: number;
  inputAssetId: string;
}): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO operations (
      id, project_id, tool, preset_id, mask_mode, identity_lock, parameters_json, strokes_json, feather, invert,
      custom_prompt, variation, input_asset_id, status, warnings_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', '[]', ?)`,
    input.id,
    input.projectId,
    input.tool,
    input.presetId,
    input.maskMode,
    input.identityLock ? 1 : 0,
    JSON.stringify(input.parameters),
    JSON.stringify(input.strokes),
    input.feather,
    input.invert ? 1 : 0,
    input.customPrompt,
    input.variation,
    input.inputAssetId,
    nowIso(),
  );
}

export async function finishOperation(input: {
  id: string;
  status: string;
  outputAssetId?: string | null;
  provider?: string;
  model?: string;
  disclosure?: string;
  summary?: string;
  warnings?: string[];
  prompt?: string;
  negativePrompt?: string;
  preservationPrompt?: string;
  jobId?: string | null;
}): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE operations SET status = ?, output_asset_id = ?, provider = ?, model = ?, disclosure = ?, summary = ?,
     warnings_json = ?, prompt = ?, negative_prompt = ?, preservation_prompt = ?, job_id = ? WHERE id = ?`,
    input.status,
    input.outputAssetId ?? null,
    input.provider ?? '',
    input.model ?? '',
    input.disclosure ?? '',
    input.summary ?? '',
    JSON.stringify(input.warnings ?? []),
    input.prompt ?? '',
    input.negativePrompt ?? '',
    input.preservationPrompt ?? '',
    input.jobId ?? null,
    input.id,
  );
}

async function historyOf(projectId: string): Promise<{ project: ProjectRow; history: HistoryState; versions: VersionRow[] }> {
  const project = await requireProject(projectId);
  const versions = await listVersions(projectId);
  const history = rowsToHistory(project, versions);
  if (!history) throw new Error('Importa una foto antes de editar el historial.');
  return { project, history, versions };
}

async function commit(projectId: string, state: HistoryState): Promise<void> {
  await setHead(projectId, state.headId, state.redoIds);
}

export async function undoProject(projectId: string): Promise<void> {
  const { history } = await historyOf(projectId);
  await commit(projectId, undoHistory(history));
}

export async function redoProject(projectId: string): Promise<void> {
  const { history } = await historyOf(projectId);
  await commit(projectId, redoHistory(history));
}

export async function jumpProject(projectId: string, versionId: string): Promise<void> {
  const { history } = await historyOf(projectId);
  await commit(projectId, jumpHistory(history, versionId));
}

export async function resetProject(projectId: string): Promise<void> {
  const { history } = await historyOf(projectId);
  await commit(projectId, resetFull(history));
}

export async function resetProjectTool(projectId: string, tool: string): Promise<void> {
  const { history } = await historyOf(projectId);
  await commit(projectId, resetTool(history, tool));
}

export async function keepOperation(operationId: string): Promise<void> {
  const operation = await getOperation(operationId);
  if (!operation || operation.status !== 'review' || !operation.output_asset_id) {
    throw new Error('No hay un resultado pendiente para conservar.');
  }
  const { history, versions } = await historyOf(operation.project_id);
  const created = nowIso();
  const versionId = newId();
  const node: VersionNode = {
    id: versionId,
    parentId: history.headId,
    assetId: operation.output_asset_id,
    operationId: operation.id,
    label: nextVersionLabel(operation.tool, versions.map((item) => item.label)),
    tool: operation.tool,
    createdAt: created,
  };
  const next = keepVersion(history, node);
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO versions (id, project_id, parent_id, asset_id, operation_id, label, tool, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    node.id,
    operation.project_id,
    node.parentId,
    node.assetId,
    node.operationId,
    node.label,
    node.tool,
    node.createdAt,
  );
  const kind = operation.tool === 'reel' ? 'export' : operation.tool === 'animate' ? 'video' : 'version';
  await db.runAsync('UPDATE assets SET kind = ? WHERE id = ?', kind, operation.output_asset_id);
  await commit(operation.project_id, next);
  await db.runAsync(`UPDATE operations SET status = 'kept' WHERE id = ?`, operation.id);
}

export async function discardOperation(operationId: string): Promise<void> {
  const operation = await getOperation(operationId);
  if (!operation) return;
  if (operation.output_asset_id) {
    const asset = await getAsset(operation.output_asset_id);
    if (asset && asset.kind === 'pending') {
      deleteUri(asset.local_uri);
      const db = await getDb();
      await db.runAsync('UPDATE assets SET bytes_deleted = 1 WHERE id = ?', asset.id);
    }
  }
  const db = await getDb();
  await db.runAsync(`UPDATE operations SET status = 'discarded' WHERE id = ?`, operation.id);
}

export async function duplicateProject(sourceId: string): Promise<string> {
  const source = await requireProject(sourceId);
  const assets = await listAssets(sourceId);
  const versions = await listVersions(sourceId);
  const copyId = newId();
  const created = nowIso();
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO projects (id, name, created_at, updated_at, retention_days, head_version_id, redo_json, deleted, server_original)
     VALUES (?, ?, ?, ?, ?, '', '[]', 0, 0)`,
    copyId,
    `Copia de ${source.name}`.slice(0, 80),
    created,
    created,
    source.retention_days,
  );
  const assetMap = new Map<string, string>();
  for (const asset of assets) {
    if (asset.bytes_deleted) continue;
    const bytes = await readUriBytes(asset.local_uri);
    const nextAssetId = newId();
    const ext = asset.mime.includes('png') ? 'png' : asset.mime.includes('webp') ? 'webp' : asset.mime.includes('mp4') ? 'mp4' : 'jpg';
    const name = asset.kind === 'original' ? `original.${ext}` : `v-${nextAssetId}.${ext}`;
    const uri = await writeProjectFile(copyId, name, bytes);
    assetMap.set(asset.id, nextAssetId);
    await db.runAsync(
      `INSERT INTO assets (id, project_id, kind, mime, width, height, local_uri, sha256, disclosure, provider, model, operation_id, bytes_deleted, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?)`,
      nextAssetId,
      copyId,
      asset.kind === 'pending' ? 'version' : asset.kind,
      asset.mime,
      asset.width,
      asset.height,
      uri,
      asset.sha256,
      asset.disclosure,
      asset.provider,
      asset.model,
      created,
    );
  }
  const versionMap = new Map<string, string>();
  for (const version of versions) {
    if (!assetMap.has(version.asset_id)) continue;
    versionMap.set(version.id, newId());
  }
  for (const version of versions) {
    const nextVersionId = versionMap.get(version.id);
    const nextAssetId = assetMap.get(version.asset_id);
    if (!nextVersionId || !nextAssetId) continue;
    const parent = version.parent_id ? versionMap.get(version.parent_id) ?? null : null;
    if (version.parent_id && !parent) continue;
    await db.runAsync(
      `INSERT INTO versions (id, project_id, parent_id, asset_id, operation_id, label, tool, created_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
      nextVersionId,
      copyId,
      parent,
      nextAssetId,
      version.label,
      version.tool,
      created,
    );
  }
  const head = versionMap.get(source.head_version_id) ?? '';
  const redo = JSON.parse(source.redo_json) as unknown;
  const nextRedo = Array.isArray(redo) ? redo.flatMap((item) => (typeof item === 'string' && versionMap.get(item) ? [versionMap.get(item) as string] : [])) : [];
  await setHead(copyId, head, nextRedo);
  return copyId;
}

export async function deleteProject(projectId: string): Promise<void> {
  const db = await getDb();
  deleteProjectTree(projectId);
  await db.runAsync('UPDATE projects SET deleted = 1, updated_at = ? WHERE id = ?', nowIso(), projectId);
}

export async function deleteOriginalBytes(projectId: string): Promise<void> {
  const assets = await listAssets(projectId);
  const original = assets.find((asset) => asset.kind === 'original' && !asset.bytes_deleted);
  if (!original) throw new Error('No hay original para borrar.');
  deleteUri(original.local_uri);
  const db = await getDb();
  await db.runAsync('UPDATE assets SET bytes_deleted = 1, local_uri = ? WHERE id = ?', '', original.id);
}

export async function wipeLocal(): Promise<void> {
  const projects = await listProjects();
  for (const project of projects) deleteProjectTree(project.id);
  const db = await getDb();
  await db.execAsync('DELETE FROM operations; DELETE FROM versions; DELETE FROM assets; DELETE FROM reels; DELETE FROM projects; DELETE FROM settings;');
}

export async function sweepRetention(): Promise<number> {
  const projects = await listProjects();
  const db = await getDb();
  let removed = 0;
  for (const project of projects) {
    const assets = await listAssets(project.id);
    for (const asset of assets) {
      if (asset.kind === 'original' || asset.bytes_deleted) continue;
      if (!retentionExpired(asset.created_at, project.retention_days, Date.now())) continue;
      deleteUri(asset.local_uri);
      await db.runAsync('UPDATE assets SET bytes_deleted = 1 WHERE id = ?', asset.id);
      removed += 1;
    }
  }
  return removed;
}

export async function loadTimeline(projectId: string): Promise<ReelTimeline> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ timeline_json: string }>('SELECT timeline_json FROM reels WHERE project_id = ?', projectId);
  if (!row) return createEmptyReel(newId(), projectId);
  try {
    return JSON.parse(row.timeline_json) as ReelTimeline;
  } catch {
    return createEmptyReel(newId(), projectId);
  }
}

export async function saveTimeline(projectId: string, timeline: ReelTimeline): Promise<void> {
  const db = await getDb();
  const json = JSON.stringify(timeline);
  await db.runAsync(
    'INSERT INTO reels (project_id, timeline_json) VALUES (?, ?) ON CONFLICT(project_id) DO UPDATE SET timeline_json = excluded.timeline_json',
    projectId,
    json,
  );
}

export async function writeSidecar(projectId: string, name: string, payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload, null, 2));
  return writeProjectFile(projectId, name, bytes);
}
