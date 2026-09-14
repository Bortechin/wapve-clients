import { Text, Modal, Pressable } from '@/components/localized-native';
import type { PlatformBadge } from '@wapve/contracts';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from '@/components/themed-native';
import { colors, radius, spacing, typography } from '@wapve/design-tokens';
import { SwipeableSheetSurface } from './swipeable-sheet';
import { orderedMobileBadges } from './badge-order';

const badgeInfo: Record<
  PlatformBadge,
  {
    title: string;
    eyebrow: string;
    description: string;
    source?: number;
    glyph?: string;
    color: string;
  }
> = {
  PLATFORM_OWNER: {
    title: 'Uygulama Sahibi',
    eyebrow: 'ÖZEL ROZET',
    description: 'Wapve’nin kurucusu ve en üst yetkilisi.',
    source: require('../../../web/public/brand/platform-owner-badge.png') as number,
    color: '#fbbf24',
  },
  ALPHA_MEMBER: {
    title: 'Alpha Katılımcısı',
    eyebrow: 'SINIRLI ALPHA ROZETİ',
    description: 'Wapve’nin ilk dalgasına katılan öncü üyelerden biri.',
    source: require('../../../web/public/brand/alpha-member-badge.png') as number,
    color: '#a78bfa',
  },
  SYSTEM: {
    title: 'Resmî Wapve Sistemi',
    eyebrow: 'DOĞRULANMIŞ SİSTEM HESABI',
    description: 'Yalnızca Wapve tarafından güvenli sistem bildirimleri gönderen resmî hesap.',
    source: require('../../../web/public/brand/wapve-system-badge.png') as number,
    color: '#38bdf8',
  },
  STAFF: {
    title: 'Wapve Ekibi',
    eyebrow: 'WAPVE ROZETİ',
    description: 'Wapve ekibinin doğrulanmış üyesi.',
    source: require('../../../web/public/brand/badge-staff.png') as number,
    color: '#22d3ee',
  },
  MODERATOR: {
    title: 'Platform Moderatörü',
    eyebrow: 'WAPVE ROZETİ',
    description: 'Platform güvenliği ve moderasyonu için yetkilendirilmiş ekip üyesi.',
    source: require('../../../web/public/brand/badge-moderator.png') as number,
    color: '#fb7185',
  },
  DEVELOPER: {
    title: 'Geliştirici',
    eyebrow: 'WAPVE ROZETİ',
    description: 'Wapve ürünlerini geliştiren ekip üyesi.',
    source: require('../../../web/public/brand/badge-developer.png') as number,
    color: '#60a5fa',
  },
  SUPPORT: {
    title: 'Destek Ekibi',
    eyebrow: 'WAPVE ROZETİ',
    description: 'Kullanıcılara yardımcı olan doğrulanmış destek görevlisi.',
    source: require('../../../web/public/brand/badge-support.png') as number,
    color: '#34d399',
  },
  PARTNER: {
    title: 'Wapve Ortağı',
    eyebrow: 'WAPVE ROZETİ',
    description: 'Wapve ile resmî ortaklık kurmuş topluluk veya kişi.',
    source: require('../../../web/public/brand/badge-partner.png') as number,
    color: '#c084fc',
  },
  VERIFIED_CREATOR: {
    title: 'Doğrulanmış Üretici',
    eyebrow: 'WAPVE ROZETİ',
    description: 'Kimliği doğrulanmış içerik üreticisi.',
    source: require('../../../web/public/brand/badge-verified-creator.png') as number,
    color: '#38bdf8',
  },
  EARLY_SUPPORTER: {
    title: 'İlk Destekçi',
    eyebrow: 'WAPVE ROZETİ',
    description: 'Wapve’yi ilk döneminde destekleyen üye.',
    source: require('../../../web/public/brand/badge-early-supporter.png') as number,
    color: '#fbbf24',
  },
  BUG_HUNTER: {
    title: 'Hata Avcısı',
    eyebrow: 'WAPVE ROZETİ',
    description: 'Önemli bir hatayı sorumlu şekilde bildiren üye.',
    source: require('../../../web/public/brand/badge-bug-hunter.png') as number,
    color: '#a3e635',
  },
  COMMUNITY_CHAMPION: {
    title: 'Topluluk Öncüsü',
    eyebrow: 'WAPVE ROZETİ',
    description: 'Wapve topluluğuna olağanüstü katkıda bulunan üye.',
    source: require('../../../web/public/brand/badge-community-champion.png') as number,
    color: '#f59e0b',
  },
  SERVER_SURFER: {
    title: 'Sunucu Sörfçüsü',
    eyebrow: 'AKTİF TAKVİYE ROZETİ',
    description: 'Wapve+ takviyelerinden en az birini bir topluluğa ayıran üye.',
    source: require('../../../web/public/brand/badge-server-surfer.png') as number,
    color: '#22d3ee',
  },
};

const plusBadgeAsset = require('../../assets/premium/wapve-plus-badge.webp') as number;
export function PlatformBadges({ badges, size = 24 }: { badges: PlatformBadge[]; size?: number }) {
  const [selected, setSelected] = useState<PlatformBadge | null>(null);
  const info = selected ? badgeInfo[selected] : null;
  return (
    <>
      <View style={styles.row}>
        {orderedMobileBadges(badges).map((badge) => (
          <Pressable
            key={badge}
            onPress={() => setSelected(badge)}
            accessibilityRole="button"
            accessibilityLabel={`${badgeInfo[badge].title} rozetinin bilgisini aç`}
            hitSlop={8}
          >
            {badgeInfo[badge].source ? (
              <Image
                source={badgeInfo[badge].source}
                style={{ width: size, height: size }}
                resizeMode="contain"
              />
            ) : (
              <View
                style={[
                  styles.glyph,
                  { width: size, height: size, backgroundColor: badgeInfo[badge].color },
                ]}
              >
                <Text style={[styles.glyphText, { fontSize: Math.max(8, size * 0.42) }]}>
                  {badgeInfo[badge].glyph}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>
      <Modal
        transparent
        visible={Boolean(info)}
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} />
          <SwipeableSheetSurface
            dragFromContent
            onClose={() => setSelected(null)}
            style={styles.sheet}
          >
            {info ? (
              <View style={styles.card}>
                <View style={styles.badgeArtwork}>
                  {info.source ? (
                    <Image source={info.source} style={styles.largeImage} resizeMode="contain" />
                  ) : (
                    <View style={[styles.largeGlyph, { backgroundColor: info.color }]}>
                      <Text style={styles.largeGlyphText}>{info.glyph}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.copy}>
                  <Text style={styles.eyebrow}>{info.eyebrow}</Text>
                  <Text style={styles.title}>{info.title}</Text>
                  <Text style={styles.description}>{info.description}</Text>
                </View>
              </View>
            ) : null}
          </SwipeableSheetSurface>
        </View>
      </Modal>
    </>
  );
}

export function OwnedBadgeStrip({
  badges,
  premiumActive,
  size = 24,
  limit = 3,
}: {
  badges: PlatformBadge[];
  premiumActive: boolean;
  size?: number;
  limit?: number;
}) {
  const [collectionOpen, setCollectionOpen] = useState(false);
  const ordered = orderedMobileBadges(badges);
  const items: Array<{ kind: 'plus' } | { kind: 'platform'; badge: PlatformBadge }> = [
    ...(premiumActive ? ([{ kind: 'plus' }] as const) : []),
    ...ordered.map((badge) => ({ kind: 'platform' as const, badge })),
  ];
  const visible = items.slice(0, limit);
  if (!items.length) return null;
  return (
    <>
      <View style={styles.row}>
        {visible.map((item) =>
          item.kind === 'plus' ? (
            <Image
              key="WAPVE_PLUS"
              source={plusBadgeAsset}
              style={{ width: size, height: size }}
              resizeMode="contain"
              accessibilityLabel="Wapve+"
            />
          ) : badgeInfo[item.badge].source ? (
            <Image
              key={item.badge}
              source={badgeInfo[item.badge].source}
              style={{ width: size, height: size }}
              resizeMode="contain"
              accessibilityLabel={badgeInfo[item.badge].title}
            />
          ) : (
            <View
              key={item.badge}
              style={[
                styles.glyph,
                { width: size, height: size, backgroundColor: badgeInfo[item.badge].color },
              ]}
              accessibilityLabel={badgeInfo[item.badge].title}
            >
              <Text style={[styles.glyphText, { fontSize: Math.max(8, size * 0.42) }]}>
                {badgeInfo[item.badge].glyph}
              </Text>
            </View>
          ),
        )}
        {items.length > limit ? (
          <Pressable
            style={[styles.more, { width: size + 5, height: size }]}
            onPress={() => setCollectionOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${items.length - limit} rozet daha göster`}
          >
            <Text style={styles.moreText}>…</Text>
          </Pressable>
        ) : null}
      </View>
      <Modal
        transparent
        visible={collectionOpen}
        animationType="slide"
        onRequestClose={() => setCollectionOpen(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCollectionOpen(false)} />
          <SwipeableSheetSurface
            onClose={() => setCollectionOpen(false)}
            style={styles.collectionSheet}
          >
            <Text style={styles.collectionEyebrow}>PROFİL KOLEKSİYONU</Text>
            <Text style={styles.collectionTitle}>Rozetlerin</Text>
            <Text style={styles.collectionDescription}>
              {items.length} rozet hesabının hikâyesini anlatıyor.
            </Text>
            <ScrollView
              contentContainerStyle={styles.collectionList}
              showsVerticalScrollIndicator={false}
            >
              {items.map((item) => {
                const info =
                  item.kind === 'plus'
                    ? {
                        title: 'Wapve+',
                        eyebrow: 'WAPVE+ ÜYELİĞİ',
                        description: 'Rozetler, profil kozmetikleri ve topluluk avantajları açık.',
                        source: plusBadgeAsset,
                        glyph: undefined,
                        color: '#67e8f9',
                      }
                    : badgeInfo[item.badge];
                return (
                  <View
                    style={styles.collectionCard}
                    key={item.kind === 'plus' ? 'WAPVE_PLUS' : item.badge}
                  >
                    <View style={styles.collectionArtwork}>
                      {info.source ? (
                        <Image
                          source={info.source}
                          style={styles.collectionImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={[styles.largeGlyph, { backgroundColor: info.color }]}>
                          <Text style={styles.largeGlyphText}>{info.glyph}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.collectionCopy}>
                      <Text style={[styles.eyebrow, { color: info.color }]}>{info.eyebrow}</Text>
                      <Text style={styles.title}>{info.title}</Text>
                      <Text style={styles.description}>{info.description}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </SwipeableSheetSurface>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    maxWidth: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  more: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(103,232,249,.28)',
    backgroundColor: colors.surfaceSoft,
  },
  moreText: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: -5 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
  },
  badgeArtwork: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
  },
  largeImage: { width: 54, height: 54 },
  glyph: { alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  glyphText: { color: '#06111f', fontWeight: '900' },
  largeGlyph: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  largeGlyphText: { color: '#06111f', fontSize: 18, fontWeight: '900' },
  copy: { flex: 1 },
  eyebrow: { color: colors.waveBright, ...typography.caption },
  title: { color: colors.text, ...typography.heading, marginTop: spacing.xxs },
  description: { color: colors.textMuted, ...typography.body, marginTop: spacing.xs },
  collectionSheet: {
    maxHeight: '78%',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
  },
  collectionEyebrow: {
    color: colors.waveBright,
    ...typography.caption,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  collectionTitle: { color: colors.text, ...typography.title, marginTop: spacing.xs },
  collectionDescription: { color: colors.textMuted, ...typography.body, marginTop: spacing.xxs },
  collectionList: { gap: spacing.sm, paddingTop: spacing.lg, paddingBottom: spacing.lg },
  collectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceRaised,
  },
  collectionArtwork: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
  },
  collectionImage: { width: 52, height: 52 },
  collectionCopy: { flex: 1 },
});
