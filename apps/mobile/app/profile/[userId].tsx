import { Text, Pressable } from '@/components/localized-native';
import type {
  MutualConnections,
  SocialUser,
  UserNote,
  UserProfile,
} from '@wapve/contracts';
import { colors, radius, spacing, touch, typography } from '@wapve/design-tokens';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Image as AnimatedImage } from 'expo-image';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { Avatar, Button, Field, ScreenHeader, SecureImage } from '@/components/ui';
import { Icon } from '@/components/icon';
import { PlatformBadges } from '@/components/platform-badges';
import { GameActivityLabel } from '@/components/game-activity';
import { ServerTagChip } from '@/components/server-tag';
import { useAuth } from '@/lib/auth';
import { api, apiUrl } from '@/lib/client';
import { useDeveloperMode } from '@/lib/developer-mode';
import { SocialUserActionsSheet } from '@/components/social-user-actions-sheet';
import { mobileAvatarAsset, mobileProfileFrame } from '@/components/premium-cosmetic-registry';
const plusBadgeAsset = require('../../assets/premium/wapve-plus-badge.webp') as number;

function media(path: string) {
  return /^https?:\/\//u.test(path) ? path : `${apiUrl.replace(/\/api\/v1$/u, '')}${path}`;
}

export default function ProfileScreen() {
  const { userId = '' } = useLocalSearchParams<{ userId: string }>();
  const { user, refreshUser } = useAuth();
  const { enabled: developerMode } = useDeveloperMode();
  const self = user?.id === userId;
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const own = useQuery({
    queryKey: ['profile', 'me'],
    enabled: self,
    queryFn: () => api.request<UserProfile>('/users/me'),
  });
  const publicProfile = useQuery({
    queryKey: ['social-profile', userId],
    enabled: !self,
    queryFn: () => api.request<SocialUser>(`/social/users/${userId}/profile`),
  });
  const mutuals = useQuery({
    queryKey: ['mutuals', userId],
    enabled: !self && Boolean(userId),
    queryFn: () => api.request<MutualConnections>(`/social/users/${userId}/mutuals`),
  });
  const personalNote = useQuery({
    queryKey: ['user-note', userId],
    enabled: !self && Boolean(userId),
    queryFn: () => api.request<UserNote | null>(`/users/${userId}/note`),
  });
  useEffect(() => {
    setNote(personalNote.data?.content ?? '');
  }, [personalNote.data]);
  const profile = self ? own.data : publicProfile.data;
  const mediaRevision = self ? own.dataUpdatedAt : publicProfile.dataUpdatedAt;
  const avatarDecoration = mobileAvatarAsset(profile?.premium?.avatarDecoration);
  const profileFrame = mobileProfileFrame(profile?.premium?.profileEffect);
  async function save() {
    setSaving(true);
    try {
      await api.request('/users/me', {
        method: 'PATCH',
        body: { displayName: displayName.trim(), bio: bio.trim() || null },
      });
      await Promise.all([own.refetch(), refreshUser()]);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }
  async function saveNote() {
    if (!userId || self) return;
    setNoteSaving(true);
    try {
      if (note.trim()) {
        await api.request(`/users/${userId}/note`, {
          method: 'PATCH',
          body: { content: note.trim() },
        });
      } else {
        await api.request(`/users/${userId}/note`, { method: 'DELETE' });
      }
      await personalNote.refetch();
    } finally {
      setNoteSaving(false);
    }
  }
  return (
    <SafeAreaView style={styles.root}>
      <ScreenHeader
        title="Profil"
        left={
          <Pressable style={styles.back} onPress={() => router.back()} accessibilityLabel="Geri">
            <Icon name="arrow-left" color={colors.text} size={27} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileFrameShell}>
          <View
            style={[
              styles.card,
              profile?.premium?.active && styles.premiumCard,
              profileFrame ? styles.framedCard : null,
            ]}
          >
            <View style={styles.banner}>
              {profile?.bannerUrl ? (
                <SecureImage
                  uri={media(profile.bannerUrl)}
                  revision={mediaRevision}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              ) : null}
            </View>
            <View
              style={[styles.avatar, profile?.premium?.avatarDecoration && styles.premiumAvatar]}
            >
              <Avatar
                name={profile?.displayName ?? user?.displayName ?? '?'}
                uri={profile?.avatarUrl}
                revision={mediaRevision}
                size={92}
                online={profile?.status === 'ONLINE'}
              />
              {avatarDecoration ? (
                <Image
                  source={avatarDecoration}
                  resizeMode="contain"
                  style={styles.avatarDecoration}
                />
              ) : null}
            </View>
            {editing ? (
              <>
                <Field
                  label="Görünen ad"
                  value={displayName}
                  onChangeText={setDisplayName}
                  maxLength={32}
                />
                <Field
                  label="Hakkında"
                  value={bio}
                  onChangeText={setBio}
                  maxLength={190}
                  multiline
                />
                <Button
                  label="Kaydet"
                  loading={saving}
                  disabled={!displayName.trim()}
                  onPress={() => void save()}
                />
                <Button label="Vazgeç" variant="ghost" onPress={() => setEditing(false)} />
              </>
            ) : (
              <>
                <View style={styles.nameLine}>
                  <Text style={styles.name}>
                    {profile?.displayName ??
                      (publicProfile.isLoading || own.isLoading
                        ? 'Yükleniyor…'
                        : 'Kullanıcı bulunamadı')}
                  </Text>
                  {profile ? <PlatformBadges badges={profile.badges} size={25} /> : null}
                  {profile ? <GameActivityLabel person={profile} /> : null}
                  {profile && 'serverTag' in profile ? <ServerTagChip tag={profile.serverTag} /> : null}
                  {profile?.premium?.active ? (
                    <Image
                      source={plusBadgeAsset}
                      resizeMode="contain"
                      style={styles.plusBadgeImage}
                    />
                  ) : null}
                </View>
                {profile?.username ? (
                  <Text style={styles.username}>
                    @{profile.username}
                    {developerMode ? ` · ${profile.publicId}` : ''}
                  </Text>
                ) : null}
                <View style={styles.presence}>
                  <View
                    style={[
                      styles.presenceDot,
                      {
                        backgroundColor:
                          profile?.status === 'DND'
                            ? colors.danger
                            : profile?.status === 'IDLE'
                              ? colors.warning
                              : profile?.status === 'ONLINE'
                                ? colors.success
                                : colors.textDim,
                      },
                    ]}
                  />
                  <Text style={styles.presenceText}>{statusLabel(profile?.status)}</Text>
                </View>
                {profile?.customStatusText ? (
                  <View style={styles.customStatus}>
                    {profile.customStatusEmoji ? <Text>{profile.customStatusEmoji}</Text> : null}
                    <Text style={styles.customStatusText}>{profile.customStatusText}</Text>
                  </View>
                ) : null}
                {profile?.bio ? (
                  <View style={styles.bioCard}>
                    <Text style={styles.bioTitle}>BİYOGRAFİ</Text>
                    <Text style={styles.bio}>{profile.bio}</Text>
                  </View>
                ) : null}
                {profile?.system ? (
                  <View style={styles.bioCard}>
                    <Text style={styles.bioTitle}>RESMÎ WAPVE SİSTEM HESABI</Text>
                    <Text style={styles.bio}>
                      Bu tek yönlü hesap yalnızca gerekli hesap, güvenlik ve platform bildirimlerini
                      gönderir. Mesaj ve arama kabul etmez.
                    </Text>
                  </View>
                ) : null}
                {self ? (
                  <Button
                    label="Profili düzenle"
                    variant="secondary"
                    onPress={() => router.push('/profile/edit')}
                  />
                ) : profile && !profile.system ? (
                  <Button
                    label="Kullanıcı işlemleri"
                    variant="secondary"
                    onPress={() => setActionsOpen(true)}
                  />
                ) : null}
              </>
            )}
          </View>
          {profileFrame?.kind === 'frame' ? (
            <>
              <Image
                source={profileFrame.top}
                resizeMode="stretch"
                style={[styles.profileFramePart, styles.profileFrameTop]}
              />
            </>
          ) : profileFrame ? (
            <AnimatedImage
              source={{ uri: Image.resolveAssetSource(profileFrame.asset).uri, isAnimated: true }}
              autoplay
              contentFit="cover"
              style={styles.profileEffectOverlay}
            />
          ) : null}
        </View>
        {!self && profile && !profile.system ? (
          <View style={styles.card}>
            <Text style={styles.section}>KİŞİSEL NOT</Text>
            <Text style={styles.noteHelp}>Bu notu yalnızca sen görebilirsin.</Text>
            <Field
              label="Bu kişi hakkında not"
              value={note}
              onChangeText={setNote}
              maxLength={256}
              multiline
              style={styles.noteField}
            />
            <View style={styles.noteFooter}>
              <Text style={styles.noteHelp}>{note.length}/256</Text>
              <Button
                label={note.trim() ? 'Notu kaydet' : 'Notu sil'}
                loading={noteSaving}
                variant="secondary"
                onPress={() => void saveNote()}
              />
            </View>
          </View>
        ) : null}
        {!self && mutuals.data ? (
          <View style={styles.card}>
            <Text style={styles.section}>ORTAK BAĞLANTILAR</Text>
            <Text style={styles.count}>{mutuals.data.friends.length} ortak arkadaş</Text>
            <View style={styles.avatarRow}>
              {mutuals.data.friends.map((item) => (
                <Avatar
                  key={item.id}
                  name={item.displayName}
                  uri={item.avatarUrl}
                  size={42}
                  online={item.status === 'ONLINE'}
                />
              ))}
            </View>
            <Text style={styles.count}>{mutuals.data.servers.length} ortak sunucu</Text>
            <View style={styles.serverRow}>
              {mutuals.data.servers.map((server) => (
                <Pressable
                  key={server.id}
                  accessibilityLabel={server.name}
                  accessibilityRole="button"
                  style={styles.serverLogo}
                  onPress={() =>
                    router.push({
                      pathname: '/channels/[serverPublicId]',
                      params: { serverPublicId: server.publicId },
                    })
                  }
                >
                  {server.iconUrl ? (
                    <SecureImage
                      uri={media(server.iconUrl)}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  ) : (
                    <Text style={styles.serverInitial}>
                      {server.name.slice(0, 2).toUpperCase()}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
      <SocialUserActionsSheet
        user={actionsOpen && !self && profile && !profile.system ? (profile as SocialUser) : null}
        hideProfile
        close={() => setActionsOpen(false)}
      />
    </SafeAreaView>
  );
}

function statusLabel(value?: string) {
  return value === 'ONLINE'
    ? 'Çevrimiçi'
    : value === 'IDLE'
      ? 'Boşta'
      : value === 'DND'
        ? 'Rahatsız etmeyin'
        : 'Çevrimdışı';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  back: {
    width: touch.minimum,
    height: touch.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  premiumCard: { borderColor: 'rgba(34,211,238,.42)', backgroundColor: '#0c1c29' },
  profileFrameShell: { position: 'relative', overflow: 'hidden', borderRadius: radius.xl },
  framedCard: { zIndex: 1 },
  profileFramePart: {
    position: 'absolute',
    left: 0,
    width: '100%',
    zIndex: 2,
    pointerEvents: 'none',
  },
  profileFrameTop: { top: -30, height: 112 },
  profileFrameBottom: { bottom: -14, height: 82 },
  profileEffectOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 4,
    borderRadius: radius.xl,
    pointerEvents: 'none',
  },
  banner: {
    height: 140,
    margin: -spacing.lg,
    marginBottom: -52,
    backgroundColor: colors.surfaceSoft,
  },
  avatar: {
    alignSelf: 'flex-start',
    padding: 5,
    borderRadius: 55,
    backgroundColor: colors.surface,
  },
  premiumAvatar: {
    borderWidth: 2,
    borderColor: '#38bdf8',
    shadowColor: '#22d3ee',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  avatarDecoration: {
    position: 'absolute',
    top: -15,
    left: -15,
    width: 132,
    height: 132,
    zIndex: 3,
  },
  nameLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  name: { color: colors.text, ...typography.title },
  plusBadgeImage: { width: 30, height: 30 },
  badge: {
    minHeight: 25,
    paddingHorizontal: 7,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceRaised,
  },
  badgeText: { color: colors.textMuted, ...typography.caption, fontWeight: '800' },
  username: { color: colors.textMuted, ...typography.body },
  presence: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  presenceDot: { width: 10, height: 10, borderRadius: 5 },
  presenceText: { color: colors.textDim, ...typography.caption },
  customStatus: {
    minHeight: 42,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  customStatusText: { flex: 1, color: colors.text, ...typography.body },
  bioCard: {
    gap: spacing.xs,
    marginVertical: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  bioTitle: { color: colors.textDim, ...typography.caption, fontWeight: '800' },
  bio: { color: colors.textMuted, ...typography.body },
  noteHelp: { color: colors.textDim, ...typography.caption },
  noteField: { minHeight: 88, paddingTop: spacing.sm, textAlignVertical: 'top' },
  noteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  section: { color: colors.text, ...typography.heading },
  count: { color: colors.textDim, ...typography.caption, marginTop: spacing.sm },
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  serverRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  serverLogo: {
    width: 48,
    height: 48,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
  },
  serverInitial: { color: colors.text, ...typography.label },
});
