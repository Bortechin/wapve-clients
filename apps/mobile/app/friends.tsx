import { Text, Pressable } from '@/components/localized-native';
import type { BlockedUser, Friend, FriendRequests, SocialUser } from '@wapve/contracts';
import { colors, radius, spacing, touch, typography } from '@wapve/design-tokens';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { Icon } from '@/components/icon';
import { SocialUserActionsSheet } from '@/components/social-user-actions-sheet';
import { Avatar, ScreenHeader } from '@/components/ui';
import { api } from '@/lib/client';

type Tab = 'friends' | 'incoming' | 'outgoing' | 'blocked';

export default function FriendsScreen() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('friends');
  const [busy, setBusy] = useState('');
  const [selected, setSelected] = useState<SocialUser | null>(null);
  const friends = useQuery({
    queryKey: ['friends'],
    queryFn: () => api.request<Friend[]>('/social/friends'),
  });
  const requests = useQuery({
    queryKey: ['friend-requests'],
    queryFn: () => api.request<FriendRequests>('/social/requests'),
  });
  const blocks = useQuery({
    queryKey: ['blocked-users'],
    queryFn: () => api.request<BlockedUser[]>('/social/blocks'),
  });
  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['friends'] }),
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] }),
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] }),
    ]);
  }
  async function respond(id: string, accept: boolean) {
    setBusy(id);
    try {
      await api.request(`/social/requests/${id}${accept ? '/accept' : ''}`, {
        method: accept ? 'POST' : 'DELETE',
      });
      await refresh();
    } finally {
      setBusy('');
    }
  }
  async function unblock(userId: string) {
    setBusy(userId);
    try {
      await api.request(`/social/blocks/${userId}`, { method: 'DELETE' });
      await refresh();
    } finally {
      setBusy('');
    }
  }
  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'friends', label: 'Arkadaşlar', count: friends.data?.length ?? 0 },
    { id: 'incoming', label: 'Gelen', count: requests.data?.incoming.length ?? 0 },
    { id: 'outgoing', label: 'Giden', count: requests.data?.outgoing.length ?? 0 },
    { id: 'blocked', label: 'Engellenen', count: blocks.data?.length ?? 0 },
  ];
  return (
    <SafeAreaView style={styles.root}>
      <ScreenHeader
        title="Arkadaşlar"
        left={<Back />}
        right={
          <Pressable
            style={styles.headerAction}
            onPress={() => router.push('/friends/add')}
            accessibilityLabel="Arkadaş ekle"
          >
            <Icon name="account-plus-outline" color={colors.waveBright} size={25} />
          </Pressable>
        }
      />
      <View style={styles.tabFrame}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {tabs.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.tab, tab === item.id && styles.tabActive]}
              onPress={() => setTab(item.id)}
            >
              <Text style={[styles.tabText, tab === item.id && styles.tabTextActive]}>
                {item.label}
              </Text>
              {item.count ? <Text style={styles.tabCount}>{item.count}</Text> : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'friends' ? (
          <View style={styles.card}>
            <Text style={styles.section}>TÜM ARKADAŞLAR · {friends.data?.length ?? 0}</Text>
            {friends.data?.map((friend) => (
              <Pressable
                key={friend.friendshipId}
                style={styles.row}
                delayLongPress={300}
                onLongPress={() => setSelected(friend.user)}
                onPress={() =>
                  router.push({
                    pathname: '/dm/[conversationId]',
                    params: {
                      conversationId: friend.conversationId,
                      name: friend.user.displayName,
                    },
                  })
                }
              >
                <User user={friend.user} />
                <Pressable
                  style={styles.mini}
                  onPress={() => setSelected(friend.user)}
                  accessibilityLabel={`${friend.user.displayName} işlemleri`}
                >
                  <Icon name="dots-vertical" color={colors.textMuted} size={23} />
                </Pressable>
              </Pressable>
            ))}
            {!friends.isLoading && !friends.data?.length ? (
              <Empty text="Henüz arkadaşın yok. Sağ üstten arkadaş ekleyebilirsin." />
            ) : null}
          </View>
        ) : null}
        {tab === 'incoming' ? (
          <View style={styles.card}>
            <Text style={styles.section}>
              GELEN İSTEKLER · {requests.data?.incoming.length ?? 0}
            </Text>
            {requests.data?.incoming.map((request) => (
              <Pressable
                key={request.id}
                style={styles.row}
                onPress={() => setSelected(request.user)}
              >
                <User user={request.user} />
                <Pressable
                  style={[styles.mini, styles.accept]}
                  disabled={busy === request.id}
                  onPress={() => void respond(request.id, true)}
                  accessibilityLabel="Kabul et"
                >
                  <Icon name="check" color={colors.text} size={22} />
                </Pressable>
                <Pressable
                  style={[styles.mini, styles.reject]}
                  disabled={busy === request.id}
                  onPress={() => void respond(request.id, false)}
                  accessibilityLabel="Reddet"
                >
                  <Icon name="close" color={colors.text} size={22} />
                </Pressable>
              </Pressable>
            ))}
            {!requests.isLoading && !requests.data?.incoming.length ? (
              <Empty text="Bekleyen gelen isteğin yok." />
            ) : null}
          </View>
        ) : null}
        {tab === 'outgoing' ? (
          <View style={styles.card}>
            <Text style={styles.section}>
              GİDEN İSTEKLER · {requests.data?.outgoing.length ?? 0}
            </Text>
            {requests.data?.outgoing.map((request) => (
              <Pressable
                key={request.id}
                style={styles.row}
                onPress={() => setSelected(request.user)}
              >
                <User user={request.user} />
                <Pressable
                  style={styles.cancel}
                  disabled={busy === request.id}
                  onPress={() => void respond(request.id, false)}
                >
                  <Text style={styles.cancelText}>İptal et</Text>
                </Pressable>
              </Pressable>
            ))}
            {!requests.isLoading && !requests.data?.outgoing.length ? (
              <Empty text="Bekleyen giden isteğin yok." />
            ) : null}
          </View>
        ) : null}
        {tab === 'blocked' ? (
          <View style={styles.card}>
            <Text style={styles.section}>ENGELLENENLER · {blocks.data?.length ?? 0}</Text>
            {blocks.data?.map((item) => (
              <Pressable
                key={item.user.id}
                style={styles.row}
                onPress={() => setSelected(item.user)}
              >
                <User user={item.user} />
                <Pressable
                  style={styles.cancel}
                  disabled={busy === item.user.id}
                  onPress={() => void unblock(item.user.id)}
                >
                  <Text style={styles.cancelText}>Engeli kaldır</Text>
                </Pressable>
              </Pressable>
            ))}
            {!blocks.isLoading && !blocks.data?.length ? (
              <Empty text="Engellediğin kullanıcı yok." />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <SocialUserActionsSheet user={selected} close={() => setSelected(null)} />
    </SafeAreaView>
  );
}

function User({ user }: { user: SocialUser }) {
  return (
    <>
      <Avatar
        name={user.displayName}
        uri={user.avatarUrl}
        size={46}
        online={user.status === 'ONLINE'}
      />
      <View style={styles.copy}>
        <Text style={styles.name}>{user.displayName}</Text>
        <GameActivityLabel person={user} />
        <ServerTagChip tag={user.serverTag} />
        <Text style={styles.meta}>
          {user.customStatusText
            ? `${user.customStatusEmoji ? `${user.customStatusEmoji} ` : ''}${user.customStatusText}`
            : `@${user.username} · ${user.status === 'OFFLINE' ? 'Çevrimdışı' : user.status === 'DND' ? 'Rahatsız etmeyin' : user.status === 'IDLE' ? 'Boşta' : 'Çevrimiçi'}`}
        </Text>
      </View>
    </>
  );
}
function Empty({ text }: { text: string }) {
  return <Text style={styles.help}>{text}</Text>;
}
function Back() {
  return (
    <Pressable style={styles.headerAction} onPress={() => router.back()} accessibilityLabel="Geri">
      <Icon name="arrow-left" color={colors.text} size={27} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  tabFrame: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  tabs: { gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  tab: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.wave },
  tabText: { color: colors.textMuted, ...typography.label },
  tabTextActive: { color: colors.text },
  tabCount: {
    minWidth: 20,
    textAlign: 'center',
    color: colors.text,
    ...typography.caption,
    fontWeight: '800',
  },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  headerAction: {
    width: touch.minimum,
    height: touch.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  section: { color: colors.textDim, ...typography.caption, fontWeight: '800', letterSpacing: 1 },
  help: {
    color: colors.textMuted,
    ...typography.body,
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
    borderRadius: radius.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  copy: { flex: 1 },
  name: { color: colors.text, ...typography.heading },
  meta: { color: colors.textDim, ...typography.caption },
  mini: {
    width: touch.minimum,
    height: touch.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  accept: { backgroundColor: colors.success },
  reject: { backgroundColor: colors.danger },
  cancel: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  cancelText: { color: colors.waveBright, ...typography.label },
});
import { GameActivityLabel } from '@/components/game-activity';
import { ServerTagChip } from '@/components/server-tag';
