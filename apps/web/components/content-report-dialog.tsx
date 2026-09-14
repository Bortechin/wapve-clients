'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@wapve/ui';
import type { ContentReportReason, ContentReportTargetType } from '@wapve/contracts';
import { Flag, Send, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';

export type ContentReportTarget = {
  type: ContentReportTargetType;
  id: string;
  label: string;
};

const CONTENT_REPORT_REASONS: ContentReportReason[] = [
  'SPAM',
  'HARASSMENT',
  'HATE_SPEECH',
  'SEXUAL_CONTENT',
  'VIOLENCE',
  'SCAM_FRAUD',
  'ILLEGAL_CONTENT',
  'SELF_HARM',
  'IMPERSONATION',
  'OTHER',
];

export function ContentReportDialog({
  target,
  locale,
  messages,
  onClose,
}: {
  target: ContentReportTarget | null;
  locale: 'tr' | 'en';
  messages: Dictionary;
  onClose: () => void;
}) {
  const tr = locale === 'tr';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reason, setReason] = useState<ContentReportReason>('SPAM');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!target) return;
    setError('');
    setNotice('');
    setReason('SPAM');
    setDescription('');
  }, [target]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await apiRequest<{ id: string; alreadyReported: boolean }>(
        '/reports/content',
        {
          method: 'POST',
          body: JSON.stringify({
            targetType: target.type,
            targetId: target.id,
            reason,
            ...(description.trim() ? { description: description.trim() } : {}),
          }),
        },
      );
      setNotice(
        result.alreadyReported ? messages.contentReportAlready : messages.contentReportSuccess,
      );
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root
      open={target !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay report-dialog-overlay" />
        <Dialog.Content
          className="report-dialog"
          aria-describedby="content-report-dialog-description"
          // The dialog is portaled out of the profile/menu that opened it.
          // Keep its controls from bubbling into an outside-click closer.
          onPointerDown={(event) => event.stopPropagation()}
        >
          <header>
            <span className="report-dialog-icon" aria-hidden="true">
              <Flag size={20} />
            </span>
            <span>
              <Dialog.Title>{messages.contentReportTitle}</Dialog.Title>
              <Dialog.Description id="content-report-dialog-description">
                {messages.contentReportDescription}
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
              {target && (
                <div className="field">
                  <span>{messages.contentReportTargetLabel}</span>
                  <strong className="content-report-target-label">{target.label}</strong>
                </div>
              )}
              <label className="field">
                <span>{messages.contentReportReason}</span>
                <select
                  value={reason}
                  onChange={(event) => setReason(event.target.value as ContentReportReason)}
                  disabled={busy}
                >
                  {CONTENT_REPORT_REASONS.map((value) => (
                    <option key={value} value={value}>
                      {(messages.contentReportReasons as Record<string, string>)[value] ?? value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{messages.contentReportDetailsLabel}</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={2000}
                  rows={5}
                  disabled={busy}
                  placeholder={tr ? 'Eklemek istediğin ayrıntılar' : 'Anything you want to add'}
                />
              </label>
              <Button type="submit" disabled={busy || !target}>
                <Send size={16} />{' '}
                {busy ? messages.contentReportSending : messages.contentReportSubmit}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
