import { Text } from '@/components/localized-native';
import {
  router } from 'expo-router';
import { StyleSheet,
  View,
} from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { colors, spacing, typography } from '@wapve/design-tokens';
import { Button } from '@/components/ui';
export default function QrSuccessScreen() { return <SafeAreaView style={styles.root}><View style={styles.content}><Text style={styles.icon}>✓</Text><Text style={styles.title}>Bilgisayar hazır.</Text><Text style={styles.body}>Wapve oturumunu güvenli biçimde onayladın. Bu kod tekrar kullanılamaz.</Text><Button label="Sohbetlere dön" onPress={() => router.replace('/(tabs)')} /></View></SafeAreaView>; }
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.ink }, content: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg, alignItems: 'center' }, icon: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.success, color: colors.text, textAlign: 'center', textAlignVertical: 'center', fontSize: 54, fontWeight: '900' }, title: { color: colors.text, ...typography.title }, body: { color: colors.textMuted, ...typography.body, textAlign: 'center' } });
