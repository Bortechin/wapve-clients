'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BlockedUser,
  Friend,
  FriendRequests,
  MutualConnections,
  ServerMember,
  SocialUser,
  UserProfile,
  UserNote,
} from '@wapve/contracts';
import {
  LockKeyhole,
  Check,
  Copy,
  Flag,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  ShieldBan,
  Trash2,
  UserMinus,
  UserRoundPlus,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';
import { PlatformOwnerIcon } from './platform-owner-icon';
import { AlphaMemberIcon } from './alpha-member-icon';
import { ContentReportDialog } from './content-report-dialog';
import { WapvePlusBadge } from './wapve-plus-badge';
import { avatarDecorationAsset, profileFrameAsset } from './premium-cosmetic-registry';
import { GeneratedProfileFrame } from './generated-profile-frame';
import { ServerTagChip } from './server-tag-chip';
import { ProfileGameActivity } from './game-status';
import { CustomStatusEmoji } from './custom-status-emoji';
import privacyStyles from './privacy-settings.module.css';

export type ProfileCardUser = SocialUser | ServerMember;

export type ProfileAnchor = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>;

export type UserProfileTarget = {
  user: ProfileCardUser;
  anchor: ProfileAnchor;
  editNote?: boolean;
};

export type OpenUserProfile = (
  user: ProfileCardUser,
  anchor: HTMLElement | ProfileAnchor,
  options?: { editNote?: boolean },
) => void;

export function profileAnchor(element: HTMLElement): ProfileAnchor {
  const rect = element.getBoundingClientRect();
  return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
}

export function profileTarget(
  user: ProfileCardUser,
  anchor: HTMLElement | ProfileAnchor,
  options?: { editNote?: boolean },
): UserProfileTarget {
  return {
    user,
    anchor: 'getBoundingClientRect' in anchor ? profileAnchor(anchor) : anchor,
    ...(options?.editNote ? { editNote: true } : {}),
  };
}

export function UserProfilePopover({
  target,
  currentUserId,
  locale,
  messages,
  onClose,
  onMessage,
  onServer,
  onCurrentUser,
  onOpenPremium,
}: {
  target: UserProfileTarget | null;
  currentUserId: string;
  locale: string;
  messages: Dictionary;
  onClose: () => void;
  onMessage: (conversationId: string) => void;
  onServer: (serverId: string) => void;
  onCurrentUser: (user: UserProfile) => void;
  onOpenPremium?: () => void;
}) {
  const queryClient = useQueryClient();
  const cardRef = useRef<HTMLElement>(null);
  const [position, setPosition] = useState({ left: -9999, top: -9999 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [statusEmoji, setStatusEmoji] = useState<string | null>(null);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [bioOverflowing, setBioOverflowing] = useState(false);
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [statusOverflowing, setStatusOverflowing] = useState(false);
  const bioRef = useRef<HTMLParagraphElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const enabled = Boolean(target && target.user.id !== currentUserId && !target.user.system);
  const friends = useQuery({
    queryKey: ['friends'],
    queryFn: () => apiRequest<Friend[]>('/social/friends'),
    enabled,
  });
  const requests = useQuery({
    queryKey: ['friend-requests'],
    queryFn: () => apiRequest<FriendRequests>('/social/requests'),
    enabled,
  });
  const blocks = useQuery({
    queryKey: ['blocks'],
    queryFn: () => apiRequest<BlockedUser[]>('/social/blocks'),
    enabled,
  });
  const noteQuery = useQuery({
    queryKey: ['user-note', target?.user.id],
    queryFn: () => apiRequest<UserNote | null>(`/users/${target?.user.id}/note`),
    enabled,
  });
  const mutuals = useQuery({
    queryKey: ['user-mutuals', target?.user.id],
    queryFn: () => apiRequest<MutualConnections>(`/social/users/${target?.user.id}/mutuals`),
    enabled,
  });
  const publicProfile = useQuery({
    queryKey: ['social-profile', target?.user.id],
    queryFn: () => apiRequest<SocialUser>(`/social/users/${target?.user.id}/profile`),
    enabled: Boolean(target),
  });
  const resolvedStatusText = publicProfile.data
    ? publicProfile.data.customStatusText
    : target?.user.customStatusText;
  const resolvedStatusEmoji = publicProfile.data
    ? publicProfile.data.customStatusEmoji
    : target?.user.customStatusEmoji;

  const [noteDraft, setNoteDraft] = useState('');
  const [editingNote, setEditingNote] = useState(false);

  useEffect(() => {
    if (noteQuery.data) {
      setNoteDraft(noteQuery.data.content);
    } else {
      setNoteDraft('');
    }
  }, [noteQuery.data]);

  useEffect(() => {
    setEditingNote(Boolean(target?.editNote && target.user.id !== currentUserId));
  }, [currentUserId, target?.editNote, target?.user.id]);

  useEffect(() => {
    setStatusText(resolvedStatusText ?? '');
    setStatusEmoji(resolvedStatusEmoji ?? null);
    setEditingStatus(false);
    setStatusExpanded(false);
    setBioExpanded(false);
  }, [resolvedStatusEmoji, resolvedStatusText, target?.user.id]);

  useLayoutEffect(() => {
    const status = statusRef.current;
    if (!status || editingStatus || statusExpanded) return;
    const measure = () => setStatusOverflowing(status.scrollWidth > status.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(status);
    return () => observer.disconnect();
  }, [editingStatus, statusEmoji, statusExpanded, statusText, target?.user.id]);

  useLayoutEffect(() => {
    const biography = bioRef.current;
    if (!biography || bioExpanded) return;
    setBioOverflowing(biography.scrollHeight > biography.clientHeight + 1);
  }, [bioExpanded, target?.user.bio, target?.user.id]);

  useLayoutEffect(() => {
    if (!target || !cardRef.current) return;
    const card = cardRef.current;
    const place = () => {
      const bounds = card.getBoundingClientRect();
      const hasProfileFrame = card.classList.contains('has-profile-frame');
      const horizontalGap = hasProfileFrame ? 30 : 10;
      const verticalGap = hasProfileFrame ? 78 : 10;
      const preferredLeft =
        target.anchor.left >= bounds.width + horizontalGap
          ? target.anchor.left - bounds.width - horizontalGap
          : target.anchor.right + horizontalGap;
      setPosition({
        left: Math.max(
          horizontalGap,
          Math.min(preferredLeft, window.innerWidth - bounds.width - horizontalGap),
        ),
        top: Math.max(
          verticalGap,
          Math.min(target.anchor.top, window.innerHeight - bounds.height - verticalGap),
        ),
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(card);
    window.addEventListener('resize', place);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [publicProfile.data?.premium?.profileEffect, target]);

  useEffect(() => {
    if (!target) return;
    const closeOnPointer = (event: PointerEvent) => {
      if (!cardRef.current?.contains(event.target as Node)) onClose();
    };
    const closeOnKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', closeOnPointer);
    window.addEventListener('keydown', closeOnKey);
    return () => {
      window.removeEventListener('pointerdown', closeOnPointer);
      window.removeEventListener('keydown', closeOnKey);
    };
  }, [onClose, target]);

  if (!target || typeof document === 'undefined') return null;
  const user = publicProfile.data ?? target.user;
  const premium = 'premium' in user ? user.premium : undefined;
  const profileFrame = profileFrameAsset(premium?.profileEffect);
  const avatarDecoration = avatarDecorationAsset(premium?.avatarDecoration);
  const friend = friends.data?.find((item) => item.user.id === user.id);
  const incoming = requests.data?.incoming.find((item) => item.user.id === user.id);
  const outgoing = requests.data?.outgoing.find((item) => item.user.id === user.id);
  const blocked = blocks.data?.find((item) => item.user.id === user.id);
  const serverMember = 'roles' in user ? user : null;

  async function mutate(path: string, method: 'POST' | 'DELETE', body?: object) {
    setBusy(true);
    setError('');
    try {
      await apiRequest(path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['friends'] }),
        queryClient.invalidateQueries({ queryKey: ['friend-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['blocks'] }),
        queryClient.invalidateQueries({ queryKey: ['dm-conversations'] }),
      ]);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function handleDirectMessage() {
    if (friend?.conversationId) {
      onMessage(friend.conversationId);
      onClose();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await apiRequest<{ id: string }>('/dm/conversations', {
        method: 'POST',
        body: JSON.stringify({ recipientId: user.id }),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dm-conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['direct-conversations'] }),
      ]);
      onMessage(res.id);
      onClose();
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function updateOwnStatus(input: {
    customStatusText: string | null;
    customStatusEmoji?: string | null;
  }) {
    setBusy(true);
    setError('');
    try {
      const next = await apiRequest<UserProfile>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
      setStatusText(next.customStatusText ?? '');
      setStatusEmoji(next.customStatusEmoji);
      setEditingStatus(false);
      onCurrentUser(next);
      await queryClient.invalidateQueries({ queryKey: ['session'] });
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <section
      ref={cardRef}
      className={`user-profile-popover${premium?.active ? ' premium-profile' : ''}${profileFrame?.kind === 'frame' ? ' has-profile-frame' : profileFrame ? ' has-profile-overlay' : ''}`}
      role="dialog"
      aria-label={user.displayName}
      style={{ left: position.left, top: position.top }}
    >
      <div className="profile-popover-scroll">
        <button className="profile-popover-close" aria-label={messages.close} onClick={onClose}>
          ×
        </button>
        {user.id !== currentUserId && !user.system && (
          <div className="profile-popover-tools">
            {friend ? (
              <button
                className="danger-soft"
                disabled={busy}
                aria-label={messages.removeFriend}
                title={messages.removeFriend}
                onClick={() => void mutate(`/social/friends/${user.id}`, 'DELETE')}
              >
                <UserMinus size={17} />
              </button>
            ) : incoming ? (
              <button
                disabled={busy}
                aria-label={messages.accept}
                title={messages.accept}
                onClick={() => void mutate(`/social/requests/${incoming.id}/accept`, 'POST')}
              >
                <Check size={17} />
              </button>
            ) : blocked ? (
              <button
                disabled={busy}
                aria-label={messages.unblock}
                title={messages.unblock}
                onClick={() => void mutate(`/social/blocks/${user.id}`, 'DELETE')}
              >
                <ShieldBan size={17} />
              </button>
            ) : (
              <button
                disabled={busy || Boolean(outgoing)}
                aria-label={outgoing ? messages.friendRequestPending : messages.addFriend}
                title={outgoing ? messages.friendRequestPending : messages.addFriend}
                onClick={() => void mutate('/social/requests', 'POST', { username: user.username })}
              >
                {outgoing ? <Check size={17} /> : <UserRoundPlus size={17} />}
              </button>
            )}
            <div className="profile-popover-action-shell">
              <button
                aria-label={messages.memberActions}
                aria-expanded={actionMenuOpen}
                onClick={() => setActionMenuOpen((open) => !open)}
              >
                <MoreHorizontal size={18} />
              </button>
              {actionMenuOpen && (
                <div className="profile-popover-action-menu">
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(user.publicId);
                      setActionMenuOpen(false);
                    }}
                  >
                    <Copy size={15} /> {messages.copyUserId}
                  </button>
                  <button
                    onClick={() => {
                      setActionMenuOpen(false);
                      setReportOpen(true);
                    }}
                  >
                    <Flag size={15} /> {messages.reportUser}
                  </button>
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() =>
                      void mutate(
                        blocked ? `/social/blocks/${user.id}` : '/social/blocks',
                        blocked ? 'DELETE' : 'POST',
                        blocked ? undefined : { userId: user.id },
                      ).then(() => setActionMenuOpen(false))
                    }
                  >
                    <ShieldBan size={15} /> {blocked ? messages.unblock : messages.blockUser}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="profile-card-banner">
          {user.bannerUrl && <img src={user.bannerUrl} alt="" />}
        </div>
        <div
          className={`profile-card-avatar${premium?.avatarDecoration ? ` premium-avatar-${premium.avatarDecoration.toLowerCase().replaceAll('_', '-')}` : ''}`}
        >
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.displayName.slice(0, 1)}
          {avatarDecoration && (
            <img className="generated-avatar-decoration" src={avatarDecoration} alt="" />
          )}
          <i className={`status-dot ${user.status.toLowerCase()}`} />
        </div>
        {(statusText || statusEmoji || (user.id === currentUserId && editingStatus)) && (
          <div
            className={`profile-card-custom-status${user.id === currentUserId ? ' editable' : ''}${statusExpanded ? ' expanded' : ''}`}
          >
            {editingStatus ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void updateOwnStatus({ customStatusText: statusText.trim() || null });
                }}
              >
                <input
                  autoFocus
                  maxLength={128}
                  value={statusText}
                  onChange={(event) => setStatusText(event.target.value)}
                  placeholder={messages.setCustomStatus}
                />
                <button type="submit" disabled={busy} aria-label={messages.save}>
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  aria-label={messages.close}
                  onClick={() => {
                    setStatusText(user.customStatusText ?? '');
                    setEditingStatus(false);
                  }}
                >
                  <X size={14} />
                </button>
              </form>
            ) : (
              <>
                <span
                  ref={statusRef}
                  className={`profile-card-status-copy${statusOverflowing || statusExpanded ? ' is-expandable' : ''}`}
                  role={statusOverflowing || statusExpanded ? 'button' : undefined}
                  tabIndex={statusOverflowing || statusExpanded ? 0 : undefined}
                  aria-expanded={statusOverflowing || statusExpanded ? statusExpanded : undefined}
                  title={statusOverflowing && !statusExpanded ? statusText : undefined}
                  onClick={() => {
                    if (statusOverflowing || statusExpanded) {
                      setStatusExpanded((expanded) => !expanded);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (
                      (statusOverflowing || statusExpanded) &&
                      (event.key === 'Enter' || event.key === ' ')
                    ) {
                      event.preventDefault();
                      setStatusExpanded((expanded) => !expanded);
                    }
                  }}
                >
                  {statusEmoji && (
                    <i>
                      <CustomStatusEmoji value={statusEmoji} />
                    </i>
                  )}
                  {statusText}
                </span>
                {user.id === currentUserId && (
                  <span className="profile-card-status-actions">
                    <button
                      type="button"
                      aria-label={messages.editStatusMessage}
                      title={messages.editStatusMessage}
                      onClick={() => setEditingStatus(true)}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={messages.deleteStatusMessage}
                      title={messages.deleteStatusMessage}
                      onClick={() =>
                        void updateOwnStatus({ customStatusText: null, customStatusEmoji: null })
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                )}
              </>
            )}
          </div>
        )}
        <div className="profile-card-body">
          <div className="profile-card-identity">
            <strong>{user.displayName}</strong>
            {user.serverTag && <ServerTagChip tag={user.serverTag} compact />}
          </div>
          <span>@{user.username}</span>
          {!(('profileRestricted' in user) && user.profileRestricted) && (user.badges.length > 0 || premium?.active) && (
            <div className="profile-badge-row">
              {premium?.active && (
                <WapvePlusBadge size={30} {...(onOpenPremium ? { onClick: onOpenPremium } : {})} />
              )}
              <PlatformOwnerIcon badges={user.badges} locale={locale} size={27} />
              <AlphaMemberIcon badges={user.badges} locale={locale} size={27} />
            </div>
          )}
          {user.system && (
            <div className="profile-card-section">
              <b>{locale === 'tr' ? 'RESMÎ SİSTEM HESABI' : 'OFFICIAL SYSTEM ACCOUNT'}</b>
              <span>
                {locale === 'tr'
                  ? 'Wapve yalnızca gerekli hesap, güvenlik ve platform bildirimlerini buradan gönderir. Bu profile mesaj gönderilemez veya arama başlatılamaz.'
                  : 'Wapve only sends necessary account, security, and platform notices here. This profile cannot receive messages or calls.'}
              </span>
            </div>
          )}
          {'profileRestricted' in user && user.profileRestricted && (
            <div className={privacyStyles.privateProfile}>
              <LockKeyhole size={18} />
              <div>
                <strong>{locale === 'tr' ? 'Özel profil' : 'Private profile'}</strong>
                <p>
                  {locale === 'tr'
                    ? 'Bu kişi profilini sınırlı paylaşıyor. Daha fazlasını görmek için arkadaş olabilirsiniz.'
                    : 'This person shares a limited profile. Become friends to see more.'}
                </p>
              </div>
            </div>
          )}
          {user.bio && (
            <div className="profile-card-section profile-card-bio">
              <b>{messages.aboutMe}</b>
              <p ref={bioRef} className={bioExpanded ? 'expanded' : 'clamped'}>
                {user.bio}
              </p>
              {(bioOverflowing || bioExpanded) && (
                <button
                  type="button"
                  className="profile-card-bio-toggle"
                  onClick={() => setBioExpanded((expanded) => !expanded)}
                >
                  {bioExpanded ? messages.collapseAboutMe : messages.viewFullAboutMe}
                </button>
              )}
            </div>
          )}
          <ProfileGameActivity user={publicProfile.data ?? user} locale={locale} />
          {serverMember && (
            <div className="profile-card-section">
              <b>{messages.serverProfile}</b>
              <span>
                {serverMember.role === 'OWNER' ? messages.owner : messages.member} ·{' '}
                {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                  new Date(serverMember.joinedAt),
                )}
              </span>
              {serverMember.roles.length > 0 && (
                <div className="profile-card-roles">
                  {serverMember.roles.map((role) => (
                    <span key={role.id} style={{ borderColor: role.color, color: role.color }}>
                      {role.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {user.id !== currentUserId && mutuals.data && (
            <div className="profile-card-section mutual-connections">
              <b>
                <Users size={13} /> {messages.mutualConnections}
              </b>
              {mutuals.data.friendsVisible && (
                <div className="mutual-connection-group">
                  <strong>
                    {messages.mutualFriendsCount.replace(
                      '{count}',
                      String(mutuals.data.friends.length),
                    )}
                  </strong>
                  <div className="mutual-avatar-stack">
                    {mutuals.data.friends.slice(0, 6).map((friend) => (
                      <span key={friend.id} title={friend.displayName}>
                        {friend.avatarUrl ? (
                          <img src={friend.avatarUrl} alt="" />
                        ) : (
                          friend.displayName.slice(0, 1)
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {mutuals.data.serversVisible && (
                <div className="mutual-connection-group">
                  <strong>
                    {messages.mutualServersCount.replace(
                      '{count}',
                      String(mutuals.data.servers.length),
                    )}
                  </strong>
                  <div className="mutual-server-list">
                    {mutuals.data.servers.slice(0, 5).map((server) => (
                      <button
                        key={server.id}
                        type="button"
                        className="mutual-server-button"
                        title={server.name}
                        aria-label={server.name}
                        onClick={() => {
                          onServer(server.id);
                          onClose();
                        }}
                      >
                        <MutualServerIcon server={server} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!mutuals.data.friendsVisible && !mutuals.data.serversVisible && (
                <small>{messages.mutualConnectionsHidden}</small>
              )}
            </div>
          )}

          {user.id !== currentUserId && !user.system && (
            <div className="profile-card-section mt-3">
              <b
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: 4,
                  display: 'block',
                }}
              >
                {messages.userNote}
              </b>
              {editingNote ? (
                <textarea
                  className="composer-input"
                  autoFocus
                  maxLength={256}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onBlur={() => {
                    setEditingNote(false);
                    if (noteDraft.trim() !== (noteQuery.data?.content || '')) {
                      const request = noteDraft.trim()
                        ? apiRequest(`/users/${user.id}/note`, {
                            method: 'PATCH',
                            body: JSON.stringify({ content: noteDraft.trim() }),
                          })
                        : apiRequest(`/users/${user.id}/note`, { method: 'DELETE' });
                      void request.then(() =>
                        queryClient.invalidateQueries({ queryKey: ['user-note', user.id] }),
                      );
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                  style={{ width: '100%', minHeight: 40, padding: 8, fontSize: 12 }}
                  placeholder={messages.addNote}
                />
              ) : (
                <div
                  onClick={() => setEditingNote(true)}
                  style={{
                    cursor: 'text',
                    minHeight: 20,
                    fontSize: 12,
                    color: noteQuery.data?.content ? 'var(--text)' : 'var(--text-muted)',
                    padding: 4,
                  }}
                >
                  {noteQuery.data?.content || messages.addNote}
                </div>
              )}
            </div>
          )}

          {user.id !== currentUserId && !user.system && !blocked && (
            <div className="profile-card-actions">
              <button type="button" disabled={busy} onClick={() => void handleDirectMessage()}>
                <MessageCircle size={16} /> {messages.message}
              </button>
            </div>
          )}
          {error && <div className="profile-card-error">{error}</div>}
        </div>
      </div>
      {profileFrame && <GeneratedProfileFrame frame={profileFrame} />}
      {user.id !== currentUserId && !user.system && (
        <ContentReportDialog
          target={reportOpen ? { type: 'USER', id: user.id, label: `@${user.username}` } : null}
          locale={locale === 'en' ? 'en' : 'tr'}
          messages={messages}
          onClose={() => setReportOpen(false)}
        />
      )}
    </section>,
    document.body,
  );
}

function MutualServerIcon({ server }: { server: MutualConnections['servers'][number] }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="mutual-server-icon" aria-hidden="true">
      {server.iconUrl && !failed ? (
        <img src={server.iconUrl} alt="" onError={() => setFailed(true)} />
      ) : (
        server.name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
