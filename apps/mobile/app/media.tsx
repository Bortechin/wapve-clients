import { Text, Alert, Pressable } from '@/components/localized-native';
import {
  colors,
  radius,
  spacing,
  typography } from '@wapve/design-tokens';
import { useAudioPlayer,
  useAudioPlayerStatus } from 'expo-audio';
import { Directory,
  File,
  Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { router,
  useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useVideoPlayer,
  VideoView } from 'expo-video';
import { useEffect,
  useMemo,
  useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
} from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { apiUrl } from '@/lib/client';
import { secureTokenStorage } from '@/lib/session-storage';
import { Icon } from '@/components/icon';

const imagePattern = /\.(?:avif|gif|jpe?g|png|webp)$/iu;
const videoPattern = /\.(?:m4v|mov|mp4|webm)$/iu;
const audioPattern = /\.(?:aac|flac|m4a|mp3|ogg|opus|wav)$/iu;

export default function MediaScreen() {
  const params = useLocalSearchParams<{ url?: string; name?: string; kind?: string; contentType?: string; size?: string }>();
  const [accessToken, setAccessToken] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { void secureTokenStorage.load().then((tokens) => setAccessToken(tokens?.accessToken ?? '')); }, []);
  const mediaUrl = useMemo(() => absoluteMediaUrl(params.url ?? ''), [params.url]);
  const name = params.name ?? 'Medya';
  const kind = params.kind?.toUpperCase();
  const isImage = kind === 'IMAGE' || (!kind && imagePattern.test(name));
  const isVideo = kind === 'VIDEO' || (!kind && videoPattern.test(name));
  const isAudio = kind === 'AUDIO' || (!kind && audioPattern.test(name));
  const isText = Boolean(params.contentType && isPlainText(params.contentType));
  const textTooLarge = Number(params.size ?? 0) > MAX_TEXT_PREVIEW_BYTES;
  const [text, setText] = useState<string | null>(null);
  const [textError, setTextError] = useState('');
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
  const source = { uri: mediaUrl, ...(headers ? { headers } : {}) };
  const video = useVideoPlayer(isVideo ? source : null, (player) => { player.loop = false; });
  const audio = useAudioPlayer(isAudio ? source : null, { downloadFirst: true, updateInterval: 250 });
  const audioStatus = useAudioPlayerStatus(audio);
  useEffect(() => {
    if (!isText || textTooLarge || !mediaUrl) return;
    const controller = new AbortController();
    setText(null); setTextError('');
    void fetch(mediaUrl, { signal: controller.signal, ...(headers ? { headers } : {}) }).then(async (response) => {
      if (!response.ok) throw new Error('preview');
      const decoded = await readLimitedText(response);
      setText([...decoded].filter((character) => {
        const code = character.codePointAt(0) ?? 0;
        return code === 9 || code === 10 || code === 13 || code >= 32;
      }).join(''));
    }).catch((error) => { if (!controller.signal.aborted) setTextError(error instanceof Error && error.message === 'large' ? 'Bu metin dosyası önizleme sınırını aşıyor.' : 'Metin önizlemesi yüklenemedi. Dosyayı indirmeyi deneyebilirsin.'); });
    return () => controller.abort();
  }, [headers, isText, mediaUrl, textTooLarge]);

  async function download(destination: Directory) {
    const target = new File(destination, safeName(name));
    return File.downloadFileAsync(mediaUrl, target, { ...(headers ? { headers } : {}), idempotent: true });
  }
  async function save() {
    setBusy(true);
    try {
      const destination = await Directory.pickDirectoryAsync();
      await download(destination);
      Alert.alert('Dosya kaydedildi', name);
    } catch (error) {
      if (!(error instanceof Error && /cancel/iu.test(error.message))) Alert.alert('İndirme başarısız', 'Dosya indirilemedi.');
    } finally { setBusy(false); }
  }
  async function share() {
    setBusy(true);
    try {
      const file = await download(Paths.cache);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { dialogTitle: name });
    } catch { Alert.alert('Paylaşma başarısız', 'Dosya hazırlanamadı.'); } finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={() => router.back()} accessibilityLabel="Medyayı kapat"><Icon name="close" color={colors.text} size={29} /></Pressable>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Pressable style={styles.headerButton} disabled={busy} onPress={() => void save()} accessibilityLabel="Dosyayı indir"><Icon name="download" color={colors.text} size={24} /></Pressable>
        <Pressable style={styles.headerButton} disabled={busy} onPress={() => void share()} accessibilityLabel="Dosyayı paylaş"><Icon name="share-variant-outline" color={colors.text} size={24} /></Pressable>
      </View>
      <View style={styles.stage}>
        {isImage ? <Image source={source} style={styles.image} contentFit="contain" transition={180} /> : isVideo ? <VideoView player={video} style={styles.video} nativeControls fullscreenOptions={{ enable: true, orientation: 'default' }} allowsPictureInPicture contentFit="contain" /> : isAudio ? <View style={styles.audio}><View style={styles.audioIcon}><Icon name="music-note" color={colors.waveBright} size={58} /></View><Text style={styles.fileName}>{name}</Text><Pressable style={styles.play} onPress={() => audioStatus.playing ? audio.pause() : audio.play()}><Icon name={audioStatus.playing ? 'pause' : 'play'} color={colors.text} size={31} /></Pressable><Text style={styles.hint}>{formatTime(audioStatus.currentTime)} / {formatTime(audioStatus.duration)}</Text></View> : isText ? <View style={styles.textPreview}>{textTooLarge ? <><Icon name="file-alert-outline" color={colors.warning} size={56} /><Text style={styles.fileName}>Önizleme kullanılamıyor</Text><Text style={styles.hint}>Dosya 64 KB sınırından büyük. Güvenli şekilde indirmek için üstteki indirme düğmesine bas.</Text></> : textError ? <><Icon name="alert-circle-outline" color={colors.danger} size={48} /><Text style={styles.hint}>{textError}</Text></> : text === null ? <Text style={styles.hint}>Metin yükleniyor…</Text> : <ScrollView style={styles.textScroll}><Text selectable style={styles.textContent}>{text}</Text></ScrollView>}</View> : <View style={styles.file}><Icon name="file-outline" color={colors.waveBright} size={72} /><Text style={styles.fileName}>{name}</Text><Text style={styles.hint}>Dosyayı indirmek veya başka bir uygulamada açmak için üstteki düğmeleri kullan.</Text></View>}
      </View>
    </SafeAreaView>
  );
}

const MAX_TEXT_PREVIEW_BYTES = 64 * 1024;
function isPlainText(contentType: string) { return /^(?:text\/|application\/(?:json|xml|javascript|x-javascript)|text\/csv)/iu.test(contentType); }
async function readLimitedText(response: Response) {
  const advertised = Number(response.headers.get('content-length') ?? 0);
  if (advertised > MAX_TEXT_PREVIEW_BYTES) throw new Error('large');
  if (!response.body?.getReader) {
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_TEXT_PREVIEW_BYTES) throw new Error('large');
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    total += next.value.byteLength;
    if (total > MAX_TEXT_PREVIEW_BYTES) {
      await reader.cancel();
      throw new Error('large');
    }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}
function absoluteMediaUrl(path: string) { if (/^https?:\/\//iu.test(path)) return path; const origin = apiUrl.replace(/\/api\/v1\/?$/u, ''); return `${origin}${path.startsWith('/') ? '' : '/'}${path}`; }
function safeName(value: string) { return value.replace(/[\\/:*?"<>|]/gu, '_').slice(0, 180) || `wapve-${Date.now()}`; }
function formatTime(value: number) { const seconds = Math.max(0, Math.floor(value || 0)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#01050f' }, header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, headerButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, name: { flex: 1, color: colors.text, ...typography.label }, stage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md }, image: { width: '100%', height: '100%' }, video: { width: '100%', height: '100%' }, file: { alignItems: 'center', gap: spacing.md, padding: spacing.xl }, audio: { width: '100%', maxWidth: 460, alignItems: 'center', gap: spacing.lg, padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.surface }, audioIcon: { width: 112, height: 112, borderRadius: 56, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }, play: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.wave, alignItems: 'center', justifyContent: 'center' }, fileName: { color: colors.text, ...typography.title, textAlign: 'center' }, hint: { color: colors.textMuted, ...typography.body, textAlign: 'center' }, textPreview: { width: '100%', flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.sm }, textScroll: { width: '100%', flex: 1, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }, textContent: { color: colors.text, padding: spacing.md, fontFamily: 'monospace', fontSize: 13, lineHeight: 19 } });
