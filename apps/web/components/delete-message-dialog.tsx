'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@wapve/ui';
import { Trash2, X } from 'lucide-react';
import type { Dictionary } from '@/lib/i18n';

export type DeletableMessage = {
  id: string;
  content: string | null;
  createdAt: string;
  author?: {
    displayName?: string;
    username?: string;
    avatarUrl?: string | null;
  } | null;
  attachments?: unknown[] | null;
  gif?: unknown;
};

function formatPreviewTimestamp(value: string, locale: 'tr' | 'en'): string {
  try {
    const date = new Date(value);
    const now = new Date();
    const timeStr = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isToday) {
      return locale === 'tr' ? `bugün ${timeStr}` : `Today at ${timeStr}`;
    }
    if (isYesterday) {
      return locale === 'tr' ? `dün ${timeStr}` : `Yesterday at ${timeStr}`;
    }
    const dateStr = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
    return `${dateStr} ${timeStr}`;
  } catch {
    return '';
  }
}

export function DeleteMessageDialog({
  message,
  locale,
  messages,
  busy = false,
  onConfirm,
  onClose,
}: {
  message: DeletableMessage | null;
  locale: 'tr' | 'en';
  messages: Dictionary;
  busy?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  if (!message) return null;

  const authorName = message.author?.displayName || message.author?.username || 'Wapve';
  const initial = authorName.slice(0, 1).toUpperCase();
  const timestamp = formatPreviewTimestamp(message.createdAt, locale);

  return (
    <Dialog.Root
      open={Boolean(message)}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="delete-dialog-overlay" />
        <Dialog.Content
          className="delete-dialog-card"
          aria-describedby="delete-message-dialog-desc"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="delete-dialog-header">
            <div>
              <Dialog.Title className="delete-dialog-title">
                {messages.deleteMessageTitle}
              </Dialog.Title>
              <Dialog.Description id="delete-message-dialog-desc" className="delete-dialog-desc">
                {messages.deleteMessageConfirm}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="delete-dialog-close-btn"
                aria-label={messages.close}
                disabled={busy}
                onClick={onClose}
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="delete-dialog-preview">
            <div className="delete-dialog-preview-author">
              {message.author?.avatarUrl ? (
                <img
                  src={message.author.avatarUrl}
                  alt=""
                  className="delete-dialog-preview-avatar"
                />
              ) : (
                <div className="delete-dialog-preview-avatar fallback">{initial}</div>
              )}
            </div>
            <div className="delete-dialog-preview-body">
              <div className="delete-dialog-preview-meta">
                <strong className="delete-dialog-preview-name">{authorName}</strong>
                {timestamp && (
                  <span className="delete-dialog-preview-time">{timestamp}</span>
                )}
              </div>
              <div className="delete-dialog-preview-content">
                {message.content ? (
                  <p>{message.content}</p>
                ) : message.gif ? (
                  <span className="delete-dialog-preview-chip">GIF</span>
                ) : Array.isArray(message.attachments) && message.attachments.length > 0 ? (
                  <span className="delete-dialog-preview-chip">
                    📎{' '}
                    {(() => {
                      const first = message.attachments[0];
                      if (typeof first === 'object' && first !== null && 'fileName' in first) {
                        const name = (first as { fileName?: unknown }).fileName;
                        if (typeof name === 'string' && name.length > 0) return name;
                      }
                      return `${message.attachments.length} ${messages.addAttachment}`;
                    })()}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="delete-dialog-actions">
            <Button
              type="button"
              variant="secondary"
              className="delete-dialog-btn delete-dialog-btn-cancel"
              disabled={busy}
              onClick={onClose}
            >
              {messages.cancel}
            </Button>
            <Button
              type="button"
              variant="danger"
              className="delete-dialog-btn delete-dialog-btn-delete"
              disabled={busy}
              onClick={() => void onConfirm()}
            >
              <Trash2 size={16} />
              {messages.delete}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
