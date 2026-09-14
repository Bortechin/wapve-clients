'use client';
import { MediaPrivacyGuard } from './media-privacy-guard';
import privacyStyles from './privacy-settings.module.css';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { serverInviteUrl } from '@wapve/contracts';
import type {
  BlockedUser,
  DirectConversation,
  DirectMessage,
  DirectMessagePage,
  DirectMessageContext,
  Friend,
  FriendRequests,
  GifSearchResult,
  GroupConversation,
  GroupMessage,
  GroupMessagePage,
  GroupMessageContext,
  Locale,
  MessageSource,
  ServerSummary,
  SocialUser,
  UserProfile,
} from '@wapve/contracts';
import {
  Activity,
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  Edit3,
  FileText,
  Flag,
  Forward,
  Link2,
  LoaderCircle,
  MessageCircle,
  MoreHorizontal,
  NotebookPen,
  Phone,
  Pin,
  PinOff,
  Radio,
  Search,
  ShoppingBag,
  Settings,
  ShieldCheck,
  ShieldBan,
  Smile,
  Sparkles,
  Trash2,
  UserMinus,
  UserPlus,
  UserRoundPlus,
  Users,
  Video,
  Waves,
  X,
} from 'lucide-react';
import Image from 'next/image';
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { io, type Socket } from 'socket.io-client';
import { apiRequest, apiUpload } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';
import { WapvePlusBadge } from './wapve-plus-badge';
import { CustomStatusEmoji } from './custom-status-emoji';
import { premiumNameplateSurfaceClass } from './premium-nameplate';
import {
  messageDraftKey,
  readMessageDraft,
  removeMessageDraft,
  writeMessageDraft,
} from '@/lib/message-drafts';
import { startsNewMessageDay } from '@/lib/message-date';
import {
  consumeMessageHash,
  copyTextPreservingScroll,
  isSameMessageRoute,
  messageIdFromHash,
  MESSAGE_LINK_NAVIGATION_EVENT,
  type MessageLinkTarget,
} from '@/lib/message-link';
import { MessageDateDivider } from './message-date-divider';
import { GameStatus } from './game-status';
import { RichMessageComposer } from './rich-message-composer';
import { MarkdownRenderer } from './markdown-renderer';
import type { SocialCallRequest } from './social-call';
import { profileAnchor, type OpenUserProfile, type ProfileAnchor } from './user-profile-popover';
import { AlphaMemberIcon } from './alpha-member-icon';
import { PlatformOwnerIcon } from './platform-owner-icon';
import { TypingIndicator } from './typing-indicator';
import { VoiceMessagePlayer } from './voice-message-player';
import { useUploadQueue } from '@/lib/upload-queue';
import { ForwardedMessageCard, ForwardMessageDialog } from './forward-message-dialog';
import { ContentReportDialog } from './content-report-dialog';
import { DeleteMessageDialog } from './delete-message-dialog';
import { TextAttachmentActions } from './text-attachment-actions';
import { MessageReactionPicker } from './message-reaction-picker';
import { AnimatedEmojiUpgradeDialog } from './animated-emoji-upgrade-dialog';
import { ServerTagChip } from './server-tag-chip';
import {
  incrementReactionFrequency,
  quickReactions,
  readReactionFrequency,
  type ReactionFrequency,
} from '@/lib/reaction-frequency';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';
const SOCIAL_MESSAGE_GROUP_WINDOW_MS = 7 * 60 * 1000;

type ConversationMenuPosition = { left: number; top: number };

type ConversationMenuTarget =
  | (ConversationMenuPosition & {
      kind: 'direct';
      conversation: DirectConversation;
      profileAnchor: ProfileAnchor;
    })
  | (ConversationMenuPosition & {
      kind: 'group';
      conversation: GroupConversation;
      profileAnchor: ProfileAnchor;
    });

type OpenConversationMenu<T> = (
  conversation: T,
  position: ConversationMenuPosition,
  profileAnchor: ProfileAnchor,
) => void;

function boundedConversationMenuPosition(
  left: number,
  top: number,
  estimatedHeight: number,
): ConversationMenuPosition {
  const width = 252;
  return {
    left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
    top: Math.max(
      8,
      Math.min(top, window.innerHeight - Math.min(estimatedHeight, window.innerHeight - 16) - 8),
    ),
  };
}

type MessageMenuState<T> = {
  message: T;
  x: number;
  top?: number | undefined;
  bottom?: number | undefined;
  triggerRect: DOMRect;
};

function boundedMessageMenuPosition(
  triggerRect: DOMRect,
  estimatedHeight: number = 380,
  menuWidth: number = 220,
): { x: number; top?: number | undefined; bottom?: number | undefined } {
  const left = Math.max(
    8,
    Math.min(triggerRect.right - menuWidth, window.innerWidth - menuWidth - 8),
  );
  const spaceBelow = window.innerHeight - triggerRect.bottom;
  const spaceAbove = triggerRect.top;
  const openUpwards = spaceBelow < estimatedHeight + 16 && spaceAbove >= spaceBelow;
  if (openUpwards) {
    return {
      x: left,
      bottom: Math.max(8, window.innerHeight - triggerRect.top + 10),
    };
  }
  return {
    x: left,
    top: Math.max(8, Math.min(triggerRect.bottom + 8, window.innerHeight - estimatedHeight - 8)),
  };
}

function shouldGroupSocialMessage<
  T extends {
    author: { id: string };
    createdAt: string;
    deleted?: boolean | undefined;
    systemAction?: string | null | undefined;
  },
>(items: T[], index: number): boolean {
  const message = items[index];
  const previous = items[index - 1];
  if (
    !message ||
    !previous ||
    message.author.id !== previous.author.id ||
    message.deleted ||
    previous.deleted ||
    message.systemAction ||
    previous.systemAction
  ) {
    return false;
  }

  const elapsed = new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime();
  return elapsed >= 0 && elapsed <= SOCIAL_MESSAGE_GROUP_WINDOW_MS;
}

export function SocialSidebar({
  currentUserId,
  selectedConversationId,
  messages,
  locale,
  pinnedConversations,
  developerMode,
  onPinnedConversationsChange,
  onSelectConversation,
  onOpenProfile,
  onNotice,
  premiumActive,
  storeActive,
  onOpenPremium,
  onOpenStore,
}: {
  currentUserId: string;
  selectedConversationId: string | null;
  messages: Dictionary;
  locale: 'tr' | 'en';
  pinnedConversations: string[];
  developerMode: boolean;
  onPinnedConversationsChange: (pins: string[]) => void | Promise<void>;
  onSelectConversation: (conversationId: string | null) => void;
  onOpenProfile: OpenUserProfile;
  onNotice: (notice: string) => void;
  premiumActive: boolean;
  storeActive: boolean;
  onOpenPremium: () => void;
  onOpenStore: () => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [conversationMenu, setConversationMenu] = useState<ConversationMenuTarget | null>(null);
  const [groupSettingsId, setGroupSettingsId] = useState<string | null>(null);
  const conversations = useQuery({
    queryKey: ['dm-conversations'],
    queryFn: () => apiRequest<DirectConversation[]>('/dm/conversations'),
    refetchOnMount: 'always',
    refetchInterval: 30_000,
  });
  const groups = useQuery({
    queryKey: ['group-conversations'],
    queryFn: () => apiRequest<GroupConversation[]>('/dm/groups'),
    refetchOnMount: 'always',
    refetchInterval: 30_000,
  });
  const friends = useQuery({
    queryKey: ['friends'],
    queryFn: () => apiRequest<Friend[]>('/social/friends'),
    enabled: Boolean(groupSettingsId),
  });
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filtered = (conversations.data ?? []).filter(
    (conversation) =>
      (!conversation.hidden || Boolean(normalizedSearch)) &&
      (!normalizedSearch ||
        conversation.otherUser.displayName.toLocaleLowerCase().includes(normalizedSearch) ||
        conversation.otherUser.username.toLocaleLowerCase().includes(normalizedSearch)),
  );
  const filteredGroups = (groups.data ?? []).filter(
    (group) => !normalizedSearch || group.name.toLocaleLowerCase().includes(normalizedSearch),
  );
  const directByKey = new Map<string, DirectConversation>(
    filtered.map((conversation) => [`direct:${conversation.id}`, conversation] as const),
  );
  const groupByKey = new Map<string, GroupConversation>(
    filteredGroups.map((group) => [`group:${group.id}`, group] as const),
  );
  const visiblePinned = pinnedConversations.filter(
    (key) => directByKey.has(key) || groupByKey.has(key),
  );
  const unpinnedDirect = filtered.filter(
    (conversation) => !pinnedConversations.includes(`direct:${conversation.id}`),
  );
  const unpinnedGroups = filteredGroups.filter(
    (group) => !pinnedConversations.includes(`group:${group.id}`),
  );

  async function hideDirectConversation(conversation: DirectConversation) {
    try {
      await apiRequest(`/dm/conversations/${conversation.id}/hide`, { method: 'POST' });
      await queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
      const key = `direct:${conversation.id}`;
      if (pinnedConversations.includes(key)) {
        await onPinnedConversationsChange(pinnedConversations.filter((item) => item !== key));
      }
      if (selectedConversationId === conversation.id) onSelectConversation(null);
    } catch (caught) {
      onNotice(errorMessage(caught, messages));
    }
  }

  async function dismissGroupConversation(group: GroupConversation) {
    const owner = group.ownerId === currentUserId;
    if (!window.confirm(owner ? messages.deleteGroupConfirm : messages.leaveGroupConfirm)) return;
    try {
      await apiRequest(owner ? `/dm/groups/${group.id}` : `/dm/groups/${group.id}/leave`, {
        method: owner ? 'DELETE' : 'POST',
      });
      await queryClient.invalidateQueries({ queryKey: ['group-conversations'] });
      const key = `group:${group.id}`;
      if (pinnedConversations.includes(key)) {
        await onPinnedConversationsChange(pinnedConversations.filter((item) => item !== key));
      }
      if (selectedConversationId === key) onSelectConversation(null);
    } catch (caught) {
      onNotice(errorMessage(caught, messages));
    }
  }

  const togglePin = (key: string) => {
    const next = pinnedConversations.includes(key)
      ? pinnedConversations.filter((item) => item !== key)
      : [...pinnedConversations, key];
    void onPinnedConversationsChange(next);
  };

  const openDirectMenu: OpenConversationMenu<DirectConversation> = (
    conversation,
    position,
    anchor,
  ) =>
    setConversationMenu({
      kind: 'direct',
      conversation,
      profileAnchor: anchor,
      ...boundedConversationMenuPosition(position.left, position.top, 560),
    });

  const openGroupMenu: OpenConversationMenu<GroupConversation> = (conversation, position, anchor) =>
    setConversationMenu({
      kind: 'group',
      conversation,
      profileAnchor: anchor,
      ...boundedConversationMenuPosition(position.left, position.top, 360),
    });

  return (
    <div className="home-sidebar">
      <label className="home-conversation-search">
        <Search size={15} />
        <span className="visually-hidden">{messages.findConversation}</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={messages.findConversation}
        />
      </label>
      <button
        className={`home-premium-link${premiumActive ? ' active' : ''}`}
        onClick={onOpenPremium}
      >
        <WapvePlusBadge size={33} />
        <strong>Wapve+</strong>
      </button>
      <button className={`home-store-link${storeActive ? ' active' : ''}`} onClick={onOpenStore}>
        <span className="home-store-icon">
          <ShoppingBag size={20} />
        </span>
        <strong>{locale === 'en' ? 'Store' : 'Mağaza'}</strong>
      </button>
      <button
        className={`home-friends-link${selectedConversationId || premiumActive || storeActive ? '' : ' active'}`}
        onClick={() => onSelectConversation(null)}
      >
        <Users size={18} />
        <strong>{messages.friends}</strong>
      </button>
      {visiblePinned.length > 0 && (
        <>
          <div className="social-section-title pinned-social-title">
            <Pin size={15} />
            <strong>{messages.pinnedConversations}</strong>
          </div>
          <div className="pinned-social-list">
            {visiblePinned.map((key) => {
              const conversation = directByKey.get(key);
              if (conversation)
                return (
                  <ConversationList
          locale={locale}
                    key={key}
                    conversations={[conversation]}
                    pending={false}
                    selectedConversationId={selectedConversationId}
                    messages={messages}
                    onSelectConversation={onSelectConversation}
                    onOpenProfile={onOpenProfile}
                    onConversationMenu={openDirectMenu}
                    onDismiss={hideDirectConversation}
                    pinned
                  />
                );
              const group = groupByKey.get(key);
              return group ? (
                <GroupConversationList
                  key={key}
                  groups={[group]}
                  selectedConversationId={selectedConversationId}
                  messages={messages}
                  onSelectConversation={onSelectConversation}
                  onConversationMenu={openGroupMenu}
                  onDismiss={dismissGroupConversation}
                  pinned
                />
              ) : null;
            })}
          </div>
        </>
      )}
      <div className="social-section-title">
        <MessageCircle size={15} />
        <strong>{messages.directMessages}</strong>
      </div>
      <ConversationList
          locale={locale}
        conversations={unpinnedDirect}
        pending={conversations.isPending}
        selectedConversationId={selectedConversationId}
        messages={messages}
        onSelectConversation={onSelectConversation}
        onOpenProfile={onOpenProfile}
        onConversationMenu={openDirectMenu}
        onDismiss={hideDirectConversation}
      />
      <div className="social-section-title">
        <Users size={15} />
        <strong>{messages.groupMessages}</strong>
      </div>
      <GroupConversationList
        groups={unpinnedGroups}
        selectedConversationId={selectedConversationId}
        messages={messages}
        onSelectConversation={onSelectConversation}
        onConversationMenu={openGroupMenu}
        onDismiss={dismissGroupConversation}
      />
      <SocialConversationContextMenu
        target={conversationMenu}
        currentUserId={currentUserId}
        messages={messages}
        pinnedConversations={pinnedConversations}
        developerMode={developerMode}
        onClose={() => setConversationMenu(null)}
        onTogglePin={togglePin}
        onOpenProfile={onOpenProfile}
        onManageGroup={setGroupSettingsId}
        onConversationGone={(conversationId) => {
          if (selectedConversationId === conversationId) onSelectConversation(null);
        }}
        onNotice={onNotice}
      />
      {groupSettingsId && groups.data?.find((group) => group.id === groupSettingsId) && (
        <GroupSettingsDialog
          group={groups.data.find((group) => group.id === groupSettingsId)!}
          friends={friends.data ?? []}
          currentUserId={currentUserId}
          messages={messages}
          onClose={() => setGroupSettingsId(null)}
          onGone={() => {
            const selectionId = `group:${groupSettingsId}`;
            setGroupSettingsId(null);
            if (selectedConversationId === selectionId) onSelectConversation(null);
          }}
        />
      )}
    </div>
  );
}

function SocialConversationContextMenu({
  target,
  currentUserId,
  messages,
  pinnedConversations,
  developerMode,
  onClose,
  onTogglePin,
  onOpenProfile,
  onManageGroup,
  onConversationGone,
  onNotice,
}: {
  target: ConversationMenuTarget | null;
  currentUserId: string;
  messages: Dictionary;
  pinnedConversations: string[];
  developerMode: boolean;
  onClose: () => void;
  onTogglePin: (key: string) => void | Promise<void>;
  onOpenProfile: OpenUserProfile;
  onManageGroup: (groupId: string) => void;
  onConversationGone: (selectionId: string) => void;
  onNotice: (notice: string) => void;
}) {
  const queryClient = useQueryClient();
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const inviteTriggerRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [invitePosition, setInvitePosition] = useState<ConversationMenuPosition | null>(null);
  const direct = target?.kind === 'direct' ? target.conversation : null;
  const group = target?.kind === 'group' ? target.conversation : null;
  const friends = useQuery({
    queryKey: ['friends'],
    queryFn: () => apiRequest<Friend[]>('/social/friends'),
    enabled: Boolean(direct),
  });
  const requests = useQuery({
    queryKey: ['friend-requests'],
    queryFn: () => apiRequest<FriendRequests>('/social/requests'),
    enabled: Boolean(direct),
  });
  const servers = useQuery({
    queryKey: ['servers'],
    queryFn: () => apiRequest<ServerSummary[]>('/servers'),
    enabled: Boolean(direct),
  });
  const directIsFriend = Boolean(
    !direct?.otherUser.system &&
      (direct?.canMessage ||
        friends.data?.some((friend) => friend.user.id === direct?.otherUser.id)),
  );
  const incomingRequest = requests.data?.incoming.find(
    (request) => request.user.id === direct?.otherUser.id,
  );
  const outgoingRequest = requests.data?.outgoing.find(
    (request) => request.user.id === direct?.otherUser.id,
  );
  const invitableServers = (servers.data ?? []).filter((server) =>
    server.permissions.includes('CREATE_INVITES'),
  );
  const pinKey = direct ? `direct:${direct.id}` : group ? `group:${group.id}` : '';
  const pinned = Boolean(pinKey && pinnedConversations.includes(pinKey));

  useEffect(() => {
    setInvitePosition(null);
  }, [target?.conversation.id, target?.kind]);

  useEffect(() => {
    if (!target) return;
    const closeOutside = (event: PointerEvent) => {
      const node = event.target as Node;
      if (menuRef.current?.contains(node) || submenuRef.current?.contains(node)) return;
      onClose();
    };
    const closeOnKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (invitePosition) setInvitePosition(null);
        else onClose();
      }
    };
    const closeOnViewportChange = () => onClose();
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('keydown', closeOnKey);
    window.addEventListener('resize', closeOnViewportChange);
    window.addEventListener('scroll', closeOnViewportChange, true);
    window.requestAnimationFrame(() =>
      menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(),
    );
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('keydown', closeOnKey);
      window.removeEventListener('resize', closeOnViewportChange);
      window.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, [invitePosition, onClose, target]);

  function moveMenuFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const buttons = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
    ];
    if (!buttons.length) return;
    event.preventDefault();
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : event.key === 'ArrowDown'
            ? (current + 1 + buttons.length) % buttons.length
            : (current - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }

  async function markRead() {
    if (!direct && !group) return;
    setBusy(true);
    try {
      await apiRequest(
        direct ? `/dm/conversations/${direct.id}/read` : `/dm/groups/${group!.id}/read`,
        { method: 'POST' },
      );
      await queryClient.invalidateQueries({
        queryKey: [direct ? 'dm-conversations' : 'group-conversations'],
      });
      onClose();
    } catch (caught) {
      onNotice(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function togglePin() {
    if (!pinKey) return;
    setBusy(true);
    try {
      await onTogglePin(pinKey);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      onNotice(messages.copied);
      onClose();
    } catch {
      onNotice(messages.copyFailed);
    }
  }

  function openProfile(editNote = false) {
    if (!direct) return;
    onOpenProfile(
      direct.otherUser,
      target!.profileAnchor,
      editNote ? { editNote: true } : undefined,
    );
    onClose();
  }

  function startDirectCall() {
    if (!direct || direct.otherUser.system) return;
    window.dispatchEvent(
      new CustomEvent<SocialCallRequest>('wapve:start-social-call', {
        detail: {
          conversationId: direct.id,
          kind: 'direct',
          mode: 'audio',
          title: direct.otherUser.displayName,
          people: [
            {
              userId: direct.otherUser.id,
              displayName: direct.otherUser.displayName,
              avatarUrl: direct.otherUser.avatarUrl,
            },
          ],
        },
      }),
    );
    onClose();
  }

  async function directSocialAction(
    path: string,
    method: 'POST' | 'DELETE',
    success: string,
    body?: object,
    conversationDisappears = false,
  ) {
    if (!direct) return;
    setBusy(true);
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
      onNotice(success);
      if (conversationDisappears) {
        if (pinned) await onTogglePin(pinKey);
        onConversationGone(direct.id);
      }
      onClose();
    } catch (caught) {
      onNotice(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function inviteToServer(server: ServerSummary) {
    if (!direct) return;
    setBusy(true);
    try {
      const invite = await apiRequest<{ code: string }>(`/servers/${server.id}/invites`, {
        method: 'POST',
        body: JSON.stringify({ maxUses: 1, expiresInHours: 24 }),
      });
      await apiRequest(`/dm/conversations/${direct.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: serverInviteUrl(invite.code) }),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dm-messages', direct.id] }),
        queryClient.invalidateQueries({ queryKey: ['dm-conversations'] }),
      ]);
      onNotice(messages.inviteSent);
      onClose();
    } catch (caught) {
      onNotice(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  function openInviteSubmenu() {
    const rect = inviteTriggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 252;
    const height = Math.min(
      Math.max(70, invitableServers.length * 42 + 16),
      window.innerHeight - 16,
    );
    const opensLeft = rect.right + width + 6 > window.innerWidth;
    setInvitePosition({
      left: opensLeft ? Math.max(8, rect.left - width - 4) : rect.right + 4,
      top: Math.max(8, Math.min(rect.top, window.innerHeight - height - 8)),
    });
  }

  async function leaveOrDeleteGroup() {
    if (!group) return;
    const owner = group.ownerId === currentUserId;
    const confirmed = window.confirm(
      owner ? messages.deleteGroupConfirm : messages.leaveGroupConfirm,
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      await apiRequest(owner ? `/dm/groups/${group.id}` : `/dm/groups/${group.id}/leave`, {
        method: owner ? 'DELETE' : 'POST',
      });
      await queryClient.invalidateQueries({ queryKey: ['group-conversations'] });
      if (pinned) await onTogglePin(pinKey);
      onConversationGone(`group:${group.id}`);
      onClose();
    } catch (caught) {
      onNotice(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  if (!target) return null;

  return (
    <>
      {createPortal(
        <div
          ref={menuRef}
          className="server-context-menu social-conversation-context-menu"
          role="menu"
          aria-label={
            direct
              ? `${direct.otherUser.displayName} ${messages.memberActions}`
              : `${group!.name} ${messages.memberActions}`
          }
          style={{ left: target.left, top: target.top }}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={moveMenuFocus}
        >
          <button
            role="menuitem"
            disabled={busy || (direct?.unreadCount ?? group?.unreadCount ?? 0) === 0}
            onClick={() => void markRead()}
          >
            <Check size={16} /> {messages.markConversationRead}
          </button>
          <button role="menuitem" disabled={busy} onClick={() => void togglePin()}>
            {pinned ? <PinOff size={16} /> : <Pin size={16} />}
            {pinned ? messages.unpinConversation : messages.pinConversation}
          </button>

          {direct ? (
            <>
              <div className="member-context-separator" />
              <button role="menuitem" onClick={() => openProfile()}>
                <Activity size={16} /> {messages.profile}
              </button>
              <button role="menuitem" disabled={direct.otherUser.system} onClick={startDirectCall}>
                <Phone size={16} /> {messages.audioCall}
              </button>
              <button role="menuitem" onClick={() => openProfile(true)}>
                <NotebookPen size={16} /> {messages.addNote}
              </button>
              <button
                ref={inviteTriggerRef}
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={Boolean(invitePosition)}
                onMouseEnter={openInviteSubmenu}
                onClick={() => (invitePosition ? setInvitePosition(null) : openInviteSubmenu())}
              >
                <UserRoundPlus size={16} />
                <span>{messages.inviteToServer}</span>
                <ChevronRight className="context-menu-chevron" size={15} />
              </button>
              <div className="member-context-separator" />
              {directIsFriend ? (
                <button
                  role="menuitem"
                  disabled={busy}
                  onClick={() =>
                    void directSocialAction(
                      `/social/friends/${direct.otherUser.id}`,
                      'DELETE',
                      messages.friendRemoved,
                    )
                  }
                >
                  <UserMinus size={16} /> {messages.removeFriend}
                </button>
              ) : incomingRequest ? (
                <button
                  role="menuitem"
                  disabled={busy}
                  onClick={() =>
                    void directSocialAction(
                      `/social/requests/${incomingRequest.id}/accept`,
                      'POST',
                      messages.friendRequestAccepted,
                    )
                  }
                >
                  <Check size={16} /> {messages.accept}
                </button>
              ) : (
                <button
                  role="menuitem"
                  disabled={busy || Boolean(outgoingRequest)}
                  onClick={() =>
                    void directSocialAction(
                      '/social/requests',
                      'POST',
                      messages.friendRequestSent,
                      { username: direct.otherUser.username },
                    )
                  }
                >
                  {outgoingRequest ? <Check size={16} /> : <UserPlus size={16} />}
                  {outgoingRequest ? messages.friendRequestPending : messages.addFriend}
                </button>
              )}
              <button
                className="danger"
                role="menuitem"
                disabled={busy}
                onClick={() =>
                  void directSocialAction(
                    '/social/blocks',
                    'POST',
                    messages.userBlocked,
                    { userId: direct.otherUser.id },
                    true,
                  )
                }
              >
                <ShieldBan size={16} /> {messages.blockUser}
              </button>
              {developerMode && <div className="member-context-separator" />}
              {developerMode && (
                <button role="menuitem" onClick={() => void copy(direct.otherUser.publicId)}>
                  <Copy size={16} /> {messages.copyUserId}
                </button>
              )}
              {developerMode && (
                <button role="menuitem" onClick={() => void copy(direct.id)}>
                  <Copy size={16} /> {messages.copyChannelId}
                </button>
              )}
            </>
          ) : (
            <>
              <div className="member-context-separator" />
              {group!.ownerId === currentUserId && (
                <button
                  role="menuitem"
                  onClick={() => {
                    onManageGroup(group!.id);
                    onClose();
                  }}
                >
                  <UserRoundPlus size={16} /> {messages.addGroupMembers}
                </button>
              )}
              <button
                role="menuitem"
                onClick={() => {
                  onManageGroup(group!.id);
                  onClose();
                }}
              >
                <Settings size={16} />
                {group!.ownerId === currentUserId ? messages.editGroup : messages.groupSettings}
              </button>
              <div className="member-context-separator" />
              <button
                className="danger"
                role="menuitem"
                disabled={busy}
                onClick={() => void leaveOrDeleteGroup()}
              >
                {group!.ownerId === currentUserId ? <Trash2 size={16} /> : <UserMinus size={16} />}
                {group!.ownerId === currentUserId ? messages.deleteGroup : messages.leaveGroup}
              </button>
              {developerMode && <div className="member-context-separator" />}
              {developerMode && (
                <button role="menuitem" onClick={() => void copy(group!.id)}>
                  <Copy size={16} /> {messages.copyChannelId}
                </button>
              )}
            </>
          )}
        </div>,
        document.body,
      )}
      {direct &&
        invitePosition &&
        createPortal(
          <div
            ref={submenuRef}
            className="server-context-menu server-context-submenu social-invite-submenu"
            role="menu"
            aria-label={messages.inviteToServer}
            style={{ ...invitePosition, position: 'fixed' }}
            onContextMenu={(event) => event.preventDefault()}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'Escape') {
                event.preventDefault();
                setInvitePosition(null);
                inviteTriggerRef.current?.focus();
                return;
              }
              moveMenuFocus(event);
            }}
          >
            {invitableServers.map((server) => (
              <button
                role="menuitem"
                key={server.id}
                disabled={busy}
                onClick={() => void inviteToServer(server)}
              >
                {server.iconUrl ? (
                  <img src={server.iconUrl} alt="" />
                ) : (
                  <i>{server.name.slice(0, 1).toUpperCase()}</i>
                )}
                <span>{server.name}</span>
              </button>
            ))}
            {!servers.isPending && invitableServers.length === 0 && (
              <p>{messages.noInvitableServers}</p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

export function HomeActivityPanel({
  messages,
  onOpenProfile,
  onDiveVoiceRoom,
}: {
  messages: Dictionary;
  onOpenProfile: OpenUserProfile;
  onDiveVoiceRoom?: ((serverId: string, channelId: string) => void) | undefined;
}) {
  const friends = useQuery({
    queryKey: ['friends'],
    queryFn: () => apiRequest<Friend[]>('/social/friends'),
    refetchOnMount: 'always',
    refetchInterval: 15_000,
  });
  const friendsInVoice = (friends.data ?? []).filter((friend) => Boolean(friend.activeVoice));
  const otherOnline = (friends.data ?? []).filter(
    (friend) => friend.user.status !== 'OFFLINE' && !friend.activeVoice,
  );
  return (
    <>
      <div className="wapve-radar-container">
        <div className="wapve-radar-header">
          <div className="wapve-radar-title">
            <Radio size={14} className="text-sky-400" />
            <span>{messages.wapveRadar ?? 'Wapve Radarı'}</span>
          </div>
          <span className="wapve-radar-ping" title={messages.wapveRadarHint ?? 'Radar aktif'} />
        </div>

        {friendsInVoice.length > 0 ? (
          friendsInVoice.map((friend) => (
            <div className="radar-room-card" key={`radar-${friend.friendshipId}`}>
              <div
                className="radar-friend-info cursor-pointer"
                onClick={(e) => onOpenProfile(friend.user, e.currentTarget)}
              >
                <SocialAvatar user={friend.user} />
                <div className="radar-text">
                  <strong>{friend.user.displayName}</strong>
                  <span>
                    🌊 {friend.activeVoice?.serverName} · 🔊 {friend.activeVoice?.channelName}
                  </span>
                </div>
              </div>
              {onDiveVoiceRoom && friend.activeVoice && (
                <button
                  type="button"
                  className="radar-dive-btn"
                  onClick={() =>
                    onDiveVoiceRoom(friend.activeVoice!.serverId, friend.activeVoice!.channelId)
                  }
                  title={messages.diveIntoRoom ?? 'Odaya Dal'}
                >
                  <Waves size={13} />
                  <span>{messages.diveIntoRoom ?? 'Odaya Dal'}</span>
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="radar-empty-state">
            <Radio size={15} className="text-sky-400/60" />
            <span>
              {messages.radarScanning ??
                'Radar taranıyor... Henüz hiçbir arkadaşın ses odasında değil. İlk dalgayı sen başlat!'}
            </span>
          </div>
        )}
      </div>

      <h2>{messages.onlineNow}</h2>
      {otherOnline.map((friend) => (
        <button
          className={`member-row profile-row-button${premiumNameplateSurfaceClass(friend.user.premium?.nameplate)}`}
          key={friend.friendshipId}
          onClick={(event) => onOpenProfile(friend.user, event.currentTarget)}
        >
          <SocialAvatar user={friend.user} />
          <div className="user-copy">
            <div className="member-name-line">
              <strong>{friend.user.displayName}</strong>
              {friend.user.serverTag && (
                <ServerTagChip tag={friend.user.serverTag} compact interactive={false} />
              )}
            </div>
            <span>@{friend.user.username}</span>
          </div>
        </button>
      ))}
      {!friends.isPending &&
        (friends.data ?? []).filter((f) => f.user.status !== 'OFFLINE').length === 0 && (
          <p className="activity-empty">{messages.noOnlineFriends}</p>
        )}
    </>
  );
}

export function SocialActivityPanel({
  currentUserId,
  selectedConversationId,
  locale,
  messages,
  onSelectConversation,
  onOpenProfile,
  onDiveVoiceRoom,
}: {
  currentUserId: string;
  selectedConversationId: string | null;
  locale: Locale;
  messages: Dictionary;
  onSelectConversation: (conversationId: string) => void;
  onOpenProfile: OpenUserProfile;
  onDiveVoiceRoom?: ((serverId: string, channelId: string) => void) | undefined;
}) {
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [groupMenu, setGroupMenu] = useState<{
    user: SocialUser;
    anchor: HTMLButtonElement;
    left: number;
    top: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const directMenuButtonRef = useRef<HTMLButtonElement>(null);
  const directMenuRef = useRef<HTMLDivElement>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const conversations = useQuery({
    queryKey: ['dm-conversations'],
    queryFn: () => apiRequest<DirectConversation[]>('/dm/conversations'),
  });
  const groups = useQuery({
    queryKey: ['group-conversations'],
    queryFn: () => apiRequest<GroupConversation[]>('/dm/groups'),
  });
  const servers = useQuery({
    queryKey: ['servers'],
    queryFn: () => apiRequest<ServerSummary[]>('/servers'),
  });
  const friends = useQuery({
    queryKey: ['friends'],
    queryFn: () => apiRequest<Friend[]>('/social/friends'),
  });
  const requests = useQuery({
    queryKey: ['friend-requests'],
    queryFn: () => apiRequest<FriendRequests>('/social/requests'),
  });
  const blocks = useQuery({
    queryKey: ['blocks'],
    queryFn: () => apiRequest<BlockedUser[]>('/social/blocks'),
  });
  const groupId = selectedConversationId?.startsWith('group:')
    ? selectedConversationId.slice('group:'.length)
    : null;
  const group = groups.data?.find((item) => item.id === groupId);
  const direct = conversations.data?.find((item) => item.id === selectedConversationId);

  useEffect(() => {
    if (!menuOpen && !groupMenu) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (directMenuRef.current?.contains(target) || groupMenuRef.current?.contains(target)) return;
      setMenuOpen(false);
      setGroupMenu(null);
    };
    const closeOnKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setGroupMenu(null);
      }
    };
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', closeOnKey);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', closeOnKey);
    };
  }, [groupMenu, menuOpen]);

  async function profileAction(path: string, method: 'POST' | 'DELETE', body?: object) {
    setBusy(true);
    try {
      await apiRequest(path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      setMenuOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['friends'] }),
        queryClient.invalidateQueries({ queryKey: ['friend-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['dm-conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['group-conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['blocks'] }),
      ]);
    } catch {
      setNotice(messages.genericError);
    } finally {
      setBusy(false);
    }
  }

  function openGroupMemberMenu(event: MouseEvent<HTMLButtonElement>, user: SocialUser) {
    event.preventDefault();
    const width = 238;
    const height = 390;
    setGroupMenu({
      user,
      anchor: event.currentTarget,
      left: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8)),
    });
  }

  async function inviteToServer(server: ServerSummary, conversationId: string) {
    setBusy(true);
    try {
      const invite = await apiRequest<{ code: string }>(`/servers/${server.id}/invites`, {
        method: 'POST',
        body: JSON.stringify({ maxUses: 1, expiresInHours: 24 }),
      });
      await apiRequest(`/dm/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: serverInviteUrl(invite.code) }),
      });
      setNotice(messages.inviteSent);
      setMenuOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['dm-messages', conversationId] });
    } catch {
      setNotice(messages.genericError);
    } finally {
      setBusy(false);
    }
  }

  if (direct) {
    const user = direct.otherUser;
    const directFriend = friends.data?.find((item) => item.user.id === user.id);
    const incomingRequest = requests.data?.incoming.find((item) => item.user.id === user.id);
    const outgoingRequest = requests.data?.outgoing.find((item) => item.user.id === user.id);
    const blockedUser = blocks.data?.find((item) => item.user.id === user.id);
    const invitableServers = (servers.data ?? []).filter((server) =>
      server.permissions.includes('CREATE_INVITES'),
    );
    const menuButtonRect = directMenuButtonRef.current?.getBoundingClientRect();
    const directMenuPosition = menuButtonRect
      ? {
          left: Math.max(8, Math.min(menuButtonRect.right - 218, window.innerWidth - 226)),
          top: Math.min(menuButtonRect.bottom + 7, window.innerHeight - 320),
        }
      : { left: -9999, top: -9999 };
    return (
      <>
        <div className="conversation-profile-panel">
          <div
            className="conversation-profile-banner"
            style={user.bannerUrl ? { backgroundImage: `url(${user.bannerUrl})` } : undefined}
          />
          <div className="conversation-profile-tools">
            {!user.system &&
              (directFriend ? (
                <button
                  className="icon-button danger-soft"
                  disabled={busy}
                  onClick={() => void profileAction(`/social/friends/${user.id}`, 'DELETE')}
                  aria-label={messages.removeFriend}
                  title={messages.removeFriend}
                >
                  <UserMinus size={17} />
                </button>
              ) : incomingRequest ? (
                <button
                  className="icon-button"
                  disabled={busy}
                  onClick={() =>
                    void profileAction(`/social/requests/${incomingRequest.id}/accept`, 'POST')
                  }
                  aria-label={messages.accept}
                  title={messages.accept}
                >
                  <Check size={17} />
                </button>
              ) : blockedUser ? (
                <button
                  className="icon-button"
                  disabled={busy}
                  onClick={() => void profileAction(`/social/blocks/${user.id}`, 'DELETE')}
                  aria-label={messages.unblock}
                  title={messages.unblock}
                >
                  <ShieldBan size={17} />
                </button>
              ) : (
                <button
                  className="icon-button"
                  disabled={busy || direct.otherUser.system || Boolean(outgoingRequest)}
                  onClick={() =>
                    void profileAction('/social/requests', 'POST', { username: user.username })
                  }
                  aria-label={outgoingRequest ? messages.friendRequestPending : messages.addFriend}
                  title={outgoingRequest ? messages.friendRequestPending : messages.addFriend}
                >
                  {outgoingRequest ? <Check size={17} /> : <UserPlus size={17} />}
                </button>
              ))}
            <div className="conversation-profile-menu-shell">
              <button
                ref={directMenuButtonRef}
                className="icon-button"
                onClick={(event) => {
                  event.stopPropagation();
                  setMenuOpen((open) => !open);
                }}
                aria-label={messages.memberActions}
                aria-expanded={menuOpen}
              >
                <MoreHorizontal size={18} />
              </button>
              {menuOpen &&
                typeof document !== 'undefined' &&
                createPortal(
                  <div
                    ref={directMenuRef}
                    className="conversation-profile-menu conversation-profile-menu--portal"
                    style={directMenuPosition}
                  >
                    <div className="profile-menu-submenu">
                      <button type="button" disabled={user.system}>
                        {messages.inviteToServer} <span>›</span>
                      </button>
                      <div className="profile-menu-server-list">
                        {invitableServers.map((server) => (
                          <button
                            type="button"
                            key={server.id}
                            disabled={busy || user.system}
                            onClick={() => void inviteToServer(server, direct.id)}
                          >
                            {server.iconUrl ? (
                              <img src={server.iconUrl} alt="" />
                            ) : (
                              <i>{server.name[0]}</i>
                            )}
                            {server.name}
                          </button>
                        ))}
                        {!servers.isPending && invitableServers.length === 0 && (
                          <p>{messages.noInvitableServers}</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={user.system}
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent<SocialCallRequest>('wapve:start-social-call', {
                            detail: {
                              conversationId: direct.id,
                              kind: 'direct',
                              mode: 'audio',
                              title: user.displayName,
                            },
                          }),
                        );
                        setMenuOpen(false);
                      }}
                    >
                      <Phone size={15} /> {messages.audioCall}
                    </button>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(user.publicId)}
                    >
                      <FileText size={15} /> {messages.copyUserId}
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={busy || user.system}
                      onClick={() =>
                        void profileAction('/social/blocks', 'POST', { userId: user.id })
                      }
                    >
                      <ShieldBan size={15} /> {messages.blockUser}
                    </button>
                  </div>,
                  document.body,
                )}
            </div>
          </div>
          <button
            className="conversation-profile-avatar"
            onClick={(event) => onOpenProfile(user, event.currentTarget)}
            aria-label={user.displayName}
          >
            <SocialAvatar user={user} />
          </button>
          <div className="conversation-profile-body">
            <div className="conversation-profile-name-line">
              <h2>{user.displayName}</h2>
              {user.serverTag && <ServerTagChip tag={user.serverTag} compact interactive={false} />}
            </div>
            <p>@{user.username}</p>
            {user.badges.length > 0 && (
              <div
                className="conversation-profile-badges"
                aria-label={locale === 'tr' ? 'Rozetler' : 'Badges'}
              >
                <PlatformOwnerIcon badges={user.badges} locale={locale} size={25} />
                <AlphaMemberIcon badges={user.badges} locale={locale} size={25} />
              </div>
            )}
            {user.system && (
              <div className="conversation-profile-membership">
                <strong>
                  {locale === 'tr' ? 'RESMÎ SİSTEM HESABI' : 'OFFICIAL SYSTEM ACCOUNT'}
                </strong>
                <p>
                  {locale === 'tr'
                    ? 'Wapve gerekli hesap, güvenlik ve platform bildirimlerini bu tek yönlü profilden gönderir. Bu hesaba mesaj gönderilemez veya arama başlatılamaz.'
                    : 'Wapve sends required account, security, and platform notices from this one-way profile. This account cannot receive messages or calls.'}
                </p>
              </div>
            )}
            <GameStatus user={user} locale={locale} full>{user.status !== 'OFFLINE' && (user.customStatusEmoji || user.customStatusText) && (
              <div className="conversation-profile-status">
                {user.customStatusEmoji && <CustomStatusEmoji value={user.customStatusEmoji} />}{' '}
                {user.customStatusText}
              </div>
            )}</GameStatus>
            {user.createdAt && (
              <div className="conversation-profile-membership">
                <strong>{messages.memberSince}</strong>
                <time dateTime={user.createdAt}>
                  {new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(
                    new Date(user.createdAt),
                  )}
                </time>
              </div>
            )}
            {user.bio && (
              <div className="conversation-profile-membership conversation-profile-bio">
                <strong>{messages.aboutMe}</strong>
                <p>{user.bio}</p>
              </div>
            )}
            {notice && <div className="profile-action-notice">{notice}</div>}
            <button
              className="wapve-button wapve-button--secondary"
              onClick={(event) => onOpenProfile(user, event.currentTarget)}
            >
              {messages.profile}
            </button>
          </div>
        </div>
      </>
    );
  }

  if (group) {
    const selectedGroupUser = groupMenu?.user;
    const friend = friends.data?.find((item) => item.user.id === selectedGroupUser?.id);
    const incoming = requests.data?.incoming.find((item) => item.user.id === selectedGroupUser?.id);
    const outgoing = requests.data?.outgoing.find((item) => item.user.id === selectedGroupUser?.id);
    const blocked = blocks.data?.find((item) => item.user.id === selectedGroupUser?.id);
    const canRemoveMember =
      group.ownerId === currentUserId &&
      Boolean(selectedGroupUser) &&
      selectedGroupUser?.id !== currentUserId &&
      selectedGroupUser?.id !== group.ownerId;
    return (
      <div className="conversation-group-panel">
        <div className="conversation-group-hero">
          <GroupAvatar group={group} size={62} />
          <h2>{group.name}</h2>
          <p>{messages.groupMemberLimit.replace('{count}', String(group.members.length))}</p>
          <time dateTime={group.createdAt}>
            {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
              new Date(group.createdAt),
            )}
          </time>
        </div>
        <h3>{messages.members}</h3>
        {group.members.map((member) => (
          <button
            className={`member-row profile-row-button${premiumNameplateSurfaceClass(member.premium?.nameplate)}`}
            key={member.id}
            onClick={(event) => onOpenProfile(member, event.currentTarget)}
            onContextMenu={(event) => openGroupMemberMenu(event, member)}
          >
            <SocialAvatar user={member} />
            <div className="user-copy">
              <div className="member-name-line">
                <strong>{member.displayName}</strong>
                {member.serverTag && (
                  <ServerTagChip tag={member.serverTag} compact interactive={false} />
                )}
              </div>
              <span>
                @{member.username}
                {member.id === group.ownerId ? ` · ${messages.groupOwner}` : ''}
              </span>
            </div>
          </button>
        ))}
        {groupMenu &&
          selectedGroupUser &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              ref={groupMenuRef}
              className="member-context-menu group-member-context-menu"
              role="menu"
              aria-label={`${selectedGroupUser.displayName} ${messages.memberActions}`}
              style={{ left: groupMenu.left, top: groupMenu.top }}
              onContextMenu={(event) => event.preventDefault()}
            >
              <div className="member-context-head">
                <strong>{selectedGroupUser.displayName}</strong>
                <span>@{selectedGroupUser.username}</span>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onOpenProfile(selectedGroupUser, groupMenu.anchor);
                  setGroupMenu(null);
                }}
              >
                <Users size={15} /> {messages.profile}
              </button>
              {friend && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelectConversation(friend.conversationId);
                    setGroupMenu(null);
                  }}
                >
                  <MessageCircle size={15} /> {messages.message}
                </button>
              )}
              {selectedGroupUser.id !== currentUserId &&
                (friend ? (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={() =>
                      void profileAction(`/social/friends/${selectedGroupUser.id}`, 'DELETE').then(
                        () => setGroupMenu(null),
                      )
                    }
                  >
                    <UserMinus size={15} /> {messages.removeFriend}
                  </button>
                ) : incoming ? (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={() =>
                      void profileAction(`/social/requests/${incoming.id}/accept`, 'POST').then(
                        () => setGroupMenu(null),
                      )
                    }
                  >
                    <Check size={15} /> {messages.accept}
                  </button>
                ) : outgoing ? (
                  <button type="button" role="menuitem" disabled>
                    <Check size={15} /> {messages.friendRequestPending}
                  </button>
                ) : !blocked ? (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={() =>
                      void profileAction('/social/requests', 'POST', {
                        username: selectedGroupUser.username,
                      }).then(() => setGroupMenu(null))
                    }
                  >
                    <UserPlus size={15} /> {messages.addFriend}
                  </button>
                ) : null)}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  void navigator.clipboard.writeText(selectedGroupUser.publicId);
                  setGroupMenu(null);
                }}
              >
                <FileText size={15} /> {messages.copyUserId}
              </button>
              {selectedGroupUser.id !== currentUserId &&
                (blocked ? (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={() =>
                      void profileAction(`/social/blocks/${selectedGroupUser.id}`, 'DELETE').then(
                        () => setGroupMenu(null),
                      )
                    }
                  >
                    <ShieldBan size={15} /> {messages.unblock}
                  </button>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    className="danger"
                    disabled={busy}
                    onClick={() =>
                      void profileAction('/social/blocks', 'POST', {
                        userId: selectedGroupUser.id,
                      }).then(() => setGroupMenu(null))
                    }
                  >
                    <ShieldBan size={15} /> {messages.blockUser}
                  </button>
                ))}
              {canRemoveMember && <div className="member-context-separator" />}
              {canRemoveMember && (
                <button
                  type="button"
                  role="menuitem"
                  className="danger"
                  disabled={busy}
                  onClick={() =>
                    void profileAction(
                      `/dm/groups/${group.id}/members/${selectedGroupUser.id}`,
                      'DELETE',
                    ).then(() => setGroupMenu(null))
                  }
                >
                  <UserMinus size={15} /> {messages.removeFromGroup}
                </button>
              )}
            </div>,
            document.body,
          )}
      </div>
    );
  }

  return (
    <HomeActivityPanel
      messages={messages}
      onOpenProfile={onOpenProfile}
      onDiveVoiceRoom={onDiveVoiceRoom}
    />
  );
}

export function SocialHub({
  currentUser,
  currentUserId,
  emailVerified,
  locale,
  messages,
  selectedConversationId,
  pinnedConversations,
  developerMode,
  onPinnedConversationsChange,
  onSelectConversation,
  onOpenProfile,
  platformOwner,
  onOpenPremium,
}: {
  currentUser: UserProfile;
  currentUserId: string;
  emailVerified: boolean;
  locale: Locale;
  messages: Dictionary;
  selectedConversationId: string | null;
  pinnedConversations: string[];
  developerMode: boolean;
  onPinnedConversationsChange: (pins: string[]) => void | Promise<void>;
  onSelectConversation: (conversationId: string | null) => void;
  onOpenProfile: OpenUserProfile;
  platformOwner: boolean;
  onOpenPremium: () => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'friends' | 'requests' | 'blocked'>('friends');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupSettingsId, setGroupSettingsId] = useState<string | null>(null);
  const [conversationMenu, setConversationMenu] = useState<ConversationMenuTarget | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [clock, setClock] = useState(() => Date.now());
  const [dmSocket, setDmSocket] = useState<Socket | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, Set<string>>>(new Map());
  const typingTimers = useRef<Map<string, number>>(new Map());
  const friends = useQuery({
    queryKey: ['friends'],
    queryFn: () => apiRequest<Friend[]>('/social/friends'),
    refetchOnMount: 'always',
    refetchInterval: 30_000,
  });
  const requests = useQuery({
    queryKey: ['friend-requests'],
    queryFn: () => apiRequest<FriendRequests>('/social/requests'),
    refetchOnMount: 'always',
  });
  const blocks = useQuery({
    queryKey: ['blocks'],
    queryFn: () => apiRequest<BlockedUser[]>('/social/blocks'),
    refetchOnMount: 'always',
  });
  const conversations = useQuery({
    queryKey: ['dm-conversations'],
    queryFn: () => apiRequest<DirectConversation[]>('/dm/conversations'),
    refetchOnMount: 'always',
    refetchInterval: 30_000,
  });
  const groups = useQuery({
    queryKey: ['group-conversations'],
    queryFn: () => apiRequest<GroupConversation[]>('/dm/groups'),
    refetchOnMount: 'always',
    refetchInterval: 30_000,
  });
  const socialUnlockAt = new Date(currentUser.socialUnlockAt).getTime();
  const socialUnlocked = clock >= socialUnlockAt;
  const socialRemainingSeconds = Math.max(0, Math.ceil((socialUnlockAt - clock) / 1000));
  useEffect(() => {
    if (socialUnlocked) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [socialUnlocked]);

  useEffect(() => {
    const socket = io(`${SOCKET_URL}/dm`, { withCredentials: true });
    setDmSocket(socket);
    const clearTypingUser = (conversationId: string, userId: string) => {
      setTypingUsers((current) => {
        const next = new Map(current);
        const users = new Set(next.get(conversationId) ?? []);
        users.delete(userId);
        if (users.size) next.set(conversationId, users);
        else next.delete(conversationId);
        return next;
      });
    };
    const refreshSocial = () => {
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
      void queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['blocks'] });
      void queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['group-conversations'] });
    };
    const refreshMessages = () => {
      void queryClient.invalidateQueries({ queryKey: ['dm-messages'] });
      void queryClient.invalidateQueries({ queryKey: ['group-messages'] });
    };
    socket.on('dm:ready', () => {
      refreshSocial();
      refreshMessages();
    });
    socket.on('social:changed', refreshSocial);
    for (const event of ['dm:created', 'dm:updated', 'dm:deleted']) {
      socket.on(event, (message: DirectMessage) => {
        clearTypingUser(message.conversationId, message.author.id);
        void queryClient.invalidateQueries({ queryKey: ['dm-messages', message.conversationId] });
        void queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
      });
    }
    for (const event of ['group:created', 'group:updated', 'group:deleted']) {
      socket.on(event, (message: GroupMessage) => {
        clearTypingUser(message.conversationId, message.author.id);
        void queryClient.invalidateQueries({
          queryKey: ['group-messages', message.conversationId],
        });
        void queryClient.invalidateQueries({ queryKey: ['group-conversations'] });
      });
    }
    socket.on('dm:reaction', ({ conversationId }: { conversationId: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['dm-messages', conversationId] });
    });
    socket.on('group:reaction', ({ conversationId }: { conversationId: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['group-messages', conversationId] });
    });
    socket.on(
      'typing:update',
      (data: { conversationId: string; userId: string; active?: boolean }) => {
        if (data.userId === currentUserId) return;
        if (data.active === false) {
          clearTypingUser(data.conversationId, data.userId);
          return;
        }
        setTypingUsers((current) => {
          const next = new Map(current);
          const users = new Set(next.get(data.conversationId) ?? []);
          users.add(data.userId);
          next.set(data.conversationId, users);
          return next;
        });
        const timerKey = `${data.conversationId}:${data.userId}`;
        const currentTimer = typingTimers.current.get(timerKey);
        if (currentTimer) window.clearTimeout(currentTimer);
        const timer = window.setTimeout(() => {
          clearTypingUser(data.conversationId, data.userId);
          typingTimers.current.delete(timerKey);
        }, 5000);
        typingTimers.current.set(timerKey, timer);
      },
    );
    return () => {
      for (const timer of typingTimers.current.values()) window.clearTimeout(timer);
      typingTimers.current.clear();
      setDmSocket(null);
      socket.disconnect();
    };
  }, [currentUserId, queryClient]);

  const selectedConversation = conversations.data?.find(
    (conversation) => conversation.id === selectedConversationId,
  );
  const selectedGroupId = selectedConversationId?.startsWith('group:')
    ? selectedConversationId.slice('group:'.length)
    : null;
  const selectedGroup = groups.data?.find((group) => group.id === selectedGroupId);

  const openDirectMenu: OpenConversationMenu<DirectConversation> = (
    conversation,
    position,
    anchor,
  ) =>
    setConversationMenu({
      kind: 'direct',
      conversation,
      profileAnchor: anchor,
      ...boundedConversationMenuPosition(position.left, position.top, 560),
    });

  const openGroupMenu: OpenConversationMenu<GroupConversation> = (conversation, position, anchor) =>
    setConversationMenu({
      kind: 'group',
      conversation,
      profileAnchor: anchor,
      ...boundedConversationMenuPosition(position.left, position.top, 360),
    });

  const toggleConversationPin = (key: string) => {
    const next = pinnedConversations.includes(key)
      ? pinnedConversations.filter((item) => item !== key)
      : [...pinnedConversations, key];
    void onPinnedConversationsChange(next);
  };
  const onlineFriendCount = (friends.data ?? []).filter(
    (friend) => friend.user.status !== 'OFFLINE',
  ).length;
  const conversationCount = (conversations.data?.length ?? 0) + (groups.data?.length ?? 0);
  const requestCount =
    (requests.data?.incoming.length ?? 0) + (requests.data?.outgoing.length ?? 0);
  const wavesCopy =
    locale === 'tr'
      ? {
          eyebrow: 'WAPVE · KENDİ DALGAN',
          title: 'İnsanların burada. Dalganı başlat.',
          description:
            'Arkadaşlarına ulaş, yeni bir ekip kur veya kaldığın sohbetten devam et. Burası sana ait akış.',
          online: 'Çevrim içi',
          conversations: 'Aktif sohbet',
          requests: 'Bağlantı isteği',
          summary: 'Dalga özeti',
        }
      : {
          eyebrow: 'WAPVE · YOUR OWN WAVE',
          title: 'Your people are here. Start the wave.',
          description:
            'Reach your friends, form a new crew, or continue where you left off. This flow is yours.',
          online: 'Online now',
          conversations: 'Active chats',
          requests: 'Connection requests',
          summary: 'Wave summary',
        };

  async function createGroup() {
    if (!groupName.trim() || !groupMemberIds.length) return;
    setBusy(true);
    setError('');
    try {
      const created = await apiRequest<{ id: string }>('/dm/groups', {
        method: 'POST',
        body: JSON.stringify({ name: groupName, memberIds: groupMemberIds }),
      });
      setGroupOpen(false);
      setGroupName('');
      setGroupMemberIds([]);
      await queryClient.invalidateQueries({ queryKey: ['group-conversations'] });
      onSelectConversation(`group:${created.id}`);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function mutate(path: string, method: 'POST' | 'DELETE', body?: object, success = '') {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiRequest(path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      setNotice(success);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['friends'] }),
        queryClient.invalidateQueries({ queryKey: ['friend-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['blocks'] }),
        queryClient.invalidateQueries({ queryKey: ['dm-conversations'] }),
      ]);
      return true;
    } catch (caught) {
      setError(errorMessage(caught, messages));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addFriend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const succeeded = await mutate(
      '/social/requests',
      'POST',
      { username: data.get('username') },
      messages.friendRequestSent,
    );
    if (succeeded) form.reset();
  }

  const loading =
    friends.isPending || requests.isPending || conversations.isPending || groups.isPending;
  return (
    <div className="social-hub">
      <aside
        className={`dm-sidebar mobile-dm-sidebar${selectedConversation || selectedGroup ? ' mobile-hidden' : ''}`}
      >
        <div className="dm-sidebar-brand">
          <span aria-hidden="true">
            <Waves size={18} />
          </span>
          <div>
            <strong>{locale === 'tr' ? 'Sohbetlerin' : 'Your chats'}</strong>
            <small>{locale === 'tr' ? 'Aynı dalgada kal.' : 'Stay on the same wave.'}</small>
          </div>
        </div>
        <div className="social-section-title">
          <MessageCircle size={16} />
          <strong>{messages.directMessages}</strong>
        </div>
        <ConversationList
          locale={locale}
          conversations={conversations.data ?? []}
          pending={conversations.isPending}
          selectedConversationId={selectedConversationId}
          messages={messages}
          onSelectConversation={onSelectConversation}
          onOpenProfile={onOpenProfile}
          onConversationMenu={openDirectMenu}
        />
        <div className="social-section-title group-section-title">
          <Users size={16} />
          <strong>{messages.groupMessages}</strong>
          <button
            aria-label={messages.createGroup}
            onClick={() => setGroupOpen(true)}
            disabled={!socialUnlocked}
          >
            <UserRoundPlus size={16} />
          </button>
        </div>
        <GroupConversationList
          groups={groups.data ?? []}
          selectedConversationId={selectedConversationId}
          messages={messages}
          onSelectConversation={onSelectConversation}
          onManageGroup={setGroupSettingsId}
          onConversationMenu={openGroupMenu}
        />
      </aside>
      <section
        className={`social-main${selectedConversation || selectedGroup ? ' conversation-open' : ''}`}
      >
        {selectedGroup ? (
          <GroupChat
            conversation={selectedGroup}
            currentUserId={currentUserId}
            emailVerified={emailVerified}
            socialUnlocked={socialUnlocked}
            socialRemainingSeconds={socialRemainingSeconds}
            locale={locale}
            messages={messages}
            socket={dmSocket}
            typingUserIds={typingUsers.get(selectedGroup.id) ?? new Set()}
            onBack={() => onSelectConversation(null)}
            onOpenProfile={onOpenProfile}
            onManage={() => setGroupSettingsId(selectedGroup.id)}
            platformOwner={platformOwner}
            premiumActive={Boolean(currentUser.premium?.active)}
            onOpenPremium={onOpenPremium}
            onStartCall={(mode) =>
              window.dispatchEvent(
                new CustomEvent<SocialCallRequest>('wapve:start-social-call', {
                  detail: {
                    conversationId: selectedGroup.id,
                    kind: 'group',
                    mode,
                    title: selectedGroup.name,
                    people: selectedGroup.members.map((member) => ({
                      userId: member.id,
                      displayName: member.displayName,
                      avatarUrl: member.avatarUrl,
                    })),
                  },
                }),
              )
            }
          />
        ) : selectedConversation ? (
          <DirectChat
            conversation={selectedConversation}
            currentUser={currentUser}
            currentUserId={currentUserId}
            emailVerified={emailVerified}
            socialUnlocked={socialUnlocked}
            socialRemainingSeconds={socialRemainingSeconds}
            locale={locale}
            messages={messages}
            socket={dmSocket}
            typingUserIds={typingUsers.get(selectedConversation.id) ?? new Set()}
            onBack={() => onSelectConversation(null)}
            onOpenProfile={onOpenProfile}
            platformOwner={platformOwner}
            premiumActive={Boolean(currentUser.premium?.active)}
            onOpenPremium={onOpenPremium}
            onStartCall={(mode) =>
              window.dispatchEvent(
                new CustomEvent<SocialCallRequest>('wapve:start-social-call', {
                  detail: {
                    conversationId: selectedConversation.id,
                    kind: 'direct',
                    mode,
                    title: selectedConversation.otherUser.displayName,
                    people: [
                      {
                        userId: selectedConversation.otherUser.id,
                        displayName: selectedConversation.otherUser.displayName,
                        avatarUrl: selectedConversation.otherUser.avatarUrl,
                      },
                    ],
                  },
                }),
              )
            }
          />
        ) : (
          <>
            <section className="waves-dashboard-hero" aria-labelledby="waves-dashboard-title">
              <div className="waves-hero-grid" aria-hidden="true" />
              <svg
                className="waves-hero-lines"
                viewBox="0 0 1200 260"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M-120 160C40 58 200 260 360 160S680 58 840 160s320 102 480 0" />
                <path d="M-120 194C40 116 200 272 360 194s320-78 480 0 320 78 480 0" />
                <path d="M-120 224C40 166 200 282 360 224s320-58 480 0 320 58 480 0" />
              </svg>
              <div className="waves-hero-copy">
                <span className="waves-hero-eyebrow">
                  <Waves size={14} /> {wavesCopy.eyebrow}
                </span>
                <h2 id="waves-dashboard-title">{wavesCopy.title}</h2>
                <p>{wavesCopy.description}</p>
                <div className="waves-hero-actions">
                  <form
                    className="friend-add-form waves-friend-form"
                    onSubmit={(event) => void addFriend(event)}
                  >
                    <label className="visually-hidden" htmlFor="waves-friend-username">
                      {messages.friendUsername}
                    </label>
                    <input
                      id="waves-friend-username"
                      name="username"
                      required
                      minLength={3}
                      maxLength={32}
                      placeholder={messages.friendUsernamePlaceholder}
                      aria-label={messages.friendUsername}
                      disabled={!socialUnlocked || busy}
                    />
                    <button disabled={!socialUnlocked || busy}>
                      <UserPlus size={17} />
                      {messages.addFriend}
                    </button>
                  </form>
                  <button
                    className="create-group-button waves-group-button"
                    onClick={() => setGroupOpen(true)}
                    disabled={!socialUnlocked}
                  >
                    <UserRoundPlus size={17} /> {messages.createGroup}
                  </button>
                </div>
                {!socialUnlocked && (
                  <div className="social-cooldown-notice" role="status">
                    <ShieldCheck size={16} />
                    <span>
                      {locale === 'tr'
                        ? `Arkadaşlık ve özel sohbetler ${Math.floor(socialRemainingSeconds / 60)}:${String(socialRemainingSeconds % 60).padStart(2, '0')} sonra açılacak.`
                        : `Friends and private chats unlock in ${Math.floor(socialRemainingSeconds / 60)}:${String(socialRemainingSeconds % 60).padStart(2, '0')}.`}
                    </span>
                  </div>
                )}
              </div>
              <div className="waves-hero-mascot" aria-hidden="true">
                <span className="waves-mascot-orbit" />
                <i />
                <i />
                <i />
                <Image
                  src="/brand/wapve-wave-mark-v2.png"
                  alt=""
                  width={1254}
                  height={1254}
                  sizes="220px"
                  priority
                />
              </div>
            </section>
            <section className="waves-dashboard-stats" aria-label={wavesCopy.summary}>
              <article>
                <span>
                  <Radio size={18} />
                </span>
                <div>
                  <strong>{onlineFriendCount}</strong>
                  <small>{wavesCopy.online}</small>
                </div>
                <i className="waves-live-pulse" aria-hidden="true" />
              </article>
              <article>
                <span>
                  <MessageCircle size={18} />
                </span>
                <div>
                  <strong>{conversationCount}</strong>
                  <small>{wavesCopy.conversations}</small>
                </div>
              </article>
              <article>
                <span>
                  <Activity size={18} />
                </span>
                <div>
                  <strong>{requestCount}</strong>
                  <small>{wavesCopy.requests}</small>
                </div>
              </article>
            </section>
            <div className="social-tabs" role="tablist" aria-label={messages.friends}>
              <button
                role="tab"
                aria-selected={tab === 'friends'}
                className={tab === 'friends' ? 'active' : ''}
                onClick={() => setTab('friends')}
              >
                {messages.allFriends} <span>{friends.data?.length ?? 0}</span>
              </button>
              <button
                role="tab"
                aria-selected={tab === 'requests'}
                className={tab === 'requests' ? 'active' : ''}
                onClick={() => setTab('requests')}
              >
                {messages.friendRequests}{' '}
                <span>
                  {(requests.data?.incoming.length ?? 0) + (requests.data?.outgoing.length ?? 0)}
                </span>
              </button>
              <button
                role="tab"
                aria-selected={tab === 'blocked'}
                className={tab === 'blocked' ? 'active' : ''}
                onClick={() => setTab('blocked')}
              >
                {messages.blockedUsers} <span>{blocks.data?.length ?? 0}</span>
              </button>
            </div>
            {(notice || error) && (
              <div className={error ? 'social-feedback error' : 'social-feedback'} role="status">
                {error || notice}
              </div>
            )}
            {loading ? (
              <div className="social-loading">
                <LoaderCircle className="spin" /> {messages.loading}
              </div>
            ) : tab === 'friends' ? (
              <SocialListEmpty items={friends.data ?? []} empty={messages.noFriends}>
                {(friend) => (
                  <SocialRow
                    key={friend.friendshipId}
                    user={friend.user}
                    onOpenProfile={onOpenProfile}
                  >
                    <button
                      className="social-primary-action"
                      onClick={() => onSelectConversation(friend.conversationId)}
                    >
                      <MessageCircle size={16} /> {messages.message}
                    </button>
                    <button
                      aria-label={`${messages.removeFriend} ${friend.user.username}`}
                      onClick={() =>
                        void mutate(
                          `/social/friends/${friend.user.id}`,
                          'DELETE',
                          undefined,
                          messages.friendRemoved,
                        )
                      }
                      disabled={busy}
                    >
                      <UserMinus size={16} />
                    </button>
                    <button
                      className="danger"
                      aria-label={`${messages.blockUser} ${friend.user.username}`}
                      onClick={() =>
                        void mutate(
                          '/social/blocks',
                          'POST',
                          { userId: friend.user.id },
                          messages.userBlocked,
                        )
                      }
                      disabled={busy}
                    >
                      <ShieldBan size={16} />
                    </button>
                  </SocialRow>
                )}
              </SocialListEmpty>
            ) : tab === 'requests' ? (
              <div className="request-groups">
                <h3>{messages.incomingRequests}</h3>
                <SocialListEmpty
                  items={requests.data?.incoming ?? []}
                  empty={messages.noIncomingRequests}
                >
                  {(request) => (
                    <SocialRow key={request.id} user={request.user} onOpenProfile={onOpenProfile}>
                      <button
                        className="social-primary-action"
                        onClick={() =>
                          void mutate(
                            `/social/requests/${request.id}/accept`,
                            'POST',
                            undefined,
                            messages.friendRequestAccepted,
                          )
                        }
                        disabled={busy}
                      >
                        <Check size={16} /> {messages.accept}
                      </button>
                      <button
                        onClick={() =>
                          void mutate(
                            `/social/requests/${request.id}`,
                            'DELETE',
                            undefined,
                            messages.requestDismissed,
                          )
                        }
                        disabled={busy}
                      >
                        <X size={16} /> {messages.reject}
                      </button>
                    </SocialRow>
                  )}
                </SocialListEmpty>
                <h3>{messages.outgoingRequests}</h3>
                <SocialListEmpty
                  items={requests.data?.outgoing ?? []}
                  empty={messages.noOutgoingRequests}
                >
                  {(request) => (
                    <SocialRow key={request.id} user={request.user} onOpenProfile={onOpenProfile}>
                      <button
                        onClick={() =>
                          void mutate(
                            `/social/requests/${request.id}`,
                            'DELETE',
                            undefined,
                            messages.requestDismissed,
                          )
                        }
                        disabled={busy}
                      >
                        <X size={16} /> {messages.cancel}
                      </button>
                    </SocialRow>
                  )}
                </SocialListEmpty>
              </div>
            ) : (
              <SocialListEmpty items={blocks.data ?? []} empty={messages.noBlockedUsers}>
                {(blocked) => (
                  <SocialRow
                    key={blocked.user.id}
                    user={blocked.user}
                    onOpenProfile={onOpenProfile}
                  >
                    <button
                      onClick={() =>
                        void mutate(
                          `/social/blocks/${blocked.user.id}`,
                          'DELETE',
                          undefined,
                          messages.userUnblocked,
                        )
                      }
                      disabled={busy}
                    >
                      {messages.unblock}
                    </button>
                  </SocialRow>
                )}
              </SocialListEmpty>
            )}
          </>
        )}
      </section>
      {groupOpen && (
        <div
          className="poll-dialog-backdrop"
          role="presentation"
          onMouseDown={() => setGroupOpen(false)}
        >
          <section
            className="poll-dialog group-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={messages.createGroup}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <UserRoundPlus size={20} />
                <strong>{messages.createGroup}</strong>
              </div>
              <button aria-label={messages.close} onClick={() => setGroupOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <label>
              {messages.groupName}
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                maxLength={50}
                autoFocus
              />
            </label>
            <strong>{messages.chooseGroupMembers}</strong>
            <div className="group-member-picker">
              {(friends.data ?? []).map((friend) => {
                const selected = groupMemberIds.includes(friend.user.id);
                return (
                  <button
                    className={selected ? 'active' : ''}
                    key={friend.user.id}
                    disabled={!selected && groupMemberIds.length >= 9}
                    onClick={() =>
                      setGroupMemberIds((current) =>
                        selected
                          ? current.filter((id) => id !== friend.user.id)
                          : [...current, friend.user.id],
                      )
                    }
                  >
                    <SocialAvatar user={friend.user} />
                    <span>
                      <strong>{friend.user.displayName}</strong>
                      <small>@{friend.user.username}</small>
                    </span>
                    {selected && <Check size={16} />}
                  </button>
                );
              })}
            </div>
            <small>
              {messages.groupMemberLimit.replace('{count}', String(groupMemberIds.length + 1))}
            </small>
            <button
              className="wapve-button wapve-button--primary"
              disabled={busy || groupName.trim().length < 2 || !groupMemberIds.length}
              onClick={() => void createGroup()}
            >
              {messages.createGroup}
            </button>
          </section>
        </div>
      )}
      <SocialConversationContextMenu
        target={conversationMenu}
        currentUserId={currentUserId}
        messages={messages}
        pinnedConversations={pinnedConversations}
        developerMode={developerMode}
        onClose={() => setConversationMenu(null)}
        onTogglePin={toggleConversationPin}
        onOpenProfile={onOpenProfile}
        onManageGroup={setGroupSettingsId}
        onConversationGone={(conversationId) => {
          if (selectedConversationId === conversationId) onSelectConversation(null);
        }}
        onNotice={setNotice}
      />
      {groupSettingsId && groups.data?.find((group) => group.id === groupSettingsId) && (
        <GroupSettingsDialog
          group={groups.data.find((group) => group.id === groupSettingsId)!}
          friends={friends.data ?? []}
          currentUserId={currentUserId}
          messages={messages}
          onClose={() => setGroupSettingsId(null)}
          onGone={() => {
            setGroupSettingsId(null);
            onSelectConversation(null);
          }}
        />
      )}
    </div>
  );
}

function SocialReactionList({
  message,
  onReact,
}: {
  message: DirectMessage | GroupMessage;
  onReact: (emoji: string) => void;
}) {
  if (message.deleted || message.reactions.length === 0) return null;
  return (
    <div className="reaction-list social-reaction-list">
      {message.reactions.map((reaction) => (
        <button
          type="button"
          key={reaction.emoji}
          className={reaction.reactedByMe ? 'active' : ''}
          onClick={() => onReact(reaction.emoji)}
        >
          {reaction.emoji}
          <span>{reaction.count}</span>
        </button>
      ))}
    </div>
  );
}

function GroupChat({
  conversation,
  currentUserId,
  emailVerified,
  socialUnlocked,
  socialRemainingSeconds,
  locale,
  messages,
  socket,
  typingUserIds,
  onBack,
  onOpenProfile,
  onStartCall,
  onManage,
  platformOwner,
  premiumActive,
  onOpenPremium,
}: {
  conversation: GroupConversation;
  currentUserId: string;
  emailVerified: boolean;
  socialUnlocked: boolean;
  socialRemainingSeconds: number;
  locale: Locale;
  messages: Dictionary;
  socket: Socket | null;
  typingUserIds: Set<string>;
  onBack: () => void;
  onOpenProfile: OpenUserProfile;
  onStartCall: (mode: 'audio' | 'video') => void;
  onManage: () => void;
  platformOwner: boolean;
  premiumActive: boolean;
  onOpenPremium: () => void;
}) {
  const queryClient = useQueryClient();
  const key = ['group-messages', conversation.id] as const;
  const viewingOlderRef = useRef(false);
  const query = useQuery({
    queryKey: key,
    queryFn: () => apiRequest<GroupMessagePage>(`/dm/groups/${conversation.id}/messages`),
    refetchInterval: () => (viewingOlderRef.current ? false : 5_000),
  });
  const visibleMessages = query.data?.items.filter((message) => !message.deleted) ?? [];
  const [draft, setDraft] = useState('');
  const uploadQueue = useUploadQueue();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [animatedEmojiUpgradeOpen, setAnimatedEmojiUpgradeOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [viewingOlderMessages, setViewingOlderMessages] = useState(false);
  const [messageMenu, setMessageMenu] = useState<MessageMenuState<GroupMessage> | null>(null);
  const [reactingGroupMessage, setReactingGroupMessage] = useState<{
    message: GroupMessage;
    rect: DOMRect;
  } | null>(null);
  const [forwardSource, setForwardSource] = useState<MessageSource | null>(null);
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupMessage | null>(null);
  const reactionFrequencyKey = `wapve:reaction-frequency:${currentUserId}:social`;
  const [reactionFrequency, setReactionFrequency] = useState<ReactionFrequency>({});
  const quickReactionChoices = useMemo(
    () => quickReactions(reactionFrequency, []),
    [reactionFrequency],
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const handledMessageLink = useRef<string | null>(null);
  const draftKey = messageDraftKey(currentUserId, 'group', conversation.id);
  const lastTypingRef = useRef(0);
  const normalizedSearch = searchTerm.trim();
  const searchQuery = useQuery({
    queryKey: ['group-message-search', conversation.id, normalizedSearch],
    queryFn: () =>
      apiRequest<GroupMessage[]>(
        `/dm/groups/${conversation.id}/messages/search?q=${encodeURIComponent(normalizedSearch)}`,
      ),
    enabled: searchOpen && normalizedSearch.length >= 2,
  });

  useEffect(() => {
    if (query.data && !viewingOlderRef.current) bottomRef.current?.scrollIntoView();
  }, [query.data]);

  useEffect(() => {
    if (!query.data) return;
    const markRead = () => {
      if (document.visibilityState !== 'visible') return;
      void apiRequest(`/dm/groups/${conversation.id}/read`, { method: 'POST' }).then(() =>
        queryClient.invalidateQueries({ queryKey: ['group-conversations'] }),
      );
    };
    markRead();
    document.addEventListener('visibilitychange', markRead);
    return () => document.removeEventListener('visibilitychange', markRead);
  }, [conversation.id, query.data?.items.at(-1)?.id, queryClient]);

  useEffect(() => {
    setDraft(readMessageDraft(draftKey));
    uploadQueue.clear();
    setError('');
  }, [draftKey, uploadQueue.clear]);

  useEffect(() => {
    setReactionFrequency(readReactionFrequency(localStorage.getItem(reactionFrequencyKey)));
  }, [reactionFrequencyKey]);

  useEffect(() => {
    if (!messageMenu) return;
    const close = () => setMessageMenu(null);
    window.addEventListener('pointerdown', close);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('blur', close);
    };
  }, [messageMenu]);

  function changeDraft(value: string) {
    setDraft(value);
    writeMessageDraft(draftKey, value);
    const now = Date.now();
    if (!value) socket?.emit('typing:stop', { conversationId: conversation.id, kind: 'group' });
    if (value && now - lastTypingRef.current > 3000) {
      lastTypingRef.current = now;
      const payload = { conversationId: conversation.id, kind: 'group' };
      if (socket?.connected) socket.emit('typing:start', payload);
      else socket?.once('dm:ready', () => socket.emit('typing:start', payload));
    }
  }

  const jumpToMessage = useCallback(
    async (messageId: string) => {
      const context = await apiRequest<GroupMessageContext>(
        `/dm/groups/${conversation.id}/messages/${messageId}/context`,
      );
      viewingOlderRef.current = true;
      setViewingOlderMessages(true);
      queryClient.setQueryData<GroupMessagePage>(
        ['group-messages', conversation.id],
        (current) => ({
          items: context.items,
          nextCursor: null,
          lastReadAt: current?.lastReadAt ?? new Date().toISOString(),
        }),
      );
      setSearchOpen(false);
      setHighlightedId(messageId);
      let attempts = 0;
      const reveal = () => {
        const element = document.getElementById(`message-${messageId}`);
        if (!element && attempts++ < 12) {
          window.requestAnimationFrame(reveal);
          return;
        }
        if (!element) return;
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus({ preventScroll: true });
        consumeMessageHash(messageId);
      };
      window.requestAnimationFrame(reveal);
      window.setTimeout(() => setHighlightedId(null), 2400);
    },
    [conversation.id, queryClient],
  );

  useEffect(() => {
    if (!query.data) return;
    const messageId = messageIdFromHash(window.location.hash);
    const linkKey = messageId ? `${conversation.id}:${messageId}` : null;
    if (!messageId || handledMessageLink.current === linkKey) return;
    handledMessageLink.current = linkKey;
    void jumpToMessage(messageId);
  }, [conversation.id, jumpToMessage, query.data]);

  useEffect(() => {
    const navigate = (event: Event) => {
      const target = (event as CustomEvent<MessageLinkTarget>).detail;
      if (!target || !isSameMessageRoute(target.pathname, window.location.pathname)) {
        return;
      }
      handledMessageLink.current = `${conversation.id}:${target.messageId}`;
      void jumpToMessage(target.messageId);
    };
    window.addEventListener(MESSAGE_LINK_NAVIGATION_EVENT, navigate);
    return () => window.removeEventListener(MESSAGE_LINK_NAVIGATION_EVENT, navigate);
  }, [conversation.id, jumpToMessage]);

  async function jumpToPresent() {
    viewingOlderRef.current = false;
    setViewingOlderMessages(false);
    const url = new URL(window.location.href);
    url.hash = '';
    window.history.replaceState(window.history.state, '', url);
    await query.refetch();
    window.requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
  }

  async function copyMessageLink(messageId: string) {
    await copyTextPreservingScroll(
      `${window.location.origin}${window.location.pathname}#message-${messageId}`,
      scrollRef.current,
    );
  }

  async function send(fileOverride?: File) {
    const automaticVoiceMessage = Boolean(fileOverride);
    if ((!draft.trim() && uploadQueue.items.length === 0 && !fileOverride) || busy) return;
    setBusy(true);
    setError('');
    try {
      if (fileOverride) {
        const params = new URLSearchParams();
        const formData = new FormData();
        formData.set('file', fileOverride);
        await apiRequest(`/dm/groups/${conversation.id}/attachments?${params}`, {
          method: 'POST',
          body: formData,
        });
      } else if (uploadQueue.items.length > 0) {
        const includeContent = !uploadQueue.items.some((item) => item.status === 'complete');
        const uploaded = await uploadQueue.run(async (file, onProgress, signal, index) => {
          const params = new URLSearchParams();
          if (includeContent && index === 0 && draft.trim()) params.set('content', draft);
          const formData = new FormData();
          formData.set('file', file);
          await apiUpload(
            `/dm/groups/${conversation.id}/attachments?${params}`,
            formData,
            onProgress,
            signal,
          );
        });
        if (!uploaded) {
          setError(messages.uploadQueueFailed);
          return;
        }
      } else {
        await apiRequest(`/dm/groups/${conversation.id}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content: draft }),
        });
      }
      if (!automaticVoiceMessage) {
        setDraft('');
        uploadQueue.clear();
        removeMessageDraft(draftKey);
      }
      socket?.emit('typing:stop', { conversationId: conversation.id, kind: 'group' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: ['group-conversations'] }),
      ]);
      window.requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function scheduleMessage(scheduledFor: string) {
    if (!draft.trim()) return;
    await apiRequest('/message-delivery/scheduled', {
      method: 'POST',
      body: JSON.stringify({
        target: { kind: 'GROUP', conversationId: conversation.id },
        content: draft,
        scheduledFor,
      }),
    });
    setDraft('');
    removeMessageDraft(draftKey);
  }

  async function sendGif(gif: GifSearchResult) {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/dm/groups/${conversation.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ gifToken: gif.gifToken }),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: ['group-conversations'] }),
      ]);
      window.requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function edit(messageId: string) {
    if (!editContent.trim()) return;
    setBusy(true);
    try {
      await apiRequest(`/dm/groups/${conversation.id}/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: editContent }),
      });
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function remove(messageId: string) {
    setBusy(true);
    try {
      await apiRequest(`/dm/groups/${conversation.id}/messages/${messageId}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function react(message: GroupMessage, emoji: string) {
    const active = message.reactions.some(
      (reaction) => reaction.emoji === emoji && reaction.reactedByMe,
    );
    setError('');
    try {
      await apiRequest(`/dm/groups/${conversation.id}/messages/${message.id}/reactions`, {
        method: active ? 'DELETE' : 'POST',
        body: JSON.stringify({ emoji }),
      });
      if (!active) {
        setReactionFrequency((current) => {
          const next = incrementReactionFrequency(current, emoji);
          localStorage.setItem(reactionFrequencyKey, JSON.stringify(next));
          return next;
        });
      }
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (caught) {
      setError(errorMessage(caught, messages));
    }
  }

  return (
    <div className="direct-chat group-chat">
      <header>
        <button className="icon-button social-back" onClick={onBack} aria-label={messages.back}>
          <ArrowLeft size={19} />
        </button>
        <GroupAvatar group={conversation} />
        <div className="conversation-header-copy">
          <small className="conversation-kind-label">
            <Waves size={12} /> {locale === 'tr' ? 'GRUP DALGASI' : 'GROUP WAVE'}
          </small>
          <strong>{conversation.name}</strong>
          <span>
            {messages.groupMemberLimit.replace('{count}', String(conversation.members.length))}
          </span>
        </div>
        <div className="conversation-header-actions">
          <button
            className="icon-button"
            aria-label={messages.audioCall}
            disabled={!emailVerified}
            title={
              !emailVerified
                ? locale === 'tr'
                  ? 'Arama için e-postanı doğrula'
                  : 'Verify your email to call'
                : undefined
            }
            onClick={() => onStartCall('audio')}
          >
            <Phone size={18} />
          </button>
          <button
            className="icon-button"
            aria-label={messages.videoCall}
            disabled={!emailVerified}
            title={
              !emailVerified
                ? locale === 'tr'
                  ? 'Arama için e-postanı doğrula'
                  : 'Verify your email to call'
                : undefined
            }
            onClick={() => onStartCall('video')}
          >
            <Video size={18} />
          </button>
          <button
            className={`icon-button${searchOpen ? ' active' : ''}`}
            data-social-message-search-trigger
            aria-label={messages.searchMessages}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
          >
            <Search size={18} />
          </button>
          <button className="icon-button" aria-label={messages.groupSettings} onClick={onManage}>
            <Settings size={18} />
          </button>
        </div>
      </header>
      <div id={`social-call-host-group-${conversation.id}`} className="social-call-stage-host" />
      <div
        className="direct-message-scroll"
        ref={scrollRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          const older =
            element.scrollHeight - element.scrollTop - element.clientHeight >
            Math.max(640, element.clientHeight * 0.75);
          viewingOlderRef.current = older;
          setViewingOlderMessages(older);
        }}
      >
        {query.isPending ? (
          <div className="social-loading">
            <LoaderCircle className="spin" /> {messages.loading}
          </div>
        ) : !visibleMessages.length ? (
          <div className="dm-welcome">
            <Users size={34} />
            <h3>{messages.startGroupConversation}</h3>
          </div>
        ) : (
          visibleMessages.map((message, index) => {
            const startsNewDay = startsNewMessageDay(visibleMessages, index);
            const grouped = !startsNewDay && shouldGroupSocialMessage(visibleMessages, index);
            return (
              <Fragment key={message.id}>
                {startsNewDay && (
                  <MessageDateDivider createdAt={message.createdAt} locale={locale} />
                )}
                <article
                  id={`message-${message.id}`}
                  tabIndex={-1}
                  className={`direct-message${message.systemAction ? ' social-call-system-row' : ''}${message.author.id === currentUserId ? ' own-message' : ''}${grouped ? ' grouped-message' : ''}${highlightedId === message.id ? ' message-highlighted' : ''}`}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    if (message.systemAction) return;
                    setMessageMenu({
                      message,
                      x: Math.min(event.clientX, window.innerWidth - 220),
                      top: Math.min(event.clientY, window.innerHeight - 380),
                      triggerRect: new DOMRect(event.clientX, event.clientY, 0, 0),
                    });
                  }}
                >
                  {grouped ? (
                    <time className="direct-message-compact-time" dateTime={message.createdAt}>
                      {new Intl.DateTimeFormat(locale, {
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(message.createdAt))}
                    </time>
                  ) : (
                    <button
                      className="social-avatar small profile-avatar-button"
                      aria-label={message.author.displayName}
                      onClick={(event) => {
                        const member = conversation.members.find(
                          (item) => item.id === message.author.id,
                        );
                        if (member) onOpenProfile(member, event.currentTarget);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const member = conversation.members.find(
                          (item) => item.id === message.author.id,
                        );
                        if (member) onOpenProfile(member, event.currentTarget);
                      }}
                    >
                      {message.author.avatarUrl ? (
                        <img src={message.author.avatarUrl} alt="" />
                      ) : (
                        message.author.displayName.slice(0, 1).toUpperCase()
                      )}
                    </button>
                  )}
                  <div>
                    {!grouped && (
                      <div className="direct-message-meta">
                        <strong>{message.author.displayName}</strong>
                        {message.author.badges.length > 0 && (
                          <span className="message-author-badges">
                            <PlatformOwnerIcon
                              badges={message.author.badges}
                              locale={locale}
                              size={17}
                            />
                            <AlphaMemberIcon
                              badges={message.author.badges}
                              locale={locale}
                              size={17}
                            />
                          </span>
                        )}
                        <time dateTime={message.createdAt}>
                          {new Intl.DateTimeFormat(locale, {
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(new Date(message.createdAt))}
                        </time>
                      </div>
                    )}
                    {message.systemAction ? (
                      <SocialCallSystemMessage
                        message={message}
                        locale={locale}
                        messages={messages}
                      />
                    ) : editingId === message.id ? (
                      <div className="dm-edit">
                        <input
                          value={editContent}
                          {...(!platformOwner ? { maxLength: 2_500 } : {})}
                          onChange={(event) => setEditContent(event.target.value)}
                        />
                        <button aria-label={messages.save} onClick={() => void edit(message.id)}>
                          <Check size={15} />
                        </button>
                        <button aria-label={messages.close} onClick={() => setEditingId(null)}>
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <>
                        {message.content ? (
                          message.author.system ? (
                            <SystemDmCard content={message.content} createdAt={message.createdAt} />
                          ) : (
                            <MarkdownRenderer
                              content={message.content}
                              locale={locale}
                              members={conversation.members}
                              onOpenMember={onOpenProfile}
                            />
                          )
                        ) : null}
                        <ForwardedMessageCard
                          snapshot={message.forwardedFrom}
                          messages={messages}
                        />
                        {!message.deleted && message.gif && (
                          <MediaPrivacyGuard
                            source="shared"
                            authorId={message.author?.id}
                            currentUserId={currentUserId}
                            locale={locale}
                          >
                            <figure className="message-gif">
                              <img
                                src={message.gif.url}
                                alt={message.gif.alt}
                                width={message.gif.width}
                                height={message.gif.height}
                              />
                              <figcaption>KLIPY</figcaption>
                            </figure>
                          </MediaPrivacyGuard>
                        )}
                        {!message.deleted && message.attachments.length > 0 && (
                          <div className="message-attachments">
                            {message.attachments.map((attachment) => (
                              <MediaPrivacyGuard
                                key={attachment.id}
                                visual={attachment.kind === 'IMAGE' || attachment.kind === 'VIDEO'}
                                source="shared"
                                authorId={message.author?.id}
                                currentUserId={currentUserId}
                                locale={locale}
                              >
                                {attachment.kind === 'IMAGE' ? (
                                  <a
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    key={attachment.id}
                                  >
                                    <img
                                      src={attachment.url}
                                      alt={attachment.name}
                                      loading="lazy"
                                    />
                                  </a>
                                ) : attachment.kind === 'VIDEO' ? (
                                  <video
                                    className="message-video"
                                    src={attachment.url}
                                    controls
                                    preload="metadata"
                                    key={attachment.id}
                                  />
                                ) : attachment.kind === 'AUDIO' ? (
                                  <VoiceMessagePlayer
                                    src={attachment.url}
                                    label={attachment.name}
                                    key={attachment.id}
                                  />
                                ) : (
                                  <TextAttachmentActions
                                    attachment={attachment}
                                    locale={locale}
                                    key={attachment.id}
                                  />
                                )}
                              </MediaPrivacyGuard>
                            ))}
                          </div>
                        )}
                        <SocialReactionList
                          message={message}
                          onReact={(emoji) => void react(message, emoji)}
                        />
                      </>
                    )}
                  </div>
                  {!message.deleted && !message.systemAction && (
                    <div className="dm-actions social-message-hover-actions">
                      <div className="message-reaction-actions">
                        {quickReactionChoices.map((emoji) => (
                          <button
                            type="button"
                            className="reaction-quick-button"
                            key={emoji}
                            title={emoji}
                            onClick={() => void react(message, emoji)}
                          >
                            {emoji}
                          </button>
                        ))}
                        <span className="message-reaction-divider" aria-hidden="true" />
                        <MessageReactionPicker
                          locale={locale}
                          label={messages.addReaction}
                          customEmojis={[]}
                          customEmojiLabel={messages.serverEmojis}
                          onSelect={(emoji) => void react(message, emoji)}
                        />
                      </div>
                      {message.author.id === currentUserId && message.content && (
                        <button
                          type="button"
                          aria-label={messages.editMessage}
                          onClick={() => {
                            setEditingId(message.id);
                            setEditContent(message.content ?? '');
                          }}
                        >
                          <Edit3 size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={messages.forwardMessage}
                        onClick={() =>
                          setForwardSource({
                            kind: 'GROUP',
                            conversationId: conversation.id,
                            messageId: message.id,
                          })
                        }
                      >
                        <Forward size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={messages.messageActions}
                        onClick={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          const pos = boundedMessageMenuPosition(rect);
                          setMessageMenu({
                            message,
                            x: pos.x,
                            top: pos.top,
                            bottom: pos.bottom,
                            triggerRect: rect,
                          });
                        }}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                  )}
                </article>
              </Fragment>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      {viewingOlderMessages && (
        <div className="jump-to-present" role="status">
          <span>{messages.viewingOlderMessages}</span>
          <button type="button" onClick={() => void jumpToPresent()}>
            {messages.jumpToPresent}
          </button>
        </div>
      )}
      {messageMenu &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="group-message-context-menu"
            style={{ left: messageMenu.x, top: messageMenu.top, bottom: messageMenu.bottom }}
            role="menu"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                const target = messageMenu.message;
                const rect = messageMenu.triggerRect;
                setMessageMenu(null);
                setReactingGroupMessage({ message: target, rect });
              }}
            >
              <Smile size={15} /> {messages.addReaction}
            </button>
            {messageMenu.message.content && (
              <button
                role="menuitem"
                onClick={() => {
                  void navigator.clipboard.writeText(messageMenu.message.content ?? '');
                  setMessageMenu(null);
                }}
              >
                <FileText size={15} /> {messages.copyMessage}
              </button>
            )}
            <button
              role="menuitem"
              onClick={() => {
                void copyMessageLink(messageMenu.message.id);
                setMessageMenu(null);
              }}
            >
              <Link2 size={15} /> {messages.copyMessageLink}
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setForwardSource({
                  kind: 'GROUP',
                  conversationId: conversation.id,
                  messageId: messageMenu.message.id,
                });
                setMessageMenu(null);
              }}
            >
              <Forward size={15} /> {messages.forwardMessage}
            </button>
            <button
              role="menuitem"
              onClick={() => {
                void navigator.clipboard.writeText(messageMenu.message.id);
                setMessageMenu(null);
              }}
            >
              <Copy size={15} /> {messages.copyMessageId}
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setReportMessageId(messageMenu.message.id);
                setMessageMenu(null);
              }}
            >
              <Flag size={15} /> {messages.reportMessage}
            </button>
            {!messageMenu.message.deleted && messageMenu.message.author.id === currentUserId && (
              <>
                {messageMenu.message.content && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      setEditingId(messageMenu.message.id);
                      setEditContent(messageMenu.message.content ?? '');
                      setMessageMenu(null);
                    }}
                  >
                    <Edit3 size={15} /> {messages.editMessage}
                  </button>
                )}
                <button
                  className="danger"
                  role="menuitem"
                  onClick={(event) => {
                    const messageToDelete = messageMenu.message;
                    if (event.shiftKey) {
                      void remove(messageToDelete.id);
                    } else {
                      setDeleteTarget(messageToDelete);
                    }
                    setMessageMenu(null);
                  }}
                >
                  <Trash2 size={15} /> {messages.deleteMessage}
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
      {reactingGroupMessage && (
        <MessageReactionPicker
          locale={locale}
          label={messages.addReaction}
          customEmojis={[]}
          customEmojiLabel={messages.serverEmojis}
          premiumActive={premiumActive}
          anchorRect={reactingGroupMessage.rect}
          isOpen={true}
          onClose={() => setReactingGroupMessage(null)}
          onSelect={(emoji) => {
            void react(reactingGroupMessage.message, emoji);
            setReactingGroupMessage(null);
          }}
        />
      )}
      {searchOpen && (
        <SocialMessageSearch
          value={searchTerm}
          onChange={setSearchTerm}
          results={searchQuery.data ?? []}
          pending={searchQuery.isFetching}
          locale={locale}
          messages={messages}
          onClose={() => setSearchOpen(false)}
          onSelect={(id) => void jumpToMessage(id)}
        />
      )}
      {error && (
        <div className="message-error" role="alert">
          {error}
        </div>
      )}
      {typingUserIds.size > 0 && (
        <TypingIndicator
          text={typingText(
            Array.from(typingUserIds)
              .map((id) => conversation.members.find((member) => member.id === id)?.displayName)
              .filter((name): name is string => Boolean(name)),
            messages,
          )}
        />
      )}
      {!socialUnlocked && (
        <div className="social-cooldown-notice composer-lock" role="status">
          <ShieldCheck size={16} />
          <span>
            {locale === 'tr'
              ? `Grup mesajları ${Math.floor(socialRemainingSeconds / 60)}:${String(socialRemainingSeconds % 60).padStart(2, '0')} sonra açılacak.`
              : `Group messages unlock in ${Math.floor(socialRemainingSeconds / 60)}:${String(socialRemainingSeconds % 60).padStart(2, '0')}.`}
          </span>
        </div>
      )}
      <RichMessageComposer
        value={draft}
        onChange={changeDraft}
        onSubmit={() => send()}
        onGif={sendGif}
        onSchedule={scheduleMessage}
        members={conversation.members}
        uploadItems={uploadQueue.items}
        onFiles={(files) => {
          uploadQueue.add(files);
          setError('');
        }}
        onRemoveFile={uploadQueue.remove}
        onClearFiles={uploadQueue.clear}
        onVoiceMessage={send}
        onError={setError}
        disabled={!socialUnlocked}
        busy={busy}
        placeholder={messages.groupMessagePlaceholder}
        ariaLabel={messages.groupMessagePlaceholder}
        locale={locale}
        messages={messages}
        unlimitedText={platformOwner}
        premiumActive={premiumActive}
        onPremiumRequired={() => setAnimatedEmojiUpgradeOpen(true)}
      />
      <AnimatedEmojiUpgradeDialog
        open={animatedEmojiUpgradeOpen}
        onOpenChange={setAnimatedEmojiUpgradeOpen}
        locale={locale}
        onExplore={() => {
          setAnimatedEmojiUpgradeOpen(false);
          onOpenPremium();
        }}
      />
      <ForwardMessageDialog
        source={forwardSource}
        messages={messages}
        onClose={() => setForwardSource(null)}
      />
      <ContentReportDialog
        target={
          reportMessageId
            ? { type: 'GROUP_MESSAGE', id: reportMessageId, label: conversation.name }
            : null
        }
        locale={locale}
        messages={messages}
        onClose={() => setReportMessageId(null)}
      />
      <DeleteMessageDialog
        message={deleteTarget}
        locale={locale}
        messages={messages}
        busy={busy}
        onConfirm={async () => {
          if (deleteTarget) {
            await remove(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function DirectChat({
  conversation,
  currentUser,
  currentUserId,
  emailVerified,
  socialUnlocked,
  socialRemainingSeconds,
  locale,
  messages,
  socket,
  typingUserIds,
  onBack,
  onOpenProfile,
  onStartCall,
  platformOwner,
  premiumActive,
  onOpenPremium,
}: {
  conversation: DirectConversation;
  currentUser: UserProfile;
  currentUserId: string;
  emailVerified: boolean;
  socialUnlocked: boolean;
  socialRemainingSeconds: number;
  locale: Locale;
  messages: Dictionary;
  socket: Socket | null;
  typingUserIds: Set<string>;
  onBack: () => void;
  onOpenProfile: OpenUserProfile;
  onStartCall: (mode: 'audio' | 'video') => void;
  platformOwner: boolean;
  premiumActive: boolean;
  onOpenPremium: () => void;
}) {
  const queryClient = useQueryClient();
  const key = ['dm-messages', conversation.id] as const;
  const viewingOlderRef = useRef(false);
  const query = useQuery({
    queryKey: key,
    queryFn: () => apiRequest<DirectMessagePage>(`/dm/conversations/${conversation.id}/messages`),
    refetchInterval: () => (viewingOlderRef.current ? false : 5_000),
  });
  const visibleMessages = query.data?.items.filter((message) => !message.deleted) ?? [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [animatedEmojiUpgradeOpen, setAnimatedEmojiUpgradeOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [draft, setDraft] = useState('');
  const uploadQueue = useUploadQueue();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [viewingOlderMessages, setViewingOlderMessages] = useState(false);
  const [messageMenu, setMessageMenu] = useState<MessageMenuState<DirectMessage> | null>(null);
  const [reactingDirectMessage, setReactingDirectMessage] = useState<{
    message: DirectMessage;
    rect: DOMRect;
  } | null>(null);
  const [forwardSource, setForwardSource] = useState<MessageSource | null>(null);
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DirectMessage | null>(null);
  const reactionFrequencyKey = `wapve:reaction-frequency:${currentUserId}:social`;
  const [reactionFrequency, setReactionFrequency] = useState<ReactionFrequency>({});
  const quickReactionChoices = useMemo(
    () => quickReactions(reactionFrequency, []),
    [reactionFrequency],
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const handledMessageLink = useRef<string | null>(null);
  const draftKey = messageDraftKey(currentUserId, 'direct', conversation.id);
  const lastTypingRef = useRef(0);
  const normalizedSearch = searchTerm.trim();
  const searchQuery = useQuery({
    queryKey: ['dm-message-search', conversation.id, normalizedSearch],
    queryFn: () =>
      apiRequest<DirectMessage[]>(
        `/dm/conversations/${conversation.id}/messages/search?q=${encodeURIComponent(normalizedSearch)}`,
      ),
    enabled: searchOpen && normalizedSearch.length >= 2,
  });

  useEffect(() => {
    if (query.data && !viewingOlderRef.current) bottomRef.current?.scrollIntoView();
  }, [query.data]);

  useEffect(() => {
    if (!query.data) return;
    const markRead = () => {
      if (document.visibilityState !== 'visible') return;
      void apiRequest(`/dm/conversations/${conversation.id}/read`, { method: 'POST' }).then(() =>
        queryClient.invalidateQueries({ queryKey: ['dm-conversations'] }),
      );
    };
    markRead();
    document.addEventListener('visibilitychange', markRead);
    return () => document.removeEventListener('visibilitychange', markRead);
  }, [conversation.id, query.data?.items.at(-1)?.id, queryClient]);

  useEffect(() => {
    setDraft(readMessageDraft(draftKey));
    uploadQueue.clear();
    setError('');
  }, [conversation.id, draftKey, uploadQueue.clear]);

  useEffect(() => {
    setReactionFrequency(readReactionFrequency(localStorage.getItem(reactionFrequencyKey)));
  }, [reactionFrequencyKey]);

  useEffect(() => {
    if (!messageMenu) return;
    const close = () => setMessageMenu(null);
    window.addEventListener('pointerdown', close);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('blur', close);
    };
  }, [messageMenu]);

  function changeDraft(value: string) {
    setDraft(value);
    writeMessageDraft(draftKey, value);
    const now = Date.now();
    if (!value) socket?.emit('typing:stop', { conversationId: conversation.id, kind: 'direct' });
    if (value && now - lastTypingRef.current > 3000) {
      lastTypingRef.current = now;
      const payload = { conversationId: conversation.id, kind: 'direct' };
      if (socket?.connected) socket.emit('typing:start', payload);
      else socket?.once('dm:ready', () => socket.emit('typing:start', payload));
    }
  }

  const jumpToMessage = useCallback(
    async (messageId: string) => {
      const context = await apiRequest<DirectMessageContext>(
        `/dm/conversations/${conversation.id}/messages/${messageId}/context`,
      );
      viewingOlderRef.current = true;
      setViewingOlderMessages(true);
      queryClient.setQueryData<DirectMessagePage>(['dm-messages', conversation.id], (current) => ({
        items: context.items,
        nextCursor: null,
        lastReadAt: current?.lastReadAt ?? new Date().toISOString(),
      }));
      setSearchOpen(false);
      setHighlightedId(messageId);
      let attempts = 0;
      const reveal = () => {
        const element = document.getElementById(`message-${messageId}`);
        if (!element && attempts++ < 12) {
          window.requestAnimationFrame(reveal);
          return;
        }
        if (!element) return;
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus({ preventScroll: true });
        consumeMessageHash(messageId);
      };
      window.requestAnimationFrame(reveal);
      window.setTimeout(() => setHighlightedId(null), 2400);
    },
    [conversation.id, queryClient],
  );

  useEffect(() => {
    if (!query.data) return;
    const messageId = messageIdFromHash(window.location.hash);
    const linkKey = messageId ? `${conversation.id}:${messageId}` : null;
    if (!messageId || handledMessageLink.current === linkKey) return;
    handledMessageLink.current = linkKey;
    void jumpToMessage(messageId);
  }, [conversation.id, jumpToMessage, query.data]);

  useEffect(() => {
    const navigate = (event: Event) => {
      const target = (event as CustomEvent<MessageLinkTarget>).detail;
      if (!target || !isSameMessageRoute(target.pathname, window.location.pathname)) {
        return;
      }
      handledMessageLink.current = `${conversation.id}:${target.messageId}`;
      void jumpToMessage(target.messageId);
    };
    window.addEventListener(MESSAGE_LINK_NAVIGATION_EVENT, navigate);
    return () => window.removeEventListener(MESSAGE_LINK_NAVIGATION_EVENT, navigate);
  }, [conversation.id, jumpToMessage]);

  async function jumpToPresent() {
    viewingOlderRef.current = false;
    setViewingOlderMessages(false);
    const url = new URL(window.location.href);
    url.hash = '';
    window.history.replaceState(window.history.state, '', url);
    await query.refetch();
    window.requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
  }

  async function copyMessageLink(messageId: string) {
    await copyTextPreservingScroll(
      `${window.location.origin}${window.location.pathname}#message-${messageId}`,
      scrollRef.current,
    );
  }

  async function send(fileOverride?: File) {
    const automaticVoiceMessage = Boolean(fileOverride);
    if ((!draft.trim() && uploadQueue.items.length === 0 && !fileOverride) || busy) return;
    setBusy(true);
    setError('');
    try {
      if (fileOverride) {
        const params = new URLSearchParams();
        const formData = new FormData();
        formData.set('file', fileOverride);
        await apiRequest(`/dm/conversations/${conversation.id}/attachments?${params}`, {
          method: 'POST',
          body: formData,
        });
      } else if (uploadQueue.items.length > 0) {
        const includeContent = !uploadQueue.items.some((item) => item.status === 'complete');
        const uploaded = await uploadQueue.run(async (file, onProgress, signal, index) => {
          const params = new URLSearchParams();
          if (includeContent && index === 0 && draft.trim()) params.set('content', draft);
          const formData = new FormData();
          formData.set('file', file);
          await apiUpload(
            `/dm/conversations/${conversation.id}/attachments?${params}`,
            formData,
            onProgress,
            signal,
          );
        });
        if (!uploaded) {
          setError(messages.uploadQueueFailed);
          return;
        }
      } else {
        await apiRequest(`/dm/conversations/${conversation.id}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content: draft }),
        });
      }
      if (!automaticVoiceMessage) {
        setDraft('');
        removeMessageDraft(draftKey);
        uploadQueue.clear();
      }
      socket?.emit('typing:stop', { conversationId: conversation.id, kind: 'direct' });
      await queryClient.invalidateQueries({ queryKey: key });
      await queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
      window.requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function scheduleMessage(scheduledFor: string) {
    if (!draft.trim()) return;
    await apiRequest('/message-delivery/scheduled', {
      method: 'POST',
      body: JSON.stringify({
        target: { kind: 'DIRECT', conversationId: conversation.id },
        content: draft,
        scheduledFor,
      }),
    });
    setDraft('');
    removeMessageDraft(draftKey);
  }

  async function sendGif(gif: GifSearchResult) {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/dm/conversations/${conversation.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ gifToken: gif.gifToken }),
      });
      await queryClient.invalidateQueries({ queryKey: key });
      await queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
      window.requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function edit(messageId: string) {
    if (!editContent.trim()) return;
    setBusy(true);
    try {
      await apiRequest(`/dm/conversations/${conversation.id}/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: editContent }),
      });
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function remove(messageId: string) {
    setBusy(true);
    try {
      await apiRequest(`/dm/conversations/${conversation.id}/messages/${messageId}`, {
        method: 'DELETE',
      });
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function react(message: DirectMessage, emoji: string) {
    const active = message.reactions.some(
      (reaction) => reaction.emoji === emoji && reaction.reactedByMe,
    );
    setError('');
    try {
      await apiRequest(`/dm/conversations/${conversation.id}/messages/${message.id}/reactions`, {
        method: active ? 'DELETE' : 'POST',
        body: JSON.stringify({ emoji }),
      });
      if (!active) {
        setReactionFrequency((current) => {
          const next = incrementReactionFrequency(current, emoji);
          localStorage.setItem(reactionFrequencyKey, JSON.stringify(next));
          return next;
        });
      }
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (caught) {
      setError(errorMessage(caught, messages));
    }
  }

  return (
    <div className="direct-chat">
      <header>
        <button className="icon-button social-back" onClick={onBack} aria-label={messages.back}>
          <ArrowLeft size={19} />
        </button>
        <button
          className="direct-profile-trigger"
          onClick={(event) => onOpenProfile(conversation.otherUser, event.currentTarget)}
        >
          <SocialAvatar user={conversation.otherUser} />
        </button>
        <div
          className="direct-profile-copy"
          role="button"
          tabIndex={0}
          onClick={(event) => onOpenProfile(conversation.otherUser, event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ')
              onOpenProfile(conversation.otherUser, event.currentTarget);
          }}
        >
          <small className="conversation-kind-label">
            <Waves size={12} /> {locale === 'tr' ? 'KİŞİSEL DALGA' : 'DIRECT WAVE'}
          </small>
          <strong>{conversation.otherUser.displayName}</strong>
          <span>@{conversation.otherUser.username}</span>
        </div>
        <div className="conversation-header-actions">
          <button
            className="icon-button"
            aria-label={messages.audioCall}
            disabled={!emailVerified || conversation.otherUser.system}
            title={
              !emailVerified
                ? locale === 'tr'
                  ? 'Arama için e-postanı doğrula'
                  : 'Verify your email to call'
                : undefined
            }
            onClick={() => onStartCall('audio')}
          >
            <Phone size={18} />
          </button>
          <button
            className="icon-button"
            aria-label={messages.videoCall}
            disabled={!emailVerified || conversation.otherUser.system}
            title={
              !emailVerified
                ? locale === 'tr'
                  ? 'Arama için e-postanı doğrula'
                  : 'Verify your email to call'
                : undefined
            }
            onClick={() => onStartCall('video')}
          >
            <Video size={18} />
          </button>
          <button
            className={`icon-button${searchOpen ? ' active' : ''}`}
            data-social-message-search-trigger
            aria-label={messages.searchMessages}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
          >
            <Search size={18} />
          </button>
        </div>
      </header>
      <div id={`social-call-host-direct-${conversation.id}`} className="social-call-stage-host" />
      <div
        className="direct-message-scroll"
        ref={scrollRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          const older =
            element.scrollHeight - element.scrollTop - element.clientHeight >
            Math.max(640, element.clientHeight * 0.75);
          viewingOlderRef.current = older;
          setViewingOlderMessages(older);
        }}
      >
        {query.isPending ? (
          <div className="social-loading">
            <LoaderCircle className="spin" /> {messages.loading}
          </div>
        ) : !visibleMessages.length ? (
          <div className="dm-welcome">
            <MessageCircle size={34} />
            <h3>{messages.startConversation}</h3>
            <p>{messages.dmPrivacyHint}</p>
          </div>
        ) : (
          visibleMessages.map((message, index) => {
            const startsNewDay = startsNewMessageDay(visibleMessages, index);
            const grouped = !startsNewDay && shouldGroupSocialMessage(visibleMessages, index);
            return (
              <Fragment key={message.id}>
                {startsNewDay && (
                  <MessageDateDivider createdAt={message.createdAt} locale={locale} />
                )}
                <article
                  id={`message-${message.id}`}
                  tabIndex={-1}
                  className={`direct-message${message.systemAction ? ' social-call-system-row' : ''}${message.author.id === currentUserId ? ' own-message' : ''}${grouped ? ' grouped-message' : ''}${highlightedId === message.id ? ' message-highlighted' : ''}`}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    if (message.systemAction) return;
                    setMessageMenu({
                      message,
                      x: Math.min(event.clientX, window.innerWidth - 220),
                      top: Math.min(event.clientY, window.innerHeight - 380),
                      triggerRect: new DOMRect(event.clientX, event.clientY, 0, 0),
                    });
                  }}
                >
                  {grouped ? (
                    <time className="direct-message-compact-time" dateTime={message.createdAt}>
                      {new Intl.DateTimeFormat(locale, {
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(message.createdAt))}
                    </time>
                  ) : (
                    <button
                      className="social-avatar small profile-avatar-button"
                      aria-label={message.author.displayName}
                      onClick={(event) =>
                        onOpenProfile(
                          message.author.id === currentUserId
                            ? {
                                id: currentUser.id,
                                publicId: currentUser.publicId,
                                createdAt: currentUser.createdAt,
                                username: currentUser.username,
                                displayName: currentUser.displayName,
                                avatarUrl: currentUser.avatarUrl,
                                bannerUrl: currentUser.bannerUrl,
                                status: currentUser.status,
                                customStatusText: currentUser.customStatusText,
                                customStatusEmoji: currentUser.customStatusEmoji,
                                bio: currentUser.bio,
                                system: currentUser.system,
                                badges: currentUser.badges,
                              }
                            : conversation.otherUser,
                          event.currentTarget,
                        )
                      }
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onOpenProfile(
                          message.author.id === currentUserId
                            ? {
                                id: currentUser.id,
                                publicId: currentUser.publicId,
                                createdAt: currentUser.createdAt,
                                username: currentUser.username,
                                displayName: currentUser.displayName,
                                avatarUrl: currentUser.avatarUrl,
                                bannerUrl: currentUser.bannerUrl,
                                status: currentUser.status,
                                customStatusText: currentUser.customStatusText,
                                customStatusEmoji: currentUser.customStatusEmoji,
                                bio: currentUser.bio,
                                system: currentUser.system,
                                badges: currentUser.badges,
                              }
                            : conversation.otherUser,
                          event.currentTarget,
                        );
                      }}
                    >
                      {message.author.avatarUrl ? (
                        <img src={message.author.avatarUrl} alt="" />
                      ) : (
                        message.author.displayName.slice(0, 1).toUpperCase()
                      )}
                    </button>
                  )}
                  <div>
                    {!grouped && (
                      <div className="direct-message-meta">
                        <strong>{message.author.displayName}</strong>
                        {message.author.badges.length > 0 && (
                          <span className="message-author-badges">
                            <PlatformOwnerIcon
                              badges={message.author.badges}
                              locale={locale}
                              size={17}
                            />
                            <AlphaMemberIcon
                              badges={message.author.badges}
                              locale={locale}
                              size={17}
                            />
                          </span>
                        )}
                        <time dateTime={message.createdAt}>
                          {new Intl.DateTimeFormat(locale, {
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(new Date(message.createdAt))}
                        </time>
                        {message.editedAt && <span>{messages.edited}</span>}
                      </div>
                    )}
                    {message.systemAction ? (
                      <SocialCallSystemMessage
                        message={message}
                        locale={locale}
                        messages={messages}
                      />
                    ) : editingId === message.id ? (
                      <div className="dm-edit">
                        <input
                          value={editContent}
                          {...(!platformOwner ? { maxLength: 2_500 } : {})}
                          onChange={(event) => setEditContent(event.target.value)}
                        />
                        <button aria-label={messages.save} onClick={() => void edit(message.id)}>
                          <Check size={15} />
                        </button>
                        <button aria-label={messages.close} onClick={() => setEditingId(null)}>
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <>
                        {message.content ? (
                          message.author.system ? (
                            <SystemDmCard content={message.content} createdAt={message.createdAt} />
                          ) : (
                            <MarkdownRenderer
                              content={message.content}
                              locale={locale}
                              members={[currentUser, conversation.otherUser]}
                              onOpenMember={onOpenProfile}
                            />
                          )
                        ) : null}
                        <ForwardedMessageCard
                          snapshot={message.forwardedFrom}
                          messages={messages}
                        />
                        {!message.deleted && message.gif && (
                          <MediaPrivacyGuard
                            source="direct"
                            authorId={message.author?.id}
                            currentUserId={currentUserId}
                            locale={locale}
                          >
                            <figure className="message-gif">
                              <img
                                src={message.gif.url}
                                alt={message.gif.alt}
                                width={message.gif.width}
                                height={message.gif.height}
                                onLoad={() => {
                                  if (
                                    message.author.id === currentUserId &&
                                    message.id === query.data?.items.at(-1)?.id
                                  )
                                    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
                                }}
                              />
                              <figcaption>KLIPY</figcaption>
                            </figure>
                          </MediaPrivacyGuard>
                        )}
                        {!message.deleted && message.attachments.length > 0 && (
                          <div className="message-attachments">
                            {message.attachments.map((attachment) => (
                              <MediaPrivacyGuard
                                key={attachment.id}
                                visual={attachment.kind === 'IMAGE' || attachment.kind === 'VIDEO'}
                                source="direct"
                                authorId={message.author?.id}
                                currentUserId={currentUserId}
                                locale={locale}
                              >
                                {attachment.kind === 'IMAGE' ? (
                                  <a
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    key={attachment.id}
                                  >
                                    <img
                                      src={attachment.url}
                                      alt={attachment.name}
                                      loading="lazy"
                                    />
                                  </a>
                                ) : attachment.kind === 'VIDEO' ? (
                                  <video
                                    className="message-video"
                                    src={attachment.url}
                                    controls
                                    preload="metadata"
                                    key={attachment.id}
                                  />
                                ) : attachment.kind === 'AUDIO' ? (
                                  <VoiceMessagePlayer
                                    src={attachment.url}
                                    label={attachment.name}
                                    key={attachment.id}
                                  />
                                ) : (
                                  <TextAttachmentActions
                                    attachment={attachment}
                                    locale={locale}
                                    key={attachment.id}
                                  />
                                )}
                              </MediaPrivacyGuard>
                            ))}
                          </div>
                        )}
                        <SocialReactionList
                          message={message}
                          onReact={(emoji) => void react(message, emoji)}
                        />
                      </>
                    )}
                  </div>
                  {!message.deleted && !message.systemAction && (
                    <div className="dm-actions social-message-hover-actions">
                      <div className="message-reaction-actions">
                        {quickReactionChoices.map((emoji) => (
                          <button
                            type="button"
                            className="reaction-quick-button"
                            key={emoji}
                            title={emoji}
                            onClick={() => void react(message, emoji)}
                          >
                            {emoji}
                          </button>
                        ))}
                        <span className="message-reaction-divider" aria-hidden="true" />
                        <MessageReactionPicker
                          locale={locale}
                          label={messages.addReaction}
                          customEmojis={[]}
                          customEmojiLabel={messages.serverEmojis}
                          onSelect={(emoji) => void react(message, emoji)}
                        />
                      </div>
                      {message.author.id === currentUserId && message.content && (
                        <button
                          type="button"
                          aria-label={messages.editMessage}
                          onClick={() => {
                            setEditingId(message.id);
                            setEditContent(message.content ?? '');
                          }}
                        >
                          <Edit3 size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={messages.forwardMessage}
                        onClick={() =>
                          setForwardSource({
                            kind: 'DIRECT',
                            conversationId: conversation.id,
                            messageId: message.id,
                          })
                        }
                      >
                        <Forward size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={messages.messageActions}
                        onClick={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          const pos = boundedMessageMenuPosition(rect);
                          setMessageMenu({
                            message,
                            x: pos.x,
                            top: pos.top,
                            bottom: pos.bottom,
                            triggerRect: rect,
                          });
                        }}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                  )}
                </article>
              </Fragment>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      {viewingOlderMessages && (
        <div className="jump-to-present" role="status">
          <span>{messages.viewingOlderMessages}</span>
          <button type="button" onClick={() => void jumpToPresent()}>
            {messages.jumpToPresent}
          </button>
        </div>
      )}
      {messageMenu &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="group-message-context-menu"
            style={{ left: messageMenu.x, top: messageMenu.top, bottom: messageMenu.bottom }}
            role="menu"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                const target = messageMenu.message;
                const rect = messageMenu.triggerRect;
                setMessageMenu(null);
                setReactingDirectMessage({ message: target, rect });
              }}
            >
              <Smile size={15} /> {messages.addReaction}
            </button>
            {messageMenu.message.content && (
              <button
                role="menuitem"
                onClick={() => {
                  void navigator.clipboard.writeText(messageMenu.message.content ?? '');
                  setMessageMenu(null);
                }}
              >
                <FileText size={15} /> {messages.copyMessage}
              </button>
            )}
            <button
              role="menuitem"
              onClick={() => {
                void copyMessageLink(messageMenu.message.id);
                setMessageMenu(null);
              }}
            >
              <Link2 size={15} /> {messages.copyMessageLink}
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setForwardSource({
                  kind: 'DIRECT',
                  conversationId: conversation.id,
                  messageId: messageMenu.message.id,
                });
                setMessageMenu(null);
              }}
            >
              <Forward size={15} /> {messages.forwardMessage}
            </button>
            <button
              role="menuitem"
              onClick={() => {
                void navigator.clipboard.writeText(messageMenu.message.id);
                setMessageMenu(null);
              }}
            >
              <Copy size={15} /> {messages.copyMessageId}
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setReportMessageId(messageMenu.message.id);
                setMessageMenu(null);
              }}
            >
              <Flag size={15} /> {messages.reportMessage}
            </button>
            {!messageMenu.message.deleted && messageMenu.message.author.id === currentUserId && (
              <>
                {messageMenu.message.content && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      setEditingId(messageMenu.message.id);
                      setEditContent(messageMenu.message.content ?? '');
                      setMessageMenu(null);
                    }}
                  >
                    <Edit3 size={15} /> {messages.editMessage}
                  </button>
                )}
                <button
                  className="danger"
                  role="menuitem"
                  onClick={(event) => {
                    const messageToDelete = messageMenu.message;
                    if (event.shiftKey) {
                      void remove(messageToDelete.id);
                    } else {
                      setDeleteTarget(messageToDelete);
                    }
                    setMessageMenu(null);
                  }}
                >
                  <Trash2 size={15} /> {messages.deleteMessage}
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
      {reactingDirectMessage && (
        <MessageReactionPicker
          locale={locale}
          label={messages.addReaction}
          customEmojis={[]}
          customEmojiLabel={messages.serverEmojis}
          premiumActive={premiumActive}
          anchorRect={reactingDirectMessage.rect}
          isOpen={true}
          onClose={() => setReactingDirectMessage(null)}
          onSelect={(emoji) => {
            void react(reactingDirectMessage.message, emoji);
            setReactingDirectMessage(null);
          }}
        />
      )}
      {searchOpen && (
        <SocialMessageSearch
          value={searchTerm}
          onChange={setSearchTerm}
          results={searchQuery.data ?? []}
          pending={searchQuery.isFetching}
          locale={locale}
          messages={messages}
          onClose={() => setSearchOpen(false)}
          onSelect={(id) => void jumpToMessage(id)}
        />
      )}
      {error && (
        <div className="message-error" role="alert">
          {error}
        </div>
      )}
      {conversation.inboxState && conversation.inboxState !== 'ACCEPTED' && (
        <div className={privacyStyles.requestBanner}>
          <div>
            <strong>
              {conversation.inboxState === 'SPAM'
                ? locale === 'tr'
                  ? 'Akış filtresine alındı'
                  : 'Moved to your flow filter'
                : conversation.inboxState === 'DECLINED'
                  ? locale === 'tr'
                    ? 'Sohbet kapalı'
                    : 'Chat closed'
                  : locale === 'tr'
                    ? 'Yeni sohbet daveti'
                    : 'New chat invitation'}
            </strong>
            <p>
              {locale === 'tr'
                ? 'Konuşmaya devam etmek için kabul et. Reddedersen bu kişi buradan yeni mesaj gönderemez.'
                : 'Accept to continue the conversation. Declining stops new messages from this person here.'}
            </p>
          </div>
          <div>
            {(['DECLINE', 'ACCEPT'] as const).map((action) => (
              <button
                type="button"
                key={action}
                disabled={busy || (action === 'DECLINE' && conversation.inboxState === 'DECLINED')}
                onClick={() => { void (async () => {
                  setBusy(true);
                  setError('');
                  try {
                    await apiRequest(`/dm/conversations/${conversation.id}/inbox`, {
                      method: 'PATCH',
                      body: JSON.stringify({ action }),
                    });
                    await queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
                  } catch {
                    setError(
                      locale === 'tr'
                        ? 'İşlem tamamlanamadı. Tekrar dene.'
                        : 'Could not complete this action. Try again.',
                    );
                  } finally {
                    setBusy(false);
                  }
                })(); }}
              >
                {action === 'ACCEPT'
                  ? locale === 'tr'
                    ? 'Kabul et'
                    : 'Accept'
                  : locale === 'tr'
                    ? 'Reddet'
                    : 'Decline'}
              </button>
            ))}
          </div>
        </div>
      )}
      {!conversation.canMessage &&
        (!conversation.inboxState || conversation.inboxState === 'ACCEPTED') && (
          <div className="dm-disabled">
            {conversation.otherUser.system
              ? locale === 'tr'
                ? 'Bu, Wapve’nin doğrulanmış tek yönlü sistem hesabıdır. Bu hesaba mesaj gönderilemez veya arama başlatılamaz.'
                : 'This is Wapve’s verified one-way system account. You cannot message or call this account.'
              : locale === 'tr'
                ? 'Gizlilik tercihleri veya bağlantı durumunuz nedeniyle şu anda mesaj gönderilemiyor.'
                : 'Privacy preferences or your connection status prevent new messages right now.'}
          </div>
        )}
      {typingUserIds.size > 0 && (
        <TypingIndicator text={typingText([conversation.otherUser.displayName], messages)} />
      )}
      {conversation.otherUser.system ? (
        <div
          className="dm-system-composer-notice"
          role="status"
          aria-label={messages.systemMessageComposer}
        >
          <ShieldCheck size={18} />
          <span>{messages.systemMessageComposer}</span>
        </div>
      ) : (
        <>
          {!socialUnlocked && (
            <div className="social-cooldown-notice composer-lock" role="status">
              <ShieldCheck size={16} />
              <span>
                {locale === 'tr'
                  ? `Özel mesajlar ${Math.floor(socialRemainingSeconds / 60)}:${String(socialRemainingSeconds % 60).padStart(2, '0')} sonra açılacak.`
                  : `Direct messages unlock in ${Math.floor(socialRemainingSeconds / 60)}:${String(socialRemainingSeconds % 60).padStart(2, '0')}.`}
              </span>
            </div>
          )}
          <RichMessageComposer
            value={draft}
            onChange={changeDraft}
            onSubmit={() => send()}
            onGif={sendGif}
            onSchedule={scheduleMessage}
            members={[currentUser, conversation.otherUser]}
            uploadItems={uploadQueue.items}
            onFiles={(files) => {
              uploadQueue.add(files);
              setError('');
            }}
            onRemoveFile={uploadQueue.remove}
            onClearFiles={uploadQueue.clear}
            onVoiceMessage={send}
            onError={setError}
            disabled={!socialUnlocked || !conversation.canMessage}
            busy={busy}
            placeholder={`${messages.directMessagePlaceholder} @${conversation.otherUser.username}`}
            ariaLabel={messages.directMessagePlaceholder}
            locale={locale}
            messages={messages}
            unlimitedText={platformOwner}
            premiumActive={premiumActive}
            onPremiumRequired={() => setAnimatedEmojiUpgradeOpen(true)}
          />
        </>
      )}
      <AnimatedEmojiUpgradeDialog
        open={animatedEmojiUpgradeOpen}
        onOpenChange={setAnimatedEmojiUpgradeOpen}
        locale={locale}
        onExplore={() => {
          setAnimatedEmojiUpgradeOpen(false);
          onOpenPremium();
        }}
      />
      <ForwardMessageDialog
        source={forwardSource}
        messages={messages}
        onClose={() => setForwardSource(null)}
      />
      <ContentReportDialog
        target={
          reportMessageId
            ? {
                type: 'DIRECT_MESSAGE',
                id: reportMessageId,
                label: `@${conversation.otherUser.username}`,
              }
            : null
        }
        locale={locale}
        messages={messages}
        onClose={() => setReportMessageId(null)}
      />
      <DeleteMessageDialog
        message={deleteTarget}
        locale={locale}
        messages={messages}
        busy={busy}
        onConfirm={async () => {
          if (deleteTarget) {
            await remove(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function SocialMessageSearch({
  value,
  onChange,
  results,
  pending,
  locale,
  messages,
  onClose,
  onSelect,
}: {
  value: string;
  onChange: (value: string) => void;
  results: Array<DirectMessage | GroupMessage>;
  pending: boolean;
  locale: Locale;
  messages: Dictionary;
  onClose: () => void;
  onSelect: (messageId: string) => void;
}) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || panelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-social-message-search-trigger]'))
        return;
      onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  return (
    <aside className="social-message-search" ref={panelRef} aria-label={messages.searchMessages}>
      <div className="social-message-search-head">
        <Search size={17} />
        <input
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={messages.searchMessagesPlaceholder}
        />
        <button className="icon-button" onClick={onClose} aria-label={messages.close}>
          <X size={17} />
        </button>
      </div>
      <div className="social-message-search-results">
        {pending ? (
          <div className="social-loading">
            <LoaderCircle className="spin" /> {messages.loading}
          </div>
        ) : value.trim().length < 2 ? (
          <p>{messages.searchMessagesHint}</p>
        ) : results.length === 0 ? (
          <p>{messages.noSearchResults}</p>
        ) : (
          results.map((message) => (
            <button key={message.id} onClick={() => onSelect(message.id)}>
              <SocialAvatar user={{ ...message.author, status: 'OFFLINE' }} />
              <span>
                <strong>{message.author.displayName}</strong>
                <small>{message.content}</small>
                <time>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(message.createdAt))}
                </time>
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}

function SocialCallSystemMessage({
  message,
  locale,
  messages,
}: {
  message: DirectMessage | GroupMessage;
  locale: Locale;
  messages: Dictionary;
}) {
  const duration = formatSocialCallDuration(message.systemDurationSeconds ?? 0, locale);
  const text = (
    message.systemAction === 'CALL_ENDED' ? messages.callEndedMessage : messages.callStartedMessage
  )
    .replace('{name}', message.author.displayName)
    .replace('{duration}', duration);
  return (
    <div className="social-call-system-message">
      <Phone size={17} />
      <span>{text}</span>
    </div>
  );
}

function SystemDmCard({ content, createdAt }: { content: string; createdAt: string }) {
  const match = content.match(
    /^(?<accent>[🔴🟠🟢🔵])\s*\*\*(?<title>[^*]+)\*\*\s*\n\s*\n?(?<body>[\s\S]*)$/u,
  );
  const accent = match?.groups?.accent ?? '🔵';
  const title = match?.groups?.title?.trim() ?? 'Wapve sistem bildirimi';
  const body = match?.groups?.body?.trim() ?? content;
  const tone =
    accent === '🔴'
      ? 'critical'
      : accent === '🟠'
        ? 'warning'
        : accent === '🟢'
          ? 'success'
          : 'info';
  return (
    <article className={`system-dm-card ${tone}`}>
      <div className="system-dm-card-topline">
        <span className="system-dm-card-icon">
          {tone === 'critical' || tone === 'warning' ? (
            <ShieldCheck size={17} />
          ) : (
            <Sparkles size={17} />
          )}
        </span>
        <span>WAPVE SİSTEMİ</span>
        <time>
          {new Date(createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </time>
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      <div className="system-dm-card-footer">
        <span>Doğrulanmış platform bildirimi</span>
        <span className="system-dm-card-dot" />
      </div>
    </article>
  );
}

function formatSocialCallDuration(seconds: number, locale: Locale): string {
  if (seconds < 5) return locale === 'tr' ? 'birkaç saniye' : 'a few seconds';
  if (seconds < 60)
    return locale === 'tr' ? `${seconds} saniye` : `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return locale === 'tr' ? `${minutes} dakika` : `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function typingText(names: string[], messages: Dictionary): string {
  if (!names.length) return messages.someoneTyping;
  if (names.length === 1) return messages.personTyping.replace('{name}', names[0]!);
  if (names.length > 2) return messages.severalTyping.replace('{count}', String(names.length));
  return messages.peopleTyping.replace('{names}', names.join(', '));
}

function ConversationList({
  locale,
  conversations,
  pending,
  selectedConversationId,
  messages,
  onSelectConversation,
  onOpenProfile,
  onConversationMenu,
  onDismiss,
  pinned = false,
}: {
  conversations: DirectConversation[];
  locale: Locale;
  pending: boolean;
  selectedConversationId: string | null;
  messages: Dictionary;
  onSelectConversation: (conversationId: string) => void;
  onOpenProfile: OpenUserProfile;
  onConversationMenu?: OpenConversationMenu<DirectConversation>;
  onDismiss?: (conversation: DirectConversation) => void | Promise<void>;
  pinned?: boolean;
}) {
  return (
    <div className="dm-conversation-list">
      {conversations.map((conversation) => (
        <div className="dm-conversation-row-shell" key={conversation.id}>
          <button
            className={`${conversation.id === selectedConversationId ? 'active' : ''}${conversation.unreadCount ? ' unread' : ''}${premiumNameplateSurfaceClass(conversation.otherUser.premium?.nameplate)}`}
            onClick={() => onSelectConversation(conversation.id)}
            onContextMenu={(event) => {
              if (!onConversationMenu) return;
              event.preventDefault();
              event.stopPropagation();
              onConversationMenu(
                conversation,
                { left: event.clientX, top: event.clientY },
                profileAnchor(event.currentTarget),
              );
            }}
            onKeyDown={(event) => {
              if (
                !onConversationMenu ||
                (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10'))
              )
                return;
              event.preventDefault();
              const bounds = event.currentTarget.getBoundingClientRect();
              onConversationMenu(
                conversation,
                { left: bounds.left + 28, top: bounds.top + 28 },
                profileAnchor(event.currentTarget),
              );
            }}
          >
            <span
              className="conversation-profile-trigger"
              role="button"
              tabIndex={0}
              aria-label={conversation.otherUser.displayName}
              onClick={(event) => {
                event.stopPropagation();
                onOpenProfile(conversation.otherUser, event.currentTarget);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                event.stopPropagation();
                onOpenProfile(conversation.otherUser, event.currentTarget);
              }}
            >
              <SocialAvatar user={conversation.otherUser} />
            </span>
            <span>
              <strong>{conversation.otherUser.displayName}</strong>
              <small title={conversation.otherUser.customStatusText ?? undefined}>
                <GameStatus user={conversation.otherUser} locale={locale}>
                  {conversation.otherUser.status !== 'OFFLINE' &&
                  (conversation.otherUser.customStatusEmoji || conversation.otherUser.customStatusText) ? (
                    <span>
                      {conversation.otherUser.customStatusEmoji && (
                        <CustomStatusEmoji value={conversation.otherUser.customStatusEmoji} />
                      )}{' '}
                      {conversation.otherUser.customStatusText}
                    </span>
                  ) : (
                    '\u00a0'
                  )}
                </GameStatus>
              </small>
            </span>
            {pinned && <Pin className="conversation-pin-indicator" size={14} aria-hidden="true" />}
            {conversation.unreadCount > 0 && (
              <b
                className="conversation-unread-badge"
                aria-label={`${conversation.unreadCount} ${messages.unread}`}
              >
                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
              </b>
            )}
          </button>
          {onDismiss && (
            <button
              type="button"
              className="dm-conversation-dismiss"
              aria-label={messages.hideConversation}
              title={messages.hideConversation}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void onDismiss(conversation);
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
      {!pending && conversations.length === 0 && (
        <p className="social-empty-copy">{messages.noDirectMessages}</p>
      )}
    </div>
  );
}

function GroupConversationList({
  groups,
  selectedConversationId,
  messages,
  onSelectConversation,
  onManageGroup,
  onConversationMenu,
  onDismiss,
  pinned = false,
}: {
  groups: GroupConversation[];
  selectedConversationId: string | null;
  messages: Dictionary;
  onSelectConversation: (conversationId: string) => void;
  onManageGroup?: (conversationId: string) => void;
  onConversationMenu?: OpenConversationMenu<GroupConversation>;
  onDismiss?: (group: GroupConversation) => void | Promise<void>;
  pinned?: boolean;
}) {
  return (
    <div className="dm-conversation-list group-conversation-list">
      {groups.map((group) => {
        const selectionId = `group:${group.id}`;
        return (
          <div className="dm-conversation-row-shell" key={group.id}>
            <button
              className={`${selectionId === selectedConversationId ? 'active' : ''}${group.unreadCount ? ' unread' : ''}`}
              onClick={() => onSelectConversation(selectionId)}
              onContextMenu={(event) => {
                if (onConversationMenu) {
                  event.preventDefault();
                  event.stopPropagation();
                  onConversationMenu(
                    group,
                    { left: event.clientX, top: event.clientY },
                    profileAnchor(event.currentTarget),
                  );
                  return;
                }
                if (!onManageGroup) return;
                event.preventDefault();
                onManageGroup(group.id);
              }}
              onKeyDown={(event) => {
                if (
                  !onConversationMenu ||
                  (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10'))
                )
                  return;
                event.preventDefault();
                const bounds = event.currentTarget.getBoundingClientRect();
                onConversationMenu(
                  group,
                  { left: bounds.left + 28, top: bounds.top + 28 },
                  profileAnchor(event.currentTarget),
                );
              }}
            >
              <GroupAvatar group={group} />
              <span>
                <strong>{group.name}</strong>
                <small aria-hidden="true">{'\u00a0'}</small>
              </span>
              {pinned && (
                <Pin className="conversation-pin-indicator" size={14} aria-hidden="true" />
              )}
              {group.unreadCount > 0 && (
                <b
                  className="conversation-unread-badge"
                  aria-label={`${group.unreadCount} ${messages.unread}`}
                >
                  {group.unreadCount > 99 ? '99+' : group.unreadCount}
                </b>
              )}
            </button>
            {onDismiss && (
              <button
                type="button"
                className="dm-conversation-dismiss"
                aria-label={messages.leaveGroup}
                title={messages.leaveGroup}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void onDismiss(group);
                }}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        );
      })}
      {groups.length === 0 && <p className="social-empty-copy">{messages.noGroupMessages}</p>}
    </div>
  );
}

function GroupSettingsDialog({
  group,
  friends,
  currentUserId,
  messages,
  onClose,
  onGone,
}: {
  group: GroupConversation;
  friends: Friend[];
  currentUserId: string;
  messages: Dictionary;
  onClose: () => void;
  onGone: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(group.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const owner = group.ownerId === currentUserId;
  const addable = friends.filter(
    (friend) => !group.members.some((member) => member.id === friend.user.id),
  );

  async function mutate(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: object) {
    setBusy(true);
    setError('');
    try {
      await apiRequest(path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ['group-conversations'] });
      return true;
    } catch (caught) {
      setError(errorMessage(caught, messages));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(file: File) {
    const form = new FormData();
    form.set('file', file);
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/dm/groups/${group.id}/avatar`, { method: 'POST', body: form });
      await queryClient.invalidateQueries({ queryKey: ['group-conversations'] });
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function leaveOrDelete(kind: 'leave' | 'delete') {
    const succeeded = await mutate(
      kind === 'leave' ? `/dm/groups/${group.id}/leave` : `/dm/groups/${group.id}`,
      kind === 'leave' ? 'POST' : 'DELETE',
    );
    if (succeeded) onGone();
  }

  return (
    <div className="group-settings-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="group-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={messages.groupSettings}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <GroupAvatar group={group} size={48} />
            <span>
              <strong>{messages.groupSettings}</strong>
              <small>
                {messages.groupMemberLimit.replace('{count}', String(group.members.length))}
              </small>
            </span>
          </div>
          <button className="icon-button" onClick={onClose} aria-label={messages.close}>
            <X size={18} />
          </button>
        </header>
        {error && <div className="message-error">{error}</div>}
        {owner && (
          <div className="group-settings-identity">
            <label>
              <span>{messages.groupName}</span>
              <input
                value={name}
                maxLength={50}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <button
              className="wapve-button wapve-button--primary"
              disabled={busy || name.trim().length < 2 || name.trim() === group.name}
              onClick={() => void mutate(`/dm/groups/${group.id}`, 'PATCH', { name })}
            >
              {messages.save}
            </button>
            <label className="group-avatar-upload">
              {messages.changeGroupAvatar}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAvatar(file);
                  event.currentTarget.value = '';
                }}
              />
            </label>
            {group.avatarUrl && (
              <button
                className="wapve-button wapve-button--secondary"
                disabled={busy}
                onClick={() => void mutate(`/dm/groups/${group.id}/avatar`, 'DELETE')}
              >
                {messages.removeGroupAvatar}
              </button>
            )}
          </div>
        )}
        <div className="group-settings-members">
          <h3>{messages.members}</h3>
          {group.members.map((member) => (
            <div className="group-settings-member" key={member.id}>
              <SocialAvatar user={member} />
              <span>
                <strong>{member.displayName}</strong>
                <small>@{member.username}</small>
              </span>
              {member.id === group.ownerId ? (
                <b>{messages.groupOwner}</b>
              ) : owner ? (
                <div>
                  <button
                    disabled={busy}
                    title={messages.transferOwnership}
                    onClick={() =>
                      void mutate(`/dm/groups/${group.id}/owner`, 'PATCH', { userId: member.id })
                    }
                  >
                    {messages.transferOwnership}
                  </button>
                  <button
                    className="danger"
                    disabled={busy}
                    title={messages.removeFromGroup}
                    onClick={() =>
                      void mutate(`/dm/groups/${group.id}/members/${member.id}`, 'DELETE')
                    }
                  >
                    {messages.removeFromGroup}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {owner && addable.length > 0 && group.members.length < 10 && (
          <div className="group-settings-add">
            <h3>{messages.addGroupMembers}</h3>
            {addable.map((friend) => (
              <button
                key={friend.user.id}
                disabled={busy}
                onClick={() =>
                  void mutate(`/dm/groups/${group.id}/members`, 'POST', { userId: friend.user.id })
                }
              >
                <SocialAvatar user={friend.user} />
                <span>{friend.user.displayName}</span>
                <UserPlus size={15} />
              </button>
            ))}
          </div>
        )}
        <footer>
          {owner ? (
            <button className="danger" disabled={busy} onClick={() => void leaveOrDelete('delete')}>
              <Trash2 size={16} /> {messages.deleteGroup}
            </button>
          ) : (
            <button className="danger" disabled={busy} onClick={() => void leaveOrDelete('leave')}>
              <UserMinus size={16} /> {messages.leaveGroup}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

function SocialRow({
  user,
  children,
  onOpenProfile,
}: {
  user: SocialUser;
  children: ReactNode;
  onOpenProfile: OpenUserProfile;
}) {
  return (
    <div className="social-row">
      <button
        className="social-row-profile"
        onClick={(event) => onOpenProfile(user, event.currentTarget)}
      >
        <SocialAvatar user={user} />
        <span className="social-user-copy">
          <strong>{user.displayName}</strong>
          <span>@{user.username}</span>
        </span>
      </button>
      <div className="social-row-actions">{children}</div>
    </div>
  );
}

function SocialAvatar({ user }: { user: SocialUser }) {
  return (
    <div className="social-avatar">
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="" />
      ) : (
        user.displayName.slice(0, 1).toUpperCase()
      )}
      <i className={`status-dot ${user.status.toLowerCase()}`} />
    </div>
  );
}

function GroupAvatar({ group, size }: { group: GroupConversation; size?: number }) {
  return (
    <div
      className="social-avatar group-avatar"
      style={size ? { width: size, height: size } : undefined}
      aria-hidden="true"
    >
      {group.avatarUrl ? (
        <img src={group.avatarUrl} alt="" />
      ) : (
        <Users size={size ? Math.round(size * 0.4) : 17} />
      )}
    </div>
  );
}

function SocialListEmpty<T>({
  items,
  empty,
  children,
}: {
  items: T[];
  empty: string;
  children: (item: T) => ReactNode;
}) {
  if (!items.length) return <div className="social-empty-copy large">{empty}</div>;
  return <div className="social-list">{items.map(children)}</div>;
}
