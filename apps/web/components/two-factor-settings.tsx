'use client';

import { Button } from '@wapve/ui';
import type { UserProfile } from '@wapve/contracts';
import { Check, Copy, Download, KeyRound, QrCode, RefreshCw, ShieldCheck, ShieldOff } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';

type Setup = {
  setupToken: string;
  manualKey: string;
  otpauthUrl: string;
  expiresAt: string;
};

export function TwoFactorSettings({
  user,
  messages,
  onUser,
}: {
  user: UserProfile;
  messages: Dictionary;
  onUser: (user: UserProfile) => void;
}) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);

  async function begin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      setSetup(
        await apiRequest<Setup>('/auth/2fa/setup', {
          method: 'POST',
          body: JSON.stringify({ currentPassword: data.get('currentPassword') }),
        }),
      );
      form.reset();
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function enable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!setup) return;
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const result = await apiRequest<{ recoveryCodes: string[] }>('/auth/2fa/enable', {
        method: 'POST',
        body: JSON.stringify({ setupToken: setup.setupToken, code: data.get('code') }),
      });
      setRecoveryCodes(result.recoveryCodes);
      setSetup(null);
      onUser({ ...user, twoFactorEnabled: true });
      setNotice(messages.twoFactorEnabledNotice);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function manage(form: HTMLFormElement, operation: 'disable' | 'recovery') {
    setBusy(true);
    setError('');
    const data = new FormData(form);
    try {
      const body = JSON.stringify({
        currentPassword: data.get('currentPassword'),
        code: data.get('code'),
      });
      if (operation === 'disable') {
        await apiRequest('/auth/2fa/disable', { method: 'POST', body });
        onUser({ ...user, twoFactorEnabled: false });
        setRecoveryCodes(null);
        setNotice(messages.twoFactorDisabledNotice);
      } else {
        const result = await apiRequest<{ recoveryCodes: string[] }>('/auth/2fa/recovery-codes', {
          method: 'POST',
          body,
        });
        setRecoveryCodes(result.recoveryCodes);
        setNotice(messages.recoveryCodesRegenerated);
      }
      form.reset();
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function copyCodes() {
    if (!recoveryCodes) return;
    await navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopied(true);
  }

  function downloadCodes() {
    if (!recoveryCodes) return;
    const blob = new Blob([`Wapve ${messages.recoveryCodes}\n\n${recoveryCodes.join('\n')}\n`], {
      type: 'text/plain;charset=utf-8',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'wapve-recovery-codes.txt';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <section className="settings-section two-factor-settings">
      <header className="two-factor-heading">
        <span className={user.twoFactorEnabled ? 'enabled' : ''}>
          {user.twoFactorEnabled ? <ShieldCheck size={22} /> : <KeyRound size={22} />}
        </span>
        <div>
          <h3>{messages.twoFactorAuthentication}</h3>
          <p>{user.twoFactorEnabled ? messages.twoFactorEnabledHint : messages.twoFactorDisabledHint}</p>
        </div>
        <i className={user.twoFactorEnabled ? 'enabled' : ''}>
          {user.twoFactorEnabled ? messages.enabled : messages.disabled}
        </i>
      </header>
      <div className="two-factor-security-note">
        <ShieldCheck size={17} />
        <span>{messages.twoFactorSecurityNote}</span>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {notice && <div className="form-success" role="status">{notice}</div>}

      {!user.twoFactorEnabled && !setup && (
        <form className="form-stack" onSubmit={(event) => void begin(event)}>
          <label className="field">
            <span>{messages.currentPassword}</span>
            <input name="currentPassword" type="password" autoComplete="current-password" required />
          </label>
          <Button type="submit" disabled={busy}><QrCode size={16} /> {messages.setupTwoFactor}</Button>
        </form>
      )}

      {setup && (
        <div className="two-factor-setup-flow">
          <div className="two-factor-step">
            <b>1</b><span><strong>{messages.scanQrCode}</strong><small>{messages.scanQrCodeHint}</small></span>
          </div>
          <div className="two-factor-qr"><QRCodeSVG value={setup.otpauthUrl} size={190} level="M" /></div>
          <div className="two-factor-manual-key">
            <small>{messages.manualSetupKey}</small>
            <code>{setup.manualKey.match(/.{1,4}/gu)?.join(' ')}</code>
            <button type="button" onClick={() => void navigator.clipboard.writeText(setup.manualKey)} aria-label={messages.copy}>
              <Copy size={15} />
            </button>
          </div>
          <form className="form-stack" onSubmit={(event) => void enable(event)}>
            <div className="two-factor-step">
              <b>2</b><span><strong>{messages.enterAuthenticatorCode}</strong><small>{messages.enterAuthenticatorCodeHint}</small></span>
            </div>
            <label className="field">
              <span>{messages.twoFactorCode}</span>
              <input name="code" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={6} placeholder="123456" required />
            </label>
            <div className="two-factor-actions">
              <Button type="button" variant="secondary" onClick={() => setSetup(null)}>{messages.cancel}</Button>
              <Button type="submit" disabled={busy}><ShieldCheck size={16} /> {messages.enableTwoFactor}</Button>
            </div>
          </form>
        </div>
      )}

      {user.twoFactorEnabled && (
        <form className="form-stack two-factor-management" onSubmit={(event) => event.preventDefault()}>
          <div className="form-row">
            <label className="field">
              <span>{messages.currentPassword}</span>
              <input name="currentPassword" type="password" autoComplete="current-password" required />
            </label>
            <label className="field">
              <span>{messages.twoFactorCode}</span>
              <input name="code" autoComplete="one-time-code" minLength={6} maxLength={32} required />
            </label>
          </div>
          <div className="two-factor-actions">
            <Button type="button" variant="secondary" disabled={busy} onClick={(event) => void manage(event.currentTarget.form!, 'recovery')}>
              <RefreshCw size={16} /> {messages.regenerateRecoveryCodes}
            </Button>
            <Button type="button" variant="danger" disabled={busy} onClick={(event) => void manage(event.currentTarget.form!, 'disable')}>
              <ShieldOff size={16} /> {messages.disableTwoFactor}
            </Button>
          </div>
        </form>
      )}

      {recoveryCodes && (
        <div className="recovery-code-panel">
          <div><ShieldCheck size={19} /><span><strong>{messages.saveRecoveryCodes}</strong><small>{messages.recoveryCodesShownOnce}</small></span></div>
          <div className="recovery-code-grid">{recoveryCodes.map((code) => <code key={code}>{code}</code>)}</div>
          <div className="two-factor-actions">
            <Button variant="secondary" onClick={() => void copyCodes()}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? messages.copied : messages.copy}</Button>
            <Button variant="secondary" onClick={downloadCodes}><Download size={16} /> {messages.download}</Button>
          </div>
        </div>
      )}
    </section>
  );
}
