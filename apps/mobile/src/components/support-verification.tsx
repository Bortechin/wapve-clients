import { useEffect, useState } from 'react';
import { WebView } from 'react-native-webview';
import { useI18n } from '@/lib/i18n';
import { apiUrl } from '@/lib/client';
import { supportVerificationHtml } from '@/lib/support-verification-page';
import { View, ActivityIndicator } from './themed-native';
import { Text } from './localized-native';
import { Button } from './ui';
import { colors } from '@wapve/design-tokens';

export function SupportVerification({ onToken, resetKey }: {
  onToken(token: string): void;
  resetKey: number;
}) {
  const { locale } = useI18n();
  const origin = new URL(apiUrl).origin;
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setHtml(null);
    setFailed(false);
    onToken('');
    void fetch(`${apiUrl}/support/config`, { signal: controller.signal, credentials: 'omit' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Support config unavailable');
        const config = await response.json() as { ready?: boolean; enabled?: boolean; turnstileSiteKey?: string };
        if (!config.ready || !config.enabled || !config.turnstileSiteKey) throw new Error('Verification unavailable');
        if (!controller.signal.aborted) setHtml(supportVerificationHtml(config.turnstileSiteKey, locale));
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => { controller.abort(); onToken(''); };
  }, [locale, resetKey, retry, onToken]);
  return <View style={{ minHeight: 100, gap: 8 }}>
    {!failed && !html && <ActivityIndicator accessibilityLabel={locale === 'tr' ? 'Doğrulama yükleniyor' : 'Loading verification'} />}
    {!failed && html && <WebView
      key={`${resetKey}:${retry}:${locale}`}
      source={{ html, baseUrl: `${origin}/` }}
      style={{ height: 100, backgroundColor: 'transparent' }}
      scrollEnabled={false}
      javaScriptEnabled
      domStorageEnabled
      incognito
      sharedCookiesEnabled={false}
      thirdPartyCookiesEnabled={false}
      allowFileAccess={false}
      mixedContentMode="never"
      javaScriptCanOpenWindowsAutomatically={false}
      setSupportMultipleWindows={false}
      originWhitelist={[origin, 'https://challenges.cloudflare.com', 'about:blank', 'about:srcdoc']}
      onShouldStartLoadWithRequest={(request) => {
        if (request.url === 'about:blank' || request.url === 'about:srcdoc') return true;
        try {
          const target = new URL(request.url);
          return (target.origin === origin && target.pathname === '/') || target.origin === 'https://challenges.cloudflare.com';
        } catch { return false; }
      }}
      onMessage={(event) => {
        try {
          const source = new URL(event.nativeEvent.url);
          if (source.origin !== origin && event.nativeEvent.url !== 'about:blank') return;
          const value = JSON.parse(event.nativeEvent.data) as { type?: unknown; token?: unknown; failed?: unknown };
          if (value.type !== 'wapve-support-verification' || typeof value.token !== 'string' || value.token.length > 2048) return;
          onToken(value.token);
          if (value.failed === true) setFailed(true);
        } catch { onToken(''); }
      }}
      onError={() => { onToken(''); setFailed(true); }}
      onHttpError={() => { onToken(''); setFailed(true); }}
    />}
    {failed && <>
      <Text accessibilityRole="alert" style={{ color: colors.textMuted }}>{locale === 'tr' ? 'Güvenlik doğrulaması yüklenemedi. Bağlantını kontrol edip tekrar dene.' : 'Security verification could not load. Check your connection and retry.'}</Text>
      <Button label={locale === 'tr' ? 'Tekrar dene' : 'Retry'} variant="secondary" onPress={() => setRetry((value) => value + 1)} />
    </>}
  </View>;
}
