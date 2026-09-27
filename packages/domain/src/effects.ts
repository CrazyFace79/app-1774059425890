import type { RGB } from './types';

export type Effect =
  | { type: 'tint'; color: RGB; strength: number }
  | { type: 'desaturate'; amount: number }
  | { type: 'smooth'; amount: number }
  | { type: 'sharpen'; amount: number }
  | { type: 'displace'; amplitude: number; frequency: number; axis: 'x' | 'y' | 'both' }
  | { type: 'shift'; dx: number; dy: number }
  | { type: 'radial'; cx: number; cy: number; kx: number; ky: number }
  | { type: 'strands'; color: RGB; density: number }
  | { type: 'speckle'; color: RGB; amount: number }
  | { type: 'fill'; color: RGB; strength: number }
  | { type: 'lighting'; brightness: number; contrast: number }
  | { type: 'white-balance'; strength: number }
  | { type: 'grade'; contrast: number; saturation: number; temperature: number }
  | { type: 'posterize'; levels: number }
  | { type: 'vignette'; strength: number }
  | { type: 'box-blur'; radius: number }
  | { type: 'stripes'; color: RGB; strength: number }
  | { type: 'gradient'; from: RGB; to: RGB; noise: number }
  | { type: 'inpaint' }
  | {
      type: 'overlay';
      shape: 'glasses' | 'sunglasses' | 'earrings' | 'chain' | 'cap' | 'hat';
      color: RGB;
    };

function clampByte(value: number): number {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return Math.round(value);
}

function hash01(x: number, y: number, seed: number): number {
  let hash = (seed ^ Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177) >>> 0;
  return hash / 4294967295;
}

function sample(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): [number, number, number, number] {
  const cx = Math.max(0, Math.min(width - 1, x));
  const cy = Math.max(0, Math.min(height - 1, y));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const dx = cx - x0;
  const dy = cy - y0;
  const read = (px: number, py: number) => {
    const o = (py * width + px) * 4;
    return [src[o] ?? 0, src[o + 1] ?? 0, src[o + 2] ?? 0, src[o + 3] ?? 255] as [number, number, number, number];
  };
  const a = read(x0, y0);
  const b = read(x1, y0);
  const c = read(x0, y1);
  const d = read(x1, y1);
  return [0, 1, 2, 3].map((channel) => {
    const top = (a[channel] ?? 0) * (1 - dx) + (b[channel] ?? 0) * dx;
    const bottom = (c[channel] ?? 0) * (1 - dx) + (d[channel] ?? 0) * dx;
    return top * (1 - dy) + bottom * dy;
  }) as [number, number, number, number];
}

function copy(src: Uint8ClampedArray): Uint8ClampedArray {
  return new Uint8ClampedArray(src);
}

export function boxBlurRgba(src: Uint8ClampedArray, width: number, height: number, radius: number): Uint8ClampedArray {
  if (radius <= 0) return copy(src);
  const r = Math.min(16, Math.max(1, Math.round(radius)));
  const tmp = new Uint8ClampedArray(src.length);
  const dst = new Uint8ClampedArray(src.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let count = 0;
      for (let k = -r; k <= r; k += 1) {
        const xx = x + k;
        if (xx < 0 || xx >= width) continue;
        const o = (y * width + xx) * 4;
        rSum += src[o] ?? 0;
        gSum += src[o + 1] ?? 0;
        bSum += src[o + 2] ?? 0;
        count += 1;
      }
      const o = (y * width + x) * 4;
      tmp[o] = rSum / count;
      tmp[o + 1] = gSum / count;
      tmp[o + 2] = bSum / count;
      tmp[o + 3] = src[o + 3] ?? 255;
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let count = 0;
      for (let k = -r; k <= r; k += 1) {
        const yy = y + k;
        if (yy < 0 || yy >= height) continue;
        const o = (yy * width + x) * 4;
        rSum += tmp[o] ?? 0;
        gSum += tmp[o + 1] ?? 0;
        bSum += tmp[o + 2] ?? 0;
        count += 1;
      }
      const o = (y * width + x) * 4;
      dst[o] = rSum / count;
      dst[o + 1] = gSum / count;
      dst[o + 2] = bSum / count;
      dst[o + 3] = src[o + 3] ?? 255;
    }
  }
  return dst;
}

function stamp(
  buf: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: RGB,
  alpha: number,
  filled: boolean,
) {
  const x0 = Math.max(0, Math.floor(cx - rx - 2));
  const x1 = Math.min(width - 1, Math.ceil(cx + rx + 2));
  const y0 = Math.max(0, Math.floor(cy - ry - 2));
  const y1 = Math.min(height - 1, Math.ceil(cy + ry + 2));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = dx * dx + dy * dy;
      const hit = filled ? d <= 1 : d <= 1 && d >= 0.72;
      if (!hit) continue;
      const o = (y * width + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        buf[o + c] = clampByte((buf[o + c] ?? 0) * (1 - alpha) + (color[c] ?? 0) * alpha);
      }
    }
  }
}

function drawOverlay(src: Uint8ClampedArray, width: number, height: number, shape: Extract<Effect, { type: 'overlay' }>['shape'], color: RGB) {
  const buf = copy(src);
  const px = (nx: number, ny: number) => ({ x: nx * width, y: ny * height });
  if (shape === 'glasses' || shape === 'sunglasses') {
    const left = px(0.4, 0.385);
    const right = px(0.6, 0.385);
    const rx = width * 0.075;
    const ry = height * 0.035;
    stamp(buf, width, height, left.x, left.y, rx, ry, shape === 'sunglasses' ? [18, 18, 22] : color, shape === 'sunglasses' ? 0.78 : 0.9, shape === 'sunglasses');
    stamp(buf, width, height, right.x, right.y, rx, ry, shape === 'sunglasses' ? [18, 18, 22] : color, shape === 'sunglasses' ? 0.78 : 0.9, shape === 'sunglasses');
    if (shape === 'glasses') {
      stamp(buf, width, height, left.x, left.y, rx, ry, color, 0.95, false);
      stamp(buf, width, height, right.x, right.y, rx, ry, color, 0.95, false);
    }
    const bridgeY = left.y;
    for (let x = Math.round(left.x + rx * 0.7); x < right.x - rx * 0.7; x += 1) {
      stamp(buf, width, height, x, bridgeY, 1.4, 1.4, color, 0.95, true);
    }
  } else if (shape === 'earrings') {
    stamp(buf, width, height, width * 0.3, height * 0.5, width * 0.018, width * 0.018, color, 0.95, true);
    stamp(buf, width, height, width * 0.7, height * 0.5, width * 0.018, width * 0.018, color, 0.95, true);
  } else if (shape === 'chain') {
    for (let x = Math.round(width * 0.32); x < width * 0.68; x += 3) {
      const y = height * 0.68 + Math.sin(x * 0.08) * 3;
      stamp(buf, width, height, x, y, 2.2, 2.2, color, 0.9, true);
    }
  } else if (shape === 'cap') {
    stamp(buf, width, height, width * 0.5, height * 0.16, width * 0.26, height * 0.1, color, 0.92, true);
    stamp(buf, width, height, width * 0.5, height * 0.24, width * 0.34, height * 0.028, color, 0.92, true);
  } else {
    stamp(buf, width, height, width * 0.5, height * 0.12, width * 0.22, height * 0.11, color, 0.92, true);
    stamp(buf, width, height, width * 0.5, height * 0.22, width * 0.36, height * 0.03, color, 0.92, true);
  }
  return buf;
}

export function renderEffect(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  mask: Uint8Array,
  effect: Effect,
  seed: number,
): Uint8ClampedArray {
  if (effect.type === 'box-blur') return boxBlurRgba(src, width, height, effect.radius);
  if (effect.type === 'smooth') return boxBlurRgba(src, width, height, 1 + effect.amount * 4);
  if (effect.type === 'inpaint') return inpaint(src, width, height, mask);
  if (effect.type === 'overlay') return drawOverlay(src, width, height, effect.shape, effect.color);

  const out = copy(src);
  if (effect.type === 'sharpen') {
    const blurred = boxBlurRgba(src, width, height, 1);
    for (let i = 0; i < width * height; i += 1) {
      const o = i * 4;
      for (let c = 0; c < 3; c += 1) {
        const base = src[o + c] ?? 0;
        const soft = blurred[o + c] ?? 0;
        out[o + c] = clampByte(base + effect.amount * (base - soft));
      }
    }
    return out;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const o = i * 4;
      if (effect.type === 'displace' || effect.type === 'shift' || effect.type === 'radial') {
        const dx =
          effect.type === 'radial'
            ? (x - effect.cx) * effect.kx
            : effect.type === 'shift'
              ? effect.dx
              : effect.axis === 'y'
                ? 0
                : Math.sin((y / height) * effect.frequency * Math.PI * 2 + seed) * effect.amplitude;
        const dy =
          effect.type === 'radial'
            ? (y - effect.cy) * effect.ky
            : effect.type === 'shift'
              ? effect.dy
              : effect.axis === 'x'
                ? 0
                : Math.cos((x / width) * effect.frequency * Math.PI * 2 + seed) * effect.amplitude;
        const pixel = sample(src, width, height, x - dx, y - dy);
        out[o] = pixel[0];
        out[o + 1] = pixel[1];
        out[o + 2] = pixel[2];
        out[o + 3] = pixel[3];
        continue;
      }
      let r = src[o] ?? 0;
      let g = src[o + 1] ?? 0;
      let b = src[o + 2] ?? 0;
      if (effect.type === 'tint' || effect.type === 'fill') {
        const strength = effect.type === 'fill' ? effect.strength : effect.strength;
        r = r * (1 - strength) + effect.color[0] * strength;
        g = g * (1 - strength) + effect.color[1] * strength;
        b = b * (1 - strength) + effect.color[2] * strength;
      } else if (effect.type === 'desaturate') {
        const gray = r * 0.299 + g * 0.587 + b * 0.114;
        r = r * (1 - effect.amount) + gray * effect.amount;
        g = g * (1 - effect.amount) + gray * effect.amount;
        b = b * (1 - effect.amount) + gray * effect.amount;
      } else if (effect.type === 'strands') {
        const wave = Math.sin(x * 0.85 + y * 0.12 + seed);
        if (wave > 0.15 && hash01(x, y, seed) < effect.density) {
          r = r * 0.35 + effect.color[0] * 0.65;
          g = g * 0.35 + effect.color[1] * 0.65;
          b = b * 0.35 + effect.color[2] * 0.65;
        }
      } else if (effect.type === 'speckle') {
        if (hash01(x, y, seed) < effect.amount) {
          r = r * 0.45 + effect.color[0] * 0.55;
          g = g * 0.45 + effect.color[1] * 0.55;
          b = b * 0.45 + effect.color[2] * 0.55;
        }
      } else if (effect.type === 'lighting') {
        const contrast = 1 + effect.contrast;
        r = (r - 128) * contrast + 128 + effect.brightness * 255;
        g = (g - 128) * contrast + 128 + effect.brightness * 255;
        b = (b - 128) * contrast + 128 + effect.brightness * 255;
      } else if (effect.type === 'grade') {
        const contrast = 1 + effect.contrast;
        const avg = (r + g + b) / 3;
        r = (r - avg) * (1 + effect.saturation) + avg;
        g = (g - avg) * (1 + effect.saturation) + avg;
        b = (b - avg) * (1 + effect.saturation) + avg;
        r = (r - 128) * contrast + 128 + effect.temperature * 28;
        g = (g - 128) * contrast + 128;
        b = (b - 128) * contrast + 128 - effect.temperature * 28;
      } else if (effect.type === 'white-balance') {
        r *= 1 + effect.strength * 0.08;
        b *= 1 - effect.strength * 0.06;
      } else if (effect.type === 'posterize') {
        const levels = Math.max(2, Math.round(effect.levels));
        const step = 255 / (levels - 1);
        r = Math.round(r / step) * step;
        g = Math.round(g / step) * step;
        b = Math.round(b / step) * step;
      } else if (effect.type === 'vignette') {
        const dx = x / width - 0.5;
        const dy = y / height - 0.5;
        const v = Math.max(0, 1 - (dx * dx + dy * dy) * 2.4 * effect.strength);
        r *= v;
        g *= v;
        b *= v;
      } else if (effect.type === 'stripes') {
        if (Math.floor(y / 6) % 2 === 0) {
          r = r * (1 - effect.strength) + effect.color[0] * effect.strength;
          g = g * (1 - effect.strength) + effect.color[1] * effect.strength;
          b = b * (1 - effect.strength) + effect.color[2] * effect.strength;
        }
      } else if (effect.type === 'gradient') {
        const t = y / Math.max(1, height - 1);
        const noise = (hash01(x, y, seed) - 0.5) * effect.noise * 255;
        r = effect.from[0] * (1 - t) + effect.to[0] * t + noise;
        g = effect.from[1] * (1 - t) + effect.to[1] * t + noise;
        b = effect.from[2] * (1 - t) + effect.to[2] * t + noise;
      }
      out[o] = clampByte(r);
      out[o + 1] = clampByte(g);
      out[o + 2] = clampByte(b);
      out[o + 3] = src[o + 3] ?? 255;
    }
  }
  return out;
}

function inpaint(src: Uint8ClampedArray, width: number, height: number, mask: Uint8Array): Uint8ClampedArray {
  const out = copy(src);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if ((mask[index] ?? 0) < 128) continue;
      let found = false;
      for (let radius = 1; radius <= 28 && !found; radius += 1) {
        for (let dy = -radius; dy <= radius && !found; dy += 1) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
            const sampleIndex = yy * width + xx;
            if ((mask[sampleIndex] ?? 0) > 16) continue;
            const so = sampleIndex * 4;
            const o = index * 4;
            out[o] = src[so] ?? 0;
            out[o + 1] = src[so + 1] ?? 0;
            out[o + 2] = src[so + 2] ?? 0;
            found = true;
            break;
          }
        }
      }
    }
  }
  return boxBlurRgba(out, width, height, 1);
}

export function compositeMasked(
  base: Uint8ClampedArray,
  effect: Uint8ClampedArray,
  mask: Uint8Array,
  knockout = false,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(base);
  for (let i = 0; i < mask.length; i += 1) {
    const amount = (mask[i] ?? 0) / 255;
    if (amount <= 0) continue;
    const o = i * 4;
    if (knockout) {
      out[o + 3] = clampByte((base[o + 3] ?? 255) * (1 - amount));
      continue;
    }
    for (let c = 0; c < 3; c += 1) {
      out[o + c] = clampByte((base[o + c] ?? 0) * (1 - amount) + (effect[o + c] ?? 0) * amount);
    }
    out[o + 3] = base[o + 3] ?? 255;
  }
  return out;
}

export type EffectPass = {
  mask: Uint8Array;
  effects: Effect[];
  knockout?: boolean;
};

export function applyPasses(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  passes: EffectPass[],
  seed: number,
): Uint8ClampedArray {
  let current = src;
  for (const pass of passes) {
    let effectBuffer = current;
    for (const effect of pass.effects) {
      effectBuffer = renderEffect(effectBuffer, width, height, pass.mask, effect, seed);
    }
    current = compositeMasked(current, effectBuffer, pass.mask, pass.knockout === true);
  }
  return current;
}
