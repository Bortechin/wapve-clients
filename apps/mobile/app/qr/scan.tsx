import { Text, Pressable } from '@/components/localized-native';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { useRef,
  useState } from 'react';
import {
  StyleSheet,
  View,
} from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { colors, radius, spacing, touch, typography } from '@wapve/design-tokens';
import { Button, ScreenHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { parseWapveQr } from '@/lib/qr-login';
import { Icon } from '@/components/icon';

export default function QrScanScreen() {
  const { user } = useAuth(); const { t } = useI18n(); const [permission, requestPermission] = useCameraPermissions(); const [error, setError] = useState(''); const locked = useRef(false);
  if (!user) { router.replace('/auth/login'); return null; }
  function scanned(result: BarcodeScanningResult) { if (locked.current) return; const parsed = parseWapveQr(result.data); if (!parsed) { setError('Bu bir Wapve giriş kodu değil.'); return; } locked.current = true; router.replace({ pathname: '/qr/approve', params: parsed }); }
  if (!permission?.granted) return <SafeAreaView style={styles.root}><ScreenHeader title="QR tara" left={<Pressable style={styles.iconButton} onPress={() => router.back()}><Icon name="arrow-left" color={colors.text} size={27} /></Pressable>} /><View style={styles.permission}><Icon name="qrcode-scan" color={colors.waveBright} size={72} /><Text style={styles.title}>{t('qrPermission')}</Text><Button label={t('allowCamera')} onPress={() => void requestPermission()} /></View></SafeAreaView>;
  return <SafeAreaView style={styles.root}><ScreenHeader title={t('scanQr')} left={<Pressable style={styles.iconButton} onPress={() => router.back()}><Icon name="arrow-left" color={colors.text} size={27} /></Pressable>} /><View style={styles.cameraWrap}><CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={scanned} /><View style={styles.shade}><View style={styles.scanBox}><View style={[styles.corner, styles.topLeft]} /><View style={[styles.corner, styles.topRight]} /><View style={[styles.corner, styles.bottomLeft]} /><View style={[styles.corner, styles.bottomRight]} /></View><Text style={styles.hint}>Bilgisayardaki Wapve QR kodunu çerçeveye getir.</Text><Text style={styles.error}>{error}</Text></View></View></SafeAreaView>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.ink }, iconButton: { width: touch.minimum, height: touch.minimum, justifyContent: 'center', alignItems: 'center' }, permission: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg, padding: spacing.xl }, title: { color: colors.text, ...typography.heading, textAlign: 'center' }, cameraWrap: { flex: 1, overflow: 'hidden' }, shade: { flex: 1, backgroundColor: 'rgba(1,5,14,.42)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl }, scanBox: { width: 265, height: 265, borderRadius: radius.xl, backgroundColor: 'transparent' }, corner: { position: 'absolute', width: 48, height: 48, borderColor: colors.cyan }, topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 }, topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 }, bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 }, bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 18 }, hint: { color: colors.text, ...typography.body, textAlign: 'center', marginTop: spacing.xl, maxWidth: 290 }, error: { color: colors.danger, ...typography.caption, marginTop: spacing.sm } });
