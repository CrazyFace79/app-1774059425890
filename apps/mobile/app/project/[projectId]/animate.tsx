import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { buildEditPlan, defaultParameters, getControls, getToolPolicy, presetsFor } from '@lookstudio/domain';
import { ControlList, LockRow } from '../../../src/components/controls';
import { Banner, Button, Chip, Field, Loading, Muted, Screen, Title } from '../../../src/components/ui';
import { useApp } from '../../../src/context/AppContext';
import { useProject } from '../../../src/hooks/useProject';
import { canStartJob, errorMessage, latestImageAsset, oneParam } from '../../../src/pure/flow';
import { runAnimate } from '../../../src/services/jobs';
import { ScrollView, StyleSheet } from 'react-native';

export default function AnimateScreen() {
  const projectId = oneParam(useLocalSearchParams<{ projectId: string }>().projectId);
  const app = useApp();
  const { view, loading } = useProject(projectId);
  const presets = presetsFor('animate');
  const [presetId, setPresetId] = useState(presets[0]?.id ?? 'natural');
  const [parameters, setParameters] = useState<Record<string, number | string | boolean>>(defaultParameters('animate', 'natural'));
  const [customPrompt, setCustomPrompt] = useState('');
  const [identityLock, setIdentityLock] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const policy = getToolPolicy('animate', presetId);

  if (loading || !view) return <Loading label="Cargando animación…" />;
  const image = view.history ? latestImageAsset(view.history, view.assets) : null;
  const gate = canStartJob({
    online: app.online,
    serverUp: app.serverUp,
    hasImage: Boolean(image && !image.bytes_deleted),
    pendingReview: Boolean(view.pending),
  });
  const aspect = typeof parameters.aspect === 'string' ? parameters.aspect : '9:16';
  const durationSec = Number(parameters.duration ?? 3);
  let warning = '';
  try {
    warning = buildEditPlan({
      tool: 'animate',
      presetId,
      customPrompt,
      identityLock,
      parameters: { aspect, duration: String(durationSec) },
    }).warnings.join(' ');
  } catch (cause) {
    warning = errorMessage(cause);
  }

  return (
    <Screen scroll>
      <Title>Animar</Title>
      <Muted>De la imagen actual a un clip. El motor local solo mueve la cámara. Sonrisa, mirada o giro real piden un proveedor de vídeo generativo.</Muted>
      {app.capabilities?.providers.video.generative === false ? (
        <Banner tone="warn">El vídeo conectado es movimiento de cámara local, no un gesto generado.</Banner>
      ) : null}
      <LockRow value={identityLock} onChange={setIdentityLock} warning={policy.identityWarning} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {presets.map((preset) => (
          <Chip
            key={preset.id}
            label={preset.name}
            active={preset.id === presetId}
            onPress={() => {
              setPresetId(preset.id);
              setParameters(defaultParameters('animate', preset.id));
            }}
          />
        ))}
      </ScrollView>
      <ControlList controls={getControls('animate', presetId)} values={parameters} customColor="" onCustomColor={() => undefined} onChange={(key, value) => setParameters((current) => ({ ...current, [key]: value }))} />
      <Field label="Texto libre" value={customPrompt} onChangeText={setCustomPrompt} multiline />
      {warning ? <Banner tone="warn">{warning}</Banner> : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {busy ? <Banner>{busy}</Banner> : null}
      {!gate.ok ? <Banner>{gate.reason}</Banner> : null}
      <Button
        label={busy ? 'Generando…' : 'Generar vídeo'}
        disabled={Boolean(busy) || !gate.ok}
        onPress={() => {
          if (!image) return;
          setError(null);
          void (async () => {
            try {
              await app.ensureSession();
              const operationId = await runAnimate({
                client: app.client(),
                projectId,
                original: view.original,
                source: image,
                presetId,
                customPrompt,
                identityLock,
                aspect,
                durationSec,
                variation: 0,
                onProgress: (progress) => setBusy(`${progress.label} ${progress.progress}%`),
              });
              await app.refresh();
              router.push(`/project/${projectId}/review?op=${operationId}`);
            } catch (cause) {
              setError(errorMessage(cause));
            } finally {
              setBusy(null);
            }
          })();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8 },
});
