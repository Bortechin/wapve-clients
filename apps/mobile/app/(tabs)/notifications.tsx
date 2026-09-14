import { Text, Pressable } from '@/components/localized-native';
import type { AppNotification, ChannelTree, NotificationPage } from '@wapve/contracts';
import {
  useQuery,
  useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { colors, radius, spacing, touch, typography } from '@wapve/design-tokens';
import { api } from '@/lib/client';
import { useI18n } from '@/lib/i18n';
import { Icon, type IconName } from '@/components/icon';

const notificationCopy = {
  MENTION: 'Senden bahsetti',
  CHANNEL_MESSAGE: 'Yeni kanal mesajı gönderdi',
  DIRECT_MESSAGE: 'Sana mesaj gönderdi',
  FRIEND_REQUEST: 'Arkadaşlık isteği gönderdi',
  SERVER_MEMBER_JOINED: 'Sunucuya katıldı',
  VOICE_CHANNEL_JOINED: 'Ses kanalına katıldı',
  MODERATION_ACTION: 'Moderasyon bildirimi',
  CONTENT_REPORT: 'İncelenmek üzere içerik bildirdi',
} as const;

const notificationIcon: Record<AppNotification['type'], IconName> = {
  MENTION: 'at',
  CHANNEL_MESSAGE: 'message-text-outline',
  DIRECT_MESSAGE: 'message-outline',
  FRIEND_REQUEST: 'account-plus-outline',
  SERVER_MEMBER_JOINED: 'account-multiple-plus-outline',
  VOICE_CHANNEL_JOINED: 'headphones',
  MODERATION_ACTION: 'shield-alert-outline',
  CONTENT_REPORT: 'flag-outline',
};

export default function NotificationsScreen() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.request<NotificationPage>('/notifications?limit=30'),
    refetchInterval: 30_000,
  });
  const visible = query.data?.items.filter((item) => filter === 'all' || !item.readAt) ?? [];

  async function read(notification: AppNotification) {
    if (busy) return;
    setBusy(true);
    try {
      if (!notification.readAt) {
        await api.request(`/notifications/${notification.id}/read`, { method: 'PATCH' });
      }
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await navigate(notification);
    } finally {
      setBusy(false);
    }
  }

  async function readAll() {
    if (busy) return;
    setBusy(true);
    try {
      await api.request('/notifications/read-all', { method: 'POST' });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } finally {
      setBusy(false);
    }
  }

  async function navigate(notification: AppNotification) {
    if (notification.type === 'FRIEND_REQUEST') {
      router.push('/friends');
      return;
    }
    if (notification.type === 'DIRECT_MESSAGE' && notification.conversationId) {
      router.push({
        pathname: '/dm/[conversationId]',
        params: {
          conversationId: notification.conversationId,
          name: notification.actor?.displayName ?? 'Özel mesaj',
          ...(notification.messageId ? { messageId: notification.messageId } : {}),
        },
      });
      return;
    }
    if (notification.server && notification.channel) {
      const voice = notification.type === 'VOICE_CHANNEL_JOINED';
      router.push({
        pathname: voice
          ? '/voice/[serverId]/[channelId]'
          : '/channel/[serverId]/[channelId]',
        params: {
          serverId: notification.server.id,
          channelId: notification.channel.id,
          name: notification.channel.name,
          ...(!voice && notification.messageId ? { messageId: notification.messageId } : {}),
        },
      });
      return;
    }
    if (notification.server) {
      const tree = await api.request<ChannelTree>(`/servers/${notification.server.id}/channels`);
      const channel = tree.channels.find((item) => item.type === 'TEXT') ?? tree.channels[0];
      if (channel) {
        router.push({
          pathname:
            channel.type === 'VOICE'
              ? '/voice/[serverId]/[channelId]'
              : '/channel/[serverId]/[channelId]',
          params: { serverId: notification.server.id, channelId: channel.id, name: channel.name },
        });
        return;
      }
    }
    if (notification.actor) {
      router.push({
        pathname: '/profile/[userId]',
        params: { userId: notification.actor.id, name: notification.actor.displayName },
      });
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()} accessibilityLabel="Geri">
          <Icon name="arrow-left" color={colors.text} size={27} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{t('notifications')}</Text>
          <Text style={styles.headerMeta}>
            {query.data?.unreadCount ? `${query.data.unreadCount} okunmamış` : 'Hepsi okundu'}
          </Text>
        </View>
        {query.data?.unreadCount ? (
          <Pressable style={styles.readAll} disabled={busy} onPress={() => void readAll()}>
            <Icon name="check-all" color={colors.waveBright} size={20} />
            <Text style={styles.readAllText}>Tümünü oku</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.filters}>
        <Filter label="Tümü" active={filter === 'all'} onPress={() => setFilter('all')} />
        <Filter label="Okunmamış" active={filter === 'unread'} onPress={() => setFilter('unread')} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.wave}
          />
        }
      >
        {visible.map((item) => (
          <Pressable
            key={item.id}
            disabled={busy}
            style={({ pressed }) => [
              styles.card,
              !item.readAt && styles.cardUnread,
              pressed && styles.cardPressed,
            ]}
            onPress={() => void read(item)}
          >
            <View style={[styles.cardIcon, !item.readAt && styles.cardIconUnread]}>
              <Icon
                name={notificationIcon[item.type]}
                color={!item.readAt ? colors.waveBright : colors.textMuted}
                size={22}
              />
            </View>
            <View style={styles.copy}>
              <Text style={styles.actor}>{item.actor?.displayName ?? item.server?.name ?? 'Wapve'}</Text>
              <Text style={styles.body}>{notificationText(item)}</Text>
              <Text style={styles.time}>{new Date(item.createdAt).toLocaleString('tr-TR')}</Text>
            </View>
            {!item.readAt ? <View style={styles.dot} /> : null}
          </Pressable>
        ))}
        {!visible.length ? (
          <View style={styles.empty}>
            <Icon name="bell-sleep-outline" color={colors.waveBright} size={58} />
            <Text style={styles.emptyTitle}>
              {filter === 'unread' ? 'Okunmamış bildirim yok.' : 'Her şey sakin.'}
            </Text>
            <Text style={styles.body}>Yeni bildirimler burada anlık görünecek.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function notificationText(notification: AppNotification) {
  const base = notificationCopy[notification.type];
  const channel = notification.channel?.name ? ` · #${notification.channel.name}` : '';
  const server = notification.server?.name ? ` · ${notification.server.name}` : '';
  const reason = notification.moderation?.reason ? ` — ${notification.moderation.reason}` : '';
  return `${base}${channel || server}${reason}`;
}

function Filter({ label, active, onPress }: { label: string; active: boolean; onPress(): void }) {
  return (
    <Pressable style={[styles.filter, active && styles.filterActive]} onPress={onPress}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  iconButton: { width: touch.minimum, height: touch.minimum, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { color: colors.text, ...typography.title },
  headerMeta: { color: colors.textDim, ...typography.caption },
  readAll: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surface },
  readAllText: { color: colors.waveBright, ...typography.caption, fontWeight: '700' },
  filters: { flexDirection: 'row', gap: spacing.xs, padding: spacing.sm },
  filter: { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  filterActive: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.waveBright },
  filterText: { color: colors.textMuted, ...typography.caption, fontWeight: '700' },
  filterTextActive: { color: colors.text },
  content: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  card: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  cardUnread: { borderWidth: 1, borderColor: colors.wave },
  cardPressed: { backgroundColor: colors.surfaceRaised },
  cardIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSoft },
  cardIconUnread: { backgroundColor: colors.surfaceRaised },
  dot: { width: 9, height: 9, borderRadius: radius.pill, backgroundColor: colors.waveBright },
  copy: { flex: 1 },
  actor: { color: colors.text, ...typography.heading },
  body: { color: colors.textMuted, ...typography.body },
  time: { color: colors.textDim, ...typography.caption, marginTop: spacing.xs },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 440, gap: spacing.sm },
  emptyTitle: { color: colors.text, ...typography.title },
});
