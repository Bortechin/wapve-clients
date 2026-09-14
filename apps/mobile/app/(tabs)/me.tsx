import { TextInput, Text, Modal, Pressable } from '@/components/localized-native';
import type { UserProfile } from '@wapve/contracts';
import {
  useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import {
  Linking,
  ScrollView,
  StyleSheet,
  View,
} from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { colors, radius, spacing, touch, typography } from '@wapve/design-tokens';
import { Avatar, Button, SecureImage } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useDeveloperMode } from '@/lib/developer-mode';
import { useI18n } from '@/lib/i18n';
import { Icon, type IconName } from '@/components/icon';
import { EmojiPickerSheet } from '@/components/emoji-picker';
import { OwnedBadgeStrip } from '@/components/platform-badges';
import { PresencePickerSheet, presenceLabel } from '@/components/presence-picker';
import { SwipeableSheetSurface } from '@/components/swipeable-sheet';
import { api } from '@/lib/client';
import { useEffect, useState } from 'react';

const settings: Array<[IconName, string, Href]> = [
  ['lifebuoy', 'Yardım ve destek', '/support' as Href],
  ['palette-outline', 'Görünüm', '/settings/appearance' as Href],
  ['crown-outline', 'Wapve+', '/premium' as Href],
  ['storefront-outline', 'Mağaza', '/store' as Href],
  ['bell-outline', 'Bildirimler', '/settings/notifications'],
  ['shield-lock-outline', 'Gizlilik ve güvenlik', '/settings/privacy'],
  ['microphone-settings', 'Ses ve görüntü', '/settings/voice'],
  ['devices', 'Cihazlar ve oturumlar', '/settings/sessions'],
  ['key-variant', 'Passkey ve 2FA', '/settings/security'],
  ['account-switch', 'Hesaplar', '/settings/accounts'],
  ['qrcode-scan', 'QR ile bilgisayara giriş', '/qr/scan'],
];

export default function MeScreen() {
  const { enabled: developerMode } = useDeveloperMode();
  const { user, logout, refreshUser } = useAuth();
  const { locale, setLocale, t } = useI18n();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [presencePickerOpen, setPresencePickerOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [statusEmoji, setStatusEmoji] = useState<string | null>(null);
  const profile = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => api.request<UserProfile>('/users/me'),
  });
  const data = profile.data ?? user;
  useEffect(() => {
    setStatusText(data?.customStatusText ?? '');
    setStatusEmoji(data?.customStatusEmoji ?? null);
  }, [data?.customStatusEmoji, data?.customStatusText]);
  function chooseLanguage(next: 'tr' | 'en') {
    setLocale(next);
    setLanguageOpen(false);
    void api.request('/users/me', { method: 'PATCH', body: { locale: next } });
  }
  async function updatePresence(status: UserProfile['status'], statusExpiresAt: string | null) {
    await api.request('/users/me', { method: 'PATCH', body: { status, statusExpiresAt } });
    await Promise.all([profile.refetch(), refreshUser()]);
  }
  async function saveCustomStatus() {
    await api.request('/users/me', {
      method: 'PATCH',
      body: {
        customStatusText: statusText.trim() || null,
        customStatusEmoji: statusText.trim() ? statusEmoji : null,
      },
    });
    setPresenceOpen(false);
    await Promise.all([profile.refetch(), refreshUser()]);
  }
  if (!user) return null;
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.profile}>
          <View style={styles.banner}>
            {data?.bannerUrl ? (
              <SecureImage
                uri={data.bannerUrl}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : null}
          </View>
          <Avatar
            name={data?.displayName ?? user.displayName}
            uri={data?.avatarUrl}
            size={84}
            online={data?.status === 'ONLINE'}
          />
          <View style={styles.nameLine}>
            <Text style={styles.name}>{data?.displayName ?? user.displayName}</Text>
            {data ? <OwnedBadgeStrip badges={data.badges} premiumActive={Boolean(data.premium?.active)} size={25} /> : null}
          </View>
          <Text style={styles.username}>
            @{data?.username ?? user.username}{developerMode && data?.publicId ? ` · ${data.publicId}` : ''}
          </Text>
          {data?.customStatusText ? (
            <View style={styles.customStatus}>
              {data.customStatusEmoji ? (
                <Text style={styles.customStatusEmoji}>{data.customStatusEmoji}</Text>
              ) : null}
              <Text style={styles.customStatusText}>{data.customStatusText}</Text>
            </View>
          ) : null}
          {data?.bio ? <Text style={styles.bio}>{data.bio}</Text> : null}
          <Pressable style={styles.presenceButton} onPress={() => setPresenceOpen(true)}>
            <View
              style={[
                styles.presenceDot,
                {
                  backgroundColor:
                    data?.status === 'DND'
                      ? colors.danger
                      : data?.status === 'IDLE'
                        ? colors.warning
                        : data?.status === 'INVISIBLE'
                          ? colors.textDim
                          : colors.success,
                },
              ]}
            />
            <View style={styles.presenceCopy}>
              <Text style={styles.presenceTitle}>{presenceLabel(data?.status ?? 'ONLINE')}</Text>
              <Text style={styles.presenceMeta}>Durumunu ve durum mesajını düzenle</Text>
            </View>
            <Icon name="chevron-right" color={colors.textDim} size={23} />
          </Pressable>
          <Button
            label="Profili düzenle"
            variant="secondary"
            testID="me.profile-edit"
            onPress={() => router.push('/profile/edit')}
          />
        </View>
        <View style={styles.card}>
          {data?.badges.includes('PLATFORM_OWNER') ? (
            <Pressable style={styles.ownerRow} onPress={() => router.push('/owner')}>
              <View style={styles.icon}><Icon name="shield-crown-outline" color={colors.warning} size={23} /></View>
              <View style={styles.presenceCopy}><Text style={styles.rowText}>Platform yönetimi</Text><Text style={styles.languageMeta}>Kullanıcı yaptırımları ve hata raporları</Text></View>
              <Icon name="chevron-right" color={colors.textDim} size={25} />
            </Pressable>
          ) : null}
          {settings.map(([icon, label, path]) => (
            <Pressable key={label} testID={label === 'Mağaza' ? 'me.store' : undefined} style={styles.row} onPress={() => router.push(path)}>
              <View style={styles.icon}>
                <Icon name={icon} color={colors.waveBright} size={22} />
              </View>
              <Text style={styles.rowText}>{label}</Text>
              <Icon name="chevron-right" color={colors.textDim} size={25} />
            </Pressable>
          ))}
        </View>
        <View style={styles.card}>
          <Text style={styles.section}>DİL / LANGUAGE</Text>
          <Pressable
            style={styles.languageSelect}
            onPress={() => setLanguageOpen(true)}
            accessibilityLabel="Dil seç"
          >
            <View>
              <Text style={styles.languageValue}>{locale === 'tr' ? 'Türkçe' : 'English'}</Text>
              <Text style={styles.languageMeta}>
                {locale === 'tr' ? 'Uygulama dili' : 'App language'}
              </Text>
            </View>
            <Icon name="chevron-down" color={colors.textMuted} size={24} />
          </Pressable>
        </View>
        <View style={styles.card}>
          <Text style={styles.section}>YASAL VE HESAP</Text>
          <Pressable
            style={styles.row}
            onPress={() => void Linking.openURL('https://wapve.com/legal/privacy')}
            accessibilityRole="link"
            accessibilityLabel="Gizlilik politikasını aç"
          >
            <View style={styles.icon}><Icon name="shield-lock-outline" color={colors.waveBright} size={22} /></View>
            <Text style={styles.rowText}>Gizlilik Politikası</Text>
            <Icon name="open-in-new" color={colors.textDim} size={21} />
          </Pressable>
          <Pressable
            style={styles.row}
            onPress={() => void Linking.openURL('https://wapve.com/legal/terms')}
            accessibilityRole="link"
            accessibilityLabel="Kullanım koşullarını aç"
          >
            <View style={styles.icon}><Icon name="file-document-outline" color={colors.waveBright} size={22} /></View>
            <Text style={styles.rowText}>Kullanım Koşulları</Text>
            <Icon name="open-in-new" color={colors.textDim} size={21} />
          </Pressable>
        </View>
        <Button
          label={t('logout')}
          variant="danger"
          onPress={() => void logout().then(() => router.replace('/auth/login'))}
        />
      </ScrollView>
      <Modal
        visible={languageOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setLanguageOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLanguageOpen(false)} />
          <SwipeableSheetSurface onClose={() => setLanguageOpen(false)} style={styles.languageSheet}>
            <Text style={styles.sheetTitle}>Dil / Language</Text>
            <Pressable style={styles.languageOption} onPress={() => chooseLanguage('tr')}>
              <Text style={styles.flag}>🇹🇷</Text>
              <View style={styles.languageCopy}>
                <Text style={styles.languageValue}>Türkçe</Text>
                <Text style={styles.languageMeta}>Türkiye</Text>
              </View>
              {locale === 'tr' ? (
                <Icon name="check-circle" color={colors.success} size={24} />
              ) : null}
            </Pressable>
            <Pressable style={styles.languageOption} onPress={() => chooseLanguage('en')}>
              <Text style={styles.flag}>🇬🇧</Text>
              <View style={styles.languageCopy}>
                <Text style={styles.languageValue}>English</Text>
                <Text style={styles.languageMeta}>United Kingdom</Text>
              </View>
              {locale === 'en' ? (
                <Icon name="check-circle" color={colors.success} size={24} />
              ) : null}
            </Pressable>
          </SwipeableSheetSurface>
        </View>
      </Modal>
      <Modal
        visible={presenceOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPresenceOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPresenceOpen(false)} />
          <SwipeableSheetSurface onClose={() => setPresenceOpen(false)} style={styles.languageSheet}>
            <Text style={styles.sheetTitle}>Durumunu ayarla</Text>
            <Pressable style={styles.languageOption} onPress={() => setPresencePickerOpen(true)}>
              <View
                style={[
                  styles.statusChoiceDot,
                  {
                    backgroundColor:
                      data?.status === 'DND'
                        ? colors.danger
                        : data?.status === 'IDLE'
                          ? colors.warning
                          : data?.status === 'INVISIBLE'
                            ? colors.textDim
                            : colors.success,
                  },
                ]}
              />
              <View style={styles.languageCopy}>
                <Text style={styles.languageValue}>{presenceLabel(data?.status ?? 'ONLINE')}</Text>
                <Text style={styles.languageMeta}>
                  {data?.statusExpiresAt
                    ? `${new Date(data.statusExpiresAt).toLocaleString('tr-TR')} tarihine kadar`
                    : 'Her zaman'}
                </Text>
              </View>
              <Icon name="chevron-down" color={colors.textMuted} size={24} />
            </Pressable>
            <Text style={styles.section}>DURUM MESAJI</Text>
            <View style={styles.statusComposer}>
              <Pressable
                style={styles.emojiButton}
                onPress={() => setEmojiOpen(true)}
                accessibilityLabel="Durum mesajı emojisi seç"
              >
                <Text style={styles.customStatusEmoji}>{statusEmoji ?? '😊'}</Text>
              </Pressable>
              <TextInput
                value={statusText}
                onChangeText={setStatusText}
                maxLength={128}
                style={styles.statusInput}
                placeholder="Ne yapıyorsun?"
                placeholderTextColor={colors.textDim}
              />
            </View>
            <Button label="Durum mesajını kaydet" onPress={() => void saveCustomStatus()} />
          </SwipeableSheetSurface>
        </View>
      </Modal>
      <PresencePickerSheet
        visible={presencePickerOpen}
        currentStatus={data?.status ?? 'ONLINE'}
        onClose={() => setPresencePickerOpen(false)}
        onSelect={updatePresence}
      />
      <EmojiPickerSheet
        visible={emojiOpen}
        onClose={() => setEmojiOpen(false)}
        onSelect={(emoji) => {
          setStatusEmoji(emoji);
          setEmojiOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  profile: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    paddingTop: 66,
    gap: spacing.xs,
    overflow: 'hidden',
  },
  banner: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    height: 104,
    backgroundColor: colors.surfaceSoft,
  },
  nameLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  name: { color: colors.text, ...typography.title },
  plusBadgeImage: { width: 34, height: 34, resizeMode: 'contain' },
  username: { color: colors.textMuted, ...typography.body },
  bio: { color: colors.textMuted, ...typography.body, marginVertical: spacing.sm },
  customStatus: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  customStatusEmoji: { fontSize: 18 },
  customStatusText: { flex: 1, color: colors.text, ...typography.body },
  presenceButton: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  presenceDot: { width: 12, height: 12, borderRadius: 6 },
  presenceCopy: { flex: 1 },
  presenceTitle: { color: colors.text, ...typography.label },
  presenceMeta: { color: colors.textDim, ...typography.caption },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xs,
  },
  row: {
    minHeight: touch.minimum,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  ownerRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: 'rgba(250, 204, 21, 0.08)' },
  icon: { width: 30, alignItems: 'center' },
  rowText: { flex: 1, color: colors.text, ...typography.body },
  section: { color: colors.textDim, ...typography.caption, padding: spacing.sm },
  languageSelect: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  languageValue: { color: colors.text, ...typography.label },
  languageMeta: { color: colors.textDim, ...typography.caption },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  languageSheet: {
    maxHeight: '90%',
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.canvas,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.lineStrong,
    alignSelf: 'center',
  },
  sheetTitle: { color: colors.text, ...typography.title, marginBottom: spacing.xs },
  languageOption: {
    minHeight: 66,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  flag: { fontSize: 28 },
  languageCopy: { flex: 1 },
  statusChoiceDot: { width: 16, height: 16, borderRadius: 8 },
  statusComposer: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  emojiButton: {
    width: touch.minimum,
    height: touch.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  statusInput: {
    flex: 1,
    minHeight: touch.minimum,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
});
