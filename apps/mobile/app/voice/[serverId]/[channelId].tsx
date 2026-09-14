import { Text, Pressable } from '@/components/localized-native';
import type {
  ChannelTree,
  VoiceChannelConfig,
  VoiceIceConfiguration,
  VoiceParticipant,
  VoiceSignal,
} from '@wapve/contracts';
import {
  colors,
  radius,
  spacing,
  typography } from '@wapve/design-tokens';
import { useQuery } from '@tanstack/react-query';
import { router,
  useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect,
  useMemo,
  useRef,
  useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
} from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import {
  mediaDevices,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  type MediaStream,
  type MediaStreamTrack,
} from 'react-native-webrtc';
import WapveCall from '../../../modules/wapve-call';
import { Avatar } from '@/components/ui';
import { api, realtime } from '@/lib/client';
import { useAuth } from '@/lib/auth';
import { Icon, type IconName } from '@/components/icon';
import { readLastTextChannel } from '@/lib/last-text-channel';
import { useCalls } from '@/lib/calls';
import { loadVoicePreferences, type VoicePreferences } from '@/lib/voice-preferences';
import { cameraConstraints } from '@/lib/voice-media';
import { VoiceVolume } from '@/components/voice-volume';
import { AudioRouteControl } from '@/components/audio-route-control';
import { ICE_RECOVERY_MAX_ATTEMPTS, iceRecoveryVerificationDelay, shouldRetryIceRecovery } from '@/lib/ice-recovery';
import { diagnosticErrorName, reportVoiceDiagnostic } from '@/lib/voice-diagnostics';

type Peer = { connection: RTCPeerConnection; stream: MediaStream | null };

async function applyAudioBitrate(
  connection: RTCPeerConnection,
  bitrateKbps: number,
): Promise<void> {
  const bitrate = Math.max(8, Math.min(384, bitrateKbps)) * 1_000;
  for (const sender of connection.getSenders()) {
    if (sender.track?.kind !== 'audio') continue;
    const parameters = sender.getParameters();
    if (!parameters.encodings.length) parameters.encodings = [{ active: true }];
    parameters.encodings[0]!.maxBitrate = bitrate;
    await sender.setParameters(parameters);
  }
}

export default function VoiceChannelScreen() {
  const { serverId, channelId, name } = useLocalSearchParams<{
    serverId: string;
    channelId: string;
    name?: string;
  }>();
  const { user } = useAuth();
  const { active, setActive } = useCalls();
  const channelTree = useQuery({ queryKey: ['channels', serverId], queryFn: () => api.request<ChannelTree>(`/servers/${serverId}/channels`) });
  const currentChannel = channelTree.data?.channels.find((channel) => channel.id === channelId);
  const [status, setStatus] = useState('Ses kanalına bağlanıyor…');
  const [participants, setParticipants] = useState<Record<string, VoiceParticipant>>({});
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [camera, setCamera] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [diagnostics, setDiagnostics] = useState({ latency: 0, loss: 0, quality: 'Ölçülüyor' });
  const peers = useRef(new Map<string, Peer>());
  const local = useRef<MediaStream | null>(null);
  const socketRef = useRef<Awaited<ReturnType<typeof realtime.connect>> | null>(null);
  const ownConnectionId = useRef<string | null>(null);
  const ice = useRef<VoiceIceConfiguration | null>(null);
  const preferencesRef = useRef<VoicePreferences | null>(null);
  const displayStream = useRef<MediaStream | null>(null);
  const reconnecting = useRef(new Set<string>());
  const recoveryAttempts = useRef(new Map<string, number>());
  const disconnectTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const leaving = useRef(false);
  const handledControlAction = useRef<number | null>(null);
  const bitrateKbps = useRef(64);
  const participantCount = useMemo(
    () => new Set(Object.values(participants).map((participant) => participant.userId)).size,
    [participants],
  );

  useEffect(() => {
    if (currentChannel?.bitrateKbps) bitrateKbps.current = currentChannel.bitrateKbps;
  }, [currentChannel?.bitrateKbps]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        ice.current = await api.request<VoiceIceConfiguration>('/voice/ice-servers');
      } catch (error) {
        reportVoiceDiagnostic({ event: 'ICE_CONFIGURATION_FAILED', channelId, ...diagnosticDetails(error) });
        throw error;
      }
      const preferences = await loadVoicePreferences();
      preferencesRef.current = preferences;
      await WapveCall.setSpeakerEnabled(preferences.speakerByDefault);
      if (preferences.audioInputDeviceId !== 'default') await WapveCall.setAudioRoute(preferences.audioInputDeviceId);
      await WapveCall.setCallVolume(preferences.outputVolume);
      const stream = await mediaDevices.getUserMedia({ audio: { echoCancellation: preferences.echoCancellation, noiseSuppression: preferences.noiseSuppression, autoGainControl: preferences.autoGainControl } as never, video: false });
      if (!mounted) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      local.current = stream;
      if (preferences.pushToTalk) {
        stream.getAudioTracks().forEach((track) => { track.enabled = false; });
        setMuted(true);
      }
      setLocalStream(stream);
      const socket = await realtime.connect('/voice');
      if (!mounted) return;
      socketRef.current = socket;

      const ensurePeer = (connectionId: string) => {
        const current = peers.current.get(connectionId);
        if (current) return current.connection;
        const iceServers = (ice.current?.iceServers ?? []).map((server) => ({
          urls: server.urls,
          ...(server.username ? { username: server.username } : {}),
          ...(server.credential ? { credential: server.credential } : {}),
        }));
        const peer = new RTCPeerConnection({
          iceServers,
          iceTransportPolicy: ice.current?.iceTransportPolicy ?? 'all',
        });
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        void applyAudioBitrate(peer, bitrateKbps.current).catch(() => undefined);
        peer.onicecandidate = (event: any) => {
          if (event.candidate)
            socket.emit('voice:signal', {
              targetConnectionId: connectionId,
              candidate: event.candidate.toJSON(),
            });
        };
        peer.ontrack = (event: any) => {
          const remote = event.streams[0] as MediaStream | undefined;
          if (!remote) return;
          peers.current.set(connectionId, { connection: peer, stream: remote });
          setRemoteStreams((value) => ({ ...value, [connectionId]: remote }));
        };
        const recover = async () => {
          if (reconnecting.current.has(connectionId) || peer.connectionState === 'closed') return;
          const attempt = recoveryAttempts.current.get(connectionId) ?? 0;
          if (attempt >= ICE_RECOVERY_MAX_ATTEMPTS) {
            setStatus('Yeniden bağlanma başarısız');
            return;
          }
          reconnecting.current.add(connectionId);
          recoveryAttempts.current.set(connectionId, attempt + 1);
          setStatus(`Bağlantı yenileniyor… ${attempt + 1}/${ICE_RECOVERY_MAX_ATTEMPTS}`);
          try {
            ice.current = await api.request<VoiceIceConfiguration>('/voice/ice-servers');
            peer.setConfiguration({ iceServers: (ice.current.iceServers ?? []).map((server) => ({ urls: server.urls, ...(server.username ? { username: server.username } : {}), ...(server.credential ? { credential: server.credential } : {}) })), iceTransportPolicy: ice.current.iceTransportPolicy ?? 'all' });
            peer.restartIce();
            const description = await peer.createOffer({ iceRestart: true });
            await peer.setLocalDescription(description);
            socket.emit('voice:signal', { targetConnectionId: connectionId, description });
          } catch (error) {
            reportVoiceDiagnostic({ event: 'ICE_RESTART_FAILED', channelId, connectionState: peer.connectionState, iceConnectionState: peer.iceConnectionState, signalingState: peer.signalingState, ...diagnosticDetails(error) });
            setStatus('Bağlantı kurtarma yeniden denenecek');
          }
          finally {
            const previous = disconnectTimers.current.get(connectionId); if (previous) clearTimeout(previous);
            disconnectTimers.current.set(connectionId, setTimeout(() => {
              disconnectTimers.current.delete(connectionId);
              reconnecting.current.delete(connectionId);
              if (shouldRetryIceRecovery(attempt, peer.connectionState)) void recover();
              else if (peer.connectionState !== 'connected' && peer.connectionState !== 'closed') {
                reportVoiceDiagnostic({ event: 'PEER_CONNECTION_FAILED', channelId, connectionState: peer.connectionState, iceConnectionState: peer.iceConnectionState, signalingState: peer.signalingState });
                setStatus('Yeniden bağlanma başarısız');
              }
            }, iceRecoveryVerificationDelay(attempt)));
          }
        };
        peer.onconnectionstatechange = () => {
          if (peer.connectionState === 'connected') {
            const timer = disconnectTimers.current.get(connectionId); if (timer) clearTimeout(timer);
            disconnectTimers.current.delete(connectionId); reconnecting.current.delete(connectionId); recoveryAttempts.current.delete(connectionId); setStatus('Ses bağlantısı hazır');
          } else if (peer.connectionState === 'failed') void recover();
          else if (peer.connectionState === 'disconnected' && !disconnectTimers.current.has(connectionId)) disconnectTimers.current.set(connectionId, setTimeout(() => { disconnectTimers.current.delete(connectionId); void recover(); }, 3_000));
        };
        peers.current.set(connectionId, { connection: peer, stream: null });
        return peer;
      };
      const offer = async (participant: VoiceParticipant) => {
        setParticipants((value) => ({ ...value, [participant.connectionId]: participant }));
        const peer = ensurePeer(participant.connectionId);
        const description = await peer.createOffer();
        await peer.setLocalDescription(description);
        socket.emit('voice:signal', { targetConnectionId: participant.connectionId, description });
      };
      const onPeers = (items: VoiceParticipant[]) => {
        for (const participant of items) void offer(participant);
      };
      const onPeerJoined = (participant: VoiceParticipant) =>
        setParticipants((value) => ({ ...value, [participant.connectionId]: participant }));
      const onParticipantUpdated = (participant: VoiceParticipant) =>
        setParticipants((value) => ({ ...value, [participant.connectionId]: participant }));
      const onPeerLeft = ({ connectionId }: { connectionId: string }) => {
        peers.current.get(connectionId)?.connection.close();
        peers.current.delete(connectionId);
        const recoveryTimer = disconnectTimers.current.get(connectionId); if (recoveryTimer) clearTimeout(recoveryTimer);
        disconnectTimers.current.delete(connectionId); reconnecting.current.delete(connectionId); recoveryAttempts.current.delete(connectionId);
        setParticipants((value) => {
          const next = { ...value };
          delete next[connectionId];
          return next;
        });
        setRemoteStreams((value) => {
          const next = { ...value };
          delete next[connectionId];
          return next;
        });
      };
      const onSignal = async (signal: VoiceSignal & { fromConnectionId: string }) => {
        const peer = ensurePeer(signal.fromConnectionId);
        if (signal.description) {
          await peer.setRemoteDescription(
            new RTCSessionDescription({
              type: signal.description.type,
              sdp: signal.description.sdp ?? '',
            }),
          );
          if (signal.description.type === 'offer') {
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            socket.emit('voice:signal', {
              targetConnectionId: signal.fromConnectionId,
              description: answer,
            });
          }
        }
        if (signal.candidate)
          await peer.addIceCandidate(
            new RTCIceCandidate({
              candidate: signal.candidate.candidate,
              ...(signal.candidate.sdpMid !== undefined ? { sdpMid: signal.candidate.sdpMid } : {}),
              ...(signal.candidate.sdpMLineIndex !== undefined
                ? { sdpMLineIndex: signal.candidate.sdpMLineIndex }
                : {}),
              ...(signal.candidate.usernameFragment !== undefined
                ? { usernameFragment: signal.candidate.usernameFragment }
                : {}),
            }),
          );
      };
      const onJoined = (participant: VoiceParticipant) => {
        ownConnectionId.current = participant.connectionId;
        setParticipants((value) => ({ ...value, [participant.connectionId]: participant }));
        setStatus('Ses kanalındasın');
        void WapveCall.startCallService(participant.connectionId, name ?? 'Wapve ses kanalı', `wapve://voice/${encodeURIComponent(serverId)}/${encodeURIComponent(channelId)}?name=${encodeURIComponent(name ?? 'Ses kanalı')}`);
        if (preferences.pushToTalk) publishState({ muted: true });
      };
      socket.on('voice:peers', onPeers);
      socket.on('voice:peer-joined', onPeerJoined);
      socket.on('voice:participant-updated', onParticipantUpdated);
      socket.on('voice:peer-left', onPeerLeft);
      socket.on('voice:signal', onSignal);
      socket.on('voice:joined', onJoined);
      socket.on(
        'voice:channel-config',
        (configuration: VoiceChannelConfig) => {
          if (configuration.channelId !== channelId) return;
          bitrateKbps.current = configuration.bitrateKbps;
          for (const peer of peers.current.values())
            void applyAudioBitrate(peer.connection, configuration.bitrateKbps).catch(
              () => undefined,
            );
        },
      );
      socket.on('connect_error', (error: unknown) => reportVoiceDiagnostic({ event: 'SOCKET_CONNECTION_FAILED', channelId, ...diagnosticDetails(error) }));
      socket.on('voice:error', (error: unknown) => {
        reportVoiceDiagnostic({ event: 'SIGNALING_FAILED', channelId, ...diagnosticDetails(error) });
        setStatus('Ses kanalına bağlanılamadı');
      });
      socket.emit('voice:join', { channelId });
    })().catch(() => setStatus('Mikrofon veya bağlantı hazırlanamadı'));
    return () => {
      mounted = false;
      disconnectTimers.current.forEach(clearTimeout);
      disconnectTimers.current.clear();
      recoveryAttempts.current.clear();
      stopVoiceSession();
      setActive((current) => current?.kind === 'voice' && current.channelId === channelId ? null : current);
    };
  }, [channelId]);

  useEffect(() => {
    if (leaving.current) return;
    setActive((current) => ({ kind: 'voice', serverId, channelId, ...(ownConnectionId.current ? { callId: ownConnectionId.current } : {}), mode: camera || screenSharing ? 'video' : 'audio', title: name ?? 'Ses kanalı', status, muted, deafened, speakerEnabled: current?.speakerEnabled ?? preferencesRef.current?.speakerByDefault ?? false, minimized: current?.kind === 'voice' && current.channelId === channelId ? current.minimized : false, ...(current?.endRequestedAt ? { endRequestedAt: current.endRequestedAt } : {}), ...(current?.controlAction ? { controlAction: current.controlAction } : {}) }));
  }, [camera, channelId, deafened, muted, name, screenSharing, serverId, status]);

  useEffect(() => {
    if (!active?.endRequestedAt || active.kind !== 'voice' || active.channelId !== channelId) return;
    leave();
  }, [active?.endRequestedAt]);

  useEffect(() => {
    const action = active?.controlAction;
    if (!action || active.kind !== 'voice' || active.channelId !== channelId || handledControlAction.current === action.nonce) return;
    handledControlAction.current = action.nonce;
    if (action.type === 'mute') toggleMute();
    if (action.type === 'deafen') toggleDeafen();
  }, [active?.controlAction?.nonce]);

  useEffect(() => {
    const timer = setInterval(() => { void collectVoiceDiagnostics(peers.current).then(setDiagnostics); }, 2_500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void ScreenOrientation.lockAsync(focusedId ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP);
    return () => { void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP); };
  }, [focusedId]);

  function publishState(next: {
    muted?: boolean;
    deafened?: boolean;
    videoMode?: 'camera' | 'screen' | null;
    videoPaused?: boolean;
  }) {
    socketRef.current?.emit('voice:state', {
      muted,
      deafened,
      videoMode: screenSharing ? 'screen' : camera ? 'camera' : null,
      videoPaused: false,
      ...next,
    });
  }
  function toggleMute() {
    const next = !muted;
    local.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next && !deafened;
    });
    setMuted(next);
    publishState({ muted: next });
  }
  function setPushToTalkSpeaking(speaking: boolean) {
    if (!preferencesRef.current?.pushToTalk) return;
    const enabled = speaking && !deafened;
    local.current?.getAudioTracks().forEach((track) => { track.enabled = enabled; });
    setMuted(!enabled);
    publishState({ muted: !enabled });
  }
  function toggleDeafen() {
    const next = !deafened;
    for (const item of peers.current.values())
      item.stream?.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
    local.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next && !muted;
    });
    setDeafened(next);
    publishState({ deafened: next, muted: next || muted });
  }
  async function toggleCamera() {
    if (screenSharing || currentChannel?.permissions.USE_CAMERA === false) return;
    const existing = local.current?.getVideoTracks()[0];
    if (existing) {
      existing.stop();
      local.current?.removeTrack(existing);
      for (const peer of peers.current.values()) {
        const sender = peer.connection.getSenders().find((item) => item.track?.kind === 'video');
        if (sender) await sender.replaceTrack(null);
      }
      setCamera(false);
      publishState({ videoMode: null, videoPaused: false });
      setLocalStream(local.current);
      return;
    }
    const cameraStream = await mediaDevices.getUserMedia({ audio: false, video: cameraConstraints(preferencesRef.current ?? { reducedData: false }) });
    const track = cameraStream.getVideoTracks()[0];
    if (!track || !local.current) return;
    local.current.addTrack(track);
    for (const [connectionId, peer] of peers.current) {
      peer.connection.addTrack(track, local.current);
      const description = await peer.connection.createOffer();
      await peer.connection.setLocalDescription(description);
      socketRef.current?.emit('voice:signal', { targetConnectionId: connectionId, description });
    }
    setCamera(true);
    setLocalStream(local.current);
    publishState({ videoMode: 'camera', videoPaused: false });
  }
  async function publishVideo(track: MediaStreamTrack, source: MediaStream) {
    for (const [connectionId, peer] of peers.current) {
      const sender = peer.connection.getSenders().find((item) => item.track?.kind === 'video');
      if (sender) await sender.replaceTrack(track);
      else {
        peer.connection.addTrack(track, source);
        const description = await peer.connection.createOffer();
        await peer.connection.setLocalDescription(description);
        socketRef.current?.emit('voice:signal', { targetConnectionId: connectionId, description });
      }
    }
  }
  async function toggleScreenShare() {
    if (currentChannel?.permissions.SHARE_SCREEN === false) return;
    if (screenSharing) {
      const current = displayStream.current;
      displayStream.current = null;
      current?.getTracks().forEach((track) => { track.onended = null; track.stop(); });
      const cameraTrack = local.current?.getVideoTracks()[0] ?? null;
      for (const peer of peers.current.values()) {
        const sender = peer.connection.getSenders().find((item) => item.track?.kind === 'video');
        if (sender) await sender.replaceTrack(cameraTrack);
      }
      setLocalStream(local.current);
      setScreenSharing(false);
      publishState({ videoMode: cameraTrack ? 'camera' : null, videoPaused: false });
      return;
    }
    try {
      const display = await mediaDevices.getDisplayMedia({ android: { createConfigForDefaultDisplay: true } });
      const track = display.getVideoTracks()[0];
      if (!track) return;
      displayStream.current = display;
      track.onended = () => { if (displayStream.current) void toggleScreenShare(); };
      await publishVideo(track, display);
      setLocalStream(display);
      setScreenSharing(true);
      publishState({ videoMode: 'screen', videoPaused: false });
    } catch { setStatus('Ekran paylaşımı başlatılamadı'); }
  }
  function stopVoiceSession() {
    disconnectTimers.current.forEach(clearTimeout);
    disconnectTimers.current.clear();
    reconnecting.current.clear();
    recoveryAttempts.current.clear();
    socketRef.current?.emit('voice:leave');
    socketRef.current = null;
    realtime.disconnect('/voice');
    local.current?.getTracks().forEach((track) => track.stop());
    displayStream.current?.getTracks().forEach((track) => track.stop());
    displayStream.current = null;
    local.current = null;
    for (const peer of peers.current.values()) peer.connection.close();
    peers.current.clear();
    if (ownConnectionId.current) void WapveCall.stopCall(ownConnectionId.current);
    ownConnectionId.current = null;
  }
  function leave() {
    if (leaving.current) return;
    leaving.current = true;
    setActive(null);
    stopVoiceSession();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
    void findFallbackChannel();
  }
  function setParticipantVolume(connectionId: string, stream: MediaStream, next: number) {
    stream.getAudioTracks().forEach((track) => track._setVolume(next));
    setVolumes((value) => ({ ...value, [connectionId]: next }));
  }
  function openChannelChat() {
    setActive((current) => current ? { ...current, minimized: true } : null);
    router.push({ pathname: '/channel/[serverId]/[channelId]', params: { serverId, channelId, name: name ?? 'ses-kanalı', voiceChat: '1' } });
  }
  function minimize() {
    setActive((current) => current ? { ...current, minimized: true } : null);
    router.push('/(tabs)');
  }
  async function findFallbackChannel() {
    const remembered = await readLastTextChannel(serverId);
    if (remembered) {
      router.replace({
        pathname: '/channel/[serverId]/[channelId]',
        params: { serverId, channelId: remembered.channelId, name: remembered.name ?? 'kanal' },
      });
      return;
    }
    try {
      const tree = await api.request<ChannelTree>(`/servers/${serverId}/channels`);
      const firstText = tree.channels.find((channel) => channel.type !== 'VOICE');
      if (firstText) {
        router.replace({
          pathname: '/channel/[serverId]/[channelId]',
          params: { serverId, channelId: firstText.id, name: firstText.name },
        });
        return;
      }
    } catch {
      // Çıkış her durumda çalışmalı; hedef bulunamazsa çekmeceye döner.
    }
    router.replace('/(tabs)');
  }

  const visibleParticipants = Object.values(participants);
  return (
    <SafeAreaView style={[styles.root, focusedId && styles.fullscreenRoot]} {...(focusedId ? { edges: [] as const } : {})}>
      <StatusBar hidden={Boolean(focusedId)} />
      {!focusedId ? <View style={styles.header}>
        <View style={styles.statusRow}><Text testID="voice.status" style={styles.eyebrow} accessibilityLiveRegion="polite">{status}</Text><Pressable style={styles.minimize} onPress={() => void minimize()} accessibilityLabel="Ses kanalını küçült"><Icon name="arrow-collapse-down" color={colors.textMuted} size={22} /></Pressable></View>
        <View style={styles.channelTitle}>
          <Icon name="volume-high" color={colors.text} size={23} />
          <Text style={styles.title}>{name ?? 'Ses kanalı'}</Text>
          {currentChannel?.nsfw ? (
            <View style={styles.nsfwBadge} accessibilityLabel="18+ kanal">
              <Text style={styles.nsfwBadgeText}>18+</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.count}>{participantCount} katılımcı</Text>
        <Text style={styles.diagnostics} accessibilityLiveRegion="polite">{diagnostics.quality} · {diagnostics.latency} ms · %{diagnostics.loss.toFixed(1)} paket kaybı</Text>
      </View> : null}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.stage, focusedId && styles.fullscreenStage]}>
        {visibleParticipants.map((participant) => {
          const remote = remoteStreams[participant.connectionId];
          const isSelf = participant.userId === user?.id;
          return participant.videoMode && (remote || isSelf ? localStream : null) ? (
            <Pressable key={participant.connectionId} onPress={() => setFocusedId((value) => value === participant.connectionId ? null : participant.connectionId)} style={[styles.videoTile, focusedId === participant.connectionId && styles.videoTileFocused, focusedId && focusedId !== participant.connectionId && styles.hidden]}>
              <RTCView
                streamURL={(isSelf ? localStream : remote)?.toURL() ?? ''}
                style={StyleSheet.absoluteFill}
                objectFit="cover"
                mirror={isSelf && !screenSharing}
              />
              <Text style={styles.tileName}>{isSelf && screenSharing ? 'Ekranın' : participant.displayName}</Text>
              {!isSelf && remote ? <VoiceVolume compact name={participant.displayName} value={volumes[participant.connectionId] ?? 1} onChange={(value) => setParticipantVolume(participant.connectionId, remote, value)} /> : null}
            </Pressable>
          ) : (
            <View key={participant.connectionId} style={[styles.person, focusedId && focusedId !== participant.connectionId && styles.hidden]}>
              <Avatar name={participant.displayName} size={82} online />
              <Text style={styles.personName}>{participant.displayName}</Text>
              <Text style={styles.state}>
                {participant.deafened
                  ? 'Sağırlaştırıldı'
                  : participant.muted
                    ? 'Susturuldu'
                    : 'Konuşabilir'}
              </Text>
              {!isSelf && remote ? <VoiceVolume name={participant.displayName} value={volumes[participant.connectionId] ?? 1} onChange={(value) => setParticipantVolume(participant.connectionId, remote, value)} /> : null}
            </View>
          );
        })}
      </ScrollView>
      <Soundboard serverId={serverId} channelId={channelId} deafened={deafened} canPlay={currentChannel?.permissions.USE_SOUNDBOARD === true} />
      {!focusedId ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.controls}>
        <Control
          label={preferencesRef.current?.pushToTalk ? 'Konuşmak için basılı tut' : muted ? 'Sesi aç' : 'Sustur'}
          icon={preferencesRef.current?.pushToTalk || muted ? 'microphone-off' : 'microphone'}
          active={muted}
          onPress={preferencesRef.current?.pushToTalk ? () => undefined : toggleMute}
          {...(preferencesRef.current?.pushToTalk ? { onPressIn: () => setPushToTalkSpeaking(true), onPressOut: () => setPushToTalkSpeaking(false), accessibilityHint: 'Basılı tutarken mikrofon açılır' } : {})}
        />
        <AudioRouteControl />
        <Control label="Kanal sohbeti" icon="message-text-outline" onPress={openChannelChat} />
        <Control
          label={deafened ? 'Görüşme sesini aç' : 'Görüşme sesini kapat'}
          icon={deafened ? 'headphones-off' : 'headphones'}
          active={deafened}
          onPress={toggleDeafen}
        />
        <Control
          label={camera ? 'Kamerayı kapat' : 'Kamera'}
          icon={camera ? 'video' : 'video-off'}
          active={!camera}
          disabled={currentChannel?.permissions.USE_CAMERA === false || screenSharing}
          onPress={() => void toggleCamera()}
        />
        <Control label={screenSharing ? 'Paylaşımı durdur' : 'Ekranı paylaş'} icon={screenSharing ? 'monitor-off' : 'monitor-share'} active={screenSharing} disabled={currentChannel?.permissions.SHARE_SCREEN === false} onPress={() => void toggleScreenShare()} />
        <Control testID="voice.leave" label="Ayrıl" icon="phone-hangup" danger onPress={leave} />
      </ScrollView> : null}
    </SafeAreaView>
  );
}

function Control({
  label,
  icon,
  onPress,
  active,
  danger,
  disabled,
  onPressIn,
  onPressOut,
  accessibilityHint,
  testID,
}: {
  label: string;
  icon: IconName;
  onPress(): void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onPressIn?(): void;
  onPressOut?(): void;
  accessibilityHint?: string;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.controlWrap, disabled && styles.controlDisabled]}
    >
      <View
        style={[styles.control, active && styles.controlActive, danger && styles.controlDanger]}
      >
        <Icon name={icon} color={colors.text} size={25} />
      </View>
    </Pressable>
  );
}

function diagnosticDetails(error: unknown) {
  const errorName = diagnosticErrorName(error);
  return errorName ? { errorName } : {};
}

async function collectVoiceDiagnostics(activePeers: Map<string, Peer>) {
  let latency = 0; let samples = 0; let lost = 0; let received = 0;
  await Promise.all([...activePeers.values()].map(async ({ connection }) => {
    try {
      const stats = await connection.getStats();
      stats.forEach((report: Record<string, unknown>) => {
        if (report.type === 'candidate-pair' && (report.nominated || report.state === 'succeeded')) { const seconds = Number(report.currentRoundTripTime ?? 0); if (seconds > 0) { latency += seconds * 1_000; samples += 1; } }
        if (report.type === 'inbound-rtp') { lost += Number(report.packetsLost ?? 0); received += Number(report.packetsReceived ?? 0); }
      });
    } catch { /* Peer closed during collection. */ }
  }));
  const roundTrip = samples ? Math.round(latency / samples) : 0;
  const loss = lost + received ? (lost / (lost + received)) * 100 : 0;
  const quality = !activePeers.size ? 'Bağlantı bekleniyor' : roundTrip > 350 || loss > 8 ? 'Zayıf bağlantı' : roundTrip > 180 || loss > 3 ? 'Orta bağlantı' : 'İyi bağlantı';
  return { latency: roundTrip, loss, quality };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  fullscreenRoot: { backgroundColor: '#000' },
  header: {
    alignItems: 'center',
    gap: 3,
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  statusRow: { width: '100%', minHeight: 30, alignItems: 'center', justifyContent: 'center' },
  minimize: { position: 'absolute', right: 0, width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: colors.cyan, ...typography.caption },
  title: { color: colors.text, ...typography.heading },
  channelTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  nsfwBadge: {
    minWidth: 32,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.55)',
  },
  nsfwBadgeText: { color: colors.danger, fontSize: 10, lineHeight: 13, fontWeight: '900' },
  count: { color: colors.textMuted, ...typography.caption },
  diagnostics: { color: colors.textDim, ...typography.caption },
  stage: {
    flexGrow: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  fullscreenStage: { padding: 0, gap: 0, backgroundColor: '#000' },
  person: {
    width: 142,
    minHeight: 142,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  personName: { color: colors.text, ...typography.label, textAlign: 'center' },
  state: { color: colors.textMuted, ...typography.caption },
  videoTile: {
    width: '46%',
    aspectRatio: 0.75,
    overflow: 'hidden',
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  videoTileFocused: { width: '100%', aspectRatio: 16 / 9, borderRadius: 0, borderWidth: 0 },
  hidden: { display: 'none' },
  tileName: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    color: colors.text,
    ...typography.label,
    backgroundColor: 'rgba(2,7,18,.72)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  volumeChip: { position: 'absolute', right: spacing.xs, top: spacing.xs, minHeight: 30, paddingHorizontal: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.overlay, flexDirection: 'row', alignItems: 'center', gap: 3 },
  volumeText: { color: colors.text, ...typography.caption, fontWeight: '700' },
  audioVolume: { minHeight: 32, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, flexDirection: 'row', alignItems: 'center', gap: 4 },
  controls: {
    minHeight: 116,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  controlWrap: {
    width: 70,
    minHeight: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
  control: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  controlActive: { backgroundColor: colors.wave },
  controlDanger: { backgroundColor: colors.danger },
  controlDisabled: { opacity: 0.4 },
  controlIcon: { color: colors.text, fontSize: 24, fontWeight: '800' },
});
import { Soundboard } from '@/components/soundboard';
