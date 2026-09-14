import { Text, Pressable, Switch } from '@/components/localized-native';
import type { BlockedUser, UserProfile } from '@wapve/contracts';
import {
  useQuery,
  useQueryClient } from '@tanstack/react-query';
import { colors,
  radius,
  spacing,
  typography } from '@wapve/design-tokens';
import {
  StyleSheet,
  View,
} from '@/components/themed-native';
import { api } from '@/lib/client';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Avatar } from './ui';
import { Icon } from './icon';

export function PrivacyProfileSettings() {
  const { user, refreshUser } = useAuth();
  const { locale, setLocale } = useI18n();
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => api.request<UserProfile>('/users/me'),
  });
  const blocks = useQuery({
    queryKey: ['blocked-users'],
    queryFn: () => api.request<BlockedUser[]>('/social/blocks'),
  });
  const data = profile.data ?? user;
  async function update(patch: Partial<UserProfile>) {
    if (!data) return;
    queryClient.setQueryData<UserProfile>(['profile', 'me'], { ...data, ...patch });
    await api.request('/users/me', { method: 'PATCH', body: patch });
    await Promise.all([profile.refetch(), refreshUser()]);
  }
  async function chooseLocale(next: 'tr' | 'en') {
    setLocale(next);
    await update({ locale: next } as Partial<UserProfile>);
  }
  async function unblock(userId: string) {
    await api.request(`/social/blocks/${userId}`, { method: 'DELETE' });
    await blocks.refetch();
  }
  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <Text style={styles.section}>GİZLİLİK VE SOHBET TERCİHLERİ</Text>
        <SettingToggle
          label="Ortak arkadaşları göster"
          body="Profilini görüntüleyenler ortak arkadaşlarınızı görebilir."
          value={data?.showMutualFriends ?? true}
          change={(value) => void update({ showMutualFriends: value } as Partial<UserProfile>)}
        />
        <SettingToggle
          label="Ortak sunucuları göster"
          body="Profilini görüntüleyenler ortak sunucularınızı görebilir."
          value={data?.showMutualServers ?? true}
          change={(value) => void update({ showMutualServers: value } as Partial<UserProfile>)}
        />
        <SettingToggle
          label="Rozetleri sohbette göster"
          body="Mesajlarının yanında Wapve rozetlerini gösterir."
          value={data?.showBadgesInChat ?? true}
          change={(value) => void update({ showBadgesInChat: value } as Partial<UserProfile>)}
        />
        <SettingToggle
          label="İfadeleri emojiye dönüştür"
          body=":) gibi ifadeleri mesaj gönderilirken emojiye çevirir."
          value={data?.autoConvertEmoticons ?? true}
          change={(value) => void update({ autoConvertEmoticons: value } as Partial<UserProfile>)}
        />
      </View>
      <View style={styles.card}>
        <Text style={styles.section}>UYGULAMA DİLİ</Text>
        <View style={styles.languageRow}>
          <LanguageChoice
            flag="🇹🇷"
            label="Türkçe"
            active={locale === 'tr'}
            press={() => void chooseLocale('tr')}
          />
          <LanguageChoice
            flag="🇬🇧"
            label="English"
            active={locale === 'en'}
            press={() => void chooseLocale('en')}
          />
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.section}>ENGELLENENLER · {blocks.data?.length ?? 0}</Text>
        <Text style={styles.body}>
          Engellediğin kişiler sana özel mesaj veya arkadaşlık isteği gönderemez.
        </Text>
        {blocks.data?.map((item) => (
          <View key={item.user.id} style={styles.blockedRow}>
            <Avatar name={item.user.displayName} uri={item.user.avatarUrl} size={44} />
            <View style={styles.copy}>
              <Text style={styles.name}>{item.user.displayName}</Text>
              <Text style={styles.meta}>@{item.user.username}</Text>
            </View>
            <Pressable style={styles.unblock} onPress={() => void unblock(item.user.id)}>
              <Text style={styles.unblockText}>Engeli kaldır</Text>
            </Pressable>
          </View>
        ))}
        {!blocks.isLoading && !blocks.data?.length ? (
          <View style={styles.empty}>
            <Icon name="shield-check-outline" color={colors.success} size={28} />
            <Text style={styles.meta}>Engellediğin kimse yok.</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function SettingToggle({
  label,
  body,
  value,
  change,
}: {
  label: string;
  body: string;
  value: boolean;
  change(value: boolean): void;
}) {
  return (
    <View style={styles.toggle}>
      <View style={styles.copy}>
        <Text style={styles.name}>{label}</Text>
        <Text style={styles.meta}>{body}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={change}
        trackColor={{ false: colors.surfaceRaised, true: colors.wave }}
        thumbColor={colors.text}
      />
    </View>
  );
}

function LanguageChoice({
  flag,
  label,
  active,
  press,
}: {
  flag: string;
  label: string;
  active: boolean;
  press(): void;
}) {
  return (
    <Pressable style={[styles.language, active && styles.languageActive]} onPress={press}>
      <Text style={styles.flag}>{flag}</Text>
      <Text style={styles.name}>{label}</Text>
      {active ? <Icon name="check-circle" color={colors.success} size={21} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  section: { color: colors.textDim, ...typography.caption, fontWeight: '800', letterSpacing: 1 },
  name: { color: colors.text, ...typography.heading },
  body: { color: colors.textMuted, ...typography.body },
  meta: { color: colors.textDim, ...typography.caption },
  copy: { flex: 1 },
  toggle: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  languageRow: { gap: spacing.xs },
  language: { minHeight: 58, paddingHorizontal: spacing.sm, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceRaised },
  languageActive: { borderWidth: 1, borderColor: colors.waveBright },
  flag: { fontSize: 25 },
  blockedRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  unblock: { minHeight: 42, justifyContent: 'center', paddingHorizontal: spacing.xs },
  unblockText: { color: colors.waveBright, ...typography.label },
  empty: { minHeight: 72, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
});
