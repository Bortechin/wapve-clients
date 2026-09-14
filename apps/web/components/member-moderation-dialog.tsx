'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@wapve/ui';
import type { ServerMember, ServerSummary } from '@wapve/contracts';
import { Ban, Clock3, UserMinus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';

export type MemberModerationAction = 'timeout' | 'kick' | 'ban';

export function MemberModerationDialog({
  action,
  member,
  server,
  messages,
  onClose,
  onChanged,
  onNotice,
}: {
  action: MemberModerationAction | null;
  member: ServerMember;
  server: ServerSummary;
  messages: Dictionary;
  onClose: () => void;
  onChanged: () => Promise<unknown>;
  onNotice: (notice: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action) return;
    const data = new FormData(event.currentTarget);
    const reasonValue = data.get('reason');
    const reason =
      typeof reasonValue === 'string' && reasonValue.trim() ? reasonValue.trim() : undefined;
    const durationField = data.get('durationMinutes');
    const durationValue = typeof durationField === 'string' ? durationField : '10';
    const durationMinutes = durationValue === 'clear' ? null : Number(durationValue);
    const path =
      action === 'timeout'
        ? `/servers/${server.id}/members/${member.id}/timeout`
        : `/servers/${server.id}/members/${member.id}/actions/${action}`;
    const body =
      action === 'timeout'
        ? { durationMinutes, reason }
        : action === 'ban'
          ? {
              reason,
              deleteMessageSeconds:
                typeof data.get('deleteMessageSeconds') === 'string'
                  ? data.get('deleteMessageSeconds')
                  : '0',
            }
          : { reason };
    setBusy(true);
    setError('');
    try {
      await apiRequest(path, {
        method: action === 'timeout' ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      await onChanged();
      onNotice(
        action === 'timeout'
          ? durationMinutes === null
            ? messages.timeoutCleared
            : messages.memberTimedOut
          : action === 'kick'
            ? messages.memberKicked
            : messages.memberBanned,
      );
      onClose();
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  const title =
    action === 'timeout'
      ? member.timeoutUntil
        ? messages.clearTimeout
        : messages.timeout
      : action === 'kick'
        ? messages.kick
        : messages.ban;
  const ActionIcon = action === 'timeout' ? Clock3 : action === 'kick' ? UserMinus : Ban;

  return (
    <Dialog.Root open={Boolean(action)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay member-moderation-overlay" />
        <Dialog.Content className="compact-dialog member-moderation-dialog">
          <div className="member-moderation-title">
            <span
              className={`member-moderation-icon member-moderation-icon--${action ?? 'timeout'}`}
            >
              <ActionIcon size={20} />
            </span>
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>@{member.username}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label={messages.close}>
                <X size={19} />
              </button>
            </Dialog.Close>
          </div>
          <form className="member-moderation-form" onSubmit={(event) => void submit(event)}>
            {action === 'timeout' && (
              <fieldset className="moderation-duration-options">
                <legend>{messages.duration}</legend>
                {member.timeoutUntil && (
                  <label>
                    <input name="durationMinutes" value="clear" type="radio" defaultChecked />
                    <span>{messages.clearTimeout}</span>
                  </label>
                )}
                {[
                  ['1', `1 ${messages.minutes}`],
                  ['5', `5 ${messages.minutes}`],
                  ['10', `10 ${messages.minutes}`],
                  ['60', `1 ${messages.hour}`],
                  ['1440', `1 ${messages.day}`],
                  ['10080', `7 ${messages.days}`],
                ].map(([value, label], index) => (
                  <label key={value}>
                    <input
                      name="durationMinutes"
                      value={value}
                      type="radio"
                      defaultChecked={!member.timeoutUntil && index === 2}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>
            )}
            {action === 'ban' && (
              <label className="field">
                <span>{messages.deleteRecentMessages}</span>
                <select name="deleteMessageSeconds" defaultValue="0">
                  <option value="0">{messages.deleteNone}</option>
                  <option value="3600">{messages.lastHour}</option>
                  <option value="21600">{messages.lastSixHours}</option>
                  <option value="86400">{messages.lastDay}</option>
                  <option value="604800">{messages.lastSevenDays}</option>
                </select>
              </label>
            )}
            <label className="field">
              <span>{messages.reasonOptional}</span>
              <textarea name="reason" rows={4} maxLength={512} autoFocus={action !== 'timeout'} />
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <div className="member-moderation-actions">
              <Dialog.Close asChild>
                <Button type="button" variant="secondary">
                  {messages.cancel}
                </Button>
              </Dialog.Close>
              <Button
                type="submit"
                variant={action === 'timeout' ? 'primary' : 'danger'}
                disabled={busy}
              >
                {title}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
