import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationMute, UserProfile } from '@wapve/contracts';
import { colors, radius, spacing } from '@wapve/design-tokens';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Modal, Pressable, Text } from './localized-native';
import { ScrollView, StyleSheet, View } from './themed-native';
import { SwipeableSheetSurface } from './swipeable-sheet';
import { Icon, type IconName } from './icon';
import { api } from '@/lib/client';
import { useI18n } from '@/lib/i18n';
import { useDeveloperMode } from '@/lib/developer-mode';

const durations: ReadonlyArray<readonly [NotificationMute, string, string]> = [
  ['UNMUTED', 'Susturmayı kaldır', 'Unmute'],
  ['MINUTES_15', '15 dakika', '15 minutes'], ['HOUR_1', '1 saat', '1 hour'],
  ['HOURS_3', '3 saat', '3 hours'], ['HOURS_8', '8 saat', '8 hours'],
  ['HOURS_24', '24 saat', '24 hours'], ['FOREVER', 'Ben açana kadar', 'Until I turn it back on'],
];

export function ConversationOptions({ kind, id, title, userId, initialView, close, dismissDetails }: {
  kind: 'direct' | 'group'; id: string; title: string; userId?: string | undefined;
  initialView: 'settings' | 'mute'; close(): void; dismissDetails(): void;
}) {
  const { locale } = useI18n();
  const { enabled: developerMode } = useDeveloperMode();
  const queryClient = useQueryClient();
  const [view, setView] = useState(initialView);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const path = `/dm/${kind === 'direct' ? 'conversations' : 'groups'}/${id}`;
  const profile = useQuery({ queryKey: ['me-profile'], queryFn: () => api.request<UserProfile>('/users/me') });
  const preference = useQuery({ queryKey: ['conversation-notifications', kind, id], queryFn: () => api.request<{ isMuted: boolean }>(`${path}/notification-preference`) });
  const key = `${kind}:${id}`;
  const pinned = profile.data?.pinnedSocialConversations.includes(key) ?? false;
  const label = (tr: string, en: string) => locale === 'tr' ? tr : en;
  function navigate(work: () => void) { close(); dismissDetails(); setTimeout(work, 240); }
  async function action(work: () => Promise<unknown>, finish = close) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await work();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['me-profile'] }),
        queryClient.invalidateQueries({ queryKey: [kind === 'direct' ? 'dm-conversations' : 'group-conversations'] }),
      ]);
      finish();
    } catch {
      setError(label('İşlem tamamlanamadı. Yeniden dene.', 'Could not complete the action. Try again.'));
    } finally { setBusy(false); }
  }
  function row(icon: IconName, text: string, onPress: () => void, disabled = false) {
    const unavailable = busy || disabled || (view === 'mute' && !preference.data);
    return <Pressable disabled={unavailable} onPress={onPress} style={[styles.row, unavailable && { opacity: 0.45 }]} accessibilityRole="button">
      <Icon name={icon} size={24} color={colors.textMuted} /><Text style={styles.label}>{text}</Text>
    </Pressable>;
  }
  return <Modal visible transparent animationType="slide" onRequestClose={close}>
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      <SwipeableSheetSurface onClose={close} style={[styles.sheet, view === 'mute' && { height: '94%' }]}>
        <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {view === 'mute' ? <Pressable style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={label('Geri', 'Back')} onPress={() => initialView === 'settings' ? setView('settings') : close()}><Icon name="arrow-left" color={colors.text} size={26} /></Pressable> : null}
            <Text style={[styles.title, { flex: 1 }]}>{view === 'mute' ? label('Bu konuşmayı sustur', 'Mute this conversation') : title}</Text>
          </View>
          {view === 'mute' ? <Text style={styles.subtitle}>{title}</Text> : null}
          {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
          {view === 'mute' && preference.isError ? <Pressable onPress={() => void preference.refetch()} style={styles.row}><Text style={styles.label}>{label('Bildirim ayarları yüklenemedi. Yeniden dene.', 'Could not load notification settings. Try again.')}</Text></Pressable> : null}
          <View style={styles.group}>
            {view === 'mute' ? durations.map(([mute, tr, en]) => <View key={mute}>{row('bell-outline', label(tr, en), () => void action(() => api.request(`${path}/notification-preference`, { method: 'PATCH', body: { mute } })))}</View>) : <>
              {userId ? row('account-outline', label('Profil', 'Profile'), () => navigate(() => router.push({ pathname: '/profile/[userId]', params: { userId } }))) : null}
              {kind === 'direct' ? row('close-circle-outline', label("DM'yi kapat", 'Close DM'), () => void action(() => api.request(`${path}/hide`, { method: 'POST', body: {} }), () => navigate(() => router.replace('/(tabs)')))) : null}
              {row(pinned ? 'pin-off-outline' : 'pin-outline', pinned ? label('Sabitlemeyi kaldır', 'Unpin') : label('Sohbeti sabitle', 'Pin conversation'), () => void action(() => api.request('/users/me', { method: 'PATCH', body: { pinnedSocialConversations: pinned ? profile.data!.pinnedSocialConversations.filter((item) => item !== key) : [...profile.data!.pinnedSocialConversations, key] } })), !profile.data)}
              {row('email-check-outline', label('Okundu işaretle', 'Mark as read'), () => void action(() => api.request(`${path}/read`, { method: 'POST', body: {} })))}
              {row('bell-off-outline', preference.data?.isMuted ? label('Susturmayı değiştir', 'Change mute') : label('Konuşmayı sustur', 'Mute conversation'), () => setView('mute'))}
              {developerMode ? row('content-copy', label('Konuşma kimliğini kopyala', 'Copy conversation ID'), () => void action(() => Clipboard.setStringAsync(id))) : null}
            </>}
          </View>
        </ScrollView>
      </SwipeableSheetSurface>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { maxHeight: '90%', backgroundColor: colors.canvas, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.md },
  group: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden' },
  row: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 12, gap: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 15 },
  label: { color: colors.text, fontSize: 16, flex: 1 },
});
