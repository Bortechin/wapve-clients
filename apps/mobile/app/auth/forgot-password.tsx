import { Text } from '@/components/localized-native';
import {
  colors,
  spacing,
  typography } from '@wapve/design-tokens';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet,
  View,
} from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { Button, Field } from '@/components/ui';
import { api } from '@/lib/client';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  async function submit() { setLoading(true); setError(''); try { await api.request('/auth/password/forgot', { method: 'POST', authenticated: false, body: { email } }); setSent(true); } catch { setError('Bağlantı gönderilemedi. Ağını kontrol edip tekrar dene.'); } finally { setLoading(false); } }
  return <SafeAreaView style={styles.root}><View style={styles.content}><Text style={styles.mark}>≈</Text><Text style={styles.title}>Parolanı yenile</Text><Text style={styles.body}>{sent ? 'E-posta adresi kayıtlıysa yenileme bağlantısını gönderdik.' : 'Hesabına bağlı e-posta adresini yaz.'}</Text>{sent ? null : <Field label="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />}{error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}<Button label={sent ? 'Girişe dön' : 'Bağlantı gönder'} loading={loading} disabled={!sent && !email.trim()} onPress={() => sent ? router.replace('/auth/login') : void submit()} /><Button label="Geri" variant="ghost" onPress={() => router.back()} /></View></SafeAreaView>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.ink }, content: { flex: 1, justifyContent: 'center', gap: spacing.lg, padding: spacing.xl }, mark: { color: colors.waveBright, fontSize: 64, fontWeight: '900' }, title: { color: colors.text, ...typography.title }, body: { color: colors.textMuted, ...typography.body }, error: { color: colors.danger, ...typography.caption } });
