import { TextInput, Modal, Text, Alert, Pressable } from '@/components/localized-native';
import type {
  Friend,
  GroupConversation,
  GroupNotificationPreference,
  NotificationMute,
  SocialUser,
  } from '@wapve/contracts';
import {
  useQuery,
  useQueryClient } from '@tanstack/react-query';
import { colors,
  radius,
  spacing,
  touch,
  typography } from '@wapve/design-tokens';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect,
  useMemo,
  useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
} from '@/components/themed-native';
import { api, mobileUpload } from '@/lib/client';
import { useAuth } from '@/lib/auth';
import { Avatar, Button } from './ui';
import { Icon } from './icon';
import { SwipeableSheetSurface } from './swipeable-sheet';

const muteChoices = [
  ['UNMUTED', 'Susturmayı kaldır'],
  ['MINUTES_15', '15 dakika'],
  ['HOUR_1', '1 saat'],
  ['HOURS_3', '3 saat'],
  ['HOURS_8', '8 saat'],
  ['HOURS_24', '24 saat'],
  ['FOREVER', 'Ben açana kadar'],
] as const satisfies ReadonlyArray<readonly [NotificationMute, string]>;

export function GroupManagementSheet({
  visible,
  conversationId,
  close,
  onSelectMember,
}: {
  visible: boolean;
  conversationId: string;
  close(): void;
  onSelectMember(member: SocialUser): void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'main' | 'add' | 'mute'>('main');
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedMember, setSelectedMember] = useState<SocialUser | null>(null);
  const groups = useQuery({
    queryKey: ['group-conversations'],
    enabled: visible,
    queryFn: () => api.request<GroupConversation[]>('/dm/groups'),
  });
  const friends = useQuery({
    queryKey: ['friends'],
    enabled: visible,
    queryFn: () => api.request<Friend[]>('/social/friends'),
  });
  const preference = useQuery({
    queryKey: ['group-notification-preference', conversationId],
    enabled: visible,
    queryFn: () =>
      api.request<GroupNotificationPreference>(
        `/dm/groups/${conversationId}/notification-preference`,
      ),
  });
  const group = groups.data?.find((item) => item.id === conversationId);
  const owner = Boolean(group && group.ownerId === user?.id);
  useEffect(() => {
    if (!visible) return;
    setView('main');
    setSearch('');
    setSelectedMember(null);
  }, [visible]);
  useEffect(() => {
    if (group) setName(group.name);
  }, [group]);
  const availableFriends = useMemo(() => {
    const members = new Set(group?.members.map((member) => member.id) ?? []);
    const normalized = search.trim().toLocaleLowerCase('tr');
    return (friends.data ?? []).filter(
      (friend) =>
        !members.has(friend.user.id) &&
        (!normalized ||
          `${friend.user.displayName} ${friend.user.username}`
            .toLocaleLowerCase('tr')
            .includes(normalized)),
    );
  }, [friends.data, group?.members, search]);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['group-conversations'] });
  }
  async function saveName() {
    if (!group || !owner || name.trim() === group.name || name.trim().length < 2) return;
    setBusy(true);
    try {
      await api.request(`/dm/groups/${conversationId}`, {
        method: 'PATCH',
        body: { name: name.trim() },
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  async function pickAvatar(source: 'library' | 'camera') {
    if (!owner) return;
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.9,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.9,
          });
    if (result.canceled || !result.assets[0]) return;
    setBusy(true);
    try {
      const asset = result.assets[0];
      await mobileUpload(
        `/dm/groups/${conversationId}/avatar`,
        asset.uri,
        asset.fileName ?? `wapve-grup-${Date.now()}.jpg`,
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  function avatarActions() {
    if (!owner) return;
    Alert.alert('Grup fotoğrafı', undefined, [
      { text: 'Galeriden seç', onPress: () => void pickAvatar('library') },
      { text: 'Fotoğraf çek', onPress: () => void pickAvatar('camera') },
      ...(group?.avatarUrl
        ? [
            {
              text: 'Fotoğrafı sil',
              style: 'destructive' as const,
              onPress: () =>
                void api
                  .request(`/dm/groups/${conversationId}/avatar`, { method: 'DELETE' })
                  .then(refresh),
            },
          ]
        : []),
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  }
  async function addMember(userId: string) {
    if (!owner || busy) return;
    setBusy(true);
    try {
      await api.request(`/dm/groups/${conversationId}/members`, {
        method: 'POST',
        body: { userId },
      });
      await refresh();
      setView('main');
    } finally {
      setBusy(false);
    }
  }
  function removeMember(member: SocialUser) {
    Alert.alert(
      'Üyeyi çıkar',
      `${member.displayName} gruptan çıkarılsın mı?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Çıkar',
          style: 'destructive',
          onPress: () =>
            void api
              .request(`/dm/groups/${conversationId}/members/${member.id}`, { method: 'DELETE' })
              .then(async () => {
                setSelectedMember(null);
                await refresh();
              }),
        },
      ],
    );
  }
  function transferOwnership(member: SocialUser) {
    Alert.alert(
      'Sahipliği devret',
      `${member.displayName} grubun yeni sahibi olacak. Devam edilsin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Devret',
          onPress: () =>
            void api
              .request(`/dm/groups/${conversationId}/owner`, {
                method: 'PATCH',
                body: { userId: member.id },
              })
              .then(async () => {
                setSelectedMember(null);
                await refresh();
              }),
        },
      ],
    );
  }
  function leaveOrDelete() {
    if (!group) return;
    Alert.alert(
      owner ? 'Grubu sil' : 'Gruptan ayrıl',
      owner
        ? 'Grup ve tüm mesajları kalıcı olarak silinecek.'
        : `${group.name} grubundan ayrılacaksın.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: owner ? 'Grubu sil' : 'Ayrıl',
          style: 'destructive',
          onPress: () =>
            void api
              .request(`/dm/groups/${conversationId}${owner ? '' : '/leave'}`, {
                method: owner ? 'DELETE' : 'POST',
              })
              .then(async () => {
                await refresh();
                close();
                router.replace('/(tabs)');
              }),
        },
      ],
    );
  }
  async function updateMute(mute: NotificationMute) {
    await api.request(`/dm/groups/${conversationId}/notification-preference`, {
      method: 'PATCH',
      body: { mute },
    });
    await preference.refetch();
    setView('main');
  }
  const notificationLabel = preference.data?.isMuted
    ? preference.data.mutedIndefinitely
      ? 'Sen açana kadar susturuldu'
      : `Susturuldu · ${new Date(preference.data.mutedUntil!).toLocaleString('tr-TR')}`
    : 'Bildirimler açık';

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <SwipeableSheetSurface onClose={close} style={styles.sheet}>
            <View style={styles.header}>
              {view !== 'main' ? (
                <Pressable style={styles.iconButton} onPress={() => setView('main')}>
                  <Icon name="arrow-left" color={colors.text} size={25} />
                </Pressable>
              ) : null}
              <View style={styles.headerCopy}>
                <Text style={styles.title}>
                  {view === 'add' ? 'Gruba üye ekle' : view === 'mute' ? 'Grup bildirimleri' : 'Grup ayarları'}
                </Text>
                {view === 'main' ? <Text style={styles.meta}>{group?.members.length ?? 0}/10 üye</Text> : null}
              </View>
              <Pressable style={styles.iconButton} onPress={close} accessibilityLabel="Kapat">
                <Icon name="close" color={colors.textMuted} size={26} />
              </Pressable>
            </View>
            {view === 'main' ? (
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.content}
              >
                <Pressable style={styles.avatarButton} onPress={avatarActions} disabled={!owner || busy}>
                  <Avatar name={group?.name ?? 'Grup'} uri={group?.avatarUrl} size={86} />
                  {owner ? (
                    <View style={styles.avatarEdit}>
                      <Icon name="camera-outline" color={colors.text} size={19} />
                    </View>
                  ) : null}
                </Pressable>
                <Text style={styles.label}>GRUP ADI</Text>
                <View style={styles.nameRow}>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    editable={owner && !busy}
                    maxLength={50}
                    style={styles.input}
                    placeholderTextColor={colors.textDim}
                  />
                  {owner && name.trim() !== group?.name ? (
                    <Pressable style={styles.saveName} onPress={() => void saveName()} disabled={busy}>
                      <Icon name="check" color={colors.text} size={22} />
                    </Pressable>
                  ) : null}
                </View>
                <Pressable style={styles.settingRow} onPress={() => setView('mute')}>
                  <View style={styles.settingIcon}>
                    <Icon
                      name={preference.data?.isMuted ? 'bell-off-outline' : 'bell-outline'}
                      color={colors.waveBright}
                      size={23}
                    />
                  </View>
                  <View style={styles.headerCopy}>
                    <Text style={styles.settingTitle}>Bildirimler</Text>
                    <Text style={styles.meta}>{notificationLabel}</Text>
                  </View>
                </Pressable>
                <View style={styles.sectionHeader}>
                  <Text style={styles.label}>ÜYELER</Text>
                  {owner && (group?.members.length ?? 10) < 10 ? (
                    <Pressable style={styles.addButton} onPress={() => setView('add')}>
                      <Icon name="account-plus-outline" color={colors.waveBright} size={20} />
                      <Text style={styles.addText}>Ekle</Text>
                    </Pressable>
                  ) : null}
                </View>
                <View style={styles.memberList}>
                  {group?.members.map((member) => (
                    <Pressable
                      key={member.id}
                      style={styles.memberRow}
                      onPress={() => setSelectedMember(member)}
                    >
                      <Avatar
                        name={member.displayName}
                        uri={member.avatarUrl}
                        size={44}
                        online={member.status === 'ONLINE'}
                      />
                      <View style={styles.headerCopy}>
                        <Text style={styles.memberName}>{member.displayName}</Text>
                        <Text style={styles.meta}>
                          @{member.username}{member.id === group.ownerId ? ' · Grup sahibi' : ''}
                        </Text>
                      </View>
                      <Icon name="dots-horizontal" color={colors.textDim} size={23} />
                    </Pressable>
                  ))}
                </View>
                <Button
                  label={owner ? 'Grubu sil' : 'Gruptan ayrıl'}
                  variant="danger"
                  onPress={leaveOrDelete}
                />
              </ScrollView>
            ) : view === 'add' ? (
              <View style={styles.subview}>
                <TextInput
                  autoFocus
                  value={search}
                  onChangeText={setSearch}
                  style={styles.search}
                  placeholder="Arkadaş ara"
                  placeholderTextColor={colors.textDim}
                />
                <ScrollView keyboardShouldPersistTaps="handled">
                  {availableFriends.map((friend) => (
                    <Pressable
                      key={friend.friendshipId}
                      style={styles.memberRow}
                      onPress={() => void addMember(friend.user.id)}
                      disabled={busy}
                    >
                      <Avatar name={friend.user.displayName} uri={friend.user.avatarUrl} size={44} />
                      <View style={styles.headerCopy}>
                        <Text style={styles.memberName}>{friend.user.displayName}</Text>
                        <Text style={styles.meta}>@{friend.user.username}</Text>
                      </View>
                      <Icon name="plus-circle-outline" color={colors.waveBright} size={24} />
                    </Pressable>
                  ))}
                  {!availableFriends.length ? (
                    <Text style={styles.empty}>Eklenebilecek arkadaş bulunamadı.</Text>
                  ) : null}
                </ScrollView>
              </View>
            ) : (
              <View style={styles.subview}>
                {muteChoices.map(([value, label]) => {
                  const active =
                    value === 'UNMUTED'
                      ? !preference.data?.isMuted
                      : value === 'FOREVER' && Boolean(preference.data?.mutedIndefinitely);
                  return (
                    <Pressable
                      key={value}
                      style={styles.choice}
                      onPress={() => void updateMute(value)}
                    >
                      <Icon
                        name={active ? 'radiobox-marked' : 'radiobox-blank'}
                        color={active ? colors.waveBright : colors.textDim}
                        size={23}
                      />
                      <Text style={styles.settingTitle}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </SwipeableSheetSurface>
        </View>
      </Modal>
      <GroupMemberActionSheet
        member={selectedMember}
        {...(user?.id ? { ownUserId: user.id } : {})}
        owner={owner}
        {...(group?.ownerId ? { groupOwnerId: group.ownerId } : {})}
        close={() => setSelectedMember(null)}
        viewProfile={() => {
          if (!selectedMember) return;
          setSelectedMember(null);
          close();
          onSelectMember(selectedMember);
        }}
        remove={() => selectedMember && removeMember(selectedMember)}
        transfer={() => selectedMember && transferOwnership(selectedMember)}
      />
    </>
  );
}

function GroupMemberActionSheet({
  member,
  ownUserId,
  owner,
  groupOwnerId,
  close,
  viewProfile,
  remove,
  transfer,
}: {
  member: SocialUser | null;
  ownUserId?: string;
  owner: boolean;
  groupOwnerId?: string;
  close(): void;
  viewProfile(): void;
  remove(): void;
  transfer(): void;
}) {
  const friends = useQuery({
    queryKey: ['friends'],
    enabled: Boolean(member),
    queryFn: () => api.request<Friend[]>('/social/friends'),
  });
  const friend = friends.data?.find((item) => item.user.id === member?.id);
  const canManage = Boolean(owner && member && member.id !== ownUserId && member.id !== groupOwnerId);
  return (
    <Modal visible={Boolean(member)} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <SwipeableSheetSurface onClose={close} style={styles.memberSheet}>
          {member ? (
            <>
              <View style={styles.memberSheetHead}>
                <Avatar name={member.displayName} uri={member.avatarUrl} size={58} />
                <View style={styles.headerCopy}>
                  <Text style={styles.title}>{member.displayName}</Text>
                  <Text style={styles.meta}>@{member.username}</Text>
                </View>
              </View>
              <Action icon="account-outline" label="Kullanıcı işlemleri" onPress={viewProfile} />
              {friend && member.id !== ownUserId ? (
                <Action
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
              {canManage ? (
                <>
                  <Action icon="crown-outline" label="Sahipliği devret" onPress={transfer} />
                  <Action icon="account-remove-outline" label="Gruptan çıkar" danger onPress={remove} />
                </>
              ) : null}
            </>
          ) : null}
        </SwipeableSheetSurface>
      </View>
    </Modal>
  );
}

function Action({
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
    <Pressable style={styles.action} onPress={onPress}>
      <Icon name={icon} color={danger ? colors.danger : colors.waveBright} size={23} />
      <Text style={[styles.actionText, danger && styles.danger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    height: '92%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.canvas,
    overflow: 'hidden',
  },
  header: {
    minHeight: 62,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  headerCopy: { flex: 1 },
  title: { color: colors.text, ...typography.heading },
  meta: { color: colors.textDim, ...typography.caption },
  iconButton: { width: touch.minimum, height: touch.minimum, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  avatarButton: { alignSelf: 'center', position: 'relative', marginBottom: spacing.sm },
  avatarEdit: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.wave,
  },
  label: { color: colors.textDim, ...typography.caption, fontWeight: '800', letterSpacing: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  input: {
    flex: 1,
    minHeight: touch.minimum,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    backgroundColor: colors.surface,
    ...typography.body,
  },
  saveName: {
    width: touch.minimum,
    height: touch.minimum,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.wave,
  },
  settingRow: {
    minHeight: 68,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  settingIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  settingTitle: { color: colors.text, ...typography.body, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  addButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm },
  addText: { color: colors.waveBright, ...typography.caption, fontWeight: '800' },
  memberList: { gap: spacing.xs },
  memberRow: {
    minHeight: 62,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  memberName: { color: colors.text, ...typography.label },
  subview: { flex: 1, padding: spacing.lg, gap: spacing.sm },
  search: {
    minHeight: touch.minimum,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    backgroundColor: colors.surface,
    ...typography.body,
  },
  empty: { color: colors.textDim, ...typography.body, textAlign: 'center', padding: spacing.xl },
  choice: { minHeight: 54, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  memberSheet: {
    maxHeight: '70%',
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.canvas,
  },
  memberSheetHead: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  action: { minHeight: 54, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actionText: { flex: 1, color: colors.text, ...typography.body },
  danger: { color: colors.danger },
});
