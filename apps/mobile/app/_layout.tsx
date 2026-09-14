import 'react-native-gesture-handler';
import { Text } from '@/components/localized-native';
import {
  QueryClient,
  QueryClientProvider,
  focusManager } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect,
  useState } from 'react';
import { AccessibilityInfo,
  AppState,
  StyleSheet,
  View,
} from '@/components/themed-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors, typography } from '@wapve/design-tokens';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ConnectivityGuard } from '@/lib/connectivity';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { CallProvider } from '@/lib/calls';
import { PushRegistration, PushStatusProvider } from '@/lib/push';
import { PresenceBridge } from '@/lib/presence';
import { RealtimeQuerySync } from '@/lib/realtime-sync';
import { DeveloperModeProvider } from '@/lib/developer-mode';
import { AppearanceProvider, useAppearance } from '@/lib/appearance';

function Routes() {
  const { palette } = useAppearance();
  const { ready } = useAuth();
  const { t } = useI18n();
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);
  if (!ready) return <View style={styles.loading}><Text style={styles.mark}>≈</Text><Text style={styles.loadingText}>{t('loading')}</Text></View>;
  return (
    <>
      <StatusBar style="light" />
      <ConnectivityGuard>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.ink }, animation: reduceMotion ? 'none' : 'fade_from_bottom' }} />
      </ConnectivityGuard>
    </>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 2 } } }));
  useEffect(() => {
    focusManager.setFocused(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });
    return () => {
      subscription.remove();
      focusManager.setFocused(undefined);
    };
  }, []);
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppearanceProvider><I18nProvider><AuthProvider><DeveloperModeProvider><PushStatusProvider><CallProvider><PushRegistration /><PresenceBridge /><RealtimeQuerySync /><Routes /></CallProvider></PushStatusProvider></DeveloperModeProvider></AuthProvider></I18nProvider></AppearanceProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  loading: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', gap: 12 },
  mark: { color: colors.waveBright, fontSize: 72, fontWeight: '900' },
  loadingText: { color: colors.textMuted, ...typography.body },
});
