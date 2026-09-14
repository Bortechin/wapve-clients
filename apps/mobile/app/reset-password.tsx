import { Text } from '@/components/localized-native';
import {
  colors,
  spacing,
  typography } from '@wapve/design-tokens';
import { router,
  useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet,
  View,
} from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { Button, Field } from '@/components/ui';
import { api } from '@/lib/client';

export default function ResetPasswordScreen() {
  const { token = '' } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    if (!token || password !== confirmation) return;
    setLoading(true); setError('');
    try {
      await api.request('/auth/password/reset', { method: 'POST', authenticated: false, body: { token, password } });
      setDone(true);
    } catch {
      setError('Bağlantı geçersiz, süresi dolmuş veya parola güvenlik koşullarını karşılamıyor.');
    } finally { setLoading(false); }
  }
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        <Text style={styles.mark}>≈</Text><Text style={styles.title}>Yeni parola belirle</Text>
        {done ? <Text style={styles.success}>Parolan yenilendi. Diğer açık oturumlar kapatıldı.</Text> : (
          <><Text style={styles.body}>En az 10 karakterli, hesabından farklı ve güçlü bir parola kullan.</Text><Field label="Yeni parola" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" /><Field label="Yeni parola tekrar" value={confirmation} onChangeText={setConfirmation} secureTextEntry textContentType="newPassword" />{confirmation && password !== confirmation ? <Text style={styles.error}>Parolalar eşleşmiyor.</Text> : null}{error ? <Text style={styles.error}>{error}</Text> : null}</>
        )}
        <Button label={done ? 'Giriş yap' : 'Parolayı yenile'} loading={loading} disabled={!done && (!token || password.length < 10 || password !== confirmation)} onPress={() => done ? router.replace('/auth/login') : void submit()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.ink }, content: { flex: 1, justifyContent: 'center', gap: spacing.lg, padding: spacing.xl }, mark: { color: colors.waveBright, fontSize: 64, fontWeight: '900' }, title: { color: colors.text, ...typography.title }, body: { color: colors.textMuted, ...typography.body }, success: { color: colors.success, ...typography.body }, error: { color: colors.danger, ...typography.caption } });
