import { Text } from '@/components/localized-native';
import {
  router } from 'expo-router';
import { StyleSheet,
  View,
} from '@/components/themed-native';
import { colors, spacing, typography } from '@wapve/design-tokens';
import { Button } from '@/components/ui';

export default function NotFound() {
  return <View style={styles.root}><Text style={styles.mark}>≈?</Text><Text style={styles.title}>Bu dalgayı bulamadık.</Text><Button label="Wapve’ye dön" onPress={() => router.replace('/')} /></View>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl }, mark: { color: colors.waveBright, fontSize: 64, fontWeight: '900' }, title: { color: colors.text, ...typography.title } });
