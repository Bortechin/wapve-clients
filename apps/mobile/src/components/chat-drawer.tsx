import { TextInput, Text, Modal, Pressable } from '@/components/localized-native';
import { serverInviteUrl } from '@wapve/contracts';
import type {
  ChannelNotificationPreference,
  ChannelTree,
  ChannelUnreadSummary,
  DirectConversation,
  Friend,
  GroupConversation,
  NotificationLevel,
  NotificationMute,
  ServerChannel,
  ServerLayoutItem,
  ServerNotificationPreference,
  ServerInvite,
  ServerSummary,
  SocialUser,
  UserProfile,
  VoiceChannelSummary,
} from '@wapve/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import {
  BackHandler,
  Image,
  Share,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from '@/components/themed-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, motion, radius, spacing, touch, typography } from '@wapve/design-tokens';
import { api, realtime } from '@/lib/client';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useDeveloperMode } from '@/lib/developer-mode';
import { messagePreview } from '@/lib/message-presentation';
import { readCollapsedCategories, writeCollapsedCategories } from '@/lib/drawer-preferences';
import { readLastTextChannel } from '@/lib/last-text-channel';
import {
  createFolder,
  dropFolderInLayout,
  dropServerInLayout,
  extractServer,
  normalizeServerLayout,
} from '@/lib/server-layout';
import { Avatar, SecureImage } from './ui';
import { GameActivityLabel } from './game-activity';
import { ServerTagChip } from './server-tag';
import { Icon } from './icon';
import { OwnedBadgeStrip } from './platform-badges';
import { PresencePickerSheet, presenceLabel } from './presence-picker';
import { SwipeableSheetSurface } from './swipeable-sheet';
import { ReportSheet } from './report-sheet';
import { SocialUserActionsSheet } from './social-user-actions-sheet';
import { hasPremiumNameplate, PremiumNameplateBackground } from './premium-nameplate-background';
import { mobileProfileFrame } from './premium-cosmetic-registry';

// Metro resolves this numeric asset at bundle time.
const plusBadgeAsset = require('../../assets/premium/wapve-plus-badge.webp') as number;

export function ChatDrawer({
  children,
  openSignal = 0,
  initialServerId,
  initialChannelId,
  onSwipeLeft,
  disableSwipeLeft = false,
  swipeEnabled = true,
  openFromAnywhere = true,
}: PropsWithChildren<{
  openSignal?: number;
  initialServerId?: string | undefined;
  initialChannelId?: string | undefined;
  onSwipeLeft?(): void;
  disableSwipeLeft?: boolean;
  swipeEnabled?: boolean;
  openFromAnywhere?: boolean;
}>) {
  const { width } = useWindowDimensions();
  const drawerWidth = width;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { animate(false); return true; });
    return () => subscription.remove();
  }, [open]);
  const progress = useSharedValue(0);
  const start = useSharedValue(0);
  function animate(next: boolean) {
    setOpen(next);
    progress.value = withTiming(next ? 1 : 0, { duration: motion.normal });
  }
  useEffect(() => {
    if (openSignal > 0) animate(true);
  }, [openSignal]);
  const pan = Gesture.Pan()
    .enabled(swipeEnabled && open)
    .activeOffsetX([-12, 12])
    .onBegin(() => {
      start.value = progress.value;
    })
    .onUpdate((event) => {
      progress.value = Math.max(0, Math.min(1, start.value + event.translationX / drawerWidth));
    })
    .onEnd((event) => {
      if (!disableSwipeLeft && event.translationX < -72 && progress.value < 0.08 && onSwipeLeft) {
        runOnJS(onSwipeLeft)();
      }
      const next = event.velocityX > 450 || (event.velocityX > -450 && progress.value > 0.42);
      progress.value = withTiming(next ? 1 : 0, { duration: motion.normal });
      runOnJS(setOpen)(next);
    });
  const openPanBase = Gesture.Pan()
    .enabled(swipeEnabled && !open)
    .activeOffsetX(4)
    .failOffsetY([-24, 24])
    .shouldCancelWhenOutside(false)
    .onBegin(() => {
      start.value = 0;
    })
    .onUpdate((event) => {
      progress.value = Math.max(0, Math.min(1, event.translationX / drawerWidth));
    })
    .onEnd((event) => {
      const projectedProgress =
        progress.value + (Math.max(0, event.velocityX) / drawerWidth) * 0.12;
      const next = event.velocityX > 240 || progress.value > 0.16 || projectedProgress > 0.26;
      progress.value = withTiming(next ? 1 : 0, { duration: motion.normal });
      runOnJS(setOpen)(next);
    });
  const openPan = openFromAnywhere ? openPanBase : openPanBase.hitSlop({ left: 0, width: 96 });
  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -drawerWidth * (1 - progress.value) }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drawerWidth * progress.value * 0.16 }],
  }));
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.72,
    pointerEvents: progress.value > 0.02 ? 'auto' : 'none',
  }));
  return (
    <GestureDetector gesture={open ? pan : openPan}>
      <View style={styles.flex}>
        <Animated.View accessibilityElementsHidden={open} importantForAccessibility={open ? 'no-hide-descendants' : 'auto'} style={[styles.flex, contentStyle]}>{children}</Animated.View>
        <Animated.View style={[styles.overlay, overlayStyle]}>
          <Pressable
            style={styles.flex}
            accessibilityLabel="Çekmeceyi kapat"
            onPress={() => animate(false)}
          />
        </Animated.View>
        <Animated.View accessibilityElementsHidden={!open} importantForAccessibility={open ? 'auto' : 'no-hide-descendants'} style={[styles.drawer, { width: drawerWidth }, drawerStyle]}>
          <DrawerContent
            close={() => animate(false)}
            initialServerId={initialServerId}
            initialChannelId={initialChannelId}
          />
        </Animated.View>
        {!open && !openFromAnywhere ? (
          <Pressable
            accessibilityLabel="Sohbet çekmecesini aç"
            accessibilityHint="Sağa sürükleyebilir veya çift dokunabilirsin"
            onPress={() => animate(true)}
            style={styles.edgeHandle}
          />
        ) : null}
      </View>
    </GestureDetector>
  );
}

export function DrawerContent({
  close,
  initialServerId,
  initialChannelId,
}: {
  close(): void;
  initialServerId?: string | undefined;
  initialChannelId?: string | undefined;
}) {
  const { enabled: developerMode } = useDeveloperMode();
  const { t } = useI18n();
  const { user, logout, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [serverId, setServerId] = useState<string | null>(initialServerId ?? null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(initialChannelId ?? null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [presencePickerOpen, setPresencePickerOpen] = useState(false);
  const [serverMenu, setServerMenu] = useState<ServerSummary | null>(null);
  const [serverMenuAnchor, setServerMenuAnchor] = useState(120);
  const [folderTargetFor, setFolderTargetFor] = useState<ServerSummary | null>(null);
  const [folderMenu, setFolderMenu] = useState<ServerLayoutItem | null>(null);
  const [folderMenuAnchor, setFolderMenuAnchor] = useState(120);
  const [folderEdit, setFolderEdit] = useState<ServerLayoutItem | null>(null);
  const [channelMenu, setChannelMenu] = useState<ServerChannel | null>(null);
  const [socialMenu, setSocialMenu] = useState<
    | { kind: 'direct'; id: string; title: string; user: SocialUser }
    | { kind: 'group'; id: string; title: string }
    | null
  >(null);
  const [socialUserMenu, setSocialUserMenu] = useState<SocialUser | null>(null);
  const [inviteTarget, setInviteTarget] = useState<{
    server: ServerSummary;
    channel: ServerChannel | null;
  } | null>(null);
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Set<string>>(new Set());
  const [voiceSummary, setVoiceSummary] = useState<VoiceChannelSummary[]>([]);
  const servers = useQuery({
    queryKey: ['servers'],
    queryFn: () => api.request<ServerSummary[]>('/servers'),
    refetchOnMount: 'always',
    refetchInterval: 60_000,
  });
  const direct = useQuery({
    queryKey: ['dm-conversations'],
    queryFn: () => api.request<DirectConversation[]>('/dm/conversations'),
  });
  const groups = useQuery({
    queryKey: ['group-conversations'],
    queryFn: () => api.request<GroupConversation[]>('/dm/groups'),
  });
  const channelUnread = useQuery({
    queryKey: ['channel-unread'],
    queryFn: () => api.request<ChannelUnreadSummary[]>('/messages/unread'),
  });
  const profile = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => api.request<UserProfile>('/users/me'),
  });
  const channels = useQuery({
    queryKey: ['channels', serverId],
    enabled: Boolean(serverId),
    queryFn: () => api.request<ChannelTree>(`/servers/${serverId}/channels`),
  });
  useEffect(() => {
    if (!serverId) {
      setActiveChannelId(null);
      return;
    }
    if (serverId === initialServerId && initialChannelId) {
      setActiveChannelId(initialChannelId);
      return;
    }
    let active = true;
    void readLastTextChannel(serverId).then((remembered) => {
      if (active) setActiveChannelId(remembered?.channelId ?? null);
    });
    return () => {
      active = false;
    };
  }, [initialChannelId, initialServerId, serverId]);
  useEffect(() => {
    if (!serverId) {
      setCollapsedCategoryIds(new Set());
      return;
    }
    let active = true;
    void readCollapsedCategories(serverId).then((ids) => {
      if (active) setCollapsedCategoryIds(ids);
    });
    return () => {
      active = false;
    };
  }, [serverId]);
  useEffect(() => {
    if (!serverId) {
      setVoiceSummary([]);
      return;
    }
    let active = true;
    let cleanup = () => undefined;
    void realtime.connect('/voice').then((socket) => {
      if (!active) return;
      const receive = (summary: VoiceChannelSummary[]) => setVoiceSummary(summary);
      socket.on('voice:summary', receive);
      socket.emit('voice:watch', { serverId });
      cleanup = () => {
        socket.off('voice:summary', receive);
      };
    });
    return () => {
      active = false;
      cleanup();
    };
  }, [serverId]);
  const selected = servers.data?.find((server) => server.id === serverId);
  const currentProfile = profile.data ?? user;
  const publicSelf = useQuery({ queryKey: ['social-profile', currentProfile?.id], enabled: profileOpen && Boolean(currentProfile), queryFn: () => api.request<SocialUser>(`/social/users/${currentProfile!.id}/profile`) });
  const profileFrame = mobileProfileFrame(currentProfile?.premium?.profileEffect);
  const sortedDirect = useMemo(() => {
    const pins = new Set(currentProfile?.pinnedSocialConversations ?? []);
    return [...(direct.data ?? [])].sort(
      (left, right) =>
        Number(pins.has(`direct:${right.id}`)) - Number(pins.has(`direct:${left.id}`)),
    );
  }, [currentProfile?.pinnedSocialConversations, direct.data]);
  const sortedGroups = useMemo(() => {
    const pins = new Set(currentProfile?.pinnedSocialConversations ?? []);
    return [...(groups.data ?? [])].sort(
      (left, right) => Number(pins.has(`group:${right.id}`)) - Number(pins.has(`group:${left.id}`)),
    );
  }, [currentProfile?.pinnedSocialConversations, groups.data]);
  const socialUnread = useMemo(
    () =>
      [
        ...sortedDirect
          .filter((conversation) => conversation.unreadCount > 0)
          .map((conversation) => ({
            kind: 'direct' as const,
            id: conversation.id,
            title: conversation.otherUser.displayName,
            avatarUrl: conversation.otherUser.avatarUrl,
            count: conversation.unreadCount,
          })),
        ...sortedGroups
          .filter((conversation) => conversation.unreadCount > 0)
          .map((conversation) => ({
            kind: 'group' as const,
            id: conversation.id,
            title: conversation.name,
            avatarUrl: conversation.avatarUrl,
            count: conversation.unreadCount,
          })),
      ].slice(0, 3),
    [sortedDirect, sortedGroups],
  );
  const layout = useMemo(
    () =>
      normalizeServerLayout(
        profile.data?.serverLayout,
        (servers.data ?? []).map((server) => server.id),
      ),
    [profile.data?.serverLayout, servers.data],
  );
  const orderedCategories = useMemo(
    () =>
      [...(channels.data?.categories ?? [])].sort((left, right) => left.position - right.position),
    [channels.data?.categories],
  );
  const uncategorizedChannels = useMemo(
    () =>
      (channels.data?.channels ?? [])
        .filter((channel) => !channel.categoryId)
        .sort((left, right) => left.position - right.position),
    [channels.data?.channels],
  );
  const railEntries = useMemo(
    () =>
      layout.flatMap((item) =>
        item.type === 'folder' && item.expanded
          ? [
              { kind: 'folder' as const, id: item.id },
              ...(item.serverIds ?? []).map((id) => ({ kind: 'server' as const, id })),
            ]
          : [{ kind: item.type, id: item.id }],
      ),
    [layout],
  );
  async function persistLayout(next: ServerLayoutItem[]) {
    queryClient.setQueryData<UserProfile>(['me-profile'], (current) =>
      current ? { ...current, serverLayout: next } : current,
    );
    await api.request('/users/me', { method: 'PATCH', body: { serverLayout: next } });
    await profile.refetch();
  }
  function toggleCategory(categoryId: string) {
    setCollapsedCategoryIds((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      if (serverId) void writeCollapsedCategories(serverId, next);
      return next;
    });
  }
  async function markServerRead(targetServerId: string) {
    await api.request(`/messages/unread/servers/${targetServerId}/read`, {
      method: 'POST',
      body: {},
    });
    await queryClient.invalidateQueries({ queryKey: ['channel-unread'] });
  }
  async function markFolderRead(serverIds: string[]) {
    await Promise.all(serverIds.map((id) => markServerRead(id)));
  }
  async function updatePinnedConversation(kind: 'direct' | 'group', id: string) {
    if (!currentProfile) return;
    const key = `${kind}:${id}`;
    const pins = currentProfile.pinnedSocialConversations.includes(key)
      ? currentProfile.pinnedSocialConversations.filter((item) => item !== key)
      : [...currentProfile.pinnedSocialConversations, key];
    queryClient.setQueryData<UserProfile>(['me-profile'], {
      ...currentProfile,
      pinnedSocialConversations: pins,
    });
    try {
      const updated = await api.request<UserProfile>('/users/me', {
        method: 'PATCH',
        body: { pinnedSocialConversations: pins },
      });
      queryClient.setQueryData(['me-profile'], updated);
      await refreshUser();
    } catch (error) {
      queryClient.setQueryData(['me-profile'], currentProfile);
      throw error;
    }
  }
  async function updatePresence(status: UserProfile['status'], statusExpiresAt: string | null) {
    await api.request('/users/me', { method: 'PATCH', body: { status, statusExpiresAt } });
    await Promise.all([profile.refetch(), refreshUser()]);
  }
  function handleRailDrop(
    kind: 'server' | 'folder',
    sourceId: string,
    sourceIndex: number,
    _dx: number,
    dy: number,
  ) {
    const rawTargetIndex = sourceIndex + dy / 58;
    const targetIndex = Math.max(0, Math.min(railEntries.length - 1, Math.round(rawTargetIndex)));
    const target = railEntries[targetIndex];
    if (!target || target.id === sourceId) return;
    setServerMenu(null);
    setFolderMenu(null);
    if (kind === 'server') {
      const placement =
        Math.abs(rawTargetIndex - targetIndex) <= 0.34
          ? 'inside'
          : rawTargetIndex > targetIndex
            ? 'after'
            : 'before';
      void persistLayout(dropServerInLayout(layout, sourceId, target.id, placement));
      return;
    }
    void persistLayout(
      dropFolderInLayout(layout, sourceId, target.id, dy >= 0 ? 'after' : 'before'),
    );
  }
  function renderServer(server: ServerSummary, nested = false) {
    const index = railEntries.findIndex(
      (entry) => entry.kind === 'server' && entry.id === server.id,
    );
    const unread = (channelUnread.data ?? [])
      .filter((item) => item.serverId === server.id)
      .reduce(
        (total, item) => ({
          count: total.count + item.unreadCount,
          mentions: total.mentions + item.mentionCount,
        }),
        { count: 0, mentions: 0 },
      );
    return (
      <DraggableRailItem
        key={server.id}
        index={index}
        onPress={() => setServerId(server.id)}
        onHold={(anchorY) => {
          setServerMenuAnchor(anchorY);
          setServerMenu(server);
          setFolderMenu(null);
        }}
        onMoveStart={() => setServerMenu(null)}
        onDrop={(dx, dy) => handleRailDrop('server', server.id, index, dx, dy)}
      >
        <View
          style={[
            styles.serverButton,
            nested && styles.serverNested,
            serverId === server.id && styles.railActive,
          ]}
          accessibilityLabel={server.name}
        >
          {server.iconUrl ? (
            <SecureImage
              key={`${server.id}:${server.iconUrl}`}
              uri={server.iconUrl}
              style={nested ? styles.serverIconNested : styles.serverIcon}
              contentFit="cover"
              priority="high"
              transition={0}
            />
          ) : (
            <Text style={styles.serverInitial}>{server.name.slice(0, 2).toUpperCase()}</Text>
          )}
          {unread.count ? (
            <Text style={[styles.railUnread, unread.mentions ? styles.railUnreadMention : null]}>
              {unread.count > 99 ? '99+' : unread.count}
            </Text>
          ) : null}
        </View>
      </DraggableRailItem>
    );
  }
  function renderLayoutItem(item: ServerLayoutItem) {
    if (item.type === 'server') {
      const server = servers.data?.find((candidate) => candidate.id === item.id);
      return server ? renderServer(server) : null;
    }
    const folderServers = (item.serverIds ?? [])
      .map((id) => servers.data?.find((server) => server.id === id))
      .filter((server): server is ServerSummary => Boolean(server));
    const index = railEntries.findIndex((entry) => entry.kind === 'folder' && entry.id === item.id);
    return (
      <View key={item.id} style={styles.folderWrap}>
        <DraggableRailItem
          index={index}
          onPress={() =>
            void persistLayout(
              layout.map((candidate) =>
                candidate.id === item.id
                  ? { ...candidate, expanded: !candidate.expanded }
                  : candidate,
              ),
            )
          }
          onHold={(anchorY) => {
            setFolderMenuAnchor(anchorY);
            setFolderMenu(item);
            setServerMenu(null);
          }}
          onMoveStart={() => setFolderMenu(null)}
          onDrop={(dx, dy) => handleRailDrop('folder', item.id, index, dx, dy)}
        >
          <View
            style={[styles.folderButton, { borderColor: item.color ?? colors.wave }]}
            accessibilityLabel={item.name ?? 'Sunucu klasörü'}
          >
            <View style={styles.folderGrid}>
              {folderServers.slice(0, 4).map((server) => (
                <View key={server.id} style={styles.folderMini}>
                  {server.iconUrl ? (
                    <SecureImage
                      key={`${item.id}:${server.id}:${server.iconUrl}`}
                      uri={server.iconUrl}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      priority="high"
                      transition={0}
                    />
                  ) : (
                    <Text style={styles.folderMiniText}>{server.name.slice(0, 1)}</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        </DraggableRailItem>
        {item.expanded ? (
          <View style={styles.folderChildren}>
            {folderServers.map((server) => renderServer(server, true))}
          </View>
        ) : null}
      </View>
    );
  }
  function go(path: Parameters<typeof router.push>[0]) {
    close();
    router.push(path);
  }
  function renderChannel(channel: ServerChannel) {
    const unread = channelUnread.data?.find((item) => item.channelId === channel.id);
    const selectedChannel = channel.id === activeChannelId;
    const hasUnread = Boolean(unread?.unreadCount);
    const participants =
      voiceSummary.find((item) => item.channelId === channel.id)?.participants ?? [];
    return (
      <View key={channel.id}>
        <Pressable
          style={[styles.channelRow, selectedChannel && styles.channelRowSelected]}
          delayLongPress={350}
          onLongPress={() => setChannelMenu(channel)}
          onPress={() => {
            setActiveChannelId(channel.id);
            go(
              channel.type === 'VOICE'
                ? {
                    pathname: '/voice/[serverId]/[channelId]',
                    params: { serverId: serverId!, channelId: channel.id, name: channel.name },
                  }
                : {
                    pathname: '/channel/[serverId]/[channelId]',
                    params: { serverId: serverId!, channelId: channel.id, name: channel.name },
                  },
            );
          }}
          accessibilityState={{ selected: selectedChannel }}
          accessibilityHint="Kanal işlemleri için basılı tut"
        >
          <Icon
            name={channel.type === 'VOICE' ? 'volume-high' : 'pound'}
            color={selectedChannel || hasUnread ? colors.text : colors.textDim}
            size={21}
          />
          {channel.nsfw ? (
            <View style={styles.nsfwBadge} accessibilityLabel={t('ageRestrictedChannel')}>
              <Text style={styles.nsfwBadgeText}>18+</Text>
            </View>
          ) : null}
          <View style={styles.rowCopy}>
            <Text
              numberOfLines={1}
              style={[
                styles.channelTitle,
                hasUnread && styles.channelTitleUnread,
                selectedChannel && styles.channelTitleSelected,
              ]}
            >
              {channel.name}
            </Text>
          </View>
          {channel.type === 'TEXT' && unread?.mentionCount ? (
            <Text style={styles.badge}>
              {unread.mentionCount > 99 ? '99+' : unread.mentionCount}
            </Text>
          ) : channel.type === 'TEXT' && unread?.unreadCount ? (
            <View style={styles.channelUnreadDot} />
          ) : participants.length ? (
            <Text style={styles.voiceCount}>
              {new Set(participants.map((item) => item.userId)).size}
            </Text>
          ) : null}
        </Pressable>
        {channel.type === 'VOICE' && participants.length ? (
          <View style={styles.voiceParticipants}>
            {participants.map((participant) => (
              <Pressable
                key={participant.connectionId}
                style={styles.voiceParticipant}
                onPress={() => {
                  close();
                  router.push({
                    pathname: '/profile/[userId]',
                    params: { userId: participant.userId },
                  });
                }}
              >
                <Avatar name={participant.displayName} uri={participant.avatarUrl} size={28} />
                <Text numberOfLines={1} style={styles.voiceParticipantName}>
                  {participant.displayName}
                </Text>
                {participant.muted ? (
                  <Icon name="microphone-off" color={colors.danger} size={16} />
                ) : participant.deafened ? (
                  <Icon name="headphones-off" color={colors.danger} size={16} />
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    );
  }
  return (
    <View style={styles.drawerBody}>
      <View style={[styles.drawerMain, { paddingTop: insets.top }]}>
        <View style={styles.rail}>
          <Pressable
            style={[styles.railButton, !serverId && styles.railActive]}
            onPress={() => setServerId(null)}
            accessibilityLabel="Waves"
          >
            <Text style={styles.waveIcon}>≈</Text>
          </Pressable>
          {socialUnread.length ? (
            <View style={styles.socialUnreadRail} accessibilityLabel="Okunmamış konuşmalar">
              {socialUnread.map((conversation) => (
                <Pressable
                  key={`${conversation.kind}:${conversation.id}`}
                  style={styles.socialUnreadButton}
                  accessibilityLabel={t('socialUnreadLabel', {
                    title: conversation.title,
                    count: conversation.count,
                  })}
                  onPress={() =>
                    go({
                      pathname:
                        conversation.kind === 'direct'
                          ? '/dm/[conversationId]'
                          : '/group/[conversationId]',
                      params: { conversationId: conversation.id, name: conversation.title },
                    })
                  }
                >
                  <Avatar name={conversation.title} uri={conversation.avatarUrl} size={42} />
                  <Text style={[styles.railUnread, styles.railUnreadMention]}>
                    {conversation.count > 99 ? '99+' : conversation.count}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.railDivider} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.railList}>
            {layout.map(renderLayoutItem)}
            <Pressable
              style={styles.addServer}
              onPress={() => go('/servers/create')}
              accessibilityLabel="Sunucu ekle"
            >
              <Icon name="plus" color={colors.success} size={26} />
            </Pressable>
            <Pressable
              style={styles.addServer}
              onPress={() => go('/discover' as never)}
              accessibilityLabel="Sunucu keşfet"
            >
              <Icon name="compass-outline" color={colors.waveBright} size={25} />
            </Pressable>
          </ScrollView>
        </View>
        <View style={styles.listPane}>
          {selected?.bannerUrl ? <SecureImage uri={selected.bannerUrl} style={{ width: '100%', height: 112 }} contentFit="cover" /> : null}
          <View style={styles.drawerHeader}>
            {!serverId ? <Pressable style={styles.iconButton} onPress={() => go('/(tabs)/notifications')} accessibilityLabel={t('notifications')}><Icon name="bell-outline" color={colors.textMuted} size={24} /></Pressable> : null}
            <Pressable style={{ flex: 1, minWidth: 0, minHeight: 48, justifyContent: 'center' }} disabled={!selected} onPress={() => selected && setServerMenu(selected)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text numberOfLines={1} style={styles.drawerTitle}>{selected?.name ?? 'Mesajlar'}</Text>
                {selected ? <Icon name="chevron-right" size={22} color={colors.textMuted} /> : null}
              </View>
              {selected ? <Text style={styles.rowMeta}>{selected.memberCount} üye</Text> : null}
            </Pressable>
            {serverId ? (
              <View style={styles.drawerHeaderActions}>
                <Pressable
                  style={styles.iconButton}
                  onPress={() => go('/search')}
                  accessibilityLabel={t('search')}
                >
                  <Icon name="magnify" color={colors.textMuted} size={25} />
                </Pressable>
              </View>
            ) : null}
          </View>
          {!serverId ? (
            <View style={styles.messageToolbar}>
              <Pressable
                style={styles.searchButton}
                onPress={() => go('/search')}
                accessibilityLabel={t('search')}
              >
                <Icon name="magnify" color={colors.textMuted} size={25} />
              </Pressable>
              <Pressable
                style={styles.addFriendButton}
                onPress={() => go('/friends/add')}
                accessibilityLabel="Arkadaş ekle"
              >
                <Icon name="account-plus-outline" color={colors.text} size={25} />
              </Pressable>
              <Pressable
                style={styles.composeButton}
                onPress={() => go('/compose')}
                accessibilityLabel="Yeni mesaj"
              >
                <Icon name="plus" color={colors.text} size={28} />
              </Pressable>
            </View>
          ) : null}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.sectionScroll}
            contentContainerStyle={styles.sections}
          >
            {serverId ? (
              <>
                {selected?.bannerUrl ? (
                  <View style={styles.serverBanner}>
                    <SecureImage
                      uri={selected.bannerUrl}
                      revision={servers.dataUpdatedAt}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                    <View style={styles.serverBannerShade} />
                    <View style={styles.serverBannerCopy}>
                      <Text numberOfLines={2} style={styles.serverBannerTitle}>
                        {selected.name}
                      </Text>
                      <Text style={styles.serverBannerMeta}>{selected.memberCount} üye</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.serverIntro}>
                    <Text numberOfLines={2} style={styles.serverBannerTitle}>
                      {selected?.name}
                    </Text>
                    <Text style={styles.serverBannerMeta}>{selected?.memberCount ?? 0} üye</Text>
                  </View>
                )}
                <Pressable
                  style={styles.mobileSupportGoal}
                  onPress={() =>
                    go({ pathname: '/servers/[serverId]/supports', params: { serverId } } as never)
                  }
                >
                  <View style={styles.mobileSupportCopy}>
                    <Icon name="diamond-stone" size={17} color={colors.waveBright} />
                    <Text style={styles.mobileSupportTitle}>Takviye Hedefi</Text>
                  </View>
                  <Text style={styles.mobileSupportCount}>
                    {selected?.supportCount ?? 0}/
                    {(selected?.supportCount ?? 0) < 2
                      ? 2
                      : (selected?.supportCount ?? 0) < 5
                        ? 5
                        : 10}
                  </Text>
                </Pressable>
                {uncategorizedChannels.length ? (
                  <>
                    <Text style={styles.sectionLabel}>KANALLAR</Text>
                    {uncategorizedChannels.map(renderChannel)}
                  </>
                ) : null}
                {orderedCategories.map((category) => {
                  const collapsed = collapsedCategoryIds.has(category.id);
                  const categoryChannels = (channels.data?.channels ?? [])
                    .filter((channel) => channel.categoryId === category.id)
                    .sort((left, right) => left.position - right.position);
                  return (
                    <View key={category.id} style={styles.channelCategory}>
                      <Pressable
                        style={styles.categoryHeader}
                        onPress={() => toggleCategory(category.id)}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: !collapsed }}
                      >
                        <Icon
                          name={collapsed ? 'chevron-right' : 'chevron-down'}
                          color={colors.textDim}
                          size={18}
                        />
                        <Text numberOfLines={1} style={styles.categoryTitle}>
                          {category.name.toLocaleUpperCase('tr')}
                        </Text>
                      </Pressable>
                      {collapsed ? null : categoryChannels.map(renderChannel)}
                    </View>
                  );
                })}
              </>
            ) : (
              <>
                <Pressable
                  style={[styles.row, styles.plusRow]}
                  onPress={() => go('/premium' as never)}
                >
                  <Image source={plusBadgeAsset} style={styles.plusRowBadge} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>Wapve+</Text>
                    <Text style={styles.rowMeta}>Üyelik, koleksiyon ve takviyeler</Text>
                  </View>
                </Pressable>
                <Pressable style={styles.row} onPress={() => go('/(tabs)')}>
                  <View style={styles.wavesRowIcon}>
                    <Text style={styles.waveRowGlyph}>≈</Text>
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>Waves</Text>
                    <Text style={styles.rowMeta}>Ana sayfa</Text>
                  </View>
                </Pressable>
                <Pressable style={styles.row} onPress={() => go('/friends')}>
                  <Icon name="account-multiple-outline" color={colors.textMuted} size={23} />
                  <Text style={styles.rowTitle}>{t('friends')}</Text>
                </Pressable>
                <Text style={styles.sectionLabel}>
                  {t('directMessages').toLocaleUpperCase('tr')}
                </Text>
                {sortedDirect.map((conversation) => (
                  <Pressable
                    key={conversation.id}
                    style={styles.row}
                    delayLongPress={350}
                    onLongPress={() =>
                      setSocialMenu({
                        kind: 'direct',
                        id: conversation.id,
                        title: conversation.otherUser.displayName,
                        user: conversation.otherUser,
                      })
                    }
                    onPress={() =>
                      go({
                        pathname: '/dm/[conversationId]',
                        params: {
                          conversationId: conversation.id,
                          name: conversation.otherUser.displayName,
                        },
                      })
                    }
                  >
                    <Avatar
                      name={conversation.otherUser.displayName}
                      uri={conversation.otherUser.avatarUrl}
                      size={38}
                      online={conversation.otherUser.status === 'ONLINE'}
                    />
                    <View style={styles.rowCopy}>
                      <Text numberOfLines={1} style={styles.rowTitle}>
                        {conversation.otherUser.displayName}
                      </Text>
                      <Text numberOfLines={1} style={styles.rowMeta}>
                        {conversation.otherUser.customStatusText
                          ? `${conversation.otherUser.customStatusEmoji ? `${conversation.otherUser.customStatusEmoji} ` : ''}${conversation.otherUser.customStatusText}`
                          : conversation.lastMessage
                            ? messagePreview(conversation.lastMessage)
                            : `@${conversation.otherUser.username}`}
                      </Text>
                      <GameActivityLabel person={conversation.otherUser} />
                      <ServerTagChip tag={conversation.otherUser.serverTag} />
                    </View>
                    {conversation.unreadCount ? (
                      <Text style={styles.badge}>{conversation.unreadCount}</Text>
                    ) : currentProfile?.pinnedSocialConversations.includes(
                        `direct:${conversation.id}`,
                      ) ? (
                      <Icon name="pin" color={colors.textDim} size={16} />
                    ) : null}
                  </Pressable>
                ))}
                <Text style={styles.sectionLabel}>GRUPLAR</Text>
                {sortedGroups.map((group) => (
                  <Pressable
                    key={group.id}
                    style={styles.row}
                    delayLongPress={350}
                    onLongPress={() =>
                      setSocialMenu({ kind: 'group', id: group.id, title: group.name })
                    }
                    onPress={() =>
                      go({
                        pathname: '/group/[conversationId]',
                        params: { conversationId: group.id, name: group.name },
                      })
                    }
                  >
                    <Avatar name={group.name} uri={group.avatarUrl} size={38} />
                    <View style={styles.rowCopy}>
                      <Text numberOfLines={1} style={styles.rowTitle}>
                        {group.name}
                      </Text>
                      <Text style={styles.rowMeta}>{group.members.length} üye</Text>
                    </View>
                    {group.unreadCount ? (
                      <Text style={styles.badge}>{group.unreadCount}</Text>
                    ) : currentProfile?.pinnedSocialConversations.includes(`group:${group.id}`) ? (
                      <Icon name="pin" color={colors.textDim} size={16} />
                    ) : null}
                  </Pressable>
                ))}
              </>
            )}
          </ScrollView>
          {currentProfile ? (
            <Pressable
              style={[
                styles.profileDock,
                hasPremiumNameplate(currentProfile.premium?.nameplate) && styles.nameplateSurface,
                { marginBottom: Math.max(insets.bottom, spacing.xs) },
              ]}
              onPress={() => setProfileOpen(true)}
            >
              <PremiumNameplateBackground visual={currentProfile.premium?.nameplate} />
              <Avatar
                name={currentProfile.displayName}
                uri={currentProfile.avatarUrl}
                size={40}
                online={currentProfile.status === 'ONLINE'}
                status={currentProfile.status}
                decoration={currentProfile.premium?.avatarDecoration}
              />
              <View style={styles.profileCopy}>
                <Text numberOfLines={1} style={styles.profileName}>
                  {currentProfile.displayName}
                </Text>
                <Text numberOfLines={1} style={styles.profileMeta}>
                  {currentProfile.customStatusText
                    ? `${currentProfile.customStatusEmoji ?? ''} ${currentProfile.customStatusText}`
                    : `@${currentProfile.username}`}
                </Text>
              </View>
              <Pressable
                style={styles.profileAction}
                onPress={() => go('/(tabs)/me')}
                accessibilityLabel="Ayarlar"
              >
                <Icon name="cog-outline" color={colors.textMuted} size={22} />
              </Pressable>
            </Pressable>
          ) : null}
        </View>
      </View>
      {currentProfile ? (
        <Modal
          visible={profileOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setProfileOpen(false)}
        >
          <View style={styles.profileBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setProfileOpen(false)} />
            <SwipeableSheetSurface
              onClose={() => setProfileOpen(false)}
              style={styles.profileSheet}
            >
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingBottom: 24 }}>
              {profileFrame?.kind === 'frame' ? <View pointerEvents="none" style={{ height: 80, overflow: 'hidden', marginHorizontal: -spacing.lg }}><Image source={profileFrame.top} resizeMode="cover" style={StyleSheet.absoluteFill} /></View> : null}
              {currentProfile.bannerUrl ? (
                <View style={styles.profileSheetBanner}>
                  <SecureImage
                    uri={currentProfile.bannerUrl}
                    revision={profile.dataUpdatedAt}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                </View>
              ) : null}
              <View style={styles.profileSheetHead}>
                <Avatar
                  name={currentProfile.displayName}
                  uri={currentProfile.avatarUrl}
                  revision={profile.dataUpdatedAt}
                  size={80}
                  online={currentProfile.status === 'ONLINE'}
                  status={currentProfile.status}
                  decoration={currentProfile.premium?.avatarDecoration}
                />
                <View style={styles.profileSheetCopy}>
                  <View style={styles.profileNameBadges}>
                    <Text style={styles.profileSheetName}>{currentProfile.displayName}</Text>
                    <ServerTagChip tag={publicSelf.data?.serverTag} />
                    <OwnedBadgeStrip badges={currentProfile.badges} premiumActive={Boolean(currentProfile.premium?.active)} size={24} limit={8} />
                  </View>
                  <Text style={styles.profileSheetUsername}>
                    @{currentProfile.username}
                    {developerMode ? ` · ${currentProfile.publicId}` : ''}
                  </Text>
                </View>
              </View>
              {currentProfile.customStatusText ? (
                <View style={styles.profileStatusMessage}>
                  {currentProfile.customStatusEmoji ? (
                    <Text>{currentProfile.customStatusEmoji}</Text>
                  ) : null}
                  <Text style={styles.profileStatusMessageText}>
                    {currentProfile.customStatusText}
                  </Text>
                </View>
              ) : null}
              {currentProfile.bio ? (
                <Text style={styles.profileBio}>{currentProfile.bio}</Text>
              ) : null}
              <Pressable
                style={styles.profileSheetPrimary}
                onPress={() => {
                  setProfileOpen(false);
                  go('/profile/edit');
                }}
              >
                <Icon name="pencil-outline" color={colors.text} size={22} />
                <Text style={styles.profileSheetPrimaryText}>Profili düzenle</Text>
              </Pressable>
              <Text style={styles.fieldLabel}>DURUM</Text>
              <Pressable
                style={styles.profilePresenceSelect}
                onPress={() => setPresencePickerOpen(true)}
              >
                <View
                  style={[
                    styles.profilePresenceDot,
                    {
                      backgroundColor:
                        currentProfile.status === 'DND'
                          ? colors.danger
                          : currentProfile.status === 'IDLE'
                            ? colors.warning
                            : currentProfile.status === 'INVISIBLE'
                              ? colors.textDim
                              : colors.success,
                    },
                  ]}
                />
                <View style={styles.rowCopy}>
                  <Text style={styles.profilePresenceSelectTitle}>
                    {presenceLabel(currentProfile.status)}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {currentProfile.statusExpiresAt
                      ? `${new Date(currentProfile.statusExpiresAt).toLocaleString('tr-TR')} tarihine kadar`
                      : 'Her zaman'}
                  </Text>
                </View>
                <Icon name="chevron-down" color={colors.textMuted} size={23} />
              </Pressable>
              <View style={{ padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, gap: spacing.xs }}>
                <Text style={styles.fieldLabel}>ÜYELİK TARİHİ</Text>
                <Text style={styles.profilePresenceSelectTitle}>{new Date(currentProfile.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
              </View>
              <View style={styles.profileSheetGrid}>
                <SheetAction icon="account-group-outline" label="Arkadaşlar" onPress={() => { setProfileOpen(false); go('/friends'); }} />
                <SheetAction icon="store-outline" label="Mağaza" onPress={() => { setProfileOpen(false); go('/store' as never); }} />
                <SheetAction
                  icon="cog-outline"
                  label="Ayarlar"
                  onPress={() => {
                    setProfileOpen(false);
                    go('/(tabs)/me');
                  }}
                />
                <SheetAction
                  icon="logout"
                  label="Çıkış"
                  danger
                  onPress={() => void logout().then(() => router.replace('/auth/login'))}
                />
              </View>
              </ScrollView>
            </SwipeableSheetSurface>
          </View>
        </Modal>
      ) : null}
      {currentProfile ? (
        <PresencePickerSheet
          visible={presencePickerOpen}
          currentStatus={currentProfile.status}
          onClose={() => setPresencePickerOpen(false)}
          onSelect={updatePresence}
        />
      ) : null}
      <ServerActionSheet
        server={serverMenu}
        anchorY={serverMenuAnchor}
        layout={layout}
        close={() => setServerMenu(null)}
        settings={(tab) => {
          const current = serverMenu;
          setServerMenu(null);
          if (current)
            go({ pathname: '/servers/[serverId]/settings', params: { serverId: current.id, ...(tab ? { tab } : {}) } });
        }}
        support={() => {
          const current = serverMenu;
          setServerMenu(null);
          if (current)
            go({
              pathname: '/servers/[serverId]/supports',
              params: { serverId: current.id },
            } as never);
        }}
        folder={() => {
          setFolderTargetFor(serverMenu);
          setServerMenu(null);
        }}
        extract={() => {
          if (!serverMenu) return;
          void persistLayout(extractServer(layout, serverMenu.id));
          setServerMenu(null);
        }}
        markRead={() => {
          const current = serverMenu;
          setServerMenu(null);
          if (current) void markServerRead(current.id);
        }}
        invite={() => {
          if (serverMenu) setInviteTarget({ server: serverMenu, channel: null });
          setServerMenu(null);
        }}
        leave={() => {
          const current = serverMenu;
          setServerMenu(null);
          if (current)
            void api
              .request(`/servers/${current.id}/actions/leave`, { method: 'POST' })
              .then(async () => {
                if (serverId === current.id) {
                  setServerId(null);
                  close();
                }
                await servers.refetch();
              });
        }}
      />
      <FolderActionPopover
        folder={folderMenu}
        anchorY={folderMenuAnchor}
        close={() => setFolderMenu(null)}
        settings={() => {
          setFolderEdit(folderMenu);
          setFolderMenu(null);
        }}
        markRead={() => {
          const ids = folderMenu?.serverIds ?? [];
          setFolderMenu(null);
          void markFolderRead(ids);
        }}
      />
      <ChannelActionSheet
        channel={channelMenu}
        server={selected ?? null}
        close={() => setChannelMenu(null)}
        markRead={async () => {
          if (!serverId || !channelMenu || channelMenu.type !== 'TEXT') return;
          await api.request(`/servers/${serverId}/channels/${channelMenu.id}/messages/read`, {
            method: 'POST',
            body: {},
          });
          await queryClient.invalidateQueries({ queryKey: ['channel-unread'] });
        }}
        invite={() => {
          if (selected && channelMenu) setInviteTarget({ server: selected, channel: channelMenu });
          setChannelMenu(null);
        }}
        settings={() => {
          const currentServerId = serverId;
          setChannelMenu(null);
          if (currentServerId)
            go({ pathname: '/servers/[serverId]/settings', params: { serverId: currentServerId } });
        }}
      />
      <SocialConversationActionSheet
        target={socialMenu}
        pinned={Boolean(
          socialMenu &&
            currentProfile?.pinnedSocialConversations.includes(
              `${socialMenu.kind}:${socialMenu.id}`,
            ),
        )}
        close={() => setSocialMenu(null)}
        openUserActions={() => {
          if (socialMenu?.kind === 'direct') setSocialUserMenu(socialMenu.user);
          setSocialMenu(null);
        }}
        togglePin={async () => {
          if (!socialMenu) return;
          await updatePinnedConversation(socialMenu.kind, socialMenu.id);
          setSocialMenu(null);
        }}
        markRead={async () => {
          if (!socialMenu) return;
          await api.request(
            socialMenu.kind === 'direct'
              ? `/dm/conversations/${socialMenu.id}/read`
              : `/dm/groups/${socialMenu.id}/read`,
            { method: 'POST', body: {} },
          );
          await queryClient.invalidateQueries({
            queryKey: [socialMenu.kind === 'direct' ? 'dm-conversations' : 'group-conversations'],
          });
          setSocialMenu(null);
        }}
        hideConversation={async () => {
          if (!socialMenu) return;
          await api.request(
            socialMenu.kind === 'direct'
              ? `/dm/conversations/${socialMenu.id}/hide`
              : `/dm/groups/${socialMenu.id}/leave`,
            { method: 'POST', body: {} },
          );
          await queryClient.invalidateQueries({
            queryKey: [socialMenu.kind === 'direct' ? 'dm-conversations' : 'group-conversations'],
          });
          setSocialMenu(null);
        }}
      />
      <SocialUserActionsSheet user={socialUserMenu} close={() => setSocialUserMenu(null)} />
      <InviteShareSheet target={inviteTarget} close={() => setInviteTarget(null)} />
      <FolderTargetSheet
        source={folderTargetFor}
        servers={servers.data ?? []}
        close={() => setFolderTargetFor(null)}
        choose={(targetId) => {
          if (!folderTargetFor) return;
          void persistLayout(createFolder(layout, folderTargetFor.id, targetId));
          setFolderTargetFor(null);
        }}
      />
      <FolderSettingsSheet
        folder={folderEdit}
        close={() => setFolderEdit(null)}
        save={(name, color) => {
          if (!folderEdit) return;
          void persistLayout(
            layout.map((item) => (item.id === folderEdit.id ? { ...item, name, color } : item)),
          );
          setFolderEdit(null);
        }}
      />
    </View>
  );
}

function SheetAction({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  danger?: boolean;
  onPress(): void;
}) {
  return (
    <Pressable style={styles.sheetAction} onPress={onPress}>
      <View style={styles.sheetActionIcon}>
        <Icon name={icon} color={danger ? colors.danger : colors.waveBright} size={25} />
      </View>
      <Text style={[styles.sheetActionText, danger && styles.sheetDanger]}>{label}</Text>
    </Pressable>
  );
}

function DraggableRailItem({
  children,
  index,
  onPress,
  onHold,
  onMoveStart,
  onDrop,
}: PropsWithChildren<{
  index: number;
  onPress(): void;
  onHold(anchorY: number): void;
  onMoveStart(): void;
  onDrop(dx: number, dy: number): void;
}>) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const moving = useSharedValue(false);
  const pan = Gesture.Pan()
    .activateAfterLongPress(300)
    .onStart((event) => {
      moving.value = false;
      runOnJS(onHold)(event.absoluteY);
    })
    .onUpdate((event) => {
      x.value = event.translationX;
      y.value = event.translationY;
      if (!moving.value && Math.hypot(event.translationX, event.translationY) > 10) {
        moving.value = true;
        runOnJS(onMoveStart)();
      }
    })
    .onEnd((event) => {
      if (moving.value && index >= 0) runOnJS(onDrop)(event.translationX, event.translationY);
    })
    .onFinalize(() => {
      x.value = withTiming(0, { duration: motion.quick });
      y.value = withTiming(0, { duration: motion.quick });
    });
  const animated = useAnimatedStyle(() => ({
    zIndex: moving.value ? 100 : 1,
    elevation: moving.value ? 18 : 0,
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: moving.value ? 1.08 : 1 },
    ],
  }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={animated}>
        <Pressable onPress={onPress}>{children}</Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

function ServerActionSheet({
  server,
  layout,
  close,
  settings,
  support,
  folder,
  extract,
  markRead,
  invite,
  leave,
}: {
  server: ServerSummary | null;
  anchorY: number;
  layout: ServerLayoutItem[];
  close(): void;
  settings(tab?: string): void;
  support(): void;
  folder(): void;
  extract(): void;
  markRead(): void;
  invite(): void;
  leave(): void;
}) {
  const { enabled: developerMode } = useDeveloperMode();
  const [view, setView] = useState<'main' | 'mute' | 'notifications'>('main');
  const [reportOpen, setReportOpen] = useState(false);
  const preference = useQuery({
    queryKey: ['server-notification-preference', server?.id],
    enabled: Boolean(server),
    queryFn: () =>
      api.request<ServerNotificationPreference>(`/servers/${server!.id}/notification-preference`),
  });
  useEffect(() => setView('main'), [server?.id]);
  async function updatePreference(input: { level?: NotificationLevel; mute?: NotificationMute }) {
    if (!server) return;
    await api.request(`/servers/${server.id}/notification-preference`, {
      method: 'PATCH',
      body: input,
    });
    await preference.refetch();
    setView('main');
  }
  const inFolder = Boolean(
    server && layout.some((item) => item.type === 'folder' && item.serverIds?.includes(server.id)),
  );
  const canManage = server?.role === 'OWNER' || server?.permissions.includes('MANAGE_SERVER');
  return (
    <>
      <Modal
        visible={Boolean(server) && !reportOpen}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <View style={styles.profileBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <SwipeableSheetSurface onClose={close} style={styles.profileSheet}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
            {server ? (
              <>
                {server.bannerUrl ? <SecureImage uri={server.bannerUrl} style={{ width: '100%', height: 120, borderRadius: radius.lg }} contentFit="cover" /> : null}
                <View style={styles.contextHead}>
                  {server.iconUrl ? (
                    <SecureImage
                      uri={server.iconUrl}
                      style={styles.contextServerIcon}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.contextServerIcon}>
                      <Text style={styles.serverInitial}>{server.name.slice(0, 2)}</Text>
                    </View>
                  )}
                  <View style={styles.rowCopy}>
                    <Text numberOfLines={1} style={styles.contextTitle}>
                      {server.name}
                    </Text>
                    <Text style={styles.rowMeta}>{server.memberCount} üye</Text>
                  </View>
                </View>
                {server.description ? <Text style={{ color: colors.textMuted, fontSize: 15, lineHeight: 22 }}>{server.description}</Text> : null}
                {view === 'main' ? (
                  <>
                    <View style={styles.profileSheetGrid}>
                      <SheetAction icon="diamond-stone" label="Takviye yap" onPress={support} />
                      {server.permissions.includes('CREATE_INVITES') ? <SheetAction icon="account-plus-outline" label="Davet et" onPress={invite} /> : null}
                      <SheetAction icon="bell-outline" label="Bildirimler" onPress={() => setView('notifications')} />
                      {canManage ? <SheetAction icon="cog-outline" label="Ayarlar" onPress={() => settings()} /> : null}
                    </View>
                    <ContextRow
                      icon="email-check-outline"
                      label="Okundu işaretle"
                      onPress={markRead}
                    />
                    {server.role === 'OWNER' || server.permissions.includes('MANAGE_CHANNELS') ? <ContextRow icon="pound" label="Kanalları yönet" onPress={() => settings('channels')} /> : null}
                    {server.role === 'OWNER' || server.permissions.includes('MANAGE_ROLES') ? <ContextRow icon="shield-account-outline" label="Rolleri yönet" onPress={() => settings('roles')} /> : null}
                    <ContextRow
                      icon={preference.data?.isMuted ? 'bell-check-outline' : 'bell-off-outline'}
                      label={
                        preference.data?.isMuted ? 'Bildirim sesini aç' : 'Bildirimleri sustur'
                      }
                      onPress={() => setView('mute')}
                    />
                    <ContextRow
                      icon="bell-outline"
                      label={`Bildirimler · ${notificationLevelLabel(preference.data?.level ?? 'MENTIONS_ONLY')}`}
                      onPress={() => setView('notifications')}
                    />
                    {inFolder ? (
                      <ContextRow
                        icon="folder-remove-outline"
                        label="Klasörden çıkar"
                        onPress={extract}
                      />
                    ) : (
                      <ContextRow
                        icon="folder-plus-outline"
                        label="Klasör oluştur"
                        onPress={folder}
                      />
                    )}
                    {developerMode ? (
                      <ContextRow
                        icon="identifier"
                        label="Sunucu kimliğini kopyala"
                        onPress={() => void Clipboard.setStringAsync(server.publicId).then(close)}
                      />
                    ) : null}
                    <ContextRow
                      icon="flag-outline"
                      label="Sunucuyu bildir"
                      onPress={() => setReportOpen(true)}
                    />
                    {server.role !== 'OWNER' ? (
                      <ContextRow icon="logout" label="Sunucudan ayrıl" danger onPress={leave} />
                    ) : null}
                  </>
                ) : view === 'mute' ? (
                  <PreferenceChoices
                    title="Bildirimleri sustur"
                    back={() => setView('main')}
                    choices={notificationMuteChoices.map(([value, label]) => ({
                      key: value,
                      label,
                      active:
                        value === 'UNMUTED'
                          ? !preference.data?.isMuted
                          : notificationMuteMatches(preference.data, value),
                      select: () => void updatePreference({ mute: value }),
                    }))}
                  />
                ) : (
                  <PreferenceChoices
                    title="Bildirim ayarları"
                    back={() => setView('main')}
                    choices={notificationLevelChoices.map(([value, label]) => ({
                      key: value,
                      label,
                      active: preference.data?.level === value,
                      select: () => void updatePreference({ level: value }),
                    }))}
                  />
                )}
              </>
            ) : null}
          </ScrollView>
          </SwipeableSheetSurface>
        </View>
      </Modal>
      <ReportSheet
        visible={reportOpen}
        close={() => setReportOpen(false)}
        subject={
          server ? { kind: 'server', serverId: server.id, serverName: server.name } : undefined
        }
      />
    </>
  );
}

function FolderActionPopover({
  folder,
  anchorY,
  close,
  settings,
  markRead,
}: {
  folder: ServerLayoutItem | null;
  anchorY: number;
  close(): void;
  settings(): void;
  markRead(): void;
}) {
  const { height } = useWindowDimensions();
  const top = Math.min(Math.max(16, anchorY - 40), Math.max(16, height - 260));
  return (
    <Modal visible={Boolean(folder)} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.contextBackdrop} onPress={close}>
        <Pressable
          style={[styles.contextPopover, { top }]}
          onPress={(event) => event.stopPropagation()}
        >
          <Text numberOfLines={1} style={styles.contextTitle}>
            {folder?.name ?? 'Sunucu klasörü'}
          </Text>
          <Text style={styles.rowMeta}>Basılı tutup sürükleyerek taşı</Text>
          <ContextRow icon="email-check-outline" label="Tümünü okundu yap" onPress={markRead} />
          <ContextRow icon="folder-cog-outline" label="Klasör ayarları" onPress={settings} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const notificationMuteChoices = [
  ['UNMUTED', 'Susturmayı kaldır'],
  ['MINUTES_15', '15 dakika'],
  ['HOUR_1', '1 saat'],
  ['HOURS_3', '3 saat'],
  ['HOURS_8', '8 saat'],
  ['HOURS_24', '24 saat'],
  ['FOREVER', 'Ben açana kadar'],
] as const satisfies ReadonlyArray<readonly [NotificationMute, string]>;

const notificationLevelChoices = [
  ['ALL_MESSAGES', 'Tüm mesajlar'],
  ['MENTIONS_ONLY', 'Yalnız bahsetmeler'],
  ['NOTHING', 'Hiçbir şey'],
] as const satisfies ReadonlyArray<readonly [NotificationLevel, string]>;

function notificationLevelLabel(value: NotificationLevel) {
  return notificationLevelChoices.find(([level]) => level === value)?.[1] ?? 'Yalnız bahsetmeler';
}

function notificationMuteMatches(
  preference:
    | Pick<ServerNotificationPreference, 'isMuted' | 'mutedIndefinitely' | 'mutePreset'>
    | Pick<ChannelNotificationPreference, 'isMuted' | 'mutedIndefinitely' | 'mutePreset'>
    | undefined,
  value: NotificationMute,
) {
  if (!preference?.isMuted) return false;
  if (value === 'FOREVER') return Boolean(preference?.mutedIndefinitely);
  return preference.mutePreset === value;
}

function PreferenceChoices({
  title,
  back,
  choices,
}: {
  title: string;
  back(): void;
  choices: Array<{ key: string; label: string; active: boolean; select(): void }>;
}) {
  return (
    <View>
      <Pressable style={styles.preferenceBack} onPress={back}>
        <Icon name="arrow-left" color={colors.textMuted} size={21} />
        <Text style={styles.contextTitle}>{title}</Text>
      </Pressable>
      {choices.map((choice) => (
        <Pressable
          key={choice.key}
          style={styles.preferenceChoice}
          onPress={choice.select}
          accessibilityRole="radio"
          accessibilityState={{ checked: choice.active }}
        >
          <Icon
            name={choice.active ? 'radiobox-marked' : 'radiobox-blank'}
            color={choice.active ? colors.waveBright : colors.textDim}
            size={22}
          />
          <Text style={styles.contextRowText}>{choice.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ChannelActionSheet({
  channel,
  server,
  close,
  markRead,
  invite,
  settings,
}: {
  channel: ServerChannel | null;
  server: ServerSummary | null;
  close(): void;
  markRead(): Promise<void>;
  invite(): void;
  settings(): void;
}) {
  const { enabled: developerMode } = useDeveloperMode();
  const [view, setView] = useState<'main' | 'mute' | 'notifications'>('main');
  const preference = useQuery({
    queryKey: ['channel-notification-preference', server?.id, channel?.id],
    enabled: Boolean(server && channel),
    queryFn: () =>
      api.request<ChannelNotificationPreference>(
        `/servers/${server!.id}/channels/${channel!.id}/notification-preference`,
      ),
  });
  useEffect(() => setView('main'), [channel?.id]);
  async function update(input: { level?: NotificationLevel | null; mute?: NotificationMute }) {
    if (!server || !channel) return;
    await api.request(`/servers/${server.id}/channels/${channel.id}/notification-preference`, {
      method: 'PATCH',
      body: input,
    });
    await preference.refetch();
    setView('main');
  }
  const canInvite = Boolean(server?.permissions.includes('CREATE_INVITES'));
  const canManage = Boolean(
    server?.role === 'OWNER' ||
      server?.permissions.includes('MANAGE_CHANNELS') ||
      channel?.permissions.MANAGE_CHANNELS,
  );
  return (
    <Modal
      visible={Boolean(channel && server)}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <View style={styles.profileBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <SwipeableSheetSurface onClose={close} style={styles.contextSheet}>
          {channel && server ? (
            view === 'main' ? (
              <>
                <View style={styles.contextHead}>
                  <View style={styles.contextChannelIcon}>
                    <Icon
                      name={channel.type === 'VOICE' ? 'volume-high' : 'pound'}
                      color={colors.waveBright}
                      size={24}
                    />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text numberOfLines={1} style={styles.contextTitle}>
                      {channel.name}
                    </Text>
                    {channel.topic ? (
                      <Text numberOfLines={2} style={styles.rowMeta}>
                        {channel.topic}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {channel.type === 'TEXT' ? (
                  <ContextRow
                    icon="email-check-outline"
                    label="Okundu işaretle"
                    onPress={() => void markRead().then(close)}
                  />
                ) : null}
                <ContextRow
                  icon={preference.data?.isMuted ? 'bell-check-outline' : 'bell-off-outline'}
                  label={preference.data?.isMuted ? 'Bildirim sesini aç' : 'Bildirimleri sustur'}
                  onPress={() => setView('mute')}
                />
                <ContextRow
                  icon="bell-outline"
                  label={
                    preference.data?.level === null
                      ? 'Bildirimler · Sunucu ayarını kullan'
                      : `Bildirimler · ${notificationLevelLabel(preference.data?.effectiveLevel ?? 'MENTIONS_ONLY')}`
                  }
                  onPress={() => setView('notifications')}
                />
                {canInvite ? (
                  <ContextRow
                    icon="account-plus-outline"
                    label={channel.type === 'VOICE' ? 'Ses kanalına davet et' : 'Kanala davet et'}
                    onPress={invite}
                  />
                ) : null}
                <ContextRow
                  icon="link-variant"
                  label="Kanal bağlantısını kopyala"
                  onPress={() =>
                    void Clipboard.setStringAsync(
                      `https://wapve.com/channels/${server.publicId}/${channel.publicId}`,
                    ).then(close)
                  }
                />
                {canManage ? (
                  <ContextRow icon="cog-outline" label="Kanal ayarları" onPress={settings} />
                ) : null}
                {developerMode ? (
                  <ContextRow
                    icon="identifier"
                    label="Kanal kimliğini kopyala"
                    onPress={() => void Clipboard.setStringAsync(channel.publicId).then(close)}
                  />
                ) : null}
              </>
            ) : view === 'mute' ? (
              <PreferenceChoices
                title="Bildirimleri sustur"
                back={() => setView('main')}
                choices={notificationMuteChoices.map(([value, label]) => ({
                  key: value,
                  label,
                  active:
                    value === 'UNMUTED'
                      ? !preference.data?.isMuted
                      : notificationMuteMatches(preference.data, value),
                  select: () => void update({ mute: value }),
                }))}
              />
            ) : (
              <PreferenceChoices
                title="Bildirim ayarları"
                back={() => setView('main')}
                choices={[
                  {
                    key: 'inherit',
                    label: 'Sunucu ayarını kullan',
                    active: preference.data?.level === null,
                    select: () => void update({ level: null }),
                  },
                  ...notificationLevelChoices.map(([value, label]) => ({
                    key: value,
                    label,
                    active: preference.data?.level === value,
                    select: () => void update({ level: value }),
                  })),
                ]}
              />
            )
          ) : null}
        </SwipeableSheetSurface>
      </View>
    </Modal>
  );
}

function SocialConversationActionSheet({
  target,
  pinned,
  close,
  togglePin,
  markRead,
  openUserActions,
  hideConversation,
}: {
  target:
    | (
        | { kind: 'direct'; id: string; title: string; user: SocialUser }
        | { kind: 'group'; id: string; title: string }
      )
    | null;
  pinned: boolean;
  close(): void;
  togglePin(): Promise<void>;
  markRead(): Promise<void>;
  openUserActions(): void;
  hideConversation(): Promise<void>;
}) {
  return (
    <Modal visible={Boolean(target)} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.profileBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <SwipeableSheetSurface onClose={close} style={styles.contextSheet}>
          <Text numberOfLines={1} style={styles.contextTitle}>
            {target?.title}
          </Text>
          <ContextRow
            icon="email-check-outline"
            label="Okundu işaretle"
            onPress={() => void markRead()}
          />
          {target?.kind === 'direct' ? (
            <ContextRow
              icon="account-cog-outline"
              label="Kullanıcı işlemleri"
              onPress={openUserActions}
            />
          ) : null}
          <ContextRow
            icon={pinned ? 'pin-off-outline' : 'pin-outline'}
            label={pinned ? 'Sabitlemeyi kaldır' : 'Sohbeti sabitle'}
            onPress={() => void togglePin()}
          />
          <ContextRow
            icon="eye-off-outline"
            label={target?.kind === 'group' ? 'Gruptan ayrıl' : 'Sohbeti listeden kaldır'}
            onPress={() => void hideConversation()}
          />
        </SwipeableSheetSurface>
      </View>
    </Modal>
  );
}

function InviteShareSheet({
  target,
  close,
}: {
  target: { server: ServerSummary; channel: ServerChannel | null } | null;
  close(): void;
}) {
  const [tab, setTab] = useState<'friends' | 'groups'>('friends');
  const [search, setSearch] = useState('');
  const [invite, setInvite] = useState<ServerInvite | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const friends = useQuery({
    queryKey: ['friends'],
    enabled: Boolean(target),
    queryFn: () => api.request<Friend[]>('/social/friends'),
  });
  const groups = useQuery({
    queryKey: ['group-conversations'],
    enabled: Boolean(target),
    queryFn: () => api.request<GroupConversation[]>('/dm/groups'),
  });
  useEffect(() => {
    setSearch('');
    setSent(new Set());
    setInvite(null);
    if (!target) return;
    let active = true;
    void api
      .request<ServerInvite[]>(`/servers/${target.server.id}/invites`)
      .then(async (items) => {
        const now = Date.now();
        const existing = items.find(
          (item) =>
            !item.revokedAt &&
            new Date(item.expiresAt).getTime() > now &&
            item.usedCount < item.maxUses &&
            (item.channel?.id ?? null) === (target.channel?.id ?? null),
        );
        if (existing) return existing;
        return api.request<ServerInvite>(`/servers/${target.server.id}/invites`, {
          method: 'POST',
          body: {
            maxUses: 100,
            expiresInHours: 24,
            ...(target.channel ? { channelId: target.channel.id } : {}),
          },
        });
      })
      .then((value) => {
        if (active) setInvite(value);
      });
    return () => {
      active = false;
    };
  }, [target]);
  const normalized = search.trim().toLocaleLowerCase('tr');
  const inviteUrl = invite ? serverInviteUrl(invite.code) : '';
  async function send(kind: 'friend' | 'group', id: string) {
    if (!target || !invite) return;
    const key = `${kind}:${id}`;
    setBusy(true);
    const destination = target.channel
      ? `${target.channel.type === 'VOICE' ? '🔊' : '#'} ${target.server.name} · ${target.channel.name}`
      : target.server.name;
    await api.request(
      kind === 'friend' ? `/dm/conversations/${id}/messages` : `/dm/groups/${id}/messages`,
      { method: 'POST', body: { content: `${destination}\n${inviteUrl}` } },
    );
    setSent((current) => new Set(current).add(key));
    setBusy(false);
  }
  return (
    <Modal visible={Boolean(target)} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.profileBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <SwipeableSheetSurface onClose={close} style={styles.inviteSheet}>
          <Text style={styles.contextTitle}>
            {target?.channel
              ? `${target.channel.name} kanalına davet et`
              : `${target?.server.name ?? ''} sunucusuna davet et`}
          </Text>
          <View style={styles.inviteLinkRow}>
            <Text numberOfLines={1} style={styles.inviteLink}>
              {inviteUrl || 'Davet hazırlanıyor…'}
            </Text>
            <Pressable
              style={styles.inviteIconButton}
              disabled={!invite}
              onPress={() => void Clipboard.setStringAsync(inviteUrl)}
              accessibilityLabel="Davet bağlantısını kopyala"
            >
              <Icon name="content-copy" color={colors.waveBright} size={21} />
            </Pressable>
            <Pressable
              style={styles.inviteIconButton}
              disabled={!invite}
              onPress={() => void Share.share({ message: inviteUrl })}
              accessibilityLabel="Davet bağlantısını paylaş"
            >
              <Icon name="share-variant-outline" color={colors.waveBright} size={22} />
            </Pressable>
          </View>
          <TextInput
            value={search}
            onChangeText={setSearch}
            style={styles.inviteSearch}
            placeholder="Arkadaş veya grup ara"
            placeholderTextColor={colors.textDim}
          />
          <View style={styles.inviteTabs}>
            <Pressable
              style={[styles.inviteTab, tab === 'friends' && styles.inviteTabActive]}
              onPress={() => setTab('friends')}
            >
              <Text style={styles.inviteTabText}>Arkadaşlar</Text>
            </Pressable>
            <Pressable
              style={[styles.inviteTab, tab === 'groups' && styles.inviteTabActive]}
              onPress={() => setTab('groups')}
            >
              <Text style={styles.inviteTabText}>Gruplar</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.inviteList} keyboardShouldPersistTaps="handled">
            {tab === 'friends'
              ? (friends.data ?? [])
                  .filter(
                    (friend) =>
                      !normalized ||
                      `${friend.user.displayName} ${friend.user.username}`
                        .toLocaleLowerCase('tr')
                        .includes(normalized),
                  )
                  .map((friend) => {
                    const key = `friend:${friend.conversationId}`;
                    return (
                      <InviteRecipientRow
                        key={key}
                        name={friend.user.displayName}
                        meta={`@${friend.user.username}`}
                        uri={friend.user.avatarUrl}
                        sent={sent.has(key)}
                        disabled={busy || !invite}
                        send={() => void send('friend', friend.conversationId)}
                      />
                    );
                  })
              : (groups.data ?? [])
                  .filter(
                    (group) =>
                      !normalized || group.name.toLocaleLowerCase('tr').includes(normalized),
                  )
                  .map((group) => {
                    const key = `group:${group.id}`;
                    return (
                      <InviteRecipientRow
                        key={key}
                        name={group.name}
                        meta={`${group.members.length} üye`}
                        uri={group.avatarUrl}
                        sent={sent.has(key)}
                        disabled={busy || !invite}
                        send={() => void send('group', group.id)}
                      />
                    );
                  })}
          </ScrollView>
        </SwipeableSheetSurface>
      </View>
    </Modal>
  );
}

function InviteRecipientRow({
  name,
  meta,
  uri,
  sent,
  disabled,
  send,
}: {
  name: string;
  meta: string;
  uri: string | null;
  sent: boolean;
  disabled: boolean;
  send(): void;
}) {
  return (
    <View style={styles.inviteRecipient}>
      <Avatar name={name} uri={uri} size={40} />
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={styles.rowTitle}>
          {name}
        </Text>
        <Text numberOfLines={1} style={styles.rowMeta}>
          {meta}
        </Text>
      </View>
      <Pressable
        style={[styles.inviteSend, sent && styles.inviteSent]}
        disabled={disabled || sent}
        onPress={send}
      >
        <Text style={styles.inviteSendText}>{sent ? 'Gönderildi' : 'Gönder'}</Text>
      </Pressable>
    </View>
  );
}

function FolderTargetSheet({
  source,
  servers,
  close,
  choose,
}: {
  source: ServerSummary | null;
  servers: ServerSummary[];
  close(): void;
  choose(targetId: string): void;
}) {
  return (
    <Modal visible={Boolean(source)} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.profileBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <SwipeableSheetSurface onClose={close} style={styles.contextSheet}>
          <Text style={styles.contextTitle}>Hangi sunucuyla klasör oluşturulsun?</Text>
          <ScrollView style={styles.folderTargetList} showsVerticalScrollIndicator={false}>
            {servers
              .filter((server) => server.id !== source?.id)
              .map((server) => (
                <Pressable
                  key={server.id}
                  style={styles.folderTargetRow}
                  onPress={() => choose(server.id)}
                >
                  <Avatar name={server.name} uri={server.iconUrl} size={42} />
                  <Text style={styles.rowTitle}>{server.name}</Text>
                </Pressable>
              ))}
          </ScrollView>
        </SwipeableSheetSurface>
      </View>
    </Modal>
  );
}

function FolderSettingsSheet({
  folder,
  close,
  save,
}: {
  folder: ServerLayoutItem | null;
  close(): void;
  save(name: string, color: string): void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#1478ff');
  useEffect(() => {
    if (folder) {
      setName(folder.name ?? 'Sunucu klasörü');
      setColor(folder.color ?? '#1478ff');
    }
  }, [folder]);
  const colorsList = ['#1478ff', '#22c55e', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4'];
  return (
    <Modal visible={Boolean(folder)} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.profileBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <SwipeableSheetSurface onClose={close} style={styles.contextSheet}>
          <Text style={styles.contextTitle}>Klasör ayarları</Text>
          <Text style={styles.fieldLabel}>Klasör adı</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={40}
            style={styles.folderNameInput}
            placeholder="Sunucu klasörü"
            placeholderTextColor={colors.textDim}
          />
          <Text style={styles.fieldLabel}>Renk</Text>
          <View style={styles.customColorRow}>
            <View
              style={[
                styles.customColorPreview,
                { backgroundColor: isHexColor(color) ? color : colors.wave },
              ]}
            />
            <TextInput
              value={color}
              onChangeText={setColor}
              maxLength={7}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.colorInput}
              placeholder="#1478FF"
              placeholderTextColor={colors.textDim}
              accessibilityLabel="Klasör renk kodu"
            />
          </View>
          <View style={styles.colorChoices}>
            {colorsList.map((item) => (
              <Pressable
                key={item}
                style={[
                  styles.colorChoice,
                  { backgroundColor: item },
                  color === item && styles.colorChoiceActive,
                ]}
                onPress={() => setColor(item)}
                accessibilityLabel={`Klasör rengi ${item}`}
              />
            ))}
          </View>
          <Pressable
            style={[styles.saveFolder, !isHexColor(color) && styles.disabledAction]}
            disabled={!isHexColor(color)}
            onPress={() => save(name.trim() || 'Sunucu klasörü', color.toUpperCase())}
          >
            <Text style={styles.saveFolderText}>Kaydet</Text>
          </Pressable>
        </SwipeableSheetSurface>
      </View>
    </Modal>
  );
}

function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/iu.test(value.trim());
}

function ContextRow({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  danger?: boolean;
  onPress(): void;
}) {
  return (
    <Pressable style={styles.contextRow} onPress={onPress}>
      <Icon name={icon} color={danger ? colors.danger : colors.waveBright} size={22} />
      <Text style={[styles.contextRowText, danger && styles.sheetDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.overlay,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.canvas,
    elevation: 24,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 28,
  },
  edgeHandle: { position: 'absolute', left: 0, top: 58, bottom: 72, width: 96 },
  drawerBody: { flex: 1, backgroundColor: colors.ink },
  drawerMain: { flex: 1, flexDirection: 'row' },
  rail: {
    width: 72,
    backgroundColor: colors.ink,
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.line,
  },
  railList: { alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.xl },
  railButton: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railActive: { borderRadius: 15, borderWidth: 2, borderColor: colors.waveBright },
  waveIcon: { color: colors.waveBright, fontSize: 30, fontWeight: '900' },
  railDivider: { width: 34, height: 1, backgroundColor: colors.line, marginVertical: spacing.sm },
  serverButton: {
    position: 'relative',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  railUnread: {
    position: 'absolute',
    right: -5,
    bottom: -4,
    minWidth: 18,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '800',
  },
  railUnreadMention: { backgroundColor: colors.danger },
  channelUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.textMuted,
  },
  socialUnreadRail: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  socialUnreadButton: {
    position: 'relative',
    width: 50,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serverIcon: { width: 50, height: 50, borderRadius: 25 },
  serverIconNested: { width: 42, height: 42, borderRadius: 15 },
  serverNested: { width: 42, height: 42, borderRadius: 15 },
  serverInitial: { color: colors.text, ...typography.label },
  folderWrap: { alignItems: 'center', gap: spacing.xs },
  folderButton: {
    width: 50,
    height: 50,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderGrid: { width: 34, height: 34, flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  folderMini: {
    width: 16,
    height: 16,
    borderRadius: 5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  folderMiniText: { color: colors.text, fontSize: 8, fontWeight: '800' },
  folderChildren: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 3,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  addServer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { color: colors.success, fontSize: 25 },
  listPane: { flex: 1, backgroundColor: colors.canvas },
  drawerHeader: {
    height: 66,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  drawerTitle: { flex: 1, color: colors.text, ...typography.heading },
  drawerHeaderActions: { flexDirection: 'row', alignItems: 'center' },
  iconButton: {
    width: touch.minimum,
    height: touch.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: colors.textMuted, fontSize: 26 },
  messageToolbar: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  searchButton: {
    width: touch.minimum,
    height: touch.minimum,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  addFriendButton: {
    width: touch.minimum,
    height: touch.minimum,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  composeButton: {
    width: touch.minimum,
    height: touch.minimum,
    borderRadius: radius.pill,
    backgroundColor: colors.wave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionScroll: { flex: 1 },
  sections: {
    paddingHorizontal: spacing.sm,
    paddingTop: 0,
    paddingBottom: spacing.sm,
    gap: 2,
  },
  serverBanner: {
    height: 120,
    margin: -spacing.sm,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  serverBannerShade: { position: 'absolute', inset: 0, backgroundColor: 'rgba(3,8,20,.42)' },
  serverBannerCopy: { padding: spacing.md },
  serverIntro: {
    minHeight: 76,
    margin: -spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.md,
    justifyContent: 'flex-end',
    backgroundColor: colors.surfaceRaised,
  },
  serverBannerTitle: { color: colors.text, ...typography.title },
  serverBannerMeta: { color: colors.textMuted, ...typography.caption },
  mobileSupportGoal: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(59,190,255,.3)',
    borderRadius: radius.md,
    backgroundColor: 'rgba(23,105,180,.15)',
  },
  mobileSupportCopy: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  mobileSupportTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  mobileSupportCount: { color: colors.waveBright, fontSize: 11, fontWeight: '900' },
  plusRow: {
    borderWidth: 1,
    borderColor: 'rgba(59,190,255,.2)',
    backgroundColor: 'rgba(28,112,190,.11)',
  },
  plusRowBadge: { width: 34, height: 34, resizeMode: 'contain' },
  sectionLabel: {
    color: colors.textDim,
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: spacing.sm,
    marginHorizontal: spacing.xs,
    marginBottom: 3,
  },
  channelCategory: { marginTop: 2 },
  categoryHeader: {
    minHeight: 32,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  categoryTitle: {
    flex: 1,
    color: colors.textDim,
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  channelRow: {
    minHeight: 42,
    marginVertical: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  channelRowSelected: {
    backgroundColor: 'rgba(148, 169, 191, 0.14)',
  },
  channelTitle: {
    color: colors.textDim,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  channelTitleUnread: { color: colors.text, fontWeight: '700' },
  channelTitleSelected: { color: colors.text, fontWeight: '700' },
  nsfwBadge: {
    minWidth: 29,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.55)',
  },
  nsfwBadgeText: { color: colors.danger, fontSize: 9, lineHeight: 12, fontWeight: '900' },
  row: {
    minHeight: touch.minimum,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nameplateSurface: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  wavesRowIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.waveBright,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.waveBright,
    shadowOpacity: 0.28,
    shadowRadius: 7,
  },
  waveRowGlyph: { color: colors.textMuted, fontSize: 25, fontWeight: '900' },
  rowGlyph: { width: 28, color: colors.textMuted, fontSize: 24, textAlign: 'center' },
  rowTitle: { color: colors.text, ...typography.body, fontWeight: '600' },
  rowCopy: { flex: 1 },
  rowMeta: { color: colors.textDim, ...typography.caption },
  voiceCount: {
    minWidth: 21,
    color: colors.textMuted,
    ...typography.caption,
    textAlign: 'center',
  },
  voiceParticipants: { paddingLeft: 38, paddingBottom: spacing.xs, gap: 2 },
  voiceParticipant: {
    minHeight: 38,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  voiceParticipantName: { flex: 1, color: colors.textMuted, ...typography.caption },
  badge: {
    color: colors.text,
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    textAlign: 'center',
    ...typography.caption,
  },
  profileDock: {
    minHeight: 62,
    marginHorizontal: 10,
    marginTop: 6,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  profileCopy: { flex: 1 },
  profileName: { color: colors.text, ...typography.label },
  profileMeta: { color: colors.textDim, ...typography.caption },
  profileAction: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  profileSheet: {
    maxHeight: '92%',
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.canvas,
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    alignSelf: 'center',
    backgroundColor: colors.lineStrong,
  },
  profileSheetBanner: {
    height: 120,
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.xs,
    marginBottom: -46,
    backgroundColor: colors.surfaceSoft,
  },
  profileSheetHead: { alignItems: 'flex-start', gap: spacing.md, paddingTop: 8 },
  profileSheetCopy: { flex: 1 },
  profileNameBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  profileSheetName: { color: colors.text, ...typography.title },
  profileSheetUsername: { color: colors.textMuted, ...typography.body },
  profileStatusMessage: {
    minHeight: 42,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  profileStatusMessageText: { flex: 1, color: colors.text, ...typography.body },
  profileBio: { color: colors.textMuted, ...typography.body },
  profileSheetPrimary: {
    minHeight: touch.minimum,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.wave,
  },
  profileSheetPrimaryText: { color: colors.text, ...typography.label },
  profilePresenceSelect: {
    minHeight: 62,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  profilePresenceSelectTitle: { color: colors.text, ...typography.label },
  profilePresenceDot: { width: 10, height: 10, borderRadius: 5 },
  profileSheetGrid: { flexDirection: 'row', gap: spacing.sm },
  sheetAction: {
    flex: 1,
    minHeight: 82,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
  },
  sheetActionIcon: { height: 30, justifyContent: 'center' },
  sheetActionText: { color: colors.textMuted, ...typography.caption },
  sheetDanger: { color: colors.danger },
  contextBackdrop: { flex: 1, backgroundColor: colors.overlay },
  contextPopover: {
    position: 'absolute',
    left: 68,
    width: 300,
    maxWidth: '78%',
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    gap: 2,
    backgroundColor: colors.canvas,
    elevation: 28,
    shadowColor: '#000',
    shadowOpacity: 0.48,
    shadowRadius: 24,
  },
  contextSheet: {
    maxHeight: '82%',
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xs,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.canvas,
  },
  contextHead: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  contextServerIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  contextChannelIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  contextTitle: { color: colors.text, ...typography.heading },
  contextRow: {
    minHeight: 54,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  contextRowText: { flex: 1, color: colors.text, ...typography.body },
  preferenceBack: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  preferenceChoice: {
    minHeight: 52,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inviteSheet: {
    height: '84%',
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.canvas,
  },
  inviteLinkRow: {
    minHeight: 54,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  inviteLink: { flex: 1, color: colors.textMuted, ...typography.caption },
  inviteIconButton: {
    width: touch.minimum,
    height: touch.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteSearch: {
    minHeight: touch.minimum,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.text,
    ...typography.body,
  },
  inviteTabs: { flexDirection: 'row', gap: spacing.xs },
  inviteTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  inviteTabActive: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.waveBright,
  },
  inviteTabText: { color: colors.text, ...typography.label },
  inviteList: { flex: 1 },
  inviteRecipient: {
    minHeight: 62,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inviteSend: {
    minHeight: 36,
    minWidth: 78,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.wave,
  },
  inviteSent: { backgroundColor: colors.surfaceRaised },
  inviteSendText: { color: colors.text, ...typography.caption, fontWeight: '800' },
  folderTargetList: { maxHeight: 380, marginTop: spacing.sm },
  folderTargetRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  fieldLabel: { color: colors.textMuted, ...typography.label, marginTop: spacing.sm },
  folderNameInput: {
    minHeight: touch.minimum,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  colorChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  customColorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  customColorPreview: { width: 42, height: 42, borderRadius: radius.pill },
  colorInput: {
    flex: 1,
    minHeight: touch.minimum,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    color: colors.text,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  disabledAction: { opacity: 0.45 },
  colorChoice: { width: 42, height: 42, borderRadius: radius.pill },
  colorChoiceActive: { borderWidth: 3, borderColor: colors.text },
  saveFolder: {
    minHeight: touch.minimum,
    borderRadius: radius.md,
    backgroundColor: colors.wave,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  saveFolderText: { color: colors.text, ...typography.label },
});
