import { Text } from '@/components/localized-native';
import type { PremiumCosmeticItem, PremiumCosmeticType, UserProfile } from '@wapve/contracts';
import { colors, radius, spacing, typography } from '@wapve/design-tokens';
import { Image as AnimatedImage } from 'expo-image';
import { Image, StyleSheet, View } from '@/components/themed-native';
import { SecureImage } from './ui';
import { mobileAvatarAsset, mobileNameplateAsset, mobileProfileFrame } from './premium-cosmetic-registry';

type Candidate = { type: PremiumCosmeticType; visual: PremiumCosmeticItem['visual'] | null } | null;

export function MobileProfilePreview({ user, candidate = null, compact = false, mediaRevision, isolateCandidate = false }: { user: UserProfile; candidate?: Candidate; compact?: boolean; mediaRevision?: string | number | null | undefined; isolateCandidate?: boolean }) {
  const avatarVisual = candidate?.type === 'AVATAR_DECORATION' ? candidate.visual : isolateCandidate ? null : user.premium?.avatarDecoration;
  const profileVisual = candidate?.type === 'PROFILE_EFFECT' ? candidate.visual : isolateCandidate ? null : user.premium?.profileEffect;
  const nameplateVisual = candidate?.type === 'NAMEPLATE' ? candidate.visual : isolateCandidate ? null : user.premium?.nameplate;
  const avatarDecoration = mobileAvatarAsset(avatarVisual);
  const frame = mobileProfileFrame(profileVisual);
  const nameplate = mobileNameplateAsset(nameplateVisual);
  if (isolateCandidate && candidate?.type === 'NAMEPLATE') {
    return <View style={[styles.productStage, compact && styles.compactProductStage]}>
      <View style={styles.productNameplate}>
        {nameplate ? <AnimatedImage source={nameplate} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}
        <View style={styles.productCopy}><Text numberOfLines={1} style={styles.name}>{user.displayName}</Text><Text numberOfLines={1} style={styles.username}>@{user.username}</Text></View>
      </View>
    </View>;
  }
  if (isolateCandidate && candidate?.type === 'AVATAR_DECORATION') {
    return <View style={[styles.productStage, compact && styles.compactProductStage]}>
      <View style={styles.productAvatar}>
        <View style={styles.avatarClip}>{user.avatarUrl ? <SecureImage uri={user.avatarUrl} revision={mediaRevision} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={styles.initial}>{user.displayName.slice(0, 1).toUpperCase()}</Text>}</View>
        {avatarDecoration ? <Image source={avatarDecoration} style={styles.avatarDecoration} resizeMode="contain" /> : null}
      </View>
    </View>;
  }
  return <View style={[styles.card, compact && styles.compact]}>
    <View style={[styles.banner, compact && styles.compactBanner]}>{user.bannerUrl && !isolateCandidate ? <SecureImage uri={user.bannerUrl} revision={mediaRevision} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
    <View style={[styles.avatar, compact && styles.compactAvatar]}><View style={styles.avatarClip}>{user.avatarUrl ? <SecureImage uri={user.avatarUrl} revision={mediaRevision} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={[styles.initial, compact && styles.compactInitial]}>{user.displayName.slice(0, 1).toUpperCase()}</Text>}</View>{avatarDecoration ? <Image source={avatarDecoration} style={styles.avatarDecoration} resizeMode="contain" /> : null}</View>
    <View style={[styles.nameplate, compact && styles.compactNameplate]}>{nameplate ? <Image source={nameplate} style={StyleSheet.absoluteFill} resizeMode="stretch" /> : null}<View style={styles.nameCopy}><Text style={[styles.name, compact && styles.compactName]} numberOfLines={1}>{user.displayName}</Text><Text style={styles.username} numberOfLines={1}>@{user.username}</Text></View></View>
    {!compact ? <Text style={styles.bio} numberOfLines={2}>{user.bio || 'Profilinin canlı önizlemesi'}</Text> : null}
    {frame ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.effectLayer]}>{frame.kind === 'overlay' ? <AnimatedImage source={{ uri: Image.resolveAssetSource(frame.asset).uri, isAnimated: true }} autoplay style={StyleSheet.absoluteFill} contentFit="cover" /> : <Image source={frame.top} style={styles.frameTop} resizeMode="stretch" />}</View> : null}
  </View>;
}

const styles = StyleSheet.create({
  productStage: { width: '100%', minHeight: 220, padding: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas, borderRadius: radius.lg, overflow: 'hidden' },
  compactProductStage: { minHeight: 150 },
  productNameplate: { width: '100%', minHeight: 72, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface },
  productCopy: { padding: spacing.sm, minHeight: 72, justifyContent: 'center' },
  productAvatar: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  avatarClip: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 99, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  card: { position: 'relative', width: '100%', height: 326, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, borderRadius: radius.xl, backgroundColor: '#0b1a2d' },
  compact: { height: 184, borderRadius: radius.lg },
  banner: { height: 112, backgroundColor: '#15345b' },
  compactBanner: { height: 60 },
  avatar: { width: 86, height: 86, marginTop: -43, marginLeft: spacing.lg, overflow: 'visible', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#0b1a2d', borderRadius: 48, backgroundColor: '#173a60' },
  compactAvatar: { width: 50, height: 50, marginTop: -25, marginLeft: spacing.sm, borderWidth: 3 },
  initial: { color: colors.text, fontSize: 29, fontWeight: '900' },
  compactInitial: { fontSize: 19 },
  avatarDecoration: { position: 'absolute', width: '145%', height: '145%' },
  nameplate: { minHeight: 64, marginHorizontal: spacing.md, marginTop: spacing.sm, overflow: 'hidden', borderRadius: radius.md },
  compactNameplate: { minHeight: 44, marginHorizontal: spacing.xs, marginTop: spacing.xs },
  nameCopy: { minHeight: 60, justifyContent: 'center', paddingHorizontal: spacing.md },
  name: { color: colors.text, ...typography.heading, textShadowColor: '#000', textShadowRadius: 4 },
  compactName: { fontSize: 12 },
  username: { color: colors.textMuted, ...typography.caption, textShadowColor: '#000', textShadowRadius: 3 },
  bio: { margin: spacing.lg, marginTop: spacing.md, color: colors.textMuted, ...typography.body },
  effectLayer: { zIndex: 5 },
  frameTop: { position: 'absolute', top: 0, left: 0, right: 0, width: '100%', height: '48%' },
  frameBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%', height: '31%' },
});
