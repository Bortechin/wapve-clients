'use client';

import { Button } from '@wapve/ui';
import type { Locale } from '@wapve/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';
import { BirthDateFields } from './birth-date-fields';
import { PasswordField } from './password-field';

export function RegisterForm({
  locale,
  messages,
  loginHref = '/login',
  redirectTo = '/verify-email',
}: {
  locale: Locale;
  messages: Dictionary;
  loginHref?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: data.get('email'),
          username: data.get('username'),
          displayName: data.get('displayName'),
          password: data.get('password'),
          birthDate: data.get('birthDate'),
          locale,
        }),
      });
      router.replace(redirectTo);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>{messages.registerTitle}</h1>
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <div className="field">
          <label htmlFor="email">{messages.email}</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            maxLength={254}
          />
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="username">{messages.username}</label>
            <input
              id="username"
              name="username"
              required
              minLength={3}
              maxLength={32}
              pattern="[a-zA-Z0-9][a-zA-Z0-9._]*[a-zA-Z0-9]|[a-zA-Z0-9]{3}"
              autoComplete="username"
            />
          </div>
          <div className="field">
            <label htmlFor="displayName">{messages.displayName}</label>
            <input
              id="displayName"
              name="displayName"
              required
              maxLength={32}
              autoComplete="name"
            />
          </div>
        </div>
        <BirthDateFields locale={locale} />
        <PasswordField locale={locale} label={messages.password} />
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <Button type="submit" fullWidth disabled={busy}>
          {busy ? messages.loading : messages.register}
        </Button>
        <div className="form-meta">
          <span>{messages.haveAccount}</span>
          <Link className="text-link" href={loginHref}>
            {messages.login}
          </Link>
        </div>
      </form>
    </div>
  );
}
