'use client';

import type { UserProfile } from '@wapve/contracts';
import { Button } from '@wapve/ui';
import { AlertTriangle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';

export function AccountDeletionSettings({
  user,
  onUser,
  locale,
  messages,
}: {
  user: UserProfile;
  onUser: (user: UserProfile) => void;
  locale: 'tr' | 'en';
  messages: Dictionary;
}) {
  const tr = locale === 'tr';
  const [error, setError] = useState('');
  async function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      onUser(
        await apiRequest<UserProfile>('/users/me/deletion', {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: data.get('currentPassword'),
            code: data.get('code') || undefined,
            confirmation: 'DELETE',
          }),
        }),
      );
    } catch (caught) {
      setError(errorMessage(caught, messages));
    }
  }
  async function cancel() {
    try {
      onUser(await apiRequest<UserProfile>('/users/me/deletion', { method: 'DELETE' }));
    } catch (caught) {
      setError(errorMessage(caught, messages));
    }
  }
  return (
    <section className="settings-section danger-zone">
      <h3 className="flex items-center gap-2">
        <AlertTriangle size={19} /> {tr ? 'Hesabı sil' : 'Delete account'}
      </h3>
      {error && <div className="form-error">{error}</div>}
      {user.deletionScheduledFor ? (
        <>
          <p>
            {tr
              ? `Hesabın ${new Date(user.deletionScheduledFor).toLocaleString(locale)} tarihinde silinecek. Bu tarihe kadar vazgeçebilirsin.`
              : `Your account will be deleted on ${new Date(user.deletionScheduledFor).toLocaleString(locale)}. You can cancel until then.`}
          </p>
          <Button variant="secondary" onClick={() => void cancel()}>
            {tr ? 'Silme isteğini iptal et' : 'Cancel deletion'}
          </Button>
        </>
      ) : (
        <form className="form-stack" onSubmit={(event) => void request(event)}>
          <p className="field-hint">
            {tr
              ? '14 günlük bekleme sonunda profilin anonimleştirilir ve tüm oturumların kapatılır.'
              : 'After a 14-day waiting period, your profile is anonymized and all sessions are closed.'}
          </p>
          <label className="field">
            <span>{messages.currentPassword}</span>
            <input name="currentPassword" type="password" required />
          </label>
          {user.twoFactorEnabled && (
            <label className="field">
              <span>2FA</span>
              <input name="code" inputMode="numeric" required />
            </label>
          )}
          <Button type="submit" variant="danger">
            {tr ? '14 günlük silme sürecini başlat' : 'Start 14-day deletion'}
          </Button>
        </form>
      )}
    </section>
  );
}
