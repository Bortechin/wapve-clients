'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ForwardedMessageSnapshot,
  ForwardTarget,
  MessageSource,
  MessageTarget,
} from '@wapve/contracts';
import { Check, Forward, Search, Send, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';

function targetKey(target: MessageTarget): string {
  return target.kind === 'CHANNEL'
    ? `CHANNEL:${target.serverId}:${target.channelId}`
    : `${target.kind}:${target.conversationId}`;
}

export function ForwardMessageDialog({
  source,
  messages,
  onClose,
}: {
  source: MessageSource | null;
  messages: Dictionary;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MessageTarget[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const targets = useQuery({
    queryKey: ['message-forward-targets'],
    queryFn: () => apiRequest<ForwardTarget[]>('/message-delivery/targets'),
    enabled: Boolean(source),
  });

  useEffect(() => {
    if (!source) return;
    setSearch('');
    setSelected([]);
    setNote('');
    setError('');
  }, [source]);

  const normalized = search.trim().toLocaleLowerCase();
  const visible = (targets.data ?? []).filter(
    (target) =>
      !normalized ||
      target.name.toLocaleLowerCase().includes(normalized) ||
      target.subtitle?.toLocaleLowerCase().includes(normalized),
  );

  async function submitForward() {
    if (!source) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest('/message-delivery/forward', {
        method: 'POST',
        body: JSON.stringify({ source, targets: selected, note: note.trim() || undefined }),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['channel-messages'] }),
        queryClient.invalidateQueries({ queryKey: ['dm-messages'] }),
        queryClient.invalidateQueries({ queryKey: ['group-messages'] }),
        queryClient.invalidateQueries({ queryKey: ['dm-conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['group-conversations'] }),
      ]);
      onClose();
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={Boolean(source)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-card forward-message-dialog">
          <div className="dialog-title-row">
            <div>
              <Dialog.Title>{messages.forwardMessage}</Dialog.Title>
              <Dialog.Description>{messages.forwardMessageDescription}</Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label={messages.close}>
              <X size={18} />
            </Dialog.Close>
          </div>
          <label className="forward-target-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={messages.searchForwardTargets}
            />
          </label>
          <div className="forward-target-list">
            {visible.map((item) => {
              const key = targetKey(item.target);
              const active = selected.some((target) => targetKey(target) === key);
              return (
                <button
                  key={key}
                  className={active ? 'active' : ''}
                  onClick={() =>
                    setSelected((current) =>
                      active
                        ? current.filter((target) => targetKey(target) !== key)
                        : current.length < 10
                          ? [...current, item.target]
                          : current,
                    )
                  }
                >
                  <span className="forward-target-avatar">
                    {item.avatarUrl ? <img src={item.avatarUrl} alt="" /> : item.name.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{item.name}</strong>
                    {item.subtitle && <small>{item.subtitle}</small>}
                  </span>
                  <i>{active && <Check size={14} />}</i>
                </button>
              );
            })}
            {!targets.isPending && visible.length === 0 && (
              <p>{messages.noForwardTargets}</p>
            )}
          </div>
          <label className="field-block">
            <span>{messages.forwardNote}</span>
            <input
              value={note}
              maxLength={500}
              onChange={(event) => setNote(event.target.value)}
              placeholder={messages.forwardNotePlaceholder}
            />
          </label>
          {error && <div className="message-error">{error}</div>}
          <button
            className="primary-button forward-submit"
            disabled={busy || selected.length === 0 || !source}
            onClick={() => void submitForward()}
          >
            {busy ? <Forward className="spin" size={16} /> : <Send size={16} />}
            {messages.forwardToCount.replace('{count}', String(selected.length))}
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ForwardedMessageCard({
  snapshot,
  messages,
}: {
  snapshot: ForwardedMessageSnapshot | null;
  messages: Dictionary;
}) {
  if (!snapshot) return null;
  return (
    <div className="forwarded-message-card">
      <span className="forwarded-author-avatar">
        {snapshot.author.avatarUrl ? (
          <img src={snapshot.author.avatarUrl} alt="" />
        ) : (
          snapshot.author.displayName.slice(0, 1)
        )}
      </span>
      <span>
        <small><Forward size={12} /> {messages.forwardedMessage}</small>
        <strong>{snapshot.author.displayName}</strong>
        {snapshot.excerpt && <p>{snapshot.excerpt}</p>}
        <em>
          {snapshot.contextName} ·{' '}
          {new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(
            new Date(snapshot.createdAt),
          )}
        </em>
      </span>
    </div>
  );
}
