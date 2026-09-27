import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { TOOL_CATALOG, lineage } from '@lookstudio/domain';
import { CompareBar, Stage } from '../../../src/components/stage';
import { Banner, Button, Empty, Field, Loading, Muted, Row, Screen } from '../../../src/components/ui';
import { useApp } from '../../../src/context/AppContext';
import { useProject } from '../../../src/hooks/useProject';
import { disclosureLabel, errorMessage, latestImageAsset, oneParam } from '../../../src/pure/flow';
import { exportImage } from '../../../src/services/jobs';
import { pickImage } from '../../../src/services/picker';
import { downloadInBrowser, hydrateLocalUri } from '../../../src/storage/files';
import {
  deleteOriginalBytes,
  deleteProject,
  duplicateProject,
  importOriginal,
  redoProject,
  renameProject,
  resetProject,
  resetProjectTool,
  setRetention,
  undoProject,
} from '../../../src/storage/library';
import { colors } from '../../../src/theme';

export default function EditorScreen() {
  const params = useLocalSearchParams<{ projectId: string }>();
  const projectId = oneParam(params.projectId);
  const app = useApp();
  const { view, loading, error } = useProject(projectId);
  const [localError, setLocalError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [compare, setCompare] = useState(false);
  const [hold, setHold] = useState(false);
  const [ratio, setRatio] = useState(0.5);
  const [confirmOriginal, setConfirmOriginal] = useState(false);

  if (loading) return <Loading label="Abriendo proyecto…" />;
  if (!view) return <Screen><Banner tone="danger">{error ?? 'El proyecto no existe.'}</Banner></Screen>;

  const head = view.head;
  const original = view.original;
  const image = view.history ? latestImageAsset(view.history, view.assets) : null;
  const shown = head && !head.bytes_deleted ? head : null;
  const originalUri = original && !original.bytes_deleted ? original.local_uri : null;
  const toolName = TOOL_CATALOG.find((item) => item.id === view.history?.nodes.find((node) => node.id === view.history?.headId)?.tool)?.name;

  async function run(action: () => Promise<void>) {
    setLocalError(null);
    try {
      await action();
      await app.refresh();
    } catch (cause) {
      setLocalError(errorMessage(cause));
    }
  }

  return (
    <Screen scroll>
      <Field
        label="Nombre"
        value={name || view.project.name}
        onChangeText={setName}
      />
      <Button
        label="Guardar nombre"
        tone="ghost"
        onPress={() =>
          void run(async () => {
            await renameProject(projectId, name || view.project.name);
            if (app.serverUp) {
              await app.ensureSession();
              await app.client().patchProject(projectId, { name: name || view.project.name });
            }
          })
        }
      />
      {localError ? <Banner tone="danger">{localError}</Banner> : null}
      {note ? <Banner>{note}</Banner> : null}
      {view.pending ? (
        <Banner tone="warn">Hay un resultado sin conservar.</Banner>
      ) : null}
      {shown ? (
        <>
          <Stage
            currentUri={shown.local_uri}
            originalUri={originalUri}
            mime={shown.mime}
            compare={compare}
            hold={hold}
            ratio={ratio}
          />
          <Muted>
            {shown.kind === 'original' ? 'Original' : disclosureLabel(shown.disclosure)}
            {toolName ? ` · ${toolName}` : ''}
          </Muted>
          <CompareBar
            compare={compare}
            onCompare={() => setCompare((value) => !value)}
            ratio={ratio}
            onRatio={setRatio}
            onHoldStart={() => setHold(true)}
            onHoldEnd={() => setHold(false)}
          />
        </>
      ) : (
        <Empty title="Sin foto" body="Importa desde la cámara o la galería. El original no se sustituye después." />
      )}
      {!original || original.bytes_deleted ? (
        <Row>
          <Button
            label="Cámara"
            onPress={() =>
              void run(async () => {
                const picked = await pickImage('camera');
                if (picked) await importOriginal(projectId, picked.uri, picked.width, picked.height);
              })
            }
          />
          <Button
            label="Galería"
            tone="violet"
            onPress={() =>
              void run(async () => {
                const picked = await pickImage('library');
                if (picked) await importOriginal(projectId, picked.uri, picked.width, picked.height);
              })
            }
          />
        </Row>
      ) : null}
      <Text style={styles.section}>Herramientas</Text>
      <View style={styles.grid}>
        {TOOL_CATALOG.map((tool) => (
          <Pressable
            key={tool.id}
            style={styles.tool}
            onPress={() => {
              const path = tool.id === 'animate' ? `/project/${projectId}/animate` : tool.id === 'reel' ? `/project/${projectId}/reel` : `/project/${projectId}/tool/${tool.id}`;
              router.push(path);
            }}
          >
            <Text style={styles.toolText}>{tool.name}</Text>
          </Pressable>
        ))}
      </View>
      <Row>
        <Button label="Deshacer" tone="ghost" onPress={() => void run(() => undoProject(projectId))} />
        <Button label="Rehacer" tone="ghost" onPress={() => void run(() => redoProject(projectId))} />
      </Row>
      <Row>
        <Button
          label="Reset del módulo"
          tone="ghost"
          onPress={() => {
            const tool = view.history ? lineage(view.history).at(-1)?.tool : null;
            if (!tool) {
              setLocalError('La versión actual no pertenece a un módulo.');
              return;
            }
            void run(() => resetProjectTool(projectId, tool));
          }}
        />
        <Button label="Reset total" tone="ghost" onPress={() => void run(() => resetProject(projectId))} />
      </Row>
      <Button label="Historial" tone="ghost" onPress={() => router.push(`/project/${projectId}/history`)} />
      {view.pending ? <Button label="Revisar resultado" onPress={() => router.push(`/project/${projectId}/review?op=${view.pending?.id}`)} /> : null}
      <Button
        label="Duplicar"
        tone="ghost"
        onPress={() =>
          void run(async () => {
            const copyId = await duplicateProject(projectId);
            router.push(`/project/${copyId}`);
          })
        }
      />
      <Button
        label="Exportar"
        disabled={!shown}
        onPress={() =>
          void run(async () => {
            if (!shown) return;
            if (app.serverUp) await app.ensureSession();
            const exported = await exportImage({
              client: app.serverUp ? app.client() : null,
              projectId,
              asset: shown,
              online: app.online && app.serverUp,
            });
            setNote(exported.note);
            const ready = await hydrateLocalUri(exported.uri);
            if (Platform.OS === 'web') downloadInBrowser(ready, shown.mime.startsWith('video/') ? 'lookstudio.mp4' : 'lookstudio.png');
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(ready, { mimeType: shown.mime.startsWith('video/') ? 'video/mp4' : 'image/png', dialogTitle: 'Exportar' });
            }
          })
        }
      />
      <Button
        label="Guardar en galería"
        tone="ghost"
        disabled={!shown}
        onPress={() =>
          void run(async () => {
            if (!shown) return;
            if (Platform.OS === 'web') {
              setNote('En el navegador usa Exportar. Guardar en la galería del teléfono está en Android e iOS.');
              return;
            }
            const media = await import('expo-media-library');
            const permission = await media.requestPermissionsAsync(true);
            if (!permission.granted) throw new Error('Hace falta permiso para guardar en la galería.');
            await media.Asset.create(shown.local_uri);
            setNote('Guardado en la galería del dispositivo.');
          })
        }
      />
      <Text style={styles.section}>Retención</Text>
      <Muted>El original no caduca solo. Las copias derivadas sí, si eliges un plazo.</Muted>
      <Row>
        {[
          { label: 'Nunca', days: null },
          { label: '7 días', days: 7 },
          { label: '30 días', days: 30 },
          { label: '90 días', days: 90 },
        ].map((option) => (
          <Button
            key={option.label}
            label={option.label}
            tone={view.project.retention_days === option.days ? 'accent' : 'ghost'}
            onPress={() =>
              void run(async () => {
                await setRetention(projectId, option.days);
                if (app.serverUp) {
                  await app.ensureSession();
                  await app.client().patchProject(projectId, { retentionDays: option.days });
                }
              })
            }
          />
        ))}
      </Row>
      {image ? <Muted>La última imagen usable sigue disponible aunque la cabeza sea un vídeo.</Muted> : null}
      {confirmOriginal ? (
        <Button label="Confirmar borrado del original" tone="danger" onPress={() => void run(() => deleteOriginalBytes(projectId).then(async () => {
          if (app.serverUp) {
            await app.ensureSession();
            await app.client().deleteOriginal(projectId);
          }
        }))} />
      ) : (
        <Button label="Borrar bytes del original" tone="danger" onPress={() => setConfirmOriginal(true)} />
      )}
      <Button
        label="Borrar proyecto"
        tone="ghost"
        onPress={() =>
          void run(async () => {
            if (app.serverUp) {
              await app.ensureSession();
              try {
                await app.client().deleteProject(projectId);
              } catch {
                // Puede no existir en el servidor.
              }
            }
            await deleteProject(projectId);
            router.replace('/projects');
          })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tool: { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  toolText: { color: colors.text, fontWeight: '700' },
});
