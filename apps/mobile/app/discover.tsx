import { TextInput, Text, Pressable } from '@/components/localized-native';
import type { ServerDiscoveryEntry, ServerSummary } from '@wapve/contracts';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { colors, radius, spacing, touch, typography } from '@wapve/design-tokens';
import { Avatar, ScreenHeader, SecureImage } from '@/components/ui';
import { Icon } from '@/components/icon';
import { api } from '@/lib/client';

export default function DiscoverScreen() {
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['server-discovery', search.trim()],
    queryFn: () => api.request<ServerDiscoveryEntry[]>(`/servers/discovery?limit=48${search.trim() ? `&q=${encodeURIComponent(search.trim())}` : ''}`),
    staleTime: 30_000,
  });
  const entries = useMemo(() => query.data ?? [], [query.data]);
  const numberFormat = useMemo(() => new Intl.NumberFormat('tr-TR'), []);
  async function openOrJoin(entry: ServerDiscoveryEntry) {
    setBusyId(entry.id);
    setError('');
    try {
      const server = entry.isMember
        ? await api.request<ServerSummary>(`/servers/${entry.id}`)
        : await api.request<ServerSummary>('/servers/actions/join-discovery', { method: 'POST', body: { serverId: entry.id } });
      router.replace({ pathname: '/channels/[serverPublicId]', params: { serverPublicId: server.publicId } });
    } catch {
      setError('Sunucu açılamadı. Biraz sonra tekrar dene.');
    } finally {
      setBusyId(null);
    }
  }
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader title="Sunucu keşfet" left={<Pressable style={styles.headerButton} onPress={() => router.back()} accessibilityLabel="Geri"><Icon name="arrow-left" color={colors.text} size={27} /></Pressable>} />
      <View style={styles.hero}>
        <View style={styles.heroIcon}><Icon name="compass-outline" color={colors.waveBright} size={34} /></View>
        <View style={styles.heroCopy}><Text style={styles.title}>Topluluğunu keşfet</Text><Text style={styles.subtitle}>İlgi alanlarına uygun yeni sunucular bul ve katıl.</Text></View>
      </View>
      <View style={styles.searchWrap}><Icon name="magnify" color={colors.textMuted} size={21} /><TextInput value={search} onChangeText={setSearch} placeholder="Sunucu ara" placeholderTextColor={colors.textDim} maxLength={100} style={styles.search} autoCapitalize="none" /></View>
      <View style={styles.toolbar}><Text style={styles.sectionTitle}>{search.trim() ? 'Arama sonuçları' : 'Öne çıkan sunucular'}</Text><Text style={styles.count}>{entries.length} sunucu</Text></View>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      {query.isPending ? <View style={styles.loading}><ActivityIndicator color={colors.waveBright} /><Text style={styles.subtitle}>Sunucular yükleniyor…</Text></View> : <FlatList data={entries} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} ListEmptyComponent={<View style={styles.empty}><Icon name="compass-off-outline" color={colors.textDim} size={42} /><Text style={styles.title}>Sonuç bulunamadı</Text><Text style={styles.subtitle}>Farklı bir arama deneyebilirsin.</Text></View>} renderItem={({ item }) => <View style={styles.card}><View style={styles.banner}>{item.bannerUrl ? <SecureImage uri={item.bannerUrl} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={styles.bannerFallback} />}</View><View style={styles.cardBody}><View style={styles.cardHead}><Avatar name={item.name} uri={item.iconUrl} size={52} /><View style={styles.cardCopy}><Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text><Text style={styles.cardDescription} numberOfLines={2}>{item.description || 'Wapve’de yeni bir topluluk.'}</Text></View></View><View style={styles.meta}><Text style={styles.metaText}>● {numberFormat.format(item.onlineCount)} çevrim içi</Text><Text style={styles.metaText}>{numberFormat.format(item.memberCount)} üye</Text></View><Pressable style={[styles.join, item.isMember && styles.joined]} disabled={busyId === item.id} onPress={() => void openOrJoin(item)}><Text style={styles.joinText}>{busyId === item.id ? 'Açılıyor…' : item.isMember ? 'Sunucuyu aç' : 'Katıl'}</Text><Icon name="arrow-up-right" color={colors.text} size={18} /></Pressable></View></View>} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  headerButton: { width: touch.minimum, height: touch.minimum, alignItems: 'center', justifyContent: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, margin: spacing.md, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  heroIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  heroCopy: { flex: 1, gap: spacing.xs },
  title: { color: colors.text, ...typography.title },
  subtitle: { color: colors.textMuted, ...typography.body },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: touch.minimum, marginHorizontal: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  search: { flex: 1, color: colors.text, ...typography.body },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.lg },
  sectionTitle: { color: colors.text, ...typography.heading },
  count: { color: colors.textDim, ...typography.caption },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { overflow: 'hidden', borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  banner: { height: 108, backgroundColor: colors.surfaceSoft },
  bannerFallback: { flex: 1, backgroundColor: colors.surfaceSoft },
  cardBody: { padding: spacing.md, gap: spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardCopy: { flex: 1, gap: spacing.xs },
  cardTitle: { color: colors.text, ...typography.heading },
  cardDescription: { color: colors.textMuted, ...typography.body },
  meta: { flexDirection: 'row', justifyContent: 'space-between' },
  metaText: { color: colors.textDim, ...typography.caption },
  join: { minHeight: touch.minimum, borderRadius: radius.md, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.wave },
  joined: { backgroundColor: colors.surfaceRaised },
  joinText: { color: colors.text, ...typography.label },
  loading: { alignItems: 'center', gap: spacing.sm, padding: spacing.xxl },
  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.xxl },
  error: { color: colors.danger, ...typography.caption, paddingHorizontal: spacing.md },
});
