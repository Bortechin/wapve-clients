import type { ReactNode } from 'react';
import { ArrowRight, MessageCircle, Mic2, ShieldCheck, Sparkles, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { WapveLogo } from '@wapve/ui';
import type { Locale } from '@wapve/contracts';
import { LocaleSwitch } from '@/components/locale-switch';
import type { Dictionary } from '@/lib/i18n';
import styles from './public-site.module.css';

export function AuthShell({
  children,
  locale,
  messages,
  mode = 'login',
  desktop = false,
}: {
  children: ReactNode;
  locale: Locale;
  messages: Dictionary;
  mode?: 'login' | 'register';
  desktop?: boolean;
}) {
  const tr = locale === 'tr';
  const register = mode === 'register';

  if (desktop) {
    return (
      <main className={styles.desktopAuthPage} lang={locale}>
        <div className={styles.desktopAuthAmbient} aria-hidden="true">
          <i />
          <i />
          <svg viewBox="0 0 1200 260" preserveAspectRatio="none">
            <path d="M-40 190C125 80 285 283 466 174S760 62 940 158s278 59 324-10" />
            <path d="M-50 235c190-65 315 55 485-9s309-96 474-18 276 50 354-10" />
          </svg>
        </div>
        <section className={styles.desktopAuthShell}>
          <header className={styles.desktopAuthTop}>
            <WapveLogo />
            <div>
              <LocaleSwitch locale={locale} />
            </div>
          </header>
          <div className={styles.desktopAuthBody}>
            <div
              className={`${styles.desktopAuthForm} ${
                register ? styles.desktopAuthFormRegister : styles.desktopAuthFormLogin
              }`}
            >
              {children}
            </div>
            <aside className={styles.desktopAuthGuide} aria-hidden="true">
              <span className={styles.desktopAuthEyebrow}>
                <Sparkles size={12} /> {messages.desktopWelcomeEyebrow}
              </span>
              <div className={styles.desktopAuthMascot}>
                <i />
                <Image
                  src="/brand/wapve-wave-mark-v2.png"
                  alt=""
                  width={1254}
                  height={1254}
                  loading="eager"
                  fetchPriority="high"
                  sizes="190px"
                />
              </div>
              <h2>{messages.desktopAuthGuideTitle}</h2>
              <p>{messages.desktopAuthGuideBody}</p>
            </aside>
          </div>
          <footer className={styles.desktopAuthBottom}>
            <ShieldCheck size={13} /> {messages.desktopSecureSession}
          </footer>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.authPage} lang={locale}>
      <aside className={styles.authArt} aria-hidden="true">
        <div className={styles.authArtCopy}>
          <h1>
            {register
              ? tr
                ? 'Kendi dalganı başlat.'
                : 'Start your own wave.'
              : tr
                ? 'Tekrar aynı dalgadayız.'
                : 'Back on the same wave.'}
          </h1>
          <p>
            {register
              ? tr
                ? 'Topluluğunu kur, insanlarını bul ve birlikte üretmeye başla.'
                : 'Build your community, find your people, and start creating together.'
              : tr
                ? 'Toplulukların, konuşmaların ve arkadaşların seni bekliyor.'
                : 'Your communities, conversations, and friends are waiting.'}
          </p>
        </div>
        <div className={styles.authOrbit}>
          <span className={styles.authMascot}>
            <Image
              src="/brand/wapve-wave-mark-v2.png"
              alt=""
              width={1254}
              height={1254}
              loading="eager"
              fetchPriority="high"
              sizes="160px"
            />
          </span>
          <i>
            <MessageCircle size={16} />
          </i>
          <i>
            <Users size={16} />
          </i>
          <i>
            <Mic2 size={16} />
          </i>
          <i>
            <ShieldCheck size={15} />
          </i>
        </div>
        <div className={styles.authQuote}>
          <div className={styles.quoteAvatars}>
            <span>EL</span>
            <span>MR</span>
            <span>AK</span>
          </div>
          <p>
            {tr
              ? '“İletişim kalabalık olmak zorunda değil.”'
              : '“Communication does not have to feel crowded.”'}
          </p>
          <small>{tr ? 'Wapve topluluğu' : 'Wapve community'}</small>
        </div>
      </aside>
      <section className={styles.authPanel}>
        <header className={styles.authTop}>
          <Link href="/" aria-label="Wapve">
            <WapveLogo />
          </Link>
          <Link href="/">
            <ArrowRight size={14} />
            {tr ? 'Ana sayfa' : 'Home'}
          </Link>
        </header>
        <div className={styles.authFormWrap}>{children}</div>
        <footer className={styles.authFooter}>
          <nav className={styles.authLegal}>
            <Link href="/legal/privacy">{tr ? 'Gizlilik' : 'Privacy'}</Link>
            <Link href="/legal/terms">{tr ? 'Koşullar' : 'Terms'}</Link>
          </nav>
          <LocaleSwitch locale={locale} />
        </footer>
      </section>
    </main>
  );
}
