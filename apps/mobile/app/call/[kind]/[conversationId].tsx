import { Text, Pressable } from '@/components/localized-native';
import type {
  SocialCallSession,
  VoiceIceConfiguration,
  VoiceParticipant,
  VoiceSignal,
} from '@wapve/contracts';
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer } from 'expo-audio';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { router,
  useLocalSearchParams } from 'expo-router';
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
import { colors, radius, spacing, typography } from '@wapve/design-tokens';
import WapveCall from '../../../modules/wapve-call';
import { Avatar } from '@/components/ui';
import { api, realtime } from '@/lib/client';
import { useAuth } from '@/lib/auth';
import { Icon, type IconName } from '@/components/icon';
import { useCalls } from '@/lib/calls';
import { loadVoicePreferences, type VoicePreferences } from '@/lib/voice-preferences';
import { cameraConstraints } from '@/lib/voice-media';
import { diagnosticErrorName, reportVoiceDiagnostic } from '@/lib/voice-diagnostics';
import { VoiceVolume } from '@/components/voice-volume';
import { AudioRouteControl } from '@/components/audio-route-control';
import { ICE_RECOVERY_MAX_ATTEMPTS, iceRecoveryVerificationDelay, shouldRetryIceRecovery } from '@/lib/ice-recovery';

const outgoingSound = require('../../../assets/audio/outgoing-ring.wav') as number;
type Peer = { connection: RTCPeerConnection; stream: MediaStream | null };

export default function SocialCallScreen() {
  const params = useLocalSearchParams<{
    kind: 'direct' | 'group';
    conversationId: string;
    callId?: string;
    mode?: 'audio' | 'video';
    title?: string;
    action?: 'answer' | 'decline';
  }>();
  const { user } = useAuth();
  const { active, setActive } = useCalls();
  const mode = params.mode ?? 'audio';
  const [session, setSession] = useState<SocialCallSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [participants, setParticipants] = useState<Record<string, VoiceParticipant>>({});
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(mode === 'video');
  const [screenSharing, setScreenSharing] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [diagnostics, setDiagnostics] = useState({ latency: 0, loss: 0, quality: 'Ölçülüyor' });
  const [status, setStatus] = useState('Bağlanıyor…');
  const peers = useRef(new Map<string, Peer>());
  const local = useRef<MediaStream | null>(null);
  const socketRef = useRef<Awaited<ReturnType<typeof realtime.connect>> | null>(null);
  const ice = useRef<VoiceIceConfiguration | null>(null);
  const outgoing = useRef<AudioPlayer | null>(null);
  const ringSilenced = useRef(Boolean(params.callId));
  const callServiceStarted = useRef(false);
  const serviceCallId = useRef<string | null>(null);
  const displayStream = useRef<MediaStream | null>(null);
  const reconnecting = useRef(new Set<string>());
  const recoveryAttempts = useRef(new Map<string, number>());
  const disconnectTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const preferencesRef = useRef<VoicePreferences | null>(null);
  const handledControlAction = useRef<number | null>(null);
  const participantCount = useMemo(
    () => new Set(session?.joinedUserIds ?? []).size,
    [session?.joinedUserIds],
  );

  useEffect(() => {
    if (params.action !== 'decline' || !params.callId) return;
    void realtime.connect('/calls').then((socket) => {
      socket.emit('call:decline', { callId: params.callId });
      void WapveCall.stopCall(params.callId!);
      returnToConversation(params.kind, params.conversationId, params.title);
    });
  }, [params.action, params.callId]);

  useEffect(() => {
    if (params.action === 'decline') return;
    let mounted = true;
    void (async () => {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
      });
      try {
        ice.current = await api.request<VoiceIceConfiguration>('/voice/ice-servers');
      } catch (error) {
        reportVoiceDiagnostic({ event: 'ICE_CONFIGURATION_FAILED', ...diagnosticDetails(error) });
        throw error;
      }
      const preferences = await loadVoicePreferences();
      preferencesRef.current = preferences;
      await WapveCall.setSpeakerEnabled(preferences.speakerByDefault);
      if (preferences.audioInputDeviceId !== 'default') await WapveCall.setAudioRoute(preferences.audioInputDeviceId);
      await WapveCall.setCallVolume(preferences.outputVolume);
      const stream = await mediaDevices.getUserMedia({
        audio: {
          echoCancellation: preferences.echoCancellation,
          noiseSuppression: preferences.noiseSuppression,
          autoGainControl: preferences.autoGainControl,
        } as never,
        video: mode === 'video' ? cameraConstraints(preferences) : false,
      });
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
      if (!ringSilenced.current) {
        outgoing.current = createAudioPlayer(outgoingSound, { downloadFirst: true });
        outgoing.current.loop = true;
        outgoing.current.play();
      }
      const socket = await realtime.connect('/calls');
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
        peer.onicecandidate = (event: any) => {
          if (event.candidate)
            socket.emit('call:signal', {
              targetConnectionId: connectionId,
              candidate: event.candidate.toJSON(),
            });
        };
        peer.ontrack = (event: any) => {
          const remote = event.streams[0] as MediaStream | undefined;
          if (remote) {
            peers.current.set(connectionId, { connection: peer, stream: remote });
            setRemoteStreams((value) => ({ ...value, [connectionId]: remote }));
          }
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
          setStatus(`Bağlantı yeniden kuruluyor… ${attempt + 1}/${ICE_RECOVERY_MAX_ATTEMPTS}`);
          try {
            ice.current = await api.request<VoiceIceConfiguration>('/voice/ice-servers');
            peer.setConfiguration({ iceServers: (ice.current.iceServers ?? []).map((server) => ({ urls: server.urls, ...(server.username ? { username: server.username } : {}), ...(server.credential ? { credential: server.credential } : {}) })), iceTransportPolicy: ice.current.iceTransportPolicy ?? 'all' });
            peer.restartIce();
            const description = await peer.createOffer({ iceRestart: true });
            await peer.setLocalDescription(description);
            socket.emit('call:signal', { targetConnectionId: connectionId, description });
          } catch (error) {
            reportVoiceDiagnostic({ event: 'ICE_RESTART_FAILED', connectionState: peer.connectionState, iceConnectionState: peer.iceConnectionState, signalingState: peer.signalingState, ...diagnosticDetails(error) });
            setStatus('Bağlantı kurtarma yeniden denenecek');
          }
          finally {
            const previous = disconnectTimers.current.get(connectionId); if (previous) clearTimeout(previous);
            disconnectTimers.current.set(connectionId, setTimeout(() => {
              disconnectTimers.current.delete(connectionId);
              reconnecting.current.delete(connectionId);
              if (shouldRetryIceRecovery(attempt, peer.connectionState)) void recover();
              else if (peer.connectionState !== 'connected' && peer.connectionState !== 'closed') {
                reportVoiceDiagnostic({ event: 'PEER_CONNECTION_FAILED', connectionState: peer.connectionState, iceConnectionState: peer.iceConnectionState, signalingState: peer.signalingState });
                setStatus('Yeniden bağlanma başarısız');
              }
            }, iceRecoveryVerificationDelay(attempt)));
          }
        };
        peer.onconnectionstatechange = () => {
          if (peer.connectionState === 'connected') {
            const timer = disconnectTimers.current.get(connectionId); if (timer) clearTimeout(timer);
            disconnectTimers.current.delete(connectionId); reconnecting.current.delete(connectionId); recoveryAttempts.current.delete(connectionId); setStatus('Bağlandı');
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
        socket.emit('call:signal', { targetConnectionId: participant.connectionId, description });
      };
      const onPeers = (items: VoiceParticipant[]) => {
        for (const participant of items) void offer(participant);
      };
      const onPeerJoined = (participant: VoiceParticipant) => {
        setParticipants((value) => ({ ...value, [participant.connectionId]: participant }));
      };
      const onPeerLeft = ({ connectionId }: { connectionId: string }) => {
        peers.current.get(connectionId)?.connection.close();
        peers.current.delete(connectionId);
        const recoveryTimer = disconnectTimers.current.get(connectionId); if (recoveryTimer) clearTimeout(recoveryTimer);
        disconnectTimers.current.delete(connectionId); reconnecting.current.delete(connectionId); recoveryAttempts.current.delete(connectionId);
        setRemoteStreams((value) => {
          const next = { ...value };
          delete next[connectionId];
          return next;
        });
        setParticipants((value) => {
          const next = { ...value };
          delete next[connectionId];
          return next;
        });
      };
      const onParticipantUpdated = (participant: VoiceParticipant) => {
        setParticipants((value) => ({ ...value, [participant.connectionId]: participant }));
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
            socket.emit('call:signal', {
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
      const onSession = (value: SocialCallSession) => {
        if (value.conversationId !== params.conversationId || value.kind !== params.kind) return;
        setSession(value);
        const remoteJoined = value.joinedUserIds.some((id) => id !== user?.id);
        if (remoteJoined && !ringSilenced.current) {
          ringSilenced.current = true;
          outgoing.current?.pause();
          outgoing.current?.remove();
          outgoing.current = null;
        }
        if (remoteJoined) {
          setStatus('Bağlandı');
          if (!callServiceStarted.current) {
            callServiceStarted.current = true;
            serviceCallId.current = value.id;
            void WapveCall.startCallService(value.id, value.title, `wapve://call/${params.kind}/${encodeURIComponent(params.conversationId)}?callId=${encodeURIComponent(value.id)}&mode=${mode}&title=${encodeURIComponent(value.title)}`);
          }
        }
      };
      const onJoined = (participant: VoiceParticipant) => {
        setParticipants((value) => ({ ...value, [participant.connectionId]: participant }));
        setStatus(params.callId ? 'Aramaya katılıyor…' : 'Çalıyor…');
        if (preferences.pushToTalk) {
          socket.emit('call:state', { muted: true, deafened: false, videoMode: mode === 'video' ? 'camera' : null, videoPaused: false });
        }
      };
      const onEnded = () => {
        ringSilenced.current = true;
        outgoing.current?.pause();
        outgoing.current?.remove();
        outgoing.current = null;
        setActive(null);
        returnToConversation(params.kind, params.conversationId, params.title);
      };
      socket.on('call:peers', onPeers);
      socket.on('call:peer-joined', onPeerJoined);
      socket.on('call:peer-left', onPeerLeft);
      socket.on('call:participant-updated', onParticipantUpdated);
      socket.on('call:signal', onSignal);
      socket.on('call:session', onSession);
      socket.on('call:joined', onJoined);
      socket.on('call:ended', onEnded);
      socket.on('connect_error', (error: unknown) => reportVoiceDiagnostic({ event: 'SOCKET_CONNECTION_FAILED', ...diagnosticDetails(error) }));
      socket.on('call:error', (error: unknown) => {
        reportVoiceDiagnostic({ event: 'SIGNALING_FAILED', ...diagnosticDetails(error) });
        setStatus('Aramaya bağlanılamadı');
      });
      socket.emit('call:join', { conversationId: params.conversationId, kind: params.kind, mode });
    })().catch(() => setStatus('Mikrofon veya bağlantı hazırlanamadı'));
    return () => {
      mounted = false;
      const socket = socketRef.current;
      socket?.emit('call:leave');
      outgoing.current?.pause();
      outgoing.current?.remove();
      local.current?.getTracks().forEach((track) => track.stop());
      displayStream.current?.getTracks().forEach((track) => track.stop());
      disconnectTimers.current.forEach(clearTimeout);
      disconnectTimers.current.clear();
      recoveryAttempts.current.clear();
      for (const peer of peers.current.values()) peer.connection.close();
      peers.current.clear();
      if (params.callId) void WapveCall.stopCall(params.callId);
      if (serviceCallId.current) void WapveCall.stopCall(serviceCallId.current);
      setActive((current) => current?.conversationId === params.conversationId ? null : current);
    };
  }, [params.conversationId, params.kind]);

  useEffect(() => {
    setActive((current) => ({
      kind: params.kind,
      conversationId: params.conversationId,
      ...(session?.id || params.callId ? { callId: session?.id ?? params.callId } : {}),
      mode,
      title: session?.title ?? params.title ?? 'Wapve araması',
      status,
      muted,
      deafened,
      speakerEnabled: current?.speakerEnabled ?? preferencesRef.current?.speakerByDefault ?? false,
      minimized: current?.conversationId === params.conversationId ? current.minimized : false,
      ...(current?.endRequestedAt ? { endRequestedAt: current.endRequestedAt } : {}),
      ...(current?.controlAction ? { controlAction: current.controlAction } : {}),
    }));
  }, [deafened, mode, muted, params.callId, params.conversationId, params.kind, params.title, session?.id, session?.title, status]);

  useEffect(() => {
    if (!active?.endRequestedAt || active.conversationId !== params.conversationId) return;
    hangup();
  }, [active?.endRequestedAt]);

  useEffect(() => {
    const action = active?.controlAction;
    if (!action || active.conversationId !== params.conversationId || handledControlAction.current === action.nonce) return;
    handledControlAction.current = action.nonce;
    if (action.type === 'mute') toggleMute();
    if (action.type === 'deafen') toggleDeafen();
  }, [active?.controlAction?.nonce]);

  useEffect(() => {
    const timer = setInterval(() => {
      void collectDiagnostics(peers.current).then(setDiagnostics);
    }, 2_500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void ScreenOrientation.lockAsync(focusedId ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP);
    return () => { void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP); };
  }, [focusedId]);

  function toggleMute() {
    const next = !muted;
    local.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next && !deafened;
    });
    setMuted(next);
    socketRef.current?.emit('call:state', {
      muted: next,
      deafened,
      videoMode: screenSharing ? 'screen' : mode === 'video' ? 'camera' : null,
      videoPaused: !screenSharing && !cameraEnabled,
    });
  }
  function toggleDeafen() {
    const next = !deafened;
    for (const item of peers.current.values()) item.stream?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    local.current?.getAudioTracks().forEach((track) => { track.enabled = !next && !muted; });
    setDeafened(next);
    socketRef.current?.emit('call:state', {
      muted: next || muted,
      deafened: next,
      videoMode: screenSharing ? 'screen' : mode === 'video' ? 'camera' : null,
      videoPaused: !screenSharing && !cameraEnabled,
    });
  }
  function setPushToTalkSpeaking(speaking: boolean) {
    if (!preferencesRef.current?.pushToTalk) return;
    local.current?.getAudioTracks().forEach((track) => { track.enabled = speaking && !deafened; });
    setMuted(!speaking);
    socketRef.current?.emit('call:state', {
      muted: !speaking,
      deafened,
      videoMode: screenSharing ? 'screen' : mode === 'video' ? 'camera' : null,
      videoPaused: !screenSharing && !cameraEnabled,
    });
  }
  function hangup() {
    setActive(null);
    socketRef.current?.emit('call:leave');
    returnToConversation(params.kind, params.conversationId, params.title);
  }
  function toggleCamera() {
    const next = !cameraEnabled;
    local.current?.getVideoTracks().forEach((track) => { track.enabled = next; });
    setCameraEnabled(next);
    socketRef.current?.emit('call:state', { muted, deafened, videoMode: 'camera', videoPaused: !next });
  }
  async function publishVideo(track: MediaStreamTrack, source: MediaStream) {
    for (const [connectionId, peer] of peers.current) {
      const sender = peer.connection.getSenders().find((item) => item.track?.kind === 'video');
      if (sender) await sender.replaceTrack(track);
      else {
        peer.connection.addTrack(track, source);
        const description = await peer.connection.createOffer();
        await peer.connection.setLocalDescription(description);
        socketRef.current?.emit('call:signal', { targetConnectionId: connectionId, description });
      }
    }
  }
  async function toggleScreenShare() {
    if (screenSharing) {
      const current = displayStream.current;
      displayStream.current = null;
      current?.getTracks().forEach((track) => { track.onended = null; track.stop(); });
      const camera = local.current?.getVideoTracks()[0] ?? null;
      for (const peer of peers.current.values()) {
        const sender = peer.connection.getSenders().find((item) => item.track?.kind === 'video');
        if (sender) await sender.replaceTrack(camera);
      }
      setLocalStream(local.current);
      setScreenSharing(false);
      socketRef.current?.emit('call:state', { muted, deafened, videoMode: camera ? 'camera' : null, videoPaused: camera ? !cameraEnabled : false });
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
      socketRef.current?.emit('call:state', { muted, deafened, videoMode: 'screen', videoPaused: false });
    } catch { setStatus('Ekran paylaşımı başlatılamadı'); }
  }
  function setParticipantVolume(connectionId: string, stream: MediaStream, next: number) {
    stream.getAudioTracks().forEach((track) => track._setVolume(next));
    setVolumes((value) => ({ ...value, [connectionId]: next }));
  }
  function minimize() {
    setActive((current) => current ? { ...current, minimized: true } : null);
    router.push({ pathname: params.kind === 'direct' ? '/dm/[conversationId]' : '/group/[conversationId]', params: { conversationId: params.conversationId, name: params.title ?? (params.kind === 'group' ? 'Grup' : 'Sohbet') } });
  }
  const remotes = Object.entries(remoteStreams);
  const visualMode = mode === 'video' || screenSharing || remotes.some(([, stream]) => stream.getVideoTracks().length > 0);
  return (
    <SafeAreaView style={[styles.root, focusedId && styles.fullscreenRoot]} {...(focusedId ? { edges: [] as const } : {})}>
      <StatusBar hidden={Boolean(focusedId)} />
      {!focusedId ? <View style={styles.top}>
        <View style={styles.statusRow}><Text testID={status === 'Bağlandı' ? 'call.connected' : 'call.status'} style={styles.eyebrow} accessibilityLiveRegion="polite">{status}</Text><Pressable style={styles.minimize} onPress={minimize} accessibilityLabel="Aramayı küçült"><Icon name="arrow-collapse-down" color={colors.textMuted} size={22} /></Pressable></View>
        <Text style={styles.title}>{session?.title ?? params.title ?? 'Wapve araması'}</Text>
        <Text style={styles.count}>
          {participantCount > 1 ? `${participantCount} katılımcı` : 'Yanıt bekleniyor…'}
        </Text>
        <Text style={styles.diagnostics} accessibilityLiveRegion="polite">{diagnostics.quality} · {diagnostics.latency} ms · %{diagnostics.loss.toFixed(1)} paket kaybı</Text>
      </View> : null}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.stage, visualMode && styles.videoStage, focusedId && styles.fullscreenStage]}
      >
        {visualMode && localStream && (cameraEnabled || screenSharing) ? (
          <Pressable onPress={() => setFocusedId((value) => value === 'local' ? null : 'local')} style={[styles.videoTile, focusedId === 'local' && styles.videoTileFocused, focusedId && focusedId !== 'local' && styles.videoTileHidden]}>
            <RTCView
              streamURL={localStream.toURL()}
              style={StyleSheet.absoluteFill}
              objectFit="cover"
              mirror={!screenSharing}
            />
            <Text style={styles.tileName}>{screenSharing ? 'Ekranın' : 'Sen'}</Text>
          </Pressable>
        ) : (
          <View style={styles.person}>
            <Avatar name={user?.displayName ?? 'Sen'} size={112} online />
            <Text style={styles.personName}>{user?.displayName}</Text>
          </View>
        )}
        {remotes.map(([id, stream]) =>
          visualMode && stream.getVideoTracks().length > 0 && !participants[id]?.videoPaused ? (
            <Pressable key={id} onPress={() => setFocusedId((value) => value === id ? null : id)} style={[styles.videoTile, focusedId === id && styles.videoTileFocused, focusedId && focusedId !== id && styles.videoTileHidden]}>
              <RTCView
                streamURL={stream.toURL()}
                style={StyleSheet.absoluteFill}
                objectFit="cover"
              />
              <Text style={styles.tileName}>{participants[id]?.displayName ?? 'Katılımcı'}</Text>
              <VoiceVolume compact name={participants[id]?.displayName ?? 'Katılımcı'} value={volumes[id] ?? 1} onChange={(value) => setParticipantVolume(id, stream, value)} />
            </Pressable>
          ) : (
            <View key={id} style={[styles.person, focusedId && focusedId !== id && styles.videoTileHidden]}>
              <Avatar name={participants[id]?.displayName ?? 'Katılımcı'} size={112} online />
              <Text style={styles.personName}>{participants[id]?.displayName}</Text>
              <VoiceVolume name={participants[id]?.displayName ?? 'Katılımcı'} value={volumes[id] ?? 1} onChange={(value) => setParticipantVolume(id, stream, value)} />
            </View>
          ),
        )}
      </ScrollView>
      {!focusedId ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.controls}>
        <Control
          label={preferencesRef.current?.pushToTalk ? 'Konuşmak için basılı tut' : muted ? 'Sesi aç' : 'Sustur'}
          icon={preferencesRef.current?.pushToTalk || muted ? 'microphone-off' : 'microphone'}
          active={muted}
          onPress={preferencesRef.current?.pushToTalk ? () => undefined : toggleMute}
          {...(preferencesRef.current?.pushToTalk ? { onPressIn: () => setPushToTalkSpeaking(true), onPressOut: () => setPushToTalkSpeaking(false), accessibilityHint: 'Basılı tutarken mikrofon açılır' } : {})}
        />
        <AudioRouteControl />
        <Control label={deafened ? 'Görüşme sesini aç' : 'Görüşme sesini kapat'} icon={deafened ? 'headphones-off' : 'headphones'} active={deafened} onPress={toggleDeafen} />
        {mode === 'video' ? <Control label={cameraEnabled ? 'Kamerayı kapat' : 'Kamerayı aç'} icon={cameraEnabled ? 'video-outline' : 'video-off-outline'} active={!cameraEnabled} onPress={toggleCamera} /> : null}
        <Control label={screenSharing ? 'Paylaşımı durdur' : 'Ekranı paylaş'} icon={screenSharing ? 'monitor-off' : 'monitor-share'} active={screenSharing} onPress={() => void toggleScreenShare()} />
        <Control testID="call.hangup" label="Kapat" icon="phone-hangup" danger onPress={hangup} />
      </ScrollView> : null}
    </SafeAreaView>
  );
}

function returnToConversation(kind: 'direct' | 'group', conversationId: string, title?: string) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace({
    pathname: kind === 'direct' ? '/dm/[conversationId]' : '/group/[conversationId]',
    params: { conversationId, name: title ?? (kind === 'group' ? 'Grup' : 'Sohbet') },
  });
}

async function collectDiagnostics(activePeers: Map<string, Peer>) {
  let latency = 0;
  let samples = 0;
  let lost = 0;
  let received = 0;
  await Promise.all([...activePeers.values()].map(async ({ connection }) => {
    try {
      const stats = await connection.getStats();
      stats.forEach((report: Record<string, unknown>) => {
        if (report.type === 'candidate-pair' && (report.nominated || report.state === 'succeeded')) {
          const seconds = Number(report.currentRoundTripTime ?? 0);
          if (seconds > 0) { latency += seconds * 1_000; samples += 1; }
        }
        if (report.type === 'inbound-rtp') {
          lost += Number(report.packetsLost ?? 0);
          received += Number(report.packetsReceived ?? 0);
        }
      });
    } catch { /* A peer may close while stats are being collected. */ }
  }));
  const roundTrip = samples ? Math.round(latency / samples) : 0;
  const loss = lost + received > 0 ? (lost / (lost + received)) * 100 : 0;
  const quality = !activePeers.size ? 'Bağlantı bekleniyor' : roundTrip > 350 || loss > 8 ? 'Zayıf bağlantı' : roundTrip > 180 || loss > 3 ? 'Orta bağlantı' : 'İyi bağlantı';
  return { latency: roundTrip, loss, quality };
}

function Control({
  label,
  icon,
  onPress,
  active,
  danger,
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
  onPressIn?(): void;
  onPressOut?(): void;
  accessibilityHint?: string;
  testID?: string;
}) {
  return (
    <Pressable testID={testID} accessibilityLabel={label} accessibilityHint={accessibilityHint} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={styles.controlWrap}>
      <View
        style={[styles.control, active && styles.controlActive, danger && styles.controlDanger]}
      >
        <Icon name={icon} color={colors.text} size={26} />
      </View>
    </Pressable>
  );
}

function diagnosticDetails(error: unknown) {
  const errorName = diagnosticErrorName(error);
  return errorName ? { errorName } : {};
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  fullscreenRoot: { backgroundColor: '#000' },
  top: { alignItems: 'center', padding: spacing.lg, gap: 3 },
  statusRow: { width: '100%', minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  minimize: { position: 'absolute', right: 0, width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: colors.cyan, ...typography.caption },
  title: { color: colors.text, ...typography.heading },
  count: { color: colors.textMuted, ...typography.caption },
  diagnostics: { color: colors.textDim, ...typography.caption, marginTop: 3 },
  stage: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    padding: spacing.lg,
  },
  videoStage: { flexDirection: 'row', flexWrap: 'wrap', alignContent: 'center' },
  fullscreenStage: { padding: 0, gap: 0, backgroundColor: '#000' },
  person: { alignItems: 'center', gap: spacing.sm },
  personName: { color: colors.text, ...typography.heading },
  videoTile: {
    width: '46%',
    aspectRatio: 0.72,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  videoTileFocused: { width: '100%', aspectRatio: 16 / 9, borderRadius: 0, borderWidth: 0 },
  videoTileHidden: { display: 'none' },
  tileName: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    color: colors.text,
    ...typography.label,
    backgroundColor: colors.overlay,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
  },
  volumeChip: { position: 'absolute', right: spacing.xs, top: spacing.xs, minHeight: 30, paddingHorizontal: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.overlay, flexDirection: 'row', alignItems: 'center', gap: 3 },
  volumeText: { color: colors.text, ...typography.caption, fontWeight: '700' },
  audioVolume: { minHeight: 36, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  controls: {
    minHeight: 118,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  controlWrap: { width: 60, minHeight: 66, alignItems: 'center', justifyContent: 'center' },
  control: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlActive: { backgroundColor: colors.wave },
  controlDanger: { backgroundColor: colors.danger },
  controlIcon: { color: colors.text, fontSize: 26, fontWeight: '700' },
});
