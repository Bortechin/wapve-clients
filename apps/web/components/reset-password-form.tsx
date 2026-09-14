'use client';

import { Button } from '@wapve/ui';
import type { Locale } from '@wapve/contracts';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';
import { PasswordField } from './password-field';

export function ResetPasswordForm({ locale, messages }: { locale: Locale; messages: Dictionary }) {
  const search = useSearchParams();
  const token = search.get('token') ?? '';
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await apiRequest('/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({ token, password: data.get('password') }),
      });
      setDone(true);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>{messages.resetPassword}</h1>
      <p>
        {locale === 'tr'
          ? 'Yeni ve güçlü parola cümleni belirle.'
          : 'Choose a new, strong passphrase.'}
      </p>
      {done ? (
        <div className="form-stack">
          <div className="form-success">{messages.passwordChanged}</div>
          <Link className="wapve-button wapve-button--primary" href="/login">
            {messages.login}
          </Link>
        </div>
      ) : (
        <form className="form-stack" onSubmit={(event) => void submit(event)}>
          <PasswordField locale={locale} label={messages.newPassword} />
          {!token && <div className="form-error">{messages.verificationFailed}</div>}
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <Button type="submit" fullWidth disabled={busy || !token}>
            {busy ? messages.loading : messages.resetPassword}
          </Button>
        </form>
      )}
    </div>
  );
}
