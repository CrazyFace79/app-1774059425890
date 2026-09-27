import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { createEmptyReel, moveClip, REEL_EXPORT_SIZE, validateTimeline, type ReelTextPosition, type ReelTimeline, type ReelTransitionType } from '@lookstudio/domain';
import { TrackSlider } from '../../../src/components/controls';
import { Banner, Button, Chip, Field, Loading, Muted, Row, Screen, Title } from '../../../src/components/ui';
import { useApp } from '../../../src/context/AppContext';
import { useProject } from '../../../src/hooks/useProject';
import { canStartJob, errorMessage, oneParam } from '../../../src/pure/flow';
import { runReel } from '../../../src/services/jobs';
import { getAsset, loadTimeline, saveTimeline, type AssetRow } from '../../../src/storage/library';
import { newId, readUriBytes, writeProjectFile } from '../../../src/storage/files';
import { StyleSheet, Text } from 'react-native';
import { colors } from '../../../src/theme';

export default function ReelScreen() {
  const projectId = oneParam(useLocalSearchParams<{ projectId: string }>().projectId);
  const app = useApp();
  const { view, loading } = useProject(projectId);
  const [timeline, setTimeline] = useState<ReelTimeline | null>(null);
  const [audio, setAudio] = useState<{ uri: string; name: string; mime: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [position, setPosition] = useState<ReelTextPosition>('bottom');

  useEffect(() => {
    let alive = true;
    void loadTimeline(projectId).then((loaded) => {
      if (!alive) return;
      const base = loaded.projectId === projectId ? loaded : createEmptyReel(newId(), projectId);
      setTimeline({ ...base, width: REEL_EXPORT_SIZE.width, height: REEL_EXPORT_SIZE.height, fps: REEL_EXPORT_SIZE.fps });
      setText(base.texts[0]?.text ?? '');
      setPosition(base.texts[0]?.position ?? 'bottom');
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  if (loading || !view || !timeline) return <Loading label="Cargando reel…" />;

  const sources = view.assets.filter((asset) => !asset.bytes_deleted && asset.kind !== 'pending' && (asset.mime.startsWith('image/') || asset.mime.startsWith('video/')));
  const gate = canStartJob({ online: app.online, serverUp: app.serverUp, hasImage: sources.length > 0, pendingReview: Boolean(view.pending) });

  function update(next: ReelTimeline) {
    const sized = { ...next, projectId, width: REEL_EXPORT_SIZE.width, height: REEL_EXPORT_SIZE.height, fps: REEL_EXPORT_SIZE.fps };
    setTimeline(sized);
    void saveTimeline(projectId, sized);
  }

  function withText(value: string, place: ReelTextPosition): ReelTimeline {
    if (!timeline) return createEmptyReel(newId(), projectId);
    const clean = value.trim();
    const texts = clean
      ? [{ id: timeline.texts[0]?.id ?? newId(), text: clean, startMs: 200, endMs: 2200, position: place }]
      : [];
    return { ...timeline, texts };
  }

  async function render(preview: boolean) {
    if (!timeline) return;
    const current = withText(text, position);
    update(current);
    const validation = validateTimeline(current);
    if (!validation.ok) throw new Error(validation.errors.join(' '));
    const clips = [];
    for (const clip of current.clips) {
      const asset = await getAsset(clip.assetId);
      if (!asset || asset.bytes_deleted) throw new Error('Falta un archivo de la línea de tiempo.');
      clips.push({ id: clip.id, asset });
    }
    const containsAi = clips.some((clip) => clip.asset.disclosure === 'ai-modified' || clip.asset.disclosure === 'ai-generated');
    await app.ensureSession();
    return runReel({
      client: app.client(),
      projectId,
      timeline: current,
      clips,
      audio,
      preview,
      containsAi,
      onProgress: (progress) => setBusy(`${progress.label} ${progress.progress}%`),
    });
  }

  return (
    <Screen scroll>
      <Title>Reel 9:16</Title>
      <Muted>Ordena imágenes o vídeos, recorta la duración, elige el corte y añade un texto. El audio de los clips no se reutiliza. Puedes añadir una pista tuya.</Muted>
      <Muted>No hay música con copyright incluida.</Muted>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {busy ? <Banner>{busy}</Banner> : null}
      {!gate.ok ? <Banner>{gate.reason}</Banner> : null}
      <Text style={styles.section}>Añadir</Text>
      <Row>
        {sources.map((asset) => (
          <Button key={asset.id} label={asset.kind === 'original' ? 'Original' : asset.kind} tone="ghost" onPress={() => addAsset(asset)} />
        ))}
      </Row>
      {timeline.clips.length === 0 ? <Muted>La línea de tiempo está vacía.</Muted> : null}
      {timeline.clips
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((clip, index, all) => (
          <Row key={clip.id}>
            <Muted>
              {index + 1}. {clip.kind} · {(clip.durationMs / 1000).toFixed(1)} s
            </Muted>
            <Button label="Subir" tone="ghost" onPress={() => update(moveClip(timeline, clip.id, -1))} />
            <Button label="Bajar" tone="ghost" onPress={() => update(moveClip(timeline, clip.id, 1))} />
            <Button
              label="Quitar"
              tone="danger"
              onPress={() =>
                update({
                  ...timeline,
                  clips: timeline.clips.filter((item) => item.id !== clip.id).map((item, order) => ({ ...item, order })),
                  transitions: timeline.transitions.filter((item) => item.afterClipId !== clip.id),
                })
              }
            />
            <TrackSlider
              label="Duración"
              value={clip.durationMs / 1000}
              min={0.3}
              max={8}
              step={0.1}
              onChange={(seconds) => {
                const durationMs = Math.round(seconds * 1000);
                update({
                  ...timeline,
                  clips: timeline.clips.map((item) =>
                    item.id === clip.id ? { ...item, durationMs, trimOutMs: item.kind === 'video' ? item.trimInMs + durationMs : 0 } : item,
                  ),
                });
              }}
            />
            {index < all.length - 1 ? (
              <Row>
                {(['cut', 'fade', 'wipe'] as ReelTransitionType[]).map((type) => {
                  const active = (timeline.transitions.find((item) => item.afterClipId === clip.id)?.type ?? 'cut') === type;
                  return (
                    <Chip
                      key={type}
                      label={type === 'cut' ? 'Corte' : type === 'fade' ? 'Fundido' : 'Barrido'}
                      active={active}
                      onPress={() =>
                        update({
                          ...timeline,
                          transitions: [
                            ...timeline.transitions.filter((item) => item.afterClipId !== clip.id),
                            { id: newId(), afterClipId: clip.id, type, durationMs: 280 },
                          ],
                        })
                      }
                    />
                  );
                })}
              </Row>
            ) : null}
          </Row>
        ))}
      <Field label="Texto" value={text} onChangeText={setText} placeholder="Una frase corta" />
      <Row>
        {(['top', 'center', 'bottom'] as ReelTextPosition[]).map((place) => (
          <Chip key={place} label={place === 'top' ? 'Arriba' : place === 'center' ? 'Centro' : 'Abajo'} active={position === place} onPress={() => setPosition(place)} />
        ))}
      </Row>
      <Button
        label={audio ? 'Quitar audio' : 'Añadir audio propio'}
        tone="ghost"
        onPress={() => {
          if (audio) {
            setAudio(null);
            update({ ...timeline, audio: null });
            return;
          }
          void DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true }).then(async (result) => {
            if (result.canceled || !result.assets?.[0]) return;
            const picked = result.assets[0];
            const bytes = await readUriBytes(picked.uri);
            const uri = await writeProjectFile(projectId, `audio-${newId()}.audio`, bytes);
            const next = { uri, name: picked.name || 'audio', mime: picked.mimeType || 'audio/mpeg' };
            setAudio(next);
            update({ ...timeline, audio: { assetId: 'local-audio', volume: timeline.audio?.volume ?? 0.8 } });
          }).catch((cause) => setError(errorMessage(cause)));
        }}
      />
      {timeline.audio ? (
        <TrackSlider
          label="Volumen"
          value={timeline.audio.volume}
          min={0}
          max={1}
          step={0.05}
          onChange={(volume) => update({ ...timeline, audio: { assetId: timeline.audio?.assetId ?? 'local-audio', volume } })}
        />
      ) : null}
      <Button label={busy ? 'Render…' : 'Previsualizar'} disabled={Boolean(busy) || !gate.ok} onPress={() => void launch(true)} />
      <Button label="Exportar 1080×1920" tone="violet" disabled={Boolean(busy) || !gate.ok} onPress={() => void launch(false)} />
    </Screen>
  );

  function addAsset(asset: AssetRow) {
    if (!timeline) return;
    const durationMs = 2500;
    update({
      ...timeline,
      clips: [
        ...timeline.clips,
        {
          id: newId(),
          assetId: asset.id,
          kind: asset.mime.startsWith('video/') ? 'video' : 'image',
          order: timeline.clips.length,
          durationMs,
          trimInMs: 0,
          trimOutMs: asset.mime.startsWith('video/') ? durationMs : 0,
        },
      ],
    });
  }

  async function launch(preview: boolean) {
    setError(null);
    try {
      const operationId = await render(preview);
      if (!operationId) return;
      await app.refresh();
      router.push(`/project/${projectId}/review?op=${operationId}`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }
}

const styles = StyleSheet.create({
  section: { color: colors.text, fontWeight: '700' },
});
