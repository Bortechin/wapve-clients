'use client';

import { Button } from '@wapve/ui';
import { startAuthentication } from '@simplewebauthn/browser';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { Fingerprint } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';
import {
  holdSessionTransition,
  SessionTransition,
} from './session-transition';

const DEVICE_ID_KEY = 'wapve:login-device-id';

function loginDeviceId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = window.crypto.randomUUID();
  window.localStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}

export function LoginForm({
  messages,
  redirectTo = '/app',
  registerHref = '/register',
}: {
  messages: Dictionary;
  redirectTo?: string;
  registerHref?: string;
}) {
  const tr = typeof document === 'undefined' || document.documentElement.lang !== 'en';
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [emailApprovalExpiresAt, setEmailApprovalExpiresAt] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [method, setMethod] = useState<'credentials' | 'qr'>('credentials');
  const [qrGeneration, setQrGeneration] = useState(0);
  const [qrChallenge, setQrChallenge] = useState<{
    challengeId: string;
    qrPayload: string;
    pollToken: string;
    expiresAt: string;
  } | null>(null);

  const finishLogin = useCallback(async () => {
    setTransitioning(true);
    await holdSessionTransition();
    router.replace(redirectTo);
    router.refresh();
  }, [redirectTo, router]);

  useEffect(() => {
    if (method !== 'qr') return;
    let cancelled = false;
    setQrChallenge(null);
    setError('');
    void apiRequest<{
      challengeId: string;
      qrPayload: string;
      pollToken: string;
      expiresAt: string;
    }>('/auth/qr-login/challenges', { method: 'POST', body: '{}' })
      .then((challenge) => {
        if (!cancelled) setQrChallenge(challenge);
      })
      .catch((caught) => {
        if (!cancelled) setError(errorMessage(caught, messages));
      });
    return () => {
      cancelled = true;
    };
  }, [messages, method, qrGeneration]);

  useEffect(() => {
    if (method !== 'qr' || !qrChallenge) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      if (cancelled || !qrChallenge) return;
      if (Date.now() >= new Date(qrChallenge.expiresAt).getTime()) {
        setError(messages.qrLoginExpired);
        return;
      }
      try {
        const result = await apiRequest<{ status: 'PENDING' | 'APPROVED'; csrfToken?: string }>(
          '/auth/qr-login/redeem',
          {
            method: 'POST',
            body: JSON.stringify({
              challengeId: qrChallenge.challengeId,
              pollToken: qrChallenge.pollToken,
            }),
          },
        );
        if (result.status === 'APPROVED') {
          await finishLogin();
          return;
        }
      } catch (caught) {
        if (!cancelled) setError(errorMessage(caught, messages));
        return;
      }
      timer = setTimeout(() => void poll(), 1_500);
    }
    timer = setTimeout(() => void poll(), 800);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [finishLogin, messages, method, qrChallenge]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const result = await apiRequest<
        | { requiresTwoFactor: true; challengeToken: string }
        | { requiresEmailApproval: true; expiresAt: string }
        | { user: unknown; csrfToken: string }
      >('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: data.get('identifier'),
          password: data.get('password'),
          deviceId: loginDeviceId(),
        }),
      });
      if ('requiresEmailApproval' in result) {
        setEmailApprovalExpiresAt(result.expiresAt);
        return;
      }
      if ('requiresTwoFactor' in result) {
        setChallengeToken(result.challengeToken);
        return;
      }
      await finishLogin();
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function submitTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challengeToken) return;
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await apiRequest('/auth/login/2fa', {
        method: 'POST',
        body: JSON.stringify({ challengeToken, code: data.get('code'), deviceId: loginDeviceId() }),
      });
      await finishLogin();
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function loginWithPasskey() {
    setBusy(true);
    setError('');
    try {
      const start = await apiRequest<{
        challengeId: string;
        options: PublicKeyCredentialRequestOptionsJSON;
      }>('/auth/passkeys/login/options', { method: 'POST', body: '{}' });
      const response = await startAuthentication({ optionsJSON: start.options });
      await apiRequest('/auth/passkeys/login/verify', {
        method: 'POST',
        body: JSON.stringify({ challengeId: start.challengeId, response }),
      });
      await finishLogin();
    } catch (caught) {
      setError(
        caught instanceof DOMException && ['AbortError', 'NotAllowedError'].includes(caught.name)
          ? messages.passkeyCancelled
          : errorMessage(caught, messages),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {transitioning && <SessionTransition mode="login" messages={messages} />}
      <div className="auth-card">
      <h1>{messages.welcome}</h1>
      <p>{challengeToken ? messages.twoFactorLoginHint : method === 'qr' ? messages.qrLoginSubtitle : messages.loginSubtitle}</p>
      {emailApprovalExpiresAt && !challengeToken && (
        <div className="auth-login-approval" role="status">
          <strong>{tr ? 'E-postanı kontrol et' : 'Check your email'}</strong>
          <span>
            {tr
              ? 'Bu yeni cihaz veya konumdan girişi durdurduk. E-postadaki tek kullanımlık bağlantıyla onayla, ardından yeniden giriş yap.'
              : 'We blocked this new device or location. Approve it from the single-use email link, then sign in again.'}
          </span>
        </div>
      )}
      {!challengeToken && (
        <div className="auth-login-methods" role="tablist" aria-label={messages.loginMethod}>
          <button type="button" role="tab" aria-selected={method === 'credentials'} onClick={() => setMethod('credentials')}>{messages.passwordLogin}</button>
          <button type="button" role="tab" aria-selected={method === 'qr'} onClick={() => setMethod('qr')}>{messages.qrLogin}</button>
        </div>
      )}
      {challengeToken ? (
        <form className="form-stack" onSubmit={(event) => void submitTwoFactor(event)}>
          <div className="field">
            <label htmlFor="two-factor-code">{messages.twoFactorCode}</label>
            <input
              id="two-factor-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              minLength={6}
              maxLength={32}
              autoFocus
              required
            />
            <small className="field-hint">{messages.twoFactorRecoveryHint}</small>
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <Button type="submit" fullWidth disabled={busy}>
            {busy ? messages.loading : messages.verifyAndLogin}
          </Button>
          <button
            className="auth-back-button"
            type="button"
            onClick={() => {
              setChallengeToken(null);
              setError('');
            }}
          >
            {messages.backToLogin}
          </button>
        </form>
      ) : method === 'qr' ? (
        <div className="qr-login-panel">
          <div className="qr-login-code" aria-label={messages.qrLoginCode}>
            {qrChallenge ? (
              <QRCodeSVG value={qrChallenge.qrPayload} size={208} level="M" bgColor="#ffffff" fgColor="#07101f" marginSize={2} />
            ) : (
              <span className="qr-login-loader" aria-label={messages.loading} />
            )}
          </div>
          <div className="qr-login-copy">
            <strong>{messages.qrLoginScanTitle}</strong>
            <span>{messages.qrLoginScanHint}</span>
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="auth-back-button" type="button" onClick={() => setQrGeneration((value) => value + 1)}>{messages.qrLoginRefresh}</button>
        </div>
      ) : (
        <form className="form-stack" onSubmit={(event) => void submit(event)}>
          <div className="field">
            <label htmlFor="identifier">{messages.emailOrUsername}</label>
            <input
              id="identifier"
              name="identifier"
              autoComplete="username"
              required
              minLength={3}
            />
          </div>
          <div className="field">
            <label htmlFor="password">{messages.password}</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </div>
          <div className="form-meta">
            <span />
            <Link className="text-link" href="/forgot-password">
              {messages.forgotPassword}
            </Link>
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <Button type="submit" fullWidth disabled={busy}>
            {busy ? messages.loading : messages.login}
          </Button>
          <div className="auth-divider">
            <span>{messages.or}</span>
          </div>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={busy}
            onClick={() => void loginWithPasskey()}
          >
            <Fingerprint size={18} /> {messages.loginWithPasskey}
          </Button>
          <div className="form-meta">
            <span>{messages.noAccount}</span>
            <Link className="text-link" href={registerHref}>
              {messages.register}
            </Link>
          </div>
        </form>
      )}
      </div>
    </>
  );
}
