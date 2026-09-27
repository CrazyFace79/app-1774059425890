import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { containRect, isToolId, pointToNormalized, presetsFor, type Stroke } from '@lookstudio/domain';
import { TrackSlider } from '../../../src/components/controls';
import { Banner, Button, Chip, Loading, Muted, Row, Screen, Title } from '../../../src/components/ui';
import { useApp } from '../../../src/context/AppContext';
import { useProject } from '../../../src/hooks/useProject';
import { errorMessage, latestImageAsset, oneParam } from '../../../src/pure/flow';
import { hydrateLocalUri } from '../../../src/storage/files';

export default function MaskScreen() {
  const params = useLocalSearchParams<{ projectId: string; tool?: string }>();
  const projectId = oneParam(params.projectId);
  const toolParam = oneParam(params.tool) || 'hair';
  const tool = isToolId(toolParam) ? toolParam : 'hair';
  const app = useApp();
  const { view, loading } = useProject(projectId);
  const mask = app.maskFor(projectId, tool);
  const [layout, setLayout] = useState({ w: 1, h: 1 });
  const [live, setLive] = useState<Stroke | null>(null);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState('');
  const draft = useRef<Stroke | null>(null);
  const strokes = useRef(mask.strokes);
  strokes.current = mask.strokes;
  const maskRef = useRef(mask);
  maskRef.current = mask;

  const image = view?.history ? latestImageAsset(view.history, view.assets) : null;
  useEffect(() => {
    if (!image || image.bytes_deleted) {
      setPhotoUri('');
      return;
    }
    let alive = true;
    void hydrateLocalUri(image.local_uri).then((uri) => {
      if (alive) setPhotoUri(uri);
    });
    return () => {
      alive = false;
    };
  }, [image]);
  const frame = containRect(layout.w, layout.h, image?.width || 3, image?.height || 4);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const updateRef = useRef(app.updateMask);
  updateRef.current = app.updateMask;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => maskRef.current.mode === 'manual',
      onMoveShouldSetPanResponder: () => maskRef.current.mode === 'manual',
      onPanResponderGrant: (event) => {
        const point = pointToNormalized(event.nativeEvent.locationX, event.nativeEvent.locationY, frameRef.current);
        if (!point) return;
        const stroke: Stroke = { mode: maskRef.current.brush, size: maskRef.current.size, points: [point] };
        draft.current = stroke;
        setLive(stroke);
      },
      onPanResponderMove: (event) => {
        const point = pointToNormalized(event.nativeEvent.locationX, event.nativeEvent.locationY, frameRef.current);
        if (!point || !draft.current) return;
        draft.current = { ...draft.current, points: [...draft.current.points, point] };
        setLive(draft.current);
      },
      onPanResponderRelease: () => {
        if (draft.current && draft.current.points.length > 0) {
          updateRef.current(projectId, tool, { strokes: [...strokes.current, draft.current] });
        }
        draft.current = null;
        setLive(null);
      },
    }),
  ).current;

  if (loading || !view) return <Loading label="Cargando máscara…" />;
  if (!image || image.bytes_deleted) return <Screen><Banner tone="danger">Importa una foto antes de pintar la máscara.</Banner></Screen>;

  const painted = [...mask.strokes, ...(live ? [live] : [])];

  return (
    <Screen scroll>
      <Title>Máscara</Title>
      <Muted>AUTO usa la zona de la herramienta. MANUAL limita el cambio a lo que pintes. Borrar resta de la máscara.</Muted>
      <Row>
        <Chip label="Auto" active={mask.mode === 'auto'} onPress={() => app.updateMask(projectId, tool, { mode: 'auto' })} />
        <Chip label="Manual" active={mask.mode === 'manual'} onPress={() => app.updateMask(projectId, tool, { mode: 'manual' })} />
        <Chip label="Pincel" active={mask.brush === 'brush'} onPress={() => app.updateMask(projectId, tool, { brush: 'brush' })} />
        <Chip label="Borrar" active={mask.brush === 'erase'} onPress={() => app.updateMask(projectId, tool, { brush: 'erase' })} />
        <Chip label={mask.invert ? 'Invertida' : 'Invertir'} active={mask.invert} onPress={() => app.updateMask(projectId, tool, { invert: !mask.invert })} />
      </Row>
      <TrackSlider label="Tamaño" value={mask.size} min={0.01} max={0.2} step={0.005} onChange={(size) => app.updateMask(projectId, tool, { size })} />
      <TrackSlider label="Suavizado" value={mask.feather} min={0} max={24} step={1} onChange={(feather) => app.updateMask(projectId, tool, { feather })} />
      <View
        style={styles.canvas}
        onLayout={(event) => setLayout({ w: event.nativeEvent.layout.width, h: event.nativeEvent.layout.height })}
        {...responder.panHandlers}
      >
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="contain" />
        {overlay ? <Image source={{ uri: `data:image/png;base64,${overlay}` }} style={StyleSheet.absoluteFill} contentFit="contain" /> : null}
        {painted.flatMap((stroke, strokeIndex) =>
          stroke.points.map((point, pointIndex) => {
            const diameter = stroke.size * Math.min(frame.w, frame.h) * 2;
            return (
              <View
                key={`${strokeIndex}-${pointIndex}`}
                style={{
                  position: 'absolute',
                  left: frame.x + point.x * frame.w - diameter / 2,
                  top: frame.y + point.y * frame.h - diameter / 2,
                  width: diameter,
                  height: diameter,
                  borderRadius: diameter / 2,
                  backgroundColor: stroke.mode === 'erase' ? 'rgba(255,80,80,0.45)' : 'rgba(214,255,74,0.45)',
                }}
              />
            );
          }),
        )}
      </View>
      {note ? <Banner>{note}</Banner> : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Button
        label="Previsualizar límite"
        onPress={() => {
          setError(null);
          void (async () => {
            try {
              if (!app.serverUp) throw new Error('La previsualización de máscara usa la API.');
              await app.ensureSession();
              const preview = await app.client().previewMask(image.local_uri, 'mask.png', image.mime, {
                tool,
                presetId: presetsFor(tool)[0]?.id ?? 'custom',
                customPrompt: tool === 'background' ? 'studio gray backdrop' : 'custom look',
                parameters: {},
                identityLock: true,
                maskMode: mask.mode,
                strokes: mask.strokes,
                feather: mask.feather,
                invert: mask.invert,
              });
              setOverlay(preview.overlayPngBase64);
              setNote(
                preview.confidence < 0.55
                  ? 'La segmentación geométrica tiene poca confianza. Revisa la máscara manual.'
                  : `Máscara ${preview.source}. Confianza ${preview.confidence.toFixed(2)}.`,
              );
            } catch (cause) {
              setError(errorMessage(cause));
            }
          })();
        }}
      />
      <Button label="Limpiar trazos" tone="ghost" onPress={() => app.updateMask(projectId, tool, { strokes: [] })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  canvas: { height: 420, backgroundColor: '#05060A', borderRadius: 16, overflow: 'hidden' },
});
