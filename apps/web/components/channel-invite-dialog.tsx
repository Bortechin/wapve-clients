'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import { serverInviteUrl } from '@wapve/contracts';
import type {
  Friend,
  GroupConversation,
  Locale,
  ServerChannel,
  ServerInvite,
  ServerSummary,
} from '@wapve/contracts';
import { Button } from '@wapve/ui';
import { Check, Copy, Hash, Link2, Search, Send, Users, Volume2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';

const INVITE_EXPIRATIONS = [
  { hours: 1, tr: '1 saat', en: '1 hour' },
  { hours: 6, tr: '6 saat', en: '6 hours' },
  { hours: 12, tr: '12 saat', en: '12 hours' },
  { hours: 24, tr: '1 gün', en: '1 day' },
  { hours: 72, tr: '3 gün', en: '3 days' },
  { hours: 168, tr: '7 gün', en: '7 days' },
  { hours: 720, tr: '30 gün', en: '30 days' },
] as const;

const INVITE_USES = [1, 5, 10, 25, 50, 100, 1_000_000] as const;

export function ChannelInviteDialog({
  open,
  onOpenChange,
  server,
  channel,
  locale,
  messages,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: ServerSummary;
  channel: ServerChannel | null;
  locale: Locale;
  messages: Dictionary;
}) {
  const tr = locale === 'tr';
  const [tab, setTab] = useState<'friends' | 'groups'>('friends');
  const [search, setSearch] = useState('');
  const [invite, setInvite] = useState<ServerInvite | null>(null);
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [maxUses, setMaxUses] = useState(100);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const channelId = channel?.id;
  const friends = useQuery({
    queryKey: ['friends'],
    queryFn: () => apiRequest<Friend[]>('/social/friends'),
    enabled: open,
  });
  const groups = useQuery({
    queryKey: ['group-conversations'],
    queryFn: () => apiRequest<GroupConversation[]>('/dm/groups'),
    enabled: open,
  });

  useEffect(() => {
    setInvite(null);
    setSent(new Set());
    setCopied(false);
    setError('');
    setSearch('');
    setSettingsOpen(false);
    setExpiresInHours(24);
    setMaxUses(100);
    if (!open) return;
    let cancelled = false;
    void apiRequest<ServerInvite[]>(`/servers/${server.id}/invites`)
      .then(async (items) => {
        const now = Date.now();
        const existing = items.find(
          (item) =>
            !item.revokedAt &&
            new Date(item.expiresAt).getTime() > now &&
            item.usedCount < item.maxUses &&
            (item.channel?.id ?? null) === (channelId ?? null) &&
            Boolean(item.code),
        );
        if (existing) return existing;
        return apiRequest<ServerInvite>(`/servers/${server.id}/invites`, {
          method: 'POST',
          body: JSON.stringify({
            maxUses: 100,
            expiresInHours: 24,
            ...(channelId ? { channelId } : {}),
          }),
        });
      })
      .then((ready) => {
        if (!cancelled) setInvite(ready);
      })
      .catch((caught) => {
        if (!cancelled) setError(errorMessage(caught, messages));
      });
    return () => {
      cancelled = true;
    };
  }, [channelId, messages, open, server.id]);

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredFriends = useMemo(
    () =>
      (friends.data ?? []).filter(
        ({ user }) =>
          !normalizedSearch ||
          user.displayName.toLocaleLowerCase().includes(normalizedSearch) ||
          user.username.toLocaleLowerCase().includes(normalizedSearch),
      ),
    [friends.data, normalizedSearch],
  );
  const filteredGroups = useMemo(
    () =>
      (groups.data ?? []).filter(
        (group) => !normalizedSearch || group.name.toLocaleLowerCase().includes(normalizedSearch),
      ),
    [groups.data, normalizedSearch],
  );

  async function ensureInvite(): Promise<ServerInvite> {
    if (invite) return invite;
    const created = await apiRequest<ServerInvite>(`/servers/${server.id}/invites`, {
      method: 'POST',
      body: JSON.stringify({
        maxUses,
        expiresInHours,
        ...(channel ? { channelId: channel.id } : {}),
      }),
    });
    setInvite(created);
    return created;
  }

  function inviteUrl(value: ServerInvite): string {
    return serverInviteUrl(value.code);
  }

  async function sendInvite(kind: 'friend' | 'group', id: string, conversationId?: string) {
    const key = `${kind}:${id}`;
    setBusy(key);
    setError('');
    try {
      const created = await ensureInvite();
      const destination = channel
        ? `${channel.type === 'VOICE' ? '🔊' : '#'} ${server.name} · ${channel.name}`
        : server.name;
      const content = `${destination}\n${inviteUrl(created)}`;
      const path =
        kind === 'group'
          ? `/dm/groups/${id}/messages`
          : `/dm/conversations/${conversationId}/messages`;
      await apiRequest(path, { method: 'POST', body: JSON.stringify({ content }) });
      setSent((current) => new Set(current).add(key));
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(null);
    }
  }

  async function copyInvite() {
    setBusy('copy');
    setError('');
    try {
      const created = await ensureInvite();
      await navigator.clipboard.writeText(inviteUrl(created));
      setCopied(true);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(null);
    }
  }

  async function createWithSettings() {
    setBusy('settings');
    setError('');
    try {
      const created = await apiRequest<ServerInvite>(`/servers/${server.id}/invites`, {
        method: 'POST',
        body: JSON.stringify({
          maxUses,
          expiresInHours,
          ...(channel ? { channelId: channel.id } : {}),
        }),
      });
      const previous = invite;
      setInvite(created);
      setCopied(false);
      setSettingsOpen(false);
      if (previous) {
        await apiRequest(`/servers/${server.id}/invites/${previous.id}`, {
          method: 'DELETE',
        }).catch(() => undefined);
      }
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(null);
    }
  }

  const ChannelIcon = channel?.type === 'VOICE' ? Volume2 : channel ? Hash : Users;
  const expiration = INVITE_EXPIRATIONS.find((item) => item.hours === expiresInHours);
  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="compact-dialog channel-invite-dialog">
            <header className="channel-invite-head">
              <div className="channel-invite-title-icon">
                <ChannelIcon size={20} />
              </div>
              <div>
                <Dialog.Title>
                  {tr ? `${server.name} sunucusuna davet et` : `Invite people to ${server.name}`}
                </Dialog.Title>
                <Dialog.Description>
                  {channel
                    ? tr
                      ? `Alıcılar #${channel.name} kanalına gelecek`
                      : `Recipients will arrive in #${channel.name}`
                    : tr
                      ? 'Arkadaşlarını veya gruplarını seç'
                      : 'Choose friends or groups'}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button className="icon-button" aria-label={messages.close}>
                  <X size={19} />
                </button>
              </Dialog.Close>
            </header>
            <label className="channel-invite-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={tr ? 'Arkadaşlarını veya gruplarını ara' : 'Search friends or groups'}
                autoFocus
              />
            </label>
            <div className="channel-invite-tabs" role="tablist">
              <button
                className={tab === 'friends' ? 'active' : ''}
                onClick={() => setTab('friends')}
              >
                {messages.friends}
              </button>
              <button className={tab === 'groups' ? 'active' : ''} onClick={() => setTab('groups')}>
                {messages.groups}
              </button>
            </div>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <div className="channel-invite-list">
              {tab === 'friends'
                ? filteredFriends.map(({ user, conversationId }) => {
                    const key = `friend:${user.id}`;
                    return (
                      <div key={key} className="channel-invite-row">
                        <span className="user-avatar">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt="" />
                          ) : (
                            user.displayName[0]
                          )}
                        </span>
                        <span>
                          <strong>{user.displayName}</strong>
                          <small>@{user.username}</small>
                        </span>
                        <Button
                          variant="secondary"
                          disabled={busy !== null || sent.has(key)}
                          onClick={() => void sendInvite('friend', user.id, conversationId)}
                        >
                          {sent.has(key) ? <Check size={15} /> : <Send size={15} />}
                          {sent.has(key) ? messages.sent : messages.sendInvite}
                        </Button>
                      </div>
                    );
                  })
                : filteredGroups.map((group) => {
                    const key = `group:${group.id}`;
                    return (
                      <div key={key} className="channel-invite-row">
                        <span className="channel-invite-group">
                          <Users size={18} />
                        </span>
                        <span>
                          <strong>{group.name}</strong>
                          <small>
                            {group.members.length} {messages.members}
                          </small>
                        </span>
                        <Button
                          variant="secondary"
                          disabled={busy !== null || sent.has(key)}
                          onClick={() => void sendInvite('group', group.id)}
                        >
                          {sent.has(key) ? <Check size={15} /> : <Send size={15} />}
                          {sent.has(key) ? messages.sent : messages.sendInvite}
                        </Button>
                      </div>
                    );
                  })}
              {!friends.isPending &&
                !groups.isPending &&
                (tab === 'friends'
                  ? filteredFriends.length === 0
                  : filteredGroups.length === 0) && (
                  <p className="channel-invite-empty">{messages.noInviteRecipients}</p>
                )}
            </div>
            <footer className="channel-invite-copy">
              <strong>{tr ? 'Davet bağlantısı' : 'Invite link'}</strong>
              <div className="channel-invite-link-row">
                <div>
                  <Link2 size={16} />
                  <span>{invite ? inviteUrl(invite) : tr ? 'Hazırlanıyor…' : 'Preparing…'}</span>
                </div>
                <Button onClick={() => void copyInvite()} disabled={busy !== null}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? messages.copied : messages.copyInviteLink}
                </Button>
              </div>
              <span>
                {tr
                  ? `Bağlantı ${expiration?.tr ?? ''} sonra sona erer.`
                  : `Link expires after ${expiration?.en ?? ''}.`}{' '}
                <button type="button" onClick={() => setSettingsOpen(true)}>
                  {tr ? 'Davet bağlantısını düzenle' : 'Edit invite link'}
                </button>
              </span>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay invite-settings-overlay" />
          <Dialog.Content className="compact-dialog invite-link-settings-dialog">
            <header className="settings-title">
              <div>
                <Dialog.Title>
                  {tr ? 'Sunucu daveti bağlantısı ayarları' : 'Server invite link settings'}
                </Dialog.Title>
                <Dialog.Description>
                  {tr
                    ? 'Yeni bağlantının süresini ve kullanım sınırını belirle.'
                    : 'Set the lifetime and use limit for the new link.'}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button className="icon-button" aria-label={messages.close}>
                  <X size={19} />
                </button>
              </Dialog.Close>
            </header>
            <div className="form-stack">
              <label className="field">
                <span>{tr ? 'Daha sonra sona er' : 'Expire after'}</span>
                <select
                  value={expiresInHours}
                  onChange={(event) => setExpiresInHours(Number(event.target.value))}
                >
                  {INVITE_EXPIRATIONS.map((item) => (
                    <option key={item.hours} value={item.hours}>
                      {tr ? item.tr : item.en}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{tr ? 'Maksimum kullanım sayısı' : 'Maximum number of uses'}</span>
                <select
                  value={maxUses}
                  onChange={(event) => setMaxUses(Number(event.target.value))}
                >
                  {INVITE_USES.map((uses) => (
                    <option key={uses} value={uses}>
                      {uses === 1_000_000 ? (tr ? 'Limit yok' : 'No limit') : uses}
                    </option>
                  ))}
                </select>
              </label>
              <div className="invite-settings-actions">
                <Button variant="secondary" onClick={() => setSettingsOpen(false)}>
                  {tr ? 'İptal' : 'Cancel'}
                </Button>
                <Button disabled={busy !== null} onClick={() => void createWithSettings()}>
                  {tr ? 'Yeni bir bağlantı oluştur' : 'Create a new link'}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
