import type { MaskZone, Stroke } from './types';

type Norm = (nx: number, ny: number) => boolean;

function ellipse(cx: number, cy: number, rx: number, ry: number): Norm {
  return (nx, ny) => {
    const dx = (nx - cx) / rx;
    const dy = (ny - cy) / ry;
    return dx * dx + dy * dy <= 1;
  };
}

function rect(x0: number, y0: number, x1: number, y1: number): Norm {
  return (nx, ny) => nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1;
}

function union(parts: Norm[]): Norm {
  return (nx, ny) => parts.some((part) => part(nx, ny));
}

const hairShape = ellipse(0.5, 0.2, 0.3, 0.18);
const faceShape = ellipse(0.5, 0.4, 0.23, 0.22);
const eyebrowShape = union([
  ellipse(0.4, 0.345, 0.07, 0.018),
  ellipse(0.6, 0.345, 0.07, 0.018),
]);
const eyeShape = union([
  ellipse(0.4, 0.385, 0.055, 0.03),
  ellipse(0.6, 0.385, 0.055, 0.03),
]);
const noseShape = ellipse(0.5, 0.45, 0.045, 0.07);
const mouthShape = ellipse(0.5, 0.53, 0.07, 0.028);
const mustacheShape = ellipse(0.5, 0.505, 0.09, 0.022);
const beardShape = ellipse(0.5, 0.58, 0.2, 0.12);
const clothingShape = rect(0.18, 0.64, 0.82, 0.98);
const handShape = union([
  ellipse(0.16, 0.8, 0.08, 0.06),
  ellipse(0.84, 0.8, 0.08, 0.06),
]);
const jawShape = ellipse(0.5, 0.6, 0.2, 0.09);
const cheekShape = union([
  ellipse(0.36, 0.46, 0.07, 0.05),
  ellipse(0.64, 0.46, 0.07, 0.05),
]);
const glassesShape = ellipse(0.5, 0.385, 0.24, 0.07);
const earringShape = union([
  ellipse(0.3, 0.5, 0.025, 0.03),
  ellipse(0.7, 0.5, 0.025, 0.03),
]);
const chainShape = rect(0.32, 0.64, 0.68, 0.74);
const hatShape = union([ellipse(0.5, 0.14, 0.28, 0.12), ellipse(0.5, 0.24, 0.36, 0.035)]);

const geometricPerson = union([hairShape, faceShape, clothingShape, handShape]);

export type PersonEstimate = {
  person: Uint8Array;
  background: Uint8Array;
  confidence: number;
  source: 'flood' | 'geometric';
};

export function paintPredicate(width: number, height: number, pred: Norm): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const ny = (y + 0.5) / height;
    for (let x = 0; x < width; x += 1) {
      if (pred((x + 0.5) / width, ny)) mask[y * width + x] = 255;
    }
  }
  return mask;
}

export function fullMask(width: number, height: number, value = 255): Uint8Array {
  return new Uint8Array(width * height).fill(value);
}

export function invertMask(mask: Uint8Array): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) out[i] = 255 - (mask[i] ?? 0);
  return out;
}

export function andMask(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i += 1) out[i] = Math.min(a[i] ?? 0, b[i] ?? 0);
  return out;
}

export function subtractMask(source: Uint8Array, protectedZone: Uint8Array): Uint8Array {
  const out = new Uint8Array(source.length);
  for (let i = 0; i < source.length; i += 1) {
    out[i] = (protectedZone[i] ?? 0) > 16 ? 0 : (source[i] ?? 0);
  }
  return out;
}

export function unionMasks(masks: Uint8Array[]): Uint8Array {
  if (masks.length === 0) return new Uint8Array();
  const out = new Uint8Array(masks[0]?.length ?? 0);
  for (const mask of masks) {
    for (let i = 0; i < out.length; i += 1) out[i] = Math.max(out[i] ?? 0, mask[i] ?? 0);
  }
  return out;
}

export function scaleMask(mask: Uint8Array, factor: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) {
    out[i] = Math.max(0, Math.min(255, Math.round((mask[i] ?? 0) * factor)));
  }
  return out;
}

export function maskCoverage(mask: Uint8Array): number {
  if (mask.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < mask.length; i += 1) sum += mask[i] ?? 0;
  return sum / (mask.length * 255);
}

export function blurChannel(src: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) return src;
  const r = Math.min(24, Math.max(1, Math.round(radius)));
  const horizontal = new Uint8Array(src.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let k = -r; k <= r; k += 1) {
        const xx = x + k;
        if (xx < 0 || xx >= width) continue;
        sum += src[y * width + xx] ?? 0;
        count += 1;
      }
      horizontal[y * width + x] = Math.round(sum / count);
    }
  }
  const vertical = new Uint8Array(src.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let k = -r; k <= r; k += 1) {
        const yy = y + k;
        if (yy < 0 || yy >= height) continue;
        sum += horizontal[yy * width + x] ?? 0;
        count += 1;
      }
      vertical[y * width + x] = Math.round(sum / count);
    }
  }
  return vertical;
}

function extremumFilter(
  src: Uint8Array,
  width: number,
  height: number,
  radius: number,
  mode: 'min' | 'max',
): Uint8Array {
  const r = Math.max(1, Math.round(radius));
  const horizontal = new Uint8Array(src.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = mode === 'max' ? 0 : 255;
      for (let k = -r; k <= r; k += 1) {
        const xx = x + k;
        if (xx < 0 || xx >= width) continue;
        const sample = src[y * width + xx] ?? 0;
        value = mode === 'max' ? Math.max(value, sample) : Math.min(value, sample);
      }
      horizontal[y * width + x] = value;
    }
  }
  const vertical = new Uint8Array(src.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = mode === 'max' ? 0 : 255;
      for (let k = -r; k <= r; k += 1) {
        const yy = y + k;
        if (yy < 0 || yy >= height) continue;
        const sample = horizontal[yy * width + x] ?? 0;
        value = mode === 'max' ? Math.max(value, sample) : Math.min(value, sample);
      }
      vertical[y * width + x] = value;
    }
  }
  return vertical;
}

export function dilate(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) return mask;
  return extremumFilter(mask, width, height, radius, 'max');
}

export function erode(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) return mask;
  return extremumFilter(mask, width, height, radius, 'min');
}

export function estimatePerson(rgba: Uint8ClampedArray, width: number, height: number): PersonEstimate {
  const geometric = paintPredicate(width, height, geometricPerson);
  const background = floodBackground(rgba, width, height);
  let backgroundPixels = 0;
  for (let i = 0; i < background.length; i += 1) if ((background[i] ?? 0) > 0) backgroundPixels += 1;
  const ratio = backgroundPixels / background.length;
  const center = background[(Math.floor(height / 2) * width) + Math.floor(width / 2)] ?? 0;
  const confident = center === 0 && ratio > 0.08 && ratio < 0.82;
  if (!confident) {
    return {
      person: geometric,
      background: invertMask(geometric),
      confidence: 0.32,
      source: 'geometric',
    };
  }
  return {
    person: invertMask(background),
    background,
    confidence: 0.8,
    source: 'flood',
  };
}

function floodBackground(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  const seen = new Uint8Array(width * height);
  const seeds = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  const cornerColors = seeds.map(([x, y]) => {
    const o = ((y ?? 0) * width + (x ?? 0)) * 4;
    return [rgba[o] ?? 0, rgba[o + 1] ?? 0, rgba[o + 2] ?? 0] as const;
  });
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  for (const [x, y] of seeds) {
    const index = (y ?? 0) * width + (x ?? 0);
    if (seen[index]) continue;
    seen[index] = 1;
    queue[tail] = index;
    tail += 1;
  }
  const threshold = 48;
  while (head < tail) {
    const index = queue[head] ?? 0;
    head += 1;
    const o = index * 4;
    const r = rgba[o] ?? 0;
    const g = rgba[o + 1] ?? 0;
    const b = rgba[o + 2] ?? 0;
    let nearCorner = false;
    for (const [cr, cg, cb] of cornerColors) {
      if (Math.max(Math.abs(r - cr), Math.abs(g - cg), Math.abs(b - cb)) <= threshold) {
        nearCorner = true;
        break;
      }
    }
    if (!nearCorner) continue;
    mask[index] = 255;
    const x = index % width;
    const y = (index - x) / width;
    const neighbors = [
      x > 0 ? index - 1 : -1,
      x + 1 < width ? index + 1 : -1,
      y > 0 ? index - width : -1,
      y + 1 < height ? index + width : -1,
    ];
    for (const next of neighbors) {
      if (next < 0 || seen[next]) continue;
      seen[next] = 1;
      queue[tail] = next;
      tail += 1;
    }
  }
  return mask;
}

const ZONE_SHAPES: Record<MaskZone, Norm> = {
  hair: (nx, ny) =>
    hairShape(nx, ny) &&
    !eyeShape(nx, ny) &&
    !eyebrowShape(nx, ny) &&
    !mouthShape(nx, ny) &&
    !mustacheShape(nx, ny) &&
    !beardShape(nx, ny),
  beard: (nx, ny) => beardShape(nx, ny) && !mustacheShape(nx, ny) && !mouthShape(nx, ny) && !clothingShape(nx, ny),
  mustache: (nx, ny) => mustacheShape(nx, ny) && !mouthShape(nx, ny),
  eyebrows: eyebrowShape,
  eyes: eyeShape,
  nose: noseShape,
  mouth: mouthShape,
  skin: (nx, ny) =>
    faceShape(nx, ny) &&
    !hairShape(nx, ny) &&
    !eyeShape(nx, ny) &&
    !noseShape(nx, ny) &&
    !mouthShape(nx, ny),
  face: faceShape,
  clothing: clothingShape,
  background: (nx, ny) => !geometricPerson(nx, ny),
  hands: handShape,
};

export function zoneMask(zone: MaskZone, width: number, height: number, person?: PersonEstimate): Uint8Array {
  if (zone === 'background' && person?.source === 'flood') return person.background;
  const painted = paintPredicate(width, height, ZONE_SHAPES[zone]);
  if (!person || person.source !== 'flood' || zone === 'background' || zone === 'hands') return painted;
  return andMask(painted, person.person);
}

export type DerivedZone = 'jaw' | 'cheeks' | 'glasses' | 'earrings' | 'chain' | 'hat' | 'person' | 'full';

export function derivedMask(zone: DerivedZone, width: number, height: number, person?: PersonEstimate): Uint8Array {
  if (zone === 'full') return fullMask(width, height);
  if (zone === 'person') return person?.person ?? paintPredicate(width, height, geometricPerson);
  const shape = zone === 'jaw' ? jawShape : zone === 'cheeks' ? cheekShape : zone === 'glasses' ? glassesShape : zone === 'earrings' ? earringShape : zone === 'chain' ? chainShape : hatShape;
  const painted = paintPredicate(width, height, shape);
  if (person?.source === 'flood' && zone !== 'hat') return andMask(painted, person.person);
  return painted;
}

export function splitVerticalStrip(
  mask: Uint8Array,
  width: number,
  height: number,
  halfWidthRatio: number,
): { center: Uint8Array; sides: Uint8Array } {
  let minX = width;
  let maxX = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((mask[y * width + x] ?? 0) > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  const center = new Uint8Array(mask.length);
  const sides = new Uint8Array(mask.length);
  if (maxX < minX) return { center, sides };
  const cx = (minX + maxX) / 2;
  const half = Math.max(1, (maxX - minX) * halfWidthRatio);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = mask[y * width + x] ?? 0;
      if (value === 0) continue;
      if (Math.abs(x - cx) <= half) center[y * width + x] = value;
      else sides[y * width + x] = value;
    }
  }
  return { center, sides };
}

export function adjustHairLength(mask: Uint8Array, width: number, height: number, length: number): Uint8Array {
  if (length < 0.45) {
    const radius = Math.max(1, Math.round((0.45 - length) * Math.min(width, height) * 0.08));
    return erode(mask, width, height, radius);
  }
  if (length > 0.58) {
    const radius = Math.max(1, Math.round((length - 0.58) * Math.min(width, height) * 0.1));
    const grown = dilate(mask, width, height, radius);
    const limit = paintPredicate(width, height, (_nx, ny) => ny < 0.48);
    const extended = andMask(grown, unionMasks([mask, limit]));
    return extended;
  }
  return mask;
}

export function adjustHairline(mask: Uint8Array, width: number, height: number, hairline: number): Uint8Array {
  const delta = hairline - 0.5;
  if (Math.abs(delta) < 0.08) return mask;
  let minY = height;
  for (let i = 0; i < mask.length; i += 1) {
    if ((mask[i] ?? 0) > 16) minY = Math.min(minY, Math.floor(i / width));
  }
  if (minY === height) return mask;
  if (delta < 0) {
    const cut = Math.round(-delta * height * 0.18);
    const out = new Uint8Array(mask);
    for (let y = minY; y < Math.min(height, minY + cut); y += 1) {
      out.fill(0, y * width, (y + 1) * width);
    }
    return out;
  }
  const radius = Math.max(1, Math.round(delta * height * 0.08));
  const grown = dilate(mask, width, height, radius);
  const out = new Uint8Array(mask);
  for (let y = 0; y < height; y += 1) {
    if (y > minY + radius) continue;
    for (let x = 0; x < width; x += 1) out[y * width + x] = grown[y * width + x] ?? 0;
  }
  return out;
}

function interpolate(points: { x: number; y: number }[], width: number, height: number, step: number): { x: number; y: number }[] {
  if (points.length === 0) return [];
  const out: { x: number; y: number }[] = [];
  const first = points[0];
  if (!first) return out;
  out.push({ x: first.x * width, y: first.y * height });
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const next = points[i];
    if (!prev || !next) continue;
    const x0 = prev.x * width;
    const y0 = prev.y * height;
    const x1 = next.x * width;
    const y1 = next.y * height;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / Math.max(1, step)));
    for (let s = 1; s <= steps; s += 1) {
      const t = s / steps;
      out.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t });
    }
  }
  return out;
}

function stampCircle(mask: Uint8Array, width: number, height: number, cx: number, cy: number, radius: number, mode: 'brush' | 'erase') {
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(width - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(height - 1, Math.ceil(cy + radius));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r2) continue;
      mask[y * width + x] = mode === 'brush' ? 255 : 0;
    }
  }
}

export function rasterizeStrokes(
  width: number,
  height: number,
  strokes: Stroke[],
  options?: { invert?: boolean; feather?: number },
): Uint8Array {
  const mask = new Uint8Array(width * height);
  const minDim = Math.min(width, height);
  for (const stroke of strokes) {
    const radius = Math.max(1, stroke.size * minDim);
    const points = interpolate(stroke.points, width, height, radius * 0.35);
    for (const point of points) stampCircle(mask, width, height, point.x, point.y, radius, stroke.mode);
  }
  let out = options?.feather && options.feather > 0 ? blurChannel(mask, width, height, options.feather) : mask;
  if (options?.invert) out = invertMask(out);
  return out;
}

export function sampleSkinColor(rgba: Uint8ClampedArray, width: number, height: number, face: Uint8Array): [number, number, number] {
  const samples: [number, number, number][] = [];
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 4000)));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = y * width + x;
      if ((face[index] ?? 0) < 128) continue;
      const o = index * 4;
      samples.push([rgba[o] ?? 0, rgba[o + 1] ?? 0, rgba[o + 2] ?? 0]);
    }
  }
  if (samples.length === 0) return [210, 170, 150];
  const mid = Math.floor(samples.length / 2);
  const by = (channel: 0 | 1 | 2) => samples.map((sample) => sample[channel]).sort((a, b) => a - b)[mid] ?? 0;
  return [by(0), by(1), by(2)];
}

export function protectMask(mask: Uint8Array, zones: Uint8Array[]): Uint8Array {
  let out = mask;
  for (const zone of zones) out = subtractMask(out, zone);
  return out;
}
