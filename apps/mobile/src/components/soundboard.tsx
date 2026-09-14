import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { type ServerSound, type ServerSummary } from '@wapve/contracts';
import { View, ScrollView } from './themed-native';
import { Text, TextInput, Alert } from './localized-native';
import { Button } from './ui';
import { api, apiUrl, realtime, mobileUpload } from '@/lib/client';
import { secureTokenStorage } from '@/lib/session-storage';
import { absoluteMedia } from './ui';
import { useI18n } from '@/lib/i18n';
import { colors } from '@wapve/design-tokens';

export function Soundboard({
  serverId,
  channelId,
  manage = false,
  deafened = false,
  canPlay = true,
}: {
  serverId: string;
  channelId?: string;
  manage?: boolean;
  deafened?: boolean;
  canPlay?: boolean;
}) {
  const { locale } = useI18n();
  const tr = locale === 'tr';
  const [term, setTerm] = useState('');
  const [favorites, setFavorites] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [clipStart, setClipStart] = useState('0');
  const [clipLength, setClipLength] = useState('6');
  const [soundName, setSoundName] = useState('');
  const [expanded, setExpanded] = useState(manage);
  const deafenedRef = useRef(deafened);
  deafenedRef.current = deafened;
  const player = useRef<AudioPlayer | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackGeneration = useRef(0);
  const servers = useQuery({
    queryKey: ['servers'],
    queryFn: () => api.request<ServerSummary[]>('/servers'),
  });
  const sounds = useQuery({
    queryKey: ['mobile-sounds', serverId, manage],
    queryFn: async () => {
      const ids = manage ? [serverId] : (servers.data ?? []).map((server) => server.id);
      const pages = await Promise.all(
        ids.map((id) => api.request<ServerSound[]>(`/servers/${id}/sounds`)),
      );
      return pages.flat();
    },
    enabled: manage || servers.isSuccess,
  });
  function stop() {
    playbackGeneration.current += 1;
    if (timer.current) clearTimeout(timer.current);
    player.current?.remove();
    player.current = null;
  }
  async function preview(url: string, volume = 100) {
    stop();
    const generation = playbackGeneration.current;
    const uri = absoluteMedia(url);
    const target = new URL(uri);
    if (target.origin !== new URL(apiUrl).origin) throw new Error('Untrusted audio origin');
    const tokens = await secureTokenStorage.load();
    if (generation !== playbackGeneration.current || deafenedRef.current) return;
    player.current = createAudioPlayer({
      uri,
      ...(tokens?.accessToken
        ? { headers: { Authorization: `Bearer ${tokens.accessToken}` } }
        : {}),
    });
    player.current.volume = Math.max(0, Math.min(1, volume / 100));
    player.current.play();
    timer.current = setTimeout(stop, 6500);
  }
  useEffect(() => {
    if (!channelId) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void realtime
      .connect('/voice')
      .then((socket) => {
        if (disposed) return;
        const receive = (event: { audioUrl: string; volume: number }) => {
          if (!deafenedRef.current)
            void preview(event.audioUrl, event.volume).catch(() =>
              setError(tr ? 'Ses oynatılamadı.' : 'Could not play sound.'),
            );
        };
        socket.on('voice:soundboard', receive);
        cleanup = () => socket.off('voice:soundboard', receive);
      })
      .catch(() => setError(tr ? 'Bağlantı kurulamadı.' : 'Could not connect.'));
    return () => {
      disposed = true;
      cleanup?.();
      stop();
    };
  }, [channelId]);
  useEffect(() => () => stop(), []);
  useEffect(() => {
    if (deafened) stop();
  }, [deafened]);
  async function action(run: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await run();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : tr ? 'İşlem başarısız.' : 'Action failed.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function upload() {
    const start = Number(clipStart);
    const duration = Number(clipLength);
    if (
      !soundName.trim() ||
      soundName.trim().length > 32 ||
      !Number.isFinite(start) ||
      start < 0 ||
      !Number.isFinite(duration) ||
      duration < 0.25 ||
      duration > 6
    )
      throw new Error(tr ? 'Ad ve klip süresini kontrol et.' : 'Check the name and clip duration.');
    const picked = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;
    const file = picked.assets[0];
    if (!file) return;
    const query = new URLSearchParams({
      name: soundName.trim(),
      clipStartMs: String(Math.round(start * 1000)),
      clipDurationMs: String(Math.round(duration * 1000)),
    });
    await mobileUpload(`/servers/${serverId}/sounds?${query}`, file.uri, file.name);
    await sounds.refetch();
  }
  if (!expanded)
    return (
      <Button
        variant="secondary"
        label={tr ? 'Ses tahtası' : 'Soundboard'}
        onPress={() => setExpanded(true)}
      />
    );
  return (
    <View style={{ padding: 16, gap: 12, backgroundColor: colors.surface, borderRadius: 16 }}>
      {!manage && (
        <Button variant="ghost" label={tr ? 'Kapat' : 'Close'} onPress={() => setExpanded(false)} />
      )}
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>
        {tr ? 'Ses tahtası' : 'Soundboard'}
      </Text>
      <TextInput
        accessibilityLabel={tr ? 'Ses ara' : 'Search sounds'}
        placeholder={tr ? 'Ses ara' : 'Search sounds'}
        value={term}
        onChangeText={setTerm}
        style={{
          minHeight: 48,
          color: colors.text,
          backgroundColor: colors.surfaceRaised,
          borderRadius: 12,
          padding: 12,
        }}
      />
      <Button
        variant="secondary"
        label={favorites ? (tr ? 'Tüm sesler' : 'All sounds') : tr ? 'Favoriler' : 'Favorites'}
        onPress={() => setFavorites(!favorites)}
      />
      {sounds.isLoading && <Text>{tr ? 'Yükleniyor…' : 'Loading…'}</Text>}
      {sounds.isError && (
        <Button
          label={tr ? 'Tekrar dene' : 'Retry'}
          onPress={() => {
            void sounds.refetch();
          }}
        />
      )}
      <ScrollView style={{ maxHeight: 260 }}>
        {sounds.data
          ?.filter(
            (sound) =>
              (!favorites || sound.favorite) &&
              sound.name.toLocaleLowerCase().includes(term.toLocaleLowerCase()),
          )
          .map((sound) => (
            <View key={sound.id} style={{ gap: 8, paddingVertical: 10 }}>
              <Text style={{ color: colors.text }}>
                {sound.emoji} {sound.name}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Button
                  variant="secondary"
                  label={tr ? 'Dinle' : 'Preview'}
                  disabled={busy}
                  onPress={() => {
                    void action(() => preview(sound.audioUrl, sound.volume));
                  }}
                />
                {channelId && (
                  <Button
                    label={tr ? 'Çal' : 'Play'}
                    disabled={busy || !canPlay}
                    onPress={() => {
                      void action(async () => {
                        const socket = await realtime.connect('/voice');
                        socket.emit('voice:soundboard', { soundId: sound.id });
                      });
                    }}
                  />
                )}
                <Button
                  variant="ghost"
                  label={sound.favorite ? '★' : '☆'}
                  disabled={busy}
                  onPress={() => {
                    void action(async () => {
                      await api.request(`/servers/${sound.serverId}/sounds/${sound.id}/favorite`, {
                        method: sound.favorite ? 'DELETE' : 'POST',
                      });
                      await sounds.refetch();
                    });
                  }}
                />
                {manage && (
                  <Button
                    variant="danger"
                    label={tr ? 'Sil' : 'Delete'}
                    disabled={busy}
                    onPress={() =>
                      Alert.alert(tr ? 'Ses silinsin mi?' : 'Delete sound?', sound.name, [
                        { text: tr ? 'İptal' : 'Cancel', style: 'cancel' },
                        {
                          text: tr ? 'Sil' : 'Delete',
                          style: 'destructive',
                          onPress: () => {
                            void action(async () => {
                              await api.request(`/servers/${serverId}/sounds/${sound.id}`, {
                                method: 'DELETE',
                              });
                              await sounds.refetch();
                            });
                          },
                        },
                      ])
                    }
                  />
                )}
              </View>
            </View>
          ))}
      </ScrollView>
      {sounds.isSuccess && sounds.data.length === 0 && (
        <Text>{tr ? 'Henüz ses eklenmemiş.' : 'No sounds yet.'}</Text>
      )}
      {manage && (
        <View style={{ gap: 10 }}>
          <TextInput
            accessibilityLabel={tr ? 'Ses adı' : 'Sound name'}
            placeholder={tr ? 'Ses adı' : 'Sound name'}
            value={soundName}
            maxLength={32}
            onChangeText={setSoundName}
            style={{ color: colors.text, minHeight: 48 }}
          />
          <Text style={{ color: colors.textMuted }}>
            {tr ? 'Başlangıç / süre (saniye, en fazla 6)' : 'Start / duration (seconds, maximum 6)'}
          </Text>
          <TextInput
            accessibilityLabel={tr ? 'Başlangıç' : 'Start'}
            value={clipStart}
            onChangeText={setClipStart}
            keyboardType="decimal-pad"
            style={{ color: colors.text, minHeight: 48 }}
          />
          <TextInput
            accessibilityLabel={tr ? 'Süre' : 'Duration'}
            value={clipLength}
            onChangeText={setClipLength}
            keyboardType="decimal-pad"
            style={{ color: colors.text, minHeight: 48 }}
          />
          <Button
            label={tr ? 'Dosya seç ve yükle' : 'Choose file and upload'}
            loading={busy}
            onPress={() => {
              void action(upload);
            }}
          />
        </View>
      )}
      {error !== '' && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {error}
        </Text>
      )}
    </View>
  );
}
