'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@wapve/ui';
import { Bug, Send, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';

export function ReportDialog({
  open,
  onOpenChange,
  locale,
  messages,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: 'tr' | 'en';
  messages: Dictionary;
}) {
  const tr = locale === 'tr';
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await apiRequest('/reports', {
        method: 'POST',
        body: JSON.stringify({
          category: data.get('category'),
          title: data.get('title'),
          description: data.get('description'),
          pageUrl: window.location.href,
          context: {
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            userAgent: navigator.userAgent,
          },
        }),
      });
      form.reset();
      setNotice(tr ? 'Bildirimin uygulama sahibine ulaştı.' : 'Your report reached the app owner.');
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !busy) {
          setError('');
          setNotice('');
        }
        onOpenChange(nextOpen);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay report-dialog-overlay" />
        <Dialog.Content className="report-dialog" aria-describedby="report-dialog-description">
          <header>
            <span className="report-dialog-icon" aria-hidden="true">
              <Bug size={20} />
            </span>
            <span>
              <Dialog.Title>{tr ? 'Sorun bildir' : 'Report a problem'}</Dialog.Title>
              <Dialog.Description id="report-dialog-description">
                {tr
                  ? 'Hata, güvenlik sorunu veya önerini doğrudan Wapve ekibine gönder.'
                  : 'Send a bug, safety concern, or suggestion directly to the Wapve team.'}
              </Dialog.Description>
            </span>
            <Dialog.Close asChild>
              <button
                type="button"
                className="icon-button"
                aria-label={messages.close}
                disabled={busy}
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </header>
          <form onSubmit={(event) => void submit(event)}>
            {error && <div className="form-error">{error}</div>}
            {notice && <div className="form-success">{notice}</div>}
            <div className="report-dialog-fields">
              <label className="field">
                <span>{tr ? 'Tür' : 'Type'}</span>
                <select name="category" defaultValue="BUG" disabled={busy}>
                  <option value="BUG">{tr ? 'Hata' : 'Bug'}</option>
                  <option value="FEEDBACK">{tr ? 'Öneri' : 'Feedback'}</option>
                  <option value="SAFETY">{tr ? 'Güvenlik / emniyet' : 'Safety / security'}</option>
                  <option value="OTHER">{tr ? 'Diğer' : 'Other'}</option>
                </select>
              </label>
              <label className="field">
                <span>{tr ? 'Başlık' : 'Title'}</span>
                <input name="title" minLength={3} maxLength={120} required disabled={busy} />
              </label>
              <label className="field">
                <span>{tr ? 'Açıklama' : 'Description'}</span>
                <textarea
                  name="description"
                  minLength={10}
                  maxLength={4000}
                  rows={7}
                  required
                  disabled={busy}
                />
              </label>
              <Button type="submit" disabled={busy}>
                <Send size={16} />{' '}
                {busy ? (tr ? 'Gönderiliyor…' : 'Sending…') : tr ? 'Gönder' : 'Send'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
