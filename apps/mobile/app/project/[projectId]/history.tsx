import { Pressable, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { lineage } from '@lookstudio/domain';
import { Banner, Button, Loading, Muted, Screen, Title } from '../../../src/components/ui';
import { useApp } from '../../../src/context/AppContext';
import { useProject } from '../../../src/hooks/useProject';
import { disclosureLabel, errorMessage, oneParam } from '../../../src/pure/flow';
import { jumpProject, redoProject, resetProject, undoProject } from '../../../src/storage/library';
import { colors } from '../../../src/theme';
import { useState } from 'react';

export default function HistoryScreen() {
  const projectId = oneParam(useLocalSearchParams<{ projectId: string }>().projectId);
  const app = useApp();
  const { view, loading } = useProject(projectId);
  const [error, setError] = useState<string | null>(null);

  if (loading || !view) return <Loading label="Cargando historial…" />;
  if (!view.history) return <Screen><Banner>Importa una foto para crear la versión original.</Banner></Screen>;

  const trail = new Set(lineage(view.history).map((node) => node.id));

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
      await app.refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  return (
    <Screen scroll>
      <Title>Versiones</Title>
      <Muted>Deshacer no borra nodos. Puedes saltar a una rama anterior y seguir desde ahí.</Muted>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Button label="Deshacer" tone="ghost" onPress={() => void run(() => undoProject(projectId))} />
      <Button label="Rehacer" tone="ghost" onPress={() => void run(() => redoProject(projectId))} />
      <Button label="Volver al original" tone="ghost" onPress={() => void run(() => resetProject(projectId))} />
      {view.history.nodes.map((node) => {
        const asset = view.assets.find((item) => item.id === node.assetId);
        const current = node.id === view.history?.headId;
        return (
          <Pressable key={node.id} style={[styles.card, current && styles.current]} onPress={() => void run(() => jumpProject(projectId, node.id))}>
            <Text style={styles.label}>{node.label}{current ? ' · actual' : ''}{trail.has(node.id) ? '' : ' · otra rama'}</Text>
            <Muted>{asset ? disclosureLabel(asset.disclosure) : 'Archivo no disponible'}</Muted>
          </Pressable>
        );
      })}
      <Title>Operaciones</Title>
      {view.operations.length === 0 ? <Muted>Todavía no hay trabajos.</Muted> : null}
      {view.operations.map((operation) => (
        <Pressable key={operation.id} style={styles.card}>
          <Text style={styles.label}>{operation.tool} · {operation.preset_id} · {operation.status}</Text>
          <Muted>{operation.summary || operation.prompt || 'Sin resumen'}</Muted>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, gap: 4 },
  current: { borderWidth: 1, borderColor: colors.accent },
  label: { color: colors.text, fontWeight: '700' },
});
