import { DomainError, type AspectRatio } from './types';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_WORKING_EDGE = 1280;
export const MIN_IMAGE_EDGE = 64;
export const MAX_IMAGE_EDGE = 8000;

export type ImageType = 'jpeg' | 'png' | 'webp';

export function detectImageType(buf: Uint8Array): ImageType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'png';
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

export function validateImageMeta(input: {
  bytes: number;
  width: number;
  height: number;
  type: ImageType | null;
}): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!input.type) errors.push('Formato no soportado. Usa JPEG, PNG o WebP.');
  if (input.bytes <= 0) errors.push('La imagen está vacía.');
  if (input.bytes > MAX_UPLOAD_BYTES) errors.push('La imagen supera 15 MB.');
  if (input.width < MIN_IMAGE_EDGE || input.height < MIN_IMAGE_EDGE) {
    errors.push('La imagen es demasiado pequeña (mínimo 64 px).');
  }
  if (input.width > MAX_IMAGE_EDGE || input.height > MAX_IMAGE_EDGE) {
    errors.push('La imagen es demasiado grande (máximo 8000 px).');
  }
  if (!Number.isFinite(input.width) || !Number.isFinite(input.height)) {
    errors.push('Dimensiones de imagen no válidas.');
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function sanitizeUserText(text: string, max = 500): string {
  return text.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function parseHexColor(input: string): [number, number, number] | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(input.trim());
  if (!match?.[1]) return null;
  const n = Number.parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function evenDimension(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

export function aspectSize(aspect: AspectRatio, longEdge: number): { width: number; height: number } {
  const long = Math.max(16, Math.round(longEdge / 2) * 2);
  if (aspect === '1:1') return { width: long, height: long };
  if (aspect === '16:9') {
    return { width: long, height: evenDimension((long * 9) / 16) };
  }
  return { width: evenDimension((long * 9) / 16), height: long };
}

export function clampDuration(seconds: number, allowed: readonly number[]): number {
  if (allowed.length === 0) throw new DomainError('config', 'El proveedor no declara duraciones.');
  if (!Number.isFinite(seconds)) return allowed[0] ?? 2;
  let best = allowed[0] ?? 2;
  let bestDist = Math.abs(seconds - best);
  for (const candidate of allowed) {
    const dist = Math.abs(seconds - candidate);
    if (dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
}

export function seedFrom(operationId: string, variation: number): number {
  let hash = 2166136261;
  const source = `${operationId}:${variation}`;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function assetRelativePath(projectId: string, asset: { id: string; kind: string; ext: string }): string {
  if (asset.kind === 'original') return `projects/${projectId}/original.${asset.ext}`;
  return `projects/${projectId}/v/${asset.id}.${asset.ext}`;
}

export function containRect(
  containerW: number,
  containerH: number,
  imageW: number,
  imageH: number,
): { x: number; y: number; w: number; h: number } {
  if (containerW <= 0 || containerH <= 0 || imageW <= 0 || imageH <= 0) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  const scale = Math.min(containerW / imageW, containerH / imageH);
  const w = imageW * scale;
  const h = imageH * scale;
  return { x: (containerW - w) / 2, y: (containerH - h) / 2, w, h };
}

export function pointToNormalized(
  touchX: number,
  touchY: number,
  rect: { x: number; y: number; w: number; h: number },
): { x: number; y: number } | null {
  if (rect.w <= 0 || rect.h <= 0) return null;
  const x = (touchX - rect.x) / rect.w;
  const y = (touchY - rect.y) / rect.h;
  if (x < 0 || y < 0 || x > 1 || y > 1) return null;
  return { x, y };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
