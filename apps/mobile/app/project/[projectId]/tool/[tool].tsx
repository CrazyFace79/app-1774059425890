import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import {
  DomainError,
  buildEditPlan,
  defaultParameters,
  getControls,
  getToolPolicy,
  isToolId,
  presetsFor,
  TOOL_CATALOG,
} from '@lookstudio/domain';
import { ControlList, LockRow } from '../../../../src/components/controls';
import { Banner, Button, Chip, Field, Loading, Muted, Row, Screen, Title } from '../../../../src/components/ui';
import { useApp } from '../../../../src/context/AppContext';
import { useProject } from '../../../../src/hooks/useProject';
import { canStartJob, errorMessage, latestImageAsset, oneParam } from '../../../../src/pure/flow';
import { runEdit } from '../../../../src/services/jobs';
import { colors } from '../../../../src/theme';

export default function ToolScreen() {
  const params = useLocalSearchParams<{ projectId: string; tool: string }>();
  const projectId = oneParam(params.projectId);
  const toolParam = oneParam(params.tool);
  const app = useApp();
  const { view, loading } = useProject(projectId);
  const tool = isToolId(toolParam) ? toolParam : null;
  const presets = tool && tool !== 'animate' && tool !== 'reel' ? presetsFor(tool) : [];
  const [presetId, setPresetId] = useState(presets[0]?.id ?? '');
  const [parameters, setParameters] = useState<Record<string, number | string | boolean>>({});
  const [customPrompt, setCustomPrompt] = useState('');
  const [customColor, setCustomColor] = useState('#D6B05C');
  const [identityLock, setIdentityLock] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tool || tool === 'animate' || tool === 'reel') return;
    setPresetId(presetsFor(tool)[0]?.id ?? '');
  }, [tool]);

  useEffect(() => {
    if (!tool || !presetId || tool === 'animate' || tool === 'reel') return;
    setParameters(defaultParameters(tool, presetId));
  }, [tool, presetId]);

  if (tool === 'animate') return <Redirect href={`/project/${projectId}/animate`} />;
  if (tool === 'reel') return <Redirect href={`/project/${projectId}/reel`} />;
  if (!tool) return <Screen><Banner tone="danger">Herramienta desconocida.</Banner></Screen>;
  if (loading || !view) return <Loading label="Cargando herramienta…" />;

  const catalog = TOOL_CATALOG.find((item) => item.id === tool);
  const policy = getToolPolicy(tool, presetId || presets[0]?.id || 'custom');
  const mask = app.maskFor(projectId, tool);
  const image = view.history ? latestImageAsset(view.history, view.assets) : null;
  const merged = { ...parameters, ...(parameters.color === 'custom' ? { customColor } : {}) };
  let planError = '';
  let summary = '';
  let warnings: string[] = [];
  try {
    const plan = buildEditPlan({
      tool,
      presetId,
      customPrompt,
      parameters: merged,
      identityLock,
      maskMode: mask.mode,
    });
    summary = plan.summary;
    warnings = plan.warnings;
  } catch (cause) {
    planError = cause instanceof DomainError ? cause.message : errorMessage(cause);
  }
  const gate = canStartJob({
    online: app.online,
    serverUp: app.serverUp,
    hasImage: Boolean(image && !image.bytes_deleted),
    pendingReview: Boolean(view.pending),
  });

  const generate = async (variation: number) => {
    if (!image || !gate.ok) return;
    setError(null);
    setBusy('En cola');
    try {
      await app.ensureSession();
      const operationId = await runEdit({
        client: app.client(),
        projectId,
        original: view.original,
        source: image,
        onProgress: (progress) => setBusy(`${progress.label} ${progress.progress}%`),
        payload: {
          tool,
          presetId,
          customPrompt,
          parameters: merged,
          identityLock,
          maskMode: mask.mode,
          strokes: mask.strokes,
          feather: mask.feather,
          invert: mask.invert,
          variation,
        },
      });
      await app.refresh();
      router.push(`/project/${projectId}/review?op=${operationId}`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen scroll>
      <Title>{catalog?.name ?? tool}</Title>
      <Muted>{catalog?.description}</Muted>
      <Banner>{policy.editScope === 'local' ? 'Edición local. La máscara limita el cambio.' : 'Transformación de estilo sobre el encuadre.'}</Banner>
      {app.capabilities?.providers.edit.generative === false ? <Banner>Resultado procedural local, no un modelo generativo.</Banner> : null}
      <LockRow value={identityLock} onChange={setIdentityLock} warning={policy.identityWarning} />
      <Text style={styles.section}>Presets</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
        {presets.map((preset) => (
          <Chip key={preset.id} label={preset.name} active={preset.id === presetId} onPress={() => setPresetId(preset.id)} />
        ))}
      </ScrollView>
      <ControlList
        controls={getControls(tool, presetId)}
        values={merged}
        customColor={customColor}
        onCustomColor={setCustomColor}
        onChange={(key, value) => setParameters((current) => ({ ...current, [key]: value }))}
      />
      <Field label="Texto libre" value={customPrompt} onChangeText={setCustomPrompt} placeholder="Describe el cambio si el preset lo pide" multiline />
      <Muted>Máscara {mask.mode === 'manual' ? 'manual' : 'automática'} · {mask.strokes.length} trazos</Muted>
      <Button label="Editar máscara" tone="ghost" onPress={() => router.push(`/project/${projectId}/mask?tool=${tool}`)} />
      {summary ? <Muted>{summary}</Muted> : null}
      {warnings.map((warning) => (
        <Banner key={warning} tone="warn">{warning}</Banner>
      ))}
      {planError ? <Banner tone="warn">{planError}</Banner> : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {busy ? <Banner>{busy}</Banner> : null}
      {!gate.ok ? <Banner>{gate.reason}</Banner> : null}
      {view.pending ? (
        <Button label="Ir al resultado pendiente" onPress={() => router.push(`/project/${projectId}/review?op=${view.pending?.id}`)} />
      ) : (
        <Row>
          <Button label={busy ? 'Generando…' : 'Generar'} disabled={Boolean(busy) || !gate.ok || Boolean(planError)} onPress={() => void generate(0)} />
        </Row>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { color: colors.text, fontWeight: '700', fontSize: 16 },
  presets: { gap: 8, paddingVertical: 4 },
});
