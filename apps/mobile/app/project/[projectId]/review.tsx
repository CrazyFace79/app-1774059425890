import { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { isToolId, type Stroke } from '@lookstudio/domain';
import { CompareBar, Stage } from '../../../src/components/stage';
import { Banner, Button, Loading, Muted, Row, Screen, Title } from '../../../src/components/ui';
import { useApp } from '../../../src/context/AppContext';
import { useProject } from '../../../src/hooks/useProject';
import { disclosureLabel, errorMessage, oneParam } from '../../../src/pure/flow';
import { runAnimate, runEdit } from '../../../src/services/jobs';
import { discardOperation, getAsset, getOperation, keepOperation, type AssetRow, type OperationRow } from '../../../src/storage/library';

export default function ReviewScreen() {
  const params = useLocalSearchParams<{ projectId: string; op?: string }>();
  const projectId = oneParam(params.projectId);
  const operationId = oneParam(params.op);
  const app = useApp();
  const { view, loading } = useProject(projectId);
  const [operation, setOperation] = useState<OperationRow | null>(null);
  const [before, setBefore] = useState<AssetRow | null>(null);
  const [after, setAfter] = useState<AssetRow | null>(null);
  const [compare, setCompare] = useState(true);
  const [hold, setHold] = useState(false);
  const [ratio, setRatio] = useState(0.5);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const row = await getOperation(operationId);
      if (!alive) return;
      setOperation(row);
      if (!row) return;
      setBefore(await getAsset(row.input_asset_id));
      setAfter(row.output_asset_id ? await getAsset(row.output_asset_id) : null);
    })();
    return () => {
      alive = false;
    };
  }, [operationId, app.revision]);

  if (loading || !view) return <Loading label="Cargando revisión…" />;
  if (!operation) return <Screen><Banner tone="danger">No encuentro esa operación.</Banner></Screen>;

  const warnings = parseList(operation.warnings_json);
  const afterUri = after && !after.bytes_deleted ? after.local_uri : '';
  const beforeUri = before && !before.bytes_deleted ? before.local_uri : null;

  async function again(variation: number) {
    if (!before || before.bytes_deleted) throw new Error('La imagen de entrada ya no está.');
    if (operation?.status === 'review') await discardOperation(operation.id);
    await app.ensureSession();
    const parameters = parseRecord(operation?.parameters_json ?? '{}');
    const strokes = parseStrokes(operation?.strokes_json ?? '[]');
    if (operation?.tool === 'animate') {
      return runAnimate({
        client: app.client(),
        projectId,
        original: view?.original ?? null,
        source: before,
        presetId: operation.preset_id,
        customPrompt: operation.custom_prompt,
        identityLock: operation.identity_lock === 1,
        aspect: String(parameters.aspect ?? '9:16'),
        durationSec: Number(parameters.duration ?? 3),
        variation,
        onProgress: (progress) => setBusy(`${progress.label} ${progress.progress}%`),
      });
    }
    if (!operation || !isToolId(operation.tool) || operation.tool === 'reel') {
      throw new Error('Repite el reel desde su línea de tiempo.');
    }
    return runEdit({
      client: app.client(),
      projectId,
      original: view?.original ?? null,
      source: before,
      onProgress: (progress) => setBusy(`${progress.label} ${progress.progress}%`),
      payload: {
        tool: operation.tool,
        presetId: operation.preset_id,
        customPrompt: operation.custom_prompt,
        parameters,
        identityLock: operation.identity_lock === 1,
        maskMode: operation.mask_mode === 'manual' ? 'manual' : 'auto',
        strokes,
        feather: operation.feather,
        invert: operation.invert === 1,
        variation,
      },
    });
  }

  return (
    <Screen scroll>
      <Title>Antes de conservar</Title>
      <Muted>{operation.summary || 'Revisa el resultado. El proyecto no cambia hasta que pulses Conservar.'}</Muted>
      <Banner>{disclosureLabel(operation.disclosure || after?.disclosure)}</Banner>
      {operation.preservation_prompt ? <Muted>{operation.preservation_prompt}</Muted> : null}
      {warnings.map((warning) => (
        <Banner key={warning} tone="warn">{warning}</Banner>
      ))}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {busy ? <Banner>{busy}</Banner> : null}
      {afterUri ? (
        <>
          <Stage currentUri={afterUri} originalUri={beforeUri} mime={after?.mime ?? 'image/png'} compare={compare && !after?.mime.startsWith('video/')} hold={hold} ratio={ratio} />
          {beforeUri && !after?.mime.startsWith('video/') ? (
            <CompareBar compare={compare} onCompare={() => setCompare((value) => !value)} ratio={ratio} onRatio={setRatio} onHoldStart={() => setHold(true)} onHoldEnd={() => setHold(false)} />
          ) : null}
        </>
      ) : (
        <Banner tone="danger">{operation.summary || 'El resultado no está disponible.'}</Banner>
      )}
      <Muted>
        {operation.provider} · {operation.model}
      </Muted>
      <Row>
        <Button
          label="Conservar"
          disabled={operation.status !== 'review'}
          onPress={() => {
            void keepOperation(operation.id)
              .then(() => app.refresh())
              .then(() => router.replace(`/project/${projectId}`))
              .catch((cause) => setError(errorMessage(cause)));
          }}
        />
        <Button
          label="Descartar"
          tone="danger"
          onPress={() => {
            void discardOperation(operation.id)
              .then(() => app.refresh())
              .then(() => router.back())
              .catch((cause) => setError(errorMessage(cause)));
          }}
        />
      </Row>
      <Row>
        <Button
          label="Reintentar"
          tone="ghost"
          disabled={Boolean(busy) || operation.tool === 'reel'}
          onPress={() => {
            setError(null);
            void again(operation.variation)
              .then(async (nextId) => {
                await app.refresh();
                router.replace(`/project/${projectId}/review?op=${nextId}`);
              })
              .catch((cause) => setError(errorMessage(cause)))
              .finally(() => setBusy(null));
          }}
        />
        <Button
          label="Variación"
          tone="violet"
          disabled={Boolean(busy) || operation.tool === 'reel'}
          onPress={() => {
            setError(null);
            void again(operation.variation + 1)
              .then(async (nextId) => {
                await app.refresh();
                router.replace(`/project/${projectId}/review?op=${nextId}`);
              })
              .catch((cause) => setError(errorMessage(cause)))
              .finally(() => setBusy(null));
          }}
        />
      </Row>
      {operation.tool === 'reel' ? (
        <Button label="Volver al reel" tone="ghost" onPress={() => router.push(`/project/${projectId}/reel`)} />
      ) : null}
    </Screen>
  );
}

function parseList(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function parseRecord(raw: string): Record<string, number | string | boolean> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const output: Record<string, number | string | boolean> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') output[key] = value;
    }
    return output;
  } catch {
    return {};
  }
}

function parseStrokes(raw: string): Stroke[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const stroke = item as Stroke;
      if ((stroke.mode !== 'brush' && stroke.mode !== 'erase') || !Array.isArray(stroke.points)) return [];
      return [stroke];
    });
  } catch {
    return [];
  }
}
