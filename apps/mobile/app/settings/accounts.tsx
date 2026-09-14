import { Text, Pressable, Alert } from '@/components/localized-native';
import type { SwitcherAccounts } from '@wapve/contracts';
import type { MobileTokens } from '@wapve/api-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { colors, radius, spacing, touch, typography } from '@wapve/design-tokens';
import { Avatar, Button, Field, ScreenHeader } from '@/components/ui';
import { Icon } from '@/components/icon';
import { api } from '@/lib/client';
import { useAuth } from '@/lib/auth';
import { secureTokenStorage } from '@/lib/session-storage';

export default function AccountsScreen() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const accounts = useQuery({ queryKey: ['switcher-accounts', user?.id], queryFn: () => api.request<SwitcherAccounts>('/auth/accounts'), enabled: Boolean(user) });
  async function addAccount() { if (!identifier.trim() || !password || busy) return; setBusy(true); try { await api.request('/auth/accounts', { method: 'POST', body: { identifier: identifier.trim(), password, ...(code.trim() ? { code: code.trim() } : {}) } }); setIdentifier(''); setPassword(''); setCode(''); setAdding(false); await accounts.refetch(); } catch { Alert.alert('Hesap eklenemedi', 'Kimlik, parola ve gerekiyorsa 2FA kodunu kontrol et.'); } finally { setBusy(false); } }
  async function switchAccount(id: string) { if (busy || id === user?.id) return; setBusy(true); try { const result = await api.request<{ user: unknown } & MobileTokens>('/auth/accounts/switch', { method: 'POST', body: { userId: id } }); await secureTokenStorage.save(result); await refreshUser(); await queryClient.invalidateQueries(); router.replace('/(tabs)'); } catch { Alert.alert('Hesap değiştirilemedi', 'Bu cihazda hesap değiştirme oturumu geçersiz veya süresi dolmuş olabilir.'); } finally { setBusy(false); } }
  function removeAccount(id: string) { Alert.alert('Hesabı kaldır', 'Bu hesabı hızlı hesap listesinden kaldırmak istiyor musun?', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Kaldır', style: 'destructive', onPress: () => void (async () => { setBusy(true); try { await api.request(`/auth/accounts/${id}`, { method: 'DELETE' }); await accounts.refetch(); } finally { setBusy(false); } })() }]); }
  return <SafeAreaView style={styles.root} edges={['top']}><ScreenHeader title="Hesaplar" left={<Pressable style={styles.headerButton} onPress={() => router.back()} accessibilityLabel="Geri"><Icon name="arrow-left" color={colors.text} size={27} /></Pressable>} /><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Text style={styles.intro}>İki hesaba kadar güvenli hızlı geçiş ayarla. Parolalar cihazda saklanmaz.</Text><View style={styles.card}>{(accounts.data?.accounts ?? []).map((account) => <View key={account.id} style={styles.accountRow}><Avatar name={account.displayName} uri={account.avatarUrl} size={48} /><View style={styles.copy}><Text style={styles.name}>{account.displayName}</Text><Text style={styles.meta}>@{account.username}{account.current ? ' · Bu hesap' : ''}</Text></View>{account.current ? <Icon name="check-circle" color={colors.success} size={23} /> : <><Pressable style={styles.iconButton} disabled={busy} onPress={() => void switchAccount(account.id)} accessibilityLabel={`${account.displayName} hesabına geç`}><Icon name="swap-horizontal" color={colors.waveBright} size={23} /></Pressable><Pressable style={styles.iconButton} disabled={busy} onPress={() => removeAccount(account.id)} accessibilityLabel={`${account.displayName} hesabını kaldır`}><Icon name="delete-outline" color={colors.danger} size={21} /></Pressable></>}</View>)}{!accounts.data?.accounts.length ? <Text style={styles.meta}>Henüz hızlı hesap eklenmemiş.</Text> : null}</View>{adding ? <View style={styles.card}><Field label="E-posta veya kullanıcı adı" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" /><Field label="Parola" value={password} onChangeText={setPassword} secureTextEntry /><Field label="2FA kodu (varsa)" value={code} onChangeText={(value) => setCode(value.replace(/\D/gu, '').slice(0, 8))} keyboardType="number-pad" /><View style={styles.actions}><Button label="Vazgeç" variant="ghost" onPress={() => setAdding(false)} /><Button label="Hesabı ekle" loading={busy} disabled={!identifier.trim() || !password} onPress={() => void addAccount()} /></View></View> : <Button label="Hesap ekle" icon={<Icon name="account-plus-outline" color={colors.text} size={20} />} disabled={(accounts.data?.accounts.length ?? 0) >= 2} onPress={() => setAdding(true)} />}</ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.canvas }, headerButton: { width: touch.minimum, height: touch.minimum, alignItems: 'center', justifyContent: 'center' }, content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl }, intro: { color: colors.textMuted, ...typography.body }, card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }, accountRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, copy: { flex: 1 }, name: { color: colors.text, ...typography.label }, meta: { color: colors.textDim, ...typography.caption }, iconButton: { width: touch.minimum, height: touch.minimum, alignItems: 'center', justifyContent: 'center' }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm } });
