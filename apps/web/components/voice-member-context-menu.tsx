'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { serverInviteUrl } from '@wapve/contracts';
import type {
  BlockedUser,
  Friend,
  FriendRequests,
  ServerMember,
  ServerRole,
  ServerSummary,
  VoiceParticipant,
} from '@wapve/contracts';
import {
  Ban,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  MessageSquare,
  MicOff,
  Pencil,
  Phone,
  Settings,
  Shield,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';
import { MemberModerationDialog, type MemberModerationAction } from './member-moderation-dialog';
import type { ServerSettingsSection } from './server-settings-dialog';
import type { ProfileAnchor } from './user-profile-popover';
import type { VoiceConnection } from './voice-channel';

export type VoiceContextMenuPosition = { left: number; top: number };

export function VoiceMemberContextMenu({
  member,
  participant,
  currentMember,
  currentUserId,
  server,
  channelId,
  roles,
  messages,
  locale,
  connection,
  position,
  disabledVideo = false,
  mutedSoundboard = false,
  onToggleDisableVideo,
  onToggleMuteSoundboard,
  onClose,
  onNotice,
  onOpenProfile,
  onOpenSettings,
  onMembersChanged,
  onMention,
  onOpenDirectMessage,
}: {
  member: ServerMember;
  participant: VoiceParticipant;
  currentMember: ServerMember | undefined;
  currentUserId: string;
  server: ServerSummary;
  channelId: string;
  roles: ServerRole[];
  developerMode: boolean;
  messages: Dictionary;
  locale: string;
  connection: VoiceConnection;
  position: VoiceContextMenuPosition | null;
  disabledVideo?: boolean;
  mutedSoundboard?: boolean;
  onToggleDisableVideo: (participantUserId: string) => void;
  onToggleMuteSoundboard: (participantUserId: string) => void;
  onClose: () => void;
  onNotice: (notice: string) => void;
  onOpenProfile: (member: ServerMember, anchor: ProfileAnchor, options?: { editNote?: boolean }) => void;
  onOpenSettings?: ((section: ServerSettingsSection) => void) | undefined;
  onMembersChanged?: (() => Promise<unknown>) | undefined;
  onMention?: ((username: string) => void) | undefined;
  onOpenDirectMessage?: ((userId: string) => void) | undefined;
}) {
  const queryClient = useQueryClient();
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const inviteSubmenuRef = useRef<HTMLDivElement>(null);
  const submenuTriggerRef = useRef<HTMLButtonElement>(null);
  const inviteTriggerRef = useRef<HTMLButtonElement>(null);
  const submenuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [rolesSubmenuOpen, setRolesSubmenuOpen] = useState<VoiceContextMenuPosition | null>(null);
  const [inviteSubmenuOpen, setInviteSubmenuOpen] = useState<VoiceContextMenuPosition | null>(null);
  const [busy, setBusy] = useState(false);
  const [moderationAction, setModerationAction] = useState<MemberModerationAction | null>(null);

  const isSelf = member.id === currentUserId;
  const actorIsOwner = server.role === 'OWNER';
  const actorHighestRole = actorIsOwner
    ? Number.MAX_SAFE_INTEGER
    : Math.max(-1, ...(currentMember?.roles.map((role) => role.position) ?? []));
  const targetHighestRole = Math.max(-1, ...member.roles.map((role) => role.position));
  const canModerateTarget =
    member.role !== 'OWNER' &&
    !isSelf &&
    (actorIsOwner || targetHighestRole < actorHighestRole);

  const hasVoiceModPerms =
    actorIsOwner ||
    server.permissions.some((p) =>
      ['MOVE_MEMBERS', 'KICK_MEMBERS', 'MUTE_MEMBERS', 'DEAFEN_MEMBERS', 'MANAGE_CHANNELS', 'MANAGE_SERVER'].includes(p),
    );

  const canManageTargetRoles =
    (actorIsOwner && isSelf) ||
    (member.role !== 'OWNER' && !isSelf && targetHighestRole < actorHighestRole);

  const assignableRoles = roles.filter(
    (role) =>
      !role.isEveryone &&
      (actorIsOwner ||
        (role.position < actorHighestRole &&
          role.permissions.every((permission) => server.permissions.includes(permission)))),
  );

  // Social relations
  const friends = useQuery({
    queryKey: ['friends'],
    queryFn: () => apiRequest<Friend[]>('/social/friends'),
    enabled: Boolean(position) && !isSelf,
  });

  const requests = useQuery({
    queryKey: ['friend-requests'],
    queryFn: () => apiRequest<FriendRequests>('/social/friends/requests'),
    enabled: Boolean(position) && !isSelf,
  });

  const blocks = useQuery({
    queryKey: ['blocks'],
    queryFn: () => apiRequest<BlockedUser[]>('/social/blocks'),
    enabled: Boolean(position) && !isSelf,
  });

  const userServers = useQuery({
    queryKey: ['servers'],
    queryFn: () => apiRequest<ServerSummary[]>('/servers'),
    enabled: Boolean(position) && !isSelf,
  });

  const isFriend = friends.data?.some((f) => f.user.id === member.id);
  const hasOutgoingRequest = requests.data?.outgoing.some((r) => r.user.id === member.id);
  const hasIncomingRequest = requests.data?.incoming.some((r) => r.user.id === member.id);
  const isBlocked = blocks.data?.some((b) => b.user.id === member.id);

  // Volume & Local Mute
  const currentVolume = connection.participantVolumes[member.id] ?? 1;
  const isLocallyMuted = currentVolume === 0;
  const [previousVolume, setPreviousVolume] = useState<number>(1);

  // Close on outside click or Escape
  useEffect(() => {
    if (!position) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !submenuRef.current?.contains(event.target as Node) &&
        !inviteSubmenuRef.current?.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const handleViewportChange = () => onClose();

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      if (submenuCloseTimer.current) clearTimeout(submenuCloseTimer.current);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [position, onClose]);

  function cancelSubmenuClose() {
    if (submenuCloseTimer.current) clearTimeout(submenuCloseTimer.current);
    submenuCloseTimer.current = null;
  }

  function closeSubmenuSoon() {
    cancelSubmenuClose();
    submenuCloseTimer.current = setTimeout(() => {
      setRolesSubmenuOpen(null);
      setInviteSubmenuOpen(null);
    }, 200);
  }

  function openRolesSubmenu() {
    cancelSubmenuClose();
    setInviteSubmenuOpen(null);
    const rect = submenuTriggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 230;
    const height = Math.min((roles.length || 1) * 36 + 20, window.innerHeight - 20);
    const opensLeft = rect.right + width + 8 > window.innerWidth;
    setRolesSubmenuOpen({
      left: opensLeft ? Math.max(8, rect.left - width - 4) : rect.right + 4,
      top: Math.max(8, Math.min(rect.top, window.innerHeight - height - 8)),
    });
  }

  function openInviteSubmenu() {
    cancelSubmenuClose();
    setRolesSubmenuOpen(null);
    const rect = inviteTriggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 240;
    const count = userServers.data?.length ?? 1;
    const height = Math.min(count * 38 + 20, window.innerHeight - 20);
    const opensLeft = rect.right + width + 8 > window.innerWidth;
    setInviteSubmenuOpen({
      left: opensLeft ? Math.max(8, rect.left - width - 4) : rect.right + 4,
      top: Math.max(8, Math.min(rect.top, window.innerHeight - height - 8)),
    });
  }

  function handleVolumeChange(value: number) {
    if (value > 0) setPreviousVolume(value);
    connection.setParticipantVolume(member.id, value);
  }

  function toggleLocalMute() {
    if (isLocallyMuted) {
      connection.setParticipantVolume(member.id, previousVolume || 1);
    } else {
      setPreviousVolume(currentVolume || 1);
      connection.setParticipantVolume(member.id, 0);
    }
  }

  async function copy(text: string, successMsg?: string) {
    try {
      await navigator.clipboard.writeText(text);
      onNotice(successMsg ?? messages.userIdCopied ?? (locale === 'tr' ? 'Kopyalandı.' : 'Copied.'));
      onClose();
    } catch {
      onNotice(messages.copyFailed ?? (locale === 'tr' ? 'Kopyalanamadı.' : 'Copy failed.'));
    }
  }

  async function handleDirectMessage() {
    onClose();
    if (onOpenDirectMessage) {
      onOpenDirectMessage(member.id);
      return;
    }
    try {
      const res = await apiRequest<{ id: string }>('/dm/conversations', {
        method: 'POST',
        body: JSON.stringify({ recipientId: member.id }),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dm-conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['direct-conversations'] }),
      ]);
      window.dispatchEvent(
        new CustomEvent('wapve:open-dm', { detail: { conversationId: res.id } }),
      );
    } catch (caught) {
      onNotice(errorMessage(caught, messages));
    }
  }

  async function handleStartCall() {
    onClose();
    try {
      const res = await apiRequest<{ id: string }>('/dm/conversations', {
        method: 'POST',
        body: JSON.stringify({ recipientId: member.id }),
      });
      window.dispatchEvent(
        new CustomEvent('wapve:start-social-call', {
          detail: {
            conversationId: res.id,
            partnerUserId: member.id,
            partnerName: member.displayName,
          },
        }),
      );
    } catch (caught) {
      onNotice(errorMessage(caught, messages));
    }
  }

  async function handleFriendAction() {
    setBusy(true);
    try {
      if (isFriend) {
        await apiRequest(`/social/friends/${member.id}`, { method: 'DELETE' });
        onNotice(locale === 'tr' ? 'Arkadaşlıktan çıkarıldı.' : 'Friend removed.');
      } else if (hasOutgoingRequest) {
        await apiRequest(`/social/friends/requests/${member.id}`, { method: 'DELETE' });
        onNotice(locale === 'tr' ? 'İstek iptal edildi.' : 'Request cancelled.');
      } else if (hasIncomingRequest) {
        await apiRequest(`/social/friends/requests/${member.id}/accept`, { method: 'POST' });
        onNotice(locale === 'tr' ? 'Arkadaşlık isteği kabul edildi.' : 'Friend request accepted.');
      } else {
        await apiRequest('/social/friends/requests', {
          method: 'POST',
          body: JSON.stringify({ userId: member.id }),
        });
        onNotice(locale === 'tr' ? 'Arkadaşlık isteği gönderildi.' : 'Friend request sent.');
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['friends'] }),
        queryClient.invalidateQueries({ queryKey: ['friend-requests'] }),
      ]);
      onClose();
    } catch (caught) {
      onNotice(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function handleBlockToggle() {
    setBusy(true);
    try {
      if (isBlocked) {
        await apiRequest(`/social/blocks/${member.id}`, { method: 'DELETE' });
        onNotice(locale === 'tr' ? 'Engel kaldırıldı.' : 'Unblocked.');
      } else {
        await apiRequest('/social/blocks', {
          method: 'POST',
          body: JSON.stringify({ userId: member.id }),
        });
        onNotice(locale === 'tr' ? 'Kullanıcı engellendi.' : 'Blocked.');
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['blocks'] }),
        queryClient.invalidateQueries({ queryKey: ['friends'] }),
      ]);
      onClose();
    } catch (caught) {
      onNotice(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  // Voice Moderation: Server Mute
  function handleServerMuteToggle() {
    const nextMuted = !participant.muted;
    // Emit through socket
    window.dispatchEvent(
      new CustomEvent('wapve:voice-server-mute', {
        detail: { targetUserId: member.id, channelId, muted: nextMuted },
      }),
    );
    onNotice(
      nextMuted
        ? locale === 'tr'
          ? `${member.displayName} sunucuda susturuldu.`
          : `${member.displayName} muted on server.`
        : locale === 'tr'
          ? `${member.displayName} sunucuda susturması kaldırıldı.`
          : `${member.displayName} unmuted on server.`,
    );
    onClose();
  }

  // Voice Moderation: Server Deafen
  function handleServerDeafenToggle() {
    const nextDeafened = !participant.deafened;
    window.dispatchEvent(
      new CustomEvent('wapve:voice-server-deafen', {
        detail: { targetUserId: member.id, channelId, deafened: nextDeafened },
      }),
    );
    onNotice(
      nextDeafened
        ? locale === 'tr'
          ? `${member.displayName} sunucuda sesi kapatıldı.`
          : `${member.displayName} server audio muted.`
        : locale === 'tr'
          ? `${member.displayName} sunucu ses engeli kaldırıldı.`
          : `${member.displayName} server audio unmuted.`,
    );
    onClose();
  }

  // Voice Moderation: Disconnect from voice
  function handleDisconnectVoice() {
    window.dispatchEvent(
      new CustomEvent('wapve:voice-disconnect-user', {
        detail: { targetUserId: member.id, channelId },
      }),
    );
    onNotice(
      locale === 'tr'
        ? `${member.displayName} ses kanalından atıldı.`
        : `${member.displayName} disconnected from voice.`,
    );
    onClose();
  }

  if (!position) return null;

  // Viewport-aware positioning
  const menuWidth = 250;
  const menuHeight = isSelf ? 220 : hasVoiceModPerms ? 640 : 440;
  const left = Math.max(8, Math.min(position.left, window.innerWidth - menuWidth - 8));
  const top = Math.max(8, Math.min(position.top, window.innerHeight - menuHeight - 8));

  return (
    <>
      {createPortal(
        <div
          ref={menuRef}
          className="voice-member-context-menu"
          role="menu"
          style={{ left, top }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Header */}
          <div className="voice-menu-header">
            <span className="voice-menu-avatar">
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt="" />
              ) : (
                member.displayName.slice(0, 1).toUpperCase()
              )}
            </span>
            <div className="voice-menu-user-info">
              <strong>{member.displayName}</strong>
              <small>@{member.username}</small>
            </div>
          </div>

          <div className="voice-menu-separator" />

          {/* Profile & Communication */}
          <button
            type="button"
            className="voice-menu-item"
            onClick={() => {
              onClose();
              onOpenProfile(member, { left, right: left + menuWidth, top, bottom: top + 40 });
            }}
          >
            <span>
              <UserCheck size={16} />
              {messages.profile ?? (locale === 'tr' ? 'Profil' : 'Profile')}
            </span>
          </button>

          {!isSelf && (
            <>
              {onMention && (
                <button
                  type="button"
                  className="voice-menu-item"
                  onClick={() => {
                    onClose();
                    onMention(member.username);
                  }}
                >
                  <span>
                    <MessageSquare size={16} />
                    {locale === 'tr' ? 'Bahset' : 'Mention'}
                  </span>
                </button>
              )}

              <button
                type="button"
                className="voice-menu-item"
                onClick={() => void handleDirectMessage()}
              >
                <span>
                  <MessageSquare size={16} />
                  {messages.sendMessage ?? (locale === 'tr' ? 'Mesaj Gönder' : 'Send Message')}
                </span>
              </button>

              <button
                type="button"
                className="voice-menu-item"
                onClick={() => void handleStartCall()}
              >
                <span>
                  <Phone size={16} />
                  {locale === 'tr' ? 'Bir Arama Başlat' : 'Start Call'}
                </span>
              </button>

              <button
                type="button"
                className="voice-menu-item"
                onClick={() => {
                  onClose();
                  onOpenProfile(
                    member,
                    { left, right: left + menuWidth, top, bottom: top + 40 },
                    { editNote: true },
                  );
                }}
              >
                <span>
                  <Pencil size={16} />
                  <span className="voice-menu-text-block">
                    <span>{locale === 'tr' ? 'Not Ekle' : 'Add Note'}</span>
                    <small className="voice-menu-hint">
                      {locale === 'tr' ? 'Sadece sana görünür' : 'Only visible to you'}
                    </small>
                  </span>
                </span>
              </button>
            </>
          )}

          {/* Volume and Audio Section (Only for other participants) */}
          {!isSelf && (
            <>
              <div className="voice-menu-separator" />

              <div className="voice-menu-slider-group">
                <div className="voice-menu-slider-head">
                  <span>
                    <Volume2 size={15} />
                    {messages.userVolume ?? (locale === 'tr' ? 'Kullanıcı Ses Seviyesi' : 'User Volume')}
                  </span>
                  <b>{Math.round(currentVolume * 100)}%</b>
                </div>
                <input
                  type="range"
                  min={0}
                  max={200}
                  step={1}
                  value={Math.round(currentVolume * 100)}
                  onChange={(e) => handleVolumeChange(Number(e.target.value) / 100)}
                  className="voice-volume-slider"
                  aria-label={messages.userVolume}
                />
              </div>

              <label className="voice-menu-checkbox-item">
                <span>
                  <MicOff size={16} />
                  {locale === 'tr' ? 'Sustur' : 'Mute'}
                </span>
                <input
                  type="checkbox"
                  checked={isLocallyMuted}
                  onChange={toggleLocalMute}
                />
              </label>

              <label className="voice-menu-checkbox-item">
                <span>
                  <VolumeX size={16} />
                  {locale === 'tr' ? 'Ses Tahtasını Sustur' : 'Mute Soundboard'}
                </span>
                <input
                  type="checkbox"
                  checked={mutedSoundboard}
                  onChange={() => onToggleMuteSoundboard(member.id)}
                />
              </label>

              <label className="voice-menu-checkbox-item">
                <span>
                  <VolumeX size={16} />
                  {locale === 'tr' ? 'Görüntüyü devre dışı bırak' : 'Disable Video'}
                </span>
                <input
                  type="checkbox"
                  checked={disabledVideo}
                  onChange={() => onToggleDisableVideo(member.id)}
                />
              </label>
            </>
          )}

          <div className="voice-menu-separator" />

          {/* Social and Roles Submenus */}
          {!isSelf && (
            <>
              {/* Server Invite Submenu */}
              <div
                className="voice-menu-submenu-wrapper"
                onMouseEnter={openInviteSubmenu}
                onMouseLeave={closeSubmenuSoon}
              >
                <button
                  ref={inviteTriggerRef}
                  type="button"
                  className="voice-menu-item"
                  onClick={() => (inviteSubmenuOpen ? setInviteSubmenuOpen(null) : openInviteSubmenu())}
                >
                  <span>
                    <UserPlus size={16} />
                    {locale === 'tr' ? 'Sunucuya Davet Et' : 'Invite to Server'}
                  </span>
                  <ChevronRight size={15} />
                </button>
              </div>

              <button
                type="button"
                className="voice-menu-item"
                disabled={busy}
                onClick={() => void handleFriendAction()}
              >
                <span>
                  {isFriend ? (
                    <>
                      <UserMinus size={16} />
                      {locale === 'tr' ? 'Arkadaşı Çıkar' : 'Remove Friend'}
                    </>
                  ) : hasOutgoingRequest ? (
                    <>
                      <UserX size={16} />
                      {locale === 'tr' ? 'İsteği İptal Et' : 'Cancel Request'}
                    </>
                  ) : hasIncomingRequest ? (
                    <>
                      <UserCheck size={16} />
                      {locale === 'tr' ? 'İsteği Kabul Et' : 'Accept Request'}
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      {messages.addFriend ?? (locale === 'tr' ? 'Arkadaş Ekle' : 'Add Friend')}
                    </>
                  )}
                </span>
              </button>

              <button
                type="button"
                className={`voice-menu-item${isBlocked ? '' : ' danger'}`}
                disabled={busy}
                onClick={() => void handleBlockToggle()}
              >
                <span>
                  <UserX size={16} />
                  {isBlocked
                    ? locale === 'tr'
                      ? 'Engeli Kaldır'
                      : 'Unblock'
                    : locale === 'tr'
                      ? 'Engelle'
                      : 'Block'}
                </span>
              </button>
            </>
          )}

          {/* Roles Submenu */}
          <div
            className="voice-menu-submenu-wrapper"
            onMouseEnter={openRolesSubmenu}
            onMouseLeave={closeSubmenuSoon}
          >
            <button
              ref={submenuTriggerRef}
              type="button"
              className="voice-menu-item"
              onClick={() => (rolesSubmenuOpen ? setRolesSubmenuOpen(null) : openRolesSubmenu())}
            >
              <span>
                <Shield size={16} />
                {messages.roles ?? (locale === 'tr' ? 'Roller' : 'Roles')}
              </span>
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Moderator Controls (Image 2) */}
          {hasVoiceModPerms && !isSelf && (
            <>
              <div className="voice-menu-separator" />

              {onOpenSettings && (
                <button
                  type="button"
                  className="voice-menu-item"
                  onClick={() => {
                    onClose();
                    onOpenSettings('members');
                  }}
                >
                  <span>
                    <Settings size={16} />
                    {locale === 'tr' ? 'Yönetici Kartını Aç' : 'Open Manager Card'}
                  </span>
                </button>
              )}

              {/* Server Mute & Deafen */}
              <label className="voice-menu-checkbox-item danger-toggle">
                <span>
                  <MicOff size={16} />
                  {locale === 'tr' ? 'Sunucuda Sustur' : 'Server Mute'}
                </span>
                <input
                  type="checkbox"
                  checked={participant.muted && !participant.canSpeak}
                  onChange={handleServerMuteToggle}
                />
              </label>

              <label className="voice-menu-checkbox-item danger-toggle">
                <span>
                  <VolumeX size={16} />
                  {locale === 'tr' ? 'Sunucuda Sesi Kapat' : 'Server Sound Off'}
                </span>
                <input
                  type="checkbox"
                  checked={participant.deafened}
                  onChange={handleServerDeafenToggle}
                />
              </label>

              {/* Disconnect Voice */}
              <button
                type="button"
                className="voice-menu-item danger"
                onClick={handleDisconnectVoice}
              >
                <span>
                  <VolumeX size={16} />
                  {locale === 'tr' ? 'Bağlantıyı Kes' : 'Disconnect'}
                </span>
              </button>

              {/* Timeout */}
              {canModerateTarget && server.permissions.includes('TIMEOUT_MEMBERS') && (
                <button
                  type="button"
                  className="voice-menu-item danger"
                  onClick={() => {
                    onClose();
                    setModerationAction('timeout');
                  }}
                >
                  <span>
                    <Clock3 size={16} />
                    {locale === 'tr'
                      ? `${member.displayName} Kullanıcısına Zamanaşımı Uygula`
                      : `Timeout ${member.displayName}`}
                  </span>
                </button>
              )}

              {/* Kick */}
              {canModerateTarget && server.permissions.includes('KICK_MEMBERS') && (
                <button
                  type="button"
                  className="voice-menu-item danger"
                  onClick={() => {
                    onClose();
                    setModerationAction('kick');
                  }}
                >
                  <span>
                    <UserMinus size={16} />
                    {locale === 'tr'
                      ? `${member.displayName} kullanıcısını at`
                      : `Kick ${member.displayName}`}
                  </span>
                </button>
              )}

              {/* Ban */}
              {canModerateTarget && server.permissions.includes('BAN_MEMBERS') && (
                <button
                  type="button"
                  className="voice-menu-item danger"
                  onClick={() => {
                    onClose();
                    setModerationAction('ban');
                  }}
                >
                  <span>
                    <Ban size={16} />
                    {locale === 'tr'
                      ? `${member.displayName} kullanıcısını engelle`
                      : `Ban ${member.displayName}`}
                  </span>
                </button>
              )}
            </>
          )}

          <div className="voice-menu-separator" />

          {/* Copy ID */}
          <button
            type="button"
            className="voice-menu-item"
            onClick={() => void copy(member.publicId || member.id, messages.userIdCopied)}
          >
            <span>
              <Copy size={16} />
              {messages.copyUserId ?? (locale === 'tr' ? "Kullanıcı ID'sini Kopyala" : 'Copy User ID')}
            </span>
          </button>
        </div>,
        document.body,
      )}

      {/* Roles Submenu Portal */}
      {rolesSubmenuOpen &&
        createPortal(
          <div
            ref={submenuRef}
            className="voice-member-context-menu voice-member-submenu"
            style={{ left: rolesSubmenuOpen.left, top: rolesSubmenuOpen.top }}
            onMouseEnter={cancelSubmenuClose}
            onMouseLeave={closeSubmenuSoon}
            onContextMenu={(e) => e.preventDefault()}
          >
            {assignableRoles.length > 0 ? (
              assignableRoles.map((role) => {
                const assigned = member.roles.some((r) => r.id === role.id);
                return (
                  <button
                    key={role.id}
                    type="button"
                    className="voice-menu-item"
                    disabled={busy || !canManageTargetRoles}
                    onClick={() => {
                      void (async () => {
                        if (!canManageTargetRoles) return;
                        setBusy(true);
                        try {
                          await apiRequest(
                            `/servers/${server.id}/members/${member.id}/roles/${role.id}`,
                            {
                              method: assigned ? 'DELETE' : 'POST',
                              ...(assigned ? {} : { body: '{}' }),
                            },
                          );
                          await onMembersChanged?.();
                          onNotice(
                            assigned
                              ? messages.roleUnassigned ?? 'Rol kaldırıldı.'
                              : messages.roleAssigned ?? 'Rol verildi.',
                          );
                        } catch (caught) {
                          onNotice(errorMessage(caught, messages));
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                  >
                    <span>
                      <i
                        className="voice-role-dot"
                        style={{ background: role.color || '#94a3b8' }}
                      />
                      {role.name}
                    </span>
                    {assigned && <Check size={15} className="voice-role-check" />}
                  </button>
                );
              })
            ) : (
              <div className="voice-menu-empty">
                {locale === 'tr' ? 'Atanabilir rol yok' : 'No assignable roles'}
              </div>
            )}
          </div>,
          document.body,
        )}

      {/* Server Invite Submenu Portal */}
      {inviteSubmenuOpen &&
        createPortal(
          <div
            ref={inviteSubmenuRef}
            className="voice-member-context-menu voice-member-submenu"
            style={{ left: inviteSubmenuOpen.left, top: inviteSubmenuOpen.top }}
            onMouseEnter={cancelSubmenuClose}
            onMouseLeave={closeSubmenuSoon}
            onContextMenu={(e) => e.preventDefault()}
          >
            {userServers.data && userServers.data.length > 0 ? (
              userServers.data.map((srv) => (
                <button
                  key={srv.id}
                  type="button"
                  className="voice-menu-item"
                  onClick={() => {
                    void (async () => {
                      try {
                        await copy(
                          serverInviteUrl(srv.customInviteSlug || srv.publicId),
                          locale === 'tr'
                            ? `${srv.name} davet bağlantısı kopyalandı.`
                            : `${srv.name} invite link copied.`,
                        );
                      } catch {
                        onNotice(messages.genericError);
                      }
                    })();
                  }}
                >
                  <span>
                    <span className="voice-server-mini-icon">
                      {srv.iconUrl ? (
                        <img src={srv.iconUrl} alt="" />
                      ) : (
                        srv.name.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    {srv.name}
                  </span>
                </button>
              ))
            ) : (
              <div className="voice-menu-empty">
                {locale === 'tr' ? 'Sunucu bulunamadı' : 'No servers found'}
              </div>
            )}
          </div>,
          document.body,
        )}

      {/* Moderation Dialog for Timeout, Kick, Ban */}
      {moderationAction && (
        <MemberModerationDialog
          action={moderationAction}
          member={member}
          server={server}
          messages={messages}
          onClose={() => setModerationAction(null)}
          onChanged={async () => {
            await onMembersChanged?.();
          }}
          onNotice={onNotice}
        />
      )}
    </>
  );
}
