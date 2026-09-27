import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { TOOL_CATALOG } from '@lookstudio/domain';
import { Banner, Button, Field, Muted, Row, Screen, Title } from '../src/components/ui';
import { useApp } from '../src/context/AppContext';
import { errorMessage } from '../src/pure/flow';
import { pickImage } from '../src/services/picker';
import { createProject, importOriginal } from '../src/storage/library';
import { colors } from '../src/theme';

export default function HomeScreen() {
  const app = useApp();
  const [name, setName] = useState('Retrato');
  const [error, setError] = useState<string | null>(null);
  const active = app.projects[0] ?? null;

  async function startBlank() {
    const project = await createProject(name);
    await app.refresh();
    router.push(`/project/${project.id}`);
  }

  async function startWith(source: 'camera' | 'library') {
    setError(null);
    try {
      const picked = await pickImage(source);
      if (!picked) return;
      const project = await createProject(name);
      await importOriginal(project.id, picked.uri, picked.width, picked.height);
      await app.refresh();
      router.push(`/project/${project.id}`);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  return (
    <Screen scroll>
      <Title>Estudio</Title>
      <Muted>Un proyecto, una foto original y ediciones que no se aplican hasta que las conservas.</Muted>
      {app.capabilities?.providers.edit.generative === false ? (
        <Banner>El motor de imagen conectado es local y procedural. No es un modelo generativo.</Banner>
      ) : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Field label="Nombre del proyecto" value={name} onChangeText={setName} />
      <Button label="Nuevo proyecto" onPress={() => void startBlank()} />
      <Row>
        <Button label="Cámara" tone="ghost" onPress={() => void startWith('camera')} />
        <Button label="Galería" tone="ghost" onPress={() => void startWith('library')} />
      </Row>
      <Text style={styles.section}>Herramientas</Text>
      {active ? <Muted>Se abren en {active.name}.</Muted> : <Muted>Crea un proyecto para usarlas.</Muted>}
      <View style={styles.grid}>
        {TOOL_CATALOG.map((tool) => (
          <Pressable
            key={tool.id}
            style={styles.card}
            onPress={() => {
              if (!active) {
                setError('Crea un proyecto e importa una foto.');
                return;
              }
              const path =
                tool.id === 'animate' ? `/project/${active.id}/animate` : tool.id === 'reel' ? `/project/${active.id}/reel` : `/project/${active.id}/tool/${tool.id}`;
              router.push(path);
            }}
          >
            <Text style={styles.emoji}>{tool.emoji}</Text>
            <Text style={styles.cardTitle}>{tool.name}</Text>
            <Text style={styles.cardBody}>{tool.description}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.section}>Recientes</Text>
      {app.projects.length === 0 ? <Muted>Todavía no hay proyectos.</Muted> : null}
      {app.projects.slice(0, 6).map((project) => (
        <Pressable key={project.id} style={styles.recent} onPress={() => router.push(`/project/${project.id}`)}>
          <Text style={styles.cardTitle}>{project.name}</Text>
          <Muted>{new Date(project.updated_at).toLocaleString('es')}</Muted>
        </Pressable>
      ))}
      <Row>
        <Button label="Todos los proyectos" tone="ghost" onPress={() => router.push('/projects')} />
        <Button label="Ajustes" tone="ghost" onPress={() => router.push('/settings')} />
      </Row>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '47%', backgroundColor: colors.surface, borderRadius: 16, padding: 12, gap: 4 },
  emoji: { fontSize: 22 },
  cardTitle: { color: colors.text, fontWeight: '700' },
  cardBody: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  recent: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, gap: 4 },
});
