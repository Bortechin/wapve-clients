'use client';

import { WapveLogo } from '@wapve/ui';
import { Check, LogOut, Sparkles } from 'lucide-react';
import type { Dictionary } from '@/lib/i18n';

export const SESSION_TRANSITION_HOLD_MS = 2_300;

export function holdSessionTransition(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, SESSION_TRANSITION_HOLD_MS));
}

export function SessionTransition({
  mode,
  messages,
}: {
  mode: 'login' | 'logout';
  messages: Dictionary;
}) {
  const entering = mode === 'login';
  return (
    <div className={`session-transition ${mode}`} role="status" aria-live="polite">
      <div className="session-transition-ambient" aria-hidden="true">
        <i />
        <i />
        <span />
        <span />
        <span />
      </div>
      <section className="session-transition-card">
        <div className="session-transition-logo" aria-hidden="true">
          <i />
          <i />
          <span>
            <WapveLogo compact />
          </span>
        </div>
        <small>
          {entering ? <Sparkles size={13} /> : <LogOut size={13} />}
          {entering ? messages.sessionLoginEyebrow : messages.sessionLogoutEyebrow}
        </small>
        <h2>{entering ? messages.sessionLoginTitle : messages.sessionLogoutTitle}</h2>
        <p>{entering ? messages.sessionLoginBody : messages.sessionLogoutBody}</p>
        <div className="session-transition-progress" aria-hidden="true">
          <i />
        </div>
        <em>
          <Check size={12} /> {messages.sessionSecureTransfer}
        </em>
      </section>
    </div>
  );
}
