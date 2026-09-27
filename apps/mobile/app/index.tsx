import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../src/context/AppContext';
import { colors } from '../src/theme';

export default function Index() {
  const app = useApp();
  if (!app.ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (app.bootError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{app.bootError}</Text>
      </View>
    );
  }
  if (!app.consent) return <Redirect href="/consent" />;
  return <Redirect href="/home" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: colors.danger, textAlign: 'center' },
});
