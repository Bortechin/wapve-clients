'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api';

type InviteTurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
      theme: 'dark';
    },
  ) => string;
  remove: (id: string) => void;
};

export function InviteTurnstile({ onToken, locale }: { onToken: (token: string) => void; locale: 'tr' | 'en' }) {
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);
  useEffect(() => {
    void apiRequest<{ siteKey: string; enabled: boolean }>('/auth/invite-config')
      .then((config) => {
        setSiteKey(config.siteKey);
        if (!config.enabled) callback.current('development-bypass');
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(() => {
    const turnstile = window.turnstile as unknown as InviteTurnstileApi | undefined;
    if (!loaded || !siteKey || !host.current || !turnstile) return;
    const id = turnstile.render(host.current, {
      sitekey: siteKey,
      action: 'invite-register',
      callback: (token) => callback.current(token),
      'expired-callback': () => callback.current(''),
      'error-callback': () => {
        callback.current('');
        setFailed(true);
      },
      theme: 'dark',
    });
    return () => turnstile.remove(id);
  }, [loaded, siteKey]);
  return (
    <div className="invite-turnstile" aria-live="polite">
      {siteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          onReady={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
      <div ref={host} />
      {failed && (
        <p role="alert">
          {locale === 'tr'
            ? 'Güvenlik doğrulaması yüklenemedi. Lütfen sayfayı yenile.'
            : 'Security verification could not load. Please refresh the page.'}
        </p>
      )}
    </div>
  );
}
