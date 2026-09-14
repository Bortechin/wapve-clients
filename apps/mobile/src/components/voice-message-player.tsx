import { Text, Pressable } from '@/components/localized-native';
import type { MessageAttachment } from '@wapve/contracts';
import {
  useAudioPlayer,
  useAudioPlayerStatus } from 'expo-audio';
import { useEffect,
  useMemo,
  useState } from 'react';
import {
  StyleSheet,
  View,
} from '@/components/themed-native';
import { colors, radius, spacing, touch, typography } from '@wapve/design-tokens';
import { useSecureMediaSource } from './ui';
import { Icon } from './icon';

const rates = [1, 1.5, 2, 0.75] as const;

function durationLabel(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

export function VoiceMessagePlayer({ attachment }: { attachment: MessageAttachment }) {
  const source = useSecureMediaSource(attachment.url);
  const player = useAudioPlayer(source, { updateInterval: 100, downloadFirst: true });
  const status = useAudioPlayerStatus(player);
  const [trackWidth, setTrackWidth] = useState(1);
  const [rateIndex, setRateIndex] = useState(0);
  const bars = useMemo(() => Array.from({ length: 28 }, (_, index) => 5 + ((index * 13 + attachment.id.charCodeAt(index % attachment.id.length)) % 17)), [attachment.id]);
  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;

  useEffect(() => {
    player.loop = false;
  }, [player]);

  useEffect(() => {
    if (!status.didJustFinish) return;
    player.pause();
    void player.seekTo(0);
  }, [player, status.didJustFinish]);

  async function toggle() {
    if (status.playing) player.pause();
    else {
      if (status.duration > 0 && status.currentTime >= status.duration - 0.05) await player.seekTo(0);
      player.play();
    }
  }
  function changeRate() {
    const next = (rateIndex + 1) % rates.length;
    setRateIndex(next);
    player.setPlaybackRate(rates[next]!);
  }

  return (
    <View style={styles.root}>
      <Pressable style={styles.play} onPress={() => void toggle()} accessibilityLabel={status.playing ? 'Sesli mesajı duraklat' : 'Sesli mesajı oynat'}>
        <Icon name={status.playing ? 'pause' : 'play'} color={colors.text} size={24} />
      </Pressable>
      <View style={styles.body}>
        <Pressable
          style={styles.wave}
          onLayout={(event) => setTrackWidth(Math.max(1, event.nativeEvent.layout.width))}
          onPress={(event) => void player.seekTo((event.nativeEvent.locationX / trackWidth) * Math.max(0, status.duration))}
          accessibilityLabel="Sesli mesaj konumu"
        >
          {bars.map((height, index) => <View key={index} style={[styles.bar, { height, backgroundColor: index / bars.length <= progress ? colors.cyan : colors.lineStrong }]} />)}
        </Pressable>
        <View style={styles.meta}>
          <Text style={styles.time}>{durationLabel(status.playing || status.currentTime ? status.currentTime : status.duration)}</Text>
          <Text numberOfLines={1} style={styles.name}>{attachment.name}</Text>
        </View>
      </View>
      <Pressable style={styles.rate} onPress={changeRate} accessibilityLabel={`Oynatma hızı ${rates[rateIndex]} kat`}>
        <Text style={styles.rateText}>{rates[rateIndex]}×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: 300, maxWidth: '100%', minHeight: 70, marginTop: spacing.xs, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  play: { width: touch.minimum, height: touch.minimum, borderRadius: radius.pill, backgroundColor: colors.wave, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 4 },
  wave: { height: 28, flexDirection: 'row', alignItems: 'center', gap: 2, overflow: 'hidden' },
  bar: { width: 3, borderRadius: radius.pill },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  time: { color: colors.textMuted, ...typography.caption, fontVariant: ['tabular-nums'] },
  name: { flex: 1, color: colors.textDim, ...typography.caption },
  rate: { minWidth: 38, height: 34, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  rateText: { color: colors.waveBright, ...typography.caption, fontWeight: '800' },
});
