import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type UserRow = {
  id: string;
  device_id: string;
  plan: string;
  credits: number;
  training_opt_out: number;
  created_at: string;
};

export type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  retention_days: number | null;
  deleted_at: string | null;
};

export type AssetRow = {
  id: string;
  project_id: string;
  user_id: string;
  kind: string;
  path: string;
  width: number;
  height: number;
  mime: string;
  ai_modified: number;
  ai_generated: number;
  disclosure: string;
  parent_asset_id: string | null;
  operation_id: string | null;
  provider: string;
  model: string;
  created_at: string;
  bytes_deleted: number;
  sha256: string;
  metadata_json: string;
};

export type JobRow = {
  id: string;
  user_id: string;
  project_id: string;
  operation_id: string;
  type: string;
  status: string;
  progress: number;
  provider: string;
  model: string;
  error: string | null;
  result_asset_id: string | null;
  payload_json: string;
  created_at: string;
  updated_at: string;
};

export class Store {
  readonly db: DatabaseSync;

  constructor(file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL UNIQUE,
        plan TEXT NOT NULL,
        credits INTEGER NOT NULL,
        training_opt_out INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        retention_days INTEGER,
        deleted_at TEXT
      );
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        path TEXT NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        mime TEXT NOT NULL,
        ai_modified INTEGER NOT NULL,
        ai_generated INTEGER NOT NULL,
        disclosure TEXT NOT NULL,
        parent_asset_id TEXT,
        operation_id TEXT,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        created_at TEXT NOT NULL,
        bytes_deleted INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS operations (
        operation_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        tool TEXT NOT NULL,
        prompt TEXT NOT NULL,
        negative_prompt TEXT NOT NULL,
        preservation_prompt TEXT NOT NULL,
        mask_asset_id TEXT,
        mask_type TEXT NOT NULL,
        input_asset_id TEXT NOT NULL,
        output_asset_id TEXT,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL,
        parameters_json TEXT NOT NULL,
        identity_lock INTEGER NOT NULL,
        edit_scope TEXT NOT NULL,
        job_id TEXT
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        operation_id TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        progress INTEGER NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        error TEXT,
        result_asset_id TEXT,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS usage_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        job_id TEXT,
        kind TEXT NOT NULL,
        credits INTEGER NOT NULL,
        charged INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  close(): void {
    this.db.close();
  }

  getUserByToken(token: string): UserRow | undefined {
    return this.db
      .prepare(
        `SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ?`,
      )
      .get(token) as UserRow | undefined;
  }

  getUser(id: string): UserRow | undefined {
    return this.db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as UserRow | undefined;
  }

  getUserByDevice(deviceId: string): UserRow | undefined {
    return this.db.prepare(`SELECT * FROM users WHERE device_id = ?`).get(deviceId) as UserRow | undefined;
  }

  insertUser(user: UserRow, token: string): void {
    this.db.prepare(
      `INSERT INTO users (id, device_id, plan, credits, training_opt_out, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(user.id, user.device_id, user.plan, user.credits, user.training_opt_out, user.created_at);
    this.db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)`).run(token, user.id, user.created_at);
  }

  insertSession(token: string, userId: string, createdAt: string): void {
    this.db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)`).run(token, userId, createdAt);
  }

  setCredits(userId: string, credits: number): void {
    this.db.prepare(`UPDATE users SET credits = ? WHERE id = ?`).run(credits, userId);
  }

  insertProject(row: ProjectRow): void {
    this.db.prepare(
      `INSERT INTO projects (id, user_id, name, created_at, updated_at, retention_days, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(row.id, row.user_id, row.name, row.created_at, row.updated_at, row.retention_days, row.deleted_at);
  }

  listProjects(userId: string): ProjectRow[] {
    return this.db
      .prepare(`SELECT * FROM projects WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC`)
      .all(userId) as ProjectRow[];
  }

  getProject(userId: string, projectId: string): ProjectRow | undefined {
    return this.db
      .prepare(`SELECT * FROM projects WHERE user_id = ? AND id = ? AND deleted_at IS NULL`)
      .get(userId, projectId) as ProjectRow | undefined;
  }

  touchProject(projectId: string, updatedAt: string, retentionDays?: number | null): void {
    if (retentionDays === undefined) {
      this.db.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`).run(updatedAt, projectId);
      return;
    }
    this.db.prepare(`UPDATE projects SET updated_at = ?, retention_days = ? WHERE id = ?`).run(updatedAt, retentionDays, projectId);
  }

  softDeleteProject(projectId: string, deletedAt: string): void {
    this.db.prepare(`UPDATE projects SET deleted_at = ? WHERE id = ?`).run(deletedAt, projectId);
  }

  insertAsset(row: AssetRow): void {
    this.db.prepare(
      `INSERT INTO assets (
        id, project_id, user_id, kind, path, width, height, mime, ai_modified, ai_generated, disclosure,
        parent_asset_id, operation_id, provider, model, created_at, bytes_deleted, sha256, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      row.id,
      row.project_id,
      row.user_id,
      row.kind,
      row.path,
      row.width,
      row.height,
      row.mime,
      row.ai_modified,
      row.ai_generated,
      row.disclosure,
      row.parent_asset_id,
      row.operation_id,
      row.provider,
      row.model,
      row.created_at,
      row.bytes_deleted,
      row.sha256,
      row.metadata_json,
    );
  }

  getAsset(userId: string, assetId: string): AssetRow | undefined {
    return this.db.prepare(`SELECT * FROM assets WHERE user_id = ? AND id = ?`).get(userId, assetId) as AssetRow | undefined;
  }

  listAssets(projectId: string): AssetRow[] {
    return this.db.prepare(`SELECT * FROM assets WHERE project_id = ? ORDER BY created_at ASC`).all(projectId) as AssetRow[];
  }

  originalAsset(projectId: string): AssetRow | undefined {
    return this.db
      .prepare(`SELECT * FROM assets WHERE project_id = ? AND kind = 'original' ORDER BY created_at ASC LIMIT 1`)
      .get(projectId) as AssetRow | undefined;
  }

  markAssetDeleted(assetId: string): void {
    this.db.prepare(`UPDATE assets SET bytes_deleted = 1, path = '' WHERE id = ?`).run(assetId);
  }

  insertOperation(row: Record<string, string | number | null>): void {
    this.db.prepare(
      `INSERT INTO operations (
        operation_id, project_id, user_id, tool, prompt, negative_prompt, preservation_prompt, mask_asset_id,
        mask_type, input_asset_id, output_asset_id, provider, model, created_at, status, parameters_json,
        identity_lock, edit_scope, job_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      row.operation_id,
      row.project_id,
      row.user_id,
      row.tool,
      row.prompt,
      row.negative_prompt,
      row.preservation_prompt,
      row.mask_asset_id,
      row.mask_type,
      row.input_asset_id,
      row.output_asset_id,
      row.provider,
      row.model,
      row.created_at,
      row.status,
      row.parameters_json,
      row.identity_lock,
      row.edit_scope,
      row.job_id,
    );
  }

  updateOperation(operationId: string, status: string, outputAssetId: string | null, maskAssetId: string | null): void {
    this.db.prepare(
      `UPDATE operations SET status = ?, output_asset_id = COALESCE(?, output_asset_id), mask_asset_id = COALESCE(?, mask_asset_id) WHERE operation_id = ?`,
    ).run(status, outputAssetId, maskAssetId, operationId);
  }

  listOperations(projectId: string): Record<string, unknown>[] {
    return this.db.prepare(`SELECT * FROM operations WHERE project_id = ? ORDER BY created_at ASC`).all(projectId) as Record<string, unknown>[];
  }

  insertJob(row: JobRow): void {
    this.db.prepare(
      `INSERT INTO jobs (
        id, user_id, project_id, operation_id, type, status, progress, provider, model, error, result_asset_id,
        payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      row.id,
      row.user_id,
      row.project_id,
      row.operation_id,
      row.type,
      row.status,
      row.progress,
      row.provider,
      row.model,
      row.error,
      row.result_asset_id,
      row.payload_json,
      row.created_at,
      row.updated_at,
    );
  }

  getJob(userId: string, jobId: string): JobRow | undefined {
    return this.db.prepare(`SELECT * FROM jobs WHERE user_id = ? AND id = ?`).get(userId, jobId) as JobRow | undefined;
  }

  getJobById(jobId: string): JobRow | undefined {
    return this.db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(jobId) as JobRow | undefined;
  }

  setJobPayload(jobId: string, payload: string): void {
    this.db.prepare(`UPDATE jobs SET payload_json = ? WHERE id = ?`).run(payload, jobId);
  }

  updateJob(jobId: string, patch: Partial<Pick<JobRow, 'status' | 'progress' | 'error' | 'result_asset_id' | 'provider' | 'model'>> & { updated_at: string }): void {
    const current = this.getJobById(jobId);
    if (!current) return;
    this.db.prepare(
      `UPDATE jobs SET status = ?, progress = ?, error = ?, result_asset_id = ?, provider = ?, model = ?, updated_at = ? WHERE id = ?`,
    ).run(
      patch.status ?? current.status,
      patch.progress ?? current.progress,
      patch.error === undefined ? current.error : patch.error,
      patch.result_asset_id === undefined ? current.result_asset_id : patch.result_asset_id,
      patch.provider ?? current.provider,
      patch.model ?? current.model,
      patch.updated_at,
      jobId,
    );
  }

  insertUsage(id: string, userId: string, jobId: string | null, kind: string, credits: number, charged: boolean, createdAt: string): void {
    this.db.prepare(
      `INSERT INTO usage_events (id, user_id, job_id, kind, credits, charged, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, userId, jobId, kind, credits, charged ? 1 : 0, createdAt);
  }

  usageFor(userId: string): { events: number; theoreticalCredits: number; chargedCredits: number } {
    const row = this.db.prepare(
      `SELECT COUNT(*) AS events, COALESCE(SUM(credits), 0) AS theoretical, COALESCE(SUM(CASE WHEN charged = 1 THEN credits ELSE 0 END), 0) AS charged
       FROM usage_events WHERE user_id = ?`,
    ).get(userId) as { events: number; theoretical: number; charged: number };
    return { events: Number(row.events), theoreticalCredits: Number(row.theoretical), chargedCredits: Number(row.charged) };
  }

  expiredAssets(nowMs: number): AssetRow[] {
    return (this.db.prepare(`SELECT assets.*, projects.retention_days as retention_days FROM assets JOIN projects ON projects.id = assets.project_id WHERE assets.bytes_deleted = 0`).all() as (AssetRow & { retention_days: number | null })[])
      .filter((asset) => {
        if (asset.kind === 'original') return false;
        if (asset.retention_days == null) return false;
        const created = Date.parse(asset.created_at);
        return nowMs - created >= Math.max(1, asset.retention_days) * 86_400_000;
      });
  }

  deleteUser(userId: string): void {
    this.db.prepare(`DELETE FROM usage_events WHERE user_id = ?`).run(userId);
    this.db.prepare(`DELETE FROM jobs WHERE user_id = ?`).run(userId);
    this.db.prepare(`DELETE FROM operations WHERE user_id = ?`).run(userId);
    this.db.prepare(`DELETE FROM assets WHERE user_id = ?`).run(userId);
    this.db.prepare(`DELETE FROM projects WHERE user_id = ?`).run(userId);
    this.db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
    this.db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
  }
}
