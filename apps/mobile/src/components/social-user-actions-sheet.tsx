import { Text, Modal, Pressable } from '@/components/localized-native';
import { serverInviteUrl } from '@wapve/contracts';
import type {
  BlockedUser,
  Friend,
  FriendRequests,
  ServerInvite,
  ServerSummary,
  SocialUser,
} from '@wapve/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, radius, spacing, typography } from '@wapve/design-tokens';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from '@/components/themed-native';
import { api } from '@/lib/client';
import { Avatar } from './ui';
import { Icon, type IconName } from './icon';
import { PlatformBadges } from './platform-badges';
import { ReportSheet } from './report-sheet';
import { SwipeableSheetSurface } from './swipeable-sheet';

export function SocialUserActionsSheet({
  user,
  close,
  hideProfile = false,
}: {
  user: SocialUser | null;
  close(): void;
  hideProfile?: boolean;
}) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'main' | 'invite'>('main');
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const friends = useQuery({
    queryKey: ['friends'],
    enabled: Boolean(user),
    queryFn: () => api.request<Friend[]>('/social/friends'),
  });
  const requests = useQuery({
    queryKey: ['friend-requests'],
    enabled: Boolean(user),
    queryFn: () => api.request<FriendRequests>('/social/requests'),
  });
  const blocks = useQuery({
    queryKey: ['blocked-users'],
    enabled: Boolean(user),
    queryFn: () => api.request<BlockedUser[]>('/social/blocks'),
  });
  const servers = useQuery({
    queryKey: ['servers'],
    enabled: Boolean(user),
    queryFn: () => api.request<ServerSummary[]>('/servers'),
  });

  useEffect(() => {
    if (user) setView('main');
  }, [user?.id]);

  if (!user) return null;
  const target = user;
  const friend = friends.data?.find((item) => item.user.id === target.id);
  const incoming = requests.data?.incoming.find((item) => item.user.id === target.id);
  const outgoing = requests.data?.outgoing.find((item) => item.user.id === target.id);
  const blocked = blocks.data?.some((item) => item.user.id === target.id) ?? false;
  const interactive = !target.system;

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['friends'] }),
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] }),
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] }),
    ]);
  }

  async function action(path: string, method: 'POST' | 'DELETE', body?: object) {
    if (busy) return;
    setBusy(true);
    try {
      await api.request(path, { method, ...(body ? { body } : {}) });
      await refresh();
      close();
    } finally {
      setBusy(false);
    }
  }

  async function invite(server: ServerSummary) {
    if (!friend || busy) return;
    setBusy(true);
    try {
      const value = await api.request<ServerInvite>(`/servers/${server.id}/invites`, {
        method: 'POST',
        body: { maxUses: 1, expiresInHours: 24 },
      });
      await api.request(`/dm/conversations/${friend.conversationId}/messages`, {
        method: 'POST',
        body: { content: serverInviteUrl(value.code) },
      });
      close();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        visible={Boolean(user) && !reportOpen}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <SwipeableSheetSurface onClose={close} style={styles.sheet}>
            <View style={styles.hero}>
              <Avatar
                name={target.displayName}
                uri={target.avatarUrl}
                size={56}
                online={target.status === 'ONLINE'}
              />
              <View style={styles.copy}>
                <View style={styles.nameLine}>
                  <Text style={styles.title}>{target.displayName}</Text>
                  <PlatformBadges badges={target.badges} size={23} />
                </View>
                <Text style={styles.meta}>@{target.username}</Text>
              </View>
              <Pressable style={styles.close} onPress={close} accessibilityLabel="Kapat">
                <Icon name="close" color={colors.textMuted} size={23} />
              </Pressable>
            </View>
            {view === 'invite' ? (
              <Pressable style={styles.back} onPress={() => setView('main')}>
                <Icon name="arrow-left" color={colors.waveBright} size={21} />
                <Text style={styles.backText}>Kullanıcı işlemlerine dön</Text>
              </Pressable>
            ) : null}
            <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.actions}>
              {view === 'main' ? (
                <>
                  {!hideProfile ? (
                    <Action
                      icon="account-outline"
                      label="Profili görüntüle"
                      onPress={() => {
                        close();
                        router.push({
                          pathname: '/profile/[userId]',
                          params: { userId: target.id },
                        });
                      }}
                    />
                  ) : null}
                  {target.system ? <Text style={styles.systemNotice}>Wapve’nin doğrulanmış sistem hesabı yalnızca gerekli bildirimleri gönderir. Mesaj, arama, arkadaşlık, davet, engelleme ve bildirme işlemleri kapalıdır.</Text> : null}
                  {interactive && friend ? (
                    <Action
                      icon="message-text-outline"
                      label="Mesaj gönder"
                      onPress={() => {
                        close();
                        router.push({
                          pathname: '/dm/[conversationId]',
                          params: {
                            conversationId: friend.conversationId,
                            name: target.displayName,
                          },
                        });
                      }}
                    />
                  ) : null}
                  {interactive && incoming ? (
                    <Action
                      icon="account-check-outline"
                      label="Arkadaşlık isteğini kabul et"
                      onPress={() => void action(`/social/requests/${incoming.id}/accept`, 'POST')}
                    />
                  ) : null}
                  {interactive && outgoing ? (
                    <Action
                      icon="account-clock-outline"
                      label="Gönderilen isteği iptal et"
                      onPress={() => void action(`/social/requests/${outgoing.id}`, 'DELETE')}
                    />
                  ) : null}
                  {interactive && !friend && !incoming && !outgoing && !blocked ? (
                    <Action
                      icon="account-plus-outline"
                      label="Arkadaş ekle"
                      onPress={() =>
                        void action('/social/requests', 'POST', { username: target.username })
                      }
                    />
                  ) : null}
                  {interactive && friend ? (
                    <Action
                      icon="account-minus-outline"
                      label="Arkadaşlıktan çıkar"
                      onPress={() => void action(`/social/friends/${target.id}`, 'DELETE')}
                    />
                  ) : null}
                  {interactive && friend ? (
                    <Action
                      icon="email-outline"
                      label="Sunucuya davet et"
                      onPress={() => setView('invite')}
                    />
                  ) : null}
                  {interactive ? <Action
                    icon={blocked ? 'account-check-outline' : 'block-helper'}
                    label={blocked ? 'Engeli kaldır' : 'Kullanıcıyı engelle'}
                    danger={!blocked}
                    onPress={() =>
                      void action(
                        blocked ? `/social/blocks/${target.id}` : '/social/blocks',
                        blocked ? 'DELETE' : 'POST',
                        blocked ? undefined : { userId: target.id },
                      )
                    }
                  /> : null}
                  {interactive ? <Action
                    icon="shield-alert-outline"
                    label="Kullanıcıyı bildir"
                    danger
                    onPress={() => setReportOpen(true)}
                  /> : null}
                </>
              ) : (
                <>
                  <Text style={styles.section}>DAVET EDİLEBİLEN SUNUCULAR</Text>
                  {(servers.data ?? [])
                    .filter(
                      (server) =>
                        server.role === 'OWNER' || server.permissions.includes('CREATE_INVITES'),
                    )
                    .map((server) => (
                      <Action
                        key={server.id}
                        icon="server-outline"
                        label={server.name}
                        onPress={() => void invite(server)}
                      />
                    ))}
                  {!servers.isLoading &&
                  !(servers.data ?? []).some(
                    (server) =>
                      server.role === 'OWNER' || server.permissions.includes('CREATE_INVITES'),
                  ) ? (
                    <Text style={styles.empty}>Davet oluşturabildiğin bir sunucu yok.</Text>
                  ) : null}
                </>
              )}
              {busy ? <Text style={styles.empty}>İşlem yapılıyor…</Text> : null}
            </ScrollView>
          </SwipeableSheetSurface>
        </View>
      </Modal>
      <ReportSheet
        visible={reportOpen}
        close={() => setReportOpen(false)}
        subject={{
          kind: 'user',
          userId: target.id,
          displayName: target.displayName,
          username: target.username,
        }}
      />
    </>
  );
}

function Action({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon: IconName;
  label: string;
  onPress(): void;
  danger?: boolean;
}) {
  return (
    <Pressable style={styles.action} onPress={onPress}>
      <View style={styles.actionIcon}>
        <Icon name={icon} color={danger ? colors.danger : colors.waveBright} size={22} />
      </View>
      <Text style={[styles.actionText, danger && styles.danger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    maxHeight: '88%',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
  },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.md },
  copy: { flex: 1 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { color: colors.text, ...typography.title },
  meta: { color: colors.textMuted, ...typography.caption },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  backText: { color: colors.waveBright, ...typography.label },
  actions: { gap: spacing.xs, paddingBottom: spacing.xxl },
  action: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  actionIcon: { width: 30, alignItems: 'center' },
  actionText: { flex: 1, color: colors.text, ...typography.body, fontWeight: '700' },
  danger: { color: colors.danger },
  section: { color: colors.textDim, ...typography.caption, fontWeight: '800', letterSpacing: 1 },
  empty: { color: colors.textMuted, ...typography.body, padding: spacing.sm },
  systemNotice: { color: colors.waveBright, ...typography.body, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.waveBright, backgroundColor: colors.surfaceRaised },
});
