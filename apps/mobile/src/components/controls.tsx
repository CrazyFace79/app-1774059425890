import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { Control } from '@lookstudio/domain';
import { colors, space } from '../theme';
import { Field } from './ui';

export function TrackSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const [width, setWidth] = useState(1);
  const ratio = max === min ? 0 : (value - min) / (max - min);
  return (
    <View style={styles.block}>
      <Text style={styles.label}>
        {label}: {Number(value.toFixed(2))}
      </Text>
      <Pressable
        onLayout={(event) => setWidth(Math.max(1, event.nativeEvent.layout.width))}
        onPress={(event) => {
          const raw = min + (event.nativeEvent.locationX / width) * (max - min);
          const stepped = Math.round(raw / step) * step;
          const next = Math.min(max, Math.max(min, stepped));
          onChange(Number(next.toFixed(4)));
        }}
        style={styles.track}
      >
        <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, ratio * 100))}%` }]} />
      </Pressable>
    </View>
  );
}

export function ControlList({
  controls,
  values,
  onChange,
  customColor,
  onCustomColor,
}: {
  controls: Control[];
  values: Record<string, number | string | boolean>;
  onChange: (key: string, value: number | string) => void;
  customColor: string;
  onCustomColor: (value: string) => void;
}) {
  return (
    <View style={styles.block}>
      {controls.map((control) => {
        if (control.kind === 'slider') {
          const current = typeof values[control.key] === 'number' ? (values[control.key] as number) : control.defaultValue;
          return (
            <TrackSlider
              key={control.key}
              label={control.label}
              value={current}
              min={control.min}
              max={control.max}
              step={control.step}
              onChange={(value) => onChange(control.key, value)}
            />
          );
        }
        const current = typeof values[control.key] === 'string' ? (values[control.key] as string) : control.defaultValue;
        return (
          <View key={control.key} style={styles.block}>
            <Text style={styles.label}>{control.label}</Text>
            <View style={styles.wrap}>
              {control.options.map((option) => (
                <Pressable key={option.id} onPress={() => onChange(control.key, option.id)} style={[styles.option, current === option.id && styles.optionOn]}>
                  {option.swatch ? <View style={[styles.swatch, { backgroundColor: option.swatch }]} /> : null}
                  <Text style={[styles.optionText, current === option.id && styles.optionTextOn]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            {current === 'custom' ? <Field label="Color hex" value={customColor} onChangeText={onCustomColor} placeholder="#D6B05C" /> : null}
          </View>
        );
      })}
    </View>
  );
}

export function LockRow({ value, onChange, warning }: { value: boolean; onChange: (value: boolean) => void; warning: string | null }) {
  return (
    <View style={styles.lock}>
      <View style={styles.lockHead}>
        <Text style={styles.lockTitle}>Identity Lock</Text>
        <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.line }} thumbColor={colors.text} />
      </View>
      <Text style={styles.help}>{value ? 'Activo. La edición conserva la identidad y las zonas protegidas.' : 'Relajado. El cambio sigue siendo reversible hasta que lo conserves.'}</Text>
      {warning ? <Text style={styles.warn}>{warning}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  label: { color: colors.muted, fontSize: 13 },
  track: { height: 28, borderRadius: 999, backgroundColor: colors.surface2, justifyContent: 'center', overflow: 'hidden' },
  fill: { height: 28, backgroundColor: colors.accent },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  optionOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  optionText: { color: colors.text, fontSize: 13 },
  optionTextOn: { color: colors.ink, fontWeight: '700' },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  lock: { backgroundColor: colors.surface, borderRadius: 16, padding: space.md, gap: 8 },
  lockHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lockTitle: { color: colors.text, fontWeight: '700', fontSize: 16 },
  help: { color: colors.muted, lineHeight: 20 },
  warn: { color: colors.violet, lineHeight: 20 },
});
