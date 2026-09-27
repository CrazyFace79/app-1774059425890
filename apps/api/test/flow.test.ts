import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { zoneMask } from '@lookstudio/domain';
import { buildApp, type BuiltApp } from '../src/app';
import { loadConfig } from '../src/config';

function sha(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function portraitPng(width = 120, height = 160): Promise<Buffer> {
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = (x + 0.5) / width;
      const ny = (y + 0.5) / height;
      const hair = ((nx - 0.5) / 0.26) ** 2 + ((ny - 0.18) / 0.14) ** 2 <= 1;
      const face = ((nx - 0.5) / 0.2) ** 2 + ((ny - 0.4) / 0.2) ** 2 <= 1;
      const cloth = ny > 0.66 && nx > 0.2 && nx < 0.8;
      const color = hair ? [36, 24, 16] : face ? [226, 184, 162] : cloth ? [40, 140, 70] : [30, 90, 220];
      const o = (y * width + x) * 4;
      rgba[o] = color[0] ?? 0;
      rgba[o + 1] = color[1] ?? 0;
      rgba[o + 2] = color[2] ?? 0;
      rgba[o + 3] = 255;
    }
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

function multipart(fields: Record<string, string>, files: { field: string; filename: string; type: string; data: Buffer }[]): { body: Buffer; contentType: string } {
  const boundary = '----lookstudio';
  const chunks: Buffer[] = [];
  for (const [key, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
  }
  for (const file of files) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.filename}"\r\nContent-Type: ${file.type}\r\n\r\n`));
    chunks.push(file.data);
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function boot(overrides: Partial<ReturnType<typeof loadConfig>> = {}): Promise<{ built: BuiltApp; dir: string }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lookstudio-'));
  const config = loadConfig({}, {
    dataDir: dir,
    monetizationEnabled: false,
    log: false,
    jobDelayMs: 0,
    rateLimitMax: 10_000,
    videoFps: 8,
    videoLongEdge: 192,
    ...overrides,
  });
  const built = await buildApp(config);
  return { built, dir };
}

describe('flujo crítico de la API', { concurrency: 1 }, () => {
  let built: BuiltApp;
  let dir: string;
  let token = '';
  let projectId = '';
  let png: Buffer;
  const operationHair = '11111111-1111-4111-8111-111111111111';
  const operationMustache = '22222222-2222-4222-8222-222222222222';

  before(async () => {
    const booted = await boot();
    built = booted.built;
    dir = booted.dir;
    png = await portraitPng();
    const auth = await built.app.inject({ method: 'POST', url: '/v1/auth/device', payload: { deviceId: 'device-test-123', platform: 'test' } });
    assert.equal(auth.statusCode, 200);
    token = auth.json().token as string;
    const project = await built.app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Retrato' },
    });
    assert.equal(project.statusCode, 200);
    projectId = project.json().id as string;
  });

  after(async () => {
    await built.app.close();
    built.store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('crea, edita pelo y bigote, conserva el original y exporta', async () => {
    const upload = multipart({ consent: 'true' }, [{ field: 'image', filename: 'portrait.png', type: 'image/png', data: png }]);
    const original = await built.app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/assets`,
      headers: { authorization: `Bearer ${token}`, 'content-type': upload.contentType, 'x-training-opt-out': 'true' },
      payload: upload.body,
    });
    assert.equal(original.statusCode, 201);
    const originalId = original.json().id as string;
    const originalFile = await built.app.inject({
      method: 'GET',
      url: `/v1/assets/${originalId}/file`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(sha(originalFile.rawPayload), sha(png));

    const hair = await runEdit(built, token, projectId, png, {
      operationId: operationHair,
      tool: 'hair',
      presetId: 'wavy',
      identityLock: true,
      maskMode: 'auto',
      parameters: { color: 'blonde', length: 0.7, density: 0.9, volume: 0.4, hairline: 0.5, gray: 0 },
      feather: 0,
      variation: 0,
    });
    assert.equal(hair.status, 'COMPLETED');
    assert.equal(hair.provider, 'mock-local');
    assert.equal(hair.disclosure, 'procedural-local');
    assert.match(hair.preservationPrompt, /facial identity/i);
    const hairBytes = await download(built, token, hair.resultAssetId);
    assert.notEqual(sha(hairBytes), sha(png));
    const again = await built.app.inject({
      method: 'GET',
      url: `/v1/assets/${originalId}/file`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(sha(again.rawPayload), sha(png));
    const hairRaw = await sharp(hairBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const sourceRaw = await sharp(png).ensureAlpha().raw().toBuffer();
    const mouth = zoneMask('mouth', hairRaw.info.width, hairRaw.info.height);
    let protectedPixels = 0;
    for (let i = 0; i < mouth.length; i += 1) {
      if ((mouth[i] ?? 0) < 250) continue;
      const o = i * 4;
      assert.equal(hairRaw.data[o], sourceRaw[o]);
      assert.equal(hairRaw.data[o + 1], sourceRaw[o + 1]);
      assert.equal(hairRaw.data[o + 2], sourceRaw[o + 2]);
      protectedPixels += 1;
    }
    assert.ok(protectedPixels > 0);

    const mustache = await runEdit(built, token, projectId, hairBytes, {
      operationId: operationMustache,
      tool: 'mustache',
      presetId: 'classic',
      identityLock: true,
      maskMode: 'auto',
      feather: 0,
      variation: 0,
    });
    assert.equal(mustache.status, 'COMPLETED');
    assert.match(mustache.negativePrompt, /beard/i);
    const history = await built.app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    const operations = history.json().operations as { tool: string; status: string }[];
    assert.deepEqual(operations.map((item) => item.tool), ['hair', 'mustache']);
    assert.ok(operations.every((item) => item.status === 'COMPLETED'));

    const stamp = multipart(
      { consent: 'true', payload: JSON.stringify({ projectId, visible: true, disclosure: 'procedural-local' }) },
      [{ field: 'image', filename: 'result.png', type: 'image/png', data: hairBytes }],
    );
    const exported = await built.app.inject({
      method: 'POST',
      url: '/v1/exports/stamp',
      headers: { authorization: `Bearer ${token}`, 'content-type': stamp.contentType, 'x-training-opt-out': 'true' },
      payload: stamp.body,
    });
    assert.equal(exported.statusCode, 200);
    assert.equal(exported.headers['content-type'], 'image/png');
    assert.ok(exported.rawPayload.includes(Buffer.from('AI Look Studio')) || exported.rawPayload.includes(Buffer.from('MODIFICADO')));
  });

  it('anima y monta un reel', async () => {
    const video = await runEdit(built, token, projectId, png, {
      tool: 'animate',
      presetId: 'dolly-in',
      identityLock: true,
      aspect: '9:16',
      durationSec: 2,
    });
    assert.equal(video.status, 'COMPLETED');
    assert.equal(video.disclosure, 'procedural-local');
    const mp4 = await download(built, token, video.resultAssetId);
    assert.ok(mp4.includes(Buffer.from('ftyp')));

    const frameA = await sharp({ create: { width: 80, height: 80, channels: 3, background: '#224488' } }).png().toBuffer();
    const frameB = await sharp({ create: { width: 80, height: 80, channels: 3, background: '#884422' } }).png().toBuffer();
    const timeline = {
      id: 'reel-1',
      projectId,
      width: 1080,
      height: 1920,
      fps: 24,
      clips: [
        { id: 'a', assetId: 'a', kind: 'image', order: 0, durationMs: 800, trimInMs: 0, trimOutMs: 0 },
        { id: 'b', assetId: 'b', kind: 'image', order: 1, durationMs: 800, trimInMs: 0, trimOutMs: 0 },
      ],
      texts: [{ id: 't', text: 'Look', startMs: 0, endMs: 700, position: 'bottom' }],
      transitions: [{ id: 'tr', afterClipId: 'a', type: 'fade', durationMs: 200 }],
      audio: null,
    };
    const reelForm = multipart(
      { consent: 'true', payload: JSON.stringify({ projectId, timeline, preview: true, containsAi: true }) },
      [
        { field: 'clip_a', filename: 'a.png', type: 'image/png', data: frameA },
        { field: 'clip_b', filename: 'b.png', type: 'image/png', data: frameB },
      ],
    );
    const queued = await built.app.inject({
      method: 'POST',
      url: '/v1/reels/render',
      headers: { authorization: `Bearer ${token}`, 'content-type': reelForm.contentType, 'x-training-opt-out': 'true' },
      payload: reelForm.body,
    });
    assert.equal(queued.statusCode, 202);
    await built.runner.flush();
    const job = await built.app.inject({
      method: 'GET',
      url: `/v1/jobs/${queued.json().jobId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(job.json().status, 'COMPLETED', job.json().error);
    const reel = await download(built, token, job.json().resultAssetId as string);
    assert.ok(reel.includes(Buffer.from('ftyp')));
  });

  it('bloquea subidas sin consentimiento y borra los datos', async () => {
    const denied = multipart({}, [{ field: 'image', filename: 'portrait.png', type: 'image/png', data: png }]);
    const response = await built.app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/assets`,
      headers: { authorization: `Bearer ${token}`, 'content-type': denied.contentType },
      payload: denied.body,
    });
    assert.equal(response.statusCode, 403);
    const training = multipart({ consent: 'true' }, [{ field: 'image', filename: 'portrait.png', type: 'image/png', data: png }]);
    const blocked = await built.app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/assets`,
      headers: { authorization: `Bearer ${token}`, 'content-type': training.contentType, 'x-training-opt-out': 'false' },
      payload: training.body,
    });
    assert.equal(blocked.statusCode, 400);
    const wiped = await built.app.inject({
      method: 'POST',
      url: '/v1/privacy/delete-all',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(wiped.statusCode, 200);
    const userRoot = path.join(dir, 'users');
    const remaining = fs.existsSync(userRoot) ? fs.readdirSync(userRoot) : [];
    assert.deepEqual(remaining, []);
  });
});

describe('proveedor HTTP y créditos', () => {
  it('envía la clave solo al proveedor y no cae al mock si falla la configuración', async () => {
    const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#336699' } }).png().toBuffer();
    let seenAuth = '';
    let seenTraining = '';
    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        seenAuth = String(req.headers.authorization ?? '');
        seenTraining = String(req.headers['x-training-opt-out'] ?? '');
        JSON.parse(Buffer.concat(chunks).toString());
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ imageBase64: png.toString('base64'), model: 'unit-model' }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('sin puerto');
    const booted = await boot({
      editProvider: 'http',
      editBaseUrl: `http://127.0.0.1:${address.port}`,
      editApiKey: 'test-key',
      editModel: 'unit-model',
    });
    try {
      const auth = await booted.built.app.inject({ method: 'POST', url: '/v1/auth/device', payload: { deviceId: 'device-http-1234', platform: 'test' } });
      const token = auth.json().token as string;
      const project = await booted.built.app.inject({
        method: 'POST',
        url: '/v1/projects',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'HTTP' },
      });
      const result = await runEdit(booted.built, token, project.json().id as string, png, {
        tool: 'hair',
        presetId: 'classic',
        identityLock: true,
        maskMode: 'auto',
        feather: 0,
      });
      assert.equal(result.status, 'COMPLETED');
      assert.equal(result.model, 'unit-model');
      assert.equal(seenAuth, 'Bearer test-key');
      assert.equal(seenTraining, 'true');
      assert.equal(result.disclosure, 'ai-modified');
    } finally {
      await booted.built.app.close();
      booted.built.store.close();
      server.close();
      fs.rmSync(booted.dir, { recursive: true, force: true });
    }
  });

  it('no cobra con la monetización apagada y sí bloquea cuando está encendida', async () => {
    const open = await boot();
    const auth = await open.built.app.inject({ method: 'POST', url: '/v1/auth/device', payload: { deviceId: 'device-free-1234', platform: 'test' } });
    const token = auth.json().token as string;
    open.built.store.setCredits(auth.json().userId as string, 0);
    const project = await open.built.app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Libre' },
    });
    const png = await sharp({ create: { width: 80, height: 80, channels: 3, background: '#222222' } }).png().toBuffer();
    const allowed = await runEdit(open.built, token, project.json().id as string, png, {
      tool: 'retouch',
      presetId: 'sharpen',
      identityLock: true,
      parameters: { amount: 0.2 },
    });
    assert.equal(allowed.status, 'COMPLETED');
    await open.built.app.close();
    open.built.store.close();

    const closed = await boot({ monetizationEnabled: true });
    const auth2 = await closed.built.app.inject({ method: 'POST', url: '/v1/auth/device', payload: { deviceId: 'device-pro-12345', platform: 'test' } });
    const token2 = auth2.json().token as string;
    closed.built.store.setCredits(auth2.json().userId as string, 0);
    const project2 = await closed.built.app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: { authorization: `Bearer ${token2}` },
      payload: { name: 'De pago' },
    });
    const form = multipart(
      { consent: 'true', payload: JSON.stringify({ projectId: project2.json().id, tool: 'retouch', presetId: 'sharpen', identityLock: true, parameters: { amount: 0.2 } }) },
      [{ field: 'image', filename: 'a.png', type: 'image/png', data: png }],
    );
    const denied = await closed.built.app.inject({
      method: 'POST',
      url: '/v1/jobs',
      headers: { authorization: `Bearer ${token2}`, 'content-type': form.contentType, 'x-training-opt-out': 'true' },
      payload: form.body,
    });
    assert.equal(denied.statusCode, 402);
    await closed.built.app.close();
    closed.built.store.close();
    fs.rmSync(open.dir, { recursive: true, force: true });
    fs.rmSync(closed.dir, { recursive: true, force: true });
  });
});

async function runEdit(built: BuiltApp, token: string, projectId: string, image: Buffer, payload: Record<string, unknown>) {
  const form = multipart(
    { consent: 'true', payload: JSON.stringify({ projectId, ...payload }) },
    [{ field: 'image', filename: 'image.png', type: 'image/png', data: image }],
  );
  const queued = await built.app.inject({
    method: 'POST',
    url: '/v1/jobs',
    headers: { authorization: `Bearer ${token}`, 'content-type': form.contentType, 'x-training-opt-out': 'true' },
    payload: form.body,
  });
  assert.equal(queued.statusCode, 202, queued.body);
  await built.runner.flush();
  const job = await built.app.inject({
    method: 'GET',
    url: `/v1/jobs/${queued.json().jobId}`,
    headers: { authorization: `Bearer ${token}` },
  });
  return job.json() as {
    status: string;
    provider: string;
    model: string;
    disclosure: string;
    preservationPrompt: string;
    negativePrompt: string;
    resultAssetId: string;
    error: string | null;
  };
}

async function download(built: BuiltApp, token: string, assetId: string): Promise<Buffer> {
  const response = await built.app.inject({
    method: 'GET',
    url: `/v1/assets/${assetId}/file`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.statusCode, 200, response.body);
  return response.rawPayload;
}
