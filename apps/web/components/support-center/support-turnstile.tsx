'use client';
import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { apiRequest } from '@/lib/api';

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
      theme: string;
    },
  ) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}
export function SupportTurnstile({
  onToken,
  resetKey = 0,
}: {
  onToken: (token: string) => void;
  resetKey?: number;
}) {
  const [config, setConfig] = useState<{
    turnstileSiteKey: string;
    ready: boolean;
    enabled: boolean;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);
  useEffect(() => {
    void apiRequest<{ turnstileSiteKey: string; ready: boolean; enabled: boolean }>(
      '/support/config',
    )
      .then(setConfig)
      .catch(() => setFailed(true));
  }, []);
  useEffect(() => {
    if (!loaded || !config?.turnstileSiteKey || !container.current || !window.turnstile) return;
    const id = window.turnstile.render(container.current, {
      sitekey: config.turnstileSiteKey,
      callback: (token) => callback.current(token),
      'expired-callback': () => callback.current(''),
      'error-callback': () => {
        callback.current('');
        setFailed(true);
      },
      theme: 'dark',
    });
    return () => {
      window.turnstile?.remove(id);
    };
  }, [loaded, config, resetKey]);
  return (
    <div aria-live="polite">
      {config?.turnstileSiteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          onReady={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
      <div ref={container} />
      {(failed || (config && (!config.ready || !config.enabled))) && (
        <p role="alert">Güvenlik doğrulaması şu an kullanılamıyor. Daha sonra tekrar deneyin.</p>
      )}
    </div>
  );
}
