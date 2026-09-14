'use client';

import type { AuthSession, Locale } from '@wapve/contracts';
import { WapveLogo } from '@wapve/ui';
import { ArrowRight, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiClientError, apiRequest } from '@/lib/api';
import { desktopAuthHref } from '@/lib/desktop-route';
import type { Dictionary } from '@/lib/i18n';
import styles from './desktop-gateway.module.css';

const WELCOME_KEY = 'wapve:desktop:welcomed:v1';
type GatewayState = 'checking' | 'welcome' | 'error';

export function DesktopGateway({
  locale,
  messages,
  next,
}: {
  locale: Locale;
  messages: Dictionary;
  next: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<GatewayState>('checking');

  const checkSession = useCallback(async () => {
    setState('checking');
    try {
      const session = await apiRequest<AuthSession>('/auth/session');
      if (session.user) {
        router.replace(next ?? '/app');
        return;
      }
      throw new ApiClientError(401, { code: 'UNAUTHORIZED', messageKey: 'errors.unauthorized' });
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        if (window.localStorage.getItem(WELCOME_KEY) === '1') {
          router.replace(desktopAuthHref('/login', next));
          return;
        }
        setState('welcome');
        return;
      }
      setState('error');
    }
  }, [next, router]);

  useEffect(() => void checkSession(), [checkSession]);

  function continueTo(path: '/login' | '/register') {
    window.localStorage.setItem(WELCOME_KEY, '1');
    router.push(desktopAuthHref(path, next));
  }

  return (
    <main className={styles.gateway} lang={locale}>
      <div className={styles.ambient} aria-hidden="true">
        <i />
        <i />
        <svg viewBox="0 0 1440 300" preserveAspectRatio="none">
          <path d="M-30 204C170 92 310 302 520 185S870 75 1070 174s315 52 430-42" />
          <path d="M-60 250c225-89 344 57 535-12s338-114 522-24 334 62 493-20" />
        </svg>
      </div>

      <header className={styles.topbar}>
        <WapveLogo />
      </header>

      <section className={styles.stage}>
        <div className={styles.mascot} aria-hidden="true">
          <span />
          <Image
            src="/brand/wapve-wave-mark-v2.png"
            alt=""
            width={1254}
            height={1254}
            priority
            sizes="220px"
          />
        </div>

        {state === 'checking' && (
          <div className={styles.copy} role="status">
            <span className={styles.eyebrow}>
              <Sparkles size={13} /> {messages.desktopWelcomeEyebrow}
            </span>
            <h1>{messages.desktopCheckingSession}</h1>
            <p>{messages.desktopPreparing}</p>
            <div className={styles.loader} aria-hidden="true"><i /><i /><i /></div>
          </div>
        )}

        {state === 'welcome' && (
          <div className={styles.copy}>
            <span className={styles.eyebrow}>
              <Sparkles size={13} /> {messages.desktopWelcomeEyebrow}
            </span>
            <h1>{messages.desktopWelcomeTitle}</h1>
            <p>{messages.desktopWelcomeBody}</p>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => continueTo('/login')}>
                {messages.login} <ArrowRight size={17} />
              </button>
              <button type="button" className={styles.secondary} onClick={() => continueTo('/register')}>
                {messages.register}
              </button>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className={styles.copy} role="alert">
            <span className={styles.eyebrow}>{messages.desktopOffline}</span>
            <h1>{messages.desktopConnectionProblem}</h1>
            <p>{messages.desktopConnectionProblemBody}</p>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => void checkSession()}>
                <RefreshCw size={16} /> {messages.desktopRetry}
              </button>
            </div>
          </div>
        )}
      </section>

      <footer className={styles.footer}>
        <ShieldCheck size={14} /> {messages.desktopSecureSession}
      </footer>
    </main>
  );
}
