import { Text, Pressable } from '@/components/localized-native';
import { colors, radius, spacing, typography } from '@wapve/design-tokens';
import { Image } from 'expo-image';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { Button, Field } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { safeReturnPath } from '@/lib/deep-links';
import { loginErrorMessage } from '@/lib/login-errors';

const waveMark = require('../../../web/public/brand/wapve-wave-mark-v2.png') as number;

export default function LoginScreen() {
  const { redirect } = useLocalSearchParams<{ redirect?: string | string[] }>();
  const returnPath = safeReturnPath(redirect);
  const { login, loginWithPasskey } = useAuth();
  const { t, locale } = useI18n();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const pending = useRef(false);

  async function submit() {
    if (pending.current || !identifier.trim() || !password) return;
    pending.current = true;
    setLoading(true);
    setError('');
    try {
      const result = await login(identifier, password);
      if (result.challengeToken) {
        router.push({
          pathname: '/auth/2fa',
          params: {
            challengeToken: result.challengeToken,
            ...(returnPath ? { redirect: returnPath } : {}),
          },
        });
      } else if (result.emailApprovalRequired) {
        setError(
          'Bu cihazı doğrulamak için e-postana gönderdiğimiz bağlantıyı aç, sonra yeniden giriş yap.',
        );
      } else {
        router.replace(returnPath ?? '/(tabs)');
      }
    } catch (cause) {
      setError(loginErrorMessage(cause, locale));
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  async function passkeyLogin() {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setError('');
    try {
      await loginWithPasskey();
      router.replace(returnPath ?? '/(tabs)');
    } catch (cause) {
      setError(loginErrorMessage(cause, locale, true));
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <View style={styles.logoGlow}>
              <Image source={waveMark} style={styles.logo} contentFit="contain" />
            </View>
            <Text style={styles.wordmark}>WAPVE</Text>
            <Text style={styles.alpha}>YAYINDA</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.title}>{t('welcome')}</Text>
            <Text style={styles.subtitle}>
              Arkadaşların, grupların ve sunucuların seni bekliyor.
            </Text>
            <Field
              testID="login.identifier"
              label={t('identifier')}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              autoComplete="username"
              importantForAutofill="yes"
            />
            <Field
              testID="login.password"
              label={t('password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              importantForAutofill="yes"
              textContentType="password"
              onSubmitEditing={() => void submit()}
            />
            <Button label={showPassword ? (locale === 'tr' ? 'Şifreyi gizle' : 'Hide password') : (locale === 'tr' ? 'Şifreyi göster' : 'Show password')} variant="ghost" onPress={() => setShowPassword((value) => !value)} />
            {error ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/auth/forgot-password')}
            >
              <Text style={styles.link}>{t('forgotPassword')}</Text>
            </Pressable>
            <Button
              testID="login.submit"
              label={t('login')}
              loading={loading}
              disabled={!identifier.trim() || !password}
              onPress={() => void submit()}
            />
            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.or}>veya</Text>
              <View style={styles.line} />
            </View>
            <Button
              label="Passkey ile giriş"
              variant="secondary"
              disabled={loading}
              onPress={() => void passkeyLogin()}
            />
            {Platform.OS === 'android' && <Button
              label={locale === 'tr' ? 'Parola sağlayıcısı ayarları' : 'Password provider settings'}
              variant="ghost"
              disabled={loading}
              onPress={() => {
                void import('../../modules/wapve-credentials')
                  .then(({ default: credentials }) => credentials.openProviderSettings())
                  .catch((cause: unknown) => setError(loginErrorMessage(cause, locale, true)));
              }}
            />}
            <Text style={styles.register}>
              {t('noAccount')}{' '}
              <Link href="/auth/register" style={styles.link}>
                {t('register')}
              </Link>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.xl },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  logoGlow: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceRaised,
    shadowColor: colors.wave,
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 10,
  },
  logo: { width: 72, height: 72 },
  wordmark: { color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: 2.2 },
  alpha: {
    color: colors.cyan,
    fontSize: 9,
    fontWeight: '900',
    borderWidth: 1,
    borderColor: colors.wave,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  card: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { color: colors.text, ...typography.title },
  subtitle: { color: colors.textMuted, ...typography.body, marginBottom: spacing.sm },
  error: { color: colors.danger, ...typography.caption },
  link: { color: colors.waveBright, ...typography.label },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  or: { color: colors.textDim, ...typography.caption },
  register: {
    color: colors.textMuted,
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
