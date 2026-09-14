import { Alert, Pressable, Text } from '@/components/localized-native';
import type { PremiumCosmeticItem, PremiumCosmeticType, PremiumDashboard, UserProfile } from '@wapve/contracts';
import { colors, radius, spacing, touch, typography } from '@wapve/design-tokens';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, useWindowDimensions, View } from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { Icon } from '@/components/icon';
import { ImageCropEditor, type CropResult, type CropSource } from '@/components/image-crop-editor';
import { MobileProfilePreview } from '@/components/mobile-profile-preview';
import { Avatar, Button, Field, ScreenHeader, SecureImage } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { api, mobileUpload } from '@/lib/client';
import { useI18n } from '@/lib/i18n';

type Section = 'PROFILE' | PremiumCosmeticType;
type CosmeticDraft = Record<PremiumCosmeticType, string | null | undefined>;

const fieldByType: Record<PremiumCosmeticType, 'avatarDecorationId' | 'profileEffectId' | 'nameplateId'> = {
  AVATAR_DECORATION: 'avatarDecorationId',
  PROFILE_EFFECT: 'profileEffectId',
  NAMEPLATE: 'nameplateId',
};

export default function EditProfileScreen() {
  const { locale } = useI18n();
  const { width, fontScale } = useWindowDimensions();
  const tr = locale === 'tr';
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ['profile', 'me'], queryFn: () => api.request<UserProfile>('/users/me') });
  const premium = useQuery({ queryKey: ['premium'], queryFn: () => api.request<PremiumDashboard>('/premium/me') });
  const [section, setSection] = useState<Section>('PROFILE');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [crop, setCrop] = useState<{ kind: 'avatar' | 'banner'; source: CropSource } | null>(null);
  const [draft, setDraft] = useState<CosmeticDraft>({ AVATAR_DECORATION: undefined, PROFILE_EFFECT: undefined, NAMEPLATE: undefined });

  useEffect(() => {
    if (!profile.data) return;
    setDisplayName(profile.data.displayName);
    setUsername(profile.data.username);
    setBio(profile.data.bio ?? '');
  }, [profile.data]);

  const profileDirty = Boolean(profile.data) && (
    displayName !== profile.data?.displayName
    || username !== profile.data?.username
    || bio !== (profile.data?.bio ?? '')
  );
  const cosmeticDirty = Object.values(draft).some((value) => value !== undefined);
  const dirty = profileDirty || cosmeticDirty;

  function close() {
    if (!dirty) { router.back(); return; }
    Alert.alert(
      tr ? 'Değişiklikler kaydedilmedi' : 'Unsaved changes',
      tr ? 'Önizleme seçimlerini ve profil değişikliklerini atmak istiyor musun?' : 'Discard your preview selections and profile changes?',
      [
        { text: tr ? 'Devam et' : 'Keep editing', style: 'cancel' },
        { text: tr ? 'Değişiklikleri at' : 'Discard', style: 'destructive', onPress: () => router.back() },
      ],
    );
  }

  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => listener.remove();
  });

  async function upload(kind: 'avatar' | 'banner', source: 'library' | 'camera') {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, quality: 1 };
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    setCrop({ kind, source: { uri: asset.uri, width: asset.width, height: asset.height, fileName: asset.fileName ?? `${kind}.jpg` } });
  }

  async function applyCrop(result: CropResult) {
    if (!crop) return;
    const kind = crop.kind;
    await mobileUpload(`/users/me/${kind}`, result.uri, result.fileName);
    setCrop(null);
    await Promise.all([
      profile.refetch(),
      refreshUser(),
      queryClient.invalidateQueries({ queryKey: ['me-profile'] }),
    ]);
  }

  async function removeMedia(kind: 'avatar' | 'banner') {
    await api.request(`/users/me/${kind}`, { method: 'DELETE' });
    await Promise.all([
      profile.refetch(),
      refreshUser(),
      queryClient.invalidateQueries({ queryKey: ['me-profile'] }),
    ]);
  }

  function mediaActions(kind: 'avatar' | 'banner') {
    const exists = kind === 'avatar' ? Boolean(profile.data?.avatarUrl) : Boolean(profile.data?.bannerUrl);
    Alert.alert(
      kind === 'avatar' ? (tr ? 'Profil fotoğrafı' : 'Profile photo') : (tr ? 'Profil afişi' : 'Profile banner'),
      tr ? 'Fotoğrafı yüklemeden önce taşıyıp kırpabilirsin.' : 'You can position and crop the photo before uploading.',
      [
        { text: tr ? 'Galeriden seç' : 'Choose from library', onPress: () => void upload(kind, 'library') },
        { text: tr ? 'Fotoğraf çek' : 'Take photo', onPress: () => void upload(kind, 'camera') },
        ...(exists ? [{ text: tr ? 'Fotoğrafı sil' : 'Remove photo', style: 'destructive' as const, onPress: () => void removeMedia(kind) }] : []),
        { text: tr ? 'Vazgeç' : 'Cancel', style: 'cancel' },
      ],
    );
  }

  async function saveProfile() {
    if (!displayName.trim() || !username.trim()) return;
    setSaving(true);
    try {
      await api.request('/users/me', { method: 'PATCH', body: { displayName: displayName.trim(), username: username.trim(), bio: bio.trim() || null } });
      await Promise.all([
        profile.refetch(),
        refreshUser(),
        queryClient.invalidateQueries({ queryKey: ['me-profile'] }),
      ]);
      Alert.alert(tr ? 'Profil güncellendi' : 'Profile updated', tr ? 'Değişikliklerin kaydedildi.' : 'Your changes were saved.');
    } catch {
      Alert.alert(
        tr ? 'Profil kaydedilemedi' : 'Profile could not be saved',
        tr ? 'Kullanıcı adı kullanımda olabilir veya değişiklik süren dolmamış olabilir.' : 'The username may be unavailable or still subject to a change cooldown.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function applyCosmetic(type: PremiumCosmeticType) {
    if (draft[type] === undefined) return;
    setSaving(true);
    try {
      const next = await api.request<PremiumDashboard>('/premium/equipped', {
        method: 'PATCH',
        body: { [fieldByType[type]]: draft[type] },
      });
      queryClient.setQueryData(['premium'], next);
      setDraft((current) => ({ ...current, [type]: undefined }));
      await Promise.all([
        profile.refetch(),
        refreshUser(),
        queryClient.invalidateQueries({ queryKey: ['me-profile'] }),
      ]);
    } catch {
      Alert.alert(tr ? 'Seçim uygulanamadı' : 'Selection could not be applied', tr ? 'Lütfen biraz sonra tekrar dene.' : 'Please try again in a moment.');
    } finally {
      setSaving(false);
    }
  }

  const currentUser = profile.data ?? user;
  const owned = useMemo(() => premium.data?.catalog.filter((item) => item.owned) ?? [], [premium.data?.catalog]);
  const selectedItem = section === 'PROFILE'
    ? null
    : draft[section] === undefined
      ? null
      : owned.find((item) => item.id === draft[section]) ?? null;
  const previewCandidate = section === 'PROFILE' || draft[section] === undefined
    ? null
    : { type: section, visual: selectedItem?.visual ?? null };
  const previewUser = currentUser ? { ...currentUser, displayName: displayName || currentUser.displayName, username: username || currentUser.username, bio } : null;
  const sectionItems = section === 'PROFILE' ? [] : owned.filter((item) => item.type === section);
  const columns = width < 360 || fontScale > 1.2 ? 1 : 2;
  const choiceWidth = Math.floor(
    (width - spacing.lg * 2 - spacing.sm * (columns - 1)) / columns,
  );
  const sections: Array<[Section, string]> = [
    ['PROFILE', tr ? 'Ana Profil' : 'Main Profile'],
    ['NAMEPLATE', tr ? 'İsim Plakası' : 'Nameplate'],
    ['AVATAR_DECORATION', tr ? 'Avatar Çerçevesi' : 'Avatar Frame'],
    ['PROFILE_EFFECT', tr ? 'Profil Efekti' : 'Profile Effect'],
  ];

  if (!previewUser) return <SafeAreaView style={styles.root}><ScreenHeader title={tr ? 'Profil Stüdyosu' : 'Profile Studio'} left={<Pressable style={styles.headerButton} onPress={() => router.back()}><Icon name="close" color={colors.text} size={28} /></Pressable>} /></SafeAreaView>;

  return <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
    <ScreenHeader title={tr ? 'Profil Stüdyosu' : 'Profile Studio'} left={<Pressable style={styles.headerButton} onPress={close} accessibilityLabel={tr ? 'Profil stüdyosunu kapat' : 'Close profile studio'}><Icon name="close" color={colors.text} size={28} /></Pressable>} />
    <ScrollView horizontal style={styles.tabRail} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{sections.map(([id, label]) => <Pressable key={id} testID={`profile-studio.tab.${id}`} style={[styles.tab, section === id && styles.tabActive]} onPress={() => setSection(id)}><Text numberOfLines={1} style={[styles.tabText, section === id && styles.tabTextActive]}>{label}</Text></Pressable>)}</ScrollView>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.previewHeading}><Text style={styles.eyebrow}>{tr ? 'CANLI ÖNİZLEME' : 'LIVE PREVIEW'}</Text><Text style={styles.previewHint}>{tr ? 'Seçimin kaydedilmeden önce gerçek profilinde görünür.' : 'Your selection appears on your real profile before it is saved.'}</Text></View>
      <MobileProfilePreview user={previewUser} candidate={previewCandidate} mediaRevision={profile.dataUpdatedAt} />
      {section === 'PROFILE' ? <>
        <View style={styles.mediaRow}>
          <Pressable style={styles.mediaCard} onPress={() => mediaActions('avatar')} accessibilityLabel={tr ? 'Profil fotoğrafını değiştir' : 'Change profile photo'}><Avatar name={previewUser.displayName} uri={previewUser.avatarUrl} revision={profile.dataUpdatedAt} size={64} /><Text style={styles.mediaLabel}>{tr ? 'Avatarı değiştir' : 'Change avatar'}</Text></Pressable>
          <Pressable style={styles.mediaCard} onPress={() => mediaActions('banner')} accessibilityLabel={tr ? 'Profil afişini değiştir' : 'Change profile banner'}><View style={styles.bannerThumb}>{previewUser.bannerUrl ? <SecureImage uri={previewUser.bannerUrl} revision={profile.dataUpdatedAt} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="image-outline" color={colors.textMuted} size={28} />}</View><Text style={styles.mediaLabel}>{tr ? 'Afişi değiştir' : 'Change banner'}</Text></Pressable>
        </View>
        <View style={styles.form}><Field label={tr ? 'Görünen ad' : 'Display name'} value={displayName} onChangeText={setDisplayName} maxLength={64} /><Field label={tr ? 'Kullanıcı adı' : 'Username'} value={username} onChangeText={(value) => setUsername(value.toLocaleLowerCase('tr').replace(/[^a-z0-9_.]/gu, ''))} autoCapitalize="none" autoCorrect={false} maxLength={32} /><Text style={styles.help}>{tr ? 'Kullanıcı adı değişiklikleri süre sınırına tabidir.' : 'Username changes are subject to a cooldown.'}</Text><Field label={tr ? 'Biyografi' : 'Bio'} value={bio} onChangeText={setBio} maxLength={190} multiline style={styles.bio} /><Text style={styles.counter}>{bio.length}/190</Text></View>
      </> : <>
        <View style={styles.cosmeticHeader}><Text style={styles.sectionTitle}>{sections.find(([id]) => id === section)?.[1]}</Text><Text style={styles.sectionCopy}>{tr ? 'Yalnızca koleksiyonundaki ürünler gösteriliyor.' : 'Only items in your collection are shown.'}</Text></View>
        <View style={styles.cosmeticGrid}>
          <Pressable style={[styles.choice, { width: choiceWidth }, draft[section] === null && styles.choiceActive]} onPress={() => setDraft((current) => ({ ...current, [section]: null }))}><View style={styles.noneIcon}><Icon name="close-circle-outline" color={colors.textMuted} size={34} /></View><Text style={styles.choiceName}>{tr ? 'Yok' : 'None'}</Text></Pressable>
          <Pressable style={[styles.choice, { width: choiceWidth }]} onPress={() => router.push('/store' as never)}><View style={styles.noneIcon}><Icon name="storefront-outline" color={colors.waveBright} size={34} /></View><Text style={styles.choiceName}>{tr ? 'Mağaza' : 'Store'}</Text></Pressable>
          {sectionItems.map((item: PremiumCosmeticItem) => <Pressable key={item.id} style={[styles.choice, { width: choiceWidth }, draft[section] === item.id && styles.choiceActive]} onPress={() => setDraft((current) => ({ ...current, [section]: item.id }))}><MobileProfilePreview user={previewUser} candidate={item} isolateCandidate compact mediaRevision={profile.dataUpdatedAt} /><Text style={styles.choiceName} numberOfLines={1}>{item.name}</Text><Text style={styles.choiceCollection} numberOfLines={1}>{item.collection}</Text></Pressable>)}
        </View>
      </>}
    </ScrollView>
    <View style={styles.actionBar}><Button label={tr ? 'İptal' : 'Cancel'} variant="secondary" onPress={() => section === 'PROFILE' ? close() : setDraft((current) => ({ ...current, [section]: undefined }))} /><View style={styles.actionPrimary}><Button label={section === 'PROFILE' ? (tr ? 'Değişiklikleri uygula' : 'Apply changes') : (tr ? 'Uygula' : 'Apply')} loading={saving} disabled={section === 'PROFILE' ? (!profileDirty || !displayName.trim() || !username.trim()) : draft[section] === undefined} onPress={() => section === 'PROFILE' ? void saveProfile() : void applyCosmetic(section)} /></View></View>
    <ImageCropEditor source={crop?.source ?? null} aspect={crop?.kind === 'avatar' ? [1, 1] : [16, 6]} round={crop?.kind === 'avatar'} title={crop?.kind === 'avatar' ? (tr ? 'Profil fotoğrafını kırp' : 'Crop profile photo') : (tr ? 'Profil afişini kırp' : 'Crop profile banner')} close={() => setCrop(null)} confirm={applyCrop} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  headerButton: { width: touch.minimum, height: touch.minimum, alignItems: 'center', justifyContent: 'center' },
  tabRail: { flexGrow: 0, height: 62 },
  tabs: { alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  tab: { height: 40, flexShrink: 0, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: 999, backgroundColor: colors.surface },
  tabActive: { borderColor: colors.waveBright, backgroundColor: '#123352' },
  tabText: { color: colors.textMuted, ...typography.caption, fontWeight: '800' },
  tabTextActive: { color: colors.text },
  content: { gap: spacing.md, padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xl },
  previewHeading: { gap: spacing.xxs },
  eyebrow: { color: colors.waveBright, ...typography.caption, fontWeight: '900', letterSpacing: 1 },
  previewHint: { color: colors.textMuted, ...typography.caption },
  mediaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  mediaCard: { flex: 1, minWidth: 0, minHeight: 112, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.surface },
  mediaLabel: { maxWidth: '100%', color: colors.text, ...typography.caption, fontWeight: '800', textAlign: 'center' },
  bannerThumb: { width: '100%', maxWidth: 126, aspectRatio: 16 / 7, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.surfaceSoft },
  form: { gap: spacing.md },
  help: { color: colors.textDim, ...typography.caption, marginTop: -spacing.sm },
  bio: { minHeight: 112, paddingTop: spacing.md, textAlignVertical: 'top' },
  counter: { color: colors.textDim, ...typography.caption, textAlign: 'right', marginTop: -spacing.sm },
  cosmeticHeader: { marginTop: spacing.md },
  sectionTitle: { color: colors.text, ...typography.heading },
  sectionCopy: { color: colors.textMuted, ...typography.caption, marginTop: spacing.xxs },
  cosmeticGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { overflow: 'hidden', padding: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.surface },
  choiceActive: { borderColor: colors.waveBright, backgroundColor: '#102d49' },
  noneIcon: { height: 132, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.surfaceSoft },
  choiceName: { color: colors.text, ...typography.label, marginTop: spacing.sm },
  choiceCollection: { color: colors.textMuted, ...typography.caption, marginTop: spacing.xxs },
  actionBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
  actionPrimary: { flex: 1 },
});
