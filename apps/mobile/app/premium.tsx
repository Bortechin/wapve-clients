import { Alert, Pressable, Text, TextInput } from '@/components/localized-native';
import type { PremiumDashboard } from '@wapve/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, radius, spacing, touch, typography } from '@wapve/design-tokens';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  View,
} from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { Button, ScreenHeader } from '@/components/ui';
import { Icon } from '@/components/icon';
import { api } from '@/lib/client';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { MobileProfilePreview } from '@/components/mobile-profile-preview';

// Metro resolves this numeric asset at bundle time.
const plusBadgeAsset = require('../assets/premium/wapve-plus-badge.webp') as number;

export default function PremiumScreen() {
  const { locale } = useI18n();
  const { user, refreshUser } = useAuth();
  const tr = locale === 'tr';
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState('');
  const [recipient, setRecipient] = useState('');
  const dashboard = useQuery({
    queryKey: ['premium'],
    queryFn: () => api.request<PremiumDashboard>('/premium/me'),
  });

  async function replaceDashboard(request: Promise<PremiumDashboard>, key: string) {
    setBusy(key);
    try {
      const next = await request;
      queryClient.setQueryData(['premium'], next);
      await Promise.all([
        refreshUser(),
        queryClient.invalidateQueries({ queryKey: ['profile', 'me'] }),
        queryClient.invalidateQueries({ queryKey: ['me-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['friends'] }),
        queryClient.invalidateQueries({ queryKey: ['dm-conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['group-conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['server-members'] }),
      ]);
    } catch {
      Alert.alert(
        tr ? 'İşlem tamamlanamadı' : 'Action failed',
        tr ? 'Lütfen biraz sonra tekrar dene.' : 'Please try again in a moment.',
      );
    } finally {
      setBusy('');
    }
  }

  async function sendGift() {
    setBusy('gift');
    try {
      await api.request('/premium/gifts', { method: 'POST', body: { recipient } });
      setRecipient('');
      await dashboard.refetch();
      Alert.alert(
        tr ? 'Hediye gönderildi' : 'Gift sent',
        tr ? 'Arkadaşına 7 günlük Wapve+ tanımlandı.' : 'Your friend received 7 days of Wapve+.',
      );
    } catch {
      Alert.alert(
        tr ? 'Hediye gönderilemedi' : 'Gift failed',
        tr
          ? 'Kullanıcıyı ve kalan hediye hakkını kontrol et.'
          : 'Check the user and your remaining gift passes.',
      );
    } finally {
      setBusy('');
    }
  }

  if (dashboard.isLoading || !dashboard.data) {
    return (
      <SafeAreaView style={styles.root}>
        <ScreenHeader
          title="Wapve+"
          left={
            <Pressable style={styles.back} onPress={() => router.back()}>
              <Icon name="chevron-left" size={28} color={colors.text} />
            </Pressable>
          }
        />
        <View style={styles.loading}>
          {dashboard.isError ? (
            <>
              <Text style={styles.muted}>Wapve+ yüklenemedi.</Text>
              <Button label="Tekrar dene" onPress={() => void dashboard.refetch()} />
            </>
          ) : (
            <ActivityIndicator color={colors.waveBright} size="large" />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const data = dashboard.data;
  const active = data.membership.active;
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        title="Wapve+"
        left={
          <Pressable style={styles.back} onPress={() => router.back()}>
            <Icon name="chevron-left" size={28} color={colors.text} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, active && styles.heroActive]}>
          <Image source={plusBadgeAsset} style={styles.plusHeroBadge} />
          <Text style={styles.kicker}>WAPVE+</Text>
          <Text style={styles.heroTitle}>
            {active
              ? tr
                ? 'Dalgana karakter kat'
                : 'Make your wave yours'
              : tr
                ? 'Yeni görünümünü keşfet'
                : 'Discover your new look'}
          </Text>
          <Text style={styles.heroText}>
            {active
              ? tr
                ? 'Tüm koleksiyon, hediyeler ve iki sunucu destek yuvası açık.'
                : 'The full collection, gifts, and two server support slots are open.'
              : tr
                ? 'Ödeme açılana kadar Alpha üyeleri, ekip davetleri ve arkadaş hediyeleriyle erişilebilir.'
                : 'Available through Alpha membership, team grants, and friend gifts until payments launch.'}
          </Text>
          <View style={styles.activePill}>
            <Icon name={active ? 'check-decagram' : 'eye-outline'} size={16} color="#67e8f9" />
            <Text style={styles.activeText}>
              {active ? (tr ? 'AKTİF' : 'ACTIVE') : tr ? 'ÖNİZLEME' : 'PREVIEW'}
            </Text>
          </View>
        </View>

        <View style={styles.benefits}>
          {[
            ['palette-outline', tr ? 'Özel görünüm' : 'Custom style'],
            ['gift-outline', tr ? '7 günlük hediye' : '7-day gifts'],
            ['server-outline', tr ? '2 destek yuvası' : '2 support slots'],
          ].map(([icon, label]) => (
            <View style={styles.benefit} key={label}>
              <Icon name={icon as never} size={20} color={colors.waveBright} />
              <Text style={styles.benefitText}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.comparison}>
          <Text style={styles.kicker}>{tr ? 'KARŞILAŞTIRMA' : 'COMPARISON'}</Text>
          <Text style={styles.sectionTitle}>
            {tr ? 'Standart ve Wapve+' : 'Standard and Wapve+'}
          </Text>
          {[
            ['Profil kimliği', 'Temel', 'Rozet + özel görünüm'],
            [
              'Koleksiyon',
              '—',
              tr
                ? `${data.catalog.length} özel koleksiyon öğesi`
                : `${data.catalog.length} exclusive collection items`,
            ],
            ['Sunucu takviyesi', '—', `${data.membership.supportSlots} aktif yuva`],
            ['Arkadaş hediyesi', '—', 'Ayda 3 × 7 gün'],
          ].map(([feature, standard, plus]) => (
            <View style={styles.comparisonRow} key={feature}>
              <Text style={styles.comparisonFeature}>{feature}</Text>
              <Text style={styles.comparisonStandard}>{standard}</Text>
              <Text style={styles.comparisonPlus}>{plus}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionIcon}>
              <Icon name="storefront-outline" size={20} color={colors.waveBright} />
            </View>
            <View>
              <Text style={styles.sectionTitle}>
                {tr ? 'Wapve+ Mağaza' : 'Wapve+ Store'}
              </Text>
              <Text style={styles.muted}>
                {tr ? 'Koleksiyonunu gerçek profilinde önizle' : 'Preview the collection on your real profile'}
              </Text>
            </View>
          </View>
          {user ? <MobileProfilePreview user={user} candidate={data.catalog.at(-1) ?? null} compact /> : null}
          <Text style={styles.storeCopy}>{tr ? `${data.catalog.length} dekorasyon; isim plakaları, avatar çerçeveleri ve tam profil efektleri tek mağazada.` : `${data.catalog.length} decorations—nameplates, avatar frames, and full profile effects in one store.`}</Text>
          <Button label={tr ? 'Mağazaya git' : 'Go to Store'} icon={<Icon name="arrow-right" size={18} color={colors.text} />} onPress={() => router.push('/store' as never)} />
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionIcon}>
              <Icon name="gift-outline" size={20} color={colors.waveBright} />
            </View>
            <View>
              <Text style={styles.sectionTitle}>
                {tr ? 'Arkadaşına hediye et' : 'Gift a friend'}
              </Text>
              <Text style={styles.muted}>
                {data.membership.giftPassesRemaining}{' '}
                {tr ? 'hediye hakkın kaldı' : 'gift passes remaining'}
              </Text>
            </View>
          </View>
          <TextInput
            style={styles.input}
            value={recipient}
            onChangeText={setRecipient}
            placeholder={tr ? 'Kullanıcı adı veya 11 haneli ID' : 'Username or 11-digit ID'}
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            maxLength={64}
          />
          <Button
            label={tr ? '7 günlük Wapve+ gönder' : 'Send 7 days of Wapve+'}
            icon={<Icon name="send-outline" size={18} color={colors.text} />}
            loading={busy === 'gift'}
            disabled={
              !active ||
              data.membership.source === 'GIFT' ||
              data.membership.giftPassesRemaining < 1 ||
              recipient.trim().length < 3
            }
            onPress={() => void sendGift()}
          />
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionIcon}>
              <Icon name="server-outline" size={20} color={colors.waveBright} />
            </View>
            <View>
              <Text style={styles.sectionTitle}>
                {tr ? 'Sunucu destekleri' : 'Server supports'}
              </Text>
              <Text style={styles.muted}>
                {tr
                  ? 'Seviyeler 2, 5 ve 10 destekte açılır'
                  : 'Levels unlock at 2, 5, and 10 supports'}
              </Text>
            </View>
          </View>
          {Array.from({ length: data.membership.supportSlots }, (_, index) => index + 1).map(
            (slot) => {
              const assigned = data.supports.find((item) => item.slot === slot);
              const locked = Boolean(
                assigned && new Date(assigned.cooldownUntil).getTime() > Date.now(),
              );
              return (
                <View style={styles.supportSlot} key={slot}>
                  <View style={styles.supportTitle}>
                    <Text style={styles.itemName}>
                      {tr ? 'Yuva' : 'Slot'} {slot}
                    </Text>
                    <Text style={styles.muted}>
                      {assigned
                        ? `${assigned.server.name} · ${tr ? 'Seviye' : 'Level'} ${assigned.server.supportLevel}`
                        : tr
                          ? 'Sunucu seçilmedi'
                          : 'No server selected'}
                    </Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.serverChoices}
                  >
                    {data.eligibleServers.map((server) => (
                      <Pressable
                        disabled={!active || locked || busy === `support-${slot}`}
                        key={server.id}
                        style={[
                          styles.serverChoice,
                          assigned?.server.id === server.id && styles.serverChoiceActive,
                        ]}
                        onPress={() =>
                          void replaceDashboard(
                            api.request(`/premium/server-supports/${slot}`, {
                              method: 'POST',
                              body: { serverId: server.id },
                            }),
                            `support-${slot}`,
                          )
                        }
                      >
                        <Text style={styles.serverChoiceText}>{server.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  {locked ? (
                    <Text style={styles.cooldown}>
                      {tr
                        ? `${new Date(assigned!.cooldownUntil).toLocaleDateString('tr-TR')} tarihine kadar kilitli`
                        : `Locked until ${new Date(assigned!.cooldownUntil).toLocaleDateString('en-US')}`}
                    </Text>
                  ) : null}
                </View>
              );
            },
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  back: {
    width: touch.minimum,
    height: touch.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  hero: {
    overflow: 'hidden',
    gap: spacing.xs,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,.3)',
    borderRadius: radius.xl,
    backgroundColor: '#101827',
  },
  heroActive: { borderColor: 'rgba(34,211,238,.5)', backgroundColor: '#0b2030' },
  plusHeroBadge: { width: 76, height: 76, marginBottom: spacing.sm, resizeMode: 'contain' },
  kicker: { color: '#67e8f9', fontSize: 11, fontWeight: '900', letterSpacing: 2.3 },
  heroTitle: { color: colors.text, fontSize: 26, fontWeight: '900' },
  heroText: { color: colors.textMuted, ...typography.body, lineHeight: 21 },
  activePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(8,145,178,.14)',
  },
  activeText: { color: '#67e8f9', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  benefits: { flexDirection: 'row', gap: spacing.xs },
  comparison: {
    gap: spacing.xs,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(59,190,255,.22)',
    borderRadius: radius.xl,
    backgroundColor: '#071829',
  },
  comparisonRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  comparisonFeature: { flex: 1.15, color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  comparisonStandard: { flex: 0.75, color: colors.textDim, fontSize: 10 },
  comparisonPlus: { flex: 1.1, color: '#8cdefe', fontSize: 10, fontWeight: '800' },
  benefit: {
    flex: 1,
    minHeight: 82,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  benefitText: { color: colors.text, textAlign: 'center', fontSize: 11, fontWeight: '700' },
  sectionCard: {
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: 'rgba(59,130,246,.12)',
  },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  muted: { color: colors.textMuted, ...typography.caption },
  storeCopy: { color: colors.textMuted, ...typography.body, lineHeight: 21 },
  catalog: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  item: {
    width: '48%',
    flexGrow: 1,
    minWidth: 145,
    overflow: 'hidden',
    gap: 6,
    padding: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
  },
  preview: {
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -spacing.sm,
    marginTop: -spacing.sm,
    marginBottom: spacing.xs,
  },
  generatedPreview: { width: '100%', height: '100%', resizeMode: 'contain' },
  generatedProfileFramePart: {
    position: 'absolute',
    width: 126,
    zIndex: 2,
    resizeMode: 'contain',
  },
  generatedProfileFrameTop: { top: 2, height: 48 },
  generatedProfileFrameBottom: { bottom: 4, height: 28 },
  profileFramePreviewMock: {
    width: 92,
    height: 92,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    backgroundColor: '#111827',
  },
  profileFramePreviewBanner: { height: 27, backgroundColor: '#164e63' },
  profileFramePreviewAvatar: {
    width: 20,
    height: 20,
    marginTop: -9,
    marginLeft: 7,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#111827',
    borderRadius: 10,
    backgroundColor: '#0e7490',
  },
  profileFramePreviewLine: {
    width: 38,
    height: 4,
    marginBottom: 6,
    marginLeft: 8,
    borderRadius: 2,
    backgroundColor: 'rgba(148,163,184,.28)',
  },
  profileFramePreviewLineShort: { width: 28 },
  previewRing: {
    width: 55,
    height: 55,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 28,
    backgroundColor: '#111827',
  },
  previewLetter: { color: colors.text, fontSize: 20, fontWeight: '900' },
  itemType: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  itemName: { color: colors.text, fontSize: 14, fontWeight: '800' },
  itemDescription: { minHeight: 34, color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  input: {
    minHeight: touch.minimum,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    ...typography.body,
  },
  supportSlot: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  supportTitle: { gap: 2 },
  serverChoices: { gap: spacing.xs, paddingRight: spacing.md },
  serverChoice: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    backgroundColor: colors.surfaceRaised,
  },
  serverChoiceActive: { borderColor: colors.waveBright, backgroundColor: 'rgba(59,130,246,.16)' },
  serverChoiceText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  cooldown: { color: colors.warning, ...typography.caption },
});
