import { Text, Pressable, Switch } from '@/components/localized-native';
import type { DeviceInstallationStatus, UserSession, VoiceIceConfiguration } from '@wapve/contracts';
import {
  colors,
  radius,
  spacing,
  touch,
  typography } from '@wapve/design-tokens';
import { useQuery,
  useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState } from 'expo-audio';
import * as Network from 'expo-network';
import { router,
  useLocalSearchParams } from 'expo-router';
import { useEffect,
  useState } from 'react';
import {
  AppState,
  Linking,
  ScrollView,
  StyleSheet,
  View,
} from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { AccountSecuritySettings } from '@/components/account-security-settings';
import { Icon } from '@/components/icon';
import { PrivacyProfileSettings } from '@/components/privacy-profile-settings';
import { Button, ScreenHeader } from '@/components/ui';
import { api } from '@/lib/client';
import { loadVoicePreferences, saveVoicePreferences, type VoicePreferences } from '@/lib/voice-preferences';
import { AudioRouteControl } from '@/components/audio-route-control';
import { VoiceVolume } from '@/components/voice-volume';
import WapveCall from '../../modules/wapve-call';
import { usePushStatus } from '@/lib/push';
import { useI18n } from '@/lib/i18n';
import { diagnosticErrorName, reportVoiceDiagnostic } from '@/lib/voice-diagnostics';

const outputTestSound = require('../../assets/audio/outgoing-ring.wav') as number;

const titles: Record<string, string> = {
  notifications: 'Bildirimler',
  privacy: 'Gizlilik ve profil',
  voice: 'Ses ve görüntü',
  sessions: 'Cihazlar ve oturumlar',
  security: 'Hesap ve güvenlik',
};

export default function SettingsSectionScreen() {
  const { section = '' } = useLocalSearchParams<{ section: string }>();
  return (
    <SafeAreaView style={styles.root}>
      <ScreenHeader title={titles[section] ?? 'Ayarlar'} left={<Back />} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {section === 'sessions' ? <Sessions /> : section === 'privacy' ? <PrivacyProfileSettings /> : section === 'security' ? <AccountSecuritySettings /> : section === 'voice' ? <Voice /> : <NotificationSettings />}
      </ScrollView>
    </SafeAreaView>
  );
}

function Sessions() {
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api.request<UserSession[]>('/users/me/sessions') });
  async function revoke(id: string) {
    await api.request(`/users/me/sessions/${id}`, { method: 'DELETE' });
    await queryClient.invalidateQueries({ queryKey: ['sessions'] });
  }
  return (
    <View style={styles.card}>
      <Text style={styles.section}>AÇIK OTURUMLAR · {sessions.data?.length ?? 0}</Text>
      <Text style={styles.body}>Tanımadığın bir cihazı kapattığında o cihazın erişim ve yenileme anahtarları iptal edilir.</Text>
      {sessions.data?.map((session) => (
        <View key={session.id} style={[styles.row, session.suspicious && styles.suspicious]}>
          <View style={styles.icon}><Icon name={session.current ? 'cellphone-check' : session.suspicious ? 'alert-circle-outline' : 'cellphone'} color={session.suspicious ? colors.danger : colors.waveBright} size={23} /></View>
          <View style={styles.copy}>
            <Text style={styles.name}>{session.deviceName}{session.current ? ' · Bu cihaz' : ''}</Text>
            <Text style={styles.meta}>{session.browserName} · {session.osName}</Text>
            <Text style={styles.meta}>{countryName(session.countryCode)} · {loginMethodName(session.loginMethod)}</Text>
            <Text style={styles.meta}>Son etkinlik {formatDate(session.lastSeenAt)}</Text>
            <Text style={styles.meta}>Giriş {formatDate(session.createdAt)}</Text>
            {session.suspicious ? <Text style={styles.danger}>Şüpheli oturum</Text> : null}
          </View>
          {session.current ? null : <Pressable style={styles.action} onPress={() => void revoke(session.id)} accessibilityRole="button" accessibilityLabel={`${session.deviceName} oturumunu kapat`}><Text style={styles.danger}>Kapat</Text></Pressable>}
        </View>
      ))}
      {sessions.isLoading ? <Text style={styles.body}>Oturumlar yükleniyor…</Text> : null}
      {sessions.isError ? <Text style={styles.danger}>Oturumlar yüklenemedi.</Text> : null}
    </View>
  );
}

function Voice() {
  const [preferences, setPreferences] = useState<VoicePreferences | null>(null);
  const [audioInputs, setAudioInputs] = useState<Array<{ deviceId: string; label: string }>>([]);
  const recorder = useAudioRecorder({ ...RecordingPresets.LOW_QUALITY, isMeteringEnabled: true });
  const recorderState = useAudioRecorderState(recorder, 100);
  const [testing, setTesting] = useState(false);
  const [doctorRunning, setDoctorRunning] = useState(false);
  const [bubblePermission, setBubblePermission] = useState(false);
  const [doctorResults, setDoctorResults] = useState<Array<{ label: string; detail: string; ok: boolean }>>([]);
  useEffect(() => {
    void Promise.all([loadVoicePreferences(), WapveCall.getAudioRoutes(), WapveCall.canDrawCallBubble()]).then(([next, routes, canDrawBubble]) => {
      setPreferences(next);
      setAudioInputs(routes.map((route) => ({ deviceId: route.id, label: route.label })));
      setBubblePermission(canDrawBubble);
    }).catch(async () => setPreferences(await loadVoicePreferences()));
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void WapveCall.canDrawCallBubble().then(setBubblePermission);
    });
    return () => subscription.remove();
  }, []);
  function update<K extends keyof VoicePreferences>(key: K, value: VoicePreferences[K]) {
    if (!preferences) return;
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    void saveVoicePreferences(next);
  }
  async function toggleMicrophoneTest() {
    if (testing) {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      setTesting(false);
      return;
    }
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) return;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setTesting(true);
  }
  function testOutput() {
    const player = createAudioPlayer(outputTestSound, { downloadFirst: true });
    player.volume = preferences?.outputVolume ?? 0.75;
    player.play();
    setTimeout(() => { player.pause(); player.remove(); }, 3_500);
  }
  function updateOutputVolume(value: number) {
    update('outputVolume', value);
    void WapveCall.setCallVolume(value);
  }
  async function runVoiceDoctor() {
    setDoctorRunning(true); setDoctorResults([]);
    const results: Array<{ label: string; detail: string; ok: boolean }> = [];
    try {
      const network = await Network.getNetworkStateAsync();
      results.push({ label: 'Ağ bağlantısı', detail: network.isInternetReachable === false ? 'İnternete erişilemiyor' : `${network.type} · bağlantı hazır`, ok: network.isConnected === true && network.isInternetReachable !== false });
    } catch { results.push({ label: 'Ağ bağlantısı', detail: 'Ağ durumu okunamadı', ok: false }); }
    try {
      const started = Date.now();
      const ice = await api.request<VoiceIceConfiguration>('/voice/ice-servers');
      const latency = Date.now() - started;
      const secureTurn = ice.iceServers.some((server) => server.urls.some((url) => url.startsWith('turns:')));
      results.push({ label: 'Wapve ses geçidi', detail: `${latency} ms · ${secureTurn ? 'güvenli TURN hazır' : 'güvenli TURN bulunamadı'}`, ok: secureTurn && latency < 2_500 });
    } catch (error) {
      results.push({ label: 'Wapve ses geçidi', detail: 'ICE/TURN yapılandırması alınamadı', ok: false });
      reportVoiceDiagnostic({ event: 'ICE_CONFIGURATION_FAILED', ...(diagnosticErrorName(error) ? { errorName: diagnosticErrorName(error) } : {}) });
    }
    try {
      const inputs = await WapveCall.getAudioRoutes();
      results.push({ label: 'Mikrofon girişi', detail: inputs.length ? `${inputs.length} giriş kullanılabilir` : 'Mikrofon girişi bulunamadı', ok: inputs.length > 0 });
    } catch { results.push({ label: 'Mikrofon girişi', detail: 'Mikrofon cihazları okunamadı', ok: false }); }
    try {
      const routes = await WapveCall.getAudioRoutes();
      results.push({ label: 'Ses çıkışı', detail: routes.length ? routes.map((route) => route.label).join(', ') : 'Ses cihazı bulunamadı', ok: routes.length > 0 });
    } catch { results.push({ label: 'Ses çıkışı', detail: 'Ses cihazları okunamadı', ok: false }); }
    setDoctorResults(results); setDoctorRunning(false);
  }
  if (!preferences) return <Text style={styles.body}>Ses ayarları yükleniyor…</Text>;
  return (
    <View style={styles.card}>
      <Text style={styles.section}>ARAMA TERCİHLERİ</Text>
      <View style={styles.micTest}><View style={styles.copy}><Text style={styles.name}>Mikrofon testi</Text><Text style={styles.meta}>{testing ? 'Konuş; seviye çubuğu mikrofon girişini canlı gösterir.' : 'Görüşmeye girmeden mikrofonunu dene.'}</Text></View><Button label={testing ? 'Testi bitir' : 'Testi başlat'} variant="secondary" onPress={() => void toggleMicrophoneTest()} /></View>
      {testing ? <View style={styles.meterTrack}><View style={[styles.meterFill, { width: `${Math.max(2, Math.min(100, (((recorderState.metering ?? -60) + 60) / 60) * 100))}%` }]} /></View> : null}
      <View style={styles.micTest}><View style={styles.copy}><Text style={styles.name}>Hoparlör ve ses çıkışı testi</Text><Text style={styles.meta}>Seçili cihazdan kısa bir arama sesi çal.</Text></View><Button label="Sesi çal" variant="secondary" onPress={testOutput} /></View>
      <View style={styles.routeSetting}><View style={styles.copy}><Text style={styles.name}>Ses çıkışı</Text><Text style={styles.meta}>Telefon, hoparlör, kablolu veya Bluetooth cihazını seç.</Text></View><AudioRouteControl /></View>
      <View style={styles.volumeSetting}><View style={styles.copy}><Text style={styles.name}>Arama çıkış seviyesi</Text><Text style={styles.meta}>Görüşme sesinin ana seviyesini ayarla.</Text></View><VoiceVolume name="Arama çıkışı" value={preferences.outputVolume} onChange={updateOutputVolume} /></View>
      <View style={styles.deviceSetting}>
        <Text style={styles.name}>Mikrofon girişi</Text>
        <Text style={styles.meta}>Android’de mikrofon, telefon/Bluetooth/kablolu görüşme rotasıyla eşleşir.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deviceChoices}>
          <Pressable accessibilityRole="radio" accessibilityState={{ checked: preferences.audioInputDeviceId === 'default' }} style={[styles.deviceChoice, preferences.audioInputDeviceId === 'default' && styles.deviceChoiceSelected]} onPress={() => update('audioInputDeviceId', 'default')}><Text style={styles.deviceChoiceText}>Sistem varsayılanı</Text></Pressable>
          {audioInputs.filter((device) => device.deviceId !== 'default').map((device) => <Pressable key={device.deviceId} accessibilityRole="radio" accessibilityState={{ checked: preferences.audioInputDeviceId === device.deviceId }} style={[styles.deviceChoice, preferences.audioInputDeviceId === device.deviceId && styles.deviceChoiceSelected]} onPress={() => update('audioInputDeviceId', device.deviceId)}><Text numberOfLines={1} style={styles.deviceChoiceText}>{device.label}</Text></Pressable>)}
        </ScrollView>
      </View>
      <View style={styles.micTest}><View style={styles.copy}><Text style={styles.name}>Ses bağlantısı doktoru</Text><Text style={styles.meta}>Ağ, güvenli TURN geçidi ve ses cihazlarını kontrol et.</Text></View><Button label={doctorRunning ? 'Test ediliyor' : 'Testi çalıştır'} loading={doctorRunning} variant="secondary" onPress={() => void runVoiceDoctor()} /></View>
      {doctorResults.map((result) => <View key={result.label} style={styles.doctorResult}><Icon name={result.ok ? 'check-circle-outline' : 'alert-circle-outline'} color={result.ok ? colors.success : colors.danger} size={22} /><View style={styles.copy}><Text style={styles.name}>{result.label}</Text><Text style={styles.meta}>{result.detail}</Text></View></View>)}
      <View style={styles.micTest}><View style={styles.copy}><Text style={styles.name}>Yüzen sesli sohbet baloncuğu</Text><Text style={styles.meta}>{bubblePermission ? 'Uygulamayı küçülttüğünde sürüklenebilir Wapve logosu ve hızlı ses kontrolleri gösterilir.' : 'Diğer uygulamaların üzerindeki Wapve logosundan mikrofon, görüşme sesi, hoparlör ve ayrıl kontrollerine ulaş.'}</Text></View><Button label={bubblePermission ? 'İzni yönet' : 'Baloncuğu etkinleştir'} variant="secondary" onPress={() => void WapveCall.requestCallBubblePermission()} /></View>
      <Toggle label="Varsayılan hoparlör" body="Aramalarda sesi telefon hoparlöründen başlat." value={preferences.speakerByDefault} setValue={(value) => update('speakerByDefault', value)} />
      <Toggle label="Konuşmak için basılı tut" body="Mikrofon yalnızca arama düğmesine basılı tuttuğunda açılır." value={preferences.pushToTalk} setValue={(value) => update('pushToTalk', value)} />
      <Toggle label="Kamerayı önizle" body="Görüntülü arama öncesi yerel önizlemeyi aç." value={preferences.previewCamera} setValue={(value) => update('previewCamera', value)} />
      <Toggle label="Düşük veri kullanımı" body="Mobil ağda görüntü kalitesini kontrollü azalt." value={preferences.reducedData} setValue={(value) => update('reducedData', value)} />
      <Toggle label="Gürültü engelleme" body="Arka plan seslerini konuşmandan ayır." value={preferences.noiseSuppression} setValue={(value) => update('noiseSuppression', value)} />
      <Toggle label="Yankı giderme" body="Hoparlör sesinin mikrofona geri dönmesini azalt." value={preferences.echoCancellation} setValue={(value) => update('echoCancellation', value)} />
      <Toggle label="Otomatik kazanç" body="Mikrofon sesini konuşma seviyene göre dengeler." value={preferences.autoGainControl} setValue={(value) => update('autoGainControl', value)} />
    </View>
  );
}

function NotificationSettings() {
  const { locale } = useI18n();
  const { status, register } = usePushStatus();
  const permission = useQuery({ queryKey: ['notification-permission'], queryFn: () => Notifications.getPermissionsAsync() });
  const installation = useQuery({
    queryKey: ['push-installation-status'],
    queryFn: () => api.request<DeviceInstallationStatus>('/devices/push/current'),
  });
  const delivery = useQuery({
    queryKey: ['push-delivery-status'],
    queryFn: () => api.request<{ provider: 'FCM_V1'; deliveryConfigured: boolean }>('/push/status'),
  });
  const active = status.phase === 'fetching_token' || status.phase === 'registering';
  async function retry() {
    await register(locale);
    await Promise.all([permission.refetch(), installation.refetch()]);
  }
  return (
    <View style={styles.card}>
      <Text style={styles.section}>ANDROID BİLDİRİMLERİ</Text>
      <Text style={styles.name}>{permission.data?.granted ? 'Bildirimlere izin verildi' : 'Bildirim izni gerekli'}</Text>
      <Text style={styles.body}>Mesaj, bahsetme ve gelen arama kanalları Android’in sistem ayarlarından ayrı ayrı yönetilebilir.</Text>
      <View style={styles.doctorResult}>
        <Icon
          name={installation.data?.registered ? 'check-circle-outline' : 'alert-circle-outline'}
          color={installation.data?.registered ? colors.success : colors.warning}
          size={22}
        />
        <View style={styles.copy}>
          <Text style={styles.name}>
            {installation.isLoading
              ? 'Sunucu kaydı kontrol ediliyor…'
              : installation.data?.registered
                ? 'Push cihazı sunucuda kayıtlı'
                : 'Bu oturum için sunucu kaydı yok'}
          </Text>
          {installation.data?.installation ? (
            <Text style={styles.meta}>
              {installation.data.installation.deviceName} · v{installation.data.installation.appVersion} · son kayıt {formatDate(installation.data.installation.lastSeenAt)}
            </Text>
          ) : null}
          {installation.isError ? <Text style={styles.danger}>Sunucu kayıt durumu doğrulanamadı.</Text> : null}
        </View>
      </View>
      <View style={styles.doctorResult}>
        <Icon name={delivery.data?.deliveryConfigured ? 'check-circle-outline' : 'alert-circle-outline'} color={delivery.data?.deliveryConfigured ? colors.success : colors.danger} size={22} />
        <View style={styles.copy}>
          <Text style={styles.name} accessibilityLiveRegion="polite">{delivery.data?.deliveryConfigured ? 'Sunucu FCM v1 gönderimine hazır' : 'Sunucu FCM servis hesabı eksik'}</Text>
          <Text style={styles.meta}>{delivery.data?.deliveryConfigured ? 'Kapalı uygulamaya mesaj ve arama bildirimi gönderilebilir.' : 'Üretim sunucusuna Firebase servis hesabı bağlanmadan arka plan push çalışmaz.'}</Text>
        </View>
      </View>
      <View style={styles.doctorResult}>
        <Icon
          name={status.phase === 'registered' ? 'check-circle-outline' : status.phase === 'idle' ? 'information-outline' : 'alert-circle-outline'}
          color={status.phase === 'registered' ? colors.success : status.phase === 'idle' ? colors.waveBright : colors.warning}
          size={22}
        />
        <View style={styles.copy}>
          <Text style={styles.name}>Son kayıt denemesi</Text>
          <Text style={styles.meta}>{status.detail}</Text>
          {status.lastAttemptAt ? <Text style={styles.meta}>{formatDate(status.lastAttemptAt)}</Text> : null}
        </View>
      </View>
      <Button label={active ? 'Push kaydı yapılıyor' : 'Push kaydını yeniden dene'} loading={active} variant="secondary" onPress={() => void retry()} />
      <Button label="Sistem ayarlarını aç" variant="secondary" onPress={() => void Linking.openSettings()} />
    </View>
  );
}

function Toggle({ label, body, value, setValue }: { label: string; body: string; value: boolean; setValue(value: boolean): void }) {
  return <View style={styles.toggle}><View style={styles.copy}><Text style={styles.name}>{label}</Text><Text style={styles.meta}>{body}</Text></View><Switch accessibilityLabel={label} value={value} onValueChange={setValue} trackColor={{ false: colors.surfaceRaised, true: colors.wave }} thumbColor={colors.text} /></View>;
}

function countryName(code: string | null) {
  if (!code) return 'Konum bilinmiyor';
  try { return new Intl.DisplayNames(['tr'], { type: 'region' }).of(code) ?? code; } catch { return code; }
}

function loginMethodName(method: UserSession['loginMethod']) {
  const names: Record<UserSession['loginMethod'], string> = { PASSWORD: 'Parola', PASSWORD_2FA: 'Parola + 2FA', PASSKEY: 'Passkey', REGISTRATION: 'Kayıt' };
  return names[method];
}

function formatDate(value: string) { return new Date(value).toLocaleString('tr-TR'); }

function Back() {
  return <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Geri"><Icon name="arrow-left" color={colors.text} size={27} /></Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  back: { width: touch.minimum, height: touch.minimum, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm },
  section: { color: colors.textDim, ...typography.caption, fontWeight: '800', letterSpacing: 1 },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingVertical: spacing.sm },
  suspicious: { borderRadius: radius.md, backgroundColor: 'rgba(251, 113, 133, 0.1)' },
  toggle: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  micTest: { minHeight: 82, gap: spacing.sm },
  routeSetting: { minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  volumeSetting: { minHeight: 112, gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: spacing.sm },
  deviceSetting: { minHeight: 112, gap: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: spacing.sm },
  deviceChoices: { gap: spacing.xs, paddingVertical: spacing.xs },
  deviceChoice: { minHeight: touch.minimum, maxWidth: 220, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas, paddingHorizontal: spacing.md },
  deviceChoiceSelected: { borderColor: colors.waveBright, backgroundColor: colors.surfaceRaised },
  deviceChoiceText: { color: colors.text, ...typography.label },
  doctorResult: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.canvas },
  meterTrack: { height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.surfaceRaised },
  meterFill: { height: 10, borderRadius: 5, backgroundColor: colors.success },
  copy: { flex: 1 },
  icon: { width: 36, alignItems: 'center' },
  name: { color: colors.text, ...typography.heading },
  body: { color: colors.textMuted, ...typography.body },
  meta: { color: colors.textDim, ...typography.caption },
  action: { minHeight: touch.minimum, justifyContent: 'center', paddingHorizontal: spacing.xs },
  danger: { color: colors.danger, ...typography.label },
});
