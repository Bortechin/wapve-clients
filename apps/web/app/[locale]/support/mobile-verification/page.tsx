'use client';
import { SupportTurnstile } from '@/components/support-center/support-turnstile';

export default function MobileVerificationPage() {
  return <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#16181d' }}>
    <SupportTurnstile onToken={token => {
      const bridge = (window as Window & { ReactNativeWebView?: { postMessage(value: string): void } }).ReactNativeWebView;
      bridge?.postMessage(JSON.stringify({ type: 'wapve-support-verification', token }));
    }} />
  </main>;
}
