import * as SQLite from 'expo-sqlite';

let database: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retention_days INTEGER,
  head_version_id TEXT NOT NULL DEFAULT '',
  redo_json TEXT NOT NULL DEFAULT '[]',
  deleted INTEGER NOT NULL DEFAULT 0,
  server_original INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  mime TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  local_uri TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  disclosure TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  operation_id TEXT,
  bytes_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  parent_id TEXT,
  asset_id TEXT NOT NULL,
  operation_id TEXT,
  label TEXT NOT NULL,
  tool TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS operations (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  preset_id TEXT NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  negative_prompt TEXT NOT NULL DEFAULT '',
  preservation_prompt TEXT NOT NULL DEFAULT '',
  mask_mode TEXT NOT NULL,
  identity_lock INTEGER NOT NULL,
  parameters_json TEXT NOT NULL,
  strokes_json TEXT NOT NULL,
  feather REAL NOT NULL,
  invert INTEGER NOT NULL,
  custom_prompt TEXT NOT NULL DEFAULT '',
  variation INTEGER NOT NULL DEFAULT 0,
  input_asset_id TEXT NOT NULL,
  output_asset_id TEXT,
  provider TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  disclosure TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  warnings_json TEXT NOT NULL DEFAULT '[]',
  job_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reels (
  project_id TEXT PRIMARY KEY NOT NULL,
  timeline_json TEXT NOT NULL
);
`;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  database ??= SQLite.openDatabaseAsync('lookstudio.db').then(async (db) => {
    await db.execAsync(SCHEMA);
    return db;
  });
  return database;
}
