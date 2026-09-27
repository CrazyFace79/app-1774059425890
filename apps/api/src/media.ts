import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { detectImageType, evenDimension, MAX_WORKING_EDGE, validateImageMeta, type ImageType } from '@lookstudio/domain';
import { AppError } from './errors';

sharp.cache(false);

export function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export async function decodeWorking(buf: Buffer, maxEdge = MAX_WORKING_EDGE): Promise<{
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  type: ImageType;
}> {
  const type = detectImageType(buf);
  const probe = sharp(buf, { failOn: 'error', limitInputPixels: 40_000_000, animated: false }).rotate();
  const meta = await probe.metadata();
  const validation = validateImageMeta({
    bytes: buf.length,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    type,
  });
  if (!validation.ok || !type || !meta.width || !meta.height) {
    throw new AppError(400, 'invalid_image', validation.ok ? 'No se pudo leer la imagen.' : validation.errors.join(' '));
  }
  const scale = Math.min(1, maxEdge / Math.max(meta.width, meta.height));
  const width = evenDimension(meta.width * scale);
  const height = evenDimension(meta.height * scale);
  const raw = await sharp(buf, { failOn: 'error', limitInputPixels: 40_000_000, animated: false })
    .rotate()
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer();
  return { rgba: new Uint8ClampedArray(raw), width, height, type };
}

export async function encodePng(rgba: Uint8ClampedArray, width: number, height: number, description?: string): Promise<Buffer> {
  let pipeline = sharp(Buffer.from(rgba), { raw: { width, height, channels: 4 } });
  if (description) {
    pipeline = pipeline.withMetadata({
      exif: { IFD0: { ImageDescription: description, Software: 'AI Look Studio' } },
    });
  }
  const png = await pipeline.png().toBuffer();
  const entries: Record<string, string> = { Software: 'AI Look Studio' };
  if (description) entries.Description = description;
  return embedPngText(png, entries);
}

export async function encodeOverlay(mask: Uint8Array, width: number, height: number): Promise<Buffer> {
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < mask.length; i += 1) {
    const alpha = Math.round((mask[i] ?? 0) * 0.55);
    rgba[i * 4] = 214;
    rgba[i * 4 + 1] = 255;
    rgba[i * 4 + 2] = 74;
    rgba[i * 4 + 3] = alpha;
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

export async function stampDisclosure(png: Buffer, visible: boolean): Promise<Buffer> {
  const described = await sharp(png)
    .withMetadata({ exif: { IFD0: { ImageDescription: 'AI Look Studio modified image', Software: 'AI Look Studio' } } })
    .png()
    .toBuffer();
  if (!visible) return described;
  const meta = await sharp(described).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) return described;
  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="12" y="${Math.max(12, height - 52)}" width="250" height="34" rx="8" fill="rgba(0,0,0,0.72)"/><text x="24" y="${Math.max(34, height - 30)}" fill="#D6FF4A" font-size="16" font-family="DejaVu Sans, sans-serif">MODIFICADO CON IA</text></svg>`,
  );
  try {
    const marked = await sharp(described).composite([{ input: svg, top: 0, left: 0 }]).png().toBuffer();
    return embedPngText(marked, { Software: 'AI Look Studio', Description: 'MODIFICADO CON IA' });
  } catch {
    const raw = await sharp(described).ensureAlpha().raw().toBuffer();
    const barW = Math.min(width, 160);
    const barH = Math.min(height, 28);
    for (let y = height - barH; y < height; y += 1) {
      for (let x = 0; x < barW; x += 1) {
        const o = (y * width + x) * 4;
        raw[o] = 214;
        raw[o + 1] = 255;
        raw[o + 2] = 74;
        raw[o + 3] = 255;
      }
    }
    const marked = await sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer();
    return embedPngText(marked, { Software: 'AI Look Studio', Description: 'MODIFICADO CON IA' });
  }
}

export function embedPngText(png: Buffer, entries: Record<string, string>): Buffer {
  if (detectImageType(png) !== 'png') return png;
  let output = png;
  for (const [key, value] of Object.entries(entries)) {
    output = insertBeforeIend(output, pngTextChunk(key, value));
  }
  return output;
}

function pngTextChunk(keyword: string, text: string): Buffer {
  const data = Buffer.concat([Buffer.from(keyword), Buffer.from([0]), Buffer.from(text, 'latin1')]);
  const type = Buffer.from('tEXt');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, crc]);
}

function insertBeforeIend(png: Buffer, chunk: Buffer): Buffer {
  const marker = Buffer.from('IEND');
  const index = png.lastIndexOf(marker);
  const start = index - 4;
  return Buffer.concat([png.subarray(0, start), chunk, png.subarray(start)]);
}

function crc32(buf: Buffer): number {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

export function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const errors: Buffer[] = [];
    child.stderr.on('data', (chunk: Buffer) => {
      errors.push(chunk);
      if (errors.length > 20) errors.shift();
    });
    child.on('error', (error) => reject(error));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(Buffer.concat(errors).toString().slice(-1500) || `ffmpeg ${code}`));
    });
  });
}

export async function renderCameraClip(options: {
  input: Buffer;
  presetId: string;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  outputPath: string;
  workDir: string;
  disclosure: string;
}): Promise<void> {
  fs.mkdirSync(options.workDir, { recursive: true });
  const base = await sharp(options.input)
    .rotate()
    .resize(options.width, options.height, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();
  const frames = Math.max(2, options.durationSec * options.fps);
  for (let frame = 0; frame < frames; frame += 1) {
    const t = frame / (frames - 1);
    const motion = cameraMotion(options.presetId, t);
    const cropW = Math.max(2, Math.min(options.width, Math.round(options.width / motion.zoom)));
    const cropH = Math.max(2, Math.min(options.height, Math.round(options.height / motion.zoom)));
    const left = clamp(Math.round((options.width - cropW) / 2 + motion.panX * options.width), 0, options.width - cropW);
    const top = clamp(Math.round((options.height - cropH) / 2 + motion.panY * options.height), 0, options.height - cropH);
    await sharp(base)
      .extract({ left, top, width: cropW, height: cropH })
      .resize(options.width, options.height)
      .png()
      .toFile(path.join(options.workDir, `frame_${String(frame).padStart(4, '0')}.png`));
  }
  await runFfmpeg([
    '-y',
    '-framerate',
    String(options.fps),
    '-i',
    path.join(options.workDir, 'frame_%04d.png'),
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-metadata',
    `comment=${options.disclosure}`,
    options.outputPath,
  ]);
}

function cameraMotion(presetId: string, t: number): { zoom: number; panX: number; panY: number } {
  if (presetId === 'dolly-out') return { zoom: 1.1 - t * 0.1, panX: 0, panY: 0 };
  if (presetId === 'turn' || presetId === 'orbit') return { zoom: 1.06, panX: (t - 0.5) * 0.08, panY: 0 };
  if (presetId === 'walk') return { zoom: 1.04, panX: 0, panY: Math.sin(t * Math.PI * 2) * 0.02 };
  if (presetId === 'natural') return { zoom: 1 + t * 0.04, panX: 0, panY: 0 };
  return { zoom: 1 + t * 0.08, panX: (t - 0.5) * 0.02, panY: 0 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export async function resizePng(png: Buffer, factor: number): Promise<{ buffer: Buffer; width: number; height: number }> {
  const meta = await sharp(png).metadata();
  const width = evenDimension((meta.width ?? 1) * factor);
  const height = evenDimension((meta.height ?? 1) * factor);
  const buffer = await sharp(png).resize(width, height, { kernel: 'lanczos3' }).png().toBuffer();
  return { buffer, width, height };
}
