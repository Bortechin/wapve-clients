'use client';

import { startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import { Button } from '@wapve/ui';
import { Fingerprint, KeyRound, Laptop, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';

type Passkey = {
  id: string;
  name: string;
  deviceType: string;
  backedUp: boolean;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
};

export function PasskeySettings({ messages }: { messages: Dictionary }) {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [supported, setSupported] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function load() {
    setPasskeys(await apiRequest<Passkey[]>('/auth/passkeys'));
  }

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'PublicKeyCredential' in window);
    void load().catch(() => setPasskeys([]));
  }, []);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supported) return;
    setBusy(true);
    setError('');
    setNotice('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const rawName = data.get('name');
    const name = typeof rawName === 'string' ? rawName : '';
    try {
      const start = await apiRequest<{
        challengeId: string;
        options: PublicKeyCredentialCreationOptionsJSON;
      }>('/auth/passkeys/register/options', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: data.get('currentPassword'),
          name,
        }),
      });
      const response = await startRegistration({ optionsJSON: start.options });
      setPasskeys(
        await apiRequest<Passkey[]>('/auth/passkeys/register/verify', {
          method: 'POST',
          body: JSON.stringify({ challengeId: start.challengeId, name, response }),
        }),
      );
      form.reset();
      setNotice(messages.passkeyAdded);
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

  async function remove(event: FormEvent<HTMLFormElement>, passkeyId: string) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await apiRequest(`/auth/passkeys/${passkeyId}`, {
        method: 'DELETE',
        body: JSON.stringify({ currentPassword: data.get('currentPassword') }),
      });
      setPasskeys((current) => current.filter((passkey) => passkey.id !== passkeyId));
      setRemovingId(null);
      setNotice(messages.passkeyRemoved);
      form.reset();
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-section passkey-settings">
      <header className="passkey-heading">
        <span>
          <Fingerprint size={23} />
        </span>
        <div>
          <h3>{messages.passkeys}</h3>
          <p>{messages.passkeysHint}</p>
        </div>
        <i>
          <ShieldCheck size={15} /> {messages.phishingResistant}
        </i>
      </header>
      {!supported && (
        <div className="form-error" role="alert">
          {messages.passkeyUnsupported}
        </div>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="form-success" role="status">
          {notice}
        </div>
      )}

      <div className="passkey-list">
        {passkeys.map((passkey) => (
          <article className="passkey-row" key={passkey.id}>
            <span className="passkey-device">
              <Laptop size={19} />
            </span>
            <div>
              <strong>{passkey.name}</strong>
              <small>
                {passkey.backedUp ? messages.syncedPasskey : messages.devicePasskey} ·{' '}
                {passkey.lastUsedAt
                  ? messages.passkeyLastUsed.replace(
                      '{date}',
                      new Date(passkey.lastUsedAt).toLocaleString(),
                    )
                  : messages.passkeyNeverUsed}
              </small>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label={messages.removePasskey}
              onClick={() =>
                setRemovingId((current) => (current === passkey.id ? null : passkey.id))
              }
            >
              <Trash2 size={16} />
            </button>
            {removingId === passkey.id && (
              <form className="passkey-remove" onSubmit={(event) => void remove(event, passkey.id)}>
                <label className="field">
                  <span>{messages.currentPassword}</span>
                  <input
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                    autoFocus
                  />
                </label>
                <Button type="submit" variant="danger" disabled={busy}>
                  {messages.removePasskey}
                </Button>
              </form>
            )}
          </article>
        ))}
        {!passkeys.length && <p className="passkey-empty">{messages.noPasskeys}</p>}
      </div>

      <form className="form-stack passkey-create" onSubmit={(event) => void register(event)}>
        <div className="form-row">
          <label className="field">
            <span>{messages.passkeyName}</span>
            <input
              name="name"
              maxLength={64}
              placeholder={messages.passkeyNamePlaceholder}
              required
            />
          </label>
          <label className="field">
            <span>{messages.currentPassword}</span>
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
        </div>
        <Button type="submit" disabled={busy || !supported}>
          <KeyRound size={16} /> {messages.addPasskey}
        </Button>
      </form>
    </section>
  );
}
