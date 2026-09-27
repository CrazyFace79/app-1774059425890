import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider, useApp } from '../src/context/AppContext';
import { colors } from '../src/theme';

function Shell() {
  const app = useApp();
  return (
    <View style={styles.fill}>
      {app.ready && !app.online ? <Text style={styles.offline}>Sin conexión. Puedes revisar proyectos. Generar y sellar necesitan la API.</Text> : null}
      {app.ready && app.online && !app.serverUp ? (
        <Text style={styles.offline}>La API no responde en {app.apiUrl}. Arranca el servidor o cambia la URL en Ajustes.</Text>
      ) : null}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="consent" options={{ title: 'Privacidad' }} />
        <Stack.Screen name="home" options={{ title: 'AI Look Studio' }} />
        <Stack.Screen name="projects" options={{ title: 'Proyectos' }} />
        <Stack.Screen name="settings" options={{ title: 'Ajustes' }} />
        <Stack.Screen name="privacy" options={{ title: 'Datos' }} />
        <Stack.Screen name="project/[projectId]/index" options={{ title: 'Editor' }} />
        <Stack.Screen name="project/[projectId]/tool/[tool]" options={{ title: 'Herramienta' }} />
        <Stack.Screen name="project/[projectId]/mask" options={{ title: 'Máscara' }} />
        <Stack.Screen name="project/[projectId]/review" options={{ title: 'Revisión' }} />
        <Stack.Screen name="project/[projectId]/history" options={{ title: 'Historial' }} />
        <Stack.Screen name="project/[projectId]/animate" options={{ title: 'Animar' }} />
        <Stack.Screen name="project/[projectId]/reel" options={{ title: 'Reel' }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.fill}>
      <AppProvider>
        <StatusBar style="light" />
        <Shell />
      </AppProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  offline: { color: colors.ink, backgroundColor: colors.violet, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
});
