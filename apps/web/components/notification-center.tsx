'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppNotification, Locale, NotificationPage } from '@wapve/contracts';
import {
  AtSign,
  Bell,
  CheckCheck,
  Flag,
  LoaderCircle,
  MessageCircle,
  ShieldAlert,
  Headphones,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { apiRequest } from '@/lib/api';
import type { Dictionary } from '@/lib/i18n';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

export function NotificationCenter({
  locale,
  messages,
  onNavigate,
  onChanged,
}: {
  locale: Locale;
  messages: Dictionary;
  onNavigate: (notification: AppNotification) => void;
  onChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const rootRef = useRef<HTMLDivElement>(null);
  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiRequest<NotificationPage>('/notifications?limit=30'),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const socket = io(`${SOCKET_URL}/notifications`, {
      withCredentials: true,
    });
    socket.on('notifications:changed', () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      onChanged?.();
    });
    return () => {
      socket.disconnect();
    };
  }, [onChanged, queryClient]);

  useEffect(() => {
    function close(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  async function read(notification: AppNotification) {
    if (!notification.readAt)
      await apiRequest(`/notifications/${notification.id}/read`, { method: 'PATCH', body: '{}' });
    onNavigate(notification);
    setOpen(false);
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  async function readAll() {
    await apiRequest('/notifications/read-all', { method: 'POST', body: '{}' });
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  async function clearAll() {
    await apiRequest('/notifications/clear', { method: 'POST', body: '{}' });
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  const unread = query.data?.unreadCount ?? 0;
  const visibleNotifications =
    query.data?.items.filter((item) => filter === 'all' || !item.readAt) ?? [];
  return (
    <div className="notification-center" ref={rootRef}>
      <button
        className={`icon-button notification-button${open ? ' active' : ''}`}
        aria-label={messages.notifications}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell size={18} />
        {unread > 0 && <span className="notification-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <section className="notification-panel" aria-label={messages.notifications}>
          <header>
            <div>
              <strong>{messages.notifications}</strong>
              <span>{unread ? `${unread} ${messages.unread}` : messages.allCaughtUp}</span>
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void readAll()}
                aria-label={messages.markAllRead}
                title={messages.markAllRead}
              >
                <CheckCheck size={17} />
                {messages.markAllRead}
              </button>
            )}
            {(query.data?.items.length ?? 0) > 0 && (
              <button
                type="button"
                className="notification-clear-btn"
                onClick={() => void clearAll()}
                aria-label={messages.clearNotifications ?? 'Temizle'}
                title={messages.clearNotifications ?? 'Bildirimleri temizle'}
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              type="button"
              className="notification-close"
              onClick={() => setOpen(false)}
              aria-label={messages.close}
            >
              <X size={17} />
            </button>
          </header>
          <div
            className="notification-filters"
            role="tablist"
            aria-label={messages.notificationFilter}
          >
            <button role="tab" aria-selected={filter === 'all'} onClick={() => setFilter('all')}>
              {messages.all}
            </button>
            <button
              role="tab"
              aria-selected={filter === 'unread'}
              onClick={() => setFilter('unread')}
            >
              {messages.unread}
            </button>
          </div>
          <div className="notification-list">
            {query.isPending ? (
              <div className="notification-empty">
                <LoaderCircle className="spin" /> {messages.loading}
              </div>
            ) : !visibleNotifications.length ? (
              <div className="notification-empty">
                <Bell size={28} />
                <strong>{messages.noNotifications}</strong>
                <span>{messages.noNotificationsHint}</span>
              </div>
            ) : (
              visibleNotifications.map((notification) => (
                <button
                  className={`notification-row${notification.readAt ? '' : ' unread'}`}
                  key={notification.id}
                  onClick={() => void read(notification)}
                >
                  <NotificationIcon type={notification.type} />
                  <span className="notification-copy">
                    <strong>{notificationText(notification, messages)}</strong>
                    <small>
                      {new Intl.DateTimeFormat(locale, {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(notification.createdAt))}
                    </small>
                  </span>
                  {!notification.readAt && <i />}
                </button>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function NotificationIcon({ type }: { type: AppNotification['type'] }) {
  if (type === 'MENTION') return <AtSign size={18} />;
  if (type === 'CHANNEL_MESSAGE') return <MessageCircle size={18} />;
  if (type === 'DIRECT_MESSAGE') return <MessageCircle size={18} />;
  if (type === 'FRIEND_REQUEST') return <UserPlus size={18} />;
  if (type === 'VOICE_CHANNEL_JOINED') return <Headphones size={18} />;
  if (type === 'MODERATION_ACTION') return <ShieldAlert size={18} />;
  if (type === 'CONTENT_REPORT') return <Flag size={18} />;
  return <Users size={18} />;
}

function notificationText(notification: AppNotification, messages: Dictionary): string {
  const actor = notification.actor?.displayName ?? messages.someone;
  if (notification.type === 'MENTION')
    return messages.notificationMention
      .replace('{actor}', actor)
      .replace('{channel}', notification.channel?.name ?? '');
  if (notification.type === 'CHANNEL_MESSAGE')
    return messages.notificationChannelMessage
      .replace('{actor}', actor)
      .replace('{channel}', notification.channel?.name ?? '');
  if (notification.type === 'DIRECT_MESSAGE')
    return messages.notificationDirectMessage.replace('{actor}', actor);
  if (notification.type === 'FRIEND_REQUEST')
    return messages.notificationFriendRequest.replace('{actor}', actor);
  if (notification.type === 'VOICE_CHANNEL_JOINED')
    return messages.notificationVoiceJoined
      .replace('{actor}', actor)
      .replace('{channel}', notification.channel?.name ?? '');
  if (notification.type === 'MODERATION_ACTION') {
    const action = notification.moderation?.action ?? 'WARN';
    const label = (messages.moderationNotificationActions as Record<string, string>)[action];
    const reason = notification.moderation?.reason;
    const duration = notification.moderation?.durationMinutes;
    return messages.notificationModeration
      .replace('{action}', label ?? action)
      .replace('{duration}', duration ? ` (${duration} ${messages.minutes})` : '')
      .replace('{reason}', reason ? ` — ${reason}` : '');
  }
  if (notification.type === 'CONTENT_REPORT')
    return messages.notificationContentReport.replace('{actor}', actor);
  return messages.notificationServerJoined
    .replace('{actor}', actor)
    .replace('{server}', notification.server?.name ?? '');
}
