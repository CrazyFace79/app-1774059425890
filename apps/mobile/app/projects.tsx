import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Banner, Button, Empty, Muted, Screen, Title } from '../src/components/ui';
import { useApp } from '../src/context/AppContext';
import { errorMessage } from '../src/pure/flow';
import { deleteProject } from '../src/storage/library';
import { colors } from '../src/theme';

export default function ProjectsScreen() {
  const app = useApp();
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    setError(null);
    try {
      if (app.serverUp) {
        await app.ensureSession();
        try {
          await app.client().deleteProject(id);
        } catch {
          // El proyecto puede no haber llegado al servidor.
        }
      }
      await deleteProject(id);
      await app.refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  return (
    <Screen scroll>
      <Title>Proyectos</Title>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {app.projects.length === 0 ? <Empty title="Sin proyectos" body="Crea uno desde el inicio e importa una foto." /> : null}
      {app.projects.map((project) => (
        <Pressable key={project.id} style={styles.card} onPress={() => router.push(`/project/${project.id}`)}>
          <Text style={styles.name}>{project.name}</Text>
          <Muted>{new Date(project.updated_at).toLocaleString('es')}</Muted>
          <Button label="Borrar proyecto y archivos" tone="danger" onPress={() => void remove(project.id)} />
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 14, gap: 8 },
  name: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
