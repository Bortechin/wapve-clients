import { Text } from '@/components/localized-native';
import {
  colors,
  spacing,
  typography } from '@wapve/design-tokens';
import { router,
  useLocalSearchParams } from 'expo-router';
import { useEffect,
  useRef,
  useState } from 'react';
import { StyleSheet,
  View,
} from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/client';

export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { user, refreshUser } = useAuth();
  const started = useRef(false);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    setState('loading');
    void api.request('/auth/email-verification/confirm', { method: 'POST', authenticated: false, body: { token } })
      .then(async () => { setState('success'); if (user) await refreshUser(); })
      .catch(() => setState('error'));
  }, [refreshUser, token, user]);
  async function resend() {
    if (!user) return;
    await api.request('/auth/email-verification/resend', { method: 'POST' });
    setSent(true);
  }
  const message = state === 'loading' ? 'Bağlantı doğrulanıyor…' : state === 'success' ? 'E-posta adresin doğrulandı.' : state === 'error' ? 'Bu bağlantı geçersiz veya süresi dolmuş.' : user?.emailVerified ? 'E-posta adresin zaten doğrulanmış.' : 'Doğrulama e-postasındaki bağlantıyı aç.';
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        <Text style={styles.mark}>≈</Text><Text style={styles.title}>E-posta doğrulama</Text><Text style={styles.body}>{message}</Text>
        {sent ? <Text style={styles.success}>Yeni doğrulama bağlantısı gönderildi.</Text> : null}
        {user && !user.emailVerified && state !== 'success' ? <Button label="Bağlantıyı yeniden gönder" variant="secondary" onPress={() => void resend()} /> : null}
        <Button label={user ? 'Wapve’ye dön' : 'Giriş yap'} onPress={() => router.replace(user ? '/(tabs)' : '/auth/login')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.ink }, content: { flex: 1, justifyContent: 'center', gap: spacing.lg, padding: spacing.xl }, mark: { color: colors.waveBright, fontSize: 64, fontWeight: '900' }, title: { color: colors.text, ...typography.title }, body: { color: colors.textMuted, ...typography.body }, success: { color: colors.success, ...typography.body } });
