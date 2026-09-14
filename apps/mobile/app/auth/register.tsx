import { Text } from '@/components/localized-native';
import { ApiError } from '@wapve/api-client';
import { colors, radius, spacing, typography } from '@wapve/design-tokens';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { Button, Field } from '@/components/ui';
import { api } from '@/lib/client';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

export default function RegisterScreen() {
  const { locale } = useI18n();
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({ email: '', username: '', displayName: '', password: '', birthDay: '', birthMonth: '', birthYear: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  async function submit() {
    setLoading(true);
    setError('');
    try {
      const { birthDay, birthMonth, birthYear, ...identity } = form;
      await api.register({
        ...identity,
        birthDate: `${birthYear.padStart(4, '0')}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`,
        locale,
      });
      await refreshUser();
      router.replace('/(tabs)');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.messageKey : 'Hesap oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.mark}>≈ WAPVE</Text>
          <Text style={styles.title}>Kendi dalganı başlat.</Text>
          <Field
            label="E-posta"
            value={form.email}
            onChangeText={set('email')}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label="Kullanıcı adı"
            value={form.username}
            onChangeText={set('username')}
            autoCapitalize="none"
          />
          <Field label="Görünen ad" value={form.displayName} onChangeText={set('displayName')} />
          <Text style={styles.label}>Doğum tarihi</Text>
          <View style={styles.dateRow}>
            <Field label="Gün" value={form.birthDay} onChangeText={set('birthDay')} keyboardType="number-pad" maxLength={2} placeholder="GG" />
            <Field label="Ay" value={form.birthMonth} onChangeText={set('birthMonth')} keyboardType="number-pad" maxLength={2} placeholder="AA" />
            <Field label="Yıl" value={form.birthYear} onChangeText={set('birthYear')} keyboardType="number-pad" maxLength={4} placeholder="YYYY" />
          </View>
          <View>
            <Field
              label="Parola"
              value={form.password}
              onChangeText={set('password')}
              secureTextEntry={!showPassword}
              maxLength={32}
            />
            <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Parolayı gizle' : 'Parolayı göster'} onPress={() => setShowPassword((value) => !value)} style={styles.passwordToggle}>
              <Text style={styles.passwordToggleText}>{showPassword ? 'Gizle' : 'Göster'}</Text>
            </Pressable>
            <Text style={styles.passwordHint}>9–32 karakter · {form.password.length}/32</Text>
          </View>
          <Text style={styles.error}>{error}</Text>
          <Button label="Hesap oluştur" loading={loading} onPress={() => void submit()} />
          <Button label="Girişe dön" variant="ghost" onPress={() => router.back()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.md },
  mark: { color: colors.waveBright, ...typography.heading, marginTop: spacing.xl },
  title: { color: colors.text, ...typography.title },
  label: { color: colors.textMuted, ...typography.caption, fontWeight: '700' },
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  passwordToggle: { position: 'absolute', right: spacing.sm, top: 28, padding: spacing.sm },
  passwordToggleText: { color: colors.waveBright, ...typography.caption, fontWeight: '700' },
  passwordHint: { color: colors.textDim, ...typography.caption, marginTop: 4 },
  error: { color: colors.danger, ...typography.caption, minHeight: 16 },
  card: { borderRadius: radius.lg },
});
