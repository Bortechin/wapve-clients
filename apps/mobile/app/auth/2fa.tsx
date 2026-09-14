import { Text } from '@/components/localized-native';
import {
  ApiError } from '@wapve/api-client';
import { colors,
  spacing,
  typography } from '@wapve/design-tokens';
import { router,
  useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { Button, Field } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { safeReturnPath } from '@/lib/deep-links';

export default function TwoFactorScreen() {
  const { challengeToken, redirect } = useLocalSearchParams<{ challengeToken: string; redirect?: string | string[] }>();
  const returnPath = safeReturnPath(redirect);
  const { completeTwoFactor } = useAuth();
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    if (!challengeToken) return;
    setLoading(true);
    setError('');
    try {
      await completeTwoFactor(challengeToken, code);
      router.replace(returnPath ?? '/(tabs)');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.messageKey : 'Kod doğrulanamadı.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.mark}>≈</Text>
        <Text style={styles.title}>{t('twoFactor')}</Text>
        <Text style={styles.body}>
          Kimliğini doğrulamak için uygulamadaki kodu ya da kurtarma kodlarından birini gir.
        </Text>
        <Field
          label={t('code')}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoFocus
          onSubmitEditing={() => void submit()}
          error={error}
        />
        <Button
          label={t('continue')}
          loading={loading}
          disabled={code.trim().length < 6}
          onPress={() => void submit()}
        />
        <Button label="Geri" variant="ghost" onPress={() => router.back()} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  mark: { color: colors.waveBright, fontSize: 64, fontWeight: '900' },
  title: { color: colors.text, ...typography.title },
  body: { color: colors.textMuted, ...typography.body },
});
