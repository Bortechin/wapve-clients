'use client';
import { MediaPrivacyGuard } from './media-privacy-guard';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChannelMessage,
  GifSearchResult,
  MessagePage,
  MessageSource,
  ServerChannel,
  ServerMember,
  ServerRole,
  ServerEmoji,
  ServerSummary,
} from '@wapve/contracts';
import {
  BarChart3,
  CornerUpLeft,
  Copy,
  Clock3,
  Edit3,
  FileText,
  Flag,
  Forward,
  Headphones,
  LoaderCircle,
  Pin,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { ApiClientError, apiRequest, apiUpload } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';
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
import { RichMessageComposer } from './rich-message-composer';
import type { OpenUserProfile } from './user-profile-popover';
import { MarkdownRenderer } from './markdown-renderer';
import { VoiceMessagePlayer } from './voice-message-player';
import { MediaViewerDialog } from './media-viewer-dialog';
import { MemberContextMenu } from './member-context-menu';
import { MessageDateDivider } from './message-date-divider';
import type { ServerSettingsSection } from './server-settings-dialog';
import { PlatformOwnerIcon } from './platform-owner-icon';
import { AlphaMemberIcon } from './alpha-member-icon';
import { TypingIndicator } from './typing-indicator';
import { useUploadQueue } from '@/lib/upload-queue';
import { ForwardedMessageCard, ForwardMessageDialog } from './forward-message-dialog';
import { ContentReportDialog } from './content-report-dialog';
import { MessageReactionPicker } from './message-reaction-picker';
import { TextAttachmentActions } from './text-attachment-actions';
import { MessageMoreMenu } from './message-more-menu';
import { DeleteMessageDialog } from './delete-message-dialog';
import { ServerTagChip } from './server-tag-chip';
import {
  incrementReactionFrequency,
  quickReactions,
  readReactionFrequency,
  type ReactionFrequency,
} from '@/lib/reaction-frequency';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';
const MESSAGE_GROUP_WINDOW_MS = 7 * 60 * 1000;

export function ChannelMessages({
  serverId,
  channel,
  currentUserId,
  emailVerified,
  locale,
  messages,
  members,
  roles,
  channels,
  canMentionEveryone,
  canManageMessages,
  onOpenProfile,
  onSelectChannel,
  server,
  developerMode,
  onMembersChanged,
  onNotice,
  onOpenSettings,
  premiumActive,
  onPremiumRequired,
  compact = false,
  platformOwner = false,
  onSidePanelChange,
}: {
  serverId: string;
  channel: ServerChannel;
  currentUserId: string;
  emailVerified: boolean;
  locale: 'tr' | 'en';
  messages: Dictionary;
  members: ServerMember[];
  roles: ServerRole[];
  channels: ServerChannel[];
  canMentionEveryone: boolean;
  canManageMessages: boolean;
  onOpenProfile: OpenUserProfile;
  onSelectChannel: (channelId: string) => void;
  server: ServerSummary;
  developerMode: boolean;
  onMembersChanged: () => Promise<unknown>;
  onNotice: (notice: string) => void;
  onOpenSettings: (section: ServerSettingsSection) => void;
  premiumActive: boolean;
  onPremiumRequired: () => void;
  compact?: boolean;
  platformOwner?: boolean;
  onSidePanelChange?: (panel: 'search' | 'pins' | null) => void;
}) {
  const queryClient = useQueryClient();
  const key = ['channel-messages', channel.id] as const;
  const query = useQuery({
    queryKey: key,
    queryFn: () => apiRequest<MessagePage>(`/servers/${serverId}/channels/${channel.id}/messages`),
    enabled: true,
    refetchOnMount: 'always',
    refetchInterval: 5_000,
  });
  const emojisQuery = useQuery({
    queryKey: ['server-emojis', serverId],
    queryFn: () => apiRequest<ServerEmoji[]>(`/servers/${serverId}/emojis`),
    staleTime: 60_000,
  });
  const customEmojis = useMemo(() => emojisQuery.data ?? [], [emojisQuery.data]);
  const reactionFrequencyKey = `wapve:reaction-frequency:${currentUserId}:${serverId}`;
  const [reactionFrequency, setReactionFrequency] = useState<ReactionFrequency>({});
  const customEmojiTokens = useMemo(
    () =>
      customEmojis
        .filter((emoji) => premiumActive || !emoji.animated)
        .map((emoji) => `<:${emoji.name}:${emoji.id}>`),
    [customEmojis, premiumActive],
  );
  const quickReactionChoices = useMemo(
    () => quickReactions(reactionFrequency, customEmojiTokens),
    [customEmojiTokens, reactionFrequency],
  );
  const [replyTo, setReplyTo] = useState<ChannelMessage | null>(null);
  const [mentionReplyAuthor, setMentionReplyAuthor] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ChannelMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const draftKey = messageDraftKey(currentUserId, 'channel', channel.id);
  const uploadQueue = useUploadQueue();
  const [readBoundary, setReadBoundary] = useState<string | null>(null);
  const [nsfwConfirmed, setNsfwConfirmed] = useState(false);

  useEffect(() => {
    setReactionFrequency(readReactionFrequency(localStorage.getItem(reactionFrequencyKey)));
  }, [reactionFrequencyKey]);

  useEffect(() => {
    if (channel.nsfw) {
      const key = `nsfw-confirmed:${channel.id}`;
      setNsfwConfirmed(localStorage.getItem(key) === 'true');
    } else {
      setNsfwConfirmed(true);
    }
  }, [channel.id, channel.nsfw]);
  const [sidePanel, setSidePanel] = useState<'search' | 'pins' | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollDurationMinutes, setPollDurationMinutes] = useState(1440);
  const [now, setNow] = useState(() => Date.now());
  const [slowModeUntil, setSlowModeUntil] = useState(0);
  const [forwardSource, setForwardSource] = useState<MessageSource | null>(null);
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sidePanelRef = useRef<HTMLElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialScroll = useRef<string | null>(null);
  const boundaryChannel = useRef<string | null>(null);
  const atBottom = useRef(true);
  const markingRead = useRef(false);
  const pendingMediaScroll = useRef(false);
  const typingTimers = useRef<Map<string, number>>(new Map());
  const highlightedTimer = useRef<number | null>(null);
  const handledMessageLink = useRef<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [viewingOlderMessages, setViewingOlderMessages] = useState(false);
  const searchQuery = useQuery({
    queryKey: ['message-search', channel.id, searchTerm],
    queryFn: () =>
      apiRequest<ChannelMessage[]>(
        `/servers/${serverId}/channels/${channel.id}/messages/search?q=${encodeURIComponent(searchTerm)}`,
      ),
    enabled: sidePanel === 'search' && searchTerm.length >= 2,
  });
  const pinsQuery = useQuery({
    queryKey: ['message-pins', channel.id],
    queryFn: () =>
      apiRequest<ChannelMessage[]>(`/servers/${serverId}/channels/${channel.id}/messages/pins`),
    enabled: sidePanel === 'pins',
  });

  useEffect(() => {
    const openTool = (event: Event) => {
      const tool = (event as CustomEvent<'search' | 'pins'>).detail;
      if (tool !== 'search' && tool !== 'pins') return;
      setSidePanel((current) => (current === tool ? null : tool));
    };
    window.addEventListener('wapve:channel-message-tool', openTool);
    return () => window.removeEventListener('wapve:channel-message-tool', openTool);
  }, []);

  useEffect(() => {
    onSidePanelChange?.(sidePanel);
  }, [onSidePanelChange, sidePanel]);

  useEffect(() => {
    if (!sidePanel) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || sidePanelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-channel-message-tool-trigger]'))
        return;
      setSidePanel(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidePanel(null);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [sidePanel]);

  async function markRead() {
    if (markingRead.current) return;
    markingRead.current = true;
    try {
      await apiRequest(`/servers/${serverId}/channels/${channel.id}/messages/read`, {
        method: 'POST',
        body: '{}',
      });
      await queryClient.invalidateQueries({ queryKey: ['channel-unread'] });
    } catch {
      return;
    } finally {
      markingRead.current = false;
    }
  }

  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(`${SOCKET_URL}/chat`, { withCredentials: true });
    socketRef.current = socket;
    const join = () => socket.emit('channel:join', { channelId: channel.id });
    socket.on('connect', join);
    socket.on('chat:ready', join);

    socket.on('typing:update', (data: { userId: string; channelId: string }) => {
      if (data.channelId === channel.id && data.userId !== currentUserId) {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.add(data.userId);
          return next;
        });
        const currentTimer = typingTimers.current.get(data.userId);
        if (currentTimer) window.clearTimeout(currentTimer);
        const timer = window.setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.delete(data.userId);
            return next;
          });
          typingTimers.current.delete(data.userId);
        }, 5000);
        typingTimers.current.set(data.userId, timer);
      }
    });

    socket.on('message:created', (created: ChannelMessage) => {
      if (
        atBottom.current &&
        (Boolean(created.gif) || created.attachments.some((item) => item.kind === 'IMAGE'))
      )
        pendingMediaScroll.current = true;
      void queryClient.invalidateQueries({ queryKey: key });
      if (atBottom.current) void markRead();

      setTypingUsers((prev) => {
        const next = new Set(prev);
        if (created.author) next.delete(created.author.id);
        return next;
      });
    });
    for (const event of ['message:updated', 'message:deleted', 'message:reaction'])
      socket.on(event, () => {
        void queryClient.invalidateQueries({ queryKey: key });
        void queryClient.invalidateQueries({ queryKey: ['message-pins', channel.id] });
      });
    return () => {
      for (const timer of typingTimers.current.values()) window.clearTimeout(timer);
      typingTimers.current.clear();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [channel.id, currentUserId, queryClient]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setReplyTo(null);
    setMentionReplyAuthor(true);
    setEditingId(null);
    setDeleteTarget(null);
    setError('');
    setDraft(readMessageDraft(draftKey));
    uploadQueue.clear();
    setReadBoundary(null);
    setSidePanel(null);
    setSearchDraft('');
    setSearchTerm('');
    setPollOpen(false);
    setMediaViewerSrc(null);
    setHighlightedId(null);
    setSlowModeUntil(0);
    handledMessageLink.current = null;
    boundaryChannel.current = null;
    atBottom.current = true;
  }, [channel.id, draftKey, uploadQueue.clear]);

  const [mediaViewerSrc, setMediaViewerSrc] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    if (!query.data || initialScroll.current === channel.id) return;
    initialScroll.current = channel.id;
    if (boundaryChannel.current !== channel.id) {
      boundaryChannel.current = channel.id;
      setReadBoundary(query.data.lastReadAt);
    }
    window.requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView();
      atBottom.current = true;
      void markRead();
    });
  }, [channel.id, query.data]);

  const lastTypingRef = useRef<number>(0);
  function handleDraftChange(value: string) {
    setDraft(value);
    writeMessageDraft(draftKey, value);
    const now = Date.now();
    if (value && now - lastTypingRef.current > 3000) {
      lastTypingRef.current = now;
      socketRef.current?.emit('typing:start', { channelId: channel.id });
    }
  }

  async function send(fileOverride?: File) {
    const automaticVoiceMessage = Boolean(fileOverride);
    if ((!draft.trim() && uploadQueue.items.length === 0 && !fileOverride) || busy) return;
    setBusy(true);
    setError('');
    try {
      if (fileOverride) {
        const params = new URLSearchParams();
        if (replyTo) params.set('replyToId', replyTo.id);
        if (replyTo) params.set('mentionReplyAuthor', String(mentionReplyAuthor));
        const formData = new FormData();
        formData.set('file', fileOverride);
        await apiRequest(
          `/servers/${serverId}/channels/${channel.id}/messages/attachments?${params}`,
          { method: 'POST', body: formData },
        );
      } else if (uploadQueue.items.length > 0) {
        const includeContent = !uploadQueue.items.some((item) => item.status === 'complete');
        const uploaded = await uploadQueue.run(async (file, onProgress, signal, index) => {
          const params = new URLSearchParams();
          if (includeContent && index === 0 && draft.trim()) params.set('content', draft);
          if (includeContent && index === 0 && replyTo) params.set('replyToId', replyTo.id);
          if (includeContent && index === 0 && replyTo)
            params.set('mentionReplyAuthor', String(mentionReplyAuthor));
          const formData = new FormData();
          formData.set('file', file);
          await apiUpload(
            `/servers/${serverId}/channels/${channel.id}/messages/attachments?${params}`,
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
        await apiRequest(`/servers/${serverId}/channels/${channel.id}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            content: draft,
            replyToId: replyTo?.id ?? null,
            mentionReplyAuthor,
          }),
        });
      }
      if (!automaticVoiceMessage) {
        setDraft('');
        removeMessageDraft(draftKey);
        uploadQueue.clear();
      }
      if (!canManageMessages && channel.slowModeSeconds > 0)
        setSlowModeUntil(Date.now() + channel.slowModeSeconds * 1_000);
      setReplyTo(null);
      setMentionReplyAuthor(true);
      pendingMediaScroll.current = Boolean(
        fileOverride?.type.startsWith('image/') ||
          uploadQueue.items.some((item) => item.file.type.startsWith('image/')),
      );
      await queryClient.invalidateQueries({ queryKey: key });
      void markRead();
      window.requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
    } catch (caught) {
      handleComposerSendError(caught);
    } finally {
      setBusy(false);
    }
  }

  function handleComposerSendError(caught: unknown) {
    if (caught instanceof ApiClientError && caught.details.code === 'SLOWMODE_ACTIVE') {
      setSlowModeUntil(
        Date.now() +
          Math.max(1, caught.details.retryAfterSeconds ?? channel.slowModeSeconds) * 1_000,
      );
      setError('');
      return;
    }
    setError(errorMessage(caught, messages));
  }

  async function scheduleMessage(scheduledFor: string) {
    if (!draft.trim()) return;
    await apiRequest('/message-delivery/scheduled', {
      method: 'POST',
      body: JSON.stringify({
        target: { kind: 'CHANNEL', serverId, channelId: channel.id },
        content: draft,
        scheduledFor,
      }),
    });
    setDraft('');
    removeMessageDraft(draftKey);
    setReplyTo(null);
    onNotice(messages.messageScheduled);
  }

  async function sendGif(gif: GifSearchResult) {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/servers/${serverId}/channels/${channel.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          gifToken: gif.gifToken,
          replyToId: replyTo?.id ?? null,
          mentionReplyAuthor,
        }),
      });
      setReplyTo(null);
      setMentionReplyAuthor(true);
      if (!canManageMessages && channel.slowModeSeconds > 0)
        setSlowModeUntil(Date.now() + channel.slowModeSeconds * 1_000);
      pendingMediaScroll.current = true;
      await queryClient.invalidateQueries({ queryKey: key });
      void markRead();
      window.requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
    } catch (caught) {
      handleComposerSendError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(messageId: string) {
    const content = editContent.trim();
    if (!content) return;
    const currentContent = items.find((message) => message.id === messageId)?.content ?? '';
    if (content === currentContent) {
      setEditingId(null);
      setEditContent('');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/servers/${serverId}/channels/${channel.id}/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
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
    setError('');
    try {
      await apiRequest(`/servers/${serverId}/channels/${channel.id}/messages/${messageId}`, {
        method: 'DELETE',
      });
      setDeleteTarget((current) => (current?.id === messageId ? null : current));
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function react(message: ChannelMessage, emoji: string) {
    const active = message.reactions.some(
      (reaction) => reaction.emoji === emoji && reaction.reactedByMe,
    );
    const customEmoji = customEmojis.find(
      (candidate) => `<:${candidate.name}:${candidate.id}>` === emoji,
    );
    if (!active && customEmoji?.animated && !premiumActive) {
      onPremiumRequired();
      return;
    }
    setError('');
    try {
      await apiRequest(
        `/servers/${serverId}/channels/${channel.id}/messages/${message.id}/reactions`,
        { method: active ? 'DELETE' : 'POST', body: JSON.stringify({ emoji }) },
      );
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

  async function vote(messageId: string, choiceId: string) {
    setError('');
    try {
      await apiRequest(
        `/servers/${serverId}/channels/${channel.id}/messages/${messageId}/poll-votes`,
        { method: 'POST', body: JSON.stringify({ choiceId }) },
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: ['message-search', channel.id] }),
        queryClient.invalidateQueries({ queryKey: ['message-pins', channel.id] }),
      ]);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    }
  }

  async function togglePin(message: ChannelMessage) {
    setError('');
    try {
      await apiRequest(`/servers/${serverId}/channels/${channel.id}/messages/${message.id}/pin`, {
        method: message.pinned ? 'DELETE' : 'POST',
        ...(message.pinned ? {} : { body: '{}' }),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: ['message-pins', channel.id] }),
      ]);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    }
  }

  async function createPoll() {
    const options = pollOptions.map((option) => option.trim()).filter(Boolean);
    if (!pollQuestion.trim() || options.length < 2) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/servers/${serverId}/channels/${channel.id}/messages/polls`, {
        method: 'POST',
        body: JSON.stringify({
          question: pollQuestion,
          options,
          durationMinutes: pollDurationMinutes,
        }),
      });
      setPollQuestion('');
      setPollOptions(['', '']);
      setPollDurationMinutes(1440);
      setPollOpen(false);
      await queryClient.invalidateQueries({ queryKey: key });
      window.requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function loadOlder() {
    const cursor = query.data?.nextCursor;
    if (!cursor) return;
    setBusy(true);
    try {
      const older = await apiRequest<MessagePage>(
        `/servers/${serverId}/channels/${channel.id}/messages?before=${cursor}`,
      );
      queryClient.setQueryData<MessagePage>(key, (current) => ({
        items: mergeMessages(older.items, current?.items ?? []),
        nextCursor: older.nextCursor,
        lastReadMessageId: current?.lastReadMessageId ?? older.lastReadMessageId,
        lastReadAt: current?.lastReadAt ?? older.lastReadAt,
      }));
      setViewingOlderMessages(true);
    } finally {
      setBusy(false);
    }
  }

  const jumpToMessage = useCallback(
    async (messageId: string) => {
      setSidePanel(null);
      setError('');
      let available = queryClient
        .getQueryData<MessagePage>(['channel-messages', channel.id])
        ?.items.some((message) => message.id === messageId);
      if (!available) {
        try {
          const context = await apiRequest<ChannelMessage[]>(
            `/servers/${serverId}/channels/${channel.id}/messages/${messageId}/context`,
          );
          queryClient.setQueryData<MessagePage>(['channel-messages', channel.id], (current) =>
            current ? { ...current, items: mergeMessages(current.items, context) } : current,
          );
          available = context.some((message) => message.id === messageId);
        } catch (caught) {
          setError(errorMessage(caught, messages));
          return;
        }
      }
      if (!available) return;

      setViewingOlderMessages(true);

      setHighlightedId(messageId);
      if (highlightedTimer.current) window.clearTimeout(highlightedTimer.current);
      highlightedTimer.current = window.setTimeout(() => setHighlightedId(null), 2600);

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
    },
    [channel.id, messages, queryClient, serverId],
  );

  useEffect(() => {
    if (!query.data) return;
    const messageId = messageIdFromHash(window.location.hash);
    const linkKey = messageId ? `${channel.id}:${messageId}` : null;
    if (!messageId || handledMessageLink.current === linkKey) return;
    handledMessageLink.current = linkKey;
    void jumpToMessage(messageId);
  }, [channel.id, jumpToMessage, query.data]);

  useEffect(() => {
    const navigate = (event: Event) => {
      const target = (event as CustomEvent<MessageLinkTarget>).detail;
      if (!target || !isSameMessageRoute(target.pathname, window.location.pathname)) {
        return;
      }
      handledMessageLink.current = `${channel.id}:${target.messageId}`;
      void jumpToMessage(target.messageId);
    };
    window.addEventListener(MESSAGE_LINK_NAVIGATION_EVENT, navigate);
    return () => window.removeEventListener(MESSAGE_LINK_NAVIGATION_EVENT, navigate);
  }, [channel.id, jumpToMessage]);

  useEffect(
    () => () => {
      if (highlightedTimer.current) window.clearTimeout(highlightedTimer.current);
    },
    [],
  );

  async function copyMessageLink(messageId: string) {
    const link = `${window.location.origin}/channels/${server.publicId}/${channel.publicId}#message-${messageId}`;
    try {
      await copyTextPreservingScroll(link, scrollRef.current);
    } catch {
      onNotice(messages.copyFailed);
    }
  }

  async function jumpToPresent() {
    setError('');
    const url = new URL(window.location.href);
    url.hash = '';
    window.history.replaceState(window.history.state, '', url);
    await query.refetch();
    setViewingOlderMessages(false);
    atBottom.current = true;
    window.requestAnimationFrame(() =>
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }),
    );
  }

  const items = query.data?.items.filter((message) => !message.deleted) ?? [];
  const currentMember = members.find((member) => member.id === currentUserId);
  const timeoutUntil = currentMember?.timeoutUntil ? new Date(currentMember.timeoutUntil) : null;
  const timeoutActive = Boolean(timeoutUntil && timeoutUntil.getTime() > now);
  const latestMessageId = items.at(-1)?.id;
  useEffect(() => {
    if (!latestMessageId || !pendingMediaScroll.current) return;
    window.requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
  }, [latestMessageId]);
  const firstUnreadId = readBoundary
    ? items.find((message) => new Date(message.createdAt) > new Date(readBoundary))?.id
    : undefined;
  function openMessageAuthor(author: NonNullable<ChannelMessage['author']>, anchor: HTMLElement) {
    const member = members.find((item) => item.id === author.id);
    onOpenProfile(
      member ?? {
        ...author,
        bannerUrl: null,
        status: 'OFFLINE',
        customStatusText: null,
        customStatusEmoji: null,
        bio: null,
      },
      anchor,
    );
  }

  return (
    <div className={`message-view${compact ? ' message-view--compact' : ''}`}>
      {sidePanel && (
        <aside
          className="message-side-panel"
          ref={sidePanelRef}
          aria-label={sidePanel === 'search' ? messages.searchMessages : messages.pinnedMessages}
        >
          <header>
            <strong>
              {sidePanel === 'search' ? messages.searchMessages : messages.pinnedMessages}
            </strong>
            <button aria-label={messages.close} onClick={() => setSidePanel(null)}>
              <X size={17} />
            </button>
          </header>
          {sidePanel === 'search' ? (
            <>
              <form
                className="message-search-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setSearchTerm(searchDraft.trim());
                }}
              >
                <Search size={16} />
                <input
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder={messages.searchMessagesPlaceholder}
                  minLength={2}
                  maxLength={100}
                  autoFocus
                />
              </form>
              <MessageResultList
                items={searchQuery.data ?? []}
                pending={searchQuery.isPending && searchTerm.length >= 2}
                empty={
                  searchTerm.length < 2 ? messages.searchMessagesHint : messages.noSearchResults
                }
                messages={messages}
                locale={locale}
                onSelect={(message) => void jumpToMessage(message.id)}
                showPinnedIcon={false}
              />
            </>
          ) : (
            <MessageResultList
              items={pinsQuery.data ?? []}
              pending={pinsQuery.isPending}
              empty={messages.noPinnedMessages}
              messages={messages}
              locale={locale}
              onSelect={(message) => void jumpToMessage(message.id)}
              showPinnedIcon
            />
          )}
        </aside>
      )}
      <div
        className="message-scroll"
        aria-live="polite"
        ref={scrollRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          const distanceFromBottom =
            element.scrollHeight - element.scrollTop - element.clientHeight;
          const isAtBottom = distanceFromBottom < 48;
          const reachedBottom = isAtBottom && !atBottom.current;
          atBottom.current = isAtBottom;
          setViewingOlderMessages(distanceFromBottom > Math.max(640, element.clientHeight * 0.75));
          if (reachedBottom) void markRead();
        }}
      >
        {query.data?.nextCursor && (
          <button className="load-older" disabled={busy} onClick={() => void loadOlder()}>
            {messages.loadOlderMessages}
          </button>
        )}
        {query.isPending ? (
          <div className="message-loading">
            <LoaderCircle className="spin" />
            {messages.loading}
          </div>
        ) : channel.nsfw && !nsfwConfirmed ? (
          <div className="nsfw-gate">
            <div className="nsfw-gate-card">
              <span className="nsfw-gate-icon">🔞</span>
              <h2>Yaş Sınırlı Kanal</h2>
              <p>
                Bu kanal yaş sınırlı (NSFW) olarak işaretlenmiştir. Devam etmek için 18 yaşından
                büyük olduğunuzu onaylayın.
              </p>
              <button
                className="nsfw-gate-button"
                onClick={() => {
                  localStorage.setItem(`nsfw-confirmed:${channel.id}`, 'true');
                  setNsfwConfirmed(true);
                }}
              >
                18 Yaşından Büyüğüm, Devam Et
              </button>
            </div>
          </div>
        ) : (
          <>
            {!query.data?.nextCursor && (
              <div className="message-welcome">
                <div>{channel.type === 'VOICE' ? <Headphones size={28} /> : '#'}</div>
                <h2>
                  #{channel.name}
                  {channel.nsfw && <span className="nsfw-badge">NSFW</span>}{' '}
                  {messages.channelWelcomeSuffix}
                </h2>
                <p>{messages.firstMessageHint}</p>
              </div>
            )}
            {items.map((message, index) => {
              const messageMember = message.author
                ? members.find((member) => member.id === message.author?.id)
                : undefined;
              const startsNewDay = startsNewMessageDay(items, index);
              const grouped = !startsNewDay && shouldGroupMessage(items, index, firstUnreadId);
              return (
                <Fragment key={message.id}>
                  {startsNewDay && (
                    <MessageDateDivider createdAt={message.createdAt} locale={locale} />
                  )}
                  {message.id === firstUnreadId && (
                    <div className="new-message-divider" role="separator">
                      <span>{messages.newMessages}</span>
                    </div>
                  )}
                  {message.kind === 'SYSTEM_MODERATION' ? (
                    <article className="moderation-system-message" role="status">
                      <ShieldAlert size={18} />
                      <div>
                        <strong>{messages.system}</strong>
                        <span>
                          {(messages.automodEvents as Record<string, string>)[
                            message.systemAction ?? ''
                          ] ?? messages.automodActionApplied}
                        </span>
                      </div>
                      <time dateTime={message.createdAt}>
                        {new Intl.DateTimeFormat(locale, {
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(message.createdAt))}
                      </time>
                    </article>
                  ) : (
                    <MessageMemberContext
                      member={messageMember}
                      currentMember={currentMember}
                      currentUserId={currentUserId}
                      server={server}
                      roles={roles}
                      developerMode={developerMode}
                      messages={messages}
                      onChanged={onMembersChanged}
                      onNotice={onNotice}
                      onOpenSettings={onOpenSettings}
                      renderLeadingActions={(close) => (
                        <>
                          {emailVerified && (
                            <MessageReactionPicker
                              locale={locale}
                              label={messages.addReaction}
                              customEmojis={customEmojis}
                              customEmojiLabel={messages.serverEmojis}
                              premiumActive={premiumActive}
                              onPremiumRequired={() => {
                                close();
                                onPremiumRequired();
                              }}
                              triggerVariant="menu"
                              onSelect={(emoji) => {
                                close();
                                void react(message, emoji);
                              }}
                            />
                          )}
                          {emailVerified && channel.permissions.SEND_MESSAGES && (
                            <button
                              role="menuitem"
                              onClick={() => {
                                setReplyTo(message);
                                setMentionReplyAuthor(true);
                                close();
                              }}
                            >
                              <CornerUpLeft size={15} /> {messages.reply}
                            </button>
                          )}
                          {message.author?.id === currentUserId && message.content && (
                            <button
                              role="menuitem"
                              onClick={() => {
                                setEditingId(message.id);
                                setEditContent(message.content ?? '');
                                close();
                              }}
                            >
                              <Edit3 size={15} /> {messages.editMessage}
                            </button>
                          )}
                          {canManageMessages && (
                            <button
                              role="menuitem"
                              onClick={() => {
                                close();
                                void togglePin(message);
                              }}
                            >
                              <Pin size={15} />
                              {message.pinned ? messages.unpinMessage : messages.pinMessage}
                            </button>
                          )}
                          {message.content && (
                            <button
                              role="menuitem"
                              onClick={() => {
                                void navigator.clipboard.writeText(message.content ?? '');
                                close();
                              }}
                            >
                              <FileText size={15} /> {messages.copyMessage}
                            </button>
                          )}
                          <button
                            role="menuitem"
                            onClick={() => {
                              setForwardSource({
                                kind: 'CHANNEL',
                                serverId,
                                channelId: channel.id,
                                messageId: message.id,
                              });
                              close();
                            }}
                          >
                            <Forward size={15} /> {messages.forwardMessage}
                          </button>
                          <button
                            role="menuitem"
                            onClick={() => {
                              close();
                              void copyMessageLink(message.id);
                            }}
                          >
                            <Copy size={15} /> {messages.copyMessageLink}
                          </button>
                          <button
                            role="menuitem"
                            onClick={() => {
                              void navigator.clipboard.writeText(message.id);
                              close();
                            }}
                          >
                            <Copy size={15} /> {messages.copyMessageId}
                          </button>
                          <button
                            role="menuitem"
                            onClick={() => {
                              setReportMessageId(message.id);
                              close();
                            }}
                          >
                            <Flag size={15} /> {messages.reportMessage}
                          </button>
                        </>
                      )}
                      suppressLeadingActionsSelector=".message-avatar-button, .message-author-button"
                    >
                      <article
                        id={`message-${message.id}`}
                        tabIndex={-1}
                        className={`message-row${message.author!.id === currentUserId ? ' own-message' : ''}${grouped ? ' grouped-message' : ''}${highlightedId === message.id ? ' message-highlighted' : ''}`}
                      >
                        {grouped ? (
                          <time className="message-compact-time" dateTime={message.createdAt}>
                            {new Intl.DateTimeFormat(locale, {
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(new Date(message.createdAt))}
                          </time>
                        ) : (
                          <button
                            type="button"
                            className="message-avatar message-avatar-button"
                            aria-label={message.author!.displayName}
                            onClick={(event) =>
                              openMessageAuthor(message.author!, event.currentTarget)
                            }
                          >
                            {message.author!.avatarUrl ? (
                              <img src={message.author!.avatarUrl} alt="" />
                            ) : (
                              message.author!.displayName.slice(0, 1).toUpperCase()
                            )}
                          </button>
                        )}
                        <div className="message-body">
                          {message.replyTo && !message.replyTo.deleted && (
                            <button
                              className="reply-context"
                              onClick={() => void jumpToMessage(message.replyTo!.id)}
                            >
                              <CornerUpLeft size={13} />
                              <strong>@{message.replyTo.author.username}</strong>
                              <span>{message.replyTo.content}</span>
                            </button>
                          )}
                          {!grouped && (
                            <div className="message-meta">
                              {(() => {
                                const color = messageMember?.roles?.length
                                  ? [...messageMember.roles].sort(
                                      (a, b) => b.position - a.position,
                                    )[0]?.color
                                  : undefined;
                                return (
                                  <button
                                    className="message-author-button"
                                    style={{ color }}
                                    onClick={(event) => {
                                      openMessageAuthor(message.author!, event.currentTarget);
                                    }}
                                  >
                                    {message.author!.displayName}
                                  </button>
                                );
                              })()}
                              {message.author!.badges.length > 0 && (
                                <span className="message-author-badges">
                                  <PlatformOwnerIcon
                                    badges={message.author!.badges}
                                    locale={locale}
                                    size={17}
                                  />
                                  <AlphaMemberIcon
                                    badges={message.author!.badges}
                                    locale={locale}
                                    size={17}
                                  />
                                </span>
                              )}
                              {(messageMember?.serverTag ?? message.author!.serverTag) && (
                                <ServerTagChip
                                  tag={(messageMember?.serverTag ?? message.author!.serverTag)!}
                                  compact
                                />
                              )}
                              <time dateTime={message.createdAt}>
                                {new Intl.DateTimeFormat(locale, {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }).format(new Date(message.createdAt))}
                              </time>
                              {message.editedAt && <span>{messages.edited}</span>}
                              {message.pinned && (
                                <Pin size={12} aria-label={messages.pinnedMessage} />
                              )}
                            </div>
                          )}
                          {editingId === message.id ? (
                            <div className="message-edit">
                              <textarea
                                value={editContent}
                                {...(!platformOwner ? { maxLength: 2_500 } : {})}
                                onChange={(event) => setEditContent(event.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    void saveEdit(message.id);
                                  } else if (e.key === 'Escape') {
                                    setEditingId(null);
                                  }
                                }}
                                autoFocus
                                className="composer-input"
                              />
                              <div className="message-edit-actions">
                                <span>
                                  iptal etmek için <b>escape</b> • kaydetmek için <b>enter</b>
                                </span>
                                <div className="message-edit-buttons">
                                  <button
                                    className="button-cancel"
                                    onClick={() => setEditingId(null)}
                                  >
                                    İptal
                                  </button>
                                  <button
                                    className="button-save"
                                    onClick={() => void saveEdit(message.id)}
                                  >
                                    Kaydet
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              {message.content && (
                                <div>
                                  <MessageContent
                                    message={message}
                                    members={members}
                                    roles={roles}
                                    channels={channels}
                                    customEmojis={customEmojis}
                                    locale={locale}
                                    onOpenProfile={onOpenProfile}
                                    onSelectChannel={onSelectChannel}
                                  />
                                </div>
                              )}
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
                                      onLoad={() => {
                                        if (
                                          pendingMediaScroll.current &&
                                          message.id === latestMessageId
                                        ) {
                                          bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
                                          pendingMediaScroll.current = false;
                                        }
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
                                      visual={
                                        attachment.kind === 'IMAGE' || attachment.kind === 'VIDEO'
                                      }
                                      source="shared"
                                      authorId={message.author?.id}
                                      currentUserId={currentUserId}
                                      locale={locale}
                                    >
                                      {attachment.kind === 'IMAGE' ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setMediaViewerSrc({
                                              src: attachment.url,
                                              alt: attachment.name,
                                            })
                                          }
                                          className="block overflow-hidden rounded-md border border-white/10 hover:opacity-90 transition-opacity"
                                          key={attachment.id}
                                        >
                                          <img
                                            src={attachment.url}
                                            alt={attachment.name}
                                            loading="lazy"
                                            onLoad={() => {
                                              if (
                                                pendingMediaScroll.current &&
                                                message.id === latestMessageId
                                              ) {
                                                bottomRef.current?.scrollIntoView({
                                                  behavior: 'smooth',
                                                });
                                                pendingMediaScroll.current = false;
                                              }
                                            }}
                                          />
                                        </button>
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
                              {!message.deleted && message.poll && (
                                <div className="message-poll">
                                  <div>
                                    <BarChart3 size={18} />
                                    <strong>{message.poll.question}</strong>
                                  </div>
                                  {message.poll.choices.map((choice) => {
                                    const percentage = message.poll?.totalVotes
                                      ? Math.round((choice.votes / message.poll.totalVotes) * 100)
                                      : 0;
                                    return (
                                      <button
                                        className={`${choice.votedByMe ? 'active' : ''}${
                                          new Date(message.poll!.closesAt).getTime() <= now
                                            ? ' closed'
                                            : ''
                                        }`}
                                        key={choice.id}
                                        disabled={new Date(message.poll!.closesAt).getTime() <= now}
                                        onClick={() => void vote(message.id, choice.id)}
                                      >
                                        <i style={{ width: `${percentage}%` }} />
                                        <span>{choice.text}</span>
                                        <small>
                                          {choice.votes} · %{percentage}
                                        </small>
                                      </button>
                                    );
                                  })}
                                  <small>
                                    {messages.totalVotes.replace(
                                      '{count}',
                                      String(message.poll.totalVotes),
                                    )}{' '}
                                    ·{' '}
                                    {new Date(message.poll.closesAt).getTime() <= now
                                      ? messages.pollClosed
                                      : messages.pollEndsAt.replace(
                                          '{time}',
                                          new Intl.DateTimeFormat(locale, {
                                            dateStyle: 'medium',
                                            timeStyle: 'short',
                                          }).format(new Date(message.poll.closesAt)),
                                        )}
                                  </small>
                                </div>
                              )}
                            </>
                          )}
                          {grouped && (message.editedAt || message.pinned) && (
                            <div className="message-compact-status">
                              {message.editedAt && <span>{messages.edited}</span>}
                              {message.pinned && (
                                <Pin size={11} aria-label={messages.pinnedMessage} />
                              )}
                            </div>
                          )}
                          {!message.deleted && message.reactions.length > 0 && (
                            <div className="reaction-list">
                              {message.reactions.map((reaction) => {
                                const customEmoji = customEmojis.find(
                                  (emoji) => `<:${emoji.name}:${emoji.id}>` === reaction.emoji,
                                );
                                const missingName = reaction.emoji.match(/^<:([^:]+):/u)?.[1];
                                return (
                                  <button
                                    key={reaction.emoji}
                                    className={reaction.reactedByMe ? 'active' : ''}
                                    onClick={() => void react(message, reaction.emoji)}
                                  >
                                    {customEmoji ? (
                                      <img
                                        className="reaction-custom-emoji"
                                        src={customEmoji.url}
                                        alt={`:${customEmoji.name}:`}
                                      />
                                    ) : missingName ? (
                                      `:${missingName}:`
                                    ) : (
                                      reaction.emoji
                                    )}
                                    <span>{reaction.count}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        {!message.deleted && emailVerified && (
                          <div className="message-actions">
                            <div className="message-reaction-actions">
                              {quickReactionChoices.map((emojiToken) => {
                                const customEmoji = customEmojis.find(
                                  (emoji) => `<:${emoji.name}:${emoji.id}>` === emojiToken,
                                );
                                return (
                                  <button
                                    type="button"
                                    className="reaction-quick-button"
                                    key={emojiToken}
                                    title={customEmoji ? `:${customEmoji.name}:` : emojiToken}
                                    onClick={() => void react(message, emojiToken)}
                                  >
                                    {customEmoji ? (
                                      <img src={customEmoji.url} alt={`:${customEmoji.name}:`} />
                                    ) : (
                                      emojiToken
                                    )}
                                  </button>
                                );
                              })}
                              <span className="message-reaction-divider" aria-hidden="true" />
                              <MessageReactionPicker
                                locale={locale}
                                label={messages.addReaction}
                                customEmojis={customEmojis}
                                customEmojiLabel={messages.serverEmojis}
                                premiumActive={premiumActive}
                                onPremiumRequired={onPremiumRequired}
                                onSelect={(emoji) => void react(message, emoji)}
                              />
                            </div>
                            {message.author!.id === currentUserId ? (
                              message.content && (
                                <button
                                  aria-label={messages.editMessage}
                                  onClick={() => {
                                    setEditingId(message.id);
                                    setEditContent(message.content ?? '');
                                  }}
                                >
                                  <Edit3 size={15} />
                                </button>
                              )
                            ) : (
                              <button
                                aria-label={messages.reply}
                                onClick={() => {
                                  setReplyTo(message);
                                  setMentionReplyAuthor(true);
                                }}
                              >
                                <CornerUpLeft size={15} />
                              </button>
                            )}
                            <button
                              aria-label={messages.forwardMessage}
                              onClick={() =>
                                setForwardSource({
                                  kind: 'CHANNEL',
                                  serverId,
                                  channelId: channel.id,
                                  messageId: message.id,
                                })
                              }
                            >
                              <Forward size={15} />
                            </button>
                            <MessageMoreMenu
                              messages={messages}
                              pinned={message.pinned}
                              content={message.content}
                              canPin={canManageMessages}
                              canDelete={message.author!.id === currentUserId || canManageMessages}
                              showMessageId={developerMode}
                              onTogglePin={() => togglePin(message)}
                              onCopyContent={() =>
                                copyTextPreservingScroll(message.content ?? '', scrollRef.current)
                              }
                              onCopyLink={() => copyMessageLink(message.id)}
                              onCopyId={() =>
                                copyTextPreservingScroll(message.id, scrollRef.current)
                              }
                              onDelete={({ shiftKey } = {}) => {
                                if (shiftKey) {
                                  void remove(message.id);
                                } else {
                                  setDeleteTarget(message);
                                }
                              }}
                              onReport={() => setReportMessageId(message.id)}
                              onClose={() => {}}
                            />
                          </div>
                        )}
                      </article>
                    </MessageMemberContext>
                  )}
                  {message.poll && new Date(message.poll.closesAt).getTime() <= now && (
                    <PollResultNotice message={message} messages={messages} />
                  )}
                </Fragment>
              );
            })}
          </>
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
      {error && (
        <div className="message-error" role="alert">
          {error}
        </div>
      )}
      {typingUsers.size > 0 && (
        <TypingIndicator
          text={typingText(
            Array.from(typingUsers)
              .map((id) => members.find((member) => member.id === id)?.displayName)
              .filter((name): name is string => Boolean(name)),
            messages,
          )}
        />
      )}
      {timeoutActive && timeoutUntil && (
        <div className="timeout-composer-notice" role="status">
          <Clock3 size={18} />
          <span>
            <strong>{messages.timeoutComposerTitle}</strong>
            <small>
              {messages.timeoutComposerUntil.replace('{date}', timeoutUntil.toLocaleString(locale))}
              {currentMember?.timeoutReason
                ? ` · ${messages.timeoutComposerReason.replace('{reason}', currentMember.timeoutReason)}`
                : ''}
            </small>
          </span>
        </div>
      )}
      <div className="relative">
        {replyTo && (
          <div className="replying-to">
            <span>
              <strong>{replyTo.author!.displayName}</strong>{' '}
              {locale === 'tr' ? 'kişisine yanıt veriliyor' : 'is being replied to'}
            </span>
            <button
              className={`reply-mention-toggle${mentionReplyAuthor ? ' active' : ''}`}
              type="button"
              aria-pressed={mentionReplyAuthor}
              title={
                locale === 'tr'
                  ? 'Yanıtlanan kişiye bildirim gönder'
                  : 'Notify the person being replied to'
              }
              onClick={() => setMentionReplyAuthor((current) => !current)}
            >
              @{' '}
              {locale === 'tr'
                ? mentionReplyAuthor
                  ? 'AÇIK'
                  : 'KAPALI'
                : mentionReplyAuthor
                  ? 'ON'
                  : 'OFF'}
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label={messages.close}
              onClick={() => {
                setReplyTo(null);
                setMentionReplyAuthor(true);
              }}
            >
              <X size={15} />
            </button>
          </div>
        )}
        <RichMessageComposer
          value={draft}
          serverId={serverId}
          commandPermissions={server.permissions}
          canUseExternalEmojis={
            channel.permissions.USE_EXTERNAL_EMOJIS ??
            server.permissions.includes('USE_EXTERNAL_EMOJIS')
          }
          onChange={handleDraftChange}
          onSubmit={() => send()}
          onGif={sendGif}
          onPoll={() => setPollOpen(true)}
          onSchedule={scheduleMessage}
          members={members}
          roles={roles}
          channels={channels}
          customEmojis={customEmojis}
          premiumActive={premiumActive}
          onPremiumRequired={onPremiumRequired}
          canMentionEveryone={canMentionEveryone}
          uploadItems={uploadQueue.items}
          onFiles={(files) => {
            uploadQueue.add(files);
            setError('');
          }}
          onRemoveFile={uploadQueue.remove}
          onClearFiles={uploadQueue.clear}
          onVoiceMessage={send}
          onError={setError}
          disabled={!emailVerified || !channel.permissions.SEND_MESSAGES || timeoutActive}
          busy={busy}
          placeholder={
            !emailVerified
              ? messages.verifyToMessage
              : timeoutActive
                ? messages.timeoutComposerTitle
                : channel.permissions.SEND_MESSAGES
                  ? `${messages.messagePlaceholder} #${channel.name}`
                  : messages.cannotSendMessages
          }
          locale={locale}
          messages={messages}
          unlimitedText={platformOwner}
          statusText={
            !canManageMessages && channel.slowModeSeconds > 0
              ? slowModeUntil > now
                ? messages.slowModeCountdown.replace(
                    '{time}',
                    formatSlowModeRemaining(Math.ceil((slowModeUntil - now) / 1_000)),
                  )
                : messages.slowModeEnabled
              : undefined
          }
        />
      </div>
      <MediaViewerDialog
        src={mediaViewerSrc?.src ?? null}
        alt={mediaViewerSrc?.alt ?? ''}
        open={!!mediaViewerSrc}
        onOpenChange={(open) => !open && setMediaViewerSrc(null)}
      />
      <ForwardMessageDialog
        source={forwardSource}
        messages={messages}
        onClose={() => setForwardSource(null)}
      />
      <ContentReportDialog
        target={
          reportMessageId
            ? { type: 'CHANNEL_MESSAGE', id: reportMessageId, label: `#${channel.name}` }
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
          }
        }}
        onClose={() => setDeleteTarget(null)}
      />
      {pollOpen && (
        <div
          className="poll-dialog-backdrop"
          role="presentation"
          onMouseDown={() => setPollOpen(false)}
        >
          <section
            className="poll-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={messages.createPoll}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <BarChart3 size={20} />
                <strong>{messages.createPoll}</strong>
              </div>
              <button aria-label={messages.close} onClick={() => setPollOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <label>
              {messages.pollQuestion}
              <input
                value={pollQuestion}
                onChange={(event) => setPollQuestion(event.target.value)}
                maxLength={300}
                autoFocus
              />
            </label>
            <div className="poll-options-editor">
              {pollOptions.map((option, index) => (
                <label key={index}>
                  {messages.pollOption.replace('{number}', String(index + 1))}
                  <span>
                    <input
                      value={option}
                      onChange={(event) =>
                        setPollOptions((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item,
                          ),
                        )
                      }
                      maxLength={100}
                    />
                    {pollOptions.length > 2 && (
                      <button
                        aria-label={messages.removePollOption}
                        onClick={() =>
                          setPollOptions((current) =>
                            current.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                      >
                        <X size={15} />
                      </button>
                    )}
                  </span>
                </label>
              ))}
            </div>
            {pollOptions.length < 10 && (
              <button
                className="poll-add-option"
                onClick={() => setPollOptions((current) => [...current, ''])}
              >
                + {messages.addPollOption}
              </button>
            )}
            <label>
              {messages.pollDuration}
              <select
                value={pollDurationMinutes}
                onChange={(event) => setPollDurationMinutes(Number(event.target.value))}
              >
                <option value={60}>{messages.pollDurationOneHour}</option>
                <option value={240}>{messages.pollDurationFourHours}</option>
                <option value={480}>{messages.pollDurationEightHours}</option>
                <option value={1440}>{messages.pollDurationOneDay}</option>
                <option value={4320}>{messages.pollDurationThreeDays}</option>
                <option value={10080}>{messages.pollDurationOneWeek}</option>
              </select>
            </label>
            <button
              className="wapve-button wapve-button--primary"
              disabled={
                busy ||
                !pollQuestion.trim() ||
                pollOptions.filter((option) => option.trim()).length < 2
              }
              onClick={() => void createPoll()}
            >
              {messages.createPoll}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function formatSlowModeRemaining(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  return minutes > 0 ? `${minutes}:${String(safe % 60).padStart(2, '0')}` : `${safe}s`;
}

function shouldGroupMessage(
  items: ChannelMessage[],
  index: number,
  firstUnreadId: string | undefined,
): boolean {
  const message = items[index];
  const previous = items[index - 1];
  if (
    !message ||
    !previous ||
    message.id === firstUnreadId ||
    message.kind !== 'USER' ||
    previous.kind !== 'USER' ||
    !message.author ||
    !previous.author ||
    message.author.id !== previous.author.id ||
    message.replyTo ||
    message.deleted ||
    previous.deleted
  ) {
    return false;
  }
  const elapsed = new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime();
  return elapsed >= 0 && elapsed <= MESSAGE_GROUP_WINDOW_MS;
}

function MessageMemberContext({
  children,
  member,
  currentMember,
  currentUserId,
  server,
  roles,
  developerMode,
  messages,
  onChanged,
  onNotice,
  onOpenSettings,
  renderLeadingActions,
  suppressLeadingActionsSelector,
}: {
  children: ReactNode;
  member: ServerMember | undefined;
  currentMember: ServerMember | undefined;
  currentUserId: string;
  server: ServerSummary;
  roles: ServerRole[];
  developerMode: boolean;
  messages: Dictionary;
  onChanged: () => Promise<unknown>;
  onNotice: (notice: string) => void;
  onOpenSettings: (section: ServerSettingsSection) => void;
  renderLeadingActions: (close: () => void) => ReactNode;
  suppressLeadingActionsSelector?: string;
}) {
  if (!member) return <>{children}</>;
  return (
    <MemberContextMenu
      member={member}
      currentMember={currentMember}
      currentUserId={currentUserId}
      server={server}
      roles={roles}
      developerMode={developerMode}
      messages={messages}
      onChanged={onChanged}
      onNotice={onNotice}
      onOpenSettings={onOpenSettings}
      renderLeadingActions={renderLeadingActions}
      {...(suppressLeadingActionsSelector ? { suppressLeadingActionsSelector } : {})}
    >
      {children}
    </MemberContextMenu>
  );
}

function PollResultNotice({
  message,
  messages,
}: {
  message: ChannelMessage;
  messages: Dictionary;
}) {
  if (!message.poll || !message.author) return null;
  const highestVotes = Math.max(0, ...message.poll.choices.map((choice) => choice.votes));
  const winners = message.poll.choices.filter(
    (choice) => highestVotes > 0 && choice.votes === highestVotes,
  );
  return (
    <div className="poll-result-notice" role="status">
      <BarChart3 size={18} />
      <div>
        <span>
          <strong>{message.author.displayName}</strong>{' '}
          {messages.pollResultClosed.replace('{question}', message.poll.question)}
        </span>
        <b>
          {winners.length
            ? messages.pollWinningResult
                .replace('{choice}', winners.map((choice) => choice.text).join(', '))
                .replace('{votes}', String(highestVotes))
            : messages.pollNoVotes}
        </b>
      </div>
    </div>
  );
}

function MessageResultList({
  items,
  pending,
  empty,
  locale,
  messages,
  onSelect,
  showPinnedIcon,
}: {
  items: ChannelMessage[];
  pending: boolean;
  empty: string;
  locale: 'tr' | 'en';
  messages: Dictionary;
  onSelect: (message: ChannelMessage) => void;
  showPinnedIcon: boolean;
}) {
  if (pending)
    return (
      <div className="message-panel-empty">
        <LoaderCircle className="spin" size={18} /> {messages.loading}
      </div>
    );
  if (!items.length) return <div className="message-panel-empty">{empty}</div>;
  return (
    <div className="message-result-list">
      {items
        .filter((message) => message.author)
        .map((message) => (
          <button
            key={message.id}
            className="pinned-message-card"
            onClick={() => onSelect(message)}
          >
            <div className="pinned-message-header">
              {message.author!.avatarUrl ? (
                <img src={message.author!.avatarUrl} alt="" className="pinned-message-avatar" />
              ) : (
                <div className="pinned-message-avatar-fallback">
                  {message.author!.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="pinned-message-meta">
                <strong>{message.author!.displayName}</strong>
                <time dateTime={message.createdAt}>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }).format(new Date(message.createdAt))}
                </time>
              </div>
              {showPinnedIcon && <Pin size={14} className="pinned-message-icon" />}
            </div>
            <div className="pinned-message-content">
              <MarkdownRenderer
                content={message.content || message.poll?.question || messages.attachment}
                locale={locale}
              />
            </div>
            <span className="message-result-go">{messages.goToMessage}</span>
          </button>
        ))}
    </div>
  );
}

function mergeMessages(...groups: ChannelMessage[][]): ChannelMessage[] {
  const messages = new Map<string, ChannelMessage>();
  for (const group of groups) for (const message of group) messages.set(message.id, message);
  return [...messages.values()].sort((left, right) => {
    const time = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    return time || left.id.localeCompare(right.id);
  });
}

function typingText(names: string[], messages: Dictionary): string {
  if (!names.length) return messages.someoneTyping;
  if (names.length === 1) return messages.personTyping.replace('{name}', names[0]!);
  if (names.length > 2) return messages.severalTyping.replace('{count}', String(names.length));
  return messages.peopleTyping.replace('{names}', names.join(', '));
}

function MessageContent({
  message,
  members,
  roles,
  channels,
  customEmojis,
  locale,
  onOpenProfile,
  onSelectChannel,
}: {
  message: ChannelMessage;
  members: ServerMember[];
  roles: ServerRole[];
  channels: ServerChannel[];
  customEmojis: ServerEmoji[];
  locale: 'tr' | 'en';
  onOpenProfile: OpenUserProfile;
  onSelectChannel: (channelId: string) => void;
}) {
  return (
    <>
      <MarkdownRenderer
        content={message.content ?? ''}
        locale={locale}
        mentionNames={roles.map((role) => role.name.replace(/^@/u, ''))}
        members={members}
        roles={roles}
        channels={channels}
        customEmojis={customEmojis}
        onOpenMember={onOpenProfile}
        onOpenChannel={(mentionedChannel) => onSelectChannel(mentionedChannel.id)}
      />
    </>
  );
}
