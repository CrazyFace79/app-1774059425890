import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAnimatePayload, buildEditPayload, canStartJob, disclosureLabel, rowsToHistory } from '../src/pure/flow';

test('el payload de edición deja Identity Lock activo si no se relaja', () => {
  const payload = buildEditPayload({
    projectId: 'p',
    operationId: 'op',
    tool: 'hair',
    presetId: 'wavy',
    customPrompt: '',
    parameters: { length: 0.66 },
    maskMode: 'auto',
    strokes: [],
    feather: 2,
    invert: false,
    variation: 0,
  });
  assert.equal(payload.identityLock, true);
  assert.equal(payload.consent, true);
  assert.equal(payload.invert, false);
});

test('animar envía formato y duración al trabajo de vídeo', () => {
  const payload = buildAnimatePayload({
    projectId: 'p',
    operationId: 'op',
    presetId: 'dolly-in',
    customPrompt: '',
    aspect: '9:16',
    durationSec: 3,
    variation: 1,
  });
  assert.equal(payload.tool, 'animate');
  assert.equal(payload.aspect, '9:16');
  assert.equal(payload.durationSec, 3);
  assert.equal(payload.identityLock, true);
});

test('no se genera otro trabajo con un resultado sin conservar', () => {
  const blocked = canStartJob({ online: true, serverUp: true, hasImage: true, pendingReview: true });
  assert.equal(blocked.ok, false);
  const ready = canStartJob({ online: true, serverUp: true, hasImage: true, pendingReview: false });
  assert.equal(ready.ok, true);
});

test('la etiqueta local no se presenta como IA generativa', () => {
  assert.match(disclosureLabel('procedural-local'), /No es IA generativa/);
  assert.equal(disclosureLabel('ai-modified'), 'Modificado con IA');
});

test('el historial reconstruye cabeza y rehacer desde las filas', () => {
  const history = rowsToHistory(
    { head_version_id: 'v2', redo_json: '["v3"]' },
    [
      { id: 'v1', parent_id: null, asset_id: 'a1', operation_id: null, label: 'ORIGINAL', tool: null, created_at: 't1' },
      { id: 'v2', parent_id: 'v1', asset_id: 'a2', operation_id: 'op', label: 'HAIR_v1', tool: 'hair', created_at: 't2' },
    ],
  );
  assert.equal(history?.headId, 'v2');
  assert.deepEqual(history?.redoIds, ['v3']);
  assert.equal(history?.nodes[1]?.parentId, 'v1');
});
