import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space } from '../theme';

export function Screen({ children, scroll = false }: { children: ReactNode; scroll?: boolean }) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={styles.fill}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      {body}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: string }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Banner({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'danger'; children: string }) {
  return (
    <View style={[styles.banner, tone === 'warn' && styles.bannerWarn, tone === 'danger' && styles.bannerDanger]}>
      <Text style={styles.bannerText}>{children}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled = false,
  tone = 'accent',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'accent' | 'ghost' | 'danger' | 'violet';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, tone === 'ghost' && styles.ghost, tone === 'danger' && styles.danger, tone === 'violet' && styles.violet, disabled && styles.disabled]}
    >
      <Text style={[styles.buttonText, tone === 'accent' && styles.buttonTextInk, tone === 'violet' && styles.buttonTextInk]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipOn]}>
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Muted>{body}</Muted>
    </View>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent} />
      <Muted>{label}</Muted>
    </View>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1, padding: space.md, gap: space.sm },
  scroll: { padding: space.md, gap: space.sm },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  banner: { backgroundColor: colors.surface2, borderRadius: 12, padding: space.sm, borderWidth: 1, borderColor: colors.line },
  bannerWarn: { borderColor: colors.violet },
  bannerDanger: { borderColor: colors.danger },
  bannerText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  button: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' },
  ghost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  danger: { backgroundColor: colors.danger },
  violet: { backgroundColor: colors.violet },
  disabled: { opacity: 0.45 },
  buttonText: { color: colors.text, fontWeight: '700' },
  buttonTextInk: { color: colors.ink },
  field: { gap: 6 },
  label: { color: colors.muted, fontSize: 13 },
  input: { backgroundColor: colors.surface, color: colors.text, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.line },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 13 },
  chipTextOn: { color: colors.ink, fontWeight: '700' },
  empty: { padding: space.lg, gap: space.sm, backgroundColor: colors.surface, borderRadius: 16 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  loading: { alignItems: 'center', gap: space.sm, padding: space.lg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
