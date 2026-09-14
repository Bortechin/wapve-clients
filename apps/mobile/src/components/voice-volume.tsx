import { Text } from '@/components/localized-native';
import {
  colors,
  radius,
  spacing,
  typography } from '@wapve/design-tokens';
import { useState } from 'react';
import { StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from '@/components/themed-native';
import { Icon } from './icon';
import { useI18n } from '@/lib/i18n';

export function VoiceVolume({ name, value, onChange, compact = false }: { name: string; value: number; onChange(value: number): void; compact?: boolean }) {
  const [width, setWidth] = useState(1);
  const { translateLiteral } = useI18n();
  function update(event: GestureResponderEvent) {
    const next = Math.max(0, Math.min(1, event.nativeEvent.locationX / width));
    onChange(Math.round(next * 100) / 100);
  }
  function adjust(direction: -1 | 1) { onChange(Math.max(0, Math.min(1, Math.round((value + direction * 0.1) * 100) / 100))); }
  function layout(event: LayoutChangeEvent) { setWidth(Math.max(1, event.nativeEvent.layout.width)); }
  return (
    <View
      style={[styles.root, compact && styles.compact]}
      accessibilityRole="adjustable"
      accessibilityLabel={translateLiteral(`${name} ses seviyesi`)}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100), text: `%${Math.round(value * 100)}` }}
      accessibilityActions={[{ name: 'increment', label: translateLiteral('Sesi artır') }, { name: 'decrement', label: translateLiteral('Sesi azalt') }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') adjust(1);
        else if (event.nativeEvent.actionName === 'decrement') adjust(-1);
      }}
    >
      <Icon name={value === 0 ? 'volume-off' : 'volume-high'} color={colors.waveBright} size={compact ? 14 : 17} />
      <View style={styles.track} onLayout={layout} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderGrant={update} onResponderMove={update}>
        <View style={[styles.fill, { width: `${value * 100}%` }]} />
        <View style={[styles.thumb, { left: `${value * 100}%` }]} />
      </View>
      <Text style={styles.value}>{Math.round(value * 100)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { minHeight: 38, minWidth: 176, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  compact: { position: 'absolute', left: spacing.xs, right: spacing.xs, bottom: spacing.xs, minWidth: 0, backgroundColor: colors.overlay },
  track: { flex: 1, height: 28, justifyContent: 'center' },
  fill: { height: 4, borderRadius: radius.pill, backgroundColor: colors.waveBright },
  thumb: { position: 'absolute', width: 14, height: 14, marginLeft: -7, borderRadius: 7, backgroundColor: colors.text, borderWidth: 2, borderColor: colors.wave },
  value: { width: 36, color: colors.text, ...typography.caption, fontWeight: '700', textAlign: 'right' },
});
