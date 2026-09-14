'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChannelNotificationPreference,
  NotificationLevel,
  NotificationMute,
  ServerChannel,
} from '@wapve/contracts';
import {
  Bell,
  BellOff,
  Check,
  ChevronRight,
  Copy,
  CopyPlus,
  Link2,
  MailCheck,
  MessageSquare,
  Settings,
  Trash2,
  UserPlus,
  VolumeX,
  X,
} from 'lucide-react';
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { apiRequest } from '@/lib/api';
import type { Dictionary } from '@/lib/i18n';

type Position = { left: number; top: number };

export function ChannelContextMenu({
  serverId,
  channel,
  messages,
  children,
  canManage,
  onSettings,
  onInvite,
  onOpenChat,
  serverPublicId,
  canInvite,
  onNotice,
}: {
  serverId: string;
  channel: ServerChannel;
  messages: Dictionary;
  children: ReactNode;
  canManage: boolean;
  onSettings: () => void;
  onInvite: () => void;
  onOpenChat: () => void;
  serverPublicId: string;
  canInvite: boolean;
  onNotice: (notice: string) => void;
}) {
  const tr = typeof document === 'undefined' || document.documentElement.lang !== 'en';
  const queryClient = useQueryClient();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [submenu, setSubmenu] = useState<'mute' | 'notifications' | null>(null);
  const [busy, setBusy] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState(channel.name);
  const [duplicateError, setDuplicateError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const preference = useQuery({
    queryKey: ['channel-notification-preference', channel.id],
    queryFn: () =>
      apiRequest<ChannelNotificationPreference>(
        `/servers/${serverId}/channels/${channel.id}/notification-preference`,
      ),
    enabled: Boolean(position),
  });

  useEffect(() => {
    if (!position) return;
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setPosition(null);
    };
    const closeOnKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setPosition(null);
    };
    const closeOnViewportChange = () => setPosition(null);
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', closeOnKey);
    window.addEventListener('resize', closeOnViewportChange);
    window.addEventListener('scroll', closeOnViewportChange, true);
    requestAnimationFrame(() =>
      menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus(),
    );
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', closeOnKey);
      window.removeEventListener('resize', closeOnViewportChange);
      window.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, [position]);

  function open(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setSubmenu(null);
    setPosition({
      left: Math.max(8, Math.min(event.clientX, window.innerWidth - 254)),
      top: Math.max(8, Math.min(event.clientY, window.innerHeight - 280)),
    });
  }

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
    ];
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === 'ArrowDown'
            ? (current + 1 + items.length) % items.length
            : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  async function update(input: { level?: NotificationLevel | null; mute?: NotificationMute }) {
    setBusy(true);
    try {
      await apiRequest(`/servers/${serverId}/channels/${channel.id}/notification-preference`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
      await preference.refetch();
      onNotice(messages.notificationPreferenceSaved);
      setPosition(null);
    } finally {
      setBusy(false);
    }
  }

  async function markRead() {
    setBusy(true);
    try {
      await apiRequest(`/servers/${serverId}/channels/${channel.id}/messages/read`, {
        method: 'POST',
        body: '{}',
      });
      await queryClient.invalidateQueries({ queryKey: ['channel-unread'] });
      setPosition(null);
    } finally {
      setBusy(false);
    }
  }

  async function copyChannelLink() {
    await navigator.clipboard.writeText(
      `${window.location.origin}/channels/${serverPublicId}/${channel.publicId}`,
    );
    onNotice(messages.channelLinkCopied);
    setPosition(null);
  }

  async function duplicateChannel() {
    const name = duplicateName.trim();
    if (!name) return;
    setBusy(true);
    setDuplicateError('');
    try {
      await apiRequest(`/servers/${serverId}/channels/${channel.id}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      await queryClient.invalidateQueries({ queryKey: ['server-channels', serverId] });
      setDuplicateOpen(false);
      onNotice(messages.channelDuplicated ?? 'Kanal çoğaltıldı.');
    } catch {
      setDuplicateError('Kanal çoğaltılamadı.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteChannel() {
    setBusy(true);
    setDeleteError('');
    try {
      await apiRequest(`/servers/${serverId}/channels/${channel.id}`, { method: 'DELETE' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['server-channels', serverId] }),
        queryClient.invalidateQueries({ queryKey: ['channel-unread', serverId] }),
      ]);
      setDeleteOpen(false);
    } catch {
      setDeleteError(tr ? 'Kanal silinemedi.' : 'The channel could not be deleted.');
    } finally {
      setBusy(false);
    }
  }

  const level = preference.data?.level ?? null;
  const effectiveLevel = preference.data?.effectiveLevel ?? 'MENTIONS_ONLY';
  const submenuStyle = position
    ? {
        left: position.left + 500 < window.innerWidth ? 250 : -254,
        top: Math.max(0, Math.min(38, window.innerHeight - position.top - 330)),
      }
    : undefined;

  return (
    <>
      <div className="channel-context-trigger" onContextMenu={open}>
        {children}
      </div>
      {position &&
        createPortal(
          <div
            ref={menuRef}
            className="server-context-menu channel-context-menu"
            role="menu"
            aria-label={`${channel.name} ${messages.channelActions}`}
            style={position}
            onContextMenu={(event) => event.preventDefault()}
            onKeyDown={moveFocus}
          >
            {channel.type === 'TEXT' && (
              <button role="menuitem" disabled={busy} onClick={() => void markRead()}>
                <MailCheck size={16} /> {messages.markChannelRead}
              </button>
            )}
            <button
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={submenu === 'mute'}
              onMouseEnter={() => setSubmenu('mute')}
              onClick={() => setSubmenu((current) => (current === 'mute' ? null : 'mute'))}
            >
              {preference.data?.isMuted ? <BellOff size={16} /> : <VolumeX size={16} />}
              <span>{preference.data?.isMuted ? messages.unmute : messages.muteChannel}</span>
              <ChevronRight className="context-menu-chevron" size={15} />
            </button>
            <button
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={submenu === 'notifications'}
              onMouseEnter={() => setSubmenu('notifications')}
              onClick={() =>
                setSubmenu((current) => (current === 'notifications' ? null : 'notifications'))
              }
            >
              <Bell size={16} />
              <span className="context-menu-copy">
                {messages.notificationSettings}
                <small>
                  {level === null
                    ? messages.notificationInherit
                    : effectiveLevel === 'ALL_MESSAGES'
                      ? messages.notificationAllMessages
                      : effectiveLevel === 'NOTHING'
                        ? messages.notificationNothing
                        : messages.notificationMentionsOnly}
                </small>
              </span>
              <ChevronRight className="context-menu-chevron" size={15} />
            </button>
            {canInvite && (
              <button
                role="menuitem"
                onClick={() => {
                  setPosition(null);
                  onInvite();
                }}
              >
                <UserPlus size={16} />
                {channel.type === 'VOICE' ? messages.inviteToVoice : messages.inviteToChannel}
              </button>
            )}
            <button role="menuitem" onClick={() => void copyChannelLink()}>
              <Link2 size={16} /> {messages.copyChannelLink}
            </button>
            {channel.type === 'VOICE' && (
              <button
                role="menuitem"
                onClick={() => {
                  setPosition(null);
                  onOpenChat();
                }}
              >
                <MessageSquare size={16} /> {messages.openVoiceChannelChat}
              </button>
            )}
            {canManage && (
              <>
                <button
                  role="menuitem"
                  onClick={() => {
                    setPosition(null);
                    setDuplicateName(channel.name);
                    setDuplicateError('');
                    setDuplicateOpen(true);
                  }}
                >
                  <CopyPlus size={16} /> {messages.duplicateChannel ?? 'Kanalı çoğalt'}
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setPosition(null);
                    onSettings();
                  }}
                >
                  <Settings size={16} /> {messages.channelSettings}
                </button>
                <button
                  className="context-menu-danger"
                  role="menuitem"
                  onClick={() => {
                    setPosition(null);
                    setDeleteError('');
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 size={16} />
                  {tr ? 'Kanalı sil' : 'Delete channel'}
                </button>
              </>
            )}
            <div className="member-context-separator" />
            <button
              role="menuitem"
              onClick={() => {
                void navigator.clipboard.writeText(channel.publicId);
                setPosition(null);
              }}
            >
              <Copy size={16} /> {messages.copyChannelId}
            </button>
            {submenu === 'mute' && submenuStyle && (
              <div
                className="server-context-menu server-context-submenu"
                role="menu"
                style={submenuStyle}
              >
                {(
                  [
                    ['UNMUTED', messages.unmute],
                    ['MINUTES_15', messages.mute15Minutes],
                    ['HOUR_1', messages.mute1Hour],
                    ['HOURS_3', messages.mute3Hours],
                    ['HOURS_8', messages.mute8Hours],
                    ['HOURS_24', messages.mute24Hours],
                    ['FOREVER', messages.muteForever],
                  ] as const satisfies ReadonlyArray<readonly [NotificationMute, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    role="menuitemradio"
                    disabled={busy}
                    onClick={() => void update({ mute: value })}
                  >
                    {value === 'UNMUTED' && !preference.data?.isMuted ? <Check size={15} /> : <i />}
                    {label}
                  </button>
                ))}
              </div>
            )}
            {submenu === 'notifications' && submenuStyle && (
              <div
                className="server-context-menu server-context-submenu"
                role="menu"
                style={submenuStyle}
              >
                {(
                  [
                    [null, messages.notificationInherit],
                    ['ALL_MESSAGES', messages.notificationAllMessages],
                    ['MENTIONS_ONLY', messages.notificationMentionsOnly],
                    ['NOTHING', messages.notificationNothing],
                  ] as const satisfies ReadonlyArray<readonly [NotificationLevel | null, string]>
                ).map(([value, label]) => (
                  <button
                    key={value ?? 'inherit'}
                    role="menuitemradio"
                    aria-checked={level === value}
                    disabled={busy}
                    onClick={() => void update({ level: value })}
                  >
                    {level === value ? <Check size={15} /> : <i />}
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>,
          document.body,
        )}
      <Dialog.Root open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="duplicate-channel-dialog">
            <Dialog.Title>{messages.duplicateChannel ?? 'Kanalı Çoğalt'}</Dialog.Title>
            <Dialog.Description>
              {messages.duplicateChannelDescription ??
                'Aynı izinlere, kullanıcı limitine ve bit hızına sahip yeni kanal kategorinin en altına eklenir.'}
            </Dialog.Description>
            <label>
              <span>{messages.channelName}</span>
              <input
                autoFocus
                value={duplicateName}
                maxLength={50}
                onChange={(event) => setDuplicateName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void duplicateChannel();
                }}
              />
            </label>
            {duplicateError && <p className="form-error">{duplicateError}</p>}
            <div>
              <Dialog.Close disabled={busy}>{messages.cancel}</Dialog.Close>
              <button
                disabled={busy || !duplicateName.trim()}
                onClick={() => void duplicateChannel()}
              >
                {busy ? '…' : messages.createChannel}
              </button>
            </div>
            <Dialog.Close className="dialog-icon-close" aria-label={messages.close}>
              ×
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={deleteOpen} onOpenChange={(open) => !busy && setDeleteOpen(open)}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="channel-delete-dialog">
            <Dialog.Close
              className="channel-delete-close"
              aria-label={messages.close}
              disabled={busy}
            >
              <X size={20} />
            </Dialog.Close>
            <Dialog.Title>{tr ? 'Kanalı Sil' : 'Delete Channel'}</Dialog.Title>
            <Dialog.Description>
              <strong>#{channel.name}</strong>{' '}
              {tr
                ? 'kanalı kalıcı olarak silinecek. Bu işlem geri alınamaz.'
                : 'will be deleted permanently. This action cannot be undone.'}
            </Dialog.Description>
            {deleteError && <p className="form-error">{deleteError}</p>}
            <footer>
              <Dialog.Close disabled={busy}>{messages.cancel}</Dialog.Close>
              <button type="button" disabled={busy} onClick={() => void deleteChannel()}>
                {busy ? '…' : tr ? 'Kanalı Sil' : 'Delete Channel'}
              </button>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
