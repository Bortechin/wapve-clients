'use client';

import { Button } from '@wapve/ui';
import type { Locale } from '@wapve/contracts';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';

export function ForgotPasswordForm({ locale, messages }: { locale: Locale; messages: Dictionary }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await apiRequest('/auth/password/forgot', {
        method: 'POST',
        body: JSON.stringify({ email: data.get('email') }),
      });
      setSent(true);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>{messages.forgotPassword}</h1>
      <p>
        {locale === 'tr'
          ? 'Hesabına bağlı e-posta adresini yaz.'
          : 'Enter the email address linked to your account.'}
      </p>
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <div className="field">
          <label htmlFor="email">{messages.email}</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        {sent && (
          <div className="form-success" role="status">
            {messages.resetSent}
          </div>
        )}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <Button type="submit" fullWidth disabled={busy || sent}>
          {busy ? messages.loading : messages.sendReset}
        </Button>
        <Link className="text-link" href="/login">
          ← {messages.login}
        </Link>
      </form>
    </div>
  );
}
