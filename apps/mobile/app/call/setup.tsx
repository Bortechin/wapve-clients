import { Text, Pressable } from '@/components/localized-native';
import {
  colors,
  radius,
  spacing,
  typography } from '@wapve/design-tokens';
import { router,
  useLocalSearchParams } from 'expo-router';
import { useEffect,
  useRef,
  useState } from 'react';
import {
  StyleSheet,
  View,
} from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { mediaDevices, RTCView, type MediaStream } from 'react-native-webrtc';
import { Button } from '@/components/ui';
import { Icon } from '@/components/icon';
import { loadVoicePreferences } from '@/lib/voice-preferences';
import { cameraConstraints } from '@/lib/voice-media';

export default function CallSetupScreen() {
  const params = useLocalSearchParams<{ kind: 'direct' | 'group'; conversationId: string; title?: string }>();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [camera, setCamera] = useState(true);
  const [error, setError] = useState('');
  const local = useRef<MediaStream | null>(null);
  useEffect(() => {
    let mounted = true;
    void loadVoicePreferences().then((preferences) => mediaDevices.getUserMedia({ audio: false, video: cameraConstraints(preferences) })).then((next) => {
      if (!mounted) { next.getTracks().forEach((track) => track.stop()); return; }
      local.current = next; setStream(next);
    }).catch(() => setError('Kamera önizlemesi açılamadı. Kamera iznini ve başka bir uygulamanın kamerayı kullanmadığını kontrol et.'));
    return () => { mounted = false; local.current?.getTracks().forEach((track) => track.stop()); local.current = null; };
  }, []);
  function toggleCamera() {
    const next = !camera;
    local.current?.getVideoTracks().forEach((track) => { track.enabled = next; });
    setCamera(next);
  }
  function flipCamera() { local.current?.getVideoTracks()[0]?._switchCamera(); }
  function continueCall() {
    local.current?.getTracks().forEach((track) => track.stop()); local.current = null;
    router.replace({ pathname: '/call/[kind]/[conversationId]', params: { kind: params.kind, conversationId: params.conversationId, title: params.title ?? 'Görüntülü arama', mode: 'video', previewed: '1' } });
  }
  function cancel() { local.current?.getTracks().forEach((track) => track.stop()); local.current = null; router.back(); }
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>Kamera önizlemesi</Text><Text style={styles.body}>Aramaya katılmadan önce görüntünü kontrol et.</Text></View>
      <View style={styles.preview}>
        {stream && camera ? <RTCView streamURL={stream.toURL()} mirror objectFit="cover" style={StyleSheet.absoluteFill} /> : <View style={styles.cameraOff}><Icon name="video-off-outline" color={colors.textDim} size={52} /><Text style={styles.body}>Kamera kapalı</Text></View>}
        <Pressable style={styles.flip} onPress={flipCamera} accessibilityLabel="Kamerayı çevir"><Icon name="camera-flip-outline" color={colors.text} size={25} /></Pressable>
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.controls}><Pressable style={[styles.round, !camera && styles.roundActive]} onPress={toggleCamera} accessibilityLabel={camera ? 'Kamerayı kapat' : 'Kamerayı aç'}><Icon name={camera ? 'video-outline' : 'video-off-outline'} color={colors.text} size={28} /></Pressable></View>
      <View style={styles.actions}><Button label="Görüntülü aramaya başla" disabled={!stream} onPress={continueCall} /><Button label="Vazgeç" variant="ghost" onPress={cancel} /></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink, padding: spacing.lg, gap: spacing.lg },
  header: { alignItems: 'center', gap: spacing.xs },
  title: { color: colors.text, ...typography.title },
  body: { color: colors.textMuted, ...typography.body, textAlign: 'center' },
  preview: { flex: 1, minHeight: 320, overflow: 'hidden', borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  cameraOff: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  flip: { position: 'absolute', right: spacing.sm, top: spacing.sm, width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay },
  controls: { alignItems: 'center' },
  round: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  roundActive: { backgroundColor: colors.danger },
  actions: { gap: spacing.sm },
  error: { color: colors.danger, ...typography.body, textAlign: 'center' },
});
