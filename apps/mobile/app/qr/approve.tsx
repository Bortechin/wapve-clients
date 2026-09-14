import { Text } from '@/components/localized-native';
import {
  ApiError } from '@wapve/api-client';
import { useQuery } from '@tanstack/react-query';
import { router,
  useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet,
  View,
} from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { colors, radius, spacing, typography } from '@wapve/design-tokens';
import { Button } from '@/components/ui';
import { api } from '@/lib/client';
import { useI18n } from '@/lib/i18n';
import { Icon } from '@/components/icon';

type Preview = { challengeId: string; deviceName: string; browserName: string; osName: string; countryCode: string | null; expiresAt: string };
export default function QrApproveScreen() {
  const { challengeId, token } = useLocalSearchParams<{ challengeId: string; token: string }>(); const { t } = useI18n(); const [approving, setApproving] = useState(false); const [error, setError] = useState('');
  const preview = useQuery({ queryKey: ['qr-preview', challengeId], enabled: Boolean(challengeId && token), retry: false, queryFn: () => api.request<Preview>('/auth/qr-login/preview', { method: 'POST', body: { challengeId, token } }) });
  async function approve() { setApproving(true); setError(''); try { await api.request('/auth/qr-login/approve', { method: 'POST', body: { challengeId, token } }); router.replace('/qr/success'); } catch (cause) { setError(cause instanceof ApiError ? cause.messageKey : 'Giriş onaylanamadı.'); } finally { setApproving(false); } }
  const data = preview.data;
  return <SafeAreaView style={styles.root}><View style={styles.content}><View style={styles.device}><Icon name="monitor-cellphone" color={colors.waveBright} size={48} /></View><Text style={styles.title}>{t('approveLogin')}</Text>{data ? <View style={styles.card}><Line label="Cihaz" value={data.deviceName} /><Line label="Tarayıcı" value={data.browserName} /><Line label="Sistem" value={data.osName} /><Line label="Konum" value={data.countryCode ?? 'Bilinmiyor'} /></View> : <Text style={styles.body}>{preview.isError ? 'Kodun süresi dolmuş veya kod daha önce kullanılmış.' : 'Bilgisayar bilgileri doğrulanıyor…'}</Text>}<Text style={styles.warning}>Yalnızca QR kodunu sen açtıysan onayla. Wapve senden bu ekranın görüntüsünü istemez.</Text>{error ? <Text style={styles.error}>{error}</Text> : null}<Button label={t('approve')} loading={approving} disabled={!data} onPress={() => void approve()} /><Button label={t('reject')} variant="ghost" onPress={() => router.replace('/(tabs)')} /></View></SafeAreaView>;
}
function Line({ label, value }: { label: string; value: string }) { return <View style={styles.line}><Text style={styles.lineLabel}>{label}</Text><Text style={styles.lineValue}>{value}</Text></View>; }
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.ink }, content: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }, device: { width: 96, height: 96, borderRadius: 48, alignSelf: 'center', backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.wave, alignItems: 'center', justifyContent: 'center' }, title: { color: colors.text, ...typography.title, textAlign: 'center' }, body: { color: colors.textMuted, ...typography.body, textAlign: 'center' }, card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.md }, line: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, lineLabel: { color: colors.textDim, ...typography.body }, lineValue: { color: colors.text, ...typography.label, flex: 1, textAlign: 'right' }, warning: { color: colors.warning, ...typography.caption, textAlign: 'center' }, error: { color: colors.danger, ...typography.caption, textAlign: 'center' } });
