import fs from 'node:fs';
import path from 'node:path';
import type { AppConfig } from './config';

export function userDir(config: AppConfig, userId: string): string {
  return path.join(config.dataDir, 'users', userId);
}

export function assetPath(config: AppConfig, userId: string, assetId: string, ext: string): string {
  const dir = path.join(userDir(config, userId), 'assets');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${assetId}.${ext}`);
}

export function workDir(config: AppConfig, jobId: string): string {
  const dir = path.join(config.dataDir, 'tmp', jobId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function removePath(target: string): void {
  fs.rmSync(target, { recursive: true, force: true });
}
