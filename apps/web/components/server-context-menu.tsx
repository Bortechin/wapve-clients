'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import type {
  NotificationLevel,
  NotificationMute,
  ServerNotificationPreference,
  ServerSummary,
  ServerSupportOverview,
} from '@wapve/contracts';
import {
  Bell,
  BellOff,
  Check,
  ChevronRight,
  Copy,
  DoorOpen,
  Flag,
  Link2,
  MailCheck,
  Settings,
  VolumeX,
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
import type { Dictionary } from '@/lib/i18n';
import { apiRequest } from '@/lib/api';
import { ContentReportDialog } from './content-report-dialog';

type MenuPosition = { left: number; top: number };

export function ServerContextMenu({
  server,
  locale,
  messages,
  children,
  onInvite,
  onSettings,
  onSupport,
  canSupport = true,
  onLeave,
  onMarkRead,
  onNotice,
}: {
  server: ServerSummary;
  locale: 'tr' | 'en';
  messages: Dictionary;
  children: ReactNode;
  onInvite: () => void;
  onSettings: () => void;
  onSupport: () => void;
  canSupport?: boolean;
  onLeave: () => Promise<void>;
  onMarkRead: () => Promise<void>;
  onNotice: (notice: string) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [submenu, setSubmenu] = useState<'mute' | 'notifications' | null>(null);
  const preference = useQuery({
    queryKey: ['server-notification-preference', server.id],
    queryFn: () =>
      apiRequest<ServerNotificationPreference>(`/servers/${server.id}/notification-preference`),
    enabled: Boolean(position),
  });
  const supportState = useQuery({
    queryKey: ['server-support', server.id],
    queryFn: () => apiRequest<ServerSupportOverview>(`/premium/servers/${server.id}`),
    enabled: Boolean(position && canSupport),
    staleTime: 20_000,
  });
  const boostEnabled = canSupport && !supportState.isPending && (supportState.data?.canSupport ?? true);

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

  function open(event: MouseEvent<HTMLSpanElement>) {
    event.preventDefault();
    event.stopPropagation();
    const width = 246;
    const height = 430;
    setSubmenu(null);
    setPosition({
      left: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8)),
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

  async function copyId() {
    await navigator.clipboard.writeText(server.publicId);
    setPosition(null);
  }

  async function leave() {
    setBusy(true);
    try {
      await onLeave();
      setPosition(null);
      setLeaveDialogOpen(false);
    } catch {
      return;
    } finally {
      setBusy(false);
    }
  }

  async function updatePreference(input: { level?: NotificationLevel; mute?: NotificationMute }) {
    setBusy(true);
    try {
      await apiRequest(`/servers/${server.id}/notification-preference`, {
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
      await onMarkRead();
      setPosition(null);
    } finally {
      setBusy(false);
    }
  }

  const level = preference.data?.level ?? 'MENTIONS_ONLY';
  const submenuStyle = position
    ? {
        left: position.left + 500 < window.innerWidth ? 250 : -254,
        top: Math.max(0, Math.min(74, window.innerHeight - position.top - 330)),
      }
    : undefined;

  return (
    <>
      <span className="server-context-trigger" onContextMenu={open}>
        {children}
      </span>
      {position &&
        createPortal(
          <div
            ref={menuRef}
            className="server-context-menu"
            role="menu"
            aria-label={`${server.name} ${messages.serverActions}`}
            style={position}
            onContextMenu={(event) => event.preventDefault()}
            onKeyDown={moveFocus}
          >
            <button role="menuitem" disabled={busy} onClick={() => void markRead()}>
              <MailCheck size={16} /> {messages.markServerRead}
            </button>
            {server.permissions.includes('CREATE_INVITES') && (
              <button
                role="menuitem"
                onClick={() => {
                  setPosition(null);
                  onInvite();
                }}
              >
                <Link2 size={16} /> {messages.invitePeople}
              </button>
            )}
            <button
              className="premium-context-action"
              role="menuitem"
              disabled={!boostEnabled}
              title={supportState.data?.supportDisabledReason === 'ALREADY_SUPPORTED' ? 'Bu sunucu zaten destekleniyor' : undefined}
              onClick={() => {
                setPosition(null);
                onSupport();
              }}
            >
              <img className="woost-icon" src="/brand/woost-icon.png" width="19" height="19" alt="" /> Woost yap
            </button>
            <div className="member-context-separator" />
            <button
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={submenu === 'mute'}
              onMouseEnter={() => setSubmenu('mute')}
              onFocus={() => setSubmenu('mute')}
              onClick={() => setSubmenu((current) => (current === 'mute' ? null : 'mute'))}
            >
              {preference.data?.isMuted ? <BellOff size={16} /> : <VolumeX size={16} />}
              <span>{preference.data?.isMuted ? messages.unmute : messages.muteServer}</span>
              <ChevronRight className="context-menu-chevron" size={15} />
            </button>
            <button
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={submenu === 'notifications'}
              onMouseEnter={() => setSubmenu('notifications')}
              onFocus={() => setSubmenu('notifications')}
              onClick={() =>
                setSubmenu((current) => (current === 'notifications' ? null : 'notifications'))
              }
            >
              <Bell size={16} />
              <span className="context-menu-copy">
                {messages.notificationSettings}
                <small>
                  {level === 'ALL_MESSAGES'
                    ? messages.notificationAllMessages
                    : level === 'NOTHING'
                      ? messages.notificationNothing
                      : messages.notificationMentionsOnly}
                </small>
              </span>
              <ChevronRight className="context-menu-chevron" size={15} />
            </button>
            {(server.role === 'OWNER' || server.permissions.includes('MANAGE_SERVER')) && (
              <button
                role="menuitem"
                onClick={() => {
                  setPosition(null);
                  onSettings();
                }}
              >
                <Settings size={16} /> {messages.serverSettings}
              </button>
            )}
            <div className="member-context-separator" />
            <button role="menuitem" onClick={() => void copyId()}>
              <Copy size={16} /> {messages.copyServerId}
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setPosition(null);
                setReportOpen(true);
              }}
            >
              <Flag size={16} /> {messages.reportServer}
            </button>
            <button
              className="danger"
              role="menuitem"
              disabled={busy || server.role === 'OWNER'}
              title={server.role === 'OWNER' ? messages.errors.ownerCannotLeave : undefined}
              onClick={() => {
                setPosition(null);
                setLeaveDialogOpen(true);
              }}
            >
              <DoorOpen size={16} />
              {messages.leaveServer}
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
                    onClick={() => void updatePreference({ mute: value })}
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
                    ['ALL_MESSAGES', messages.notificationAllMessages],
                    ['MENTIONS_ONLY', messages.notificationMentionsOnly],
                    ['NOTHING', messages.notificationNothing],
                  ] as const satisfies ReadonlyArray<readonly [NotificationLevel, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    role="menuitemradio"
                    aria-checked={level === value}
                    disabled={busy}
                    onClick={() => void updatePreference({ level: value })}
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
      <Dialog.Root open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="leave-server-dialog">
            <Dialog.Title>
              {locale === 'tr' ? `${server.name} Sunucusundan Ayrıl` : `Leave ${server.name}`}
            </Dialog.Title>
            <Dialog.Description>
              {locale === 'tr'
                ? `${server.name} sunucusundan ayrılmak istediğine emin misin? Tekrar davet edilmediğin sürece bu sunucuya yeniden katılamazsın.`
                : `Are you sure you want to leave ${server.name}? You cannot rejoin unless you are invited again.`}
            </Dialog.Description>
            <div className="leave-server-actions">
              <Dialog.Close disabled={busy}>{locale === 'tr' ? 'İptal' : 'Cancel'}</Dialog.Close>
              <button className="danger" disabled={busy} onClick={() => void leave()}>
                {busy
                  ? locale === 'tr'
                    ? 'Ayrılınıyor…'
                    : 'Leaving…'
                  : locale === 'tr'
                    ? 'Sunucudan Ayrıl'
                    : 'Leave Server'}
              </button>
            </div>
            <Dialog.Close className="dialog-icon-close" aria-label={messages.close}>×</Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <ContentReportDialog
        target={reportOpen ? { type: 'SERVER', id: server.id, label: server.name } : null}
        locale={locale}
        messages={messages}
        onClose={() => setReportOpen(false)}
      />
    </>
  );
}
