import { Text, Pressable } from '@/components/localized-native';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, StyleSheet, View } from '@/components/themed-native';
import { colors, radius, spacing, typography } from '@wapve/design-tokens';
import { useI18n } from './i18n';

const offlineLines = [
  'Sinyali arıyoruz…',
  'Dalgalar bazen kıyıdan uzaklaşır.',
  'Bağlantı gelince mesajların burada olacak.',
];

export function ConnectivityGuard({ children }: PropsWithChildren) {
  const { t } = useI18n();
  const [online, setOnline] = useState<boolean | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
      }),
    [],
  );
  useEffect(() => {
    if (online !== false) return;
    const timer = setInterval(() => {
      setAttempt((value) => value + 1);
      void NetInfo.refresh();
    }, 30_000);
    return () => clearInterval(timer);
  }, [online]);
  useEffect(
    () =>
      AppState.addEventListener('change', (state) => {
        if (state === 'active') void NetInfo.refresh();
      }).remove,
    [],
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>{children}</View>
      {online === false && (
        <View
          style={{
            backgroundColor: colors.surfaceRaised,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Text style={{ flex: 1, color: colors.textMuted, ...typography.caption }}>
            {t('offlineTitle')} · {offlineLines[attempt % offlineLines.length]}
          </Text>
          <Pressable
            style={{ minHeight: 48, minWidth: 48, justifyContent: 'center' }}
            onPress={() => void NetInfo.refresh()}
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>{t('retry')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  offline: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  orbitOuter: {
    width: 142,
    height: 142,
    borderRadius: 71,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    marginBottom: spacing.xl,
  },
  orbitInner: {
    flex: 1,
    borderRadius: 60,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.wave,
  },
  wave: { color: colors.waveBright, fontSize: 58, fontWeight: '800' },
  title: { color: colors.text, ...typography.title, marginBottom: spacing.sm },
  body: { color: colors.textMuted, ...typography.body, textAlign: 'center', maxWidth: 340 },
  random: { color: colors.cyan, ...typography.caption, marginTop: spacing.lg },
  retry: {
    minHeight: 48,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.wave,
  },
  retryText: { color: colors.text, ...typography.label },
  caption: { color: colors.textDim, ...typography.caption, marginTop: spacing.sm },
});
