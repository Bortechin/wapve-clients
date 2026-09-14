import { TextInput, Modal, Text, Alert, Pressable } from '@/components/localized-native';
import { serverInviteUrl } from '@wapve/contracts';
import type {
  ChannelNotificationPreference,
  ChannelMessage,
  AcceptedServerInvite,
  ChannelTree,
  BlockedUser,
  DirectConversation,
  DirectMessage,
  DirectMessageContext,
  DirectMessagePage,
  ForwardTarget,
  Friend,
  FriendRequests,
  GifSearchResult,
  GroupMessage,
  GroupMessageContext,
  GroupMessagePage,
  GroupConversation,
  InternalMessagePreview,
  LinkPreview,
  MessagePage,
  MessageSource,
  MessageTarget,
  PlatformBadge,
  ScheduledMessage,
  ServerChannel,
  ServerMember,
  ServerInvite,
  ServerInvitePreview,
  ServerRole,
  ServerSummary,
  ServerEmoji,
} from '@wapve/contracts';
import { ApiError } from '@wapve/api-client';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import {
  findNodeHandle,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Share,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from '@/components/themed-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from '@/components/themed-native';
import { colors, motion, radius, spacing, touch, typography } from '@wapve/design-tokens';
import { api, mobileUploadWithProgress, realtime } from '@/lib/client';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { messagePreview, systemMessageLabel, type MobileMessage } from '@/lib/message-presentation';
import { Avatar, Button, ScreenHeader, SecureImage } from './ui';
import { Icon, type IconName } from './icon';
import { ChatDrawer } from './chat-drawer';
import { ConversationOptions } from './conversation-options';
import { VoiceMessagePlayer } from './voice-message-player';
import { rememberLastTextChannel } from '@/lib/last-text-channel';
import { rememberConversation } from '@/lib/conversation-history';
import { conversationScroll, rememberConversationScroll } from '@/lib/conversation-scroll';
import { EmojiPicker } from './emoji-picker';
import { PlatformBadges } from './platform-badges';
import { SwipeableSheetSurface } from './swipeable-sheet';
import { firstHttpUrl, parseMobileMessageLink } from '@/lib/message-links';
import { GroupManagementSheet } from './group-management-sheet';
import { DeepLinkState } from './deep-link-state';
import { ReportSheet, type ReportSubject } from './report-sheet';
import { confirmNsfw, hasConfirmedNsfw } from '@/lib/nsfw-confirmation';
import { loadVoicePreferences } from '@/lib/voice-preferences';
import { loadMessageDraft, saveMessageDraft } from '@/lib/message-drafts';
import { useDeveloperMode } from '@/lib/developer-mode';
import { evaluateComposerPolicy } from '@/lib/composer-policy';
import { ReacticxShimmer } from './reacticx-shimmer';
import { GameActivityLabel } from './game-activity';
import { ServerTagChip } from './server-tag';
import { availableCommands, parseServerCommand, commandUsage, type GameActivity } from '@wapve/contracts';
import { hasPremiumNameplate, PremiumNameplateBackground } from './premium-nameplate-background';
import {
  acceptMobileUploadCandidates,
  formatUploadBytes,
  MAX_MOBILE_ATTACHMENT_BYTES,
  MAX_MOBILE_ATTACHMENT_COUNT,
  type MobileUploadCandidate,
} from '@/lib/mobile-upload-queue';

type ThreadKind = 'channel' | 'direct' | 'group';
type AnyMessage = ChannelMessage | DirectMessage | GroupMessage;
type UploadAsset = {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  progress: number;
  status: 'queued' | 'uploading' | 'error';
};
type MentionAlias = {
  token: string;
  alternateTokens?: string[];
  label: string;
  kind: 'user' | 'channel' | 'role' | 'broadcast';
  category: 'Kişiler' | 'Roller' | 'Özel' | 'Kanallar';
  id: string;
  color?: string;
};
type Props = {
  kind: ThreadKind;
  title: string;
  conversationId?: string;
  serverId?: string;
  channelId?: string;
  initialMessageId?: string | undefined;
  rememberAsText?: boolean | undefined;
};

export function MessageThread({
  kind,
  title,
  conversationId,
  serverId,
  channelId,
  initialMessageId,
  rememberAsText = true,
}: Props) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { height } = useWindowDimensions();
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<UploadAsset[]>([]);
  const [sending, setSending] = useState(false);
  const [drawerSignal, setDrawerSignal] = useState(0);
  const [membersOpen, setMembersOpen] = useState(false);
  const [attachmentSheet, setAttachmentSheet] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [expressionPanel, setExpressionPanel] = useState(false);
  const [expressionTab, setExpressionTab] = useState<'emoji' | 'gif'>('emoji');
  const [gifTerm, setGifTerm] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<MobileMessage | null>(null);
  const [selectedMember, setSelectedMember] = useState<MemberItem | null>(null);
  const [replyTo, setReplyTo] = useState<MobileMessage | null>(null);
  const [mentionReplyAuthor, setMentionReplyAuthor] = useState(true);
  const [editMessage, setEditMessage] = useState<MobileMessage | null>(null);
  const [editValue, setEditValue] = useState('');
  const [chosenMentions, setChosenMentions] = useState<MentionAlias[]>([]);
  const [showJumpToPresent, setShowJumpToPresent] = useState(false);
  const [browserMode, setBrowserMode] = useState<'search' | 'pins' | null>(null);
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<MobileMessage | null>(null);
  const [contextMessages, setContextMessages] = useState<AnyMessage[]>([]);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [initialMessageError, setInitialMessageError] = useState(false);
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const [draftReady, setDraftReady] = useState(false);
  const [slowModeUntil, setSlowModeUntil] = useState(0);
  const [slowModeRemaining, setSlowModeRemaining] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const [sendError, setSendError] = useState('');
  const [nsfwReady, setNsfwReady] = useState(false);
  const [nsfwConfirmed, setNsfwConfirmed] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 100);
  const pressingRecord = useRef(false);
  const recordingStarted = useRef(false);
  const listRef = useRef<FlashListRef<AnyMessage>>(null);
  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const focused = useRef(false);
  const initialJumpHandled = useRef<string | null>(null);
  const typingSocket = useRef<Awaited<ReturnType<typeof realtime.connect>> | null>(null);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingExpiryTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const uploadControllers = useRef(new Map<string, AbortController>());
  const queryKey = ['messages', kind, conversationId ?? channelId];
  const draftKey = `${user?.id ?? 'guest'}:${kind}:${conversationId ?? `${serverId}:${channelId}`}`;
  useEffect(() => {
    if (kind === 'channel' && rememberAsText && serverId && channelId) {
      void rememberLastTextChannel(serverId, channelId, title.replace(/^#\s*/u, ''));
    }
  }, [channelId, kind, rememberAsText, serverId, title]);
  const path =
    kind === 'channel'
      ? `/servers/${serverId}/channels/${channelId}/messages?limit=50`
      : kind === 'direct'
        ? `/dm/conversations/${conversationId}/messages?limit=50`
        : `/dm/groups/${conversationId}/messages?limit=50`;
  const endpoint =
    kind === 'channel'
      ? `/servers/${serverId}/channels/${channelId}/messages`
      : kind === 'direct'
        ? `/dm/conversations/${conversationId}/messages`
        : `/dm/groups/${conversationId}/messages`;
  const attachmentEndpoint =
    kind === 'channel'
      ? `/servers/${serverId}/channels/${channelId}/messages/attachments`
      : kind === 'direct'
        ? `/dm/conversations/${conversationId}/attachments`
        : `/dm/groups/${conversationId}/attachments`;
  const readEndpoint =
    kind === 'channel'
      ? `${endpoint}/read`
      : kind === 'direct'
        ? `/dm/conversations/${conversationId}/read`
        : `/dm/groups/${conversationId}/read`;
  const unreadEndpoint =
    kind === 'channel'
      ? `${endpoint}/unread`
      : kind === 'direct'
        ? `/dm/conversations/${conversationId}/unread`
        : `/dm/groups/${conversationId}/unread`;
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      api.request<MessagePage | DirectMessagePage | GroupMessagePage>(
        `${path}${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const channelTree = useQuery({
    queryKey: ['channels', serverId],
    enabled: kind === 'channel' && Boolean(serverId),
    queryFn: () => api.request<ChannelTree>(`/servers/${serverId}/channels`),
  });
  const currentServer = useQuery({
    queryKey: ['server', serverId],
    enabled: kind === 'channel' && Boolean(serverId),
    queryFn: () => api.request<ServerSummary>(`/servers/${serverId}`),
  });
  const emojiServers = useQuery({
    queryKey: ['servers'],
    enabled: kind === 'channel' && Boolean(serverId),
    queryFn: () => api.request<ServerSummary[]>('/servers'),
    staleTime: 60_000,
  });
  const emojiServerIds = useMemo(
    () =>
      emojiServers.data
        ?.filter(
          (server) => server.id === serverId || server.permissions.includes('USE_EXTERNAL_EMOJIS'),
        )
        .map((server) => server.id) ?? [],
    [emojiServers.data, serverId],
  );
  const serverEmojis = useQuery({
    queryKey: ['server-emojis', emojiServerIds],
    enabled: emojiServerIds.length > 0,
    queryFn: async () =>
      (
        await Promise.all(
          emojiServerIds.map((id) => api.request<ServerEmoji[]>(`/servers/${id}/emojis`)),
        )
      ).flat(),
    staleTime: 60_000,
  });
  const serverMembers = useQuery({
    queryKey: ['server-members', serverId],
    enabled: kind === 'channel' && Boolean(serverId),
    queryFn: () => api.request<ServerMember[]>(`/servers/${serverId}/members`),
  });
  const directConversations = useQuery({
    queryKey: ['dm-conversations'],
    enabled: kind === 'direct',
    queryFn: () => api.request<DirectConversation[]>('/dm/conversations'),
  });
  const groupConversations = useQuery({
    queryKey: ['group-conversations'],
    enabled: kind === 'group',
    queryFn: () => api.request<GroupConversation[]>('/dm/groups'),
  });
  const currentChannel = channelTree.data?.channels.find((channel) => channel.id === channelId);
  useEffect(() => {
    if (!user?.id || !query.isSuccess || (kind === 'channel' && !rememberAsText)) return;
    void rememberConversation(user.id, { kind, serverId, channelId, conversationId }).catch(() => {});
  }, [user?.id, query.isSuccess, kind, serverId, channelId, conversationId, rememberAsText]);
  const currentMember = serverMembers.data?.find((member) => member.id === user?.id);
  const canManageMessages = Boolean(
    currentMember?.role === 'OWNER' ||
      currentMember?.roles.some((role) => role.permissions.includes('MANAGE_MESSAGES')),
  );
  const currentDirectConversation = directConversations.data?.find(
    (item) => item.id === conversationId,
  );
  const systemDirect = kind === 'direct' && Boolean(currentDirectConversation?.otherUser.system);
  const composerPolicy = evaluateComposerPolicy({
    kind,
    emailVerified: Boolean(user?.emailVerified),
    now: clock,
    isServerOwner: currentMember?.role === 'OWNER',
    timeoutUntil: currentMember?.timeoutUntil,
    channelCanSend: currentChannel?.permissions.SEND_MESSAGES,
    directCanMessage: currentDirectConversation?.canMessage,
    groupExists: groupConversations.data?.some((item) => item.id === conversationId),
  });
  const { canCompose, timeoutActive, timeoutUntil } = composerPolicy;
  const canAttach =
    canCompose && (kind !== 'channel' || Boolean(currentChannel?.permissions.ATTACH_FILES));
  const canUseGifs =
    canCompose && (kind !== 'channel' || Boolean(currentChannel?.permissions.USE_GIFS));
  const canCreatePolls =
    canCompose && kind === 'channel' && Boolean(currentChannel?.permissions.CREATE_POLLS);
  const canInteract =
    kind === 'channel' && !timeoutActive && Boolean(currentChannel?.permissions.ADD_REACTIONS);
  const canVote =
    kind === 'channel' &&
    !timeoutActive &&
    Boolean(user?.emailVerified && currentChannel?.permissions.VIEW_CHANNEL);
  const composerReason =
    composerPolicy.reason === 'EMAIL_UNVERIFIED'
      ? t('verifyToMessage') === 'verifyToMessage'
        ? 'Mesaj göndermek için e-postanı doğrula.'
        : t('verifyToMessage')
      : composerPolicy.reason === 'TIMEOUT' && timeoutUntil
        ? `Susturuldun. ${timeoutUntil.toLocaleString()} tarihine kadar mesaj veya etkileşim gönderemezsin.${currentMember?.timeoutReason ? ` · Neden: ${currentMember.timeoutReason}` : ''}`
        : composerPolicy.reason === 'MISSING_SEND_PERMISSION'
          ? t('cannotSendMessages') === 'cannotSendMessages'
            ? 'Bu kanalda mesaj gönderme yetkin yok.'
            : t('cannotSendMessages')
          : composerPolicy.reason === 'DIRECT_UNAVAILABLE'
            ? 'Bu kullanıcıya şu anda mesaj gönderemezsin.'
            : composerPolicy.reason === 'GROUP_UNAVAILABLE'
              ? 'Bu grup artık kullanılamıyor.'
              : null;
  const slowModeSeconds =
    kind === 'channel' && !canManageMessages ? (currentChannel?.slowModeSeconds ?? 0) : 0;
  const typingNames = useMemo(() => {
    const ids = [...typingUserIds];
    const people: MemberItem[] =
      kind === 'channel'
        ? (serverMembers.data ?? [])
        : kind === 'group'
          ? (groupConversations.data?.find((item) => item.id === conversationId)?.members ?? [])
          : [
              directConversations.data?.find((item) => item.id === conversationId)?.otherUser,
            ].filter((item): item is NonNullable<typeof item> => Boolean(item));
    return ids.map((id) => people.find((person) => person.id === id)?.displayName ?? 'Birisi');
  }, [
    conversationId,
    directConversations.data,
    groupConversations.data,
    kind,
    serverMembers.data,
    typingUserIds,
  ]);
  const mentionAliases = useMemo<MentionAlias[]>(() => {
    const members = serverMembers.data ?? [];
    const roleMap = new Map<string, ServerRole>();
    for (const member of members) {
      for (const role of member.roles) roleMap.set(role.id, { ...role, memberCount: 0 });
    }
    const currentMember = members.find((member) => member.id === user?.id);
    const canBroadcast =
      currentMember?.role === 'OWNER' ||
      currentMember?.roles.some((role) => role.permissions.includes('MENTION_EVERYONE'));
    return [
      ...members.map((member) => ({
        token: `<@${member.publicId}>`,
        alternateTokens: [`<@${member.id}>`],
        label: `@${member.displayName}`,
        kind: 'user' as const,
        category: 'Kişiler' as const,
        id: member.id,
      })),
      ...[...roleMap.values()]
        .filter((role) => !role.isEveryone && (role.mentionable || canBroadcast))
        .sort((left, right) => right.position - left.position)
        .map((role) => ({
          token: `<@${role.id}>`,
          label: `@${role.name.replace(/^@/u, '')}`,
          kind: 'role' as const,
          category: 'Roller' as const,
          id: role.id,
          color: role.color,
        })),
      ...(canBroadcast
        ? [
            {
              token: '@weryone',
              label: '@weryone',
              kind: 'broadcast' as const,
              category: 'Özel' as const,
              id: 'weryone',
            },
            {
              token: '@wave',
              label: '@wave',
              kind: 'broadcast' as const,
              category: 'Özel' as const,
              id: 'wave',
            },
          ]
        : []),
      ...(channelTree.data?.channels ?? []).map((channel) => ({
        token: `<#${channel.publicId}>`,
        alternateTokens: [`<#${channel.id}>`],
        label: channel.type === 'VOICE' ? `🎧 ${channel.name}` : `#${channel.name}`,
        kind: 'channel' as const,
        category: 'Kanallar' as const,
        id: channel.id,
      })),
    ];
  }, [channelTree.data?.channels, serverMembers.data, user?.id]);
  const activeMention = useMemo(() => {
    if (kind !== 'channel') return null;
    const match = content.match(/(?:^|\s)([@#])([^@#\s]*)$/u);
    if (!match) return null;
    const needle = (match[2] ?? '').toLocaleLowerCase('tr');
    const requestedKind = match[1] === '@' ? 'people' : 'channel';
    return {
      start: content.length - match[0].trimStart().length,
      items: mentionAliases
        .filter(
          (alias) =>
            (requestedKind === 'channel' ? alias.kind === 'channel' : alias.kind !== 'channel') &&
            alias.label.replace(/^[@#]/u, '').toLocaleLowerCase('tr').includes(needle),
        )
        .slice(0, 15),
    };
  }, [content, kind, mentionAliases]);
  const items = useMemo(() => {
    const merged = new Map<string, AnyMessage>();
    for (const page of query.data?.pages ?? []) {
      for (const item of page.items as AnyMessage[]) merged.set(item.id, item);
    }
    for (const item of contextMessages) merged.set(item.id, item);
    return [...merged.values()]
      .filter((item) => !item.deleted)
      .sort((left, right) =>
        right.createdAt === left.createdAt
          ? right.id.localeCompare(left.id)
          : new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );
  }, [contextMessages, query.data?.pages]);
  const lastReadAt = query.data?.pages[0]?.lastReadAt;

  useEffect(() => {
    let active = true;
    setDraftReady(false);
    setContent('');
    void loadMessageDraft(draftKey).then((draft) => {
      if (!active) return;
      setContent(draft);
      setDraftReady(true);
    });
    return () => {
      active = false;
    };
  }, [draftKey]);

  useEffect(() => {
    if (!draftReady) return;
    const timer = setTimeout(() => {
      void saveMessageDraft(draftKey, content);
    }, 350);
    return () => clearTimeout(timer);
  }, [content, draftKey, draftReady]);

  useEffect(() => {
    if (!slowModeUntil) {
      setSlowModeRemaining(0);
      return;
    }
    const update = () =>
      setSlowModeRemaining(Math.max(0, Math.ceil((slowModeUntil - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 500);
    return () => clearInterval(timer);
  }, [slowModeUntil]);
  useEffect(() => {
    if (!timeoutUntil || timeoutUntil.getTime() <= Date.now()) return;
    const timer = setInterval(() => setClock(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [currentMember?.timeoutUntil, timeoutUntil]);
  useEffect(() => {
    let active = true;
    setNsfwReady(false);
    setNsfwConfirmed(false);
    if (kind !== 'channel' || !currentChannel || !user) return;
    if (!currentChannel.nsfw) {
      setNsfwConfirmed(true);
      setNsfwReady(true);
      return;
    }
    void hasConfirmedNsfw(user.id, currentChannel.id).then((confirmed) => {
      if (!active) return;
      setNsfwConfirmed(confirmed);
      setNsfwReady(true);
    });
    return () => {
      active = false;
    };
  }, [currentChannel, kind, user]);
  useEffect(() => {
    if (canCompose) return;
    setAttachmentSheet(false);
    setExpressionPanel(false);
    setPollOpen(false);
    setScheduleOpen(false);
    stopTyping();
  }, [canCompose]);
  const gifs = useQuery({
    queryKey: ['gifs', gifTerm],
    enabled: expressionPanel && expressionTab === 'gif' && canUseGifs,
    queryFn: () =>
      api.request<{ items: GifSearchResult[] }>(
        `/gifs/search?q=${encodeURIComponent(gifTerm)}&locale=tr&limit=20`,
      ),
  });

  const markRead = useCallback(async () => {
    await api.request(readEndpoint, { method: 'POST' });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['channel-unread'] }),
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] }),
      queryClient.invalidateQueries({ queryKey: ['group-conversations'] }),
    ]);
  }, [queryClient, readEndpoint]);

  const markUnread = useCallback(async () => {
    await api.request(unreadEndpoint, { method: 'POST' });
    setSelectedMessage(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['channel-unread'] }),
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] }),
      queryClient.invalidateQueries({ queryKey: ['group-conversations'] }),
    ]);
  }, [queryClient, unreadEndpoint]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      void markRead();
      return () => {
        focused.current = false;
      };
    }, [markRead]),
  );

  useEffect(() => {
    if (query.data && focused.current) void markRead();
  }, [markRead, query.data]);

  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | undefined;
    void realtime.connect(kind === 'channel' ? '/chat' : '/dm').then((socket) => {
      if (!active) return;
      typingSocket.current = socket;
      if (kind === 'channel' && channelId) socket.emit('channel:join', { channelId });
      const events =
        kind === 'channel'
          ? ['message:created', 'message:updated', 'message:deleted', 'message:reaction']
          : kind === 'direct'
            ? ['dm:created', 'dm:updated', 'dm:deleted']
            : ['group:created', 'group:updated', 'group:deleted'];
      const changed = (message: AnyMessage) => {
        const matches =
          kind === 'channel'
            ? 'channelId' in message && message.channelId === channelId
            : 'conversationId' in message && message.conversationId === conversationId;
        if (matches) {
          void queryClient.invalidateQueries({ queryKey });
          if (focused.current) void markRead();
        }
      };
      const typingChanged = (update: {
        userId: string;
        channelId?: string;
        conversationId?: string;
        active?: boolean;
      }) => {
        if (update.userId === user?.id) return;
        const matches =
          kind === 'channel'
            ? update.channelId === channelId
            : update.conversationId === conversationId;
        if (!matches) return;
        const currentTimer = typingExpiryTimers.current.get(update.userId);
        if (currentTimer) clearTimeout(currentTimer);
        if (update.active === false) {
          typingExpiryTimers.current.delete(update.userId);
          setTypingUserIds((current) => {
            const next = new Set(current);
            next.delete(update.userId);
            return next;
          });
          return;
        }
        setTypingUserIds((current) => new Set(current).add(update.userId));
        const timer = setTimeout(() => {
          typingExpiryTimers.current.delete(update.userId);
          setTypingUserIds((current) => {
            const next = new Set(current);
            next.delete(update.userId);
            return next;
          });
        }, 3_500);
        typingExpiryTimers.current.set(update.userId, timer);
      };
      for (const event of events) socket.on(event, changed);
      socket.on('typing:update', typingChanged);
      cleanup = () => {
        for (const event of events) socket.off(event, changed);
        socket.off('typing:update', typingChanged);
      };
    });
    return () => {
      active = false;
      typingSocket.current = null;
      if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
      typingExpiryTimers.current.forEach((timer) => clearTimeout(timer));
      typingExpiryTimers.current.clear();
      cleanup?.();
    };
  }, [channelId, conversationId, kind, markRead, queryClient, user?.id]);

  function stopTyping() {
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    typingStopTimer.current = null;
    if (kind !== 'channel' && conversationId) {
      typingSocket.current?.emit('typing:stop', { conversationId, kind });
    }
  }

  function changeContent(value: string) {
    setContent(value);
    const socket = typingSocket.current;
    if (!socket || !value.trim()) {
      stopTyping();
      return;
    }
    if (kind === 'channel' && channelId) socket.emit('typing:start', { channelId });
    if (kind !== 'channel' && conversationId) {
      socket.emit('typing:start', { conversationId, kind });
      if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
      typingStopTimer.current = setTimeout(stopTyping, 1_800);
    }
  }

  async function sendPayload(body: Record<string, unknown>) {
    await api.request(endpoint, { method: 'POST', body });
    await query.refetch();
    if (slowModeSeconds) setSlowModeUntil(Date.now() + slowModeSeconds * 1_000);
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
  }
  async function send(onlyAttachmentId?: string) {
    const trimmed = content.trim();
    if (!canCompose || (!trimmed && attachments.length === 0) || sending || slowModeRemaining > 0)
      return;
    setSending(true);
    setSendError('');
    try {
      if (kind === 'channel' && serverId && trimmed.startsWith('/')) {
        const command = parseServerCommand(canonicalizeMentions(trimmed, chosenMentions), currentServer.data?.permissions ?? [], serverMembers.data ?? [], locale);
        if (command.kind === 'help') {
          Alert.alert('/help', availableCommands(currentServer.data?.permissions ?? []).map(item => commandUsage(item.usage, locale)).join('\n'));
        } else {
          await api.request(`/servers/${serverId}/${command.path}`, { method: command.method as 'POST' | 'PATCH', body: command.body });
          await Promise.all(['server-members', 'server-audit', 'server-bans'].map(root => queryClient.invalidateQueries({ queryKey: [root, serverId] })));
          Alert.alert(locale === 'tr' ? 'İşlem tamamlandı' : 'Action completed');
        }
        setContent('');
        setChosenMentions([]);
        return;
      }
      if (attachments.length > 0) {
        let contentSent = false;
        const pendingAttachments = onlyAttachmentId
          ? attachments.filter((attachment) => attachment.id === onlyAttachmentId)
          : attachments;
        for (const attachment of pendingAttachments) {
          const controller = new AbortController();
          uploadControllers.current.set(attachment.id, controller);
          setAttachments((current) =>
            current.map((item) =>
              item.id === attachment.id ? { ...item, status: 'uploading', progress: 0 } : item,
            ),
          );
          const params = new URLSearchParams();
          if (!contentSent && trimmed)
            params.set('content', canonicalizeMentions(trimmed, chosenMentions));
          if (!contentSent && replyTo) {
            params.set('replyToId', replyTo.id);
            params.set('mentionReplyAuthor', String(mentionReplyAuthor));
          }
          try {
            await mobileUploadWithProgress(
              `${attachmentEndpoint}?${params.toString()}`,
              attachment.uri,
              attachment.name,
              (progress) =>
                setAttachments((current) =>
                  current.map((item) => (item.id === attachment.id ? { ...item, progress } : item)),
                ),
              controller.signal,
            );
            contentSent = true;
            setAttachments((current) => current.filter((item) => item.id !== attachment.id));
            if (trimmed) setContent('');
            setReplyTo(null);
            setChosenMentions([]);
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') break;
            setAttachments((current) =>
              current.map((item) =>
                item.id === attachment.id ? { ...item, status: 'error' } : item,
              ),
            );
            setSendError('Dosya yüklenemedi. Hata simgeli dosyaya dokunup yeniden deneyebilirsin.');
            break;
          } finally {
            uploadControllers.current.delete(attachment.id);
          }
        }
        await query.refetch();
        requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
        if (contentSent && slowModeSeconds) setSlowModeUntil(Date.now() + slowModeSeconds * 1_000);
      } else {
        await sendPayload({
          content: canonicalizeMentions(trimmed, chosenMentions),
          ...(replyTo ? { replyToId: replyTo.id, mentionReplyAuthor } : {}),
        });
        setContent('');
        setChosenMentions([]);
        setReplyTo(null);
      }
      stopTyping();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SLOWMODE_ACTIVE') {
        const retryAfter = Number(
          (error.details as { retryAfter?: number } | undefined)?.retryAfter ?? slowModeSeconds,
        );
        setSlowModeUntil(Date.now() + Math.max(1, retryAfter) * 1_000);
        setSendError(
          `Yavaş mod etkin. ${Math.max(1, retryAfter)} saniye sonra tekrar gönderebilirsin.`,
        );
      } else {
        setSendError('Mesaj gönderilemedi. İçeriğin taslaklarda tutuldu; tekrar deneyebilirsin.');
      }
    } finally {
      setSending(false);
    }
  }
  function cancelUpload(id: string) {
    uploadControllers.current.get(id)?.abort();
    uploadControllers.current.delete(id);
    setAttachments((current) => current.filter((item) => item.id !== id));
  }
  function queueAssets(candidates: MobileUploadCandidate[]) {
    const result = acceptMobileUploadCandidates(attachments, candidates);
    if (result.accepted.length) {
      const queuedAt = Date.now();
      setAttachments((current) => [
        ...current,
        ...result.accepted.map((asset, index) => ({
          id: `${queuedAt}-${asset.uri}-${index}-${Math.random()}`,
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType,
          ...(typeof asset.size === 'number' ? { size: asset.size } : {}),
          progress: 0,
          status: 'queued' as const,
        })),
      ]);
    }
    const oversized = result.rejected.find((item) => item.reason === 'too-large');
    if (oversized) {
      setSendError(t('uploadTooLarge', { name: oversized.candidate.name }));
    } else if (result.rejected.some((item) => item.reason === 'queue-full')) {
      setSendError(t('uploadLimit', { count: MAX_MOBILE_ATTACHMENT_COUNT }));
    } else if (result.rejected.length) {
      setSendError('Aynı dosya zaten yükleme kuyruğunda.');
    }
  }
  function showPermissionHelp(kind: 'camera' | 'media') {
    Alert.alert(
      kind === 'camera' ? 'Kamera izni gerekli' : 'Fotoğraf izni gerekli',
      kind === 'camera'
        ? 'Fotoğraf veya video çekmek için Wapve’ye kamera izni ver.'
        : 'Fotoğraf ve video seçmek için Wapve’ye medya izni ver.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Ayarları aç', onPress: () => void Linking.openSettings() },
      ],
    );
  }
  async function pickFiles() {
    if (!canAttach) return;
    setAttachmentSheet(false);
    setSendError('');
    try {
      const selection = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!selection.canceled)
        queueAssets(
          selection.assets.map((asset) => ({
            uri: asset.uri,
            name: asset.name,
            mimeType: asset.mimeType ?? 'application/octet-stream',
            ...(typeof asset.size === 'number' ? { size: asset.size } : {}),
          })),
        );
    } catch {
      setSendError(
        'Dosya seçici açılamadı. Depolama erişimini kontrol edip tekrar deneyebilirsin.',
      );
    }
  }
  async function pickPhotos(camera: boolean) {
    if (!canAttach) return;
    setAttachmentSheet(false);
    setSendError('');
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setSendError('Fotoğraf çekmek için kamera izni vermelisin.');
          showPermissionHelp('camera');
          return;
        }
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.88 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            allowsMultipleSelection: true,
            quality: 0.88,
          });
      if (!result.canceled)
        queueAssets(
          result.assets.map((asset, index) => ({
            uri: asset.uri,
            name:
              asset.fileName ??
              `wapve-${Date.now()}-${index}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
            mimeType: asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
            ...(typeof asset.fileSize === 'number' ? { size: asset.fileSize } : {}),
          })),
        );
    } catch {
      setSendError(
        camera
          ? 'Kamera açılamadı. İzni ve cihaz kamerasını kontrol edip tekrar deneyebilirsin.'
          : 'Fotoğraf seçici açılamadı. Tekrar deneyebilirsin.',
      );
    }
  }
  async function sendGif(gifToken: string) {
    if (!canUseGifs) return;
    setSending(true);
    try {
      await sendPayload({
        gifToken,
        ...(replyTo ? { replyToId: replyTo.id, mentionReplyAuthor } : {}),
      });
      setExpressionPanel(false);
      setReplyTo(null);
      stopTyping();
      requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
    } finally {
      setSending(false);
    }
  }
  async function createPoll(question: string, options: string[], durationMinutes: number) {
    if (!canCreatePolls) return;
    await api.request(`${endpoint}/polls`, {
      method: 'POST',
      body: { question, options, durationMinutes },
    });
    setPollOpen(false);
    await query.refetch();
  }
  async function scheduleMessage(value: string, scheduledFor: Date) {
    if (!canCompose) return;
    const target =
      kind === 'channel'
        ? { kind: 'CHANNEL' as const, serverId: serverId!, channelId: channelId! }
        : {
            kind: kind === 'direct' ? ('DIRECT' as const) : ('GROUP' as const),
            conversationId: conversationId!,
          };
    await api.request('/message-delivery/scheduled', {
      method: 'POST',
      body: {
        target,
        content: canonicalizeMentions(value.trim(), chosenMentions),
        scheduledFor: scheduledFor.toISOString(),
      },
    });
    setContent('');
    setScheduleOpen(false);
  }
  async function startVoiceRecording() {
    if (!canAttach) return;
    try {
      setRecordError(null);
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setRecordError('Sesli mesaj için mikrofon izni gerekli.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (!pressingRecord.current) {
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        return;
      }
      recorder.record();
      recordingStarted.current = true;
      setRecording(true);
    } catch {
      setRecordError('Mikrofon hazırlanamadı. Tekrar deneyebilirsin.');
    }
  }
  async function stopVoiceRecording() {
    if (!recordingStarted.current) return;
    recordingStarted.current = false;
    setRecording(false);
    try {
      const durationMillis = recorder.getStatus().durationMillis;
      await recorder.stop();
      const uri = recorder.getStatus().url ?? recorder.uri;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!uri || durationMillis < 350) return;
      setSending(true);
      await mobileUploadWithProgress(
        attachmentEndpoint,
        uri,
        `wapve-sesli-mesaj-${Date.now()}.m4a`,
        () => undefined,
      );
      await query.refetch();
      requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setRecordError(
        `Sesli mesaj gönderilemedi.${code ? ` (${code})` : ''} Tekrar deneyebilirsin.`,
      );
    } finally {
      setSending(false);
    }
  }
  function openExpressions() {
    if (!canCompose) return;
    Keyboard.dismiss();
    setExpressionPanel((current) => !current);
  }
  function selectMention(alias: MentionAlias) {
    if (!activeMention) return;
    setContent(`${content.slice(0, activeMention.start)}${alias.label} `);
    setChosenMentions((current) =>
      current.some((item) => item.token === alias.token) ? current : [...current, alias],
    );
  }
  async function updateSelectedMessage() {
    if (!editMessage || !editValue.trim()) return;
    await api.request(`${endpoint}/${editMessage.id}`, {
      method: 'PATCH',
      body: { content: canonicalizeMentions(editValue.trim(), mentionAliases) },
    });
    setEditMessage(null);
    setEditValue('');
    await query.refetch();
  }
  async function deleteSelectedMessage(message: MobileMessage) {
    if (kind === 'channel' && message.author?.id !== user?.id && !canManageMessages) return;
    await api.request(`${endpoint}/${message.id}`, { method: 'DELETE' });
    setSelectedMessage(null);
    await query.refetch();
  }
  async function togglePin(message: MobileMessage) {
    if (kind !== 'channel' || !canManageMessages) return;
    const pinned = 'pinned' in message && message.pinned;
    await api.request(`${endpoint}/${message.id}/pin`, { method: pinned ? 'DELETE' : 'POST' });
    setSelectedMessage(null);
    await query.refetch();
  }
  async function reactToMessage(message: MobileMessage, emoji: string) {
    if (!canInteract || !('reactions' in message)) return;
    const current = message.reactions.find((reaction) => reaction.emoji === emoji);
    await api.request(`${endpoint}/${message.id}/reactions`, {
      method: current?.reactedByMe ? 'DELETE' : 'POST',
      body: { emoji },
    });
    setSelectedMessage(null);
    await query.refetch();
  }
  async function voteOnPoll(message: MobileMessage, choiceId: string) {
    if (!canVote || !('poll' in message) || !message.poll) return;
    await api.request(`${endpoint}/${message.id}/poll-votes`, {
      method: 'POST',
      body: { choiceId },
    });
    await query.refetch();
  }

  async function jumpToMessage(messageId: string, initial = false) {
    try {
      let found = items.some((item) => item.id === messageId);
      if (!found) {
        if (kind === 'channel') {
          const context = await api.request<ChannelMessage[]>(`${endpoint}/${messageId}/context`);
          found = context.some((item) => item.id === messageId);
          setContextMessages(context);
        } else if (kind === 'direct') {
          const context = await api.request<DirectMessageContext>(
            `/dm/conversations/${conversationId}/messages/${messageId}/context`,
          );
          found = context.items.some((item) => item.id === messageId);
          setContextMessages(context.items);
        } else {
          const context = await api.request<GroupMessageContext>(
            `/dm/groups/${conversationId}/messages/${messageId}/context`,
          );
          found = context.items.some((item) => item.id === messageId);
          setContextMessages(context.items);
        }
      }
      if (!found) throw new Error('MESSAGE_NOT_FOUND');
      setInitialMessageError(false);
      setHighlightedMessageId(messageId);
      setBrowserMode(null);
    } catch {
      if (initial) setInitialMessageError(true);
      else
        Alert.alert(
          'Mesaj açılamadı',
          'Mesaj silinmiş olabilir veya artık bu mesaja erişimin olmayabilir.',
        );
    }
  }

  useEffect(() => {
    if (!highlightedMessageId) return;
    const index = items.findIndex((item) => item.id === highlightedMessageId);
    if (index < 0) return;
    const scrollTimer = setTimeout(() => {
      void listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    }, 80);
    const clearTimer = setTimeout(() => setHighlightedMessageId(null), 3_000);
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [highlightedMessageId, items]);

  useEffect(() => {
    if (!initialMessageId || initialJumpHandled.current === initialMessageId) return;
    initialJumpHandled.current = initialMessageId;
    void jumpToMessage(initialMessageId, true);
  }, [initialMessageId]);

  if (initialMessageError) {
    return (
      <DeepLinkState
        icon="message-off-outline"
        title={t('errors.messageNotFound')}
        body={t('errors.messageNotFound')}
        primary={{
          label: 'Konuşmaya dön',
          action: () => {
            setInitialMessageError(false);
            initialJumpHandled.current = null;
          },
        }}
        secondary={{ label: 'Wapve’ye dön', action: () => router.replace('/(tabs)') }}
      />
    );
  }

  if (kind === 'channel' && currentChannel?.nsfw && !nsfwReady) {
    return (
      <DeepLinkState
        loading
        title="Yaş sınırlaması kontrol ediliyor"
        body="Kanal tercihin güvenli biçimde yükleniyor…"
      />
    );
  }
  if (kind === 'channel' && currentChannel?.nsfw && !nsfwConfirmed && user) {
    return (
      <DeepLinkState
        icon="alert-octagon-outline"
        title="Yaş sınırlı kanal"
        body="Bu kanal +18 içerik için işaretlenmiştir. Devam ederek en az 18 yaşında olduğunu onaylarsın. Bu tercih yalnızca bu kanal için cihazında saklanır."
        primary={{
          label: '18 yaşındayım, devam et',
          action: () => {
            void confirmNsfw(user.id, currentChannel.id).then(() => setNsfwConfirmed(true));
          },
        }}
        secondary={{ label: 'Kanaldan çık', action: () => router.back() }}
      />
    );
  }

  const socialCall = async (mode: 'audio' | 'video') => {
    if (systemDirect) return;
    const target = {
      kind: kind as 'direct' | 'group',
      conversationId: conversationId!,
      mode,
      title,
    };
    const preferences = await loadVoicePreferences();
    router.push({
      pathname:
        mode === 'video' && preferences.previewCamera
          ? '/call/setup'
          : '/call/[kind]/[conversationId]',
      params: target,
    });
  };
  const headerActions =
    kind === 'channel' ? (
      <View style={styles.headerActions}>
        <Pressable
          style={styles.iconButton}
          onPress={() => setBrowserMode('search')}
          accessibilityLabel="Mesajlarda ara"
        >
          <Icon name="magnify" color={colors.textMuted} size={24} />
        </Pressable>
        <Pressable
          style={styles.iconButton}
          onPress={() => setBrowserMode('pins')}
          accessibilityLabel="Sabitlenen mesajlar"
        >
          <Icon name="pin-outline" color={colors.textMuted} size={23} />
        </Pressable>
      </View>
    ) : (
      <View style={styles.headerActions}>
        <Pressable
          style={styles.iconButton}
          onPress={() => setBrowserMode('search')}
          accessibilityLabel="Mesajlarda ara"
        >
          <Icon name="magnify" color={colors.textMuted} size={24} />
        </Pressable>
        {!systemDirect ? (
          <>
            <Pressable
              testID="message.call.audio"
              style={styles.iconButton}
              onPress={() => void socialCall('audio')}
              accessibilityLabel={t('call')}
            >
              <Icon name="phone-outline" color={colors.waveBright} size={24} />
            </Pressable>
            <Pressable
              testID="message.call.video"
              style={styles.iconButton}
              onPress={() => void socialCall('video')}
              accessibilityLabel="Görüntülü ara"
            >
              <Icon name="video-outline" color={colors.waveBright} size={25} />
            </Pressable>
          </>
        ) : null}
      </View>
    );
  return (
    <ChatDrawer
      openSignal={drawerSignal}
      initialServerId={serverId}
      initialChannelId={kind === 'channel' ? channelId : undefined}
      openFromAnywhere
      swipeEnabled={
        !inputFocused && !content.trim() && !recording && !expressionPanel && !attachmentSheet
      }
    >
      <SafeAreaView
        style={styles.root}
        edges={['top']}
        onTouchStart={(event) => {
          if (inputFocused && Number(event.nativeEvent.target) !== findNodeHandle(inputRef.current))
            Keyboard.dismiss();
        }}
      >
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ScreenHeader
            title={title}
            titleLeading={kind === 'direct' && currentDirectConversation ? <Avatar name={currentDirectConversation.otherUser.displayName} uri={currentDirectConversation.otherUser.avatarUrl} size={30} status={currentDirectConversation.otherUser.status} /> : undefined}
            titleAccessory={
              kind === 'channel' && currentChannel?.nsfw ? (
                <View style={styles.headerNsfwBadge} accessibilityLabel={t('ageRestrictedChannel')}>
                  <Text style={styles.headerNsfwText}>18+</Text>
                </View>
              ) : undefined
            }
            onTitlePress={() => { Keyboard.dismiss(); setMembersOpen(true); }}
            titleAccessibilityLabel={
              kind === 'channel' ? `${title}, kanal ayrıntılarını aç` : undefined
            }
            left={
              <Pressable
                style={styles.iconButton}
                onPress={() => setDrawerSignal((value) => value + 1)}
                accessibilityLabel="Sohbet çekmecesini aç"
              >
                <Icon name="menu" color={colors.text} size={27} />
              </Pressable>
            }
            right={headerActions}
          />
          <FlashList
            key={draftKey}
            ref={listRef}
            onLoad={() => {
              if (!initialMessageId) listRef.current?.scrollToOffset({ offset: conversationScroll(draftKey), animated: false });
            }}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            onTouchStart={() => {
              if (inputFocused) Keyboard.dismiss();
            }}
            data={items}
            inverted
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            scrollEventThrottle={32}
            onEndReachedThreshold={0.35}
            onEndReached={() => {
              if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
            }}
            onScroll={(event) => {
              rememberConversationScroll(draftKey, event.nativeEvent.contentOffset.y);
              setShowJumpToPresent(
                event.nativeEvent.contentOffset.y > Math.max(1_600, height * 2.2),
              );
            }}
            renderItem={({ item, index }) => {
              const previous = items[index + 1];
              const system = systemMessageLabel(item as MobileMessage);
              const dayBoundary = !previous || !sameDay(item.createdAt, previous.createdAt);
              const firstUnread = Boolean(
                lastReadAt &&
                  new Date(item.createdAt).getTime() > new Date(lastReadAt).getTime() &&
                  (!previous ||
                    new Date(previous.createdAt).getTime() <= new Date(lastReadAt).getTime()),
              );
              const compact = Boolean(
                previous &&
                  !dayBoundary &&
                  !firstUnread &&
                  !systemMessageLabel(previous as MobileMessage) &&
                  previous.author?.id === item.author?.id &&
                  Math.abs(
                    new Date(item.createdAt).getTime() - new Date(previous.createdAt).getTime(),
                  ) < 300_000,
              );
              return (
                <View>
                  {dayBoundary ? <DaySeparator value={item.createdAt} /> : null}
                  {firstUnread ? <NewMessagesSeparator /> : null}
                  {system ? (
                    <SystemMessage label={system} />
                  ) : (
                    <MessageRow
                      item={item as MobileMessage}
                      compact={compact}
                      highlighted={item.id === highlightedMessageId}
                      aliases={mentionAliases}
                      serverId={serverId}
                      customEmojis={serverEmojis.data ?? []}
                      onReact={(emoji) => void reactToMessage(item as MobileMessage, emoji)}
                      onPollVote={(choiceId) => void voteOnPoll(item as MobileMessage, choiceId)}
                      canVote={canVote}
                      canReply={canCompose}
                      onSwipeReply={() => {
                        setReplyTo(item as MobileMessage);
                        setExpressionPanel(false);
                        setTimeout(() => inputRef.current?.focus(), 120);
                      }}
                      onLongPress={() => setSelectedMessage(item as MobileMessage)}
                      onAuthorPress={() => item.author && setSelectedMember(item.author)}
                    />
                  )}
                </View>
              );
            }}
            ListFooterComponent={
              query.isFetchingNextPage ? (
                <Text style={styles.loadingOlder}>Eski mesajlar yükleniyor…</Text>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Icon name="message-text-outline" color={colors.waveBright} size={40} />
                </View>
                <Text style={styles.emptyTitle}>{title}</Text>
                <Text style={styles.emptyBody}>İlk dalgayı sen gönder.</Text>
              </View>
            }
          />
          {showJumpToPresent ? (
            <Pressable
              style={styles.jumpToPresent}
              onPress={() => {
                listRef.current?.scrollToOffset({ offset: 0, animated: true });
                setShowJumpToPresent(false);
              }}
            >
              <Icon name="chevron-down" color={colors.text} size={20} />
              <Text style={styles.jumpToPresentText}>Günümüze git</Text>
            </Pressable>
          ) : null}
          {attachments.length > 0 ? (
            <ScrollView
              horizontal
              style={styles.uploadQueueScroll}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.uploadQueue}
            >
              {attachments.map((attachment) => (
                <View
                  key={attachment.id}
                  style={[
                    styles.uploadItem,
                    attachment.status === 'error' && styles.uploadItemError,
                  ]}
                >
                  {attachment.mimeType.startsWith('image/') ? (
                    <Image
                      source={{ uri: attachment.uri }}
                      style={styles.uploadThumbnail}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.uploadFileIcon}>
                      <Icon
                        name={
                          attachment.mimeType.startsWith('video/')
                            ? 'play-circle-outline'
                            : 'file-outline'
                        }
                        color={colors.cyan}
                        size={21}
                      />
                    </View>
                  )}
                  <View style={styles.uploadCopy}>
                    <Text style={styles.uploadName} numberOfLines={1}>
                      {attachment.name}
                    </Text>
                    <Text
                      style={[
                        styles.uploadMeta,
                        attachment.status === 'error' && styles.uploadMetaError,
                      ]}
                      numberOfLines={1}
                    >
                      {attachment.status === 'uploading'
                        ? t('uploadProgress', { percent: Math.round(attachment.progress * 100) })
                        : attachment.status === 'error'
                          ? 'Yüklenemedi · yeniden dene'
                          : (formatUploadBytes(attachment.size) ??
                            `En fazla ${formatUploadBytes(MAX_MOBILE_ATTACHMENT_BYTES)}`)}
                    </Text>
                  </View>
                  {attachment.status === 'uploading' ? (
                    <ReacticxShimmer loading style={styles.uploadProgressTrack}>
                      <View
                        style={[
                          styles.uploadProgressFill,
                          { width: `${Math.round(attachment.progress * 100)}%` },
                        ]}
                      />
                    </ReacticxShimmer>
                  ) : attachment.status === 'error' ? (
                    <Pressable
                      style={styles.retryUpload}
                      onPress={() => void send(attachment.id)}
                      accessibilityLabel={`${attachment.name} yüklemesini yeniden dene`}
                    >
                      <Icon name="refresh" color={colors.warning} size={19} />
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={styles.removeUpload}
                    accessibilityLabel={`${attachment.name} dosyasını kaldır`}
                    onPress={() => cancelUpload(attachment.id)}
                  >
                    <Icon name="close" color={colors.danger} size={19} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : null}
          {recordError ? <Text style={styles.recordError}>{recordError}</Text> : null}
          {sendError ? <Text style={styles.recordError}>{sendError}</Text> : null}
          {composerReason ? (
            <View style={styles.composerGateNotice}>
              <Icon
                name={timeoutActive ? 'clock-alert-outline' : 'lock-outline'}
                color={timeoutActive ? colors.warning : colors.textDim}
                size={18}
              />
              <Text style={styles.composerGateText}>{composerReason}</Text>
            </View>
          ) : null}
          {slowModeRemaining > 0 ? (
            <View style={styles.slowModeNotice}>
              <Icon name="timer-sand" color={colors.warning} size={17} />
              <Text style={styles.slowModeText}>
                Yavaş mod: yeni mesaj için {slowModeRemaining} sn bekle.
              </Text>
            </View>
          ) : null}
          {replyTo ? (
            <View style={styles.replyBar}>
              <View style={styles.replyLine} />
              <View style={styles.replyCopy}>
                <Text style={styles.replyTitle}>
                  @{replyTo.author?.displayName ?? 'Wapve'} kullanıcısına yanıt
                </Text>
                <Text numberOfLines={1} style={styles.replyExcerpt}>
                  {replyTo.content ?? 'Mesaj eki'}
                </Text>
                <Pressable
                  style={styles.replyMentionToggle}
                  onPress={() => setMentionReplyAuthor((value) => !value)}
                >
                  <Icon
                    name={mentionReplyAuthor ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
                    color={mentionReplyAuthor ? colors.waveBright : colors.textDim}
                    size={18}
                  />
                  <Text style={styles.replyMentionText}>Yanıtlanan kullanıcıdan bahset</Text>
                </Pressable>
              </View>
              <Pressable
                style={styles.iconButton}
                onPress={() => setReplyTo(null)}
                accessibilityLabel="Yanıtı kapat"
              >
                <Icon name="close" color={colors.textMuted} size={22} />
              </Pressable>
            </View>
          ) : null}
          {activeMention?.items.length ? (
            <ScrollView
              style={styles.mentionMenu}
              keyboardShouldPersistTaps="always"
              showsVerticalScrollIndicator={false}
            >
              {activeMention.items.map((alias, index) => (
                <View key={alias.token}>
                  {index === 0 || activeMention.items[index - 1]?.category !== alias.category ? (
                    <Text style={styles.mentionCategory}>
                      {alias.category.toLocaleUpperCase('tr')}
                    </Text>
                  ) : null}
                  <Pressable style={styles.mentionRow} onPress={() => selectMention(alias)}>
                    {alias.kind === 'user' ? (
                      <Avatar
                        name={alias.label.slice(1)}
                        uri={
                          serverMembers.data?.find((member) => member.id === alias.id)?.avatarUrl
                        }
                        size={34}
                      />
                    ) : (
                      <View style={styles.mentionChannelIcon}>
                        <Icon
                          name={
                            alias.kind === 'channel'
                              ? 'pound'
                              : alias.kind === 'role'
                                ? 'shield-account-outline'
                                : 'bullhorn-outline'
                          }
                          color={alias.color ?? colors.waveBright}
                          size={20}
                        />
                      </View>
                    )}
                    <View style={styles.mentionCopy}>
                      <Text
                        style={[styles.mentionLabel, alias.color ? { color: alias.color } : null]}
                      >
                        {alias.label}
                      </Text>
                      <Text style={styles.mentionDetail}>
                        {alias.kind === 'user'
                          ? `@${serverMembers.data?.find((member) => member.id === alias.id)?.username ?? ''}`
                          : alias.kind === 'role'
                            ? 'Rol etiketi'
                            : alias.kind === 'broadcast'
                              ? 'Bildirim etiketi'
                              : 'Kanal'}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : null}
          {typingNames.length ? <TypingIndicator names={typingNames} /> : null}
          {kind === 'channel' && /^\/\w*$/u.test(content) && <View style={{ backgroundColor: colors.surfaceRaised, borderRadius: 16, margin: 8 }}>
            {availableCommands(currentServer.data?.permissions ?? []).filter(command => command.name.startsWith(content.slice(1).toLowerCase())).map(command => <Pressable key={command.name} style={{ minHeight: 48, padding: 12 }} onPress={() => { changeContent(`/${command.name} ${command.name === 'help' ? '' : '@'}`); inputRef.current?.focus(); }}><Text style={{ color: colors.text }}>{`/${command.name} · ${locale === 'tr' ? command.tr : command.en}`}</Text></Pressable>)}
          </View>}
          <View style={[styles.composer, recording && styles.composerRecording]}>
            <Pressable
              style={[styles.roundAction, !canCompose && styles.controlDisabled]}
              accessibilityLabel="Ekle"
              accessibilityState={{ disabled: !canCompose }}
              disabled={!canCompose}
              onPress={() => setAttachmentSheet(true)}
            >
              <Icon name="plus" color={colors.waveBright} size={28} />
            </Pressable>
            {recording ? (
              <View style={styles.recordingState}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>
                  Kaydediliyor · {Math.max(1, Math.ceil(recorderState.durationMillis / 1000))} sn
                </Text>
                <Text style={styles.recordingHint}>Göndermek için bırak</Text>
              </View>
            ) : (
              <View style={styles.inputShell}>
                <TextInput
                  testID="message.composer"
                  ref={inputRef}
                  style={styles.input}
                  value={content}
                  onChangeText={changeContent}
                  editable={canCompose}
                  onFocus={() => {
                    setInputFocused(true);
                    setExpressionPanel(false);
                  }}
                  onBlur={() => setInputFocused(false)}
                  placeholder={composerReason ?? t('messagePlaceholder')}
                  placeholderTextColor={colors.textDim}
                  multiline
                  numberOfLines={1}
                  textAlignVertical="center"
                  maxLength={4_000}
                  accessibilityLabel={t('messagePlaceholder')}
                />
                <Pressable
                  style={[styles.expressionButton, !canCompose && styles.controlDisabled]}
                  accessibilityLabel="Emoji ve GIF"
                  accessibilityState={{ disabled: !canCompose }}
                  disabled={!canCompose}
                  onPress={openExpressions}
                >
                  <Icon
                    name={expressionPanel ? 'keyboard-outline' : 'emoticon-happy-outline'}
                    color={colors.textMuted}
                    size={24}
                  />
                </Pressable>
              </View>
            )}
            {content.trim() || attachments.length ? (
              <Pressable
                testID="message.send"
                style={[
                  styles.send,
                  (!canCompose || slowModeRemaining > 0) && styles.controlDisabled,
                ]}
                disabled={!canCompose || sending || slowModeRemaining > 0}
                onPress={() => void send()}
                accessibilityLabel={t('send')}
              >
                <Icon name="send" color={colors.text} size={23} />
              </Pressable>
            ) : (
              <Pressable
                style={[
                  styles.roundAction,
                  recording && styles.recordButtonActive,
                  !canAttach && styles.controlDisabled,
                ]}
                disabled={!canAttach}
                accessibilityState={{ disabled: !canAttach }}
                onPressIn={() => {
                  pressingRecord.current = true;
                  void startVoiceRecording();
                }}
                onPressOut={() => {
                  pressingRecord.current = false;
                  if (recordingStarted.current) void stopVoiceRecording();
                }}
                accessibilityLabel="Sesli mesaj kaydetmek için basılı tut"
              >
                <Icon
                  name={recording ? 'stop' : 'microphone-outline'}
                  color={recording ? colors.text : colors.textMuted}
                  size={25}
                />
              </Pressable>
            )}
          </View>
          {expressionPanel ? (
            <ExpressionPanel
              tab={expressionTab}
              setTab={setExpressionTab}
              content={content}
              setContent={setContent}
              gifTerm={gifTerm}
              setGifTerm={setGifTerm}
              gifs={gifs.data?.items ?? []}
              allowGif={canUseGifs}
              sendGif={sendGif}
              serverId={kind === 'channel' ? serverId : undefined}
              close={() => setExpressionPanel(false)}
            />
          ) : null}
          <AttachmentSheet
            visible={attachmentSheet}
            channel={kind === 'channel'}
            allowFiles={canAttach}
            allowPoll={canCreatePolls}
            close={() => setAttachmentSheet(false)}
            pickPhotos={pickPhotos}
            pickFiles={pickFiles}
            openPoll={() => {
              setAttachmentSheet(false);
              setPollOpen(true);
            }}
            openSchedule={() => {
              setAttachmentSheet(false);
              setScheduleOpen(true);
            }}
          />
          <PollComposer visible={pollOpen} close={() => setPollOpen(false)} submit={createPoll} />
          <ScheduleComposer
            visible={scheduleOpen}
            initialContent={content}
            close={() => setScheduleOpen(false)}
            submit={scheduleMessage}
          />
          {kind === 'group' && conversationId ? (
            <GroupManagementSheet
              visible={groupSettingsOpen}
              conversationId={conversationId}
              close={() => setGroupSettingsOpen(false)}
              onSelectMember={(member) => {
                setGroupSettingsOpen(false);
                setSelectedMember(member);
              }}
            />
          ) : null}
          <MemberSheet
            visible={membersOpen}
            close={() => setMembersOpen(false)}
            kind={kind}
            conversationId={conversationId}
            serverId={serverId}
            server={currentServer.data}
            channel={currentChannel}
            messages={items as MobileMessage[]}
            messageEndpoint={endpoint}
            currentUser={user}
            onSelect={setSelectedMember}
            onSearch={() => setBrowserMode('search')}
            onJumpMessage={(messageId) => void jumpToMessage(messageId)}
            onOpenSettings={() => {
              if (kind === 'group') { setGroupSettingsOpen(true); return; }
              if (!serverId || !currentChannel) return;
              router.push({
                pathname: '/servers/[serverId]/settings',
                params: { serverId, tab: 'channels', channelId: currentChannel.id },
              });
            }}
          />
          <MemberActionSheet
            member={selectedMember}
            serverId={serverId}
            currentUserId={user?.id}
            close={() => setSelectedMember(null)}
          />
          <MessageBrowserSheet
            mode={browserMode}
            kind={kind}
            endpoint={endpoint}
            close={() => setBrowserMode(null)}
            select={(messageId) => void jumpToMessage(messageId)}
          />
          <ForwardMessageSheet
            message={forwardMessage}
            source={
              forwardMessage
                ? kind === 'channel'
                  ? {
                      kind: 'CHANNEL',
                      serverId: serverId!,
                      channelId: channelId!,
                      messageId: forwardMessage.id,
                    }
                  : {
                      kind: kind === 'direct' ? 'DIRECT' : 'GROUP',
                      conversationId: conversationId!,
                      messageId: forwardMessage.id,
                    }
                : null
            }
            close={() => setForwardMessage(null)}
          />
          <MessageActionSheet
            message={selectedMessage}
            kind={kind}
            conversationId={conversationId}
            serverLinkId={currentServer.data?.publicId ?? serverId}
            channelLinkId={currentChannel?.publicId ?? channelId}
            ownUserId={user?.id}
            canReply={canCompose}
            canReact={canInteract}
            canPin={canManageMessages}
            canDelete={canManageMessages}
            close={() => setSelectedMessage(null)}
            reply={(message) => {
              setReplyTo(message);
              setSelectedMessage(null);
            }}
            forward={(message) => {
              setForwardMessage(message);
              setSelectedMessage(null);
            }}
            markUnread={() => void markUnread()}
            edit={(message) => {
              setEditMessage(message);
              setEditValue(message.content ?? '');
              setSelectedMessage(null);
            }}
            remove={(message) => void deleteSelectedMessage(message)}
            togglePin={(message) => void togglePin(message)}
            react={(message, emoji) => void reactToMessage(message, emoji)}
          />
          <EditMessageSheet
            message={editMessage}
            value={editValue}
            setValue={setEditValue}
            close={() => setEditMessage(null)}
            save={() => void updateSelectedMessage()}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ChatDrawer>
  );
}

function canonicalizeMentions(value: string, aliases: MentionAlias[]) {
  return aliases
    .slice()
    .sort((left, right) => right.label.length - left.label.length)
    .reduce((result, alias) => result.replaceAll(alias.label, alias.token), value);
}

function SystemMessage({ label }: { label: string }) {
  return (
    <View style={styles.systemRow}>
      <Icon
        name={
          label.toLocaleLowerCase('tr').includes('arama')
            ? 'phone-hangup-outline'
            : 'information-outline'
        }
        color={colors.textDim}
        size={17}
      />
      <Text style={styles.systemText}>{label}</Text>
    </View>
  );
}

function sameDay(left: string, right: string) {
  const a = new Date(left);
  const b = new Date(right);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function DaySeparator({ value }: { value: string }) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const label = sameDay(value, today.toISOString())
    ? 'Bugün'
    : sameDay(value, yesterday.toISOString())
      ? 'Dün'
      : date.toLocaleDateString('tr-TR', {
          day: 'numeric',
          month: 'long',
          year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
        });
  return (
    <View style={styles.daySeparator}>
      <View style={styles.separatorLine} />
      <Text style={styles.daySeparatorText}>{label}</Text>
      <View style={styles.separatorLine} />
    </View>
  );
}

function NewMessagesSeparator() {
  return (
    <View style={styles.newSeparator}>
      <View style={styles.newSeparatorLine} />
      <Text style={styles.newSeparatorText}>YENİ MESAJLAR</Text>
    </View>
  );
}

function TypingIndicator({ names }: { names: string[] }) {
  const unique = [...new Set(names)];
  const label =
    unique.length === 1
      ? `${unique[0]} yazıyor…`
      : unique.length === 2
        ? `${unique[0]} ve ${unique[1]} yazıyor…`
        : `${unique.length} kişi yazıyor…`;
  return (
    <View style={styles.typingIndicator} accessibilityLiveRegion="polite">
      <View style={styles.typingDots}>
        <View style={styles.typingDot} />
        <View style={styles.typingDot} />
        <View style={styles.typingDot} />
      </View>
      <Text style={styles.typingText}>{label}</Text>
    </View>
  );
}

function pollRemainingLabel(closesAt: string) {
  const remaining = Math.max(0, new Date(closesAt).getTime() - Date.now());
  const minutes = Math.max(1, Math.ceil(remaining / 60_000));
  if (minutes < 60) return `${minutes} dk kaldı`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours} saat kaldı`;
  return `${Math.ceil(hours / 24)} gün kaldı`;
}

function MessageRow({
  item,
  compact,
  highlighted,
  aliases,
  serverId,
  customEmojis,
  canVote,
  canReply,
  onReact,
  onPollVote,
  onSwipeReply,
  onLongPress,
  onAuthorPress,
}: {
  item: MobileMessage;
  compact: boolean;
  highlighted: boolean;
  aliases: MentionAlias[];
  serverId?: string | undefined;
  customEmojis?: ServerEmoji[];
  canVote: boolean;
  canReply: boolean;
  onReact(emoji: string): void;
  onPollVote(choiceId: string): void;
  onSwipeReply(): void;
  onLongPress(): void;
  onAuthorPress(): void;
}) {
  const author = item.author;
  const fallback = messagePreview(item);
  const hasPoll = 'poll' in item && Boolean(item.poll);
  const poll = 'poll' in item ? item.poll : null;
  const pollClosed = Boolean(poll && new Date(poll.closesAt).getTime() <= Date.now());
  const winningVotes = poll ? Math.max(0, ...poll.choices.map((choice) => choice.votes)) : 0;
  const firstUrl = item.content ? firstHttpUrl(item.content) : null;
  const internalMessageUrl = firstUrl && parseMobileMessageLink(firstUrl) ? firstUrl : null;
  return (
    <SwipeToReply enabled={canReply && !item.deleted} onReply={onSwipeReply}>
      <Pressable
        delayLongPress={280}
        onLongPress={onLongPress}
        style={({ pressed }) => [
          styles.message,
          compact && styles.compact,
          highlighted && styles.messageHighlighted,
          pressed && styles.messagePressed,
        ]}
      >
        {compact ? (
          <View style={styles.avatarSpacer} />
        ) : (
          <Pressable onPress={onAuthorPress}>
            <Avatar name={author?.displayName ?? 'Wapve'} uri={author?.avatarUrl} size={40} />
          </Pressable>
        )}
        <View style={styles.messageBody}>
          {compact ? null : (
            <View style={styles.messageMeta}>
              <Pressable onPress={onAuthorPress}>
                <Text style={styles.author}>{author?.displayName ?? 'Wapve'}</Text>
              </Pressable>
              {author?.badges?.length ? <PlatformBadges badges={author.badges} size={18} /> : null}
              <Text style={styles.time}>
                {new Date(item.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
              {item.editedAt ? <Text style={styles.edited}>düzenlendi</Text> : null}
            </View>
          )}
          {'replyTo' in item && item.replyTo ? (
            <View style={styles.replyPreview}>
              <Icon name="reply" color={colors.textDim} size={16} />
              <Text numberOfLines={1} style={styles.replyPreviewText}>
                <Text style={styles.replyPreviewAuthor}>@{item.replyTo.author.displayName} </Text>
                {item.replyTo.deleted ? 'Silinmiş mesaj' : (item.replyTo.content ?? 'Mesaj eki')}
              </Text>
            </View>
          ) : null}
          {item.forwardedFrom ? (
            <View style={styles.forwarded}>
              <View style={styles.forwardLine} />
              <View style={styles.forwardCopy}>
                <View style={styles.forwardHead}>
                  <Icon name="forward" color={colors.waveBright} size={15} />
                  <Text style={styles.forwardLabel}>
                    İletilen mesaj · {item.forwardedFrom.contextName}
                  </Text>
                </View>
                <Text style={styles.forwardAuthor}>{item.forwardedFrom.author.displayName}</Text>
                <Text style={styles.messageText}>
                  {item.forwardedFrom.excerpt ?? 'Orijinal içerik artık görüntülenemiyor.'}
                </Text>
              </View>
            </View>
          ) : null}
          {item.content?.trim() ? (
            <StructuredMessageText
              content={item.content}
              aliases={aliases}
              serverId={serverId}
              customEmojis={customEmojis ?? []}
              hideSoleInternal={Boolean(internalMessageUrl)}
            />
          ) : null}
          {firstUrl ? <RichLinkCard url={firstUrl} /> : null}
          {item.gif ? (
            <Pressable
              style={styles.gifWrap}
              onPress={() =>
                router.push({
                  pathname: '/media',
                  params: { url: item.gif?.url, name: item.gif?.alt },
                })
              }
            >
              <SecureImage
                uri={item.gif.url}
                style={styles.gif}
                contentFit="cover"
                transition={120}
              />
              <Text style={styles.gifAlt}>{item.gif.alt}</Text>
            </Pressable>
          ) : null}
          {item.attachments.map((attachment) =>
            attachment.kind === 'IMAGE' ? (
              <Pressable
                key={attachment.id}
                style={styles.imageAttachment}
                onPress={() =>
                  router.push({
                    pathname: '/media',
                    params: {
                      url: attachment.url,
                      name: attachment.name,
                      kind: attachment.kind,
                      contentType: attachment.contentType,
                      size: String(attachment.size),
                    },
                  })
                }
              >
                <SecureImage
                  uri={attachment.url}
                  style={styles.attachmentImage}
                  contentFit="cover"
                  transition={120}
                />
              </Pressable>
            ) : attachment.kind === 'AUDIO' ? (
              <View key={attachment.id} style={styles.audioAttachmentWrap}>
                <VoiceMessagePlayer attachment={attachment} />
                <Pressable
                  style={styles.audioOpen}
                  onPress={() =>
                    router.push({
                      pathname: '/media',
                      params: {
                        url: attachment.url,
                        name: attachment.name,
                        kind: attachment.kind,
                        contentType: attachment.contentType,
                        size: String(attachment.size),
                      },
                    })
                  }
                  accessibilityLabel="Ses dosyasını medya ekranında aç"
                >
                  <Icon name="open-in-new" color={colors.textDim} size={17} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                key={attachment.id}
                style={styles.attachment}
                onPress={() =>
                  router.push({
                    pathname: '/media',
                    params: {
                      url: attachment.url,
                      name: attachment.name,
                      kind: attachment.kind,
                      contentType: attachment.contentType,
                      size: String(attachment.size),
                    },
                  })
                }
              >
                <Icon
                  name={attachment.kind === 'VIDEO' ? 'video-outline' : 'file-outline'}
                  color={colors.cyan}
                  size={22}
                />
                <View style={styles.attachmentCopy}>
                  <Text numberOfLines={1} style={styles.attachmentName}>
                    {attachment.name}
                  </Text>
                  <Text
                    style={styles.attachmentMeta}
                  >{`${Math.max(1, Math.round(attachment.size / 1024))} KB`}</Text>
                </View>
                <Icon name="open-in-new" color={colors.textDim} size={18} />
              </Pressable>
            ),
          )}
          {poll ? (
            <View style={styles.poll}>
              <Text style={styles.pollQuestion}>{poll.question}</Text>
              {poll.choices.map((choice) => {
                const percent = poll.totalVotes
                  ? Math.round((choice.votes / poll.totalVotes) * 100)
                  : 0;
                const winner = pollClosed && winningVotes > 0 && choice.votes === winningVotes;
                return (
                  <Pressable
                    key={choice.id}
                    disabled={!canVote || pollClosed}
                    style={[
                      styles.pollChoice,
                      choice.votedByMe && styles.pollChoiceActive,
                      winner && styles.pollChoiceWinner,
                    ]}
                    onPress={() => onPollVote(choice.id)}
                  >
                    <View style={[styles.pollFill, { width: `${percent}%` }]} />
                    <Text style={styles.pollText}>{choice.text}</Text>
                    {winner ? (
                      <Icon name="trophy-outline" color={colors.warning} size={17} />
                    ) : null}
                    {choice.votedByMe ? (
                      <Icon name="check" color={colors.waveBright} size={17} />
                    ) : null}
                    <Text style={styles.pollVotes}>
                      {choice.votes} · %{percent}
                    </Text>
                  </Pressable>
                );
              })}
              <View style={styles.pollFooter}>
                <Text style={styles.pollSummary}>{poll.totalVotes} toplam oy</Text>
                <Text style={[styles.pollSummary, pollClosed && styles.pollClosed]}>
                  {pollClosed ? 'Anket kapandı' : pollRemainingLabel(poll.closesAt)}
                </Text>
              </View>
            </View>
          ) : null}
          {'reactions' in item && item.reactions.length ? (
            <View style={styles.reactionList}>
              {item.reactions.map((reaction) => (
                <Pressable
                  key={reaction.emoji}
                  style={[styles.reactionChip, reaction.reactedByMe && styles.reactionChipActive]}
                  onPress={() => onReact(reaction.emoji)}
                >
                  <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                  <Text
                    style={[
                      styles.reactionCount,
                      reaction.reactedByMe && styles.reactionCountActive,
                    ]}
                  >
                    {reaction.count}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {!item.deleted &&
          !item.content?.trim() &&
          !item.forwardedFrom &&
          !item.gif &&
          !item.attachments.length &&
          !hasPoll ? (
            <Text style={styles.unsupported}>{fallback}</Text>
          ) : null}
        </View>
      </Pressable>
    </SwipeToReply>
  );
}

function SwipeToReply({
  enabled,
  onReply,
  children,
}: PropsWithChildren<{ enabled: boolean; onReply(): void }>) {
  const translateX = useSharedValue(0);
  const fired = useSharedValue(false);
  const pan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX(-12)
    .failOffsetX(12)
    .failOffsetY([-12, 12])
    .onBegin(() => {
      fired.value = false;
    })
    .onUpdate((event) => {
      translateX.value = Math.max(-78, Math.min(0, event.translationX));
    })
    .onEnd((event) => {
      if (!fired.value && (translateX.value <= -52 || event.velocityX < -520)) {
        fired.value = true;
        runOnJS(onReply)();
      }
      translateX.value = withSpring(0, { damping: 19, stiffness: 245, mass: 0.65 });
    })
    .onFinalize(() => {
      translateX.value = withSpring(0, { damping: 19, stiffness: 245, mass: 0.65 });
    });
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const replyStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(translateX.value) / 42),
    transform: [{ scale: 0.72 + Math.min(0.28, Math.abs(translateX.value) / 180) }],
  }));
  return (
    <View style={styles.swipeReplyShell}>
      <Reanimated.View style={[styles.swipeReplyAction, replyStyle]} pointerEvents="none">
        <Icon name="reply" color={colors.waveBright} size={23} />
      </Reanimated.View>
      <GestureDetector gesture={pan}>
        <Reanimated.View style={contentStyle}>{children}</Reanimated.View>
      </GestureDetector>
    </View>
  );
}

function StructuredMessageText({
  content,
  aliases,
  serverId,
  customEmojis = [],
  hideSoleInternal = false,
}: {
  content: string;
  aliases: MentionAlias[];
  serverId?: string | undefined;
  customEmojis?: ServerEmoji[];
  hideSoleInternal?: boolean;
}) {
  if (hideSoleInternal && parseMobileMessageLink(content.trim())) return null;
  const aliasMap = new Map<string, MentionAlias>();
  const emojiMap = new Map(customEmojis.map((emoji) => [emoji.id, emoji]));
  for (const alias of aliases) {
    aliasMap.set(alias.token, alias);
    for (const alternate of alias.alternateTokens ?? []) aliasMap.set(alternate, alias);
  }
  const blocks = content.split(/(```[\s\S]*?```)/gu).filter(Boolean);
  return (
    <View style={styles.richMessage}>
      {blocks.map((block, blockIndex) => {
        if (block.startsWith('```')) {
          const match = block.match(/^```([^\n`]*)\n?([\s\S]*?)```$/u);
          return (
            <View key={blockIndex} style={styles.codeBlock}>
              {match?.[1]?.trim() ? (
                <Text style={styles.codeLanguage}>{match[1].trim().toLocaleUpperCase('tr')}</Text>
              ) : null}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text selectable style={styles.codeText}>
                  {match?.[2] ?? block.slice(3, -3)}
                </Text>
              </ScrollView>
            </View>
          );
        }
        return block.split('\n').map((line, lineIndex) => {
          const quote = line.match(/^>\s?(.*)$/u);
          const list = line.match(/^\s*(?:[-*+] |\d+[.)] )(.*)$/u);
          if (quote)
            return (
              <View key={`${blockIndex}:${lineIndex}`} style={styles.quoteBlock}>
                <View style={styles.quoteLine} />
                <InlineRichText
                  content={quote[1] ?? ''}
                  aliasMap={aliasMap}
                  serverId={serverId}
                  customEmojis={emojiMap}
                  italic
                />
              </View>
            );
          if (list)
            return (
              <View key={`${blockIndex}:${lineIndex}`} style={styles.listLine}>
                <Text style={styles.listBullet}>•</Text>
                <InlineRichText
                  content={list[1] ?? ''}
                  aliasMap={aliasMap}
                  serverId={serverId}
                  customEmojis={emojiMap}
                />
              </View>
            );
          return (
            <InlineRichText
              key={`${blockIndex}:${lineIndex}`}
              content={line || ' '}
              aliasMap={aliasMap}
              serverId={serverId}
              customEmojis={emojiMap}
            />
          );
        });
      })}
    </View>
  );
}

function InlineRichText({
  content,
  aliasMap,
  serverId,
  customEmojis,
  italic = false,
}: {
  content: string;
  aliasMap: Map<string, MentionAlias>;
  serverId?: string | undefined;
  customEmojis?: Map<string, ServerEmoji>;
  italic?: boolean;
}) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const parts = content.split(
    /(<(?:@|#)[^>]+>|<:[A-Za-z0-9_]+:[0-9a-f-]{36}>|@(?:weryone|everyone|wave)|https?:\/\/[^\s<>]+|\|\|[^|]+\|\||\*\*[^*]+\*\*|`[^`]+`|_[^_\n]+_|\*[^*\n]+\*)/giu,
  );
  return (
    <Text style={[styles.messageText, italic && styles.italicText]}>
      {parts.map((part, index) => {
        if (/^https?:\/\//iu.test(part)) {
          const url = part.replace(/[),.;!?]+$/u, '');
          return (
            <Text key={index}>
              <Text style={styles.messageLink} onPress={() => void openMessageUrl(url)}>
                {url}
              </Text>
              {part.slice(url.length)}
            </Text>
          );
        }
        const alias = aliasMap.get(part);
        if (alias)
          return (
            <Text
              key={index}
              style={[styles.mentionText, alias.color ? { color: alias.color } : null]}
              onPress={() =>
                alias.kind === 'user'
                  ? router.push({
                      pathname: '/profile/[userId]',
                      params: { userId: alias.id, name: alias.label.slice(1) },
                    })
                  : alias.kind === 'channel' && serverId
                    ? router.push({
                        pathname: '/channel/[serverId]/[channelId]',
                        params: {
                          serverId,
                          channelId: alias.id,
                          name: alias.label.replace(/^#/u, ''),
                        },
                      })
                    : undefined
              }
            >
              {alias.label}
            </Text>
          );
        const custom = part.match(/^<:([A-Za-z0-9_]+):([0-9a-f-]{36})>$/u);
        if (custom) {
          const emoji = custom[2] ? customEmojis?.get(custom[2]) : undefined;
          return (
            <Text key={index} style={styles.customEmojiText}>
              {emoji ? `:${emoji.name}:` : part}
            </Text>
          );
        }
        if (part.startsWith('||') && part.endsWith('||')) {
          const shown = revealed.has(index);
          return (
            <Text
              key={index}
              accessibilityRole="button"
              accessibilityLabel={shown ? 'Spoiler gösteriliyor' : 'Spoileri göster'}
              style={[styles.spoiler, shown && styles.spoilerRevealed]}
              onPress={() => setRevealed((current) => new Set(current).add(index))}
            >
              {shown ? part.slice(2, -2) : '██████'}
            </Text>
          );
        }
        if (part.startsWith('**') && part.endsWith('**'))
          return (
            <Text key={index} style={styles.boldText}>
              {part.slice(2, -2)}
            </Text>
          );
        if (part.startsWith('`') && part.endsWith('`'))
          return (
            <Text key={index} style={styles.inlineCode}>
              {part.slice(1, -1)}
            </Text>
          );
        if (
          (part.startsWith('_') && part.endsWith('_')) ||
          (part.startsWith('*') && part.endsWith('*'))
        )
          return (
            <Text key={index} style={styles.italicText}>
              {part.slice(1, -1)}
            </Text>
          );
        return <Text key={index}>{part}</Text>;
      })}
    </Text>
  );
}

function openMessageUrl(url: string) {
  const target = parseMobileMessageLink(url);
  if (target?.kind === 'channel') {
    router.push({
      pathname: '/channels/[serverPublicId]/[channelPublicId]',
      params: {
        serverPublicId: target.serverId,
        channelPublicId: target.channelId,
        messageId: target.messageId,
        name: 'mesaj',
      },
    });
    return;
  }
  if (target?.kind === 'direct') {
    router.push({
      pathname: '/waves/[waveId]',
      params: { waveId: target.conversationId, messageId: target.messageId },
    });
    return;
  }
  if (target?.kind === 'group') {
    router.push({
      pathname: '/waves/[waveId]',
      params: { waveId: `group:${target.conversationId}`, messageId: target.messageId },
    });
    return;
  }
  Alert.alert('Bağlantı açılsın mı?', url, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Aç', onPress: () => void Linking.openURL(url) },
  ]);
}

function InternalMessageLinkCard({ url }: { url: string }) {
  const preview = useQuery({
    queryKey: ['message-link-preview', url],
    queryFn: () =>
      api.request<InternalMessagePreview | null>('/links/message-preview', {
        method: 'POST',
        body: { url },
      }),
    staleTime: 60_000,
  });
  if (!preview.data) return null;
  return (
    <Pressable style={styles.messageLinkCard} onPress={() => void openMessageUrl(url)}>
      <Avatar name={preview.data.context.name} uri={preview.data.context.iconUrl} size={42} />
      <View style={styles.messageLinkCardCopy}>
        <Text style={styles.messageLinkCardContext} numberOfLines={1}>
          {preview.data.context.name}
        </Text>
        <Text style={styles.messageLinkCardAuthor} numberOfLines={1}>
          {preview.data.author.displayName}
        </Text>
        <Text style={styles.messageLinkCardExcerpt} numberOfLines={2}>
          {preview.data.excerpt ?? 'Mesaja git'}
        </Text>
      </View>
      <Icon name="arrow-right" color={colors.waveBright} size={22} />
    </Pressable>
  );
}

function RichLinkCard({ url }: { url: string }) {
  const internal = parseMobileMessageLink(url);
  const inviteCode = inviteCodeFromUrl(url);
  const external = useQuery({
    queryKey: ['link-preview', url],
    enabled: !internal && !inviteCode,
    retry: false,
    staleTime: 15 * 60_000,
    queryFn: () =>
      api.request<LinkPreview | null>('/links/preview', { method: 'POST', body: { url } }),
  });
  const invite = useQuery({
    queryKey: ['invite-preview', inviteCode],
    enabled: Boolean(inviteCode),
    retry: false,
    staleTime: 60_000,
    queryFn: () =>
      api.request<ServerInvitePreview | null>('/servers/invites/preview', {
        method: 'POST',
        body: { code: inviteCode },
      }),
  });
  const queryClient = useQueryClient();
  if (internal) return <InternalMessageLinkCard url={url} />;
  if (invite.data && inviteCode) {
    const open = async () => {
      if (!invite.data!.alreadyMember) {
        const accepted = await api.request<AcceptedServerInvite>('/servers/actions/accept-invite', {
          method: 'POST',
          body: { code: inviteCode },
        });
        await queryClient.invalidateQueries({ queryKey: ['servers'] });
        openInviteTarget(accepted.server.id, accepted.channel);
        return;
      }
      openInviteTarget(invite.data!.server.id, invite.data!.channel);
    };
    return (
      <Pressable style={styles.inviteCard} onPress={() => void open()}>
        <View style={styles.inviteBanner}>
          {invite.data.server.bannerUrl ? (
            <SecureImage
              uri={invite.data.server.bannerUrl}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : null}
        </View>
        <View style={styles.inviteBody}>
          <View style={styles.inviteHeading}>
            <Avatar name={invite.data.server.name} uri={invite.data.server.iconUrl} size={48} />
            <View style={styles.messageLinkCardCopy}>
              <Text style={styles.messageLinkCardContext}>{invite.data.server.name}</Text>
              <Text style={styles.messageLinkCardExcerpt}>
                {invite.data.server.onlineCount} çevrimiçi · {invite.data.server.memberCount} üye
              </Text>
            </View>
          </View>
          {invite.data.server.description ? (
            <Text style={styles.messageLinkCardExcerpt} numberOfLines={2}>
              {invite.data.server.description}
            </Text>
          ) : null}
          {invite.data.channel ? (
            <Text style={styles.inviteChannel}>
              {invite.data.channel.type === 'VOICE' ? '🔊' : '#'} {invite.data.channel.name}
            </Text>
          ) : null}
          <View style={styles.inviteAction}>
            <Text style={styles.inviteActionText}>
              {invite.data.alreadyMember ? 'Sunucuya git' : 'Sunucuya katıl'}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }
  if (!external.data) return null;
  return (
    <Pressable style={styles.externalLinkCard} onPress={() => void openMessageUrl(url)}>
      <View style={styles.externalSite}>
        <Icon name="link-variant" color={colors.waveBright} size={14} />
        <Text style={styles.externalSiteText}>{external.data.siteName}</Text>
      </View>
      <Text style={styles.externalTitle} numberOfLines={2}>
        {external.data.title}
      </Text>
      {external.data.description ? (
        <Text style={styles.messageLinkCardExcerpt} numberOfLines={3}>
          {external.data.description}
        </Text>
      ) : null}
    </Pressable>
  );
}

function inviteCodeFromUrl(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    )
      return null;
    const host = url.hostname.toLowerCase();
    if (host === 'wapve.cc' || host === 'www.wapve.cc')
      return url.pathname.match(/^\/([A-Za-z0-9_+-]{4,64})\/?$/u)?.[1] ?? null;
    if (host !== 'wapve.com' && host !== 'www.wapve.com') return null;
    return url.pathname.match(/^\/invite\/([A-Za-z0-9_+-]{4,64})\/?$/u)?.[1] ?? null;
  } catch {
    return null;
  }
}

function openInviteTarget(
  serverId: string,
  channel: { id: string; name: string; type: 'TEXT' | 'VOICE' } | null,
) {
  if (channel)
    router.push({
      pathname:
        channel.type === 'VOICE'
          ? '/voice/[serverId]/[channelId]'
          : '/channel/[serverId]/[channelId]',
      params: { serverId, channelId: channel.id, name: channel.name },
    });
  else router.push('/(tabs)');
}

function ExpressionPanel({
  tab,
  setTab,
  content,
  setContent,
  gifTerm,
  setGifTerm,
  gifs,
  allowGif,
  sendGif,
  serverId,
  close,
}: {
  tab: 'emoji' | 'gif';
  setTab(value: 'emoji' | 'gif'): void;
  content: string;
  setContent(value: string): void;
  gifTerm: string;
  setGifTerm(value: string): void;
  gifs: GifSearchResult[];
  allowGif: boolean;
  sendGif(token: string): Promise<void>;
  serverId?: string | undefined;
  close(): void;
}) {
  const { height } = useWindowDimensions();
  return (
    <SwipeableSheetSurface
      onClose={close}
      style={[styles.expressionPanel, { height: Math.min(height * 0.62, 620) }]}
    >
      <View style={styles.expressionTabs}>
        {allowGif ? (
          <Pressable
            style={[styles.expressionTab, tab === 'emoji' && styles.expressionTabActive]}
            onPress={() => setTab('emoji')}
          >
            <Text
              style={[styles.expressionTabText, tab === 'emoji' && styles.expressionTabTextActive]}
            >
              Emoji
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.expressionTab, tab === 'gif' && styles.expressionTabActive]}
          onPress={() => setTab('gif')}
        >
          <Text style={[styles.expressionTabText, tab === 'gif' && styles.expressionTabTextActive]}>
            GIF’ler
          </Text>
        </Pressable>
      </View>
      {tab === 'emoji' ? (
        <EmojiPicker serverId={serverId} onSelect={(emoji) => setContent(`${content}${emoji}`)} />
      ) : allowGif ? (
        <View style={styles.gifPanel}>
          <View style={styles.gifSearch}>
            <Icon name="magnify" color={colors.textDim} size={22} />
            <TextInput
              value={gifTerm}
              onChangeText={setGifTerm}
              style={styles.gifSearchInput}
              placeholder="GIF ara"
              placeholderTextColor={colors.textDim}
            />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.gifGrid}
          >
            {gifs.map((gif, index) => (
              <View key={gif.id} style={styles.gifCell}>
                <Pressable
                  style={[
                    styles.gifResult,
                    {
                      height: Math.max(
                        112,
                        Math.min(190, Math.round((150 * gif.height) / gif.width) + (index % 3) * 8),
                      ),
                    },
                  ]}
                  onPress={() => void sendGif(gif.gifToken)}
                >
                  <SecureImage
                    uri={gif.previewUrl}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                  <View style={styles.gifShade} />
                  <Text numberOfLines={2} style={styles.gifTitle}>
                    {gif.title}
                  </Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </SwipeableSheetSurface>
  );
}

function AttachmentSheet({
  visible,
  channel,
  allowFiles,
  allowPoll,
  close,
  pickPhotos,
  pickFiles,
  openPoll,
  openSchedule,
}: {
  visible: boolean;
  channel: boolean;
  allowFiles: boolean;
  allowPoll: boolean;
  close(): void;
  pickPhotos(camera: boolean): Promise<void>;
  pickFiles(): Promise<void>;
  openPoll(): void;
  openSchedule(): void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <SwipeableSheetSurface onClose={close} style={styles.sheet}>
          <Text style={styles.sheetTitle}>Sohbete ekle</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sheetOptions}
          >
            {allowFiles ? (
              <SheetOption
                icon="image-multiple-outline"
                label="Fotoğraflar"
                onPress={() => void pickPhotos(false)}
              />
            ) : null}
            {allowFiles ? (
              <SheetOption
                icon="camera-outline"
                label="Kamera"
                onPress={() => void pickPhotos(true)}
              />
            ) : null}
            {allowFiles ? (
              <SheetOption icon="paperclip" label="Dosyalar" onPress={() => void pickFiles()} />
            ) : null}
            {channel && allowPoll ? (
              <SheetOption icon="poll" label="Anket" onPress={openPoll} />
            ) : null}
            <SheetOption icon="calendar-clock" label="Zamanla" onPress={openSchedule} />
          </ScrollView>
        </SwipeableSheetSurface>
      </View>
    </Modal>
  );
}
function SheetOption({ icon, label, onPress }: { icon: IconName; label: string; onPress(): void }) {
  return (
    <Pressable style={styles.sheetOption} onPress={onPress}>
      <View style={styles.sheetOptionIcon}>
        <Icon name={icon} color={colors.waveBright} size={28} />
      </View>
      <Text style={styles.sheetOptionText}>{label}</Text>
    </Pressable>
  );
}

function PollComposer({
  visible,
  close,
  submit,
}: {
  visible: boolean;
  close(): void;
  submit(question: string, options: string[], durationMinutes: number): Promise<void>;
}) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [durationMinutes, setDurationMinutes] = useState(1440);
  const [busy, setBusy] = useState(false);
  const cleanOptions = options.map((option) => option.trim()).filter(Boolean);
  const valid = Boolean(
    question.trim() &&
      cleanOptions.length >= 2 &&
      new Set(cleanOptions.map((option) => option.toLocaleLowerCase('tr'))).size ===
        cleanOptions.length,
  );
  async function create() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await submit(question.trim(), cleanOptions, durationMinutes);
      setQuestion('');
      setOptions(['', '']);
      setDurationMinutes(1440);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <SwipeableSheetSurface onClose={close} style={styles.pollComposer}>
          <View style={styles.pollComposerHead}>
            <View>
              <Text style={styles.sheetTitle}>Anket oluştur</Text>
              <Text style={styles.pollComposerHint}>2–10 seçenek ve kapanma süresi belirle.</Text>
            </View>
            <Pressable style={styles.iconButton} onPress={close} accessibilityLabel="Anketi kapat">
              <Icon name="close" color={colors.textMuted} size={25} />
            </Pressable>
          </View>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            style={styles.pollInput}
            placeholder="Sorun ne?"
            placeholderTextColor={colors.textDim}
            maxLength={300}
          />
          <ScrollView style={styles.pollOptions} keyboardShouldPersistTaps="handled">
            {options.map((option, index) => (
              <View key={index} style={styles.pollOptionRow}>
                <TextInput
                  value={option}
                  onChangeText={(value) =>
                    setOptions((current) =>
                      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
                    )
                  }
                  style={[styles.pollInput, styles.pollOptionInput]}
                  placeholder={`${index + 1}. seçenek`}
                  placeholderTextColor={colors.textDim}
                  maxLength={100}
                />
                {options.length > 2 ? (
                  <Pressable
                    style={styles.removePollOption}
                    onPress={() =>
                      setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))
                    }
                    accessibilityLabel={`${index + 1}. seçeneği sil`}
                  >
                    <Icon name="close" color={colors.danger} size={20} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </ScrollView>
          {options.length < 10 ? (
            <Pressable
              style={styles.addPollOption}
              onPress={() => setOptions((current) => [...current, ''])}
            >
              <Icon name="plus" color={colors.waveBright} size={20} />
              <Text style={styles.addPollOptionText}>Seçenek ekle</Text>
            </Pressable>
          ) : null}
          <Text style={styles.pollDurationLabel}>ANKET SÜRESİ</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pollDurations}
          >
            {(
              [
                [60, '1 saat'],
                [240, '4 saat'],
                [480, '8 saat'],
                [1440, '1 gün'],
                [4320, '3 gün'],
                [10080, '7 gün'],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                style={[
                  styles.pollDuration,
                  durationMinutes === value && styles.pollDurationActive,
                ]}
                onPress={() => setDurationMinutes(value)}
              >
                <Text
                  style={[
                    styles.pollDurationText,
                    durationMinutes === value && styles.pollDurationTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Button
            label="Anketi yayınla"
            loading={busy}
            disabled={!valid}
            onPress={() => void create()}
          />
        </SwipeableSheetSurface>
      </View>
    </Modal>
  );
}

function ScheduleComposer({
  visible,
  initialContent,
  close,
  submit,
}: {
  visible: boolean;
  initialContent: string;
  close(): void;
  submit(content: string, scheduledFor: Date): Promise<void>;
}) {
  const [value, setValue] = useState(initialContent);
  const [busy, setBusy] = useState(false);
  const [dayIndex, setDayIndex] = useState(0);
  const initialTarget = new Date(Date.now() + 5 * 60_000);
  const [hour, setHour] = useState(String(initialTarget.getHours()).padStart(2, '0'));
  const [minute, setMinute] = useState(String(initialTarget.getMinutes()).padStart(2, '0'));
  const scheduled = useQuery({
    queryKey: ['scheduled-messages'],
    enabled: visible,
    queryFn: () => api.request<ScheduledMessage[]>('/message-delivery/scheduled'),
  });
  useEffect(() => {
    if (visible) {
      setValue(initialContent);
      const next = new Date(Date.now() + 5 * 60_000);
      setDayIndex(0);
      setHour(String(next.getHours()).padStart(2, '0'));
      setMinute(String(next.getMinutes()).padStart(2, '0'));
    }
  }, [initialContent, visible]);
  const days = useMemo(
    () =>
      Array.from({ length: 8 }, (_, index) => {
        const day = new Date();
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() + index);
        return day;
      }),
    [visible],
  );
  const target = useMemo(() => {
    const next = new Date(days[dayIndex] ?? new Date());
    next.setHours(
      Math.min(23, Math.max(0, Number(hour) || 0)),
      Math.min(59, Math.max(0, Number(minute) || 0)),
      0,
      0,
    );
    return next;
  }, [dayIndex, days, hour, minute]);
  const validTime =
    target.getTime() >= Date.now() + 60_000 && target.getTime() <= Date.now() + 7 * 86_400_000;
  async function schedule() {
    if (!value.trim() || busy) return;
    setBusy(true);
    try {
      await submit(value, target);
      await scheduled.refetch();
    } finally {
      setBusy(false);
    }
  }
  async function cancel(id: string) {
    await api.request(`/message-delivery/scheduled/${id}`, { method: 'DELETE' });
    await scheduled.refetch();
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <SwipeableSheetSurface onClose={close} style={styles.scheduleComposer}>
          <View style={styles.pollComposerHead}>
            <View>
              <Text style={styles.sheetTitle}>Mesajı zamanla</Text>
              <Text style={styles.pollComposerHint}>En erken 1 dakika, en geç 7 gün sonrası.</Text>
            </View>
            <Pressable
              style={styles.iconButton}
              onPress={close}
              accessibilityLabel="Zamanlamayı kapat"
            >
              <Icon name="close" color={colors.textMuted} size={25} />
            </Pressable>
          </View>
          <TextInput
            value={value}
            onChangeText={setValue}
            style={[styles.pollInput, styles.scheduleInput]}
            placeholder="Zamanlanacak mesaj"
            placeholderTextColor={colors.textDim}
            multiline
            maxLength={2_500}
          />
          <Text style={styles.scheduleLabel}>TARİH</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayChoices}
          >
            {days.map((day, index) => (
              <Pressable
                key={day.toISOString()}
                style={[styles.dayChoice, dayIndex === index && styles.dayChoiceActive]}
                onPress={() => setDayIndex(index)}
              >
                <Text style={[styles.dayName, dayIndex === index && styles.dayTextActive]}>
                  {index === 0
                    ? 'Bugün'
                    : index === 1
                      ? 'Yarın'
                      : day.toLocaleDateString('tr-TR', { weekday: 'short' })}
                </Text>
                <Text style={[styles.dayDate, dayIndex === index && styles.dayTextActive]}>
                  {day.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.scheduleLabel}>SAAT</Text>
          <View style={styles.timePicker}>
            <TextInput
              value={hour}
              onChangeText={(text) => setHour(text.replace(/\D/gu, '').slice(0, 2))}
              onBlur={() =>
                setHour(String(Math.min(23, Math.max(0, Number(hour) || 0))).padStart(2, '0'))
              }
              keyboardType="number-pad"
              maxLength={2}
              style={styles.timeInput}
              accessibilityLabel="Saat"
            />
            <Text style={styles.timeColon}>:</Text>
            <TextInput
              value={minute}
              onChangeText={(text) => setMinute(text.replace(/\D/gu, '').slice(0, 2))}
              onBlur={() =>
                setMinute(String(Math.min(59, Math.max(0, Number(minute) || 0))).padStart(2, '0'))
              }
              keyboardType="number-pad"
              maxLength={2}
              style={styles.timeInput}
              accessibilityLabel="Dakika"
            />
            <Text style={[styles.targetPreview, !validTime && styles.invalidTime]}>
              {validTime
                ? target.toLocaleString('tr-TR', {
                    weekday: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Geçerli bir gelecek zamanı seç'}
            </Text>
          </View>
          <Button
            label="Zamanla"
            loading={busy}
            disabled={!value.trim() || !validTime}
            onPress={() => void schedule()}
          />
          {(scheduled.data?.length ?? 0) > 0 ? (
            <View style={styles.scheduledList}>
              <Text style={styles.scheduleLabel}>BEKLEYEN MESAJLAR</Text>
              {scheduled.data
                ?.filter((item) => item.status === 'PENDING')
                .slice(0, 4)
                .map((item) => (
                  <View key={item.id} style={styles.scheduledRow}>
                    <View style={styles.scheduledCopy}>
                      <Text numberOfLines={1} style={styles.scheduledContent}>
                        {item.content}
                      </Text>
                      <Text style={styles.scheduledTime}>
                        {new Date(item.scheduledFor).toLocaleString('tr-TR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.iconButton}
                      onPress={() => void cancel(item.id)}
                      accessibilityLabel="Zamanlanmış mesajı iptal et"
                    >
                      <Icon name="trash-can-outline" color={colors.danger} size={21} />
                    </Pressable>
                  </View>
                ))}
            </View>
          ) : null}
        </SwipeableSheetSurface>
      </View>
    </Modal>
  );
}

type MemberItem = {
  serverTag?: ServerMember['serverTag'];
  gameActivity?: GameActivity | null | undefined;
  id: string;
  publicId?: string | undefined;
  displayName: string;
  username: string;
  avatarUrl?: string | null | undefined;
  bannerUrl?: string | null | undefined;
  status?: string | undefined;
  customStatusText?: string | null | undefined;
  customStatusEmoji?: string | null | undefined;
  bio?: string | null | undefined;
  system?: boolean | undefined;
  badges?: PlatformBadge[] | undefined;
  premium?: ServerMember['premium'] | undefined;
  role?: string | undefined;
  roles?: ServerMember['roles'] | undefined;
  timeoutUntil?: string | null | undefined;
};
function MemberSheet({
  visible,
  close,
  kind,
  conversationId,
  serverId,
  server,
  channel,
  messages,
  messageEndpoint,
  currentUser,
  onSelect,
  onSearch,
  onJumpMessage,
  onOpenSettings,
}: {
  visible: boolean;
  close(): void;
  kind: ThreadKind;
  conversationId?: string | undefined;
  serverId?: string | undefined;
  server?: ServerSummary | undefined;
  channel?: ServerChannel | undefined;
  messages: MobileMessage[];
  messageEndpoint: string;
  currentUser: MemberItem | null;
  onSelect(member: MemberItem): void;
  onSearch(): void;
  onJumpMessage(messageId: string): void;
  onOpenSettings(): void;
}) {
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const [tab, setTab] = useState<'members' | 'media' | 'pins' | 'topic'>('members');
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [options, setOptions] = useState<'settings' | 'mute' | null>(null);
  const panelX = useSharedValue(width);
  const backdropOpacity = useSharedValue(0);
  const serverMembers = useQuery({
    queryKey: ['server-members', serverId],
    enabled: mounted && kind === 'channel' && Boolean(serverId),
    queryFn: () => api.request<ServerMember[]>(`/servers/${serverId}/members`),
  });
  const direct = useQuery({
    queryKey: ['dm-conversations'],
    enabled: mounted && kind === 'direct',
    queryFn: () => api.request<DirectConversation[]>('/dm/conversations'),
  });
  const groups = useQuery({
    queryKey: ['group-conversations'],
    enabled: mounted && kind === 'group',
    queryFn: () => api.request<GroupConversation[]>('/dm/groups'),
  });
  const pinned = useQuery({
    queryKey: ['channel-details-pins', messageEndpoint],
    enabled: mounted && kind === 'channel' && tab === 'pins',
    queryFn: () => api.request<AnyMessage[]>(`${messageEndpoint}/pins`),
  });
  const notificationPreference = useQuery({
    queryKey: ['channel-notification-preference', serverId, channel?.id],
    enabled: mounted && kind === 'channel' && Boolean(serverId && channel),
    queryFn: () =>
      api.request<ChannelNotificationPreference>(
        `/servers/${serverId}/channels/${channel!.id}/notification-preference`,
      ),
  });

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setTab('members');
      panelX.value = width;
      backdropOpacity.value = 0;
      const frame = requestAnimationFrame(() => {
        panelX.value = withTiming(0, { duration: motion.normal });
        backdropOpacity.value = withTiming(1, { duration: motion.normal });
      });
      return () => cancelAnimationFrame(frame);
    }
    panelX.value = withTiming(width, { duration: motion.normal }, (finished) => {
      if (finished) runOnJS(setMounted)(false);
    });
    backdropOpacity.value = withTiming(0, { duration: motion.quick });
  }, [backdropOpacity, panelX, visible, width]);

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: panelX.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const directOther = direct.data?.find((item) => item.id === conversationId)?.otherUser;
  const group = groups.data?.find((item) => item.id === conversationId);
  const members: MemberItem[] =
    kind === 'channel'
      ? (serverMembers.data ?? [])
      : kind === 'group'
        ? (group?.members ?? [])
        : [currentUser, directOther].filter((item): item is MemberItem => Boolean(item));
  const sections = kind === 'channel' ? groupMembers(members, true) : [{ title: 'Üyeler', items: members }];
  const media = useMemo(
    () =>
      messages.flatMap((message) => [
        ...message.attachments
          .filter((attachment) => attachment.kind === 'IMAGE' || attachment.kind === 'VIDEO')
          .map((attachment) => ({
            key: attachment.id,
            url: attachment.url,
            name: attachment.name,
            kind: attachment.kind as 'IMAGE' | 'VIDEO',
          })),
        ...(message.gif
          ? [
              {
                key: `gif:${message.id}`,
                url: message.gif.url,
                name: message.gif.alt,
                kind: 'GIF' as const,
              },
            ]
          : []),
      ]),
    [messages],
  );
  const canInvite = Boolean(server?.permissions.includes('CREATE_INVITES'));
  const canManage = Boolean(
    server?.role === 'OWNER' ||
      server?.permissions.includes('MANAGE_CHANNELS') ||
      channel?.permissions.MANAGE_CHANNELS,
  );

  function afterClose(action: () => void) {
    close();
    setTimeout(action, motion.normal + 30);
  }

  async function toggleNotifications() {
    if (!serverId || !channel || notificationBusy) return;
    setNotificationBusy(true);
    try {
      await api.request(`/servers/${serverId}/channels/${channel.id}/notification-preference`, {
        method: 'PATCH',
        body: { mute: notificationPreference.data?.isMuted ? 'UNMUTED' : 'FOREVER' },
      });
      await notificationPreference.refetch();
    } finally {
      setNotificationBusy(false);
    }
  }

  async function shareInvite() {
    if (!server || !channel) return;
    try {
      const invites = await api.request<ServerInvite[]>(`/servers/${server.id}/invites`);
      const now = Date.now();
      const existing = invites.find(
        (invite) =>
          !invite.revokedAt &&
          new Date(invite.expiresAt).getTime() > now &&
          invite.usedCount < invite.maxUses &&
          invite.channel?.id === channel.id,
      );
      const invite =
        existing ??
        (await api.request<ServerInvite>(`/servers/${server.id}/invites`, {
          method: 'POST',
          body: { maxUses: 100, expiresInHours: 24, channelId: channel.id },
        }));
      await Share.share({
        title: `${server.name} daveti`,
        message: `${server.name} · #${channel.name}\n${serverInviteUrl(invite.code)}`,
      });
    } catch {
      Alert.alert('Davet oluşturulamadı', 'Davet yetkini ve bağlantını kontrol edip yeniden dene.');
    }
  }

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={styles.memberModal}>
        <Reanimated.View style={[styles.memberBackdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityLabel="Üyeleri kapat"
          />
        </Reanimated.View>
        <Reanimated.View style={[styles.memberPanel, panelStyle]}>
          <SafeAreaView style={styles.memberSafe}>
            <View style={styles.channelDetailsTopbar}>
              <Pressable
                style={styles.iconButton}
                onPress={close}
                accessibilityLabel="Kanal ayrıntılarını kapat"
              >
                <Icon name="arrow-left" color={colors.text} size={27} />
              </Pressable>
              <View style={styles.channelDetailsActions}>
                  <Pressable
                    style={styles.channelDetailsAction}
                    onPress={() => afterClose(onSearch)}
                    accessibilityLabel="Kanalda ara"
                  >
                    <Icon name="magnify" color={colors.text} size={25} />
                  </Pressable>
                {kind !== 'channel' ? <>
                  <Pressable style={styles.channelDetailsAction} onPress={() => setOptions('mute')} accessibilityLabel="Bildirimler"><Icon name="bell-outline" color={colors.text} size={24} /></Pressable>
                  <Pressable style={styles.channelDetailsAction} onPress={() => setOptions('settings')} accessibilityLabel="Ayarlar"><Icon name="cog-outline" color={colors.text} size={24} /></Pressable>
                </> : null}
                {kind === 'channel' ? (
                  <Pressable
                    style={[
                      styles.channelDetailsAction,
                      notificationPreference.data?.isMuted && styles.channelDetailsActionActive,
                      notificationBusy && styles.controlDisabled,
                    ]}
                    disabled={notificationBusy}
                    onPress={() => void toggleNotifications()}
                    accessibilityLabel={
                      notificationPreference.data?.isMuted
                        ? 'Kanal bildirimlerinin sesini aç'
                        : 'Kanal bildirimlerini sustur'
                    }
                  >
                    <Icon
                      name={
                        notificationPreference.data?.isMuted ? 'bell-off-outline' : 'bell-outline'
                      }
                      color={notificationPreference.data?.isMuted ? colors.waveBright : colors.text}
                      size={24}
                    />
                  </Pressable>
                ) : null}
                {kind === 'channel' && canManage ? (
                  <Pressable
                    style={styles.channelDetailsAction}
                    onPress={() => afterClose(onOpenSettings)}
                    accessibilityLabel="Kanal ayarlarını aç"
                  >
                    <Icon name="cog-outline" color={colors.text} size={25} />
                  </Pressable>
                ) : null}
              </View>
            </View>
            <View style={[styles.channelHero, kind !== 'channel' && { minHeight: 88, backgroundColor: colors.canvas, paddingHorizontal: 0, alignItems: 'center' }]}>
              {kind === 'direct' && directOther ? <Avatar name={directOther.displayName} uri={directOther.avatarUrl} size={48} online={directOther.status === 'ONLINE'} /> : <View style={styles.channelMark}>
                <Icon
                  name={kind === 'channel' ? 'pound' : 'account-multiple-outline'}
                  color={colors.text}
                  size={34}
                />
              </View>}
              <View style={styles.channelHeroCopy}>
                <Text numberOfLines={1} style={styles.channelName}>
                  {channel?.name ?? directOther?.displayName ?? group?.name ?? 'Sohbet'}
                </Text>
                <Text numberOfLines={1} style={styles.channelType}>
                  {kind === 'channel'
                    ? `Metin kanalı · ${server?.name ?? 'Wapve'}`
                    : directOther ? `@${directOther.username}` : `${members.length} kişi`}
                </Text>
              </View>
            </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.channelTabsScroll}
                contentContainerStyle={styles.channelTabs}
              >
                {(
                  [
                    ['members', `Üyeler ${members.length}`],
                    ['media', `Medya ${media.length}`],
                    ['pins', 'Sabitlemeler'],
                    ['topic', kind === 'channel' ? 'Konu' : 'Bağlantılar'],
                  ] as const
                ).filter(([value]) => kind === 'channel' || value !== 'pins').map(([value, label]) => (
                  <Pressable
                    key={value}
                    style={[styles.channelTab, tab === value && styles.channelTabActive]}
                    onPress={() => setTab(value)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: tab === value }}
                  >
                    <Text
                      style={[styles.channelTabText, tab === value && styles.channelTabTextActive]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            {tab === 'members' ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.memberList}
              >
                {kind === 'direct' && directOther && !directOther.system ? <Pressable style={styles.inviteMembersCard} onPress={() => afterClose(() => router.push({ pathname: '/compose', params: { mode: 'group', memberId: directOther.id } }))}><Icon name="account-multiple-plus-outline" color={colors.text} size={26} /><Text style={styles.inviteMembersTitle}>Yeni grup</Text><Icon name="chevron-right" color={colors.textMuted} size={22} /></Pressable> : null}
                {kind === 'group' ? <Button label="Grup ayarları" onPress={() => afterClose(onOpenSettings)} /> : null}
                {kind === 'channel' && canInvite ? (
                  <Pressable style={styles.inviteMembersCard} onPress={() => void shareInvite()}>
                    <View style={styles.inviteMembersIcon}>
                      <Icon
                        name="account-multiple-plus-outline"
                        color={colors.waveBright}
                        size={27}
                      />
                    </View>
                    <View style={styles.memberCopy}>
                      <Text style={styles.inviteMembersTitle}>Üyeleri davet et</Text>
                      <Text style={styles.memberUser}>
                        Bu kanala güvenli davet bağlantısı paylaş
                      </Text>
                    </View>
                  </Pressable>
                ) : null}
                {sections.map((section) => (
                  <View key={section.title} style={styles.memberSection}>
                    <Text style={styles.memberSectionTitle}>
                      {section.title.toLocaleUpperCase('tr')} — {section.items.length}
                    </Text>
                    <View style={styles.memberGroupCard}>
                      {section.items.map((member, index) => (
                        <Pressable
                          key={member.id}
                          style={({ pressed }) => [
                            styles.memberRow,
                            hasPremiumNameplate(member.premium?.nameplate) &&
                              styles.memberNameplateRow,
                            index > 0 && styles.memberRowBorder,
                            pressed && styles.memberRowPressed,
                          ]}
                          onPress={() => afterClose(() => onSelect(member))}
                          onLongPress={() => afterClose(() => onSelect(member))}
                        >
                          <PremiumNameplateBackground visual={member.premium?.nameplate} />
                          <Avatar
                            name={member.displayName}
                            uri={member.avatarUrl}
                            size={44}
                            online={member.status !== 'OFFLINE'}
                            status={member.status}
                            decoration={member.premium?.avatarDecoration}
                          />
                          <View style={styles.memberCopy}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.memberName,
                                { flexShrink: 1 },
                                {
                                  color:
                                    member.roles
                                      ?.slice()
                                      .sort((left, right) => right.position - left.position)
                                      .find((role) => !role.isEveryone)?.color ?? colors.text,
                                },
                              ]}
                            >
                              {member.displayName}
                              {member.role === 'OWNER' ? '  ♛' : ''}
                            </Text>
                            <ServerTagChip tag={member.serverTag} />
                            </View>
                            <GameActivityLabel person={member} />
                            {!member.gameActivity || member.status === 'OFFLINE' ? <Text numberOfLines={1} style={styles.memberUser}>
                              {member.customStatusText
                                ? `${member.customStatusEmoji ? `${member.customStatusEmoji} ` : ''}${member.customStatusText}`
                                : member.status === 'OFFLINE'
                                  ? 'Çevrimdışı'
                                  : member.status === 'IDLE'
                                    ? 'Boşta'
                                    : member.status === 'DND'
                                      ? 'Rahatsız etmeyin'
                                      : `@${member.username}`}
                            </Text> : null}
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : tab === 'media' ? (
              <ScrollView
                contentContainerStyle={styles.channelMediaGrid}
                showsVerticalScrollIndicator={false}
              >
                {media.map((item) => (
                  <Pressable
                    key={item.key}
                    style={styles.channelMediaCell}
                    onPress={() =>
                      afterClose(() =>
                        router.push({
                          pathname: '/media',
                          params: { url: item.url, name: item.name, kind: item.kind },
                        }),
                      )
                    }
                  >
                    {item.kind === 'VIDEO' ? (
                      <View style={styles.channelMediaVideo}>
                        <Icon name="play-circle-outline" color={colors.text} size={42} />
                        <Text numberOfLines={2} style={styles.channelMediaName}>
                          {item.name}
                        </Text>
                      </View>
                    ) : (
                      <>
                        <View style={styles.channelMediaFallback}>
                          <Icon
                            name={item.kind === 'GIF' ? 'file-gif-box' : 'image-outline'}
                            color={colors.textDim}
                            size={32}
                          />
                          <Text numberOfLines={2} style={styles.channelMediaName}>
                            {item.name}
                          </Text>
                        </View>
                        <SecureImage
                          uri={item.url}
                          style={styles.channelMediaImage}
                          contentFit="cover"
                          transition={120}
                        />
                      </>
                    )}
                  </Pressable>
                ))}
                {!media.length ? (
                  <DetailsEmpty icon="image-multiple-outline" text="Bu kanalda henüz medya yok." />
                ) : null}
              </ScrollView>
            ) : tab === 'pins' ? (
              <ScrollView
                contentContainerStyle={styles.channelPins}
                showsVerticalScrollIndicator={false}
              >
                {(pinned.data ?? []).map((message) => (
                  <Pressable
                    key={message.id}
                    style={styles.channelPinCard}
                    onPress={() => afterClose(() => onJumpMessage(message.id))}
                  >
                    <Avatar
                      name={message.author?.displayName ?? 'Wapve'}
                      uri={message.author?.avatarUrl}
                      size={40}
                    />
                    <View style={styles.memberCopy}>
                      <Text style={styles.memberName}>
                        {message.author?.displayName ?? 'Wapve'}
                      </Text>
                      <Text numberOfLines={3} style={styles.channelPinText}>
                        {message.content ?? messagePreview(message as MobileMessage)}
                      </Text>
                    </View>
                    <Icon name="pin" color={colors.waveBright} size={20} />
                  </Pressable>
                ))}
                {pinned.isPending ? (
                  <Text style={styles.detailsEmptyText}>Sabitlenen mesajlar yükleniyor…</Text>
                ) : null}
                {!pinned.isPending && !pinned.data?.length ? (
                  <DetailsEmpty icon="pin-outline" text="Bu kanalda sabitlenmiş mesaj yok." />
                ) : null}
              </ScrollView>
            ) : kind !== 'channel' ? (
              <ScrollView contentContainerStyle={styles.channelPins}>
                {messages.filter((message) => firstHttpUrl(message.content ?? '')).map((message) => <Pressable key={message.id} style={styles.channelPinCard} onPress={() => afterClose(() => onJumpMessage(message.id))}><Icon name="link-variant" color={colors.waveBright} size={22} /><Text numberOfLines={2} style={styles.channelPinText}>{firstHttpUrl(message.content ?? '')}</Text></Pressable>)}
                {!messages.some((message) => firstHttpUrl(message.content ?? '')) ? <DetailsEmpty icon="link-variant" text="Henüz bağlantı yok." /> : null}
              </ScrollView>
            ) : (
              <ScrollView contentContainerStyle={styles.channelTopicPage}>
                <View style={styles.channelTopicCard}>
                  <View style={styles.topicIcon}>
                    <Icon name="pound" color={colors.waveBright} size={28} />
                  </View>
                  <View style={styles.memberCopy}>
                    <Text style={styles.topicLabel}>KANAL KONUSU</Text>
                    <Text selectable style={channel?.topic ? styles.topicText : styles.topicEmpty}>
                      {channel?.topic || 'Bu kanal için henüz bir konu belirlenmemiş.'}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}
            {options && kind !== 'channel' && conversationId ? <ConversationOptions key={`${conversationId}:${options}`} kind={kind} id={conversationId} title={directOther?.displayName ?? group?.name ?? 'Sohbet'} userId={directOther?.id} initialView={options} close={() => setOptions(null)} dismissDetails={close} /> : null}
          </SafeAreaView>
        </Reanimated.View>
      </View>
    </Modal>
  );
}

function DetailsEmpty({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.detailsEmpty}>
      <Icon name={icon} color={colors.textDim} size={44} />
      <Text style={styles.detailsEmptyText}>{text}</Text>
    </View>
  );
}

function groupMembers(members: MemberItem[], roleGroups: boolean) {
  const online = members.filter((member) => member.status !== 'OFFLINE');
  const offline = members.filter((member) => member.status === 'OFFLINE');
  if (!roleGroups)
    return [
      { title: 'Çevrimiçi', items: online },
      { title: 'Çevrimdışı', items: offline },
    ].filter((section) => section.items.length > 0);
  const roleMap = new Map<string, { title: string; position: number; items: MemberItem[] }>();
  const regular: MemberItem[] = [];
  for (const member of online) {
    const hoisted = member.roles
      ?.filter((role) => role.hoist && !role.isEveryone)
      .sort((left, right) => right.position - left.position)[0];
    if (!hoisted) {
      regular.push(member);
      continue;
    }
    const current = roleMap.get(hoisted.id) ?? {
      title: hoisted.name.replace(/^@/u, ''),
      position: hoisted.position,
      items: [],
    };
    current.items.push(member);
    roleMap.set(hoisted.id, current);
  }
  return [
    ...[...roleMap.values()]
      .sort((left, right) => right.position - left.position)
      .map(({ title, items }) => ({ title, items })),
    ...(regular.length ? [{ title: 'Çevrimiçi', items: regular }] : []),
    ...(offline.length ? [{ title: 'Çevrimdışı', items: offline }] : []),
  ];
}

function MessageBrowserSheet({
  mode,
  kind,
  endpoint,
  close,
  select,
}: {
  mode: 'search' | 'pins' | null;
  kind: ThreadKind;
  endpoint: string;
  close(): void;
  select(messageId: string): void;
}) {
  const [term, setTerm] = useState('');
  const { height } = useWindowDimensions();
  useEffect(() => {
    if (mode) setTerm('');
  }, [mode]);
  const normalized = term.trim();
  const results = useQuery({
    queryKey: ['message-browser', kind, endpoint, mode, normalized],
    enabled: Boolean(mode === 'pins' || (mode === 'search' && normalized.length >= 2)),
    queryFn: () =>
      api.request<AnyMessage[]>(
        mode === 'pins'
          ? `${endpoint}/pins`
          : `${endpoint}/search?q=${encodeURIComponent(normalized)}`,
      ),
  });
  return (
    <Modal visible={Boolean(mode)} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <SwipeableSheetSurface
          onClose={close}
          dragFromContent
          style={[styles.actionSheet, { height: Math.min(height * 0.82, 760) }]}
        >
          <View style={styles.sheetTitleRow}>
            <View>
              <Text style={styles.sheetTitle}>
                {mode === 'pins' ? 'Sabitlenen mesajlar' : 'Mesajlarda ara'}
              </Text>
              <Text style={styles.sheetDescription}>
                {mode === 'pins' ? 'Bu kanalda sabitlenen mesajlar' : 'En az iki harf yaz'}
              </Text>
            </View>
            <Pressable style={styles.iconButton} onPress={close} accessibilityLabel="Kapat">
              <Icon name="close" color={colors.textMuted} size={24} />
            </Pressable>
          </View>
          {mode === 'search' ? (
            <View style={styles.sheetSearch}>
              <Icon name="magnify" color={colors.textDim} size={21} />
              <TextInput
                autoFocus
                value={term}
                onChangeText={setTerm}
                placeholder="Mesaj metni ara"
                placeholderTextColor={colors.textDim}
                style={styles.sheetSearchInput}
              />
              {term ? (
                <Pressable onPress={() => setTerm('')} accessibilityLabel="Aramayı temizle">
                  <Icon name="close-circle" color={colors.textDim} size={20} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            contentContainerStyle={styles.browserResults}
          >
            {(results.data ?? []).map((message) => (
              <Pressable
                key={message.id}
                style={styles.browserResult}
                onPress={() => select(message.id)}
              >
                <Avatar
                  name={message.author?.displayName ?? 'Wapve'}
                  uri={message.author?.avatarUrl}
                  size={38}
                />
                <View style={styles.browserResultCopy}>
                  <View style={styles.browserResultMeta}>
                    <Text style={styles.browserResultAuthor} numberOfLines={1}>
                      {message.author?.displayName ?? 'Wapve'}
                    </Text>
                    <Text style={styles.browserResultTime}>
                      {new Date(message.createdAt).toLocaleDateString('tr-TR')}
                    </Text>
                  </View>
                  <Text style={styles.browserResultText} numberOfLines={3}>
                    {message.content ?? messagePreview(message as MobileMessage)}
                  </Text>
                </View>
              </Pressable>
            ))}
            {results.isPending && (mode === 'pins' || normalized.length >= 2) ? (
              <Text style={styles.browserEmpty}>Mesajlar aranıyor…</Text>
            ) : null}
            {!results.isPending && results.data?.length === 0 ? (
              <Text style={styles.browserEmpty}>Eşleşen mesaj bulunamadı.</Text>
            ) : null}
          </ScrollView>
        </SwipeableSheetSurface>
      </View>
    </Modal>
  );
}

function targetKey(target: MessageTarget) {
  return target.kind === 'CHANNEL'
    ? `${target.kind}:${target.serverId}:${target.channelId}`
    : `${target.kind}:${target.conversationId}`;
}

function ForwardMessageSheet({
  message,
  source,
  close,
}: {
  message: MobileMessage | null;
  source: MessageSource | null;
  close(): void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MessageTarget[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const { height } = useWindowDimensions();
  const queryClient = useQueryClient();
  const targets = useQuery({
    queryKey: ['message-forward-targets'],
    enabled: Boolean(source),
    queryFn: () => api.request<ForwardTarget[]>('/message-delivery/targets'),
  });
  useEffect(() => {
    if (!source) return;
    setSearch('');
    setSelected([]);
    setNote('');
  }, [source]);
  const normalized = search.trim().toLocaleLowerCase('tr');
  const visible = (targets.data ?? []).filter(
    (item) =>
      !normalized ||
      item.name.toLocaleLowerCase('tr').includes(normalized) ||
      item.subtitle?.toLocaleLowerCase('tr').includes(normalized),
  );
  async function submit() {
    if (!source || !selected.length || busy) return;
    setBusy(true);
    try {
      await api.request('/message-delivery/forward', {
        method: 'POST',
        body: { source, targets: selected, ...(note.trim() ? { note: note.trim() } : {}) },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['messages'] }),
        queryClient.invalidateQueries({ queryKey: ['dm-conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['group-conversations'] }),
      ]);
      close();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal visible={Boolean(source)} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <SwipeableSheetSurface
          onClose={close}
          style={[styles.actionSheet, { height: Math.min(height * 0.86, 790) }]}
        >
          <View style={styles.sheetTitleRow}>
            <View style={styles.forwardTitleCopy}>
              <Text style={styles.sheetTitle}>Mesajı ilet</Text>
              <Text style={styles.sheetDescription} numberOfLines={1}>
                {message?.content ?? (message ? messagePreview(message) : '')}
              </Text>
            </View>
            <Pressable style={styles.iconButton} onPress={close} accessibilityLabel="Kapat">
              <Icon name="close" color={colors.textMuted} size={24} />
            </Pressable>
          </View>
          <View style={styles.sheetSearch}>
            <Icon name="magnify" color={colors.textDim} size={21} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Kişi, grup veya kanal ara"
              placeholderTextColor={colors.textDim}
              style={styles.sheetSearchInput}
            />
          </View>
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.forwardTargets}
          >
            {visible.map((item) => {
              const key = targetKey(item.target);
              const active = selected.some((target) => targetKey(target) === key);
              return (
                <Pressable
                  key={key}
                  style={[styles.forwardTarget, active && styles.forwardTargetActive]}
                  onPress={() =>
                    setSelected((current) =>
                      active
                        ? current.filter((target) => targetKey(target) !== key)
                        : current.length < 10
                          ? [...current, item.target]
                          : current,
                    )
                  }
                >
                  <Avatar name={item.name} uri={item.avatarUrl} size={38} />
                  <View style={styles.forwardTargetCopy}>
                    <Text style={styles.forwardTargetName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.subtitle ? (
                      <Text style={styles.forwardTargetSubtitle} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.forwardCheck, active && styles.forwardCheckActive]}>
                    {active ? <Icon name="check" color={colors.text} size={15} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <TextInput
            value={note}
            onChangeText={setNote}
            maxLength={500}
            placeholder="İsteğe bağlı not"
            placeholderTextColor={colors.textDim}
            style={styles.forwardNote}
          />
          <Button
            label={selected.length ? `${selected.length} hedefe ilet` : 'İletilecek yeri seç'}
            disabled={!selected.length || busy}
            loading={busy}
            onPress={() => void submit()}
          />
        </SwipeableSheetSurface>
      </View>
    </Modal>
  );
}

function MemberActionSheet({
  member,
  serverId,
  currentUserId,
  close,
}: {
  member: MemberItem | null;
  serverId?: string | undefined;
  currentUserId?: string | undefined;
  close(): void;
}) {
  const { enabled: developerMode } = useDeveloperMode();
  const [view, setView] = useState<'main' | 'invite' | 'roles' | 'moderation'>('main');
  const [moderation, setModeration] = useState<'timeout' | 'kick' | 'ban'>('timeout');
  const [reason, setReason] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [deleteMessageSeconds, setDeleteMessageSeconds] = useState('0');
  const [busy, setBusy] = useState(false);
  const { height } = useWindowDimensions();
  const queryClient = useQueryClient();
  const friends = useQuery({
    queryKey: ['friends'],
    enabled: Boolean(member),
    queryFn: () => api.request<Friend[]>('/social/friends'),
  });
  const requests = useQuery({
    queryKey: ['friend-requests'],
    enabled: Boolean(member),
    queryFn: () => api.request<FriendRequests>('/social/requests'),
  });
  const blocks = useQuery({
    queryKey: ['blocked-users'],
    enabled: Boolean(member),
    queryFn: () => api.request<BlockedUser[]>('/social/blocks'),
  });
  const servers = useQuery({
    queryKey: ['servers'],
    enabled: Boolean(member),
    queryFn: () => api.request<ServerSummary[]>('/servers'),
  });
  const roles = useQuery({
    queryKey: ['server-roles', serverId],
    enabled: Boolean(member && serverId),
    queryFn: () => api.request<ServerRole[]>(`/servers/${serverId}/roles`),
  });
  useEffect(() => {
    if (!member) return;
    setView('main');
    setReason('');
    setDurationMinutes(60);
    setDeleteMessageSeconds('0');
  }, [member]);
  if (!member) return null;
  const selectedMember = member;
  const own = member.id === currentUserId;
  const actionable = !own && !member.system;
  const friend = friends.data?.find((item) => item.user.id === member.id);
  const incoming = requests.data?.incoming.find((item) => item.user.id === member.id);
  const outgoing = requests.data?.outgoing.find((item) => item.user.id === member.id);
  const blocked = blocks.data?.some((item) => item.user.id === member.id);
  const currentServer = servers.data?.find((item) => item.id === serverId);
  const permission = (name: string) =>
    currentServer?.role === 'OWNER' || currentServer?.permissions.includes(name as never);

  async function refreshSocial() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['friends'] }),
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] }),
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] }),
    ]);
  }
  async function socialAction(path: string, method: 'POST' | 'DELETE', body?: object) {
    if (busy) return;
    setBusy(true);
    try {
      await api.request(path, { method, ...(body ? { body } : {}) });
      await refreshSocial();
    } finally {
      setBusy(false);
    }
  }
  function profile() {
    close();
    router.push({
      pathname: '/profile/[userId]',
      params: {
        userId: selectedMember.id,
        publicId: selectedMember.publicId ?? '',
        name: selectedMember.displayName,
        username: selectedMember.username,
        avatar: selectedMember.avatarUrl ?? '',
        banner: selectedMember.bannerUrl ?? '',
        status: selectedMember.status ?? 'OFFLINE',
        bio: selectedMember.bio ?? '',
        customStatusText: selectedMember.customStatusText ?? '',
        customStatusEmoji: selectedMember.customStatusEmoji ?? '',
        badges: JSON.stringify(selectedMember.badges ?? []),
      },
    });
  }
  async function inviteToServer(server: ServerSummary) {
    if (!friend || busy) return;
    setBusy(true);
    try {
      const invite = await api.request<ServerInvite>(`/servers/${server.id}/invites`, {
        method: 'POST',
        body: { maxUses: 1, expiresInHours: 24 },
      });
      await api.request(`/dm/conversations/${friend.conversationId}/messages`, {
        method: 'POST',
        body: { content: serverInviteUrl(invite.code) },
      });
      close();
      router.push({
        pathname: '/dm/[conversationId]',
        params: { conversationId: friend.conversationId, name: selectedMember.displayName },
      });
    } finally {
      setBusy(false);
    }
  }
  async function toggleRole(role: ServerRole) {
    if (!serverId || busy) return;
    const active = selectedMember.roles?.some((item) => item.id === role.id);
    setBusy(true);
    try {
      await api.request(`/servers/${serverId}/members/${selectedMember.id}/roles/${role.id}`, {
        method: active ? 'DELETE' : 'POST',
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['server-members', serverId] }),
        queryClient.invalidateQueries({ queryKey: ['server-roles', serverId] }),
      ]);
      close();
    } finally {
      setBusy(false);
    }
  }
  async function moderate() {
    if (!serverId || busy) return;
    setBusy(true);
    try {
      if (moderation === 'timeout') {
        await api.request(`/servers/${serverId}/members/${selectedMember.id}/timeout`, {
          method: 'PATCH',
          body: { durationMinutes, ...(reason.trim() ? { reason: reason.trim() } : {}) },
        });
      } else {
        await api.request(
          `/servers/${serverId}/members/${selectedMember.id}/actions/${moderation}`,
          {
            method: 'POST',
            body: {
              ...(reason.trim() ? { reason: reason.trim() } : {}),
              ...(moderation === 'ban' ? { deleteMessageSeconds } : {}),
            },
          },
        );
      }
      await queryClient.invalidateQueries({ queryKey: ['server-members', serverId] });
      close();
    } finally {
      setBusy(false);
    }
  }
  async function clearTimeout() {
    if (!serverId || busy) return;
    setBusy(true);
    try {
      await api.request(`/servers/${serverId}/members/${selectedMember.id}/timeout`, {
        method: 'PATCH',
        body: { durationMinutes: null, ...(reason.trim() ? { reason: reason.trim() } : {}) },
      });
      await queryClient.invalidateQueries({ queryKey: ['server-members', serverId] });
      close();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <SwipeableSheetSurface
          onClose={close}
          style={[styles.actionSheet, { height: Math.min(height * 0.88, 820) }]}
        >
          <View style={styles.memberActionHead}>
            <Avatar
              name={member.displayName}
              uri={member.avatarUrl}
              size={58}
              online={member.status === 'ONLINE'}
            />
            <View style={styles.memberCopy}>
              <View style={styles.memberBadgeLine}>
                <Text style={styles.memberActionName}>{member.displayName}</Text>
                <PlatformBadges badges={member.badges ?? []} size={24} />
              </View>
              <Text style={styles.memberUser}>
                @{member.username}
                {member.customStatusText
                  ? ` · ${member.customStatusEmoji ? `${member.customStatusEmoji} ` : ''}${member.customStatusText}`
                  : ''}
              </Text>
            </View>
            <Pressable style={styles.iconButton} onPress={close} accessibilityLabel="Kapat">
              <Icon name="close" color={colors.textMuted} size={24} />
            </Pressable>
          </View>
          {view !== 'main' ? (
            <Pressable style={styles.memberSubviewBack} onPress={() => setView('main')}>
              <Icon name="arrow-left" color={colors.waveBright} size={21} />
              <Text style={styles.memberSubviewBackText}>Kullanıcı işlemlerine dön</Text>
            </Pressable>
          ) : null}
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            contentContainerStyle={styles.actionList}
          >
            {view === 'main' ? (
              <>
                <ActionRow icon="account-outline" label="Profili görüntüle" onPress={profile} />
                {actionable && friend ? (
                  <ActionRow
                    icon="message-text-outline"
                    label="Özel mesaj gönder"
                    onPress={() => {
                      close();
                      router.push({
                        pathname: '/dm/[conversationId]',
                        params: { conversationId: friend.conversationId, name: member.displayName },
                      });
                    }}
                  />
                ) : null}
                {actionable && incoming ? (
                  <ActionRow
                    icon="account-check-outline"
                    label="Arkadaşlık isteğini kabul et"
                    onPress={() =>
                      void socialAction(`/social/requests/${incoming.id}/accept`, 'POST')
                    }
                  />
                ) : null}
                {actionable && outgoing ? (
                  <ActionRow
                    icon="account-clock-outline"
                    label="Gönderilen isteği iptal et"
                    onPress={() => void socialAction(`/social/requests/${outgoing.id}`, 'DELETE')}
                  />
                ) : null}
                {actionable && !friend && !incoming && !outgoing && !blocked ? (
                  <ActionRow
                    icon="account-plus-outline"
                    label="Arkadaş ekle"
                    onPress={() =>
                      void socialAction('/social/requests', 'POST', { username: member.username })
                    }
                  />
                ) : null}
                {actionable && friend ? (
                  <ActionRow
                    icon="account-minus-outline"
                    label="Arkadaşlıktan çıkar"
                    onPress={() => void socialAction(`/social/friends/${member.id}`, 'DELETE')}
                  />
                ) : null}
                {actionable ? (
                  <ActionRow
                    icon={blocked ? 'account-cancel-outline' : 'block-helper'}
                    label={blocked ? 'Engeli kaldır' : 'Kullanıcıyı engelle'}
                    danger={!blocked}
                    onPress={() =>
                      void socialAction(
                        blocked ? `/social/blocks/${member.id}` : '/social/blocks',
                        blocked ? 'DELETE' : 'POST',
                        blocked ? undefined : { userId: member.id },
                      )
                    }
                  />
                ) : null}
                {actionable && friend ? (
                  <ActionRow
                    icon="email-outline"
                    label="Sunucuya davet et"
                    onPress={() => setView('invite')}
                  />
                ) : null}
                {actionable && serverId && permission('MANAGE_ROLES') ? (
                  <ActionRow
                    icon="shield-account-outline"
                    label="Rolleri yönet"
                    onPress={() => setView('roles')}
                  />
                ) : null}
                {actionable && serverId && permission('TIMEOUT_MEMBERS') ? (
                  <ActionRow
                    icon="clock-alert-outline"
                    label="Sustur / timeout"
                    onPress={() => {
                      setModeration('timeout');
                      setView('moderation');
                    }}
                  />
                ) : null}
                {actionable && serverId && permission('KICK_MEMBERS') ? (
                  <ActionRow
                    icon="account-remove-outline"
                    label="Sunucudan at"
                    danger
                    onPress={() => {
                      setModeration('kick');
                      setView('moderation');
                    }}
                  />
                ) : null}
                {actionable && serverId && permission('BAN_MEMBERS') ? (
                  <ActionRow
                    icon="gavel"
                    label="Sunucudan yasakla"
                    danger
                    onPress={() => {
                      setModeration('ban');
                      setView('moderation');
                    }}
                  />
                ) : null}
                {developerMode ? (
                  <ActionRow
                    icon="identifier"
                    label={`Kullanıcı ID: ${member.publicId ?? member.id}`}
                    onPress={() => void Clipboard.setStringAsync(member.publicId ?? member.id)}
                  />
                ) : null}
              </>
            ) : null}
            {view === 'invite' ? (
              <View style={styles.memberSubview}>
                <Text style={styles.memberSubviewTitle}>Sunucuya davet et</Text>
                <Text style={styles.memberSubviewDescription}>
                  Tek kullanımlık, 24 saat geçerli davet bağlantısı özel mesajla gönderilir.
                </Text>
                {(servers.data ?? [])
                  .filter(
                    (server) =>
                      server.role === 'OWNER' || server.permissions.includes('CREATE_INVITES'),
                  )
                  .map((server) => (
                    <Pressable
                      key={server.id}
                      style={styles.inviteServerRow}
                      disabled={busy}
                      onPress={() => void inviteToServer(server)}
                    >
                      <Avatar name={server.name} uri={server.iconUrl} size={42} />
                      <View style={styles.forwardTargetCopy}>
                        <Text style={styles.forwardTargetName}>{server.name}</Text>
                        <Text style={styles.forwardTargetSubtitle}>{server.memberCount} üye</Text>
                      </View>
                      <Icon name="send-outline" color={colors.waveBright} size={22} />
                    </Pressable>
                  ))}
              </View>
            ) : null}
            {view === 'roles' ? (
              <View style={styles.memberSubview}>
                <Text style={styles.memberSubviewTitle}>Rolleri yönet</Text>
                <Text style={styles.memberSubviewDescription}>
                  Sunucu hiyerarşisi ve kendi en yüksek rolün API tarafından ayrıca denetlenir.
                </Text>
                {(roles.data ?? [])
                  .filter((role) => !role.isEveryone)
                  .sort((left, right) => right.position - left.position)
                  .map((role) => {
                    const active = member.roles?.some((item) => item.id === role.id);
                    return (
                      <Pressable
                        key={role.id}
                        style={styles.roleToggleRow}
                        disabled={busy}
                        onPress={() => void toggleRole(role)}
                      >
                        <View style={[styles.roleColorDot, { backgroundColor: role.color }]} />
                        <Text style={styles.roleToggleName}>@{role.name.replace(/^@/u, '')}</Text>
                        <View style={[styles.forwardCheck, active && styles.forwardCheckActive]}>
                          {active ? <Icon name="check" color={colors.text} size={15} /> : null}
                        </View>
                      </Pressable>
                    );
                  })}
              </View>
            ) : null}
            {view === 'moderation' ? (
              <View style={styles.memberSubview}>
                <Text style={styles.memberSubviewTitle}>
                  {moderation === 'timeout'
                    ? 'Kullanıcıyı sustur'
                    : moderation === 'kick'
                      ? 'Sunucudan at'
                      : 'Sunucudan yasakla'}
                </Text>
                {moderation === 'timeout' ? (
                  <>
                    <Text style={styles.memberFieldLabel}>SÜRE</Text>
                    <View style={styles.durationGrid}>
                      {[
                        [5, '5 dk'],
                        [10, '10 dk'],
                        [60, '1 saat'],
                        [1440, '1 gün'],
                        [10080, '1 hafta'],
                        [40320, '4 hafta'],
                      ].map(([value, label]) => (
                        <Pressable
                          key={value}
                          style={[
                            styles.durationChoice,
                            durationMinutes === value && styles.durationChoiceActive,
                          ]}
                          onPress={() => setDurationMinutes(value as number)}
                        >
                          <Text
                            style={[
                              styles.durationChoiceText,
                              durationMinutes === value && styles.durationChoiceTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : null}
                {moderation === 'ban' ? (
                  <>
                    <Text style={styles.memberFieldLabel}>MESAJ GEÇMİŞİNİ SİL</Text>
                    <View style={styles.durationGrid}>
                      {[
                        ['0', 'Hiçbiri'],
                        ['3600', '1 saat'],
                        ['21600', '6 saat'],
                        ['86400', '1 gün'],
                        ['604800', '7 gün'],
                      ].map(([value, label]) => (
                        <Pressable
                          key={value}
                          style={[
                            styles.durationChoice,
                            deleteMessageSeconds === value && styles.durationChoiceActive,
                          ]}
                          onPress={() => setDeleteMessageSeconds(value!)}
                        >
                          <Text
                            style={[
                              styles.durationChoiceText,
                              deleteMessageSeconds === value && styles.durationChoiceTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : null}
                <Text style={styles.memberFieldLabel}>MODERASYON NEDENİ</Text>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  maxLength={512}
                  multiline
                  placeholder="İsteğe bağlı neden"
                  placeholderTextColor={colors.textDim}
                  style={[styles.forwardNote, styles.moderationReason]}
                />
                <Button
                  label={
                    moderation === 'timeout'
                      ? 'Sustur'
                      : moderation === 'kick'
                        ? 'Sunucudan at'
                        : 'Yasakla'
                  }
                  variant={moderation === 'timeout' ? 'primary' : 'danger'}
                  loading={busy}
                  onPress={() => void moderate()}
                />
                {moderation === 'timeout' && 'timeoutUntil' in member && member.timeoutUntil ? (
                  <Button
                    label="Timeout’u kaldır"
                    variant="secondary"
                    loading={busy}
                    onPress={() => void clearTimeout()}
                  />
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </SwipeableSheetSurface>
      </View>
    </Modal>
  );
}

function MessageActionSheet({
  message,
  kind,
  conversationId,
  serverLinkId,
  channelLinkId,
  ownUserId,
  canReply,
  canReact,
  canPin,
  canDelete,
  close,
  reply,
  forward,
  markUnread,
  edit,
  remove,
  togglePin,
  react,
}: {
  message: MobileMessage | null;
  kind: ThreadKind;
  conversationId?: string | undefined;
  serverLinkId?: string | undefined;
  channelLinkId?: string | undefined;
  ownUserId: string | undefined;
  canReply: boolean;
  canReact: boolean;
  canPin: boolean;
  canDelete: boolean;
  close(): void;
  reply(message: MobileMessage): void;
  forward(message: MobileMessage): void;
  markUnread(): void;
  edit(message: MobileMessage): void;
  remove(message: MobileMessage): void;
  togglePin(message: MobileMessage): void;
  react(message: MobileMessage, emoji: string): void;
}) {
  const { enabled: developerMode } = useDeveloperMode();
  const own = Boolean(message?.author?.id && message.author.id === ownUserId);
  const deleted = Boolean(message?.deleted);
  const { height } = useWindowDimensions();
  const [reportOpen, setReportOpen] = useState(false);
  const reportSubject: ReportSubject | undefined = message
    ? {
        kind: 'message',
        targetType:
          kind === 'channel'
            ? 'CHANNEL_MESSAGE'
            : kind === 'group'
              ? 'GROUP_MESSAGE'
              : 'DIRECT_MESSAGE',
        messageId: message.id,
        ...(message.content ? { preview: message.content } : {}),
      }
    : undefined;
  return (
    <>
      <Modal
        visible={Boolean(message) && !reportOpen}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          {message ? (
            <SwipeableSheetSurface
              onClose={close}
              style={[styles.actionSheet, { height: Math.min(height * 0.8, 740) }]}
            >
              {canReact ? (
                <View style={styles.quickReactions}>
                  {['👍', '❤️', '😂', '😮', '😢', '🔥'].map((emoji) => (
                    <Pressable
                      key={emoji}
                      style={styles.quickReaction}
                      onPress={() => react(message, emoji)}
                    >
                      <Text style={styles.quickReactionEmoji}>{emoji}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <Text style={styles.reactionHint}>
                {canReact ? 'Tepki vermek için dokun' : 'Mesaj işlemleri'}
              </Text>
              <View style={styles.actionMessagePreview}>
                <Text style={styles.actionMessageAuthor}>
                  {message.author?.displayName ?? 'Wapve'}
                </Text>
                <Text numberOfLines={2} style={styles.actionMessageText}>
                  {message.content ?? messagePreview(message)}
                </Text>
              </View>
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.actionList}
              >
                {!deleted && canReply ? (
                  <ActionRow icon="reply" label="Yanıtla" onPress={() => reply(message)} />
                ) : null}
                {!deleted ? (
                  <ActionRow icon="forward" label="Mesajı ilet" onPress={() => forward(message)} />
                ) : null}
                {message.content ? (
                  <ActionRow
                    icon="content-copy"
                    label="Metni kopyala"
                    onPress={() => {
                      void Clipboard.setStringAsync(message.content ?? '');
                      close();
                    }}
                  />
                ) : null}
                <ActionRow
                  icon="link-variant"
                  label="Mesaj bağlantısını kopyala"
                  onPress={() => {
                    void Clipboard.setStringAsync(
                      messageLink(kind, message.id, conversationId, serverLinkId, channelLinkId),
                    );
                    close();
                  }}
                />
                <ActionRow
                  icon="message-badge-outline"
                  label="Okunmadı işaretle"
                  onPress={markUnread}
                />
                {kind === 'channel' && !deleted && canPin ? (
                  <ActionRow
                    icon="pin-outline"
                    label={
                      'pinned' in message && message.pinned
                        ? 'Sabitlemeyi kaldır'
                        : 'Mesajı sabitle'
                    }
                    onPress={() => togglePin(message)}
                  />
                ) : null}
                {own && !deleted && message.content && canReply ? (
                  <ActionRow
                    icon="pencil-outline"
                    label="Mesajı düzenle"
                    onPress={() => edit(message)}
                  />
                ) : null}
                {developerMode ? (
                  <ActionRow
                    icon="identifier"
                    label="Mesaj ID’sini kopyala"
                    onPress={() => {
                      void Clipboard.setStringAsync(message.id);
                      close();
                    }}
                  />
                ) : null}
                <ActionRow
                  icon="account-outline"
                  label="Yazanın profilini aç"
                  onPress={() => {
                    close();
                    if (message.author)
                      router.push({
                        pathname: '/profile/[userId]',
                        params: {
                          userId: message.author.id,
                          name: message.author.displayName,
                          username: message.author.username,
                          avatar: message.author.avatarUrl ?? '',
                        },
                      });
                  }}
                />
                {!deleted ? (
                  <ActionRow
                    icon="flag-outline"
                    label="Mesajı bildir"
                    onPress={() => setReportOpen(true)}
                  />
                ) : null}
                {(own || canDelete) && !deleted ? (
                  <ActionRow
                    icon="trash-can-outline"
                    label="Mesajı sil"
                    danger
                    onPress={() => remove(message)}
                  />
                ) : null}
              </ScrollView>
            </SwipeableSheetSurface>
          ) : null}
        </View>
      </Modal>
      <ReportSheet
        visible={reportOpen}
        close={() => setReportOpen(false)}
        subject={reportSubject}
      />
    </>
  );
}

function messageLink(
  kind: ThreadKind,
  messageId: string,
  conversationId?: string,
  serverId?: string,
  channelId?: string,
) {
  if (kind === 'channel')
    return `https://wapve.com/channels/${serverId}/${channelId}#message-${messageId}`;
  const waveId = kind === 'group' ? `group:${conversationId}` : conversationId;
  return `https://wapve.com/waves/${encodeURIComponent(waveId ?? '')}#message-${messageId}`;
}

function ActionRow({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: IconName;
  label: string;
  danger?: boolean;
  onPress(): void;
}) {
  return (
    <Pressable style={styles.actionRow} onPress={onPress}>
      <View style={styles.actionIcon}>
        <Icon name={icon} color={danger ? colors.danger : colors.waveBright} size={23} />
      </View>
      <Text style={[styles.actionLabel, danger && styles.actionDanger]}>{label}</Text>
    </Pressable>
  );
}

function EditMessageSheet({
  message,
  value,
  setValue,
  close,
  save,
}: {
  message: MobileMessage | null;
  value: string;
  setValue(value: string): void;
  close(): void;
  save(): void;
}) {
  return (
    <Modal visible={Boolean(message)} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <SwipeableSheetSurface onClose={close} style={styles.actionSheet}>
          <Text style={styles.sheetTitle}>Mesajı düzenle</Text>
          <TextInput
            autoFocus
            value={value}
            onChangeText={setValue}
            style={[styles.pollInput, styles.editInput]}
            multiline
            maxLength={4_000}
            placeholderTextColor={colors.textDim}
          />
          <View style={styles.editActions}>
            <Button label="Vazgeç" variant="secondary" onPress={close} />
            <Button label="Kaydet" disabled={!value.trim()} onPress={save} />
          </View>
        </SwipeableSheetSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  iconButton: {
    width: touch.minimum,
    height: touch.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  list: { paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  loadingOlder: {
    color: colors.textDim,
    ...typography.caption,
    textAlign: 'center',
    padding: spacing.md,
  },
  daySeparator: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  separatorLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  daySeparatorText: { color: colors.textDim, ...typography.caption, fontWeight: '700' },
  newSeparator: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  newSeparatorLine: { flex: 1, height: 1, backgroundColor: colors.danger },
  newSeparatorText: {
    color: colors.danger,
    ...typography.caption,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  message: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 5,
    alignItems: 'flex-start',
    borderRadius: radius.sm,
  },
  swipeReplyShell: { position: 'relative' },
  swipeReplyAction: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    width: touch.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagePressed: { backgroundColor: colors.surfaceSoft },
  messageHighlighted: {
    backgroundColor: colors.surfaceRaised,
    borderLeftWidth: 3,
    borderLeftColor: colors.waveBright,
  },
  compact: { paddingTop: 1 },
  avatarSpacer: { width: 40 },
  messageBody: { flex: 1, minWidth: 0, paddingRight: spacing.sm },
  messageMeta: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginBottom: 2 },
  author: { color: colors.waveBright, ...typography.label, fontSize: 14 },
  time: { color: colors.textDim, fontSize: 10 },
  edited: { color: colors.textDim, fontSize: 10, fontStyle: 'italic' },
  messageText: { color: colors.text, ...typography.body, fontSize: 16, lineHeight: 22 },
  customEmojiText: { color: colors.waveBright, fontWeight: '700' },
  richMessage: { gap: 2 },
  boldText: { fontWeight: '800' },
  italicText: { fontStyle: 'italic' },
  inlineCode: {
    color: colors.cyan,
    backgroundColor: colors.surfaceRaised,
    fontFamily: Platform.select({ android: 'monospace', default: 'Courier' }),
  },
  spoiler: { color: colors.lineStrong, backgroundColor: colors.lineStrong, borderRadius: 3 },
  spoilerRevealed: { color: colors.text, backgroundColor: colors.surfaceRaised },
  codeBlock: {
    maxWidth: 340,
    marginVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink,
    overflow: 'hidden',
  },
  codeLanguage: {
    color: colors.textDim,
    ...typography.caption,
    fontWeight: '800',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  codeText: {
    color: colors.textMuted,
    fontFamily: Platform.select({ android: 'monospace', default: 'Courier' }),
    fontSize: 13,
    lineHeight: 19,
    padding: spacing.sm,
  },
  quoteBlock: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 2 },
  quoteLine: { width: 3, borderRadius: radius.pill, backgroundColor: colors.lineStrong },
  listLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingLeft: spacing.xs,
  },
  listBullet: { width: 14, color: colors.waveBright, ...typography.body },
  messageLink: { color: colors.cyan, textDecorationLine: 'underline' },
  messageLinkCard: {
    maxWidth: 340,
    minHeight: 76,
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  messageLinkCardCopy: { flex: 1, minWidth: 0 },
  messageLinkCardContext: { color: colors.waveBright, ...typography.caption, fontWeight: '800' },
  messageLinkCardAuthor: { color: colors.text, ...typography.label },
  messageLinkCardExcerpt: { color: colors.textMuted, ...typography.caption },
  externalLinkCard: {
    maxWidth: 340,
    marginTop: spacing.xs,
    padding: spacing.sm,
    gap: 4,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.waveBright,
    backgroundColor: colors.surface,
  },
  externalSite: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  externalSiteText: { color: colors.textDim, ...typography.caption },
  externalTitle: { color: colors.cyan, ...typography.label },
  inviteCard: {
    maxWidth: 340,
    marginTop: spacing.xs,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  inviteBanner: { height: 72, backgroundColor: colors.surfaceRaised },
  inviteBody: { padding: spacing.sm, gap: spacing.xs },
  inviteHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inviteChannel: {
    color: colors.textMuted,
    ...typography.caption,
    padding: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
  inviteAction: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.wave,
  },
  inviteActionText: { color: colors.text, ...typography.label },
  mentionText: {
    color: colors.waveBright,
    backgroundColor: colors.surfaceRaised,
    fontWeight: '700',
  },
  deleted: { color: colors.textDim, ...typography.body, fontStyle: 'italic' },
  unsupported: { color: colors.warning, ...typography.caption, fontStyle: 'italic' },
  replyPreview: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  replyPreviewText: { flex: 1, color: colors.textDim, ...typography.caption },
  replyPreviewAuthor: { color: colors.textMuted, fontWeight: '700' },
  systemRow: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 34,
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  systemText: { color: colors.textDim, ...typography.caption },
  forwarded: {
    flexDirection: 'row',
    marginVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  forwardLine: { width: 3, backgroundColor: colors.waveBright, borderRadius: radius.pill },
  forwardCopy: { flex: 1, gap: 2, padding: spacing.sm },
  forwardHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  forwardLabel: { color: colors.textDim, ...typography.caption },
  forwardAuthor: { color: colors.waveBright, ...typography.label },
  gifWrap: {
    width: 240,
    maxWidth: '100%',
    height: 180,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
  },
  gif: { width: '100%', height: '100%' },
  gifAlt: {
    position: 'absolute',
    left: 8,
    bottom: 6,
    right: 8,
    color: colors.text,
    ...typography.caption,
    textShadowColor: colors.ink,
    textShadowRadius: 4,
  },
  imageAttachment: {
    width: 260,
    maxWidth: '100%',
    height: 210,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
  },
  attachmentImage: { width: '100%', height: '100%' },
  attachment: {
    minHeight: 58,
    maxWidth: 310,
    marginTop: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  attachmentCopy: { flex: 1 },
  attachmentName: { color: colors.text, ...typography.label },
  attachmentMeta: { color: colors.textDim, ...typography.caption },
  audioAttachmentWrap: { maxWidth: 310, flexDirection: 'row', alignItems: 'center' },
  audioOpen: {
    width: 34,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -38,
    zIndex: 2,
  },
  poll: {
    maxWidth: 330,
    gap: spacing.xs,
    padding: spacing.sm,
    marginTop: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  pollQuestion: { color: colors.text, ...typography.heading },
  pollChoice: {
    minHeight: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  pollChoiceActive: { borderWidth: 1, borderColor: colors.waveBright },
  pollChoiceWinner: { borderWidth: 1, borderColor: colors.warning },
  pollFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.lineStrong,
  },
  pollText: { flex: 1, color: colors.text, ...typography.body },
  pollVotes: { color: colors.textMuted, ...typography.caption },
  pollFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: 2,
  },
  pollSummary: { color: colors.textDim, ...typography.caption },
  pollClosed: { color: colors.warning, fontWeight: '800' },
  reactionList: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5 },
  reactionChip: {
    minHeight: 30,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reactionChipActive: { borderColor: colors.waveBright, backgroundColor: colors.surfaceRaised },
  reactionEmoji: { fontSize: 17 },
  reactionCount: { color: colors.textMuted, ...typography.caption, fontWeight: '700' },
  reactionCountActive: { color: colors.waveBright },
  typingIndicator: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.canvas,
  },
  typingDots: { flexDirection: 'row', gap: 3 },
  typingDot: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.waveBright,
  },
  typingText: { color: colors.textMuted, ...typography.caption },
  empty: {
    minHeight: 430,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { color: colors.text, ...typography.title, marginTop: spacing.md },
  emptyBody: { color: colors.textDim, ...typography.body },
  jumpToPresent: {
    position: 'absolute',
    right: spacing.md,
    bottom: 72,
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.wave,
    borderWidth: 1,
    borderColor: colors.waveBright,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    elevation: 8,
    shadowColor: colors.ink,
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  jumpToPresentText: { color: colors.text, ...typography.label },
  headerNsfwBadge: {
    minWidth: 32,
    height: 21,
    paddingHorizontal: 5,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.55)',
  },
  headerNsfwText: { color: colors.danger, fontSize: 10, lineHeight: 13, fontWeight: '900' },
  uploadQueueScroll: {
    flexGrow: 0,
    height: 66,
    maxHeight: 66,
    backgroundColor: colors.canvas,
  },
  uploadQueue: {
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  uploadItem: {
    width: 218,
    height: 52,
    maxHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    paddingLeft: 6,
    overflow: 'hidden',
  },
  uploadItemError: { borderWidth: 1, borderColor: colors.warning },
  uploadThumbnail: { width: 40, height: 40, borderRadius: 9, backgroundColor: colors.surface },
  uploadFileIcon: {
    width: 40,
    height: 40,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  uploadCopy: { flex: 1, minWidth: 0 },
  uploadName: { color: colors.text, ...typography.caption, fontWeight: '700' },
  uploadMeta: { color: colors.textDim, fontSize: 10, lineHeight: 13 },
  uploadMetaError: { color: colors.warning },
  uploadProgressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: colors.line,
  },
  uploadProgressFill: { height: 3, backgroundColor: colors.cyan },
  retryUpload: { width: 34, height: 52, alignItems: 'center', justifyContent: 'center' },
  removeUpload: {
    width: 36,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordError: {
    color: colors.warning,
    ...typography.caption,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    backgroundColor: colors.canvas,
  },
  slowModeNotice: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.canvas,
  },
  slowModeText: { color: colors.warning, ...typography.caption },
  composerGateNotice: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  composerGateText: { flex: 1, color: colors.textMuted, ...typography.caption },
  replyBar: {
    minHeight: 52,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  replyLine: {
    width: 3,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.waveBright,
  },
  replyCopy: { flex: 1 },
  replyTitle: { color: colors.waveBright, ...typography.caption, fontWeight: '700' },
  replyExcerpt: { color: colors.textDim, ...typography.caption },
  replyMentionToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  replyMentionText: { color: colors.textMuted, ...typography.caption },
  mentionMenu: {
    maxHeight: 332,
    marginHorizontal: spacing.sm,
    padding: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  mentionCategory: {
    color: colors.textDim,
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginHorizontal: spacing.sm,
    marginTop: spacing.xs,
  },
  mentionRow: {
    minHeight: 52,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mentionChannelIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentionCopy: { flex: 1 },
  mentionLabel: { color: colors.text, ...typography.label },
  mentionDetail: { color: colors.textDim, ...typography.caption },
  composer: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  composerRecording: { backgroundColor: colors.surfaceSoft },
  roundAction: {
    width: touch.minimum,
    height: touch.minimum,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonActive: { backgroundColor: colors.danger },
  inputShell: {
    flex: 1,
    minHeight: touch.minimum,
    maxHeight: 132,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
  },
  input: {
    flex: 1,
    maxHeight: 132,
    minHeight: touch.minimum,
    color: colors.text,
    paddingLeft: spacing.md,
    paddingVertical: 9,
    ...typography.body,
    lineHeight: 22,
  },
  expressionButton: {
    width: touch.minimum,
    height: touch.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: {
    width: touch.minimum,
    height: touch.minimum,
    borderRadius: radius.pill,
    backgroundColor: colors.wave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlDisabled: { opacity: 0.42 },
  recordingState: {
    flex: 1,
    minHeight: touch.minimum,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  recordingDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger },
  recordingText: { color: colors.text, ...typography.label },
  recordingHint: { flex: 1, color: colors.textDim, ...typography.caption, textAlign: 'right' },
  expressionPanel: {
    backgroundColor: colors.ink,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  expressionTabs: {
    height: 42,
    flexDirection: 'row',
    backgroundColor: colors.canvas,
    borderRadius: radius.pill,
    padding: 3,
    marginBottom: spacing.xs,
  },
  expressionTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  expressionTabActive: { backgroundColor: colors.surfaceRaised },
  expressionTabText: { color: colors.textDim, ...typography.label },
  expressionTabTextActive: { color: colors.text },
  gifPanel: { flex: 1 },
  gifSearch: {
    height: 44,
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  gifSearchInput: { flex: 1, color: colors.text, ...typography.body },
  gifGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  gifCell: { width: '50%', padding: 3 },
  gifResult: {
    width: '100%',
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  gifShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,8,20,.18)' },
  gifTitle: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.xs,
    color: colors.text,
    ...typography.label,
    textShadowColor: colors.ink,
    textShadowRadius: 5,
  },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  topicSheet: {
    minHeight: 260,
    maxHeight: '74%',
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.canvas,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  topicIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  topicCopy: { flex: 1, gap: spacing.sm },
  topicName: { color: colors.text, ...typography.title },
  topicLabel: { color: colors.textDim, ...typography.caption, fontWeight: '800', letterSpacing: 1 },
  topicText: { color: colors.text, ...typography.body, lineHeight: 23 },
  topicEmpty: { color: colors.textDim, ...typography.body, fontStyle: 'italic' },
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.lineStrong,
    alignSelf: 'center',
  },
  sheetTitle: { color: colors.text, ...typography.title },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sheetDescription: { color: colors.textDim, ...typography.caption, marginTop: 2 },
  sheetSearch: {
    minHeight: touch.minimum,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sheetSearchInput: { flex: 1, color: colors.text, ...typography.body },
  browserResults: { gap: spacing.xs, paddingVertical: spacing.sm, paddingBottom: spacing.xxl },
  browserResult: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  browserResultCopy: { flex: 1, minWidth: 0 },
  browserResultMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  browserResultAuthor: { flex: 1, color: colors.text, ...typography.label },
  browserResultTime: { color: colors.textDim, ...typography.caption },
  browserResultText: { color: colors.textMuted, ...typography.body, marginTop: 3 },
  browserEmpty: {
    color: colors.textDim,
    ...typography.body,
    textAlign: 'center',
    padding: spacing.xl,
  },
  forwardTitleCopy: { flex: 1, minWidth: 0 },
  forwardTargets: { gap: spacing.xs, paddingVertical: spacing.sm, paddingBottom: spacing.lg },
  forwardTarget: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  forwardTargetActive: { backgroundColor: colors.surfaceRaised, borderColor: colors.waveBright },
  forwardTargetCopy: { flex: 1, minWidth: 0 },
  forwardTargetName: { color: colors.text, ...typography.label },
  forwardTargetSubtitle: { color: colors.textDim, ...typography.caption },
  forwardCheck: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forwardCheckActive: { backgroundColor: colors.wave, borderColor: colors.waveBright },
  forwardNote: {
    minHeight: touch.minimum,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.sm,
    ...typography.body,
  },
  sheetOptions: { flexDirection: 'row', gap: spacing.md, paddingRight: spacing.lg },
  sheetOption: { width: 72, alignItems: 'center', gap: spacing.xs },
  sheetOptionIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionText: { color: colors.textMuted, ...typography.caption, textAlign: 'center' },
  pollComposer: {
    maxHeight: '92%',
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  pollComposerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pollComposerHint: { color: colors.textDim, ...typography.caption, marginTop: 3 },
  pollInput: {
    minHeight: touch.minimum,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  pollOptions: { maxHeight: 300 },
  pollOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  pollOptionInput: { flex: 1 },
  removePollOption: {
    width: touch.minimum,
    height: touch.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPollOption: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  addPollOptionText: { color: colors.waveBright, ...typography.label },
  pollDurationLabel: {
    color: colors.textDim,
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  pollDurations: { gap: spacing.xs, paddingRight: spacing.lg },
  pollDuration: {
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  pollDurationActive: { borderColor: colors.waveBright, backgroundColor: colors.surfaceRaised },
  pollDurationText: { color: colors.textMuted, ...typography.caption },
  pollDurationTextActive: { color: colors.text, fontWeight: '800' },
  scheduleInput: { minHeight: 92, paddingVertical: spacing.sm, textAlignVertical: 'top' },
  scheduleComposer: {
    maxHeight: '92%',
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  scheduleLabel: {
    color: colors.textDim,
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 1,
  },
  dayChoices: { gap: spacing.xs, paddingRight: spacing.lg },
  dayChoice: {
    minWidth: 86,
    minHeight: 58,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: 'center',
  },
  dayChoiceActive: { borderColor: colors.waveBright, backgroundColor: colors.surfaceRaised },
  dayName: { color: colors.textMuted, ...typography.caption, fontWeight: '700' },
  dayDate: { color: colors.textDim, ...typography.caption },
  dayTextActive: { color: colors.text },
  timePicker: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  timeInput: {
    width: 64,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    color: colors.text,
    textAlign: 'center',
    ...typography.heading,
    fontVariant: ['tabular-nums'],
  },
  timeColon: { color: colors.text, ...typography.title },
  targetPreview: { flex: 1, color: colors.success, ...typography.caption, textAlign: 'right' },
  invalidTime: { color: colors.danger },
  scheduledList: { gap: spacing.xs, marginTop: spacing.xs },
  scheduledRow: {
    minHeight: 54,
    paddingLeft: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduledCopy: { flex: 1 },
  scheduledContent: { color: colors.textMuted, ...typography.caption },
  scheduledTime: { color: colors.textDim, fontSize: 10 },
  memberModal: { flex: 1 },
  memberBackdrop: { position: 'absolute', inset: 0, backgroundColor: colors.overlay },
  memberPanel: {
    width: '100%',
    height: '100%',
    marginLeft: 'auto',
    backgroundColor: colors.canvas,
  },
  memberSafe: { flex: 1 },
  channelDetailsTopbar: {
    minHeight: 64,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  channelDetailsActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  channelDetailsAction: {
    width: touch.minimum,
    height: touch.minimum,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  channelDetailsActionActive: {
    borderWidth: 1,
    borderColor: colors.waveBright,
    backgroundColor: colors.surfaceRaised,
  },
  channelHero: {
    minHeight: 88,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.canvas,
  },
  channelHeroShade: { position: 'absolute', inset: 0, backgroundColor: 'rgba(5, 9, 20, 0.58)' },
  channelMark: {
    width: 48,
    height: 48,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(27, 33, 48, 0.92)',
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  channelHeroCopy: { flex: 1, minWidth: 0, paddingBottom: 4 },
  channelName: { color: colors.text, ...typography.title, fontWeight: '900' },
  channelType: { color: colors.textMuted, ...typography.body, marginTop: 2 },
  channelTabsScroll: {
    flexGrow: 0,
    marginTop: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  channelTabs: { paddingHorizontal: spacing.md, gap: spacing.lg },
  channelTab: {
    minHeight: 52,
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  channelTabActive: { borderBottomColor: colors.waveBright },
  channelTabText: { color: colors.textDim, ...typography.label },
  channelTabTextActive: { color: colors.waveBright },
  memberList: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.lg },
  inviteMembersCard: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  inviteMembersIcon: {
    width: 50,
    height: 50,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  inviteMembersTitle: { color: colors.text, ...typography.heading },
  memberSection: { gap: spacing.xs },
  memberSectionTitle: {
    color: colors.textDim,
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
  },
  memberGroupCard: { overflow: 'hidden', borderRadius: radius.xl, backgroundColor: colors.surface },
  memberRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  memberNameplateRow: { overflow: 'hidden', backgroundColor: colors.surface },
  memberRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  memberRowPressed: { backgroundColor: colors.surfaceRaised },
  memberCopy: { flex: 1, minWidth: 0 },
  memberName: { color: colors.text, ...typography.label },
  memberUser: { color: colors.textDim, ...typography.caption },
  channelMediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  channelMediaCell: {
    width: '48.5%',
    aspectRatio: 1,
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  channelMediaVideo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  channelMediaFallback: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  channelMediaImage: { width: '100%', height: '100%' },
  channelMediaName: { color: colors.textMuted, ...typography.caption, textAlign: 'center' },
  channelPins: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
  channelPinCard: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  channelPinText: { color: colors.textMuted, ...typography.body, marginTop: 2 },
  channelTopicPage: { padding: spacing.md, paddingBottom: spacing.xxl },
  channelTopicCard: {
    minHeight: 126,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  detailsEmpty: {
    width: '100%',
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  detailsEmptyText: { color: colors.textDim, ...typography.body, textAlign: 'center' },
  actionSheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xs,
  },
  actionList: { paddingBottom: spacing.xxl },
  quickReactions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    paddingVertical: spacing.xs,
  },
  quickReaction: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 54,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  quickReactionEmoji: { fontSize: 25 },
  reactionHint: { color: colors.textDim, ...typography.caption, textAlign: 'center' },
  memberActionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  memberBadgeLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  memberActionName: { color: colors.text, ...typography.title },
  memberSubviewBack: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  memberSubviewBackText: { color: colors.waveBright, ...typography.label },
  memberSubview: { gap: spacing.sm, paddingBottom: spacing.xxl },
  memberSubviewTitle: { color: colors.text, ...typography.title },
  memberSubviewDescription: { color: colors.textDim, ...typography.body },
  inviteServerRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  roleToggleRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  roleColorDot: { width: 14, height: 14, borderRadius: radius.pill },
  roleToggleName: { flex: 1, color: colors.text, ...typography.label },
  memberFieldLabel: {
    color: colors.textDim,
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginTop: spacing.xs,
  },
  durationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  durationChoice: {
    minWidth: 92,
    minHeight: 42,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  durationChoiceActive: { borderColor: colors.waveBright, backgroundColor: colors.surfaceRaised },
  durationChoiceText: { color: colors.textMuted, ...typography.label },
  durationChoiceTextActive: { color: colors.text },
  moderationReason: { minHeight: 92, textAlignVertical: 'top', paddingVertical: spacing.sm },
  actionMessagePreview: {
    gap: 3,
    padding: spacing.sm,
    marginVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  actionMessageAuthor: { color: colors.waveBright, ...typography.label },
  actionMessageText: { color: colors.textMuted, ...typography.body },
  actionRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  actionIcon: { width: 30, alignItems: 'center' },
  actionLabel: { flex: 1, color: colors.text, ...typography.body },
  actionDanger: { color: colors.danger },
  editInput: { minHeight: 100, paddingVertical: spacing.sm, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
