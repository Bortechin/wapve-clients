'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { Locale, UserProfile } from '@wapve/contracts';
import { KeyRound, ShieldCheck, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import { dictionary } from '@/lib/i18n';
import { PasswordField } from './password-field';

export function AccountClaimDialog({
  open,
  onOpenChange,
  locale,
  onClaimed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
  onClaimed: (user: UserProfile) => void;
}) {
  const tr = locale === 'tr';
  const messages = dictionary(locale);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest<{ user: UserProfile; emailSent: boolean }>('/auth/claim', {
        method: 'POST',
        body: JSON.stringify({ email: data.get('email'), password: data.get('password') }),
      });
      onClaimed(result.user);
      onOpenChange(false);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="compact-dialog account-claim-dialog">
          <Dialog.Close asChild><button className="icon-button account-claim-close" aria-label={messages.close}><X size={18} /></button></Dialog.Close>
          <div className="account-claim-icon"><KeyRound size={23} /></div>
          <Dialog.Title>{tr ? 'Hesabını güvenceye al' : 'Secure your account'}</Dialog.Title>
          <Dialog.Description>{tr ? 'E-posta ve parola eklediğinde hesabına başka cihazlardan girebilir, kaybolan oturumunu geri alabilirsin.' : 'Add email and a password to sign in on other devices and recover a lost session.'}</Dialog.Description>
          <form className="form-stack" onSubmit={(event) => void submit(event)}>
            <div className="field">
              <label htmlFor="claim-email">{messages.email}</label>
              <input id="claim-email" name="email" type="email" required maxLength={254} autoComplete="email" />
            </div>
            <PasswordField locale={locale} label={messages.password} />
            {error && <div className="form-error" role="alert">{error}</div>}
            <div className="account-claim-note"><ShieldCheck size={16} /><span>{tr ? 'Diğer oturumlar kapatılır ve bu adrese doğrulama bağlantısı gönderilir.' : 'Other sessions will be closed and a verification link will be sent to this address.'}</span></div>
            <button className="wapve-button wapve-button--primary" type="submit" disabled={busy}>{busy ? messages.loading : tr ? 'E-posta ve parola ekle' : 'Add email and password'}</button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
