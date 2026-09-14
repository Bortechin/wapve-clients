import { Alert, Modal, Pressable, Text, TextInput } from '@/components/localized-native';
import type {
  PremiumCosmeticItem,
  PremiumCosmeticStoreCategory,
  PremiumCosmeticType,
  PremiumDashboard,
  UserProfile,
} from '@wapve/contracts';
import { colors, radius, spacing, touch, typography } from '@wapve/design-tokens';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View } from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { Icon } from '@/components/icon';
import { MobileProfilePreview } from '@/components/mobile-profile-preview';
import { Button, ScreenHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/client';
import { useI18n } from '@/lib/i18n';

type Category = 'featured' | PremiumCosmeticStoreCategory | 'owned';
const fieldByType: Record<
  PremiumCosmeticType,
  'avatarDecorationId' | 'profileEffectId' | 'nameplateId'
> = {
  AVATAR_DECORATION: 'avatarDecorationId',
  PROFILE_EFFECT: 'profileEffectId',
  NAMEPLATE: 'nameplateId',
};

function typeLabel(category: PremiumCosmeticStoreCategory, tr: boolean) {
  if (category === 'AVATAR_DECORATION') return tr ? 'Avatar dekorasyonu' : 'Avatar decoration';
  if (category === 'PROFILE_EFFECT') return tr ? 'Profil efekti' : 'Profile effect';
  if (category === 'PROFILE_FRAME') return tr ? 'Profil çerçevesi' : 'Profile frame';
  return tr ? 'İsim plakası' : 'Nameplate';
}

export default function StoreScreen() {
  const { locale } = useI18n();
  const { width, fontScale } = useWindowDimensions();
  const tr = locale === 'tr';
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<Category>('featured');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const dashboard = useQuery({
    queryKey: ['premium'],
    queryFn: () => api.request<PremiumDashboard>('/premium/me'),
  });
  const profile = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => api.request<UserProfile>('/users/me'),
  });
  const currentUser = profile.data ?? user;
  const catalog = dashboard.data?.catalog ?? [];
  const featured = useMemo(() => new Set(catalog.slice(-6).map((item) => item.id)), [catalog]);
  const normalized = search.trim().toLocaleLowerCase(locale);
  const visible = catalog.filter((item) => {
    if (category === 'featured' && !featured.has(item.id)) return false;
    if (category === 'owned' && !item.owned) return false;
    if (category !== 'featured' && category !== 'owned' && item.storeCategory !== category)
      return false;
    return (
      !normalized ||
      `${item.name} ${item.description} ${item.collection}`
        .toLocaleLowerCase(locale)
        .includes(normalized)
    );
  });
  const spotlight = catalog.at(-1) ?? null;
  const selected = selectedId ? (catalog.find((item) => item.id === selectedId) ?? null) : null;
  const columns = width < 360 || fontScale > 1.2 ? 1 : 2;
  const cardWidth = Math.floor(
    (width - spacing.lg * 2 - spacing.sm * (columns - 1)) / columns,
  );
  const categories: Array<[Category, string]> = [
    ['featured', tr ? 'Öne Çıkan' : 'Featured'],
    ['AVATAR_DECORATION', tr ? 'Avatar' : 'Avatar'],
    ['PROFILE_EFFECT', tr ? 'Profil Efektleri' : 'Profile Effects'],
    ['PROFILE_FRAME', tr ? 'Profil Çerçeveleri' : 'Profile Frames'],
    ['NAMEPLATE', tr ? 'İsim Plakaları' : 'Nameplates'],
    ['owned', tr ? 'Koleksiyonum' : 'My Collection'],
  ];

  async function replaceDashboard(request: Promise<PremiumDashboard>, key: string) {
    setBusy(key);
    try {
      const next = await request;
      queryClient.setQueryData(['premium'], next);
      await Promise.all([refreshUser(), profile.refetch()]);
    } catch {
      Alert.alert(
        tr ? 'İşlem tamamlanamadı' : 'Action failed',
        tr ? 'Lütfen biraz sonra tekrar dene.' : 'Please try again in a moment.',
      );
    } finally {
      setBusy('');
    }
  }

  function primary(item: PremiumCosmeticItem) {
    if (!dashboard.data?.membership.active) {
      setSelectedId(null);
      router.push('/premium' as never);
      return;
    }
    if (!item.owned) {
      void replaceDashboard(
        api.request(`/premium/cosmetics/${item.id}/claim`, { method: 'POST' }),
        item.id,
      );
      return;
    }
    if (!item.equipped) {
      void replaceDashboard(
        api.request('/premium/equipped', {
          method: 'PATCH',
          body: { [fieldByType[item.type]]: item.id },
        }),
        item.id,
      );
    }
  }

  function remove(item: PremiumCosmeticItem) {
    void replaceDashboard(
      api.request('/premium/equipped', {
        method: 'PATCH',
        body: { [fieldByType[item.type]]: null },
      }),
      item.id,
    );
  }

  if (!currentUser || dashboard.isLoading)
    return (
      <SafeAreaView style={styles.root}>
        <ScreenHeader
          title={tr ? 'Mağaza' : 'Store'}
          left={
            <Pressable style={styles.headerButton} onPress={() => router.back()}>
              <Icon name="chevron-left" color={colors.text} size={28} />
            </Pressable>
          }
        />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.waveBright} size="large" />
        </View>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        title={tr ? 'Mağaza' : 'Store'}
        left={
          <Pressable style={styles.headerButton} onPress={() => router.back()}>
            <Icon name="chevron-left" color={colors.text} size={28} />
          </Pressable>
        }
      />
      <View style={styles.search}>
        <Icon name="magnify" color={colors.textMuted} size={20} />
        <TextInput
          testID="store.search"
          value={search}
          onChangeText={setSearch}
          placeholder={tr ? 'Mağazada ara' : 'Search the store'}
          placeholderTextColor={colors.textDim}
          style={styles.searchInput}
        />
      </View>
      <ScrollView
        horizontal
        style={styles.tabRail}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {categories.map(([id, label]) => (
          <Pressable
            key={id}
            style={[styles.tab, category === id && styles.tabActive]}
            onPress={() => setCategory(id)}
          >
            <Text style={[styles.tabText, category === id && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView style={styles.catalogScroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {category === 'featured' && !normalized && spotlight ? (
          <Pressable
            style={[styles.spotlight, { borderColor: `${spotlight.accent}80` }]}
            onPress={() => setSelectedId(spotlight.id)}
          >
            <View style={styles.spotlightCopy}>
              <Text style={[styles.eyebrow, { color: spotlight.accent }]}>
                {tr ? 'YENİ KOLEKSİYON' : 'NEW COLLECTION'}
              </Text>
              <Text style={styles.spotlightTitle}>{spotlight.collection}</Text>
              <Text style={styles.spotlightDescription} numberOfLines={3}>
                {spotlight.description}
              </Text>
              <View style={styles.explore}>
                <Text style={styles.exploreText}>{tr ? 'Keşfet' : 'Explore'}</Text>
                <Icon name="arrow-right" color="#06111f" size={18} />
              </View>
            </View>
            <View style={styles.spotlightPreview}>
              <MobileProfilePreview user={currentUser} candidate={spotlight} isolateCandidate compact mediaRevision={profile.dataUpdatedAt} />
            </View>
          </Pressable>
        ) : null}
        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.eyebrow}>{categories.find(([id]) => id === category)?.[1]}</Text>
            <Text style={styles.sectionTitle}>
              {normalized
                ? tr
                  ? 'Arama sonuçları'
                  : 'Search results'
                : tr
                  ? 'Görünümünü tamamla'
                  : 'Complete your look'}
            </Text>
          </View>
          <Text style={styles.count}>
            {visible.length} {tr ? 'ürün' : 'items'}
          </Text>
        </View>
        {visible.length ? (
          <View style={styles.grid}>
            {visible.map((item) => (
              <Pressable
                key={item.id}
                testID={`store.product.${item.id}`}
                style={[styles.card, { width: cardWidth, borderColor: `${item.accent}55` }]}
                onPress={() => setSelectedId(item.id)}
              >
                <MobileProfilePreview user={currentUser} candidate={item} isolateCandidate compact mediaRevision={profile.dataUpdatedAt} />
                <View style={styles.cardCopy}>
                  <Text style={[styles.cardCollection, { color: item.accent }]} numberOfLines={1}>
                    {item.collection}
                  </Text>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.cardType} numberOfLines={1}>
                    {typeLabel(item.storeCategory, tr)}
                  </Text>
                </View>
                {item.owned ? (
                  <View style={styles.ownedPill}>
                    <Text style={styles.ownedText}>
                      {item.equipped ? (tr ? 'Kullanımda' : 'Equipped') : tr ? 'Sende' : 'Owned'}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Icon name="store-search-outline" color={colors.textMuted} size={38} />
            <Text style={styles.emptyTitle}>
              {tr ? 'Eşleşen ürün bulunamadı' : 'No matching products'}
            </Text>
            <Text style={styles.emptyText}>
              {tr ? 'Aramayı veya kategoriyi değiştir.' : 'Try another search or category.'}
            </Text>
          </View>
        )}
      </ScrollView>
      <Modal
        transparent
        visible={Boolean(selected)}
        animationType="slide"
        onRequestClose={() => setSelectedId(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedId(null)} />
          {selected ? (
            <View style={styles.detail}>
              <View style={styles.detailHeader}>
                <Text style={styles.eyebrow}>{selected.collection}</Text>
                <Pressable style={styles.close} onPress={() => setSelectedId(null)}>
                  <Icon name="close" color={colors.text} size={24} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.detailContent}>
                <MobileProfilePreview user={currentUser} candidate={selected} isolateCandidate mediaRevision={profile.dataUpdatedAt} />
                <Text style={styles.detailTitle}>{selected.name}</Text>
                <Text style={styles.detailDescription}>{selected.description}</Text>
                <View style={styles.meta}>
                  <Text style={styles.metaText}>{typeLabel(selected.storeCategory, tr)}</Text>
                  <Text style={styles.metaText}>{selected.rarity}</Text>
                  <Text style={styles.metaText}>
                    {tr ? 'Alpha’da ücretsiz' : 'Free during Alpha'}
                  </Text>
                </View>
                <Button
                  label={
                    busy === selected.id
                      ? tr
                        ? 'İşleniyor…'
                        : 'Working…'
                      : selected.equipped
                        ? tr
                          ? 'Kullanımda'
                          : 'Equipped'
                        : !dashboard.data?.membership.active
                          ? tr
                            ? 'Wapve+ ile aç'
                            : 'Unlock with Wapve+'
                          : selected.owned
                            ? tr
                              ? 'Kullan'
                              : 'Equip'
                            : tr
                              ? 'Koleksiyona ekle'
                              : 'Add to collection'
                  }
                  disabled={busy === selected.id || selected.equipped}
                  onPress={() => primary(selected)}
                />
                {selected.equipped ? (
                  <Button
                    label={tr ? 'Kaldır' : 'Remove'}
                    variant="secondary"
                    onPress={() => remove(selected)}
                  />
                ) : null}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  headerButton: {
    width: touch.minimum,
    height: touch.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, minHeight: touch.minimum, color: colors.text, ...typography.body },
  tabRail: { flexGrow: 0, height: 62 },
  tabs: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  tab: {
    height: 40,
    flexShrink: 0,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  tabActive: { borderColor: colors.waveBright, backgroundColor: '#123352' },
  tabText: { color: colors.textMuted, ...typography.caption, fontWeight: '800' },
  tabTextActive: { color: colors.text },
  catalogScroll: { flex: 1 },
  content: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl },
  spotlight: {
    minHeight: 0,
    overflow: 'hidden',
    marginBottom: spacing.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.xl,
    backgroundColor: '#101d34',
  },
  spotlightCopy: { justifyContent: 'center' },
  eyebrow: { color: colors.waveBright, ...typography.caption, fontWeight: '900', letterSpacing: 1 },
  spotlightTitle: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: spacing.sm },
  spotlightDescription: { color: colors.textMuted, ...typography.body, marginTop: spacing.sm },
  explore: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: '#effcff',
  },
  exploreText: { color: '#06111f', fontWeight: '900' },
  spotlightPreview: { width: '100%', marginTop: spacing.lg, justifyContent: 'center' },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: { color: colors.text, ...typography.heading, marginTop: spacing.xxs },
  count: { color: colors.textMuted, ...typography.caption },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    position: 'relative',
    overflow: 'hidden',
    paddingBottom: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  cardCopy: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  cardCollection: { ...typography.caption, fontSize: 9, fontWeight: '900' },
  cardName: { color: colors.text, ...typography.label, marginTop: spacing.xxs },
  cardType: {
    color: colors.textMuted,
    ...typography.caption,
    fontSize: 10,
    marginTop: spacing.xxs,
  },
  ownedPill: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: 999,
    backgroundColor: 'rgba(4,13,27,.86)',
  },
  ownedText: { color: colors.waveBright, fontSize: 9, fontWeight: '900' },
  empty: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  emptyTitle: { color: colors.text, ...typography.heading },
  emptyText: { color: colors.textMuted, ...typography.body },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  detail: {
    maxHeight: '92%',
    overflow: 'hidden',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.canvas,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  close: {
    width: touch.minimum,
    height: touch.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.surfaceRaised,
  },
  detailContent: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  detailTitle: { color: colors.text, ...typography.title },
  detailDescription: { color: colors.textMuted, ...typography.body, lineHeight: 21 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  metaText: {
    color: colors.textMuted,
    ...typography.caption,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
});
