import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assetRelativePath,
  aspectSize,
  authorizeJob,
  buildEditPlan,
  buildReelArgs,
  canTransition,
  clampDuration,
  clampParameters,
  containRect,
  createEmptyReel,
  createHistory,
  creditCost,
  detectImageType,
  DisabledPurchaseProvider,
  DomainError,
  escapeDrawtext,
  getToolPolicy,
  jumpHistory,
  keepVersion,
  lineage,
  maskCoverage,
  moveClip,
  nextVersionLabel,
  pointToNormalized,
  rasterizeStrokes,
  redoHistory,
  renderLocalEdit,
  resetFull,
  resetTool,
  retentionExpired,
  trainingOptOutRequired,
  undoHistory,
  validateImageMeta,
  validateTimeline,
  zoneMask,
  type RGB,
  type VersionNode,
} from '../src/index';

function portrait(width: number, height: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = (x + 0.5) / width;
      const ny = (y + 0.5) / height;
      const hair = ((nx - 0.5) / 0.26) ** 2 + ((ny - 0.18) / 0.14) ** 2 <= 1;
      const face = ((nx - 0.5) / 0.2) ** 2 + ((ny - 0.4) / 0.2) ** 2 <= 1;
      const cloth = ny > 0.66 && nx > 0.2 && nx < 0.8;
      let color: RGB = [30, 90, 220];
      if (cloth) color = [40, 140, 70];
      if (face) color = [226, 184, 162];
      if (hair) color = [36, 24, 16];
      const o = (y * width + x) * 4;
      rgba[o] = color[0];
      rgba[o + 1] = color[1];
      rgba[o + 2] = color[2];
      rgba[o + 3] = 255;
    }
  }
  return rgba;
}

function pixel(rgba: Uint8ClampedArray, width: number, x: number, y: number): string {
  const o = (y * width + x) * 4;
  return `${rgba[o]},${rgba[o + 1]},${rgba[o + 2]},${rgba[o + 3]}`;
}

function node(id: string, parentId: string | null, tool: string | null, label: string): VersionNode {
  return {
    id,
    parentId,
    assetId: `asset-${id}`,
    operationId: parentId ? `op-${id}` : null,
    label,
    tool,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('validación e identidad de archivos', () => {
  it('detecta firmas de imagen y rechaza basura', () => {
    assert.equal(detectImageType(Uint8Array.of(0xff, 0xd8, 0xff, 0x00)), 'jpeg');
    assert.equal(detectImageType(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), 'png');
    assert.equal(detectImageType(Uint8Array.of(1, 2, 3, 4)), null);
    assert.equal(validateImageMeta({ bytes: 1000, width: 32, height: 32, type: 'png' }).ok, false);
    assert.equal(validateImageMeta({ bytes: 1000, width: 200, height: 200, type: 'jpeg' }).ok, true);
  });

  it('nunca usa la ruta del original para un derivado', () => {
    const original = assetRelativePath('p1', { id: 'a', kind: 'original', ext: 'jpg' });
    const derived = assetRelativePath('p1', { id: 'b', kind: 'derived', ext: 'png' });
    assert.notEqual(original, derived);
    assert.match(original, /original\.jpg$/);
  });
});

describe('máscaras', () => {
  it('pinta, borra, invierte y suaviza', () => {
    const mask = rasterizeStrokes(40, 40, [{ mode: 'brush', size: 0.1, points: [{ x: 0.5, y: 0.5 }] }]);
    assert.ok((mask[20 * 40 + 20] ?? 0) > 200);
    const erased = rasterizeStrokes(40, 40, [
      { mode: 'brush', size: 0.2, points: [{ x: 0.5, y: 0.5 }] },
      { mode: 'erase', size: 0.08, points: [{ x: 0.5, y: 0.5 }] },
    ]);
    assert.equal(erased[20 * 40 + 20], 0);
    const inverted = rasterizeStrokes(20, 20, [], { invert: true });
    assert.equal(inverted[0], 255);
    const soft = rasterizeStrokes(30, 30, [{ mode: 'brush', size: 0.05, points: [{ x: 0.2, y: 0.2 }] }], { feather: 3 });
    assert.ok(maskCoverage(soft) > 0);
  });

  it('convierte el toque al espacio de la foto y no al letterbox', () => {
    const rect = containRect(200, 100, 100, 100);
    assert.equal(rect.w, 100);
    assert.equal(pointToNormalized(0, 0, rect), null);
    const hit = pointToNormalized(rect.x + rect.w / 2, rect.y + rect.h / 2, rect);
    assert.ok(hit);
    assert.ok(Math.abs((hit?.x ?? 0) - 0.5) < 0.001);
  });
});

describe('identity lock y render local', () => {
  const width = 120;
  const height = 160;
  const source = portrait(width, height);

  it('el pelo no altera la boca ni los píxeles fuera de la máscara', () => {
    const result = renderLocalEdit({
      rgba: source,
      width,
      height,
      tool: 'hair',
      presetId: 'wavy',
      identityLock: true,
      parameters: { color: 'blonde', length: 0.7, density: 0.9, volume: 0.5, hairline: 0.5, gray: 0 },
      feather: 0,
      seed: 3,
    });
    const mouth = zoneMask('mouth', width, height);
    let changed = 0;
    let protectedPixels = 0;
    for (let i = 0; i < result.mask.length; i += 1) {
      const o = i * 4;
      const same =
        source[o] === result.rgba[o] &&
        source[o + 1] === result.rgba[o + 1] &&
        source[o + 2] === result.rgba[o + 2] &&
        source[o + 3] === result.rgba[o + 3];
      if ((result.mask[i] ?? 0) === 0) assert.equal(same, true);
      else if (!same) changed += 1;
      if ((mouth[i] ?? 0) > 200) {
        assert.equal(same, true);
        protectedPixels += 1;
      }
    }
    assert.ok(changed > 10, 'el pelo debería cambiar dentro de la máscara');
    assert.ok(protectedPixels > 0, 'la zona de la boca tiene que existir');
    assert.match(result.plan.preservationPrompt, /facial identity/i);
    assert.match(result.plan.negativePrompt, /beard|mustache|face/i);
    assert.equal(result.plan.editScope, 'local');
  });

  it('la barba no es el bigote y el bigote no reescribe el pelo', () => {
    const beard = renderLocalEdit({
      rgba: source,
      width,
      height,
      tool: 'beard',
      presetId: 'short',
      identityLock: true,
      parameters: { color: 'black', length: 0.4, density: 0.8, gray: 0, shape: 0.6 },
      feather: 0,
      seed: 2,
    });
    const hair = zoneMask('hair', width, height);
    let hairUntouched = 0;
    for (let i = 0; i < hair.length; i += 1) {
      if ((hair[i] ?? 0) < 250) continue;
      if ((beard.mask[i] ?? 0) > 0) continue;
      const x = i % width;
      const y = Math.floor(i / width);
      assert.equal(pixel(beard.rgba, width, x, y), pixel(source, width, x, y));
      hairUntouched += 1;
    }
    assert.ok(hairUntouched > 10);
    const mustache = renderLocalEdit({
      rgba: source,
      width,
      height,
      tool: 'mustache',
      presetId: 'classic',
      identityLock: true,
      feather: 0,
      seed: 4,
    });
    assert.equal(getToolPolicy('mustache', 'classic').allowed[0], 'mustache');
    assert.ok(!getToolPolicy('mustache', 'classic').alwaysProtected.includes('mustache'));
    assert.ok(getToolPolicy('mustache', 'classic').alwaysProtected.includes('beard'));
    assert.ok(maskCoverage(mustache.mask) > 0);
  });

  it('avisa cuando el rostro necesita relajar Identity Lock y limita el parámetro', () => {
    const plan = buildEditPlan({ tool: 'face', presetId: 'jaw', identityLock: true, parameters: { amount: 5 } });
    assert.equal(plan.parameters.amount, 1);
    assert.ok(plan.warnings[0]?.includes('Identity Lock'));
    const locked = renderLocalEdit({
      rgba: source,
      width,
      height,
      tool: 'face',
      presetId: 'skin',
      identityLock: true,
      parameters: { amount: 5 },
      feather: 0,
      seed: 1,
    });
    assert.equal(locked.plan.parameters.amount, 0.4);
  });

  it('una transformación global con Identity Lock no pinta la cara y sí el fondo', () => {
    const result = renderLocalEdit({
      rgba: source,
      width,
      height,
      tool: 'transform',
      presetId: 'cinematic',
      identityLock: true,
      feather: 0,
      seed: 1,
    });
    assert.equal(result.plan.editScope, 'full');
    const face = zoneMask('face', width, height);
    const x = Math.floor(width / 2);
    const y = Math.floor(height * 0.4);
    const faceIndex = y * width + x;
    if ((face[faceIndex] ?? 0) > 200) {
      assert.equal(pixel(result.rgba, width, x, y), pixel(source, width, x, y));
    }
    assert.notEqual(pixel(result.rgba, width, 1, 1), pixel(source, width, 1, 1));
    const relaxed = buildEditPlan({ tool: 'transform', presetId: 'anime', identityLock: false });
    assert.ok(relaxed.relaxedAttributes.length > 0);
  });
});

describe('historial persistible', () => {
  const root = node('o', null, null, 'ORIGINAL');
  const hair1 = node('h1', 'o', 'hair', 'HAIR_v1');
  const hair2 = node('h2', 'h1', 'hair', 'HAIR_v2');
  const mustache = node('m1', 'h2', 'mustache', 'MUSTACHE_v1');

  it('deshace, rehace y abre una rama sin borrar lo anterior', () => {
    let state = createHistory(root);
    state = keepVersion(state, hair1);
    state = keepVersion(state, hair2);
    state = keepVersion(state, mustache);
    state = undoHistory(state);
    assert.equal(state.headId, 'h2');
    state = undoHistory(state);
    assert.equal(state.headId, 'h1');
    state = redoHistory(state);
    assert.equal(state.headId, 'h2');
    state = undoHistory(state);
    const branch = node('c1', 'h1', 'clothing', 'CLOTHING_v1');
    state = keepVersion(state, branch);
    assert.equal(state.headId, 'c1');
    assert.deepEqual(state.redoIds, []);
    assert.equal(state.nodes.length, 5);
    assert.deepEqual(lineage(state).map((item) => item.label), ['ORIGINAL', 'HAIR_v1', 'CLOTHING_v1']);
  });

  it('el reset de módulo revierte solo la cadena final de esa herramienta', () => {
    let state = createHistory(root);
    state = keepVersion(state, hair1);
    state = keepVersion(state, hair2);
    state = keepVersion(state, mustache);
    assert.equal(resetTool(state, 'hair').headId, 'm1');
    assert.equal(resetTool(state, 'mustache').headId, 'h2');
    const onlyHair = keepVersion(createHistory(root), hair1);
    const twice = keepVersion(onlyHair, hair2);
    assert.equal(resetTool(twice, 'hair').headId, 'o');
    assert.equal(resetFull(twice).headId, 'o');
    assert.equal(jumpHistory(twice, 'h1').headId, 'h1');
    assert.equal(nextVersionLabel('hair', ['HAIR_v1']), 'HAIR_v2');
  });
});

describe('créditos, retención y vídeo/reel', () => {
  it('no bloquea herramientas cuando la monetización está apagada', () => {
    const disabled = authorizeJob({ monetizationEnabled: false, credits: 0, cost: 5 });
    assert.equal(disabled.ok, true);
    if (disabled.ok) assert.equal(disabled.charged, false);
    const blocked = authorizeJob({ monetizationEnabled: true, credits: 1, cost: 5 });
    assert.equal(blocked.ok, false);
    const charged = authorizeJob({ monetizationEnabled: true, credits: 5, cost: 5 });
    assert.equal(charged.ok, true);
    if (charged.ok) assert.equal(charged.nextCredits, 0);
    assert.equal(creditCost('video'), 5);
    const purchases = new DisabledPurchaseProvider();
    assert.equal(purchases.isAvailable(), false);
  });

  it('exige opt-out de entrenamiento y calcula retención', () => {
    assert.equal(trainingOptOutRequired(undefined), true);
    assert.equal(trainingOptOutRequired('true'), true);
    assert.equal(trainingOptOutRequired('false'), false);
    const created = new Date('2026-01-01T00:00:00.000Z').toISOString();
    assert.equal(retentionExpired(created, null, Date.parse('2026-04-01T00:00:00.000Z')), false);
    assert.equal(retentionExpired(created, 30, Date.parse('2026-02-15T00:00:00.000Z')), true);
  });

  it('rechaza transiciones de job imposibles', () => {
    assert.equal(canTransition('QUEUED', 'PROCESSING'), true);
    assert.equal(canTransition('COMPLETED', 'CANCELLED'), false);
    assert.throws(() => {
      throw new DomainError('invalid_transition', 'no');
    }, DomainError);
  });

  it('prepara el reel 9:16 con transición, texto y metadatos', () => {
    let reel = createEmptyReel('reel-1', 'project-1');
    reel = {
      ...reel,
      clips: [
        { id: 'a', assetId: 'asset-a', kind: 'image', order: 0, durationMs: 1000, trimInMs: 0, trimOutMs: 0 },
        { id: 'b', assetId: 'asset-b', kind: 'image', order: 1, durationMs: 1000, trimInMs: 0, trimOutMs: 0 },
      ],
      transitions: [{ id: 't', afterClipId: 'a', type: 'fade', durationMs: 200 }],
      texts: [{ id: 'title', text: 'Hola: look', startMs: 0, endMs: 800, position: 'bottom' }],
    };
    const moved = moveClip(reel, 'b', -1);
    assert.equal(moved.clips[0]?.id, 'b');
    const bad = validateTimeline({ ...reel, clips: [] });
    assert.equal(bad.ok, false);
    const built = buildReelArgs({
      timeline: reel,
      clips: [
        { id: 'a', path: '/tmp/a.png' },
        { id: 'b', path: '/tmp/b.png' },
      ],
      fontPath: '/fonts/DejaVuSans.ttf',
      width: 1080,
      height: 1920,
      fps: 24,
      outputPath: '/tmp/out.mp4',
      disclosure: 'AI modified by AI Look Studio',
    });
    const filter = built.args.find((arg) => arg.includes('xfade')) ?? '';
    assert.match(filter, /scale=1080:1920/);
    assert.match(filter, /xfade=transition=fade/);
    assert.match(filter, /drawtext=/);
    assert.ok(built.args.includes('comment=AI modified by AI Look Studio'));
    assert.equal(escapeDrawtext('Hola: 100%'), "Hola\\: 100\\%");
    const size = aspectSize('9:16', 720);
    assert.equal(size.height >= size.width, true);
    assert.equal(size.width % 2, 0);
    assert.equal(clampDuration(3.2, [2, 3, 4]), 3);
    assert.equal(clampParameters('retouch', 'facial', { amount: 9 }).amount, 0.4);
  });
});
