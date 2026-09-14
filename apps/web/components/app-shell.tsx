'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { WapveLogo } from '@wapve/ui';
import type {
  ServerLayoutItem,
  AuthSession,
  AppNotification,
  ChannelUnreadSummary,
  ChannelCategory,
  ChannelTree,
  DirectConversation,
  Friend,
  FriendRequests,
  GroupConversation,
  Locale,
  PresenceUpdate,
  ServerMember,
  ServerRole,
  ServerChannel,
  ServerSummary,
  SwitcherAccounts,
  AcceptedServerInvite,
  UserProfile,
  VoiceChannelSummary,
  VoiceParticipant,
} from '@wapve/contracts';
import {
  Bug,
  Check,
  ChevronRight,
  ChevronUp,
  Compass,
  Crown,
  EyeOff,
  GripVertical,
  Hash,
  Headphones,
  Home,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  MicOff,
  MinusCircle,
  Moon,
  Pencil,
  Pin,
  Plus,
  Search,
  ShoppingBag,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  UserPlus,
  UserRoundPlus,
  Repeat2,
  Trash2,
  Users,
  Volume2,
  VolumeX,
  Waves,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type FormEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { io, type Socket } from 'socket.io-client';
import { ApiClientError, apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';
import { readLastTextChannel, rememberLastTextChannel } from '@/lib/last-text-channel';
import {
  dropFolderInLayout,
  dropServerInLayout,
  extractServerFromFolder,
  type ServerLayoutDropPlacement,
} from '@/lib/server-layout';
import {
  PANEL_LAYOUT_DEFAULTS,
  PANEL_LAYOUT_STORAGE_KEY,
  clampPanelWidth,
  parsePanelLayout,
  type PanelLayout,
  type PanelSide,
} from '@/lib/panel-layout';
import { AccountSettings, type AccountSettingsTab } from './account-settings';
import { AccountClaimDialog } from './account-claim-dialog';
import { AppConnectionGuard } from './app-connection-guard';
import {
  CategorySettingsDialog,
  ChannelManagerDialog,
  ChannelSettingsDialog,
} from './channel-manager-dialog';
import { ChannelMessages } from './channel-messages';
import { ChannelContextMenu } from './channel-context-menu';
import { ChannelTopicDialog } from './channel-topic-dialog';
import { ChannelInviteDialog } from './channel-invite-dialog';
import { InviteAcceptDialog } from './invite-accept-dialog';
import { NotificationCenter } from './notification-center';
import { DesktopDownloadPrompt } from './desktop-download-prompt';
import { PlatformOwnerIcon } from './platform-owner-icon';
import { ReportDialog } from './report-settings';
import { AlphaMemberIcon } from './alpha-member-icon';
import { MemberContextMenu } from './member-context-menu';
import { MarkdownRenderer } from './markdown-renderer';
import { MediaSetupHost } from './media-setup-dialog';
import { ServerHubDialog } from './server-hub-dialog';
import { ServerDiscoveryPanel } from './server-discovery-panel';
import { ServerContextMenu } from './server-context-menu';
import { ServerHeader } from './server-header';
import { ServerFolderContextMenu } from './server-folder-context-menu';
import { ServerSettingsDialog, type ServerSettingsSection } from './server-settings-dialog';
import { ServerTagChip } from './server-tag-chip';
import { holdSessionTransition, SessionTransition } from './session-transition';
import { usePersistentSocialCalls } from './persistent-social-call';
import { SocialActivityPanel, SocialHub, SocialSidebar } from './social-hub';
import { PremiumCenter } from './premium-center';
import { PremiumStore, type StoreCategory } from './premium-store';
import { ProfileStudio } from './profile-studio';
import { AnimatedEmojiUpgradeDialog } from './animated-emoji-upgrade-dialog';
import { BadgeCollectionDialog } from './badge-collection-dialog';
import { GameStatus } from './game-status';
import { connectDesktopActivity } from '@/lib/desktop-activity';
import { CustomStatusEmoji } from './custom-status-emoji';
import { ownedBadges } from './badge-registry';
import { ServerSupportGoal, ServerSupportOverviewPanel } from './server-support-panel';
import { WapvePlusBadge } from './wapve-plus-badge';
import { premiumNameplateSurfaceClass } from './premium-nameplate';
import {
  profileTarget,
  UserProfilePopover,
  type OpenUserProfile,
  type UserProfileTarget,
} from './user-profile-popover';
import {
  VoiceChannel,
  VoiceConnectionDock,
  type VoiceConnection,
  usePersistentVoiceConnection,
} from './voice-channel';
import { VoiceMemberContextMenu, type VoiceContextMenuPosition } from './voice-member-context-menu';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';
const voiceSummaryCache = new Map<string, VoiceChannelSummary[]>();

type UnreadSocialItem = {
  id: string;
  selectionId: string;
  title: string;
  avatarUrl: string | null;
  initials: string;
  count: number;
  sortAt: string;
  members: GroupConversation['members'];
};

type AnchorBox = { left: number; right: number; top: number; bottom: number; width: number };

const profileCacheRoots = [
  'server-members',
  'friends',
  'friend-requests',
  'dm-conversations',
  'group-conversations',
  'blocks',
] as const;

function isCacheRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function syncProfileInCache(value: unknown, profile: UserProfile): unknown {
  if (Array.isArray(value)) return value.map((item) => syncProfileInCache(item, profile));
  if (!isCacheRecord(value)) return value;
  const nested = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, syncProfileInCache(item, profile)]),
  );
  if (
    value.id !== profile.id ||
    (typeof value.username !== 'string' && typeof value.displayName !== 'string')
  ) {
    return nested;
  }
  return {
    ...nested,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    bannerUrl: profile.bannerUrl,
    status: profile.status,
    customStatusText: profile.customStatusText,
    customStatusEmoji: profile.customStatusEmoji,
    bio: profile.bio,
    badges: profile.badges,
    premium: profile.premium,
  };
}

export function AppShell({
  locale,
  messages,
  client = 'web',
  initialInviteCode,
  initialServerId,
  initialChannelId,
  initialConversationId,
  initialDiscoveryOpen = false,
  initialPremiumOpen = false,
  initialStoreOpen = false,
}: {
  locale: Locale;
  messages: Dictionary;
  client?: 'web' | 'desktop';
  initialInviteCode?: string | undefined;
  initialServerId?: string | undefined;
  initialChannelId?: string | undefined;
  initialConversationId?: string | undefined;
  initialDiscoveryOpen?: boolean;
  initialPremiumOpen?: boolean;
  initialStoreOpen?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sessionTransition, setSessionTransition] = useState<'logout' | null>(null);
  const logoutInProgressRef = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [confirmUnclaimedLogout, setConfirmUnclaimedLogout] = useState(false);
  const [profileStudioOpen, setProfileStudioOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<AccountSettingsTab>('profile');
  const [serverHubOpen, setServerHubOpen] = useState(false);
  const [premiumHomeOpen, setPremiumHomeOpen] = useState(initialPremiumOpen);
  const [storeHomeOpen, setStoreHomeOpen] = useState(initialStoreOpen);
  const [animatedEmojiUpgradeOpen, setAnimatedEmojiUpgradeOpen] = useState(false);
  const [storeCategory, setStoreCategory] = useState<StoreCategory>('featured');
  const [supportDialogServer, setSupportDialogServer] = useState<ServerSummary | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [serverSettingsOpen, setServerSettingsOpen] = useState(false);
  const [serverSettingsSection, setServerSettingsSection] =
    useState<ServerSettingsSection>('overview');
  const [channelManagerOpen, setChannelManagerOpen] = useState(false);
  const [channelManagerInitialTab, setChannelManagerInitialTab] = useState<'channel' | 'category'>(
    'channel',
  );
  const [channelSettingsId, setChannelSettingsId] = useState<string | null>(null);
  const [channelSettingsSnapshot, setChannelSettingsSnapshot] = useState<ServerChannel | null>(
    null,
  );
  const [inviteChannelId, setInviteChannelId] = useState<string | null>(null);
  const [inviteServer, setInviteServer] = useState<ServerSummary | null>(null);
  const [activeInviteCode, setActiveInviteCode] = useState<string | null>(
    initialInviteCode ?? null,
  );

  const [categorySettingsId, setCategorySettingsId] = useState<string | null>(null);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(initialServerId ?? null);
  const [discoveryOpen, setDiscoveryOpen] = useState(initialDiscoveryOpen);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    initialChannelId ?? null,
  );
  const [pendingVoiceChannelId, setPendingVoiceChannelId] = useState<string | null>(null);
  const [voiceChatChannelId, setVoiceChatChannelId] = useState<string | null>(null);
  const [skipVoiceSwitchConfirmation, setSkipVoiceSwitchConfirmation] = useState(false);
  const [developerMode, setDeveloperMode] = useState(false);
  const [dontAskVoiceSwitchAgain, setDontAskVoiceSwitchAgain] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    initialConversationId ?? null,
  );
  const [userProfileTarget, setUserProfileTarget] = useState<UserProfileTarget | null>(null);
  const [voiceContextMenuTarget, setVoiceContextMenuTarget] = useState<{
    participant: VoiceParticipant;
    channelId: string;
    position: VoiceContextMenuPosition;
  } | null>(null);
  const [disabledVideos, setDisabledVideos] = useState<Set<string>>(new Set());
  const [mutedSoundboards, setMutedSoundboards] = useState<Set<string>>(new Set());

  const toggleDisableVideo = useCallback((participantUserId: string) => {
    setDisabledVideos((prev) => {
      const next = new Set(prev);
      if (next.has(participantUserId)) next.delete(participantUserId);
      else next.add(participantUserId);
      return next;
    });
  }, []);

  const toggleMuteSoundboard = useCallback((participantUserId: string) => {
    setMutedSoundboards((prev) => {
      const next = new Set(prev);
      if (next.has(participantUserId)) next.delete(participantUserId);
      else next.add(participantUserId);
      return next;
    });
  }, []);
  const [localServerLayout, setLocalServerLayout] = useState<ServerLayoutItem[] | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [draggedServerId, setDraggedServerId] = useState<string | null>(null);
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    id: string;
    placement: ServerLayoutDropPlacement;
  } | null>(null);
  const serverLayoutMutationRef = useRef(0);
  const [notice, setNotice] = useState('');
  const [noticeLeaving, setNoticeLeaving] = useState(false);
  const noticeTimerRef = useRef<number | null>(null);

  const dismissNotice = useCallback(() => {
    setNoticeLeaving(true);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice('');
      setNoticeLeaving(false);
    }, 280);
  }, []);

  useEffect(() => {
    if (!notice) {
      setNoticeLeaving(false);
      return;
    }
    setNoticeLeaving(false);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => {
      dismissNotice();
    }, 4200);
    return () => {
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    };
  }, [notice, dismissNotice]);

  const [voiceResume, setVoiceResume] = useState<{
    serverId: string;
    channelId: string;
    at: number;
  } | null>(null);
  const [voiceSummaries, setVoiceSummaries] = useState<VoiceChannelSummary[]>(
    () => voiceSummaryCache.get(initialServerId ?? '') ?? [],
  );
  const [audioMenu, setAudioMenu] = useState<{
    kind: 'input' | 'output';
    anchor: AnchorBox;
  } | null>(null);
  const [userDockMenu, setUserDockMenu] = useState<AnchorBox | null>(null);
  const [channelTopicOpen, setChannelTopicOpen] = useState(false);
  const [channelMessageTool, setChannelMessageTool] = useState<'search' | 'pins' | null>(null);
  const [panelLayout, setPanelLayout] = useState<PanelLayout>({ ...PANEL_LAYOUT_DEFAULTS });
  const presenceSocketRef = useRef<Socket | null>(null);
  const presenceWatchKeyRef = useRef('');
  const serverRouteIdsRef = useRef(new Map<string, string>());
  const channelRouteIdsRef = useRef(new Map<string, string>());
  const voiceActivityAtRef = useRef(Date.now());
  const pendingVoiceChatRef = useRef<string | null>(null);
  const channelListRef = useRef<HTMLDivElement>(null);

  const navigateWorkspace = useCallback(
    (
      serverId: string | null,
      channelId: string | null = null,
      conversationId: string | null = null,
      replace = false,
    ) => {
      setSelectedServerId(serverId);
      setPremiumHomeOpen(false);
      setStoreHomeOpen(false);
      setSelectedChannelId(channelId);
      setSelectedConversationId(serverId ? null : conversationId);
      const routeServerId = serverId ? (serverRouteIdsRef.current.get(serverId) ?? serverId) : null;
      const routeChannelId = channelId
        ? (channelRouteIdsRef.current.get(channelId) ?? channelId)
        : null;
      const path = routeServerId
        ? `/channels/${encodeURIComponent(routeServerId)}${routeChannelId ? `/${encodeURIComponent(routeChannelId)}` : ''}`
        : `/waves${conversationId ? `/${encodeURIComponent(conversationId)}` : ''}`;
      if (replace) router.replace(path, { scroll: false });
      else router.push(path, { scroll: false });
    },
    [router],
  );

  const openPremiumHome = useCallback(() => {
    setSelectedServerId(null);
    setSelectedChannelId(null);
    setSelectedConversationId(null);
    setDiscoveryOpen(false);
    setStoreHomeOpen(false);
    setPremiumHomeOpen(true);
    router.push('/waves?view=wapve-plus', { scroll: false });
  }, [router]);

  const openStoreHome = useCallback(
    (category: StoreCategory = 'featured') => {
      setSelectedServerId(null);
      setSelectedChannelId(null);
      setSelectedConversationId(null);
      setDiscoveryOpen(false);
      setPremiumHomeOpen(false);
      setStoreCategory(category);
      setStoreHomeOpen(true);
      router.push('/waves?view=store', { scroll: false });
    },
    [router],
  );

  const selectConversation = useCallback(
    (conversationId: string | null) => {
      setDiscoveryOpen(false);
      navigateWorkspace(null, null, conversationId);
      // A conversation hidden with the DM-list X is still a live conversation.
      // Opening it again (from Friends, search, a profile or a notification)
      // should restore it to the visible DM list automatically.
      if (conversationId && !conversationId.startsWith('group:')) {
        void apiRequest(`/dm/conversations/${conversationId}/unhide`, { method: 'POST' })
          .then(() => queryClient.invalidateQueries({ queryKey: ['dm-conversations'] }))
          .catch(() => undefined);
      }
    },
    [navigateWorkspace, queryClient],
  );

  useEffect(() => {
    setSelectedServerId(initialServerId ?? null);
    setSelectedChannelId(initialChannelId ?? null);
    setSelectedConversationId(initialServerId ? null : (initialConversationId ?? null));
    setDiscoveryOpen(initialDiscoveryOpen);
    setPremiumHomeOpen(initialPremiumOpen);
    setStoreHomeOpen(initialStoreOpen);
  }, [
    initialChannelId,
    initialConversationId,
    initialDiscoveryOpen,
    initialPremiumOpen,
    initialStoreOpen,
    initialServerId,
  ]);

  useEffect(() => setChannelTopicOpen(false), [selectedChannelId]);
  useEffect(() => setChannelMessageTool(null), [selectedChannelId]);

  useEffect(() => {
    setPanelLayout(parsePanelLayout(window.localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY)));
    try {
      const stored = JSON.parse(
        window.sessionStorage.getItem('wapve:voice-resume') ?? 'null',
      ) as unknown;
      if (
        stored &&
        typeof stored === 'object' &&
        'serverId' in stored &&
        typeof stored.serverId === 'string' &&
        'channelId' in stored &&
        typeof stored.channelId === 'string' &&
        'at' in stored &&
        typeof stored.at === 'number' &&
        Date.now() - stored.at < 10 * 60_000
      )
        setVoiceResume(stored as { serverId: string; channelId: string; at: number });
      else window.sessionStorage.removeItem('wapve:voice-resume');
    } catch {
      window.sessionStorage.removeItem('wapve:voice-resume');
    }
  }, []);
  useEffect(() => {
    const openInvite = (event: Event) => {
      const detail = (event as CustomEvent<{ code?: string }>).detail;
      if (detail?.code) setActiveInviteCode(detail.code);
    };
    window.addEventListener('wapve:open-invite', openInvite);
    return () => window.removeEventListener('wapve:open-invite', openInvite);
  }, []);
  useEffect(() => {
    const handleOpenDm = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId?: string }>).detail;
      if (detail?.conversationId) {
        selectConversation(detail.conversationId);
      }
    };
    window.addEventListener('wapve:open-dm', handleOpenDm);
    return () => window.removeEventListener('wapve:open-dm', handleOpenDm);
  }, [selectConversation]);
  const openUserProfile: OpenUserProfile = useCallback(
    (profileUser, anchor, options) =>
      setUserProfileTarget(profileTarget(profileUser, anchor, options)),
    [],
  );
  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: () => apiRequest<AuthSession>('/auth/session'),
  });
  const serversQuery = useQuery({
    queryKey: ['servers'],
    queryFn: () => apiRequest<ServerSummary[]>('/servers'),
    enabled: Boolean(sessionQuery.data?.user),
  });
  const servers = serversQuery.data ?? [];
  serverRouteIdsRef.current = new Map(servers.map((server) => [server.id, server.publicId]));
  const selectedServer =
    servers.find(
      (server) => server.id === selectedServerId || server.publicId === selectedServerId,
    ) ?? null;
  const activeServerId = selectedServer?.id ?? null;
  const canManageChannels = Boolean(
    selectedServer?.role === 'OWNER' || selectedServer?.permissions.includes('MANAGE_CHANNELS'),
  );
  const canAccessServerSettings = Boolean(
    selectedServer?.role === 'OWNER' ||
      selectedServer?.permissions.some((perm) =>
        [
          'MANAGE_SERVER',
          'MANAGE_ROLES',
          'MANAGE_CHANNELS',
          'BAN_MEMBERS',
          'KICK_MEMBERS',
          'MANAGE_AUTOMOD',
          'VIEW_AUDIT_LOG',
          'MANAGE_EXPRESSIONS',
        ].includes(perm),
      ),
  );
  const channelScrollStorageKey = selectedServer
    ? `wapve:channel-list-scroll:${selectedServer.publicId}`
    : 'wapve:channel-list-scroll:home';

  const unreadQuery = useQuery({
    queryKey: ['channel-unread'],
    queryFn: () => apiRequest<ChannelUnreadSummary[]>('/messages/unread'),
    enabled: Boolean(sessionQuery.data?.user),
  });
  const directConversationsQuery = useQuery({
    queryKey: ['dm-conversations'],
    queryFn: () => apiRequest<DirectConversation[]>('/dm/conversations'),
    enabled: Boolean(sessionQuery.data?.user),
  });
  const groupConversationsQuery = useQuery({
    queryKey: ['group-conversations'],
    queryFn: () => apiRequest<GroupConversation[]>('/dm/groups'),
    enabled: Boolean(sessionQuery.data?.user),
  });
  const channelsQuery = useQuery({
    queryKey: ['server-channels', activeServerId],
    queryFn: () => apiRequest<ChannelTree>(`/servers/${activeServerId}/channels`),
    enabled: Boolean(activeServerId),
  });
  const rolesQuery = useQuery({
    queryKey: ['server-roles', activeServerId],
    queryFn: () => apiRequest<ServerRole[]>(`/servers/${activeServerId}/roles`),
    enabled: Boolean(activeServerId),
  });
  const friendsQuery = useQuery({
    queryKey: ['friends'],
    queryFn: () => apiRequest<Friend[]>('/social/friends'),
    enabled: Boolean(sessionQuery.data?.user),
    staleTime: 30_000,
  });
  const [userOverride, setUserOverride] = useState<UserProfile | null>(null);
  const applyCurrentUser = useCallback(
    (nextUser: UserProfile) => {
      setUserOverride(nextUser);
      queryClient.setQueryData<AuthSession>(['session'], (current) =>
        current ? { ...current, user: nextUser } : current,
      );
      for (const root of profileCacheRoots) {
        queryClient.setQueriesData({ queryKey: [root] }, (current) =>
          syncProfileInCache(current, nextUser),
        );
      }
      queryClient.setQueryData(['social-profile', nextUser.id], (current) =>
        syncProfileInCache(current, nextUser),
      );
      setUserProfileTarget((current) =>
        current?.user.id === nextUser.id
          ? {
              ...current,
              user: syncProfileInCache(current.user, nextUser) as typeof current.user,
            }
          : current,
      );
    },
    [queryClient],
  );
  const user = userOverride ?? sessionQuery.data?.user;
  const { connection: voiceConnection } = usePersistentVoiceConnection();
  useEffect(() => {
    if (voiceConnection.activeChannel || voiceConnection.joining || voiceConnection.joined)
      setVoiceResume(null);
  }, [voiceConnection.activeChannel, voiceConnection.joined, voiceConnection.joining]);
  const {
    updateHost: updateSocialCallHost,
    endCalls: endSocialCalls,
    leaveCall: leaveSocialCall,
  } = usePersistentSocialCalls();
  const channelTree = channelsQuery.data ?? { categories: [], channels: [] };
  useEffect(() => {
    const element = channelListRef.current;
    if (!element) return;
    const saved = Number(window.sessionStorage.getItem(channelScrollStorageKey) ?? '0');
    const frame = window.requestAnimationFrame(() => {
      element.scrollTop = Number.isFinite(saved) ? saved : 0;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [channelScrollStorageKey, channelsQuery.dataUpdatedAt]);
  const voiceServer =
    servers.find((server) => server.id === voiceConnection.activeChannel?.serverId) ?? null;
  const voiceAfkChannelsQuery = useQuery({
    queryKey: ['server-channels', voiceServer?.id],
    queryFn: () => apiRequest<ChannelTree>(`/servers/${voiceServer?.id}/channels`),
    enabled: Boolean(
      voiceConnection.joined && voiceServer?.id && voiceServer.id !== activeServerId,
    ),
  });
  const voiceAfkTree =
    voiceServer?.id === activeServerId
      ? channelTree
      : (voiceAfkChannelsQuery.data ?? { categories: [], channels: [] });
  channelRouteIdsRef.current = new Map(
    channelTree.channels.map((channel) => [channel.id, channel.publicId]),
  );
  const selectedChannel =
    channelTree.channels.find(
      (channel) => channel.id === selectedChannelId || channel.publicId === selectedChannelId,
    ) ?? null;
  const currentChannelId = selectedChannel?.id ?? null;
  const membersQuery = useQuery({
    queryKey: ['server-members', activeServerId, currentChannelId],
    queryFn: () =>
      apiRequest<ServerMember[]>(
        `/servers/${activeServerId}/members${currentChannelId ? `?channelId=${encodeURIComponent(currentChannelId)}` : ''}`,
      ),
    enabled: Boolean(activeServerId),
  });
  const voiceChatOpen =
    selectedChannel?.type === 'VOICE' && voiceChatChannelId === selectedChannel.id;

  useEffect(() => {
    const active = voiceConnection.activeChannel;
    const afkChannelId = voiceServer?.afkChannelId;
    if (
      !voiceConnection.joined ||
      !active ||
      active.serverId !== voiceServer?.id ||
      !afkChannelId ||
      active.id === afkChannelId
    ) {
      voiceActivityAtRef.current = Date.now();
      return;
    }
    const markActive = () => {
      voiceActivityAtRef.current = Date.now();
    };
    if (voiceConnection.speakingConnectionIds.includes(voiceConnection.selfConnectionId ?? ''))
      markActive();
    window.addEventListener('keydown', markActive);
    window.addEventListener('pointerdown', markActive);
    const timer = window.setInterval(() => {
      if (Date.now() - voiceActivityAtRef.current < voiceServer.afkTimeoutSeconds * 1_000) return;
      const target = voiceAfkTree.channels.find(
        (channel) => channel.id === afkChannelId && channel.type === 'VOICE',
      );
      if (!target?.permissions.CONNECT) return;
      voiceActivityAtRef.current = Date.now();
      void voiceConnection.connect(target);
      setNotice(messages.movedToAfk.replace('{channel}', target.name));
    }, 5_000);
    return () => {
      window.removeEventListener('keydown', markActive);
      window.removeEventListener('pointerdown', markActive);
      window.clearInterval(timer);
    };
  }, [
    messages.movedToAfk,
    voiceAfkTree.channels,
    voiceConnection.activeChannel,
    voiceConnection.joined,
    voiceConnection.selfConnectionId,
    voiceConnection.speakingConnectionIds,
    voiceServer,
  ]);

  useEffect(() => {
    if (selectedChannel?.type === 'VOICE' && window.location.hash.startsWith('#message-'))
      setVoiceChatChannelId(selectedChannel.id);
  }, [selectedChannel?.id, selectedChannel?.type]);

  useEffect(() => {
    // Router updates can briefly clear selectedChannel while switching from
    // another channel. Re-assert a chat request after the destination route
    // is mounted so the first click never gets lost in that transition.
    if (pendingVoiceChatRef.current && selectedChannel?.id === pendingVoiceChatRef.current) {
      setVoiceChatChannelId(pendingVoiceChatRef.current);
      pendingVoiceChatRef.current = null;
    }
  }, [selectedChannel?.id]);
  const liveSettingsChannel =
    channelTree.channels.find((channel) => channel.id === channelSettingsId) ?? null;
  const settingsChannel =
    liveSettingsChannel ??
    (channelSettingsSnapshot?.id === channelSettingsId ? channelSettingsSnapshot : null);
  const openChannelSettings = (channelId: string) => {
    setChannelSettingsSnapshot(
      channelTree.channels.find((channel) => channel.id === channelId) ?? null,
    );
    setChannelSettingsId(channelId);
  };
  const inviteChannel =
    channelTree.channels.find((channel) => channel.id === inviteChannelId) ?? null;
  const settingsCategory =
    channelTree.categories.find((category) => category.id === categorySettingsId) ?? null;
  const pendingVoiceChannel =
    channelTree.channels.find((channel) => channel.id === pendingVoiceChannelId) ?? null;
  const watchedUserIds = [
    ...new Set([
      ...(user ? [user.id] : []),
      ...(userProfileTarget ? [userProfileTarget.user.id] : []),
      ...(membersQuery.data ?? []).map((member) => member.id),
      ...(friendsQuery.data ?? []).map((friend) => friend.user.id),
    ]),
  ].sort();
  const presenceWatchKey = watchedUserIds.join(',');
  presenceWatchKeyRef.current = presenceWatchKey;

  useEffect(() => {
    if (sessionQuery.error instanceof ApiClientError && sessionQuery.error.status === 401) {
      voiceConnection.disconnect();
      endSocialCalls();
      router.replace(
        initialInviteCode ? `/login?invite=${encodeURIComponent(initialInviteCode)}` : '/login',
      );
    }
  }, [endSocialCalls, initialInviteCode, router, sessionQuery.error]);

  useEffect(() => {
    if (!user) return;
    updateSocialCallHost({
      currentUser: {
        userId: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      voicePreferences: {
        audioInputDeviceId: voiceConnection.audioInputDeviceId,
        audioOutputDeviceId: voiceConnection.audioOutputDeviceId,
        audioOutputVolume: voiceConnection.audioOutputVolume,
        pushToTalk: voiceConnection.pushToTalk,
        pushToTalkKey: voiceConnection.pushToTalkKey,
        echoCancellation: voiceConnection.echoCancellation,
        noiseSuppression: voiceConnection.noiseSuppression,
        autoGainControl: voiceConnection.autoGainControl,
      },
      selectedConversationId,
      channelPanelWidth: panelLayout.channel,
      onOpenConversation: (conversationId) => {
        void queryClient.invalidateQueries({
          queryKey: [
            conversationId.startsWith('group:') ? 'group-conversations' : 'dm-conversations',
          ],
        });
        selectConversation(conversationId);
      },
      prepareForCall: async () => {
        if (voiceConnection.activeChannel || voiceConnection.joined || voiceConnection.joining) {
          voiceConnection.disconnect();
          await Promise.resolve();
        }
      },
    });
  }, [
    navigateWorkspace,
    selectConversation,
    panelLayout.channel,
    selectedConversationId,
    updateSocialCallHost,
    user,
    voiceConnection.audioInputDeviceId,
    voiceConnection.audioOutputDeviceId,
    voiceConnection.audioOutputVolume,
    voiceConnection.activeChannel,
    voiceConnection.autoGainControl,
    voiceConnection.echoCancellation,
    voiceConnection.noiseSuppression,
    voiceConnection.pushToTalk,
    voiceConnection.pushToTalkKey,
    voiceConnection.joined,
    voiceConnection.joining,
  ]);

  useEffect(() => {
    setSkipVoiceSwitchConfirmation(
      window.localStorage.getItem('wapve:skip-voice-switch-confirmation') === 'true',
    );
    setDeveloperMode(window.localStorage.getItem('wapve:developer-mode') === 'true');
  }, []);

  useEffect(() => {
    if (
      selectedServerId &&
      !serversQuery.isPending &&
      !servers.some(
        (server) => server.id === selectedServerId || server.publicId === selectedServerId,
      )
    )
      navigateWorkspace(null, null, null, true);
  }, [navigateWorkspace, selectedServerId, servers, serversQuery.isPending]);

  useEffect(() => {
    if (!selectedServer || selectedServerId === selectedServer.id) return;
    setSelectedServerId(selectedServer.id);
  }, [selectedServer, selectedServerId]);

  useEffect(() => {
    if (!selectedServer) {
      if (selectedChannelId) setSelectedChannelId(null);
      return;
    }
    if (channelsQuery.isPending) return;
    if (
      !selectedChannelId ||
      !channelTree.channels.some(
        (channel) => channel.id === selectedChannelId || channel.publicId === selectedChannelId,
      )
    ) {
      const rememberedChannelId = readLastTextChannel(selectedServer.publicId);
      const fallbackChannel =
        channelTree.channels.find(
          (channel) =>
            channel.type !== 'VOICE' &&
            (channel.id === rememberedChannelId || channel.publicId === rememberedChannelId),
        ) ??
        channelTree.channels.find((channel) => channel.type !== 'VOICE') ??
        channelTree.channels[0];
      navigateWorkspace(selectedServer.id, fallbackChannel?.id ?? null, null, true);
    }
  }, [
    navigateWorkspace,
    selectedServer,
    selectedChannelId,
    channelTree.channels,
    channelsQuery.isPending,
  ]);

  useEffect(() => {
    if (!selectedChannel || selectedChannelId === selectedChannel.id) return;
    setSelectedChannelId(selectedChannel.id);
  }, [selectedChannel, selectedChannelId]);

  useEffect(() => {
    if (!selectedServer || !selectedChannel || selectedChannel.type === 'VOICE') return;
    rememberLastTextChannel(selectedServer.publicId, selectedChannel.publicId);
  }, [selectedChannel, selectedServer]);

  useEffect(() => {
    const openTaggedServer = (event: Event) => {
      const detail = (event as CustomEvent<{ server?: ServerSummary; serverId?: string }>).detail;
      const server = detail.server ?? servers.find((item) => item.id === detail.serverId);
      if (!server) return;
      if (detail.server) {
        queryClient.setQueryData<ServerSummary[]>(['servers'], (current = []) => {
          const index = current.findIndex((item) => item.id === server.id);
          if (index < 0) return [...current, server];
          return current.map((item) => (item.id === server.id ? server : item));
        });
      }
      setSupportDialogServer(null);
      setDiscoveryOpen(false);
      navigateWorkspace(server.id, null);
    };
    window.addEventListener('wapve:open-server', openTaggedServer);
    return () => window.removeEventListener('wapve:open-server', openTaggedServer);
  }, [navigateWorkspace, queryClient, servers]);

  useEffect(() => {
    if (!user) return;
    const socket = io(`${SOCKET_URL}/servers`, {
      withCredentials: true,
    });
    socket.on('server:changed', ({ serverId }: { serverId: string }) => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['servers'] }),
        queryClient.invalidateQueries({ queryKey: ['server-members', serverId] }),
        queryClient.invalidateQueries({ queryKey: ['server-roles', serverId] }),
        queryClient.invalidateQueries({ queryKey: ['server-channels', serverId] }),
        queryClient.invalidateQueries({ queryKey: ['server-audit', serverId] }),
        queryClient.invalidateQueries({ queryKey: ['automod', serverId] }),
        queryClient.invalidateQueries({ queryKey: ['channel-messages'] }),
        queryClient.invalidateQueries({ queryKey: ['social-profile'] }),
      ]);
    });
    return () => {
      socket.disconnect();
    };
  }, [queryClient, user?.id]);

  useEffect(() => {
    if (!user) return;
    const socket = io(`${SOCKET_URL}/unread`, {
      withCredentials: true,
    });
    socket.on(
      'unread:changed',
      () => void queryClient.invalidateQueries({ queryKey: ['channel-unread'] }),
    );
    return () => {
      socket.disconnect();
    };
  }, [queryClient, user?.id]);

  useEffect(() => {
    if (!user) return;
    const socket = io(`${SOCKET_URL}/dm`, {
      withCredentials: true,
    });
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['group-conversations'] });
    };
    socket.on('dm:created', refresh);
    socket.on('group:created', refresh);
    socket.on('social:changed', refresh);
    return () => {
      socket.disconnect();
    };
  }, [queryClient, user?.id]);

  useEffect(() => {
    if (!user) return;
    const socket = io(`${SOCKET_URL}/presence`, {
      withCredentials: true,
    });
    presenceSocketRef.current = socket;
    const stopActivity = connectDesktopActivity(socket);
    const applyPresence = ({
      userId,
      status,
      customStatusText,
      customStatusEmoji,
      gameActivity,
    }: PresenceUpdate) => {
      queryClient.setQueryData<PresenceUpdate>(['live-presence', userId], (prev) => ({
        userId,
        status,
        gameActivity,
        customStatusText: customStatusText !== undefined ? customStatusText : prev?.customStatusText,
        customStatusEmoji: customStatusEmoji !== undefined ? customStatusEmoji : prev?.customStatusEmoji,
      }));
      queryClient.setQueriesData<ServerMember[]>({ queryKey: ['server-members'] }, (current) =>
        current?.map((member) =>
          member.id === userId
            ? {
                ...member,
                status,
                ...(customStatusText !== undefined ? { customStatusText } : {}),
                ...(customStatusEmoji !== undefined ? { customStatusEmoji } : {}),
              }
            : member,
        ),
      );
      queryClient.setQueryData<Friend[]>(['friends'], (current) =>
        current?.map((friend) =>
          friend.user.id === userId ? { ...friend, user: { ...friend.user, status } } : friend,
        ),
      );
      queryClient.setQueryData<DirectConversation[]>(['dm-conversations'], (current) =>
        current?.map((conversation) =>
          conversation.otherUser.id === userId
            ? { ...conversation, otherUser: { ...conversation.otherUser, status } }
            : conversation,
        ),
      );
      queryClient.setQueryData<FriendRequests>(['friend-requests'], (current) =>
        current
          ? {
              incoming: current.incoming.map((request) =>
                request.user.id === userId
                  ? { ...request, user: { ...request.user, status } }
                  : request,
              ),
              outgoing: current.outgoing.map((request) =>
                request.user.id === userId
                  ? { ...request, user: { ...request.user, status } }
                  : request,
              ),
            }
          : current,
      );
    };
    socket.on('presence:changed', applyPresence);
    socket.on('presence:snapshot', (updates: PresenceUpdate[]) => updates.forEach(applyPresence));
    socket.on('profile:changed', ({ userId }: { userId: string }) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: ['server-members'] }),
        queryClient.invalidateQueries({ queryKey: ['friends'] }),
        queryClient.invalidateQueries({ queryKey: ['dm-conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['group-conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['friend-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['social-profile', userId] }),
        queryClient.invalidateQueries({ queryKey: ['dm-messages'] }),
        queryClient.invalidateQueries({ queryKey: ['group-messages'] }),
        queryClient.invalidateQueries({ queryKey: ['messages'] }),
      ];
      if (userId === user.id) {
        invalidations.push(queryClient.invalidateQueries({ queryKey: ['privacy-settings', userId] }));
        void apiRequest<UserProfile>('/users/me').then((nextUser) => {
          applyCurrentUser(nextUser);
          return Promise.all(invalidations);
        });
      } else {
        void Promise.all(invalidations);
      }
    });
    socket.on('presence:ready', () => {
      const current = presenceWatchKeyRef.current;
      socket.emit('presence:watch', { userIds: current ? current.split(',') : [] });
    });
    const heartbeat = window.setInterval(() => socket.emit('presence:heartbeat'), 30_000);
    return () => {
      stopActivity();
      window.clearInterval(heartbeat);
      presenceSocketRef.current = null;
      socket.disconnect();
    };
  }, [applyCurrentUser, queryClient, user?.id]);

  useEffect(() => {
    presenceSocketRef.current?.emit('presence:watch', {
      userIds: presenceWatchKey ? presenceWatchKey.split(',') : [],
    });
  }, [presenceWatchKey]);

  useEffect(() => {
    const serverId = selectedServer?.id;
    if (!user || !serverId) return;
    const cached =
      voiceSummaryCache.get(serverId) ?? voiceSummaryCache.get(selectedServer.publicId);
    if (cached) setVoiceSummaries(cached);
    const socket = io(`${SOCKET_URL}/voice`, {
      withCredentials: true,
    });
    socket.on('voice:ready', () => socket.emit('voice:watch', { serverId }));
    socket.on('voice:summary', (summaries: VoiceChannelSummary[]) => {
      voiceSummaryCache.set(serverId, summaries);
      voiceSummaryCache.set(selectedServer.publicId, summaries);
      setVoiceSummaries(summaries);
    });
    return () => {
      socket.disconnect();
    };
  }, [selectedServer?.id, user?.id]);

  async function logout(force = false) {
    if (!force && user && !user.hasCredentials) {
      setConfirmUnclaimedLogout(true);
      return;
    }
    if (logoutInProgressRef.current) return;
    logoutInProgressRef.current = true;
    setSessionTransition('logout');
    voiceConnection.disconnect();
    endSocialCalls();
    try {
      await Promise.all([
        apiRequest('/auth/logout', { method: 'POST', body: '{}' }),
        holdSessionTransition(),
      ]);
      router.replace('/login');
    } catch (caught) {
      logoutInProgressRef.current = false;
      setSessionTransition(null);
      setNotice(errorMessage(caught, messages));
    }
  }

  function upsertServer(server: ServerSummary, nextNotice = '') {
    serverRouteIdsRef.current.set(server.id, server.publicId);
    queryClient.setQueryData<ServerSummary[]>(['servers'], (current = []) => {
      const exists = current.some((item) => item.id === server.id);
      return exists
        ? current.map((item) => (item.id === server.id ? server : item))
        : [...current, server];
    });
    navigateWorkspace(server.id);
    setNotice(nextNotice);
    void queryClient.invalidateQueries({ queryKey: ['server-members', server.id] });
  }

  function connectServerVoice(channel: ServerChannel) {
    leaveSocialCall();
    void voiceConnection.connect(channel);
  }

  async function diveVoiceRoom(serverId: string, channelId: string) {
    try {
      const tree = await apiRequest<ChannelTree>(`/servers/${serverId}/channels`);
      queryClient.setQueryData(['server-channels', serverId], tree);
      for (const channel of tree.channels)
        channelRouteIdsRef.current.set(channel.id, channel.publicId);
      const target = tree.channels.find(
        (channel) => channel.id === channelId && channel.type === 'VOICE',
      );
      if (target) {
        navigateWorkspace(serverId, target.id, null, true);
        connectServerVoice(target);
      }
    } catch {
      // not accessible
    }
  }

  async function acceptChannelInvite(result: AcceptedServerInvite) {
    upsertServer(result.server, messages.serverJoined);
    if (result.channel) {
      const tree = await apiRequest<ChannelTree>(`/servers/${result.server.id}/channels`);
      queryClient.setQueryData(['server-channels', result.server.id], tree);
      for (const channel of tree.channels)
        channelRouteIdsRef.current.set(channel.id, channel.publicId);
      const target = tree.channels.find((channel) => channel.id === result.channel?.id);
      if (target) {
        navigateWorkspace(result.server.id, target.id, null, true);
        if (target.type === 'VOICE') connectServerVoice(target);
      }
    }
    setActiveInviteCode(null);
  }

  function removeServer(serverId: string) {
    if (voiceConnection.activeChannel?.serverId === serverId) voiceConnection.disconnect();
    queryClient.setQueryData<ServerSummary[]>(['servers'], (current = []) =>
      current.filter((server) => server.id !== serverId),
    );
    navigateWorkspace(null);
    setNotice('');
  }

  function selectServer(serverId: string | null) {
    setSupportDialogServer(null);
    setDiscoveryOpen(false);
    const server = servers.find((item) => item.id === serverId || item.publicId === serverId);
    const lastTextChannelId = server ? readLastTextChannel(server.publicId) : null;
    navigateWorkspace(server?.id ?? serverId, lastTextChannelId);
    setVoiceChatChannelId(null);
    setNotice('');
  }

  function openDiscovery() {
    setSupportDialogServer(null);
    setDiscoveryOpen(true);
    setPremiumHomeOpen(false);
    setStoreHomeOpen(false);
    setSelectedServerId(null);
    setSelectedChannelId(null);
    setSelectedConversationId(null);
    setVoiceChatChannelId(null);
    pendingVoiceChatRef.current = null;
    router.push('/app?discover=1', { scroll: false });
    setMobileNavOpen(false);
    setNotice('');
  }

  function openServerSettings(section: ServerSettingsSection = 'overview') {
    if (!canAccessServerSettings) return;
    setServerSettingsSection(section);
    setServerSettingsOpen(true);
  }

  function openServerSettingsFromRail(server: ServerSummary, section: ServerSettingsSection) {
    const canAccess = Boolean(
      server.role === 'OWNER' ||
        server.permissions.some((perm) =>
          [
            'MANAGE_SERVER',
            'MANAGE_ROLES',
            'MANAGE_CHANNELS',
            'BAN_MEMBERS',
            'KICK_MEMBERS',
            'MANAGE_AUTOMOD',
            'VIEW_AUDIT_LOG',
            'MANAGE_EXPRESSIONS',
          ].includes(perm),
        ),
    );
    if (!canAccess) return;
    navigateWorkspace(server.id);
    setServerSettingsSection(section);
    setServerSettingsOpen(true);
  }

  function openCreateChannel() {
    setChannelManagerInitialTab('channel');
    setChannelManagerOpen(true);
  }

  function openCreateCategory() {
    setChannelManagerInitialTab('category');
    setChannelManagerOpen(true);
  }

  async function leaveServerFromRail(server: ServerSummary) {
    try {
      await apiRequest(`/servers/${server.id}/actions/leave`, { method: 'POST', body: '{}' });
      removeServer(server.id);
      setNotice(messages.serverLeft);
    } catch (caught) {
      setNotice(errorMessage(caught, messages));
      throw caught;
    }
  }

  function updateDeveloperMode(enabled: boolean) {
    window.localStorage.setItem('wapve:developer-mode', String(enabled));
    setDeveloperMode(enabled);
  }

  function navigateNotification(notification: AppNotification) {
    if (notification.conversationId) {
      navigateWorkspace(null, null, notification.conversationId);
      return;
    }
    if (notification.server) {
      navigateWorkspace(notification.server.id, notification.channel?.id ?? null);
      return;
    }
    navigateWorkspace(null);
  }

  const refreshNotificationRelatedData = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['servers'] });
    if (selectedServer?.id)
      void queryClient.invalidateQueries({ queryKey: ['server-members', selectedServer.id] });
  }, [queryClient, selectedServer?.id]);

  async function refreshChannels(nextNotice = ''): Promise<ChannelTree> {
    const result = await channelsQuery.refetch();
    if (nextNotice) setNotice(nextNotice);
    return result.data ?? { categories: [], channels: [] };
  }

  async function refreshServerPeople(): Promise<void> {
    await Promise.all([
      membersQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ['server-roles', selectedServer?.id] }),
      queryClient.invalidateQueries({ queryKey: ['servers'] }),
    ]);
  }

  function joinVoiceChannel(channelId: string) {
    const channel = channelTree.channels.find((item) => item.id === channelId);
    if (!channel || channel.type !== 'VOICE') return;
    navigateWorkspace(selectedServer?.id ?? null, channelId);
    connectServerVoice(channel);
  }

  function selectChannel(channelId: string) {
    const channel = channelTree.channels.find((item) => item.id === channelId);
    if (!channel) return;
    setSupportDialogServer(null);
    if (voiceChatChannelId !== channel.id) setVoiceChatChannelId(null);
    if (channel.type !== 'VOICE') {
      navigateWorkspace(selectedServer?.id ?? null, channelId);
      return;
    }
    if (
      voiceConnection.activeChannel &&
      voiceConnection.activeChannel.id !== channelId &&
      !skipVoiceSwitchConfirmation
    ) {
      setDontAskVoiceSwitchAgain(false);
      setPendingVoiceChannelId(channelId);
      return;
    }
    if (
      !voiceConnection.activeChannel &&
      window.localStorage.getItem('wapve:voice-calibration-dismissed') !== 'true'
    ) {
      navigateWorkspace(selectedServer?.id ?? null, channelId);
      return;
    }
    joinVoiceChannel(channelId);
  }

  function toggleVoiceChannelChat(channelId: string) {
    const channel = channelTree.channels.find(
      (item) => item.id === channelId && item.type === 'VOICE',
    );
    if (!channel || !selectedServer) return;
    // Opening the text pane must not re-run the voice-channel navigation
    // (which briefly remounts VoiceChannel and can replace the pane with the
    // join/calibration view). Navigate only when the user is on another
    // channel; on the active voice route the state change is sufficient.
    const opening = voiceChatChannelId !== channel.id;
    if (opening) pendingVoiceChatRef.current = channel.id;
    else if (pendingVoiceChatRef.current === channel.id) pendingVoiceChatRef.current = null;
    if (selectedChannel?.id !== channel.id) navigateWorkspace(selectedServer.id, channel.id);
    setVoiceChatChannelId(opening ? channel.id : null);
  }

  function confirmVoiceSwitch() {
    if (!pendingVoiceChannelId) return;
    if (dontAskVoiceSwitchAgain) {
      window.localStorage.setItem('wapve:skip-voice-switch-confirmation', 'true');
      setSkipVoiceSwitchConfirmation(true);
    }
    const channelId = pendingVoiceChannelId;
    setPendingVoiceChannelId(null);
    joinVoiceChannel(channelId);
  }

  function openActiveVoiceChannel() {
    const channel = voiceConnection.activeChannel;
    if (!channel) return;
    navigateWorkspace(channel.serverId, channel.id);
  }

  const activeServerLayout = useMemo(() => {
    if (!user)
      return servers.map((s) => ({ type: 'server' as const, id: s.id })) as ServerLayoutItem[];
    const layout = localServerLayout ?? user.serverLayout ?? [];
    const layoutServers = new Set<string>();

    const validLayout = layout.map((item) => {
      if (item.type === 'server') {
        layoutServers.add(item.id);
        return item;
      }
      if (item.type === 'folder') {
        const validIds = (item.serverIds || []).filter((id: string) =>
          servers.some((s) => s.id === id),
        );
        validIds.forEach((id) => layoutServers.add(id));
        return { ...item, serverIds: validIds };
      }
      return item;
    });

    const missingServers = servers
      .filter((s) => !layoutServers.has(s.id))
      .map((s) => ({ type: 'server' as const, id: s.id }));
    return [...validLayout, ...missingServers] as ServerLayoutItem[];
  }, [user, servers, localServerLayout]);

  if (sessionQuery.isError)
    return (
      <main className={`center-page${client === 'desktop' ? ' desktop-client-state' : ''}`}>
        {client === 'desktop' && <img src="/brand/wapve-wave-mark-v2.png" alt="" />}
        <WapveLogo />
        <p>
          {client === 'desktop' ? messages.desktopConnectionProblemBody : messages.genericError}
        </p>
      </main>
    );
  if (sessionQuery.isPending || !user)
    return (
      <main className={`center-page${client === 'desktop' ? ' desktop-client-state' : ''}`}>
        {client === 'desktop' && <img src="/brand/wapve-wave-mark-v2.png" alt="" />}
        <WapveLogo />
        <p>{client === 'desktop' ? messages.desktopPreparing : messages.loading}</p>
      </main>
    );

  const initial = user.displayName.slice(0, 1).toUpperCase();
  const statusClass = user.status.toLowerCase();
  const members = membersQuery.data ?? [];

  const updateServerLayout = async (newLayout: ServerLayoutItem[]) => {
    const mutation = ++serverLayoutMutationRef.current;
    const previousLayout = activeServerLayout;
    setLocalServerLayout(newLayout);
    applyCurrentUser({ ...user, serverLayout: newLayout });
    try {
      const updated = await apiRequest<UserProfile>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ serverLayout: newLayout }),
      });
      if (mutation !== serverLayoutMutationRef.current) return;
      applyCurrentUser(updated);
      setLocalServerLayout(null);
    } catch {
      if (mutation !== serverLayoutMutationRef.current) return;
      applyCurrentUser({ ...user, serverLayout: previousLayout });
      setLocalServerLayout(previousLayout);
      setNotice(messages.serverLayoutSaveFailed);
    }
  };

  const updatePinnedSocialConversations = async (pins: string[]) => {
    const previous = user;
    applyCurrentUser({ ...user, pinnedSocialConversations: pins });
    try {
      applyCurrentUser(
        await apiRequest<UserProfile>('/users/me', {
          method: 'PATCH',
          body: JSON.stringify({ pinnedSocialConversations: pins }),
        }),
      );
    } catch {
      applyCurrentUser(previous);
      setNotice(messages.conversationPinFailed);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string, type: 'server' | 'folder') => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-wapve-server-layout', JSON.stringify({ type, id }));
    e.dataTransfer.setData('text/plain', `${type}:${id}`);
    if (type === 'server') {
      setDraggedServerId(id);
      setDraggedFolderId(null);
    } else {
      setDraggedFolderId(id);
      setDraggedServerId(null);
    }
  };

  const dropPlacement = (e: React.DragEvent): ServerLayoutDropPlacement => {
    const bounds = e.currentTarget.getBoundingClientRect();
    const ratio = bounds.height > 0 ? (e.clientY - bounds.top) / bounds.height : 0.5;
    return ratio < 0.3 ? 'before' : ratio > 0.7 ? 'after' : 'inside';
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget({ id: targetId, placement: dropPlacement(e) });
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const placement = dropPlacement(e);
    type DragPayload = { type: 'server' | 'folder'; id: string };
    let payload: DragPayload | null = null;
    try {
      const parsed = JSON.parse(
        e.dataTransfer.getData('application/x-wapve-server-layout'),
      ) as DragPayload | null;
      if (parsed && ['server', 'folder'].includes(parsed.type) && typeof parsed.id === 'string')
        payload = parsed;
    } catch {
      const fallback = e.dataTransfer.getData('text/plain').match(/^(server|folder):(.+)$/u);
      if (fallback) payload = { type: fallback[1] as 'server' | 'folder', id: fallback[2]! };
    }
    setDragOverTarget(null);
    const type = payload?.type ?? (draggedServerId ? 'server' : draggedFolderId ? 'folder' : null);
    const id = payload?.id ?? draggedServerId ?? draggedFolderId;
    if (!type || !id || id === targetId) return;

    const newLayout =
      type === 'server'
        ? dropServerInLayout(activeServerLayout, id, targetId, placement)
        : dropFolderInLayout(
            activeServerLayout,
            id,
            targetId,
            placement === 'after' ? 'after' : 'before',
          );
    void updateServerLayout(newLayout);
    setDraggedServerId(null);
    setDraggedFolderId(null);
  };

  const handleDropOutsideFolder = (event: React.DragEvent) => {
    event.preventDefault();
    if (!draggedServerId) return;
    void updateServerLayout(extractServerFromFolder(activeServerLayout, draggedServerId));
    setDraggedServerId(null);
    setDragOverTarget(null);
  };

  const updateFolder = (folderId: string, patch: Pick<ServerLayoutItem, 'name' | 'color'>) => {
    void updateServerLayout(
      activeServerLayout.map((item) => (item.id === folderId ? { ...item, ...patch } : item)),
    );
  };

  const markFolderRead = async (serverIds: string[]) => {
    await Promise.all(
      serverIds.map((serverId) =>
        apiRequest(`/messages/unread/servers/${serverId}/read`, {
          method: 'POST',
          body: '{}',
        }),
      ),
    );
    await queryClient.invalidateQueries({ queryKey: ['channel-unread'] });
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const savePanelLayout = (layout: PanelLayout) => {
    setPanelLayout(layout);
    window.localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  };

  const resizePanelBy = (side: PanelSide, delta: number) => {
    savePanelLayout({
      ...panelLayout,
      [side]: clampPanelWidth(side, panelLayout[side] + delta),
    });
  };

  const resetPanel = (side: PanelSide) => {
    savePanelLayout({ ...panelLayout, [side]: PANEL_LAYOUT_DEFAULTS[side] });
  };

  const startPanelResize = (side: PanelSide, event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panelLayout[side];
    let latestWidth = startWidth;
    document.body.classList.add('panel-resizing');

    const move = (pointerEvent: PointerEvent) => {
      const movement = pointerEvent.clientX - startX;
      latestWidth = clampPanelWidth(side, startWidth + (side === 'channel' ? movement : -movement));
      setPanelLayout((current) => ({ ...current, [side]: latestWidth }));
    };
    const stop = () => {
      document.body.classList.remove('panel-resizing');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      setPanelLayout((current) => {
        const next = { ...current, [side]: latestWidth };
        window.localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
  };

  const renderServerItem = (server: ServerSummary) => {
    const summaries = (unreadQuery.data ?? []).filter((s) => s.serverId === server.id);
    const unreadCount = summaries.reduce((total, s) => total + s.unreadCount, 0);
    const mentionCount = summaries.reduce((total, s) => total + s.mentionCount, 0);

    return (
      <ServerContextMenu
        key={server.id}
        server={server}
        locale={locale}
        messages={messages}
        onInvite={() => setInviteServer(server)}
        onSettings={() => openServerSettingsFromRail(server, 'overview')}
        onSupport={() => {
          selectServer(server.id);
          setSupportDialogServer(server);
        }}
        canSupport={Boolean(user.premium?.active)}
        onLeave={() => leaveServerFromRail(server)}
        onMarkRead={async () => {
          await apiRequest(`/messages/unread/servers/${server.id}/read`, {
            method: 'POST',
            body: '{}',
          });
          await queryClient.invalidateQueries({ queryKey: ['channel-unread'] });
        }}
        onNotice={setNotice}
      >
        <button
          draggable
          onDragStart={(e) => handleDragStart(e, server.id, 'server')}
          onDragEnd={() => {
            setDraggedServerId(null);
            setDragOverTarget(null);
          }}
          onDragOver={(e) => handleDragOver(e, server.id)}
          onDrop={(e) => handleDrop(e, server.id)}
          className={`rail-item server-rail-item${selectedServer?.id === server.id ? ' active' : ''}${dragOverTarget?.id === server.id ? ` drag-over drag-over-${dragOverTarget.placement}` : ''}`}
          aria-label={server.name}
          title={server.name}
          onClick={() => selectServer(server.id)}
        >
          {server.iconUrl ? (
            <img src={server.iconUrl} alt="" />
          ) : (
            <span>{server.name.slice(0, 2).toUpperCase()}</span>
          )}
          {unreadCount > 0 && (
            <i
              className={`server-unread-badge${mentionCount > 0 ? ' mention' : ''}`}
              aria-hidden="true"
            >
              {mentionCount > 0 ? (mentionCount > 99 ? '99+' : mentionCount) : ''}
            </i>
          )}
        </button>
      </ServerContextMenu>
    );
  };

  const unreadSocialItems: UnreadSocialItem[] = [
    ...(directConversationsQuery.data ?? [])
      .filter((conversation) => conversation.unreadCount > 0 && !conversation.hidden)
      .map((conversation) => ({
        id: conversation.id,
        selectionId: conversation.id,
        title: conversation.otherUser.displayName,
        avatarUrl: conversation.otherUser.avatarUrl,
        initials: conversation.otherUser.displayName.slice(0, 1).toUpperCase(),
        count: conversation.unreadCount,
        sortAt: conversation.lastMessageAt ?? '',
        members: [] as GroupConversation['members'],
      })),
    ...(groupConversationsQuery.data ?? [])
      .filter((conversation) => conversation.unreadCount > 0)
      .map((conversation) => ({
        id: conversation.id,
        selectionId: `group:${conversation.id}`,
        title: conversation.name,
        avatarUrl: conversation.avatarUrl,
        initials: conversation.name.slice(0, 1).toUpperCase(),
        count: conversation.unreadCount,
        sortAt: conversation.lastMessageAt ?? '',
        members: conversation.members.filter((member) => member.id !== user.id),
      })),
  ]
    .sort((left, right) => right.sortAt.localeCompare(left.sortAt))
    .slice(0, 4);
  const currentMember = members.find((member) => member.id === user.id);
  return (
    <>
      <main
        className={`app-frame${client === 'desktop' ? ' desktop-client' : ''}${voiceConnection.activeChannel ? ' voice-connected' : ''}${
          voiceChatOpen ? ' voice-chat-open' : ''
        }${discoveryOpen ? ' discovery-open' : ''}${premiumHomeOpen || storeHomeOpen ? ' premium-home-open' : ''}${supportDialogServer ? ' support-workspace-open' : ''}`}
        onContextMenu={(event) => {
          if (!event.defaultPrevented) event.preventDefault();
        }}
        style={
          {
            '--channel-panel-width': `${panelLayout.channel}px`,
            '--member-panel-width': `${panelLayout.member}px`,
            '--voice-chat-panel-width': `${panelLayout.voiceChat}px`,
          } as CSSProperties
        }
      >
        {client === 'web' && <AppConnectionGuard messages={messages} />}
        {sessionTransition && <SessionTransition mode={sessionTransition} messages={messages} />}
        <nav className="server-rail" aria-label={messages.servers}>
          <div className="rail-logo">
            <WapveLogo compact />
          </div>
          {unreadSocialItems.length > 0 && (
            <div className="social-unread-rail" aria-label={messages.unreadConversations}>
              {unreadSocialItems.map((item, index) => (
                <button
                  key={item.id}
                  className="rail-item social-unread-rail-item"
                  style={{ '--unread-item-index': index } as CSSProperties}
                  aria-label={`${item.title}, ${item.count} ${messages.unread}`}
                  title={item.title}
                  onClick={() => navigateWorkspace(null, null, item.selectionId)}
                >
                  <SocialUnreadAvatar item={item} />
                  <i className="server-unread-badge mention" aria-hidden="true">
                    {item.count > 99 ? '99+' : item.count}
                  </i>
                </button>
              ))}
            </div>
          )}
          {unreadSocialItems.length > 0 && <div className="rail-divider social-unread-divider" />}
          <button
            className={`rail-item${selectedServer ? '' : ' active'}`}
            aria-label={messages.home}
            onClick={() => selectServer(null)}
          >
            <Home size={20} />
          </button>
          <div className="rail-divider" />
          {activeServerLayout.map((item: ServerLayoutItem) => {
            if (item.type === 'server') {
              const server = servers.find((s) => s.id === item.id);
              if (!server) return null;
              return renderServerItem(server);
            }
            if (item.type === 'folder' && item.serverIds) {
              const isExpanded = expandedFolders.has(item.id);
              const folderServers = item.serverIds
                .map((id: string) => servers.find((s) => s.id === id))
                .filter(Boolean) as ServerSummary[];
              if (folderServers.length === 0) return null;

              return (
                <ServerFolderContextMenu
                  key={item.id}
                  item={item}
                  messages={messages}
                  onChange={(patch) => updateFolder(item.id, patch)}
                  onMarkRead={() => markFolderRead(item.serverIds ?? [])}
                >
                  {isExpanded ? (
                    <div
                      className={`server-folder-expanded${dragOverTarget?.id === item.id ? ` drag-over drag-over-${dragOverTarget.placement}` : ''}`}
                      style={{ '--folder-color': item.color ?? '#1478ff' } as CSSProperties}
                      onDragOver={(e) => handleDragOver(e, item.id)}
                      onDrop={(e) => handleDrop(e, item.id)}
                    >
                      <button
                        className="server-folder-collapse"
                        draggable
                        onDragStart={(event) => handleDragStart(event, item.id, 'folder')}
                        onDragEnd={() => {
                          setDraggedFolderId(null);
                          setDragOverTarget(null);
                        }}
                        onClick={() => toggleFolder(item.id)}
                        aria-label={messages.collapse}
                      >
                        <span />
                      </button>
                      {folderServers.map((s) => renderServerItem(s))}
                    </div>
                  ) : (
                    <button
                      className={`server-folder-preview${dragOverTarget?.id === item.id ? ` drag-over drag-over-${dragOverTarget.placement}` : ''}`}
                      draggable
                      onDragStart={(event) => handleDragStart(event, item.id, 'folder')}
                      onDragEnd={() => {
                        setDraggedFolderId(null);
                        setDragOverTarget(null);
                      }}
                      style={{ '--folder-color': item.color ?? '#1478ff' } as CSSProperties}
                      onClick={() => toggleFolder(item.id)}
                      onDragOver={(e) => handleDragOver(e, item.id)}
                      onDrop={(e) => handleDrop(e, item.id)}
                      title={item.name || messages.serverFolder}
                    >
                      <span className="server-folder-icon-grid">
                        {folderServers
                          .slice(0, 4)
                          .map((s) =>
                            s.iconUrl ? (
                              <img key={s.id} src={s.iconUrl} alt="" />
                            ) : (
                              <i key={s.id}>{s.name.slice(0, 1).toUpperCase()}</i>
                            ),
                          )}
                      </span>
                    </button>
                  )}
                </ServerFolderContextMenu>
              );
            }
            return null;
          })}
          {draggedServerId &&
            activeServerLayout.some(
              (item) => item.type === 'folder' && item.serverIds?.includes(draggedServerId),
            ) && (
              <div
                className="folder-extract-drop"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDropOutsideFolder}
                title={messages.removeFromFolder}
              >
                <MinusCircle size={18} />
              </div>
            )}
          <div className="rail-divider rail-actions-divider" />
          <button
            className="rail-item rail-add"
            aria-label={messages.createServer}
            onClick={() => setServerHubOpen(true)}
            disabled={!user.emailVerified}
          >
            <Plus size={20} />
          </button>
          <button
            className={`rail-item rail-discover${discoveryOpen ? ' active' : ''}`}
            aria-label={messages.discoverServers}
            title={messages.discoverServers}
            onClick={openDiscovery}
          >
            <Compass size={20} />
          </button>
          <div className="rail-spacer" />
        </nav>
        <aside
          className={`channel-panel${selectedServer ? '' : ' home-channel-panel'}`}
          aria-label={selectedServer ? messages.channels : messages.directMessages}
        >
          <PanelResizeHandle
            side="channel"
            width={panelLayout.channel}
            label={messages.resizeChannelPanel}
            onPointerDown={(event) => startPanelResize('channel', event)}
            onResizeBy={(delta) => resizePanelBy('channel', delta)}
            onReset={() => resetPanel('channel')}
          />
          <header className={`workspace-head${selectedServer ? ' workspace-head-server' : ''}`}>
            {selectedServer ? (
              <ServerHeader
                server={selectedServer}
                locale={locale === 'en' ? 'en' : 'tr'}
                messages={messages}
                canAccessSettings={canAccessServerSettings}
                canManageChannels={canManageChannels}
                canInvite={
                  selectedServer.permissions.includes('CREATE_INVITES') ||
                  selectedServer.role === 'OWNER'
                }
                onInvite={() => setInviteServer(selectedServer)}
                onOpenSettings={openServerSettings}
                onOpenWoost={() => setSupportDialogServer(selectedServer)}
                onOpenTags={() => openServerSettings('tags')}
                onEditProfile={() => {
                  setSettingsTab('profile');
                  setSettingsOpen(true);
                }}
                onCreateChannel={openCreateChannel}
                onCreateCategory={openCreateCategory}
                onLeave={() => leaveServerFromRail(selectedServer)}
                onNotice={setNotice}
              />
            ) : discoveryOpen ? (
              <>
                <strong>{messages.discoverServers}</strong>
                <Compass size={17} />
              </>
            ) : (
              <strong>{messages.messages}</strong>
            )}
          </header>
          <div
            ref={channelListRef}
            className={`channel-list${selectedServer ? '' : ' home-channel-list'}`}
            onScroll={(event) => {
              window.sessionStorage.setItem(
                channelScrollStorageKey,
                String(event.currentTarget.scrollTop),
              );
            }}
          >
            {discoveryOpen ? (
              <div className="server-discovery-side-nav">
                <button className="active" type="button" aria-current="page">
                  <Compass size={17} /> {messages.discoverServers}
                </button>
                <p>{messages.discoverServersHint}</p>
              </div>
            ) : selectedServer ? (
              <>
                {selectedServer.bannerUrl && (
                  <div className="server-sidebar-banner">
                    <img src={selectedServer.bannerUrl} alt={selectedServer.name} />
                  </div>
                )}
                <ServerSupportGoal
                  server={selectedServer}
                  onClick={() => setSupportDialogServer(selectedServer)}
                />
                <ChannelSidebar
                  tree={channelTree}
                  selectedChannelId={selectedChannel?.id ?? null}
                  messages={messages}
                  owner={canManageChannels}
                  loading={channelsQuery.isPending}
                  onSelect={selectChannel}
                  onManage={() => setChannelManagerOpen(true)}
                  onChannelSettings={openChannelSettings}
                  onOpenVoiceChat={toggleVoiceChannelChat}
                  onInviteVoice={setInviteChannelId}
                  canInvite={selectedServer.permissions.includes('CREATE_INVITES')}
                  activeVoiceChatChannelId={voiceChatChannelId}
                  onCategorySettings={setCategorySettingsId}
                  onChanged={refreshChannels}
                  serverId={selectedServer.id}
                  serverPublicId={selectedServer.publicId}
                  voiceSummaries={voiceSummaries}
                  speakingConnectionIds={voiceConnection.speakingConnectionIds}
                  unreadSummaries={unreadQuery.data ?? []}
                  onNotice={setNotice}
                  onOpenVoiceParticipantProfile={(participant, anchor) => {
                    const targetMember = findMemberForVoiceParticipant(participant, members);
                    openUserProfile(targetMember, anchor);
                  }}
                  onOpenVoiceParticipantContextMenu={(participant, channelId, position) => {
                    setVoiceContextMenuTarget({ participant, channelId, position });
                  }}
                />
              </>
            ) : (
              <SocialSidebar
                currentUserId={user.id}
                selectedConversationId={selectedConversationId}
                messages={messages}
                locale={locale}
                pinnedConversations={user.pinnedSocialConversations}
                developerMode={developerMode}
                onPinnedConversationsChange={updatePinnedSocialConversations}
                onSelectConversation={selectConversation}
                onOpenProfile={openUserProfile}
                onNotice={setNotice}
                premiumActive={premiumHomeOpen}
                storeActive={storeHomeOpen}
                onOpenPremium={openPremiumHome}
                onOpenStore={() => openStoreHome()}
              />
            )}
          </div>
          <VoiceConnectionDock
            messages={messages}
            connection={voiceConnection}
            servers={servers}
            onOpenChannel={openActiveVoiceChannel}
            showVideoPreview={selectedChannel?.id !== voiceConnection.activeChannel?.id}
          />
          <div className={`user-dock${premiumNameplateSurfaceClass(user.premium?.nameplate)}`}>
            <button
              className="user-dock-identity"
              aria-label={messages.openQuickProfile}
              aria-expanded={Boolean(userDockMenu)}
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setUserDockMenu((current) =>
                  current
                    ? null
                    : {
                        left: rect.left,
                        right: rect.right,
                        top: rect.top,
                        bottom: rect.bottom,
                        width: rect.width,
                      },
                );
              }}
            >
              <span className="user-avatar">
                {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initial}
                <i className={`status-dot ${statusClass}`} />
              </span>
              <span className="user-copy">
                <strong>{user.displayName}</strong>
                <GameStatus user={user} locale={locale}>{(user.customStatusEmoji || user.customStatusText) && (
                  <span>
                    {user.customStatusEmoji && <CustomStatusEmoji value={user.customStatusEmoji} />}{' '}
                    {user.customStatusText}
                  </span>
                )}</GameStatus>
              </span>
            </button>
            <div className="dock-audio-control">
              <button
                className={`icon-button${voiceConnection.muted ? ' active' : ''}`}
                onClick={voiceConnection.toggleMuted}
                aria-pressed={voiceConnection.muted}
                aria-label={
                  voiceConnection.muted ? messages.unmuteMicrophone : messages.muteMicrophone
                }
              >
                {voiceConnection.muted ? <MicOff size={17} /> : <Mic size={17} />}
              </button>
              <button
                className="dock-audio-arrow"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setAudioMenu((current) =>
                    current?.kind === 'input'
                      ? null
                      : {
                          kind: 'input',
                          anchor: {
                            left: rect.left,
                            right: rect.right,
                            top: rect.top,
                            bottom: rect.bottom,
                            width: rect.width,
                          },
                        },
                  );
                }}
                aria-label={messages.audioInputDevice}
                aria-expanded={audioMenu?.kind === 'input'}
              >
                <ChevronUp size={13} />
              </button>
            </div>
            <div className="dock-audio-control">
              <button
                className={`icon-button${voiceConnection.deafened ? ' active' : ''}`}
                onClick={voiceConnection.toggleDeafened}
                aria-pressed={voiceConnection.deafened}
                aria-label={voiceConnection.deafened ? messages.enableAudio : messages.disableAudio}
              >
                {voiceConnection.deafened ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>
              <button
                className="dock-audio-arrow"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setAudioMenu((current) =>
                    current?.kind === 'output'
                      ? null
                      : {
                          kind: 'output',
                          anchor: {
                            left: rect.left,
                            right: rect.right,
                            top: rect.top,
                            bottom: rect.bottom,
                            width: rect.width,
                          },
                        },
                  );
                }}
                aria-label={messages.audioOutputDevice}
                aria-expanded={audioMenu?.kind === 'output'}
              >
                <ChevronUp size={13} />
              </button>
            </div>
            <button
              className="icon-button"
              onClick={() => {
                setSettingsTab('profile');
                setSettingsOpen(true);
              }}
              aria-label={messages.settings}
            >
              <Settings size={17} />
            </button>
            {audioMenu && (
              <AudioDeviceMenu
                kind={audioMenu.kind}
                anchor={audioMenu.anchor}
                connection={voiceConnection}
                messages={messages}
                onClose={() => setAudioMenu(null)}
                onOpenSettings={() => {
                  setAudioMenu(null);
                  setSettingsTab('voice');
                  setSettingsOpen(true);
                }}
              />
            )}
            {userDockMenu && (
              <UserDockMenu
                user={user}
                anchor={userDockMenu}
                messages={messages}
                onClose={() => setUserDockMenu(null)}
                onUser={applyCurrentUser}
                onOpenSettings={() => {
                  setUserDockMenu(null);
                  setProfileStudioOpen(true);
                }}
                onOpenPremium={() => {
                  setUserDockMenu(null);
                  setSettingsTab('premium');
                  setSettingsOpen(true);
                }}
                onLogout={() => void logout()}
                onAccountSwitched={() => {
                  voiceConnection.disconnect();
                  endSocialCalls();
                  setUserDockMenu(null);
                  window.location.reload();
                }}
              />
            )}
          </div>
        </aside>
        <section className="main-panel">
          <header
            className={`main-head${!selectedServer && selectedConversationId ? ' conversation-active' : ''}`}
          >
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobileNavOpen(true)}
              aria-label={messages.servers}
            >
              <Menu size={20} />
            </button>
            {discoveryOpen ? (
              <>
                <Compass size={20} />
                <h1>{messages.discoverServers}</h1>
              </>
            ) : (
              <>
                {supportDialogServer ? (
                  <img
                    className="woost-icon"
                    src="/brand/woost-icon.png"
                    width="23"
                    height="23"
                    alt=""
                  />
                ) : !selectedServer && premiumHomeOpen ? (
                  <WapvePlusBadge size={27} />
                ) : !selectedServer && storeHomeOpen ? (
                  <ShoppingBag size={20} />
                ) : !selectedServer ? (
                  <Users size={20} />
                ) : selectedChannel?.type === 'VOICE' ? (
                  <Headphones size={20} />
                ) : (
                  <Hash size={20} />
                )}
                <h1>
                  {supportDialogServer
                    ? locale === 'tr'
                      ? 'Sunucu Woostları'
                      : 'Server Woosts'
                    : premiumHomeOpen
                      ? 'Wapve+'
                      : storeHomeOpen
                        ? locale === 'tr'
                          ? 'Mağaza'
                          : 'Store'
                        : (selectedChannel?.name ?? selectedServer?.name ?? messages.friends)}
                </h1>
                {selectedChannel?.nsfw && (
                  <span className="nsfw-badge" aria-label="18+">
                    18+
                  </span>
                )}
                {(selectedChannel?.topic ||
                  supportDialogServer ||
                  premiumHomeOpen ||
                  storeHomeOpen ||
                  selectedServer) && (
                  <>
                    <span>·</span>
                    <div
                      className={`channel-topic-container${selectedChannel?.topic ? ' interactive' : ''}`}
                      title={selectedChannel?.topic || ''}
                      role={selectedChannel?.topic ? 'button' : undefined}
                      tabIndex={selectedChannel?.topic ? 0 : undefined}
                      onClick={(event) => {
                        if ((event.target as Element).closest('a')) return;
                        if (selectedChannel?.topic) setChannelTopicOpen(true);
                      }}
                      onKeyDown={(event) => {
                        if (!selectedChannel?.topic || (event.key !== 'Enter' && event.key !== ' '))
                          return;
                        event.preventDefault();
                        setChannelTopicOpen(true);
                      }}
                    >
                      {selectedChannel?.topic ? (
                        <MarkdownRenderer
                          content={selectedChannel.topic}
                          locale={locale}
                          showLinkPreview={false}
                        />
                      ) : supportDialogServer ? (
                        locale === 'tr' ? (
                          `${supportDialogServer.name} için seviyeler ve avantajlar`
                        ) : (
                          `Levels and perks for ${supportDialogServer.name}`
                        )
                      ) : premiumHomeOpen ? (
                        locale === 'tr' ? (
                          'Üyelik, koleksiyon ve sunucu takviyeleri'
                        ) : (
                          'Membership, collection, and server supports'
                        )
                      ) : storeHomeOpen ? (
                        locale === 'tr' ? (
                          'Dekorasyonlar, çerçeveler ve isim plakaları'
                        ) : (
                          'Decorations, frames, and nameplates'
                        )
                      ) : selectedServer ? (
                        `${selectedServer.memberCount} ${messages.member.toLowerCase()}`
                      ) : null}
                    </div>
                  </>
                )}
              </>
            )}
            <div style={{ flex: 1 }} />
            {supportDialogServer && (
              <button
                className="icon-button support-workspace-close"
                type="button"
                onClick={() => setSupportDialogServer(null)}
                aria-label={messages.close}
                title={messages.close}
              >
                <X size={19} />
              </button>
            )}
            {!supportDialogServer && selectedChannel?.type === 'VOICE' && (
              <button
                className={`icon-button${voiceChatOpen ? ' active' : ''}`}
                onClick={() => toggleVoiceChannelChat(selectedChannel.id)}
                aria-label={
                  voiceChatOpen ? messages.closeVoiceChannelChat : messages.openVoiceChannelChat
                }
                aria-pressed={voiceChatOpen}
              >
                <MessageSquare size={18} />
              </button>
            )}
            {!supportDialogServer && selectedChannel?.type === 'TEXT' && (
              <>
                <button
                  className={`icon-button${channelMessageTool === 'pins' ? ' active' : ''}`}
                  data-channel-message-tool-trigger
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent('wapve:channel-message-tool', { detail: 'pins' }),
                    )
                  }
                  aria-label={messages.pinnedMessages}
                  aria-expanded={channelMessageTool === 'pins'}
                  title={messages.pinnedMessages}
                >
                  <Pin size={18} />
                </button>
                <button
                  className={`icon-button${channelMessageTool === 'search' ? ' active' : ''}`}
                  data-channel-message-tool-trigger
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent('wapve:channel-message-tool', { detail: 'search' }),
                    )
                  }
                  aria-label={messages.searchMessages}
                  aria-expanded={channelMessageTool === 'search'}
                  title={messages.searchMessages}
                >
                  <Search size={18} />
                </button>
              </>
            )}
            <button
              className="icon-button report-problem-button"
              onClick={() => setReportOpen(true)}
              aria-label={locale === 'tr' ? 'Sorun bildir' : 'Report a problem'}
              title={locale === 'tr' ? 'Sorun bildir' : 'Report a problem'}
            >
              <Bug size={18} />
            </button>
            <NotificationCenter
              locale={locale}
              messages={messages}
              onNavigate={navigateNotification}
              onChanged={refreshNotificationRelatedData}
            />
          </header>
          {!user.hasCredentials ? (
            <div className="verification-banner claim-account-banner">
              <ShieldCheck size={22} />
              <div>
                <strong>{locale === 'tr' ? 'Hesabını kaybetme' : 'Don’t lose your account'}</strong>
                <span>{locale === 'tr' ? 'E-posta ve parola eklemeden çıkış yaparsan bu hesaba yeniden erişemezsin.' : 'If you log out before adding email and password, you cannot access this account again.'}</span>
              </div>
              <button className="text-link" onClick={() => setClaimOpen(true)}>
                {locale === 'tr' ? 'Güvenceye al' : 'Secure account'}
              </button>
            </div>
          ) : !user.emailVerified && (
            <div className="verification-banner">
              <ShieldCheck size={22} />
              <div>
                <strong>{messages.unverifiedTitle}</strong>
                <span>{messages.unverifiedText}</span>
              </div>
              <button className="text-link" onClick={() => router.push('/verify-email')}>
                {messages.resend}
              </button>
            </div>
          )}
          {notice && (
            <div className={`app-notice${noticeLeaving ? ' leaving' : ''}`} role="status">
              <div className="app-notice-content">
                <span className="app-notice-icon" aria-hidden="true">
                  <Check size={14} />
                </span>
                <span className="app-notice-text">{notice}</span>
              </div>
              <button
                type="button"
                className="app-notice-close"
                onClick={dismissNotice}
                aria-label={messages.close}
              >
                ×
              </button>
            </div>
          )}
          {voiceResume &&
            !voiceConnection.joined &&
            voiceResume.serverId === selectedServer?.id &&
            (() => {
              const resumableChannel = channelTree.channels.find(
                (channel) => channel.id === voiceResume.channelId && channel.type === 'VOICE',
              );
              if (!resumableChannel) return null;
              return (
                <div className="voice-resume-banner" role="status">
                  <Headphones size={18} />
                  <span>
                    <strong>{messages.voiceSessionInterrupted}</strong>
                    <small>
                      {messages.voiceResumeQuestion.replace('{channel}', resumableChannel.name)}
                    </small>
                  </span>
                  <button
                    className="wapve-button wapve-button--primary"
                    onClick={() => {
                      setVoiceResume(null);
                      connectServerVoice(resumableChannel);
                    }}
                  >
                    {messages.reconnectVoice}
                  </button>
                  <button
                    className="wapve-button wapve-button--secondary"
                    onClick={() => {
                      window.sessionStorage.removeItem('wapve:voice-resume');
                      setVoiceResume(null);
                    }}
                  >
                    {messages.dismiss}
                  </button>
                </div>
              );
            })()}
          {supportDialogServer ? (
            <main className="server-support-workspace">
              <ServerSupportOverviewPanel server={supportDialogServer} locale={locale} />
            </main>
          ) : discoveryOpen ? (
            <ServerDiscoveryPanel messages={messages} locale={locale} onServer={upsertServer} />
          ) : selectedServer && selectedChannel?.type === 'TEXT' ? (
            <ChannelMessages
              serverId={selectedServer.id}
              channel={selectedChannel}
              currentUserId={user.id}
              emailVerified={user.emailVerified}
              locale={locale}
              messages={messages}
              members={members}
              roles={rolesQuery.data ?? []}
              channels={channelTree.channels}
              canMentionEveryone={
                selectedServer.role === 'OWNER' ||
                selectedServer.permissions.includes('MENTION_EVERYONE') ||
                selectedServer.permissions.includes('MANAGE_ROLES')
              }
              canManageMessages={selectedServer.permissions.includes('MANAGE_MESSAGES')}
              onOpenProfile={openUserProfile}
              onSelectChannel={selectChannel}
              server={selectedServer}
              developerMode={developerMode}
              onMembersChanged={refreshServerPeople}
              onNotice={setNotice}
              onOpenSettings={openServerSettings}
              premiumActive={Boolean(user.premium?.active)}
              onPremiumRequired={() => setAnimatedEmojiUpgradeOpen(true)}
              platformOwner={user.badges.includes('PLATFORM_OWNER')}
              onSidePanelChange={setChannelMessageTool}
            />
          ) : selectedServer && selectedChannel?.type === 'VOICE' ? (
            <div className={`voice-channel-workspace${voiceChatOpen ? ' chat-open' : ''}`}>
              <VoiceChannel
                channel={selectedChannel}
                currentUserId={user.id}
                emailVerified={user.emailVerified}
                messages={messages}
                connection={voiceConnection}
                server={selectedServer}
                members={members}
                roles={rolesQuery.data ?? []}
                currentMember={currentMember}
                developerMode={developerMode}
                locale={locale}
                onOpenProfile={openUserProfile}
                onOpenSettings={openServerSettings}
                onMembersChanged={refreshServerPeople}
                onNotice={setNotice}
              />
              {voiceChatOpen && (
                <aside className="voice-channel-chat" aria-label={messages.voiceChannelChat}>
                  <PanelResizeHandle
                    side="voiceChat"
                    width={panelLayout.voiceChat}
                    label={messages.resizeVoiceChatPanel}
                    onPointerDown={(event) => startPanelResize('voiceChat', event)}
                    onResizeBy={(delta) => resizePanelBy('voiceChat', delta)}
                    onReset={() => resetPanel('voiceChat')}
                  />
                  <header>
                    <div>
                      <MessageSquare size={18} />
                      <strong>{selectedChannel.name}</strong>
                    </div>
                    <button
                      className="icon-button"
                      onClick={() => setVoiceChatChannelId(null)}
                      aria-label={messages.closeVoiceChannelChat}
                    >
                      <X size={18} />
                    </button>
                  </header>
                  <ChannelMessages
                    compact
                    serverId={selectedServer.id}
                    channel={selectedChannel}
                    currentUserId={user.id}
                    emailVerified={user.emailVerified}
                    locale={locale}
                    messages={messages}
                    members={members}
                    roles={rolesQuery.data ?? []}
                    channels={channelTree.channels}
                    canMentionEveryone={
                      selectedServer.role === 'OWNER' ||
                      selectedServer.permissions.includes('MENTION_EVERYONE') ||
                      selectedServer.permissions.includes('MANAGE_ROLES')
                    }
                    canManageMessages={selectedServer.permissions.includes('MANAGE_MESSAGES')}
                    onOpenProfile={openUserProfile}
                    onSelectChannel={selectChannel}
                    server={selectedServer}
                    developerMode={developerMode}
                    onMembersChanged={refreshServerPeople}
                    onNotice={setNotice}
                    onOpenSettings={openServerSettings}
                    premiumActive={Boolean(user.premium?.active)}
                    onPremiumRequired={() => setAnimatedEmojiUpgradeOpen(true)}
                    platformOwner={user.badges.includes('PLATFORM_OWNER')}
                  />
                </aside>
              )}
            </div>
          ) : !selectedServer && premiumHomeOpen ? (
            <main className="premium-home-page">
              <PremiumCenter locale={locale} onOpenStore={() => openStoreHome()} />
            </main>
          ) : !selectedServer && storeHomeOpen ? (
            <main className="premium-home-page premium-store-page">
              <PremiumStore
                locale={locale}
                user={user}
                onUser={applyCurrentUser}
                onOpenPremium={openPremiumHome}
                initialCategory={storeCategory}
              />
            </main>
          ) : !selectedServer ? (
            <SocialHub
              currentUser={user}
              currentUserId={user.id}
              emailVerified={user.emailVerified}
              locale={locale}
              messages={messages}
              selectedConversationId={selectedConversationId}
              pinnedConversations={user.pinnedSocialConversations}
              developerMode={developerMode}
              onPinnedConversationsChange={updatePinnedSocialConversations}
              onSelectConversation={selectConversation}
              onOpenProfile={openUserProfile}
              platformOwner={user.badges.includes('PLATFORM_OWNER')}
              onOpenPremium={openPremiumHome}
            />
          ) : (
            <div className="empty-state">
              <div className="empty-illustration">
                {selectedChannel?.type === 'VOICE' ? (
                  <Headphones size={45} />
                ) : selectedChannel ? (
                  <Hash size={45} />
                ) : (
                  <Sparkles size={45} />
                )}
              </div>
              <h2>
                {selectedChannel?.name ??
                  (selectedServer ? messages.chooseChannel : messages.emptyTitle)}
              </h2>
              <p>
                {selectedChannel
                  ? selectedChannel.type === 'TEXT'
                    ? messages.textChannelReady
                    : messages.voiceChannelReady
                  : selectedServer
                    ? messages.noChannels
                    : messages.emptyText}
              </p>
              {canManageChannels && !selectedChannel && (
                <button
                  className="text-link empty-action"
                  onClick={() => setChannelManagerOpen(true)}
                >
                  {messages.createChannel}
                </button>
              )}
            </div>
          )}
        </section>
        {!supportDialogServer && !discoveryOpen && !premiumHomeOpen && !storeHomeOpen && (
          <aside className="member-panel" aria-label={messages.members}>
            <PanelResizeHandle
              side="member"
              width={panelLayout.member}
              label={messages.resizeMemberPanel}
              onPointerDown={(event) => startPanelResize('member', event)}
              onResizeBy={(delta) => resizePanelBy('member', delta)}
              onReset={() => resetPanel('member')}
            />
            {selectedServer && <h2>{`${messages.members} — ${members.length}`}</h2>}
            {selectedServer && !discoveryOpen ? (
              <>
                {(() => {
                  const online = members.filter(
                    (m) => m.status !== 'OFFLINE' && m.status !== 'INVISIBLE',
                  );
                  const offline = members.filter(
                    (m) => m.status === 'OFFLINE' || m.status === 'INVISIBLE',
                  );

                  const groups: {
                    id: string;
                    name: string;
                    position: number;
                    members: typeof members;
                  }[] = [];
                  const defaultOnlineGroup = {
                    id: 'online',
                    name: messages.online,
                    position: -1,
                    members: [] as typeof members,
                  };

                  online.forEach((m) => {
                    const hoistedRoles = m.roles
                      .filter((r) => r.hoist)
                      .sort((a, b) => b.position - a.position);
                    if (hoistedRoles.length > 0) {
                      const highest = hoistedRoles[0]!;
                      let group = groups.find((g) => g.id === highest.id);
                      if (!group) {
                        group = {
                          id: highest.id,
                          name: highest.name,
                          position: highest.position,
                          members: [],
                        };
                        groups.push(group);
                      }
                      group.members.push(m);
                    } else {
                      defaultOnlineGroup.members.push(m);
                    }
                  });

                  groups.sort((a, b) => b.position - a.position);
                  if (defaultOnlineGroup.members.length > 0) groups.push(defaultOnlineGroup);

                  const renderMember = (member: (typeof members)[0]) => (
                    <MemberContextMenu
                      key={member.id}
                      member={member}
                      currentMember={currentMember}
                      currentUserId={user?.id ?? ''}
                      server={selectedServer}
                      roles={rolesQuery.data ?? []}
                      developerMode={developerMode}
                      messages={messages}
                      onChanged={refreshServerPeople}
                      onNotice={setNotice}
                      onOpenSettings={openServerSettings}
                    >
                      <div
                        className={`member-row${premiumNameplateSurfaceClass(member.premium?.nameplate)}${member.status === 'OFFLINE' || member.status === 'INVISIBLE' ? ' opacity-40' : ''}`}
                        onClick={(event) => openUserProfile(member, event.currentTarget)}
                      >
                        <div className="user-avatar">
                          {member.avatarUrl ? (
                            <img src={member.avatarUrl} alt="" />
                          ) : (
                            member.displayName.slice(0, 1).toUpperCase()
                          )}
                          {member.status !== 'OFFLINE' && member.status !== 'INVISIBLE' && (
                            <i className={`status-dot ${member.status.toLowerCase()}`} />
                          )}
                        </div>
                        <div className="user-copy">
                          <div className="member-name-line">
                            <strong
                              style={{
                                color:
                                  member.roles.length > 0
                                    ? [...member.roles].sort((a, b) => b.position - a.position)[0]
                                        ?.color
                                    : undefined,
                              }}
                            >
                              {member.displayName}
                            </strong>
                            {member.serverTag && (
                              <ServerTagChip tag={member.serverTag} compact interactive={false} />
                            )}
                          </div>
                          <GameStatus user={member} locale={locale}>{member.status !== 'OFFLINE' &&
                          (member.customStatusText || member.customStatusEmoji) ? (
                            <span>
                              {member.customStatusEmoji && (
                                <>
                                  <CustomStatusEmoji value={member.customStatusEmoji} />{' '}
                                </>
                              )}
                              {member.customStatusText}
                            </span>
                          ) : null}</GameStatus>
                        </div>
                      </div>
                    </MemberContextMenu>
                  );

                  return (
                    <>
                      {groups.map((g) => (
                        <div key={g.id}>
                          <div
                            className="member-group-header"
                            style={{
                              marginTop: 12,
                              paddingLeft: 12,
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--color-text-dim)',
                              textTransform: 'uppercase',
                            }}
                          >
                            {g.name} — {g.members.length}
                          </div>
                          {g.members.map(renderMember)}
                        </div>
                      ))}
                      {offline.length > 0 && (
                        <div>
                          <div
                            className="member-group-header"
                            style={{
                              marginTop: 12,
                              paddingLeft: 12,
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--color-text-dim)',
                              textTransform: 'uppercase',
                            }}
                          >
                            {messages.offline} — {offline.length}
                          </div>
                          {offline.map(renderMember)}
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            ) : (
              <SocialActivityPanel
                currentUserId={user.id}
                selectedConversationId={selectedConversationId}
                locale={locale}
                messages={messages}
                onSelectConversation={selectConversation}
                onOpenProfile={openUserProfile}
                onDiveVoiceRoom={(serverId, channelId) => void diveVoiceRoom(serverId, channelId)}
              />
            )}
          </aside>
        )}
        <VoiceConnectionDock
          mobile
          messages={messages}
          connection={voiceConnection}
          servers={servers}
          onOpenChannel={openActiveVoiceChannel}
          showVideoPreview={selectedChannel?.id !== voiceConnection.activeChannel?.id}
        />
        {unreadSocialItems.length > 0 && (
          <div className="mobile-social-unread" aria-label={messages.unreadConversations}>
            {unreadSocialItems.slice(0, 3).map((item, index) => (
              <button
                key={item.id}
                className="mobile-social-unread-item"
                style={{ '--unread-item-index': index } as CSSProperties}
                aria-label={`${item.title}, ${item.count} ${messages.unread}`}
                title={item.title}
                onClick={() => navigateWorkspace(null, null, item.selectionId)}
              >
                <SocialUnreadAvatar item={item} />
                <i aria-hidden="true">{item.count > 99 ? '99+' : item.count}</i>
              </button>
            ))}
          </div>
        )}
        <nav className="mobile-bottom" aria-label="Mobile navigation">
          <button
            className={!selectedServer && !discoveryOpen ? 'active' : ''}
            onClick={() => selectServer(null)}
          >
            <Home size={20} />
            <span>{messages.home}</span>
          </button>
          <button className={selectedServer ? 'active' : ''} onClick={() => setMobileNavOpen(true)}>
            <Users size={20} />
            <span>{messages.servers}</span>
          </button>
          <button
            onClick={() => {
              setSettingsTab('profile');
              setSettingsOpen(true);
            }}
          >
            <UserRound size={20} />
            <span>{messages.account}</span>
          </button>
        </nav>
      </main>
      {selectedChannel?.topic && (
        <ChannelTopicDialog
          channel={selectedChannel}
          locale={locale}
          messages={messages}
          open={channelTopicOpen}
          onOpenChange={setChannelTopicOpen}
        />
      )}
      {mobileNavOpen && (
        <div
          className="mobile-nav-scrim"
          role="presentation"
          onMouseDown={() => setMobileNavOpen(false)}
        >
          <aside
            className="mobile-nav-drawer"
            aria-label={messages.servers}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <nav className="mobile-drawer-rail" aria-label={messages.servers}>
              <button
                className={`mobile-drawer-home${selectedServer || discoveryOpen ? '' : ' active'}`}
                aria-label={messages.home}
                onClick={() => selectServer(null)}
              >
                <WapveLogo compact />
              </button>
              <i />
              {servers.map((server) => (
                <button
                  key={server.id}
                  className={selectedServer?.id === server.id ? 'active' : ''}
                  aria-label={server.name}
                  onClick={() => selectServer(server.id)}
                >
                  {server.iconUrl ? (
                    <img src={server.iconUrl} alt="" />
                  ) : (
                    server.name.slice(0, 2).toUpperCase()
                  )}
                </button>
              ))}
              <button
                className="mobile-drawer-add"
                aria-label={messages.servers}
                onClick={() => {
                  setMobileNavOpen(false);
                  setServerHubOpen(true);
                }}
              >
                <Plus size={21} />
              </button>
              <button
                className={`mobile-drawer-discover${discoveryOpen ? ' active' : ''}`}
                aria-label={messages.discoverServers}
                onClick={openDiscovery}
              >
                <Compass size={20} />
              </button>
            </nav>
            <div className="mobile-drawer-content">
              <header>
                <strong>
                  {discoveryOpen
                    ? messages.discoverServers
                    : (selectedServer?.name ?? messages.directMessages)}
                </strong>
                <div>
                  <button
                    className="icon-button"
                    onClick={() => void logout()}
                    aria-label={messages.logout}
                  >
                    <LogOut size={17} />
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => setMobileNavOpen(false)}
                    aria-label={messages.close}
                  >
                    ×
                  </button>
                </div>
              </header>
              <div className="mobile-drawer-list">
                {discoveryOpen ? (
                  <div className="server-discovery-side-nav">
                    <button className="active" type="button">
                      <Compass size={17} /> {messages.discoverServers}
                    </button>
                  </div>
                ) : selectedServer ? (
                  <ChannelSidebar
                    tree={channelTree}
                    selectedChannelId={selectedChannel?.id ?? null}
                    messages={messages}
                    owner={canManageChannels}
                    loading={channelsQuery.isPending}
                    onSelect={(channelId) => {
                      selectChannel(channelId);
                      setMobileNavOpen(false);
                    }}
                    onManage={() => setChannelManagerOpen(true)}
                    onChannelSettings={openChannelSettings}
                    onOpenVoiceChat={(channelId) => {
                      toggleVoiceChannelChat(channelId);
                      setMobileNavOpen(false);
                    }}
                    onInviteVoice={(channelId) => {
                      setMobileNavOpen(false);
                      setInviteChannelId(channelId);
                    }}
                    canInvite={selectedServer.permissions.includes('CREATE_INVITES')}
                    activeVoiceChatChannelId={voiceChatChannelId}
                    onCategorySettings={setCategorySettingsId}
                    onChanged={refreshChannels}
                    serverId={selectedServer.id}
                    serverPublicId={selectedServer.publicId}
                    voiceSummaries={voiceSummaries}
                    speakingConnectionIds={voiceConnection.speakingConnectionIds}
                    unreadSummaries={unreadQuery.data ?? []}
                    onNotice={setNotice}
                    onOpenVoiceParticipantProfile={(participant, anchor) => {
                      const targetMember = findMemberForVoiceParticipant(participant, members);
                      openUserProfile(targetMember, anchor);
                      setMobileNavOpen(false);
                    }}
                    onOpenVoiceParticipantContextMenu={(participant, channelId, position) => {
                      setVoiceContextMenuTarget({ participant, channelId, position });
                      setMobileNavOpen(false);
                    }}
                  />
                ) : (
                  <SocialSidebar
                    currentUserId={user.id}
                    selectedConversationId={selectedConversationId}
                    messages={messages}
                    locale={locale}
                    pinnedConversations={user.pinnedSocialConversations}
                    developerMode={developerMode}
                    onPinnedConversationsChange={updatePinnedSocialConversations}
                    onSelectConversation={(conversationId) => {
                      selectConversation(conversationId);
                      if (conversationId) setMobileNavOpen(false);
                    }}
                    onOpenProfile={openUserProfile}
                    onNotice={setNotice}
                    premiumActive={premiumHomeOpen}
                    storeActive={storeHomeOpen}
                    onOpenPremium={() => {
                      openPremiumHome();
                      setMobileNavOpen(false);
                    }}
                    onOpenStore={() => {
                      openStoreHome();
                      setMobileNavOpen(false);
                    }}
                  />
                )}
              </div>
              <div className="mobile-drawer-user">
                <div className="user-avatar">
                  {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initial}
                  <i className={`status-dot ${statusClass}`} />
                </div>
                <div className="user-copy">
                  <strong>{user.displayName}</strong>
                  <span>@{user.username}</span>
                </div>
                <button
                  className={voiceConnection.muted ? 'active' : ''}
                  onClick={voiceConnection.toggleMuted}
                  aria-label={
                    voiceConnection.muted ? messages.unmuteMicrophone : messages.muteMicrophone
                  }
                  aria-pressed={voiceConnection.muted}
                >
                  {voiceConnection.muted ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <button
                  className={voiceConnection.deafened ? 'active' : ''}
                  onClick={voiceConnection.toggleDeafened}
                  aria-label={
                    voiceConnection.deafened ? messages.enableAudio : messages.disableAudio
                  }
                  aria-pressed={voiceConnection.deafened}
                >
                  {voiceConnection.deafened ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <button
                  onClick={() => {
                    setMobileNavOpen(false);
                    setSettingsTab('premium');
                    setSettingsOpen(true);
                  }}
                  aria-label="Wapve+"
                >
                  <Crown size={18} />
                </button>
                <button
                  onClick={() => {
                    setSettingsTab('profile');
                    setSettingsOpen(true);
                  }}
                  aria-label={messages.settings}
                >
                  <Settings size={18} />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
      <AccountSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialTab={settingsTab}
        locale={locale}
        messages={messages}
        user={user}
        servers={servers}
        onUser={applyCurrentUser}
        voiceConnection={voiceConnection}
        developerMode={developerMode}
        onDeveloperModeChange={updateDeveloperMode}
        client={client}
        onLogout={logout}
        onOpenStore={() => {
          setSettingsOpen(false);
          openStoreHome();
        }}
      />
      <ProfileStudio
        open={profileStudioOpen}
        onOpenChange={setProfileStudioOpen}
        locale={locale}
        messages={messages}
        user={user}
        onUser={applyCurrentUser}
        onOpenStore={(type) => {
          setProfileStudioOpen(false);
          openStoreHome(type ?? 'featured');
        }}
      />
      <AnimatedEmojiUpgradeDialog
        open={animatedEmojiUpgradeOpen}
        onOpenChange={setAnimatedEmojiUpgradeOpen}
        locale={locale}
        onExplore={() => {
          setAnimatedEmojiUpgradeOpen(false);
          openPremiumHome();
        }}
      />
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        locale={locale}
        messages={messages}
      />
      <UserProfilePopover
        target={userProfileTarget}
        currentUserId={user.id}
        locale={locale}
        messages={messages}
        onClose={() => setUserProfileTarget(null)}
        onCurrentUser={applyCurrentUser}
        onOpenPremium={openPremiumHome}
        onMessage={(conversationId) => {
          selectConversation(conversationId);
        }}
        onServer={selectServer}
      />
      {voiceContextMenuTarget && selectedServer && (
        <VoiceMemberContextMenu
          member={findMemberForVoiceParticipant(voiceContextMenuTarget.participant, members)}
          participant={voiceContextMenuTarget.participant}
          currentMember={currentMember}
          currentUserId={user.id}
          server={selectedServer}
          channelId={voiceContextMenuTarget.channelId}
          roles={rolesQuery.data ?? []}
          developerMode={developerMode}
          messages={messages}
          locale={locale}
          connection={voiceConnection}
          position={voiceContextMenuTarget.position}
          disabledVideo={disabledVideos.has(voiceContextMenuTarget.participant.userId)}
          mutedSoundboard={mutedSoundboards.has(voiceContextMenuTarget.participant.userId)}
          onToggleDisableVideo={toggleDisableVideo}
          onToggleMuteSoundboard={toggleMuteSoundboard}
          onClose={() => setVoiceContextMenuTarget(null)}
          onNotice={setNotice}
          onOpenProfile={(m, anchor, opts) => openUserProfile(m, anchor, opts)}
          onOpenSettings={openServerSettings}
          onMembersChanged={refreshServerPeople}
          onMention={(username) => {
            window.dispatchEvent(new CustomEvent('wapve:insert-mention', { detail: { username } }));
          }}
          onOpenDirectMessage={(userId) => {
            void apiRequest<{ id: string }>('/dm/conversations', {
              method: 'POST',
              body: JSON.stringify({ recipientId: userId }),
            })
              .then((res) => selectConversation(res.id))
              .catch((caught) => setNotice(errorMessage(caught, messages)));
          }}
        />
      )}
      <ServerHubDialog
        open={serverHubOpen}
        onOpenChange={setServerHubOpen}
        messages={messages}
        onServer={upsertServer}
      />
      {selectedServer && (
        <ChannelInviteDialog
          open={Boolean(inviteChannel)}
          onOpenChange={(open) => !open && setInviteChannelId(null)}
          server={selectedServer}
          channel={inviteChannel}
          locale={locale}
          messages={messages}
        />
      )}
      {inviteServer && (
        <ChannelInviteDialog
          open
          onOpenChange={(open) => !open && setInviteServer(null)}
          server={inviteServer}
          channel={null}
          locale={locale}
          messages={messages}
        />
      )}
      <InviteAcceptDialog
        code={activeInviteCode}
        messages={messages}
        onAccepted={(result) => void acceptChannelInvite(result)}
        onClose={() => setActiveInviteCode(null)}
      />
      <ServerSettingsDialog
        open={serverSettingsOpen}
        onOpenChange={setServerSettingsOpen}
        initialSection={serverSettingsSection}
        messages={messages}
        locale={locale}
        server={selectedServer}
        members={members}
        currentUserId={user.id}
        twoFactorEnabled={user.twoFactorEnabled}
        onUpdated={upsertServer}
        onRemoved={removeServer}
        onMembersChanged={refreshServerPeople}
      />
      <ChannelManagerDialog
        open={channelManagerOpen}
        onOpenChange={setChannelManagerOpen}
        initialTab={channelManagerInitialTab}
        messages={messages}
        server={selectedServer}
        tree={channelTree}
        onChanged={refreshChannels}
        locale={locale}
      />
      <ChannelSettingsDialog
        channel={settingsChannel}
        onOpenChange={(open) => {
          if (!open) {
            setChannelSettingsId(null);
            setChannelSettingsSnapshot(null);
          }
        }}
        messages={messages}
        server={selectedServer}
        tree={channelTree}
        members={members}
        currentUserId={user.id}
        onChanged={refreshChannels}
        locale={locale}
      />
      <CategorySettingsDialog
        category={settingsCategory}
        onOpenChange={(open) => !open && setCategorySettingsId(null)}
        messages={messages}
        server={selectedServer}
        tree={channelTree}
        onChanged={refreshChannels}
        locale={locale}
      />
      <Dialog.Root
        open={Boolean(pendingVoiceChannel)}
        onOpenChange={(open) => {
          if (!open) setPendingVoiceChannelId(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="compact-dialog voice-switch-dialog">
            <div className="voice-switch-icon" aria-hidden="true">
              <Headphones size={23} />
            </div>
            <Dialog.Title>{messages.switchVoiceChannel}</Dialog.Title>
            <Dialog.Description>
              {messages.switchVoiceChannelDescription.replace(
                '{channel}',
                pendingVoiceChannel?.name ?? '',
              )}
            </Dialog.Description>
            <label className="voice-switch-checkbox">
              <input
                type="checkbox"
                checked={dontAskVoiceSwitchAgain}
                onChange={(event) => setDontAskVoiceSwitchAgain(event.target.checked)}
              />
              <span>{messages.dontAskVoiceSwitchAgain}</span>
            </label>
            <div className="voice-switch-actions">
              <Dialog.Close asChild>
                <button className="wapve-button wapve-button--secondary" type="button">
                  {messages.cancel}
                </button>
              </Dialog.Close>
              <button
                className="wapve-button wapve-button--primary"
                type="button"
                onClick={confirmVoiceSwitch}
              >
                {messages.switchChannel}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <MediaSetupHost messages={messages} />
      <AccountClaimDialog open={claimOpen} onOpenChange={setClaimOpen} locale={locale} onClaimed={(nextUser) => { applyCurrentUser(nextUser); setNotice(locale === 'tr' ? 'Doğrulama bağlantısı e-posta adresine gönderildi.' : 'A verification link was sent to your email.'); }} />
      <Dialog.Root open={confirmUnclaimedLogout} onOpenChange={setConfirmUnclaimedLogout}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="compact-dialog unclaimed-logout-dialog">
            <div className="account-claim-icon danger"><LogOut size={22} /></div>
            <Dialog.Title>{locale === 'tr' ? 'Bu hesaba geri dönemeyebilirsin' : 'You may not be able to return to this account'}</Dialog.Title>
            <Dialog.Description>{locale === 'tr' ? 'Henüz e-posta ve parola eklemedin. Çıkış yaptığında bu hesap otomatik olarak kurtarılamaz.' : 'You have not added email and password yet. After logging out, this account cannot be recovered automatically.'}</Dialog.Description>
            <div className="voice-switch-actions">
              <button className="wapve-button wapve-button--secondary" type="button" onClick={() => { setConfirmUnclaimedLogout(false); setClaimOpen(true); }}>{locale === 'tr' ? 'Hesabı güvenceye al' : 'Secure account'}</button>
              <button className="wapve-button wapve-button--danger" type="button" onClick={() => { setConfirmUnclaimedLogout(false); void logout(true); }}>{locale === 'tr' ? 'Yine de çıkış yap' : 'Log out anyway'}</button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {client === 'web' && <DesktopDownloadPrompt locale={locale} />}
    </>
  );
}

function SocialUnreadAvatar({ item }: { item: UnreadSocialItem }) {
  if (item.avatarUrl) return <img src={item.avatarUrl} alt="" />;
  const memberAvatars = item.members.filter((member) => member.avatarUrl).slice(0, 2);
  if (memberAvatars.length > 0) {
    return (
      <span className="social-unread-avatar-stack" aria-hidden="true">
        {memberAvatars.map((member) => (
          <img key={member.id} src={member.avatarUrl ?? undefined} alt="" />
        ))}
      </span>
    );
  }
  return <span className="social-unread-initials">{item.initials}</span>;
}

function AudioDeviceMenu({
  kind,
  anchor,
  connection,
  messages,
  onClose,
  onOpenSettings,
}: {
  kind: 'input' | 'output';
  anchor: AnchorBox;
  connection: VoiceConnection;
  messages: Dictionary;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const items = await navigator.mediaDevices.enumerateDevices();
        if (active) setDevices(items);
      } catch {
        if (active) setDevices([]);
      }
    };
    void refresh();
    const refreshOnChange = () => void refresh();
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshOnChange);
    return () => {
      active = false;
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshOnChange);
    };
  }, []);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (!panelRef.current?.contains(target) && !target.closest('.dock-audio-arrow')) onClose();
    };
    const closeOnKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', closeOnKey);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', closeOnKey);
    };
  }, [onClose]);

  const wantedKind = kind === 'input' ? 'audioinput' : 'audiooutput';
  const available = devices.filter((device) => device.kind === wantedKind);
  const selected =
    kind === 'input' ? connection.audioInputDeviceId : connection.audioOutputDeviceId;
  const selectedLabel =
    selected === 'default'
      ? messages.systemDefault
      : available.find((device) => device.deviceId === selected)?.label || messages.systemDefault;

  const width = Math.min(292, window.innerWidth - 20);
  const left = Math.max(
    10,
    Math.min(window.innerWidth - width - 10, anchor.left + anchor.width / 2 - width / 2),
  );
  const bottom = Math.max(10, window.innerHeight - anchor.top + 9);
  const panelRect = panelRef.current?.getBoundingClientRect();
  const submenuHeight = Math.min((available.length + 1) * 42 + 14, window.innerHeight - 20);
  const submenuTop = panelRect
    ? Math.max(10, Math.min(panelRect.top, window.innerHeight - submenuHeight - 10)) - panelRect.top
    : -5;
  const submenuWidth = Math.min(360, Math.max(240, window.innerWidth - width - 34));
  const submenuOpensLeft = Boolean(
    panelRect && panelRect.right + 7 + submenuWidth > window.innerWidth - 10,
  );

  return createPortal(
    <div
      ref={panelRef}
      className={`audio-device-menu audio-device-menu--${kind}`}
      style={{ left, bottom, width, right: 'auto', top: 'auto' }}
      role="dialog"
      aria-label={kind === 'input' ? messages.audioInputDevice : messages.audioOutputDevice}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className="audio-device-selector"
        onMouseEnter={() => setDevicePickerOpen(true)}
        onMouseLeave={() => setDevicePickerOpen(false)}
      >
        <button
          className="audio-device-selector-trigger"
          aria-expanded={devicePickerOpen}
          onClick={() => setDevicePickerOpen((open) => !open)}
        >
          <span>
            <strong>
              {kind === 'input' ? messages.audioInputDevice : messages.audioOutputDevice}
            </strong>
            <small>{selectedLabel}</small>
          </span>
          <ChevronRight size={16} />
        </button>
        {devicePickerOpen && (
          <div
            className={`audio-device-options audio-device-submenu${submenuOpensLeft ? ' opens-left' : ''}`}
            style={{ top: submenuTop, width: submenuWidth, maxHeight: submenuHeight }}
          >
            <button
              className={selected === 'default' ? 'active' : ''}
              onClick={() => {
                if (kind === 'input') void connection.selectAudioInputDevice('default');
                else connection.selectAudioOutputDevice('default');
              }}
            >
              {kind === 'input' ? <Mic size={16} /> : <Volume2 size={16} />}
              <span>{messages.systemDefault}</span>
              {selected === 'default' && <Check size={15} />}
            </button>
            {available
              .filter((device) => device.deviceId && device.deviceId !== 'default')
              .map((device, index) => (
                <button
                  className={selected === device.deviceId ? 'active' : ''}
                  key={device.deviceId}
                  onClick={() => {
                    if (kind === 'input') void connection.selectAudioInputDevice(device.deviceId);
                    else connection.selectAudioOutputDevice(device.deviceId);
                  }}
                >
                  {kind === 'input' ? <Mic size={16} /> : <Volume2 size={16} />}
                  <span>{device.label || `${messages.audioDevice} ${index + 1}`}</span>
                  {selected === device.deviceId && <Check size={15} />}
                </button>
              ))}
          </div>
        )}
      </div>
      {kind === 'output' ? (
        <label className="audio-device-volume">
          <span>{messages.outputVolume}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(connection.audioOutputVolume * 100)}
            onChange={(event) => connection.setAudioOutputVolume(Number(event.target.value) / 100)}
          />
        </label>
      ) : (
        <label className="audio-device-toggle">
          <span>
            <strong>{messages.pushToTalk}</strong>
            <small>{messages.pushToTalkHint}</small>
          </span>
          <input
            type="checkbox"
            checked={connection.pushToTalk}
            onChange={(event) => connection.setPushToTalk(event.target.checked)}
          />
        </label>
      )}
      <button className="audio-settings-link" onClick={onOpenSettings}>
        <Settings size={16} /> {messages.audioSettings}
      </button>
    </div>,
    document.body,
  );
}

function UserDockMenu({
  user,
  anchor,
  messages,
  onClose,
  onUser,
  onOpenSettings,
  onOpenPremium,
  onLogout,
  onAccountSwitched,
}: {
  user: UserProfile;
  anchor: AnchorBox;
  messages: Dictionary;
  onClose: () => void;
  onUser: (user: UserProfile) => void;
  onOpenSettings: () => void;
  onOpenPremium: () => void;
  onLogout: () => void;
  onAccountSwitched: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [customStatus, setCustomStatus] = useState(user.customStatusText ?? '');
  const [busy, setBusy] = useState(false);
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [durationStatus, setDurationStatus] = useState<UserProfile['status'] | null>(null);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [badgeCollectionOpen, setBadgeCollectionOpen] = useState(false);
  const presenceCloseTimerRef = useRef<number | null>(null);
  const accountQuery = useQuery({
    queryKey: ['switcher-accounts', user.id],
    queryFn: () => apiRequest<SwitcherAccounts>('/auth/accounts'),
  });

  function cancelPresenceClose() {
    if (presenceCloseTimerRef.current !== null) window.clearTimeout(presenceCloseTimerRef.current);
    presenceCloseTimerRef.current = null;
  }

  function schedulePresenceClose() {
    cancelPresenceClose();
    presenceCloseTimerRef.current = window.setTimeout(() => {
      presenceCloseTimerRef.current = null;
      setPresenceOpen(false);
      setDurationStatus(null);
    }, 220);
  }

  useEffect(() => {
    const close = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (
        !badgeCollectionOpen &&
        !ref.current?.contains(target) &&
        !target.closest('.user-dock-identity')
      )
        onClose();
    };
    const closeOnKey = (event: KeyboardEvent) =>
      event.key === 'Escape' && !badgeCollectionOpen && onClose();
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', closeOnKey);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', closeOnKey);
      if (presenceCloseTimerRef.current !== null)
        window.clearTimeout(presenceCloseTimerRef.current);
    };
  }, [badgeCollectionOpen, onClose]);

  async function update(
    input: Partial<Pick<UserProfile, 'status' | 'statusExpiresAt' | 'customStatusText'>>,
  ) {
    setBusy(true);
    try {
      const next = await apiRequest<UserProfile>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
      onUser(next);
    } finally {
      setBusy(false);
    }
  }

  const width = Math.min(320, window.innerWidth - 20);
  const left = Math.max(10, Math.min(window.innerWidth - width - 10, anchor.left));
  const bottom = Math.max(10, window.innerHeight - anchor.top + 10);
  const presenceOpensLeft = left + width + 8 + 235 > window.innerWidth - 10;
  const durationOpensLeft =
    presenceOpensLeft || left + width + 8 + 235 + 7 + 158 > window.innerWidth - 10;
  const statuses = [
    {
      value: 'ONLINE' as const,
      label: messages.online,
      icon: <Waves size={15} className="text-emerald-400" />,
    },
    {
      value: 'IDLE' as const,
      label: messages.idle,
      icon: <Moon size={15} className="text-amber-400" />,
    },
    {
      value: 'DND' as const,
      label: messages.dnd,
      icon: <MinusCircle size={15} className="text-rose-400" />,
    },
    {
      value: 'INVISIBLE' as const,
      label: messages.invisible,
      icon: <EyeOff size={15} className="text-slate-400" />,
    },
  ];
  const currentStatus = statuses.find((status) => status.value === user.status) ?? statuses[0]!;
  const durations = [
    { label: messages.for15Minutes, milliseconds: 15 * 60_000 },
    { label: messages.for1Hour, milliseconds: 60 * 60_000 },
    { label: messages.for8Hours, milliseconds: 8 * 60 * 60_000 },
    { label: messages.for24Hours, milliseconds: 24 * 60 * 60_000 },
    { label: messages.for3Days, milliseconds: 3 * 24 * 60 * 60_000 },
    { label: messages.forever, milliseconds: null },
  ];

  function setPresence(status: UserProfile['status'], milliseconds: number | null) {
    void update({
      status,
      statusExpiresAt:
        status === 'ONLINE' || milliseconds === null
          ? null
          : new Date(Date.now() + milliseconds).toISOString(),
    });
    setPresenceOpen(false);
    setDurationStatus(null);
  }

  async function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccountBusy(true);
    setAccountError('');
    const data = new FormData(event.currentTarget);
    const identifier = data.get('identifier');
    const password = data.get('password');
    const code = data.get('code');
    try {
      await apiRequest<SwitcherAccounts>('/auth/accounts', {
        method: 'POST',
        body: JSON.stringify({
          identifier: typeof identifier === 'string' ? identifier : '',
          password: typeof password === 'string' ? password : '',
          code: typeof code === 'string' ? code.trim() || undefined : undefined,
        }),
      });
      event.currentTarget.reset();
      setAddingAccount(false);
      await accountQuery.refetch();
    } catch (caught) {
      setAccountError(errorMessage(caught, messages));
    } finally {
      setAccountBusy(false);
    }
  }

  async function switchAccount(userId: string) {
    setAccountBusy(true);
    setAccountError('');
    try {
      await apiRequest('/auth/accounts/switch', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      onAccountSwitched();
    } catch (caught) {
      setAccountError(errorMessage(caught, messages));
      setAccountBusy(false);
    }
  }

  async function removeAccount(userId: string) {
    setAccountBusy(true);
    setAccountError('');
    try {
      await apiRequest(`/auth/accounts/${userId}`, { method: 'DELETE' });
      await accountQuery.refetch();
    } catch (caught) {
      setAccountError(errorMessage(caught, messages));
    } finally {
      setAccountBusy(false);
    }
  }
  const quickBadges = ownedBadges(user.badges, Boolean(user.premium?.active));
  return createPortal(
    <>
      <div
        ref={ref}
        className="user-dock-menu"
        style={{ left, bottom, width }}
        role="dialog"
        aria-label={messages.openQuickProfile}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header>
          <span className="user-avatar">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" />
            ) : (
              user.displayName.slice(0, 1).toUpperCase()
            )}
            <i className={`status-dot ${user.status.toLowerCase()}`} />
          </span>
          <span>
            <strong>{user.displayName}</strong>
            <small>@{user.username}</small>
            {quickBadges.length > 0 && (
              <span className="profile-badge-row">
                {quickBadges
                  .slice(0, 3)
                  .map((badge) =>
                    badge.kind === 'premium' ? (
                      <WapvePlusBadge key={badge.id} size={30} onClick={onOpenPremium} />
                    ) : badge.id === 'PLATFORM_OWNER' ? (
                      <PlatformOwnerIcon
                        key={badge.id}
                        badges={[badge.id]}
                        locale={user.locale}
                        size={27}
                      />
                    ) : (
                      <AlphaMemberIcon
                        key={badge.id}
                        badges={[badge.id]}
                        locale={user.locale}
                        size={27}
                      />
                    ),
                  )}
                {quickBadges.length > 3 && (
                  <button
                    type="button"
                    className="profile-badge-more"
                    onClick={() => setBadgeCollectionOpen(true)}
                    aria-label={
                      user.locale === 'tr'
                        ? `${quickBadges.length - 3} rozet daha göster`
                        : `Show ${quickBadges.length - 3} more badges`
                    }
                  >
                    …
                  </button>
                )}
              </span>
            )}
          </span>
          <button onClick={onOpenSettings} aria-label={messages.editProfile}>
            <Pencil size={15} />
          </button>
        </header>
        <form
          className="user-dock-status-form"
          onSubmit={(event) => {
            event.preventDefault();
            event.currentTarget.querySelector('input')?.blur();
          }}
        >
          <input
            value={customStatus}
            onChange={(event) => setCustomStatus(event.target.value)}
            maxLength={128}
            placeholder={messages.setCustomStatus}
            onBlur={() => {
              const next = customStatus.trim();
              if (next !== (user.customStatusText ?? ''))
                void update({ customStatusText: next || null });
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setCustomStatus(user.customStatusText ?? '');
                event.currentTarget.blur();
              }
            }}
          />
        </form>
        <div
          className="user-dock-presence"
          onMouseEnter={() => {
            cancelPresenceClose();
            setPresenceOpen(true);
          }}
          onMouseLeave={schedulePresenceClose}
        >
          <button
            type="button"
            className="user-dock-current-status"
            aria-expanded={presenceOpen}
            onClick={() => setPresenceOpen((open) => !open)}
          >
            <span className={`quick-status-icon ${currentStatus.value.toLowerCase()}`}>
              {currentStatus.icon}
            </span>
            <span>
              <strong>{currentStatus.label}</strong>
              {user.statusExpiresAt && (
                <small>
                  {new Intl.DateTimeFormat(user.locale, { timeStyle: 'short' }).format(
                    new Date(user.statusExpiresAt),
                  )}
                </small>
              )}
            </span>
            <ChevronRight size={15} />
          </button>
          {presenceOpen && (
            <div
              className={`user-dock-status-options user-dock-status-flyout${presenceOpensLeft ? ' opens-left' : ''}`}
              onMouseEnter={cancelPresenceClose}
              onMouseLeave={schedulePresenceClose}
            >
              {statuses.map((status) => (
                <div
                  className="user-dock-status-choice"
                  key={status.value}
                  onMouseEnter={() => {
                    cancelPresenceClose();
                    setDurationStatus(status.value);
                  }}
                >
                  <button
                    type="button"
                    className={user.status === status.value ? 'active' : ''}
                    disabled={busy}
                    onClick={() => setPresence(status.value, null)}
                  >
                    <span className={`quick-status-icon ${status.value.toLowerCase()}`}>
                      {status.icon}
                    </span>
                    {status.label}
                    {status.value === 'ONLINE' ? (
                      user.status === status.value && <Check size={15} />
                    ) : (
                      <ChevronRight size={15} />
                    )}
                  </button>
                  {durationStatus === status.value && status.value !== 'ONLINE' && (
                    <div
                      className={`user-dock-duration-menu${durationOpensLeft ? ' opens-left' : ''}`}
                      onMouseEnter={cancelPresenceClose}
                      onMouseLeave={schedulePresenceClose}
                    >
                      {durations.map((duration) => (
                        <button
                          type="button"
                          key={duration.label}
                          disabled={busy}
                          onClick={() => setPresence(status.value, duration.milliseconds)}
                        >
                          {duration.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <button className="user-dock-edit-profile" onClick={onOpenSettings}>
          <Pencil size={15} /> {messages.editProfile}
        </button>
        <button
          className="user-dock-edit-profile"
          onClick={() => {
            setAccountsOpen((open) => !open);
            setAddingAccount(false);
            setAccountError('');
          }}
          aria-expanded={accountsOpen}
        >
          <Repeat2 size={15} /> {messages.switchAccount}
          <ChevronRight size={15} className={accountsOpen ? 'rotated' : ''} />
        </button>
        {accountsOpen && (
          <section className="account-switcher-panel">
            {accountQuery.data?.accounts.map((account) => (
              <div className="account-switcher-row" key={account.id}>
                <span className="user-avatar account-switcher-avatar">
                  {account.avatarUrl ? (
                    <img src={account.avatarUrl} alt="" />
                  ) : (
                    account.displayName.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span>
                  <strong>{account.displayName}</strong>
                  <small>@{account.username}</small>
                </span>
                {account.current ? (
                  <small className="account-switcher-current">{messages.currentAccount}</small>
                ) : (
                  <>
                    <button
                      type="button"
                      className="icon-button"
                      disabled={accountBusy}
                      onClick={() => void switchAccount(account.id)}
                      aria-label={messages.switchAccount}
                    >
                      <Repeat2 size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-button danger"
                      disabled={accountBusy}
                      onClick={() => void removeAccount(account.id)}
                      aria-label={messages.removeAccount}
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            ))}
            {accountError && (
              <div className="form-error" role="alert">
                {accountError}
              </div>
            )}
            {!addingAccount && (accountQuery.data?.accounts.length ?? 1) < 2 && (
              <button
                type="button"
                className="account-switcher-add"
                onClick={() => setAddingAccount(true)}
              >
                <UserRoundPlus size={15} /> {messages.addAccount}
              </button>
            )}
            {addingAccount && (
              <form className="account-switcher-form" onSubmit={(event) => void addAccount(event)}>
                <input
                  name="identifier"
                  required
                  minLength={3}
                  maxLength={254}
                  autoComplete="username"
                  placeholder={messages.emailOrUsername}
                />
                <input
                  name="password"
                  required
                  type="password"
                  maxLength={256}
                  autoComplete="current-password"
                  placeholder={messages.password}
                />
                <input
                  name="code"
                  inputMode="numeric"
                  minLength={6}
                  maxLength={32}
                  autoComplete="one-time-code"
                  placeholder={messages.twoFactorCodeOptional}
                />
                <div>
                  <button type="button" onClick={() => setAddingAccount(false)}>
                    {messages.cancel}
                  </button>
                  <button type="submit" disabled={accountBusy}>
                    {accountBusy ? messages.saving : messages.add}
                  </button>
                </div>
              </form>
            )}
            <small className="account-switcher-hint">{messages.accountSwitcherHint}</small>
          </section>
        )}
        <button className="user-dock-edit-profile" onClick={onLogout}>
          <LogOut size={15} /> {messages.logout}
        </button>
      </div>
      <BadgeCollectionDialog
        open={badgeCollectionOpen}
        onOpenChange={setBadgeCollectionOpen}
        badges={user.badges}
        premiumActive={Boolean(user.premium?.active)}
        locale={user.locale}
      />
    </>,
    document.body,
  );
}

function PanelResizeHandle({
  side,
  width,
  label,
  onPointerDown,
  onResizeBy,
  onReset,
}: {
  side: PanelSide;
  width: number;
  label: string;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeBy: (delta: number) => void;
  onReset: () => void;
}) {
  return (
    <div
      className={`panel-resize-handle panel-resize-handle-${side}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        onResizeBy((side === 'channel' ? direction : -direction) * 16);
      }}
    />
  );
}

function ChannelSidebar({
  tree,
  selectedChannelId,
  messages,
  owner,
  loading,
  serverId,
  serverPublicId,
  onSelect,
  onManage,
  onChannelSettings,
  onOpenVoiceChat,
  onInviteVoice,
  canInvite,
  activeVoiceChatChannelId,
  onCategorySettings,
  onChanged,
  voiceSummaries,
  speakingConnectionIds,
  unreadSummaries,
  onNotice,
  onOpenVoiceParticipantProfile,
  onOpenVoiceParticipantContextMenu,
}: {
  tree: ChannelTree;
  selectedChannelId: string | null;
  messages: Dictionary;
  owner: boolean;
  loading: boolean;
  serverId: string;
  serverPublicId: string;
  onSelect: (channelId: string) => void;
  onManage: () => void;
  onChannelSettings: (channelId: string) => void;
  onOpenVoiceChat: (channelId: string) => void;
  onInviteVoice: (channelId: string) => void;
  canInvite: boolean;
  activeVoiceChatChannelId: string | null;
  onCategorySettings: (categoryId: string) => void;
  onChanged: (notice?: string) => Promise<ChannelTree>;
  voiceSummaries: VoiceChannelSummary[];
  speakingConnectionIds: string[];
  unreadSummaries: ChannelUnreadSummary[];
  onNotice: (notice: string) => void;
  onOpenVoiceParticipantProfile?:
    | ((participant: VoiceParticipant, anchor: HTMLElement) => void)
    | undefined;
  onOpenVoiceParticipantContextMenu?:
    | ((
        participant: VoiceParticipant,
        channelId: string,
        position: VoiceContextMenuPosition,
      ) => void)
    | undefined;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [channelDropTarget, setChannelDropTarget] = useState<{
    categoryId: string | null;
    beforeId: string | null;
    anchorId: string | null;
    edge: 'before' | 'after' | 'end';
  } | null>(null);
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [categoryDropTarget, setCategoryDropTarget] = useState<{
    id: string;
    edge: 'before' | 'after';
  } | null>(null);
  const categories = [...tree.categories].sort((left, right) => left.position - right.position);
  const uncategorized = tree.channels
    .filter((channel) => !channel.categoryId)
    .sort((left, right) => left.position - right.position);

  async function drop(categoryId: string | null, beforeId: string | null) {
    if (!draggedId) return;
    const dragged = tree.channels.find((channel) => channel.id === draggedId);
    if (!dragged) return;
    const groups = new Map<string, ServerChannel[]>();
    for (const channel of tree.channels.filter((item) => item.id !== draggedId)) {
      const key = channel.categoryId ?? 'uncategorized';
      groups.set(key, [...(groups.get(key) ?? []), channel]);
    }
    const targetKey = categoryId ?? 'uncategorized';
    const target = [...(groups.get(targetKey) ?? [])].sort(
      (left, right) => left.position - right.position,
    );
    const index = beforeId ? target.findIndex((channel) => channel.id === beforeId) : target.length;
    target.splice(index < 0 ? target.length : index, 0, { ...dragged, categoryId });
    groups.set(targetKey, target);
    await apiRequest(`/servers/${serverId}/channels/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({
        items: [...groups.entries()].flatMap(([key, channels]) =>
          channels.map((channel, position) => ({
            id: channel.id,
            categoryId: key === 'uncategorized' ? null : key,
            position,
          })),
        ),
      }),
    });
    setDraggedId(null);
    setChannelDropTarget(null);
    await onChanged();
  }

  async function dropCategory(targetId: string, edge: 'before' | 'after') {
    if (!draggedCategoryId || draggedCategoryId === targetId) return;
    const next = categories.filter((category) => category.id !== draggedCategoryId);
    const targetIndex = next.findIndex((category) => category.id === targetId);
    const dragged = categories.find((category) => category.id === draggedCategoryId);
    if (!dragged || targetIndex < 0) return;
    next.splice(targetIndex + (edge === 'after' ? 1 : 0), 0, dragged);
    await apiRequest(`/servers/${serverId}/categories/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ categoryIds: next.map((category) => category.id) }),
    });
    setDraggedCategoryId(null);
    setCategoryDropTarget(null);
    await onChanged();
  }

  return (
    <>
      <div className="channel-sidebar-head">
        <div className="channel-label">{messages.channels}</div>
        {owner && (
          <button
            className="icon-button"
            onClick={onManage}
            aria-label={messages.channelManagement}
          >
            <Plus size={15} />
          </button>
        )}
      </div>
      {loading ? (
        <div className="channel-placeholder">{messages.loading}</div>
      ) : (
        <>
          {(uncategorized.length > 0 || (owner && Boolean(draggedId))) && (
            <ChannelGroup
              label={null}
              channels={uncategorized}
              selectedChannelId={selectedChannelId}
              owner={owner}
              messages={messages}
              onSelect={onSelect}
              onSettings={onChannelSettings}
              onOpenVoiceChat={onOpenVoiceChat}
              onInviteVoice={onInviteVoice}
              canInvite={canInvite}
              activeVoiceChatChannelId={activeVoiceChatChannelId}
              onCategorySettings={onCategorySettings}
              onDragStart={(channelId) => {
                setDraggedId(channelId || null);
                setChannelDropTarget(null);
              }}
              onDrop={(beforeId) => void drop(null, beforeId)}
              channelDragging={Boolean(draggedId)}
              dropTarget={channelDropTarget}
              onDragTarget={setChannelDropTarget}
              voiceSummaries={voiceSummaries}
              speakingConnectionIds={speakingConnectionIds}
              unreadSummaries={unreadSummaries}
              serverId={serverId}
              serverPublicId={serverPublicId}
              onNotice={onNotice}
              onOpenVoiceParticipantProfile={onOpenVoiceParticipantProfile}
              onOpenVoiceParticipantContextMenu={onOpenVoiceParticipantContextMenu}
            />
          )}
          {categories.map((category) => (
            <ChannelGroup
              key={category.id}
              label={category.name}
              channels={tree.channels
                .filter((channel) => channel.categoryId === category.id)
                .sort((left, right) => left.position - right.position)}
              selectedChannelId={selectedChannelId}
              owner={owner}
              messages={messages}
              onSelect={onSelect}
              category={category}
              onSettings={onChannelSettings}
              onOpenVoiceChat={onOpenVoiceChat}
              onInviteVoice={onInviteVoice}
              canInvite={canInvite}
              activeVoiceChatChannelId={activeVoiceChatChannelId}
              onCategorySettings={onCategorySettings}
              onDragStart={(channelId) => {
                setDraggedId(channelId || null);
                setChannelDropTarget(null);
              }}
              onDrop={(beforeId) => void drop(category.id, beforeId)}
              channelDragging={Boolean(draggedId)}
              dropTarget={channelDropTarget}
              onDragTarget={setChannelDropTarget}
              categoryDragging={Boolean(draggedCategoryId)}
              categoryDropTarget={categoryDropTarget}
              onCategoryDragStart={(categoryId) => {
                setDraggedCategoryId(categoryId);
                setCategoryDropTarget(null);
              }}
              onCategoryDragEnd={() => {
                setDraggedCategoryId(null);
                setCategoryDropTarget(null);
              }}
              onCategoryDragTarget={setCategoryDropTarget}
              onCategoryDrop={(targetId, edge) => void dropCategory(targetId, edge)}
              voiceSummaries={voiceSummaries}
              speakingConnectionIds={speakingConnectionIds}
              unreadSummaries={unreadSummaries}
              serverId={serverId}
              serverPublicId={serverPublicId}
              onNotice={onNotice}
              onOpenVoiceParticipantProfile={onOpenVoiceParticipantProfile}
              onOpenVoiceParticipantContextMenu={onOpenVoiceParticipantContextMenu}
            />
          ))}
          {!tree.channels.length && (
            <div className="channel-placeholder">{messages.noChannels}</div>
          )}
        </>
      )}
    </>
  );
}

function ChannelGroup({
  label,
  channels,
  selectedChannelId,
  owner,
  messages,
  category,
  onSelect,
  onSettings,
  onOpenVoiceChat,
  onInviteVoice,
  canInvite,
  activeVoiceChatChannelId,
  onCategorySettings,
  onDragStart,
  onDrop,
  channelDragging,
  dropTarget,
  onDragTarget,
  categoryDragging = false,
  categoryDropTarget = null,
  onCategoryDragStart,
  onCategoryDragEnd,
  onCategoryDragTarget,
  onCategoryDrop,
  voiceSummaries,
  speakingConnectionIds,
  unreadSummaries,
  serverId,
  serverPublicId,
  onNotice,
  onOpenVoiceParticipantProfile,
  onOpenVoiceParticipantContextMenu,
}: {
  label: string | null;
  channels: ServerChannel[];
  selectedChannelId: string | null;
  owner: boolean;
  messages: Dictionary;
  category?: ChannelCategory;
  onSelect: (channelId: string) => void;
  onSettings: (channelId: string) => void;
  onOpenVoiceChat: (channelId: string) => void;
  onInviteVoice: (channelId: string) => void;
  canInvite: boolean;
  activeVoiceChatChannelId: string | null;
  onCategorySettings: (categoryId: string) => void;
  onDragStart: (channelId: string) => void;
  onDrop: (beforeId: string | null) => void;
  channelDragging: boolean;
  dropTarget: {
    categoryId: string | null;
    beforeId: string | null;
    anchorId: string | null;
    edge: 'before' | 'after' | 'end';
  } | null;
  onDragTarget: (
    target: {
      categoryId: string | null;
      beforeId: string | null;
      anchorId: string | null;
      edge: 'before' | 'after' | 'end';
    } | null,
  ) => void;
  categoryDragging?: boolean;
  categoryDropTarget?: { id: string; edge: 'before' | 'after' } | null;
  onCategoryDragStart?: (categoryId: string) => void;
  onCategoryDragEnd?: () => void;
  onCategoryDragTarget?: (target: { id: string; edge: 'before' | 'after' } | null) => void;
  onCategoryDrop?: (targetId: string, edge: 'before' | 'after') => void;
  voiceSummaries: VoiceChannelSummary[];
  speakingConnectionIds: string[];
  unreadSummaries: ChannelUnreadSummary[];
  serverId: string;
  serverPublicId: string;
  onNotice: (notice: string) => void;
  onOpenVoiceParticipantProfile?:
    | ((participant: VoiceParticipant, anchor: HTMLElement) => void)
    | undefined;
  onOpenVoiceParticipantContextMenu?:
    | ((
        participant: VoiceParticipant,
        channelId: string,
        position: VoiceContextMenuPosition,
      ) => void)
    | undefined;
}) {
  return (
    <section
      className={`channel-group${category && categoryDropTarget?.id === category.id ? ` category-drop-${categoryDropTarget.edge}` : ''}${dropTarget?.categoryId === (category?.id ?? null) && dropTarget.edge === 'end' ? ' channel-drop-end' : ''}`}
      onDragOver={(event) => {
        if (!owner || !channelDragging) return;
        event.preventDefault();
        if (event.target === event.currentTarget) {
          onDragTarget({
            categoryId: category?.id ?? null,
            beforeId: null,
            anchorId: null,
            edge: 'end',
          });
        }
      }}
      onDrop={(event) => {
        if (event.target === event.currentTarget && channelDragging) {
          event.preventDefault();
          onDrop(null);
        }
      }}
    >
      {label && (
        <div
          className="channel-group-head"
          draggable={owner && Boolean(category)}
          onDragStart={(event) => {
            if (!category || !onCategoryDragStart) return;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/x-wapve-category', category.id);
            onCategoryDragStart(category.id);
          }}
          onDragEnd={onCategoryDragEnd}
          onDragOver={(event) => {
            if (!category || !categoryDragging || !onCategoryDragTarget) return;
            event.preventDefault();
            const bounds = event.currentTarget.getBoundingClientRect();
            onCategoryDragTarget({
              id: category.id,
              edge: event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after',
            });
          }}
          onDrop={(event) => {
            if (!category || !categoryDragging || !categoryDropTarget || !onCategoryDrop) return;
            event.preventDefault();
            event.stopPropagation();
            onCategoryDrop(category.id, categoryDropTarget.edge);
          }}
        >
          {owner && category && (
            <GripVertical className="category-drag-handle" size={13} aria-hidden="true" />
          )}
          <div className="channel-group-title">{label}</div>
          {owner && category && (
            <button
              className="category-settings-trigger"
              aria-label={`${label} ${messages.settings}`}
              onClick={() => onCategorySettings(category.id)}
            >
              <Settings size={13} />
            </button>
          )}
        </div>
      )}
      {channels.map((channel) => {
        const voiceParticipants =
          voiceSummaries.find((summary) => summary.channelId === channel.id)?.participants ?? [];
        const unread = unreadSummaries.find((summary) => summary.channelId === channel.id);
        return (
          <div className="channel-with-participants" key={channel.id}>
            <ChannelContextMenu
              serverId={serverId}
              channel={channel}
              messages={messages}
              canManage={owner || channel.permissions.MANAGE_CHANNELS}
              onSettings={() => onSettings(channel.id)}
              onInvite={() => onInviteVoice(channel.id)}
              onOpenChat={() => onOpenVoiceChat(channel.id)}
              serverPublicId={serverPublicId}
              canInvite={canInvite}
              onNotice={onNotice}
            >
              <div
                className={`channel-item-shell${selectedChannelId === channel.id ? ' active' : ''}${dropTarget?.anchorId === channel.id ? ` channel-drop-${dropTarget.edge}` : ''}`}
                draggable={owner}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  onDragStart(channel.id);
                }}
                onDragEnd={() => {
                  onDragStart('');
                  onDragTarget(null);
                }}
                onDragOver={(event) => {
                  if (!owner || !channelDragging) return;
                  event.preventDefault();
                  event.stopPropagation();
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const after = event.clientY >= bounds.top + bounds.height / 2;
                  const channelIndex = channels.findIndex((item) => item.id === channel.id);
                  const nextId = channels[channelIndex + 1]?.id ?? null;
                  onDragTarget({
                    categoryId: category?.id ?? null,
                    beforeId: after ? nextId : channel.id,
                    anchorId: channel.id,
                    edge: after ? 'after' : 'before',
                  });
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDrop(
                    dropTarget?.categoryId === (category?.id ?? null)
                      ? dropTarget.beforeId
                      : channel.id,
                  );
                }}
              >
                {owner && (
                  <GripVertical className="channel-drag-handle" size={14} aria-hidden="true" />
                )}
                <button
                  className="channel-item"
                  aria-current={selectedChannelId === channel.id ? 'page' : undefined}
                  onClick={() => onSelect(channel.id)}
                >
                  <span className={`channel-kind-icon${channel.nsfw ? ' age-restricted' : ''}`}>
                    {channel.type === 'TEXT' ? <Hash size={17} /> : <Headphones size={17} />}
                    {channel.nsfw && (
                      <span className="nsfw-channel-age-badge" aria-label="18+">
                        +18
                      </span>
                    )}
                  </span>
                  <span>{channel.name}</span>
                  {channel.type === 'TEXT' && (unread?.mentionCount ?? 0) > 0 ? (
                    <i className="channel-mention-badge" aria-hidden="true">
                      {unread!.mentionCount > 99 ? '99+' : unread!.mentionCount}
                    </i>
                  ) : channel.type === 'TEXT' && (unread?.unreadCount ?? 0) > 0 ? (
                    <i className="channel-unread-dot" aria-hidden="true" />
                  ) : null}
                </button>
                {channel.type === 'VOICE' && (
                  <button
                    className={`channel-settings-trigger channel-chat-trigger${
                      activeVoiceChatChannelId === channel.id ? ' active' : ''
                    }`}
                    aria-label={`${channel.name}: ${messages.openVoiceChannelChat}`}
                    aria-pressed={activeVoiceChatChannelId === channel.id}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenVoiceChat(channel.id);
                    }}
                  >
                    <MessageSquare size={14} />
                    {(unread?.unreadCount ?? 0) > 0 && (
                      <i className="channel-action-unread" aria-hidden="true" />
                    )}
                  </button>
                )}
                {canInvite && (
                  <button
                    className="channel-settings-trigger channel-invite-trigger"
                    aria-label={`${channel.name}: ${messages.inviteToChannel}`}
                    onClick={() => onInviteVoice(channel.id)}
                  >
                    <UserPlus size={14} />
                  </button>
                )}
                {(owner || channel.permissions.MANAGE_CHANNELS) && (
                  <button
                    className="channel-settings-trigger"
                    aria-label={`${channel.name} ${messages.settings}`}
                    onClick={() => onSettings(channel.id)}
                  >
                    <Settings size={14} />
                  </button>
                )}
              </div>
            </ChannelContextMenu>
            {channel.type === 'VOICE' && voiceParticipants.length > 0 && (
              <div className="voice-sidebar-participants">
                {deduplicateVoiceParticipants(voiceParticipants).map((participant) => (
                  <div
                    className={`voice-sidebar-user${
                      speakingConnectionIds.includes(participant.connectionId) ? ' speaking' : ''
                    }`}
                    key={participant.userId}
                    onClick={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      onOpenVoiceParticipantProfile?.(participant, event.currentTarget);
                    }}
                    onContextMenu={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      onOpenVoiceParticipantContextMenu?.(participant, channel.id, {
                        left: event.clientX,
                        top: event.clientY,
                      });
                    }}
                  >
                    <span
                      className="voice-sidebar-avatar"
                      aria-label={
                        speakingConnectionIds.includes(participant.connectionId)
                          ? messages.speaking
                          : undefined
                      }
                    >
                      {participant.avatarUrl ? (
                        <img src={participant.avatarUrl} alt="" />
                      ) : (
                        participant.displayName.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <span>{participant.displayName}</span>
                    {participant.muted && <MicOff size={12} />}
                    {participant.deafened && <VolumeX size={12} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {owner && channelDragging && channels.length === 0 && (
        <button
          className="empty-channel-drop"
          onDragOver={(event) => {
            if (!channelDragging) return;
            event.preventDefault();
            onDragTarget({
              categoryId: category?.id ?? null,
              beforeId: null,
              anchorId: null,
              edge: 'end',
            });
          }}
          onDrop={(event) => {
            event.preventDefault();
            onDrop(null);
          }}
        >
          {messages.dropChannelHere}
        </button>
      )}
    </section>
  );
}

function deduplicateVoiceParticipants(participants: VoiceParticipant[]): VoiceParticipant[] {
  return [
    ...new Map(participants.map((participant) => [participant.userId, participant])).values(),
  ];
}

function findMemberForVoiceParticipant(
  p: VoiceParticipant,
  membersList: ServerMember[],
): ServerMember {
  const found = membersList.find((m) => m.id === p.userId);
  if (found) return found;
  return {
    id: p.userId,
    publicId: '',
    username: p.username,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    status: 'OFFLINE',
    system: false,
    badges: [],
    role: 'MEMBER',
    joinedAt: new Date().toISOString(),
    timeoutUntil: null,
    timeoutReason: null,
    roles: [],
  };
}
