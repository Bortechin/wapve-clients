'use client';

import { Download, Monitor, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const STORAGE_FOREVER_KEY = 'wapve_hide_desktop_promo_forever';
const STORAGE_DISMISS_UNTIL_KEY = 'wapve_dismiss_desktop_promo_until';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 20_000; // 20 seconds after load

export function DesktopDownloadPrompt({ locale = 'tr' }: { locale?: string }) {
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const tr = locale === 'tr';

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Do not show if already inside desktop/electron app
    if ((window as unknown as { __WAPVE_DESKTOP__?: boolean }).__WAPVE_DESKTOP__) return;

    // Only prompt on Windows machines
    const isWindows = /Windows|Win32|Win64|WOW64/i.test(window.navigator.userAgent);
    if (!isWindows) return;

    // Check permanent dismissal
    if (localStorage.getItem(STORAGE_FOREVER_KEY) === 'true') return;

    // Check temporary cooldown
    const dismissUntil = Number(localStorage.getItem(STORAGE_DISMISS_UNTIL_KEY) ?? 0);
    if (Date.now() < dismissUntil) return;

    const timer = window.setTimeout(() => {
      setOpen(true);
    }, INITIAL_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, []);

  function handleDismiss() {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_FOREVER_KEY, 'true');
    } else {
      localStorage.setItem(STORAGE_DISMISS_UNTIL_KEY, String(Date.now() + SEVEN_DAYS_MS));
    }
    setOpen(false);
  }

  function handleDownloadClick() {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_FOREVER_KEY, 'true');
    } else {
      localStorage.setItem(STORAGE_DISMISS_UNTIL_KEY, String(Date.now() + SEVEN_DAYS_MS));
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="desktop-prompt-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={tr ? 'Windows için Wapve Masaüstü' : 'Wapve Desktop for Windows'}
    >
      <div className="desktop-prompt-card">
        <button
          type="button"
          className="desktop-prompt-close"
          onClick={handleDismiss}
          aria-label={tr ? 'Kapat' : 'Close'}
        >
          <X size={18} />
        </button>

        <div className="desktop-prompt-badge">
          <Monitor size={28} className="desktop-prompt-icon" />
        </div>

        <h3>
          {tr ? 'Wapve Windows Uygulamasını Deneyin' : 'Try Wapve Desktop for Windows'}
        </h3>

        <p>
          {tr
            ? 'Daha akıcı ve kararlı ses kanalları, sistem tepsisi entegrasyonu ve optimize performans için resmi Windows uygulamasını indirin.'
            : 'Experience smoother voice channels, system tray integration, and optimized performance with the official Windows desktop app.'}
        </p>

        <div className="desktop-prompt-actions">
          <Link
            href="/download"
            className="desktop-prompt-download-btn"
            onClick={handleDownloadClick}
          >
            <Download size={18} />
            <span>{tr ? 'Windows İçin Şimdi İndir' : 'Download for Windows Now'}</span>
          </Link>
          <button
            type="button"
            className="desktop-prompt-later-btn"
            onClick={handleDismiss}
          >
            {tr ? 'Daha Sonra' : 'Maybe Later'}
          </button>
        </div>

        <label className="desktop-prompt-checkbox-label">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
          />
          <span>{tr ? 'Bir daha gösterme' : "Don't show again"}</span>
        </label>
      </div>
    </div>
  );
}
