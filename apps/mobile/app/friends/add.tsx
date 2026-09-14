import { Text, Pressable } from '@/components/localized-native';
import type { FriendRequests } from '@wapve/contracts';
import {
  useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Share,
  StyleSheet,
  View,
} from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { colors, radius, spacing, touch, typography } from '@wapve/design-tokens';
import { Button, Field, ScreenHeader } from '@/components/ui';
import { Icon } from '@/components/icon';
import { api } from '@/lib/client';

export default function AddFriendScreen() {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function send() {
    const value = username.trim().replace(/^@/u, '');
    if (!value || busy) return;
    setBusy(true); setMessage('');
    try {
      await api.request<FriendRequests>('/social/requests', { method: 'POST', body: { username: value } });
      setUsername(''); setMessage('Arkadaşlık isteği gönderildi.');
      await queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    } catch { setMessage('Kullanıcı bulunamadı veya zaten bir isteğiniz var.'); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={styles.root}><ScreenHeader title="Arkadaş Ekle" left={<Back />} /><View style={styles.content}>
    <View style={styles.shareRow}><ShareAction icon="share-variant-outline" label="Davet paylaş" onPress={() => void Share.share({ message: 'Wapve’de bana katıl: https://wapve.com/tr/register' })} /><ShareAction icon="qrcode-scan" label="QR tara" onPress={() => router.push('/qr/scan')} /><ShareAction icon="message-text-outline" label="Mesajlar" onPress={() => void Share.share({ message: 'Wapve’de bana katıl: https://wapve.com/tr/register' })} /></View>
    <View style={styles.card}><View style={styles.at}><Text style={styles.atText}>@</Text></View><View style={styles.copy}><Text style={styles.title}>Kullanıcı adıyla ekle</Text><Text style={styles.body}>Tam Wapve kullanıcı adını yaz. Büyük-küçük harf fark etmez.</Text></View></View>
    <Field label="Kullanıcı adı" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} placeholder="@kullanici" />
    <Button label="Arkadaşlık isteği gönder" loading={busy} disabled={!username.trim()} onPress={() => void send()} />
    {message ? <Text style={styles.message}>{message}</Text> : null}
    <View style={styles.waveCard}><Icon name="account-heart-outline" color={colors.waveBright} size={52} /><Text style={styles.waveTitle}>Kendi dalganı büyüt.</Text><Text style={styles.waveBody}>Telefon rehberini sunucuya yüklemeden, kullanıcı adı veya güvenli paylaşım bağlantısıyla arkadaşlarını bul.</Text></View>
  </View></SafeAreaView>;
}
function Back() { return <Pressable style={styles.back} onPress={() => router.back()} accessibilityLabel="Geri"><Icon name="arrow-left" color={colors.text} size={27} /></Pressable>; }
function ShareAction({ icon, label, onPress }: { icon: Parameters<typeof Icon>[0]['name']; label: string; onPress(): void }) { return <Pressable style={styles.shareAction} onPress={onPress}><View style={styles.shareIcon}><Icon name={icon} color={colors.text} size={27} /></View><Text style={styles.shareLabel}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.canvas }, back: { width: touch.minimum, height: touch.minimum, alignItems: 'center', justifyContent: 'center' }, content: { padding: spacing.lg, gap: spacing.lg }, shareRow: { flexDirection: 'row', justifyContent: 'space-around' }, shareAction: { width: 92, alignItems: 'center', gap: spacing.xs }, shareIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }, shareLabel: { color: colors.textMuted, ...typography.caption, textAlign: 'center' }, card: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md }, at: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised }, atText: { color: colors.waveBright, fontSize: 31, fontWeight: '800' }, copy: { flex: 1 }, title: { color: colors.text, ...typography.heading }, body: { color: colors.textMuted, ...typography.caption, marginTop: 3 }, message: { color: colors.waveBright, ...typography.body, textAlign: 'center' }, waveCard: { marginTop: spacing.md, padding: spacing.xl, alignItems: 'center', gap: spacing.sm, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }, waveTitle: { color: colors.text, ...typography.title }, waveBody: { color: colors.textMuted, ...typography.body, textAlign: 'center' } });
