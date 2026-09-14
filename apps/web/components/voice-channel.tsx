'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  AuthSession,
  ServerChannel,
  VoiceDiagnostic,
  VoiceChannelConfig,
  VoiceIceConfiguration,
  VoiceParticipant,
  VoiceSignal,
  VoiceState,
  ServerSound,
  ServerSummary,
  ServerMember,
  ServerRole,
} from '@wapve/contracts';
import { VoiceMemberContextMenu, type VoiceContextMenuPosition } from './voice-member-context-menu';
import type { ServerSettingsSection } from './server-settings-dialog';
import type { ProfileAnchor } from './user-profile-popover';
import { CustomStatusEmoji } from './custom-status-emoji';
import {
  AudioLines,
  Heart,
  Headphones,
  Camera,
  CameraOff,
  Maximize2,
  LoaderCircle,
  Mic,
  MicOff,
  Pause,
  PhoneOff,
  Play,
  MonitorUp,
  PictureInPicture2,
  Search,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import { ApiClientError, apiRequest } from '@/lib/api';
import type { Dictionary } from '@/lib/i18n';
import { enhanceSpeechStream, type EnhancedMediaStream } from '@/lib/speech-enhancement';
import { requestWapveMedia } from './media-setup-dialog';
import {
  defaultVoiceShortcuts,
  isEditableShortcutTarget,
  matchesVoiceShortcut,
  parseVoiceShortcuts,
  voiceShortcutActions,
  voiceShortcutId,
  VOICE_SHORTCUTS_STORAGE_KEY,
  type VoiceShortcutAction,
  type VoiceShortcutBinding,
} from '@/lib/voice-shortcuts';
import { hasSpeakingVolume } from './voice-activity';
import {
  classifyVoiceTransport,
  iceCandidateMatchesRemoteDescription,
  isPrivateVoiceConfiguration,
  type VoiceCandidateType,
  type VoiceTransport,
} from './voice-network';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';
const AUDIO_INPUT_STORAGE_KEY = 'wapve:voice-input-device';
const AUDIO_OUTPUT_STORAGE_KEY = 'wapve:voice-output-device';
const AUDIO_OUTPUT_VOLUME_STORAGE_KEY = 'wapve:voice-output-volume';
const PUSH_TO_TALK_STORAGE_KEY = 'wapve:voice-push-to-talk';
const PUSH_TO_TALK_KEY_STORAGE_KEY = 'wapve:voice-push-to-talk-key';
const ECHO_CANCELLATION_STORAGE_KEY = 'wapve:voice-echo-cancellation';
const NOISE_SUPPRESSION_STORAGE_KEY = 'wapve:voice-noise-suppression';
const AUTO_GAIN_STORAGE_KEY = 'wapve:voice-auto-gain';
const PARTICIPANT_VOLUME_STORAGE_KEY = 'wapve:voice-participant-volumes';
const VOICE_RECONNECT_TIMEOUT_MS = 25_000;
const VOICE_PEER_CONNECT_TIMEOUT_MS = 15_000;

type AudioProcessingPreferences = {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
};

function voiceAudioConstraints(
  deviceId: string,
  preferences: AudioProcessingPreferences,
): MediaTrackConstraints {
  const supported = navigator.mediaDevices.getSupportedConstraints?.() ?? {};
  return {
    ...(deviceId !== 'default' ? { deviceId: { exact: deviceId } } : {}),
    ...(supported.echoCancellation !== false
      ? { echoCancellation: preferences.echoCancellation }
      : {}),
    ...(supported.noiseSuppression !== false
      ? { noiseSuppression: preferences.noiseSuppression }
      : {}),
    ...(supported.autoGainControl !== false
      ? { autoGainControl: preferences.autoGainControl }
      : {}),
    ...(supported.channelCount ? { channelCount: { ideal: 1 } } : {}),
    ...(supported.sampleRate ? { sampleRate: { ideal: 48_000 } } : {}),
  };
}

function prepareSpeechTrack(track: MediaStreamTrack): void {
  if ('contentHint' in track) track.contentHint = 'speech';
}

async function applyAudioBitrate(sender: RTCRtpSender, bitrateKbps: number): Promise<void> {
  if (sender.track?.kind !== 'audio') return;
  const parameters = sender.getParameters();
  if (!parameters.encodings?.length) parameters.encodings = [{}];
  parameters.encodings[0]!.maxBitrate = Math.max(8, Math.min(384, bitrateKbps)) * 1_000;
  await sender.setParameters(parameters);
}

function storedPreference(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return window.localStorage.getItem(key) || fallback;
}

type IncomingSignal = Omit<VoiceSignal, 'targetConnectionId'> & { fromConnectionId: string };
export type VoiceConnectionQuality = 'CONNECTING' | 'GOOD' | 'FAIR' | 'POOR';
export type VoiceConnectionMetrics = {
  roundTripMs: number | null;
  jitterMs: number | null;
  packetLossPercent: number | null;
};
export type VoiceDoctorCheck = {
  key: 'secure' | 'microphone' | 'processing' | 'signaling' | 'turn';
  status: 'PASS' | 'WARN' | 'FAIL';
  detail: string;
};

type AudioMeter = {
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  samples: Uint8Array<ArrayBuffer>;
};

type PeerNegotiationState = {
  makingOffer: boolean;
  ignoreOffer: boolean;
  settingRemoteAnswer: boolean;
};

type ConnectionStats = RTCStats & {
  currentRoundTripTime?: number;
  jitter?: number;
  packetsLost?: number;
  packetsReceived?: number;
  nominated?: boolean;
  state?: string;
  localCandidateId?: string;
  remoteCandidateId?: string;
  candidateType?: VoiceCandidateType;
};

function toIceCandidate(candidate: NonNullable<IncomingSignal['candidate']>): RTCIceCandidateInit {
  return {
    candidate: candidate.candidate,
    ...(candidate.sdpMid !== undefined ? { sdpMid: candidate.sdpMid } : {}),
    ...(candidate.sdpMLineIndex !== undefined ? { sdpMLineIndex: candidate.sdpMLineIndex } : {}),
    ...(candidate.usernameFragment !== undefined
      ? { usernameFragment: candidate.usernameFragment }
      : {}),
  };
}

export function useVoiceConnection({
  emailVerified,
  messages,
}: {
  emailVerified: boolean;
  messages: Dictionary;
}) {
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const microphonePipelineRef = useRef<EnhancedMediaStream | null>(null);
  const localVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const videoSendersRef = useRef(new Map<string, RTCRtpSender>());
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const pendingCandidatesRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const peerNegotiationRef = useRef(new Map<string, PeerNegotiationState>());
  const signalQueuesRef = useRef(new Map<string, Promise<void>>());
  const negotiationTimersRef = useRef(new Map<string, number>());
  const peerConnectTimersRef = useRef(new Map<string, number>());
  const peerEpochRef = useRef(0);
  const activeChannelRef = useRef<ServerChannel | null>(null);
  const selfConnectionIdRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioMetersRef = useRef(new Map<string, AudioMeter>());
  const speakingTimerRef = useRef<number | null>(null);
  const qualityTimerRef = useRef<number | null>(null);
  const rtcConfigurationRef = useRef<RTCConfiguration>({
    iceServers: [],
    iceTransportPolicy: 'relay',
  });
  const restartAttemptsRef = useRef(new Map<string, number>());
  const reconnectTimersRef = useRef(new Map<string, number>());
  const recoveringPeersRef = useRef(new Set<string>());
  const socketFailureTimerRef = useRef<number | null>(null);
  const selectedCandidateTypeRef = useRef<VoiceCandidateType | null>(null);
  const connectionGenerationRef = useRef(0);
  const connectingRef = useRef(false);
  const joinedRef = useRef(false);
  const disconnectRef = useRef<(clearResume?: boolean) => void>(() => undefined);
  const [activeChannel, setActiveChannel] = useState<ServerChannel | null>(null);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null);
  const [videoMode, setVideoMode] = useState<'camera' | 'screen' | null>(null);
  const [videoPaused, setVideoPaused] = useState(false);
  const [selfConnectionId, setSelfConnectionId] = useState<string | null>(null);
  const [focusedConnectionId, setFocusedConnectionId] = useState<string | null>(null);
  const [miniPlayerOpen, setMiniPlayerOpen] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [error, setError] = useState('');
  const [speakingConnectionIds, setSpeakingConnectionIds] = useState<string[]>([]);
  const [quality, setQuality] = useState<VoiceConnectionQuality>('CONNECTING');
  const [qualityMetrics, setQualityMetrics] = useState<VoiceConnectionMetrics>({
    roundTripMs: null,
    jitterMs: null,
    packetLossPercent: null,
  });
  const [transport, setTransport] = useState<VoiceTransport>('CHECKING');
  const [reconnecting, setReconnecting] = useState(false);
  const [audioInputDeviceId, setAudioInputDeviceId] = useState(() =>
    storedPreference(AUDIO_INPUT_STORAGE_KEY, 'default'),
  );
  const [audioOutputDeviceId, setAudioOutputDeviceId] = useState(() =>
    storedPreference(AUDIO_OUTPUT_STORAGE_KEY, 'default'),
  );
  const [audioOutputVolume, setAudioOutputVolumeState] = useState(() => {
    const value = Number(storedPreference(AUDIO_OUTPUT_VOLUME_STORAGE_KEY, '1'));
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
  });
  const [participantVolumes, setParticipantVolumes] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const value = JSON.parse(
        window.localStorage.getItem(PARTICIPANT_VOLUME_STORAGE_KEY) ?? '{}',
      ) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(value).flatMap(([userId, volume]) => {
          const numeric = Number(volume);
          return Number.isFinite(numeric) ? [[userId, Math.max(0, Math.min(1, numeric))]] : [];
        }),
      );
    } catch {
      return {};
    }
  });
  const [pushToTalk, setPushToTalkState] = useState(
    () => storedPreference(PUSH_TO_TALK_STORAGE_KEY, 'false') === 'true',
  );
  const [pushToTalkKey, setPushToTalkKeyState] = useState(() =>
    storedPreference(PUSH_TO_TALK_KEY_STORAGE_KEY, 'Space'),
  );
  const [echoCancellation, setEchoCancellationState] = useState(
    () => storedPreference(ECHO_CANCELLATION_STORAGE_KEY, 'true') === 'true',
  );
  const [noiseSuppression, setNoiseSuppressionState] = useState(
    () => storedPreference(NOISE_SUPPRESSION_STORAGE_KEY, 'true') === 'true',
  );
  const [autoGainControl, setAutoGainControlState] = useState(
    () => storedPreference(AUTO_GAIN_STORAGE_KEY, 'true') === 'true',
  );
  const [speechEnhancementActive, setSpeechEnhancementActive] = useState(false);
  const [shortcuts, setShortcuts] = useState(() =>
    parseVoiceShortcuts(
      typeof window === 'undefined'
        ? null
        : window.localStorage.getItem(VOICE_SHORTCUTS_STORAGE_KEY),
    ),
  );
  const mutedRef = useRef(muted);
  const mutedBeforeDeafenRef = useRef(false);
  const deafenedRef = useRef(deafened);
  const videoModeRef = useRef(videoMode);
  const videoPausedRef = useRef(videoPaused);
  mutedRef.current = muted;
  deafenedRef.current = deafened;
  videoModeRef.current = videoMode;
  videoPausedRef.current = videoPaused;

  function emitVoiceState(state: VoiceState) {
    const socket = socketRef.current;
    if (!joinedRef.current || !socket?.connected) return;
    socket.emit('voice:state', state);
  }

  function playSoundAudio(audioUrl: string, volume: number) {
    if (deafenedRef.current) return;
    const audio = new Audio(audioUrl);
    audio.volume = Math.max(0, Math.min(1, (volume / 100) * audioOutputVolume));
    void audio.play().catch(() => undefined);
  }

  function playSound(soundId: string, volume?: number) {
    if (!joinedRef.current || !socketRef.current?.connected) return;
    socketRef.current.emit('voice:soundboard', {
      soundId,
      ...(volume === undefined ? {} : { volume }),
    });
  }

  useEffect(() => () => disconnectRef.current(false), []);

  useEffect(() => {
    if (!joined || !pushToTalk) return;
    const transmit = (enabled: boolean) => {
      if (deafened || !activeChannelRef.current?.permissions.SPEAK) return;
      for (const track of localStreamRef.current?.getAudioTracks() ?? []) track.enabled = enabled;
      mutedRef.current = !enabled;
      setMuted(!enabled);
      emitVoiceState({
        muted: !enabled,
        deafened,
        videoMode,
        videoPaused,
      });
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.code !== pushToTalkKey || event.repeat || isEditableShortcutTarget(event.target))
        return;
      event.preventDefault();
      transmit(true);
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code !== pushToTalkKey || isEditableShortcutTarget(event.target)) return;
      event.preventDefault();
      transmit(false);
    };
    transmit(false);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
    };
  }, [deafened, joined, pushToTalk, pushToTalkKey, videoMode, videoPaused]);

  function updateParticipant(participant: VoiceParticipant) {
    if (participant.videoMode) setMiniPlayerOpen(true);
    else
      setFocusedConnectionId((current) => (current === participant.connectionId ? null : current));
    setParticipants((current) => {
      const found = current.some((item) => item.connectionId === participant.connectionId);
      return found
        ? current.map((item) =>
            item.connectionId === participant.connectionId ? participant : item,
          )
        : [...current, participant];
    });
  }

  function closePeer(connectionId: string, expectedConnection?: RTCPeerConnection) {
    const connection = peersRef.current.get(connectionId);
    if (expectedConnection && connection !== expectedConnection) return;
    peersRef.current.delete(connectionId);
    if (connection) {
      connection.onicecandidate = null;
      connection.ontrack = null;
      connection.onconnectionstatechange = null;
      connection.oniceconnectionstatechange = null;
      connection.close();
    }
    videoSendersRef.current.delete(connectionId);
    pendingCandidatesRef.current.delete(connectionId);
    peerNegotiationRef.current.delete(connectionId);
    signalQueuesRef.current.delete(connectionId);
    restartAttemptsRef.current.delete(connectionId);
    const negotiationTimer = negotiationTimersRef.current.get(connectionId);
    if (negotiationTimer !== undefined) window.clearTimeout(negotiationTimer);
    negotiationTimersRef.current.delete(connectionId);
    const peerConnectTimer = peerConnectTimersRef.current.get(connectionId);
    if (peerConnectTimer !== undefined) window.clearTimeout(peerConnectTimer);
    peerConnectTimersRef.current.delete(connectionId);
    const reconnectTimer = reconnectTimersRef.current.get(connectionId);
    if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
    reconnectTimersRef.current.delete(connectionId);
    setPeerRecovering(connectionId, false);
    removeAudioMeter(connectionId);
    setRemoteStreams((current) => {
      const next = { ...current };
      delete next[connectionId];
      return next;
    });
  }

  function resetPeerConnections() {
    peerEpochRef.current += 1;
    if (selfConnectionIdRef.current) removeAudioMeter(selfConnectionIdRef.current);
    for (const connectionId of [...peersRef.current.keys()]) closePeer(connectionId);
    peersRef.current.clear();
    videoSendersRef.current.clear();
    pendingCandidatesRef.current.clear();
    peerNegotiationRef.current.clear();
    signalQueuesRef.current.clear();
    restartAttemptsRef.current.clear();
    for (const timer of negotiationTimersRef.current.values()) window.clearTimeout(timer);
    negotiationTimersRef.current.clear();
    for (const timer of peerConnectTimersRef.current.values()) window.clearTimeout(timer);
    peerConnectTimersRef.current.clear();
    for (const timer of reconnectTimersRef.current.values()) window.clearTimeout(timer);
    reconnectTimersRef.current.clear();
    recoveringPeersRef.current.clear();
    setRemoteStreams({});
    setParticipants([]);
    setSelfConnectionId(null);
    selfConnectionIdRef.current = null;
    setReconnecting(false);
    setQuality('CONNECTING');
    setTransport('CHECKING');
  }

  function clearSocketFailureTimer() {
    if (socketFailureTimerRef.current !== null) window.clearTimeout(socketFailureTimerRef.current);
    socketFailureTimerRef.current = null;
  }

  function setPeerRecovering(connectionId: string, recovering: boolean) {
    if (recovering) recoveringPeersRef.current.add(connectionId);
    else recoveringPeersRef.current.delete(connectionId);
    setReconnecting(recoveringPeersRef.current.size > 0);
  }

  function armPeerConnectTimeout(
    connectionId: string,
    connection: RTCPeerConnection,
    peerEpoch: number,
  ) {
    const currentTimer = peerConnectTimersRef.current.get(connectionId);
    if (currentTimer !== undefined) window.clearTimeout(currentTimer);
    peerConnectTimersRef.current.set(
      connectionId,
      window.setTimeout(() => {
        peerConnectTimersRef.current.delete(connectionId);
        if (
          peerEpoch !== peerEpochRef.current ||
          peersRef.current.get(connectionId) !== connection ||
          ['connected', 'completed'].includes(connection.iceConnectionState)
        )
          return;
        setPeerRecovering(connectionId, true);
        void restartPeer(connectionId);
      }, VOICE_PEER_CONNECT_TIMEOUT_MS),
    );
  }

  function reportDiagnostic(diagnostic: VoiceDiagnostic) {
    void apiRequest<void>('/voice/diagnostics', {
      method: 'POST',
      body: JSON.stringify({
        ...diagnostic,
        ...(selectedCandidateTypeRef.current
          ? { candidateType: selectedCandidateTypeRef.current }
          : {}),
        ...(activeChannelRef.current ? { channelId: activeChannelRef.current.id } : {}),
      }),
    }).catch(() => undefined);
  }

  function removeAudioMeter(connectionId: string) {
    const meter = audioMetersRef.current.get(connectionId);
    meter?.source.disconnect();
    meter?.analyser.disconnect();
    audioMetersRef.current.delete(connectionId);
    setSpeakingConnectionIds((current) => current.filter((id) => id !== connectionId));
  }

  function attachAudioMeter(connectionId: string, stream: MediaStream) {
    if (audioMetersRef.current.has(connectionId) || !stream.getAudioTracks().length) return;
    try {
      const context = audioContextRef.current ?? new AudioContext();
      audioContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      audioMetersRef.current.set(connectionId, {
        source,
        analyser,
        samples: new Uint8Array(analyser.fftSize),
      });
      if (context.state === 'suspended') void context.resume();
      if (speakingTimerRef.current === null) {
        speakingTimerRef.current = window.setInterval(sampleSpeaking, 140);
      }
    } catch {
      return;
    }
  }

  function sampleSpeaking() {
    const next: string[] = [];
    for (const [connectionId, meter] of audioMetersRef.current) {
      meter.analyser.getByteTimeDomainData(meter.samples);
      if (hasSpeakingVolume(meter.samples)) next.push(connectionId);
    }
    next.sort();
    setSpeakingConnectionIds((current) =>
      current.length === next.length && current.every((id, index) => id === next[index])
        ? current
        : next,
    );
  }

  async function measureConnectionQuality() {
    const peerEpoch = peerEpochRef.current;
    const isCurrentMeasurement = () => peerEpoch === peerEpochRef.current && joinedRef.current;
    if (!joinedRef.current) {
      setQuality('CONNECTING');
      return;
    }
    const peers = [...peersRef.current.values()];
    if (!peers.length) {
      if (!isCurrentMeasurement()) return;
      setQuality('GOOD');
      setQualityMetrics({ roundTripMs: null, jitterMs: null, packetLossPercent: null });
      setTransport('CHECKING');
      return;
    }
    let severity = 0;
    let maximumRoundTrip = 0;
    let maximumJitter = 0;
    let maximumLoss = 0;
    const selectedCandidateTypes: VoiceCandidateType[] = [];
    for (const connection of peers) {
      if (['failed', 'disconnected', 'closed'].includes(connection.connectionState)) {
        severity = 2;
        continue;
      }
      if (['new', 'connecting'].includes(connection.connectionState))
        severity = Math.max(1, severity);
      let stats: RTCStatsReport;
      try {
        stats = await connection.getStats();
      } catch {
        if (!isCurrentMeasurement()) return;
        severity = 2;
        continue;
      }
      if (!isCurrentMeasurement()) return;
      stats.forEach((raw) => {
        const report = raw as ConnectionStats;
        if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
          const roundTrip = report.currentRoundTripTime ?? 0;
          maximumRoundTrip = Math.max(maximumRoundTrip, roundTrip);
          if (roundTrip >= 0.4) severity = 2;
          else if (roundTrip >= 0.2) severity = Math.max(1, severity);
          const localCandidate = report.localCandidateId
            ? (stats.get(report.localCandidateId) as ConnectionStats | undefined)
            : undefined;
          const remoteCandidate = report.remoteCandidateId
            ? (stats.get(report.remoteCandidateId) as ConnectionStats | undefined)
            : undefined;
          if (localCandidate?.candidateType)
            selectedCandidateTypes.push(localCandidate.candidateType);
          if (remoteCandidate?.candidateType)
            selectedCandidateTypes.push(remoteCandidate.candidateType);
        }
        if (report.type === 'inbound-rtp') {
          const received = report.packetsReceived ?? 0;
          const lost = report.packetsLost ?? 0;
          const total = received + Math.max(0, lost);
          const loss = total ? Math.max(0, lost) / total : 0;
          const jitter = report.jitter ?? 0;
          maximumLoss = Math.max(maximumLoss, loss);
          maximumJitter = Math.max(maximumJitter, jitter);
          if (loss >= 0.08 || jitter >= 0.08) severity = 2;
          else if (loss >= 0.03 || jitter >= 0.04) severity = Math.max(1, severity);
        }
      });
    }
    if (!isCurrentMeasurement()) return;
    setQuality(severity === 2 ? 'POOR' : severity === 1 ? 'FAIR' : 'GOOD');
    setQualityMetrics({
      roundTripMs: Math.round(maximumRoundTrip * 1_000),
      jitterMs: Math.round(maximumJitter * 1_000),
      packetLossPercent: Math.round(maximumLoss * 1_000) / 10,
    });
    const selectedTransport = classifyVoiceTransport(selectedCandidateTypes);
    if (
      selectedTransport === 'DIRECT' &&
      rtcConfigurationRef.current.iceTransportPolicy === 'relay'
    ) {
      reportDiagnostic({ event: 'PRIVACY_POLICY_VIOLATION' });
      disconnect();
      setError(messages.voicePrivacyUnavailable);
      return;
    }
    selectedCandidateTypeRef.current = selectedCandidateTypes.includes('relay')
      ? 'relay'
      : (selectedCandidateTypes[0] ?? null);
    setTransport(selectedTransport);
  }

  function startQualityMonitoring() {
    if (qualityTimerRef.current !== null) window.clearInterval(qualityTimerRef.current);
    void measureConnectionQuality();
    qualityTimerRef.current = window.setInterval(() => void measureConnectionQuality(), 5_000);
  }

  async function loadIceConfiguration(): Promise<RTCConfiguration | null> {
    try {
      const configuration = await apiRequest<VoiceIceConfiguration>('/voice/ice-servers');
      if (!isPrivateVoiceConfiguration(configuration)) return null;
      return {
        iceServers: configuration.iceServers.map((server) => ({
          urls: server.urls,
          ...(server.username ? { username: server.username } : {}),
          ...(server.credential ? { credential: server.credential } : {}),
        })),
        iceTransportPolicy: 'relay',
      };
    } catch {
      return null;
    }
  }

  async function restartPeer(connectionId: string) {
    const connection = peersRef.current.get(connectionId);
    if (!connection) return;
    const connectTimer = peerConnectTimersRef.current.get(connectionId);
    if (connectTimer !== undefined) window.clearTimeout(connectTimer);
    peerConnectTimersRef.current.delete(connectionId);
    const peerEpoch = peerEpochRef.current;
    const isCurrentPeer = () =>
      joinedRef.current &&
      peerEpoch === peerEpochRef.current &&
      peersRef.current.get(connectionId) === connection;
    const attempts = restartAttemptsRef.current.get(connectionId) ?? 0;
    if (attempts >= 1) {
      setPeerRecovering(connectionId, false);
      reportDiagnostic({
        event: 'ICE_RESTART_FAILED',
        connectionState: connection.connectionState,
        iceConnectionState: connection.iceConnectionState,
      });
      setError(messages.voiceConnectionFailed);
      return;
    }
    restartAttemptsRef.current.set(connectionId, attempts + 1);
    setPeerRecovering(connectionId, true);
    try {
      const refreshed = await loadIceConfiguration();
      if (!isCurrentPeer()) return;
      if (refreshed) {
        rtcConfigurationRef.current = refreshed;
        connection.setConfiguration(refreshed);
      } else {
        reportDiagnostic({ event: 'ICE_CONFIGURATION_FAILED' });
      }
      connection.restartIce();
      await createAndSendOffer(connectionId, { iceRestart: true });
      if (isCurrentPeer()) armPeerConnectTimeout(connectionId, connection, peerEpoch);
    } catch {
      if (!isCurrentPeer()) return;
      setPeerRecovering(connectionId, false);
      reportDiagnostic({
        event: 'ICE_RESTART_FAILED',
        connectionState: connection.connectionState,
        iceConnectionState: connection.iceConnectionState,
      });
      setError(messages.voiceConnectionFailed);
    }
  }

  function negotiationState(connectionId: string): PeerNegotiationState {
    const existing = peerNegotiationRef.current.get(connectionId);
    if (existing) return existing;
    const created = { makingOffer: false, ignoreOffer: false, settingRemoteAnswer: false };
    peerNegotiationRef.current.set(connectionId, created);
    return created;
  }

  function isPolitePeer(connectionId: string): boolean {
    const selfConnectionId = selfConnectionIdRef.current;
    return !selfConnectionId || selfConnectionId.localeCompare(connectionId) > 0;
  }

  function emitSignal(
    connectionId: string,
    signal: Omit<VoiceSignal, 'targetConnectionId'>,
    socket: Socket | null = socketRef.current,
    generation = connectionGenerationRef.current,
  ) {
    if (
      !socket ||
      !socket.connected ||
      !joinedRef.current ||
      socket !== socketRef.current ||
      generation !== connectionGenerationRef.current
    )
      return;
    socket.emit('voice:signal', { targetConnectionId: connectionId, ...signal });
  }

  function peer(connectionId: string): RTCPeerConnection {
    const current = peersRef.current.get(connectionId);
    if (current) return current;
    const peerSocket = socketRef.current;
    const peerGeneration = connectionGenerationRef.current;
    const peerEpoch = peerEpochRef.current;
    const connection = new RTCPeerConnection(rtcConfigurationRef.current);
    const isCurrentPeer = () =>
      peerGeneration === connectionGenerationRef.current &&
      peerEpoch === peerEpochRef.current &&
      peerSocket === socketRef.current &&
      peersRef.current.get(connectionId) === connection;
    const localTracks = localStreamRef.current?.getTracks() ?? [];
    for (const track of localTracks) {
      const sender = connection.addTrack(track, localStreamRef.current!);
      if (track.kind === 'audio')
        void applyAudioBitrate(sender, activeChannelRef.current?.bitrateKbps ?? 64).catch(
          () => undefined,
        );
      if (track.kind === 'video') videoSendersRef.current.set(connectionId, sender);
    }
    // CONNECT without SPEAK is a supported listen-only state. An explicit
    // recvonly transceiver keeps audio in the SDP even when there is no mic track.
    if (!localTracks.some((track) => track.kind === 'audio'))
      connection.addTransceiver('audio', { direction: 'recvonly' });
    connection.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      const serialized = candidate.toJSON();
      if (serialized.candidate === undefined) return;
      emitSignal(
        connectionId,
        { candidate: { ...serialized, candidate: serialized.candidate } },
        peerSocket,
        peerGeneration,
      );
    };
    connection.ontrack = ({ streams }) => {
      if (!isCurrentPeer()) return;
      const stream = streams[0];
      if (stream) {
        setRemoteStreams((currentStreams) => ({ ...currentStreams, [connectionId]: stream }));
        attachAudioMeter(connectionId, stream);
      }
    };
    connection.onconnectionstatechange = () => {
      if (!isCurrentPeer()) return;
      if (connection.connectionState === 'closed') closePeer(connectionId, connection);
      if (connection.connectionState === 'failed') {
        reportDiagnostic({
          event: 'PEER_CONNECTION_FAILED',
          connectionState: connection.connectionState,
          iceConnectionState: connection.iceConnectionState,
        });
      }
      void measureConnectionQuality();
    };
    connection.oniceconnectionstatechange = () => {
      if (!isCurrentPeer()) return;
      const state = connection.iceConnectionState;
      if (state === 'connected' || state === 'completed') {
        const peerConnectTimer = peerConnectTimersRef.current.get(connectionId);
        if (peerConnectTimer !== undefined) window.clearTimeout(peerConnectTimer);
        peerConnectTimersRef.current.delete(connectionId);
        const reconnectTimer = reconnectTimersRef.current.get(connectionId);
        if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
        reconnectTimersRef.current.delete(connectionId);
        restartAttemptsRef.current.delete(connectionId);
        setPeerRecovering(connectionId, false);
        setError((current) => (current === messages.voiceConnectionFailed ? '' : current));
      } else if (state === 'disconnected' && !reconnectTimersRef.current.has(connectionId)) {
        setPeerRecovering(connectionId, true);
        reconnectTimersRef.current.set(
          connectionId,
          window.setTimeout(() => {
            reconnectTimersRef.current.delete(connectionId);
            if (
              peersRef.current.get(connectionId) === connection &&
              connection.iceConnectionState === 'disconnected'
            )
              void restartPeer(connectionId);
          }, 3_000),
        );
      } else if (state === 'failed') {
        const reconnectTimer = reconnectTimersRef.current.get(connectionId);
        if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
        reconnectTimersRef.current.delete(connectionId);
        setPeerRecovering(connectionId, true);
        void restartPeer(connectionId);
      }
      void measureConnectionQuality();
    };
    peersRef.current.set(connectionId, connection);
    setQuality('CONNECTING');
    armPeerConnectTimeout(connectionId, connection, peerEpoch);
    return connection;
  }

  async function createAndSendOffer(
    connectionId: string,
    options?: RTCOfferOptions,
  ): Promise<void> {
    const connection = peer(connectionId);
    const state = negotiationState(connectionId);
    const peerEpoch = peerEpochRef.current;
    const isCurrentPeer = () =>
      joinedRef.current &&
      peerEpoch === peerEpochRef.current &&
      peersRef.current.get(connectionId) === connection;
    if (connection.signalingState === 'closed') return;
    if (connection.signalingState !== 'stable' || state.makingOffer) {
      if (!negotiationTimersRef.current.has(connectionId)) {
        negotiationTimersRef.current.set(
          connectionId,
          window.setTimeout(() => {
            negotiationTimersRef.current.delete(connectionId);
            if (isCurrentPeer())
              void createAndSendOffer(connectionId, options).catch((error: unknown) =>
                handleSignalingFailure(connectionId, error),
              );
          }, 250),
        );
      }
      return;
    }
    state.makingOffer = true;
    try {
      const description = await connection.createOffer(options);
      if (!isCurrentPeer()) return;
      await connection.setLocalDescription(description);
      if (!isCurrentPeer()) return;
      const localDescription = connection.localDescription;
      if (localDescription) emitSignal(connectionId, { description: localDescription.toJSON() });
    } catch (error) {
      if (!isCurrentPeer()) return;
      throw error;
    } finally {
      state.makingOffer = false;
    }
  }

  async function offer(participant: VoiceParticipant) {
    updateParticipant(participant);
    peer(participant.connectionId);
    await createAndSendOffer(participant.connectionId);
  }

  async function handleSignal(signal: IncomingSignal) {
    const connection = peer(signal.fromConnectionId);
    const state = negotiationState(signal.fromConnectionId);
    const peerEpoch = peerEpochRef.current;
    const isCurrentPeer = () =>
      joinedRef.current &&
      peerEpoch === peerEpochRef.current &&
      peersRef.current.get(signal.fromConnectionId) === connection;
    if (signal.description) {
      if (
        signal.description.type === 'answer' &&
        !['have-local-offer', 'have-local-pranswer'].includes(connection.signalingState)
      )
        return;
      const readyForOffer =
        !state.makingOffer && (connection.signalingState === 'stable' || state.settingRemoteAnswer);
      const offerCollision = signal.description.type === 'offer' && !readyForOffer;
      state.ignoreOffer = !isPolitePeer(signal.fromConnectionId) && offerCollision;
      if (state.ignoreOffer) {
        pendingCandidatesRef.current.delete(signal.fromConnectionId);
        return;
      }
      state.settingRemoteAnswer = signal.description.type === 'answer';
      try {
        if (offerCollision && connection.signalingState !== 'stable')
          await connection.setLocalDescription({ type: 'rollback' });
        if (!isCurrentPeer()) return;
        await connection.setRemoteDescription(signal.description as RTCSessionDescriptionInit);
        if (!isCurrentPeer()) return;
      } finally {
        state.settingRemoteAnswer = false;
      }
      for (const candidate of pendingCandidatesRef.current.get(signal.fromConnectionId) ?? []) {
        if (!isCurrentPeer()) return;
        if (!iceCandidateMatchesRemoteDescription(candidate, connection.remoteDescription?.sdp))
          continue;
        try {
          await connection.addIceCandidate(candidate);
          if (!isCurrentPeer()) return;
        } catch {
          // A late candidate from a previous ICE generation is harmless.
          continue;
        }
      }
      pendingCandidatesRef.current.delete(signal.fromConnectionId);
      if (signal.description.type === 'offer') {
        const answer = await connection.createAnswer();
        if (!isCurrentPeer()) return;
        await connection.setLocalDescription(answer);
        if (!isCurrentPeer()) return;
        const localDescription = connection.localDescription;
        if (localDescription)
          emitSignal(signal.fromConnectionId, { description: localDescription.toJSON() });
      }
    }
    if (signal.candidate) {
      if (state.ignoreOffer) return;
      const candidate = toIceCandidate(signal.candidate);
      if (connection.remoteDescription) {
        if (!iceCandidateMatchesRemoteDescription(candidate, connection.remoteDescription.sdp))
          return;
        try {
          await connection.addIceCandidate(candidate);
          if (!isCurrentPeer()) return;
        } catch {
          return;
        }
      } else {
        pendingCandidatesRef.current.set(signal.fromConnectionId, [
          ...(pendingCandidatesRef.current.get(signal.fromConnectionId) ?? []),
          candidate,
        ]);
      }
    }
  }

  function queueSignal(signal: IncomingSignal) {
    const connectionId = signal.fromConnectionId;
    const signalSocket = socketRef.current;
    const signalGeneration = connectionGenerationRef.current;
    const signalPeerEpoch = peerEpochRef.current;
    const isCurrentSignal = () =>
      signalGeneration === connectionGenerationRef.current &&
      signalPeerEpoch === peerEpochRef.current &&
      signalSocket === socketRef.current &&
      joinedRef.current;
    const previous = signalQueuesRef.current.get(connectionId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => {
        if (isCurrentSignal()) return handleSignal(signal);
      })
      .catch((error: unknown) => {
        if (isCurrentSignal()) handleSignalingFailure(connectionId, error);
      });
    signalQueuesRef.current.set(connectionId, next);
    void next.finally(() => {
      if (signalQueuesRef.current.get(connectionId) === next)
        signalQueuesRef.current.delete(connectionId);
    });
  }

  function handleSignalingFailure(connectionId: string, error?: unknown) {
    const connection = peersRef.current.get(connectionId);
    const errorName = error instanceof Error ? error.name : undefined;
    reportDiagnostic({
      event: 'SIGNALING_FAILED',
      ...(connection
        ? {
            connectionState: connection.connectionState,
            iceConnectionState: connection.iceConnectionState,
            signalingState: connection.signalingState,
          }
        : {}),
      ...(errorName && /^[A-Za-z][A-Za-z0-9]*$/.test(errorName) ? { errorName } : {}),
    });
    if (!connection) {
      if (!joinedRef.current) return;
      disconnect();
      setError(messages.voiceConnectionFailed);
      return;
    }
    if (connection.signalingState === 'closed') return;
    setPeerRecovering(connectionId, true);
    void restartPeer(connectionId);
  }

  function disconnect(clearResume = true) {
    connectionGenerationRef.current += 1;
    connectingRef.current = false;
    joinedRef.current = false;
    clearSocketFailureTimer();
    socketRef.current?.emit('voice:leave');
    socketRef.current?.removeAllListeners();
    socketRef.current?.disconnect();
    socketRef.current = null;
    for (const track of localStreamRef.current?.getTracks() ?? []) track.stop();
    microphonePipelineRef.current?.close();
    microphonePipelineRef.current = null;
    localStreamRef.current = null;
    localVideoTrackRef.current = null;
    resetPeerConnections();
    selectedCandidateTypeRef.current = null;
    if (speakingTimerRef.current !== null) window.clearInterval(speakingTimerRef.current);
    if (qualityTimerRef.current !== null) window.clearInterval(qualityTimerRef.current);
    speakingTimerRef.current = null;
    qualityTimerRef.current = null;
    for (const connectionId of [...audioMetersRef.current.keys()]) removeAudioMeter(connectionId);
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    activeChannelRef.current = null;
    selfConnectionIdRef.current = null;
    videoModeRef.current = null;
    videoPausedRef.current = false;
    setActiveChannel(null);
    setRemoteStreams({});
    setLocalVideoStream(null);
    setVideoMode(null);
    setVideoPaused(false);
    setSelfConnectionId(null);
    setFocusedConnectionId(null);
    setMiniPlayerOpen(true);
    setParticipants([]);
    setJoined(false);
    setJoining(false);
    setSpeakingConnectionIds([]);
    setQuality('CONNECTING');
    setQualityMetrics({ roundTripMs: null, jitterMs: null, packetLossPercent: null });
    setTransport('CHECKING');
    setSpeechEnhancementActive(false);
    setReconnecting(false);
    if (clearResume && typeof window !== 'undefined')
      window.sessionStorage.removeItem('wapve:voice-resume');
  }

  disconnectRef.current = disconnect;

  function scheduleSocketFailure(generation: number) {
    if (socketFailureTimerRef.current !== null) return;
    socketFailureTimerRef.current = window.setTimeout(() => {
      socketFailureTimerRef.current = null;
      if (generation !== connectionGenerationRef.current || joinedRef.current) return;
      disconnect();
      setError(messages.voiceConnectionFailed);
    }, VOICE_RECONNECT_TIMEOUT_MS);
  }

  function handleSocketInterruption(socket: Socket, generation: number) {
    if (
      generation !== connectionGenerationRef.current ||
      socket !== socketRef.current ||
      !activeChannelRef.current
    )
      return;
    connectingRef.current = true;
    joinedRef.current = false;
    setJoined(false);
    setJoining(true);
    resetPeerConnections();
    setReconnecting(true);
    scheduleSocketFailure(generation);
  }

  async function connect(channel: ServerChannel) {
    if (!emailVerified || !channel.permissions.CONNECT) return;
    if (activeChannelRef.current?.id === channel.id && (connectingRef.current || joinedRef.current))
      return;
    disconnect();
    const generation = ++connectionGenerationRef.current;
    activeChannelRef.current = channel;
    window.sessionStorage.removeItem('wapve:voice-resume');
    connectingRef.current = true;
    setActiveChannel(channel);
    setJoining(true);
    setError('');
    setTransport('CHECKING');
    rtcConfigurationRef.current = { iceServers: [], iceTransportPolicy: 'relay' };
    try {
      const rtcConfiguration = await loadIceConfiguration();
      if (generation !== connectionGenerationRef.current) return;
      if (!rtcConfiguration) {
        reportDiagnostic({ event: 'ICE_CONFIGURATION_FAILED' });
        disconnect();
        setError(messages.voicePrivacyUnavailable);
        return;
      }
      try {
        const configurationProbe = new RTCPeerConnection(rtcConfiguration);
        configurationProbe.close();
      } catch (configurationError) {
        const errorName = configurationError instanceof Error ? configurationError.name : undefined;
        reportDiagnostic({
          event: 'ICE_CONFIGURATION_FAILED',
          ...(errorName && /^[A-Za-z][A-Za-z0-9]*$/.test(errorName) ? { errorName } : {}),
        });
        disconnect();
        setError(messages.voicePrivacyUnavailable);
        return;
      }
      rtcConfigurationRef.current = rtcConfiguration;
      if (channel.permissions.SPEAK) {
        const rawStream = await navigator.mediaDevices.getUserMedia({
          audio: voiceAudioConstraints(audioInputDeviceId, {
            echoCancellation,
            noiseSuppression,
            autoGainControl,
          }),
          video: false,
        });
        const microphonePipeline = await enhanceSpeechStream(rawStream, noiseSuppression);
        if (generation !== connectionGenerationRef.current) {
          microphonePipeline.close();
          return;
        }
        const localStream = microphonePipeline.stream;
        if (pushToTalk || mutedRef.current || deafenedRef.current) {
          for (const track of localStream.getAudioTracks()) track.enabled = false;
          if (pushToTalk) {
            mutedRef.current = true;
            setMuted(true);
          }
        }
        for (const track of localStream.getAudioTracks()) prepareSpeechTrack(track);
        microphonePipelineRef.current = microphonePipeline;
        setSpeechEnhancementActive(microphonePipeline.enhanced);
        localStreamRef.current = localStream;
      }
      if (generation !== connectionGenerationRef.current) return;
      const socket = io(`${SOCKET_URL}/voice`, {
        withCredentials: true,
        autoConnect: false,
      });
      socketRef.current = socket;
      const isCurrent = () =>
        generation === connectionGenerationRef.current && socketRef.current === socket;
      let pendingPeerSnapshot: VoiceParticipant[] | null = null;
      const applyPeerSnapshot = (peers: VoiceParticipant[]) => {
        if (!isCurrent() || !joinedRef.current) return;
        setParticipants((current) => {
          const self = current.find(
            (participant) => participant.connectionId === selfConnectionIdRef.current,
          );
          return self ? [self, ...peers] : peers;
        });
        for (const participant of peers)
          void offer(participant).catch((error: unknown) =>
            handleSignalingFailure(participant.connectionId, error),
          );
      };
      socket.on('voice:ready', () => {
        if (!isCurrent()) return;
        socket.emit('voice:join', { channelId: channel.id });
        scheduleSocketFailure(generation);
      });
      socket.on('voice:joined', (participant: VoiceParticipant) => {
        if (!isCurrent()) return;
        clearSocketFailureTimer();
        updateParticipant(participant);
        selfConnectionIdRef.current = participant.connectionId;
        setSelfConnectionId(participant.connectionId);
        const nextDeafened = deafenedRef.current;
        const nextMuted = participant.muted || mutedRef.current || nextDeafened;
        mutedRef.current = nextMuted;
        setMuted(nextMuted);
        for (const track of localStreamRef.current?.getAudioTracks() ?? [])
          track.enabled = !nextMuted && !nextDeafened && participant.canSpeak;
        if (localStreamRef.current)
          attachAudioMeter(participant.connectionId, localStreamRef.current);
        connectingRef.current = false;
        joinedRef.current = true;
        window.sessionStorage.setItem(
          'wapve:voice-resume',
          JSON.stringify({ serverId: channel.serverId, channelId: channel.id, at: Date.now() }),
        );
        setJoined(true);
        setJoining(false);
        setReconnecting(false);
        setError('');
        socket.emit('voice:state', {
          muted: nextMuted,
          deafened: nextDeafened,
          videoMode: videoModeRef.current,
          videoPaused: videoPausedRef.current,
        });
        startQualityMonitoring();
        if (pendingPeerSnapshot) {
          const peers = pendingPeerSnapshot;
          pendingPeerSnapshot = null;
          applyPeerSnapshot(peers);
        }
      });
      socket.on('voice:channel-config', (configuration: VoiceChannelConfig) => {
        if (!isCurrent() || configuration.channelId !== activeChannelRef.current?.id) return;
        const currentChannel = activeChannelRef.current;
        const nextChannel = {
          ...currentChannel,
          userLimit: configuration.userLimit,
          bitrateKbps: configuration.bitrateKbps,
        };
        activeChannelRef.current = nextChannel;
        setActiveChannel(nextChannel);
        for (const connection of peersRef.current.values())
          for (const sender of connection.getSenders())
            void applyAudioBitrate(sender, configuration.bitrateKbps).catch(() => undefined);
      });
      socket.on('voice:peers', (peers: VoiceParticipant[]) => {
        if (!isCurrent()) return;
        if (!joinedRef.current) {
          pendingPeerSnapshot = peers;
          return;
        }
        applyPeerSnapshot(peers);
      });
      socket.on('voice:peer-joined', (participant: VoiceParticipant) => {
        if (isCurrent()) updateParticipant(participant);
      });
      socket.on('voice:participant-updated', (participant: VoiceParticipant) => {
        if (!isCurrent()) return;
        updateParticipant(participant);
        if (participant.connectionId !== selfConnectionIdRef.current) return;
        const nextMuted = participant.muted || !participant.canSpeak || deafenedRef.current;
        mutedRef.current = nextMuted;
        setMuted(nextMuted);
        for (const track of localStreamRef.current?.getAudioTracks() ?? [])
          track.enabled = !nextMuted && participant.canSpeak;
      });
      socket.on(
        'voice:soundboard',
        (event: { soundId: string; audioUrl: string; volume: number }) => {
          if (!isCurrent() || !joinedRef.current) return;
          playSoundAudio(event.audioUrl, event.volume);
        },
      );
      socket.on('voice:peer-left', ({ connectionId }: { connectionId: string }) => {
        if (!isCurrent()) return;
        closePeer(connectionId);
        setParticipants((current) =>
          current.filter((participant) => participant.connectionId !== connectionId),
        );
      });
      socket.on('voice:disconnected', () => {
        disconnect();
      });
      socket.on('voice:server-muted', ({ muted }: { muted: boolean }) => {
        if (muted) {
          mutedRef.current = true;
          setMuted(true);
          for (const track of localStreamRef.current?.getAudioTracks() ?? []) track.enabled = false;
        }
      });
      socket.on('voice:server-deafened', ({ deafened }: { deafened: boolean }) => {
        if (deafened) {
          deafenedRef.current = true;
          setDeafened(true);
          mutedRef.current = true;
          setMuted(true);
          for (const track of localStreamRef.current?.getAudioTracks() ?? []) track.enabled = false;
        }
      });
      socket.on('voice:signal', (signal: IncomingSignal) => {
        if (isCurrent() && joinedRef.current) queueSignal(signal);
      });
      socket.on('voice:error', ({ code }: { code: string }) => {
        if (!isCurrent()) return;
        if (['INVALID_VOICE_SIGNAL', 'VOICE_NOT_CONNECTED', 'INVALID_VOICE_STATE'].includes(code))
          return;
        disconnect();
        setError(
          code === 'VOICE_CHANNEL_FULL'
            ? messages.voiceChannelFull
            : messages.voiceConnectionFailed,
        );
      });
      socket.on('connect_error', () => {
        if (!isCurrent()) return;
        reportDiagnostic({ event: 'SOCKET_CONNECTION_FAILED' });
        handleSocketInterruption(socket, generation);
      });
      socket.on('disconnect', () => handleSocketInterruption(socket, generation));
      socket.connect();
    } catch {
      if (generation !== connectionGenerationRef.current) return;
      disconnect();
      setError(messages.microphonePermissionError);
    }
  }

  async function runDoctor(): Promise<VoiceDoctorCheck[]> {
    const checks: VoiceDoctorCheck[] = [];
    checks.push({
      key: 'secure',
      status: window.isSecureContext ? 'PASS' : 'FAIL',
      detail: window.isSecureContext ? 'secure-context' : 'insecure-context',
    });

    let diagnosticStream: MediaStream | null = null;
    try {
      diagnosticStream = await navigator.mediaDevices.getUserMedia({
        audio: voiceAudioConstraints(audioInputDeviceId, {
          echoCancellation,
          noiseSuppression,
          autoGainControl,
        }),
        video: false,
      });
      checks.push({ key: 'microphone', status: 'PASS', detail: 'capture-ok' });
      const enhanced = await enhanceSpeechStream(diagnosticStream, noiseSuppression);
      checks.push({
        key: 'processing',
        status: !noiseSuppression || enhanced.enhanced ? 'PASS' : 'WARN',
        detail: enhanced.enhanced ? 'gtcrn-active' : 'browser-processing',
      });
      enhanced.close();
      diagnosticStream = null;
    } catch (caught) {
      for (const track of diagnosticStream?.getTracks() ?? []) track.stop();
      checks.push({
        key: 'microphone',
        status: 'FAIL',
        detail: caught instanceof Error ? caught.name : 'capture-failed',
      });
      checks.push({ key: 'processing', status: 'WARN', detail: 'not-tested' });
    }

    const signaling = await new Promise<VoiceDoctorCheck>((resolve) => {
      const socket = io(`${SOCKET_URL}/voice`, {
        withCredentials: true,
        autoConnect: false,
        reconnection: false,
        timeout: 6_000,
      });
      let settled = false;
      const finish = (check: VoiceDoctorCheck) => {
        if (settled) return;
        settled = true;
        socket.removeAllListeners();
        socket.disconnect();
        resolve(check);
      };
      socket.on('voice:ready', () => finish({ key: 'signaling', status: 'PASS', detail: 'ready' }));
      socket.on('connect_error', (error) =>
        finish({ key: 'signaling', status: 'FAIL', detail: error.name || 'connect-error' }),
      );
      window.setTimeout(
        () => finish({ key: 'signaling', status: 'FAIL', detail: 'timeout' }),
        6_500,
      );
      socket.connect();
    });
    checks.push(signaling);

    try {
      const configuration = await apiRequest<VoiceIceConfiguration>('/voice/ice-servers');
      const privateConfiguration = isPrivateVoiceConfiguration(configuration);
      if (!privateConfiguration) throw new Error('invalid-configuration');
      const relayFound = await new Promise<boolean>((resolve) => {
        const peer = new RTCPeerConnection({
          iceServers: configuration.iceServers.map((server) => ({
            urls: server.urls,
            ...(server.username ? { username: server.username } : {}),
            ...(server.credential ? { credential: server.credential } : {}),
          })),
          iceTransportPolicy: 'relay',
        });
        let settled = false;
        const finish = (value: boolean) => {
          if (settled) return;
          settled = true;
          peer.close();
          resolve(value);
        };
        peer.onicecandidate = (event) => {
          if (event.candidate?.candidate.includes(' typ relay ')) finish(true);
          else if (!event.candidate) finish(false);
        };
        peer.createDataChannel('doctor');
        void (async () => {
          try {
            await peer.setLocalDescription(await peer.createOffer());
          } catch {
            finish(false);
          }
        })();
        window.setTimeout(() => finish(false), 8_000);
      });
      checks.push({
        key: 'turn',
        status: relayFound ? 'PASS' : 'FAIL',
        detail: relayFound ? 'relay-candidate' : 'no-relay-candidate',
      });
    } catch (caught) {
      checks.push({
        key: 'turn',
        status: 'FAIL',
        detail: caught instanceof Error ? caught.message : 'configuration-failed',
      });
    }
    return checks;
  }

  function toggleMuted() {
    const channel = activeChannelRef.current;
    if (deafenedRef.current || (channel && !channel.permissions.SPEAK)) return;
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next && selfConnectionIdRef.current) {
      setSpeakingConnectionIds((current) =>
        current.filter((id) => id !== selfConnectionIdRef.current),
      );
    }
    for (const track of localStreamRef.current?.getAudioTracks() ?? []) track.enabled = !next;
    emitVoiceState({
      muted: next,
      deafened: deafenedRef.current,
      videoMode: videoModeRef.current,
      videoPaused: videoPausedRef.current,
    });
  }

  function toggleDeafened() {
    const next = !deafenedRef.current;
    deafenedRef.current = next;
    setDeafened(next);
    if (next) {
      mutedBeforeDeafenRef.current = mutedRef.current;
      mutedRef.current = true;
      setMuted(true);
      for (const track of localStreamRef.current?.getAudioTracks() ?? []) track.enabled = false;
    } else {
      const restoredMuted = mutedBeforeDeafenRef.current;
      mutedRef.current = restoredMuted;
      setMuted(restoredMuted);
      for (const track of localStreamRef.current?.getAudioTracks() ?? [])
        track.enabled = !restoredMuted;
    }
    emitVoiceState({
      muted: next ? true : mutedBeforeDeafenRef.current,
      deafened: next,
      videoMode: videoModeRef.current,
      videoPaused: videoPausedRef.current,
    });
  }

  async function selectAudioInputDevice(
    deviceId: string,
    preferences: AudioProcessingPreferences = {
      echoCancellation,
      noiseSuppression,
      autoGainControl,
    },
  ) {
    setAudioInputDeviceId(deviceId);
    window.localStorage.setItem(AUDIO_INPUT_STORAGE_KEY, deviceId);
    if (!joinedRef.current || !activeChannelRef.current?.permissions.SPEAK) return;
    const sessionGeneration = connectionGenerationRef.current;
    const channelId = activeChannelRef.current.id;
    try {
      const rawReplacement = await navigator.mediaDevices.getUserMedia({
        audio: voiceAudioConstraints(deviceId, preferences),
        video: false,
      });
      const replacementPipeline = await enhanceSpeechStream(
        rawReplacement,
        preferences.noiseSuppression,
      );
      if (
        sessionGeneration !== connectionGenerationRef.current ||
        !joinedRef.current ||
        activeChannelRef.current?.id !== channelId
      ) {
        replacementPipeline.close();
        return;
      }
      const replacement = replacementPipeline.stream;
      const nextTrack = replacement.getAudioTracks()[0];
      if (!nextTrack) {
        replacementPipeline.close();
        return;
      }
      prepareSpeechTrack(nextTrack);
      nextTrack.enabled = !mutedRef.current && !deafenedRef.current;
      const stream = localStreamRef.current ?? new MediaStream();
      const previous = stream.getAudioTracks()[0];
      if (previous) stream.removeTrack(previous);
      stream.addTrack(nextTrack);
      localStreamRef.current = stream;
      const peerEpoch = peerEpochRef.current;
      await Promise.all(
        [...peersRef.current.entries()].map(async ([connectionId, connection]) => {
          const sender = connection.getSenders().find((item) => item.track?.kind === 'audio');
          try {
            if (sender) await sender.replaceTrack(nextTrack);
            else connection.addTrack(nextTrack, stream);
          } catch (error) {
            if (
              peerEpoch === peerEpochRef.current &&
              peersRef.current.get(connectionId) === connection
            )
              handleSignalingFailure(connectionId, error);
          }
        }),
      );
      if (sessionGeneration !== connectionGenerationRef.current) return;
      if (selfConnectionIdRef.current) {
        removeAudioMeter(selfConnectionIdRef.current);
        attachAudioMeter(selfConnectionIdRef.current, stream);
      }
      const previousPipeline = microphonePipelineRef.current;
      microphonePipelineRef.current = replacementPipeline;
      setSpeechEnhancementActive(replacementPipeline.enhanced);
      previous?.stop();
      previousPipeline?.close();
    } catch {
      if (sessionGeneration === connectionGenerationRef.current)
        setError(messages.microphonePermissionError);
    }
  }

  function selectAudioOutputDevice(deviceId: string) {
    setAudioOutputDeviceId(deviceId);
    window.localStorage.setItem(AUDIO_OUTPUT_STORAGE_KEY, deviceId);
  }

  function setAudioOutputVolume(value: number) {
    const next = Math.max(0, Math.min(1, value));
    setAudioOutputVolumeState(next);
    window.localStorage.setItem(AUDIO_OUTPUT_VOLUME_STORAGE_KEY, String(next));
  }

  function setParticipantVolume(userId: string, value: number) {
    const volume = Math.max(0, Math.min(1, value));
    setParticipantVolumes((current) => {
      const next = { ...current, [userId]: volume };
      window.localStorage.setItem(PARTICIPANT_VOLUME_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function setPushToTalk(value: boolean) {
    setPushToTalkState(value);
    window.localStorage.setItem(PUSH_TO_TALK_STORAGE_KEY, String(value));
    if (!value && joinedRef.current && !deafened) {
      for (const track of localStreamRef.current?.getAudioTracks() ?? []) track.enabled = true;
      mutedRef.current = false;
      setMuted(false);
      emitVoiceState({ muted: false, deafened, videoMode, videoPaused });
    }
  }

  function setPushToTalkKey(value: string) {
    setPushToTalkKeyState(value);
    window.localStorage.setItem(PUSH_TO_TALK_KEY_STORAGE_KEY, value);
  }

  async function applyAudioProcessing(preferences: AudioProcessingPreferences) {
    const track = microphonePipelineRef.current?.rawStream.getAudioTracks()[0];
    if (!track || track.readyState !== 'live') return;
    try {
      await track.applyConstraints(voiceAudioConstraints(audioInputDeviceId, preferences));
      prepareSpeechTrack(track);
    } catch {
      setError(messages.audioProcessingUpdateFailed);
    }
  }

  function setEchoCancellation(value: boolean) {
    setEchoCancellationState(value);
    window.localStorage.setItem(ECHO_CANCELLATION_STORAGE_KEY, String(value));
    void applyAudioProcessing({ echoCancellation: value, noiseSuppression, autoGainControl });
  }

  function setNoiseSuppression(value: boolean) {
    setNoiseSuppressionState(value);
    window.localStorage.setItem(NOISE_SUPPRESSION_STORAGE_KEY, String(value));
    const preferences = { echoCancellation, noiseSuppression: value, autoGainControl };
    if (joinedRef.current && activeChannelRef.current?.permissions.SPEAK)
      void selectAudioInputDevice(audioInputDeviceId, preferences);
    else void applyAudioProcessing(preferences);
  }

  function setAutoGainControl(value: boolean) {
    setAutoGainControlState(value);
    window.localStorage.setItem(AUTO_GAIN_STORAGE_KEY, String(value));
    void applyAudioProcessing({ echoCancellation, noiseSuppression, autoGainControl: value });
  }

  function setShortcut(action: VoiceShortcutAction, binding: VoiceShortcutBinding | null) {
    setShortcuts((current) => {
      const bindingId = voiceShortcutId(binding);
      const next = Object.fromEntries(
        voiceShortcutActions.map((candidate) => [
          candidate,
          candidate !== action && voiceShortcutId(current[candidate]) === bindingId && bindingId
            ? null
            : current[candidate],
        ]),
      ) as typeof current;
      next[action] = binding;
      window.localStorage.setItem(VOICE_SHORTCUTS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function resetShortcuts() {
    const next = { ...defaultVoiceShortcuts };
    setShortcuts(next);
    window.localStorage.setItem(VOICE_SHORTCUTS_STORAGE_KEY, JSON.stringify(next));
  }

  async function publishVideo(
    track: MediaStreamTrack,
    mode: 'camera' | 'screen',
    sessionGeneration: number,
  ) {
    if (sessionGeneration !== connectionGenerationRef.current || !joinedRef.current) {
      track.stop();
      return;
    }
    const previous = localVideoTrackRef.current;
    if (previous) {
      previous.onended = null;
      previous.stop();
      localStreamRef.current?.removeTrack(previous);
    }
    const stream = localStreamRef.current ?? new MediaStream();
    localStreamRef.current = stream;
    stream.addTrack(track);
    localVideoTrackRef.current = track;
    track.enabled = true;
    if ('contentHint' in track) track.contentHint = mode === 'screen' ? 'detail' : 'motion';
    setLocalVideoStream(new MediaStream([track]));
    videoModeRef.current = mode;
    setVideoMode(mode);
    videoPausedRef.current = false;
    setVideoPaused(false);
    setMiniPlayerOpen(true);
    let needsNegotiation = false;
    const peerEpoch = peerEpochRef.current;
    await Promise.all(
      [...peersRef.current.entries()].map(async ([connectionId, connection]) => {
        const sender = videoSendersRef.current.get(connectionId);
        try {
          if (sender) await sender.replaceTrack(track);
          else {
            videoSendersRef.current.set(connectionId, connection.addTrack(track, stream));
            needsNegotiation = true;
          }
        } catch (error) {
          if (
            peerEpoch === peerEpochRef.current &&
            peersRef.current.get(connectionId) === connection
          )
            handleSignalingFailure(connectionId, error);
        }
      }),
    );
    if (
      sessionGeneration !== connectionGenerationRef.current ||
      localVideoTrackRef.current !== track
    )
      return;
    if (mode === 'screen')
      track.onended = () => {
        if (
          sessionGeneration === connectionGenerationRef.current &&
          localVideoTrackRef.current === track
        )
          stopVideo();
      };
    emitVoiceState({
      muted: mutedRef.current,
      deafened: deafenedRef.current,
      videoMode: mode,
      videoPaused: false,
    });
    if (needsNegotiation) await renegotiatePeers();
  }

  async function renegotiatePeers() {
    await Promise.all(
      [...peersRef.current.keys()].map((connectionId) =>
        createAndSendOffer(connectionId).catch((error: unknown) =>
          handleSignalingFailure(connectionId, error),
        ),
      ),
    );
  }

  function stopVideo() {
    const track = localVideoTrackRef.current;
    if (!track) return;
    track.onended = null;
    track.stop();
    localStreamRef.current?.removeTrack(track);
    localVideoTrackRef.current = null;
    setLocalVideoStream(null);
    videoModeRef.current = null;
    setVideoMode(null);
    videoPausedRef.current = false;
    setVideoPaused(false);
    if (selfConnectionIdRef.current === focusedConnectionId) setFocusedConnectionId(null);
    emitVoiceState({
      muted: mutedRef.current,
      deafened: deafenedRef.current,
      videoMode: null,
      videoPaused: false,
    });
    void Promise.all(
      [...videoSendersRef.current.values()].map((sender) => sender.replaceTrack(null)),
    );
  }

  async function toggleCamera() {
    if (!joinedRef.current || !activeChannelRef.current?.permissions.SPEAK) return;
    if (videoMode === 'camera') {
      stopVideo();
      return;
    }
    const sessionGeneration = connectionGenerationRef.current;
    let stream: MediaStream;
    try {
      const selected = await requestWapveMedia('camera');
      if (!selected) return;
      stream = selected;
    } catch {
      if (sessionGeneration === connectionGenerationRef.current)
        setError(messages.cameraPermissionError);
      return;
    }
    if (sessionGeneration !== connectionGenerationRef.current || !joinedRef.current) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }
    const track = stream.getVideoTracks()[0];
    if (!track) {
      for (const mediaTrack of stream.getTracks()) mediaTrack.stop();
      return;
    }
    try {
      await publishVideo(track, 'camera', sessionGeneration);
    } catch {
      if (localVideoTrackRef.current === track) stopVideo();
      else track.stop();
      if (sessionGeneration === connectionGenerationRef.current)
        setError(messages.voiceConnectionFailed);
    }
  }

  async function toggleScreenShare() {
    if (!joinedRef.current || !activeChannelRef.current?.permissions.SPEAK) return;
    if (videoMode === 'screen') {
      stopVideo();
      return;
    }
    const sessionGeneration = connectionGenerationRef.current;
    let stream: MediaStream;
    try {
      const selected = await requestWapveMedia('screen');
      if (!selected) return;
      stream = selected;
    } catch {
      if (sessionGeneration === connectionGenerationRef.current)
        setError(messages.screenSharePermissionError);
      return;
    }
    if (sessionGeneration !== connectionGenerationRef.current || !joinedRef.current) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }
    const track = stream.getVideoTracks()[0];
    if (!track) {
      for (const mediaTrack of stream.getTracks()) mediaTrack.stop();
      return;
    }
    try {
      await publishVideo(track, 'screen', sessionGeneration);
    } catch {
      if (localVideoTrackRef.current === track) stopVideo();
      else track.stop();
      if (sessionGeneration === connectionGenerationRef.current)
        setError(messages.voiceConnectionFailed);
    }
  }

  function toggleVideoPaused() {
    const track = localVideoTrackRef.current;
    if (!track || track.readyState !== 'live' || !videoModeRef.current) return;
    const next = !videoPausedRef.current;
    videoPausedRef.current = next;
    setVideoPaused(next);
    track.enabled = !next;
    emitVoiceState({
      muted: mutedRef.current,
      deafened: deafenedRef.current,
      videoMode: videoModeRef.current,
      videoPaused: next,
    });
  }

  useEffect(() => {
    if (!joined) return;
    const keyDown = (event: KeyboardEvent) => {
      if (event.repeat || isEditableShortcutTarget(event.target)) return;
      if (
        pushToTalk &&
        event.code === pushToTalkKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        !event.metaKey
      )
        return;
      const action = voiceShortcutActions.find((candidate) =>
        matchesVoiceShortcut(event, shortcuts[candidate]),
      );
      if (!action) return;
      event.preventDefault();
      if (action === 'toggleMute') toggleMuted();
      else if (action === 'toggleDeafen') toggleDeafened();
      else if (action === 'toggleCamera') void toggleCamera();
      else if (action === 'toggleScreenShare') void toggleScreenShare();
      else if (action === 'toggleVideoPause') toggleVideoPaused();
      else disconnect();
    };
    window.addEventListener('keydown', keyDown);
    return () => window.removeEventListener('keydown', keyDown);
  }, [deafened, joined, muted, pushToTalk, pushToTalkKey, shortcuts, videoMode, videoPaused]);

  return {
    activeChannel,
    participants,
    remoteStreams,
    localVideoStream,
    videoMode,
    videoPaused,
    selfConnectionId,
    focusedConnectionId,
    miniPlayerOpen,
    joining,
    joined,
    muted,
    deafened,
    error,
    speakingConnectionIds,
    quality,
    qualityMetrics,
    transport,
    reconnecting,
    audioInputDeviceId,
    audioOutputDeviceId,
    audioOutputVolume,
    participantVolumes,
    pushToTalk,
    pushToTalkKey,
    echoCancellation,
    noiseSuppression,
    autoGainControl,
    speechEnhancementActive,
    shortcuts,
    connect,
    disconnect,
    toggleMuted,
    toggleDeafened,
    selectAudioInputDevice,
    selectAudioOutputDevice,
    setAudioOutputVolume,
    setParticipantVolume,
    setPushToTalk,
    setPushToTalkKey,
    setEchoCancellation,
    setNoiseSuppression,
    setAutoGainControl,
    setShortcut,
    resetShortcuts,
    runDoctor,
    toggleCamera,
    toggleScreenShare,
    toggleVideoPaused,
    setFocusedConnectionId,
    setMiniPlayerOpen,
    playSound,
    serverMuteUser: (targetUserId: string, channelId: string, muted: boolean) => {
      socketRef.current?.emit('voice:server-mute-user', { targetUserId, channelId, muted });
    },
    serverDeafenUser: (targetUserId: string, channelId: string, deafened: boolean) => {
      socketRef.current?.emit('voice:server-deafen-user', { targetUserId, channelId, deafened });
    },
    disconnectUser: (targetUserId: string, channelId: string) => {
      socketRef.current?.emit('voice:disconnect-user', { targetUserId, channelId });
    },
  };
}

export type VoiceConnection = ReturnType<typeof useVoiceConnection>;

type PersistentVoiceConnection = {
  connection: VoiceConnection;
};

const VoiceConnectionContext = createContext<PersistentVoiceConnection | null>(null);

export function VoiceConnectionProvider({
  children,
  messages,
}: {
  children: ReactNode;
  messages: Dictionary;
}) {
  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: () => apiRequest<AuthSession>('/auth/session'),
  });
  const unauthorized =
    sessionQuery.error instanceof ApiClientError && sessionQuery.error.status === 401;
  const verifiedUserId =
    !unauthorized && sessionQuery.data?.user.emailVerified ? sessionQuery.data.user.id : null;
  const emailVerified = Boolean(verifiedUserId);
  const connection = useVoiceConnection({ emailVerified, messages });
  const disconnectRef = useRef(connection.disconnect);
  const resolvedIdentityRef = useRef<string | null | undefined>(undefined);
  disconnectRef.current = connection.disconnect;

  useEffect(() => {
    if (sessionQuery.isPending) return;
    const previousIdentity = resolvedIdentityRef.current;
    resolvedIdentityRef.current = verifiedUserId;
    if (
      verifiedUserId === null ||
      (previousIdentity !== undefined && previousIdentity !== verifiedUserId)
    )
      disconnectRef.current();
  }, [sessionQuery.isPending, verifiedUserId]);

  return (
    <VoiceConnectionContext.Provider value={{ connection }}>
      {children}
      <VoiceAudioOutput connection={connection} />
    </VoiceConnectionContext.Provider>
  );
}

export function usePersistentVoiceConnection(): PersistentVoiceConnection {
  const value = useContext(VoiceConnectionContext);
  if (!value) throw new Error('VoiceConnectionProvider is missing');
  return value;
}

export function VoiceChannel({
  channel,
  currentUserId,
  emailVerified,
  messages,
  connection,
  server,
  members = [],
  roles = [],
  currentMember,
  developerMode = false,
  locale = 'tr',
  onOpenProfile,
  onOpenSettings,
  onMembersChanged,
  onNotice,
  onMention,
  onOpenDirectMessage,
}: {
  channel: ServerChannel;
  currentUserId: string;
  emailVerified: boolean;
  messages: Dictionary;
  connection: VoiceConnection;
  server?: ServerSummary | undefined;
  members?: ServerMember[] | undefined;
  roles?: ServerRole[] | undefined;
  currentMember?: ServerMember | undefined;
  developerMode?: boolean | undefined;
  locale?: string | undefined;
  onOpenProfile?:
    | ((
        member: ServerMember,
        anchor: HTMLElement | ProfileAnchor,
        options?: { editNote?: boolean },
      ) => void)
    | undefined;
  onOpenSettings?: ((section: ServerSettingsSection) => void) | undefined;
  onMembersChanged?: (() => Promise<unknown>) | undefined;
  onNotice?: ((notice: string) => void) | undefined;
  onMention?: ((username: string) => void) | undefined;
  onOpenDirectMessage?: ((userId: string) => void) | undefined;
}) {
  const pathname = usePathname();
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [contextMenuTarget, setContextMenuTarget] = useState<{
    participant: VoiceParticipant;
    position: VoiceContextMenuPosition;
  } | null>(null);
  const [disabledVideos, setDisabledVideos] = useState<Set<string>>(new Set());
  const [mutedSoundboards, setMutedSoundboards] = useState<Set<string>>(new Set());

  function toggleDisableVideo(userId: string) {
    setDisabledVideos((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleMuteSoundboard(userId: string) {
    setMutedSoundboards((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function findMemberForParticipant(p: VoiceParticipant): ServerMember {
    const found = members?.find((m) => m.id === p.userId);
    if (found) return found;
    return {
      id: p.userId,
      publicId: '',
      username: p.username,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      status: 'OFFLINE',
      system: false,
      badges: [],
      role: 'MEMBER',
      joinedAt: new Date().toISOString(),
      timeoutUntil: null,
      timeoutReason: null,
      roles: [],
    };
  }

  const routeChannelId = pathname.split('/').filter(Boolean).at(-1);
  const routeReady = routeChannelId === channel.id || routeChannelId === channel.publicId;
  const isCurrentChannel = connection.activeChannel?.id === channel.id;
  const participants = isCurrentChannel ? connection.participants : [];
  const focusedParticipant = participants.find(
    (participant) => participant.connectionId === connection.focusedConnectionId,
  );
  const focusedStream = focusedParticipant
    ? participantVideoStream(connection, focusedParticipant)
    : null;

  useEffect(() => {
    if (
      !routeReady ||
      connection.activeChannel ||
      window.localStorage.getItem('wapve:voice-calibration-dismissed') === 'true'
    )
      return;
    setCalibrationOpen(true);
  }, [channel.id, connection.activeChannel, routeReady]);

  function requestJoin() {
    if (!routeReady) return;
    if (window.localStorage.getItem('wapve:voice-calibration-dismissed') === 'true') {
      void connection.connect(channel);
      return;
    }
    setCalibrationOpen(true);
  }

  return (
    <div className="voice-room">
      <div className="voice-room-hero">
        <div className="voice-room-icon">
          <Headphones size={34} />
        </div>
        <div>
          <span>{messages.voiceChannel}</span>
          <h2>{channel.name}</h2>
          <p>
            {isCurrentChannel && connection.joined
              ? messages.voiceConnected
              : messages.voiceChannelReady}
          </p>
          {isCurrentChannel && connection.joined && (
            <div className="voice-connection-badges">
              <VoiceQualityBadge
                messages={messages}
                quality={connection.quality}
                metrics={connection.qualityMetrics}
              />
            </div>
          )}
        </div>
        {!isCurrentChannel && (
          <button
            className="wapve-button wapve-button--primary voice-join-button"
            onClick={requestJoin}
            disabled={
              !routeReady || connection.joining || !emailVerified || !channel.permissions.CONNECT
            }
          >
            {connection.joining ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Headphones size={17} />
            )}
            {connection.joining ? messages.voiceConnecting : messages.joinVoice}
          </button>
        )}
      </div>
      {connection.error && (
        <div className="voice-error" role="alert">
          {connection.error}
        </div>
      )}
      <MicrophoneCalibrationDialog
        open={calibrationOpen}
        connection={connection}
        messages={messages}
        onClose={() => setCalibrationOpen(false)}
        onContinue={(dontShowAgain) => {
          if (dontShowAgain)
            window.localStorage.setItem('wapve:voice-calibration-dismissed', 'true');
          setCalibrationOpen(false);
          void connection.connect(channel);
        }}
      />
      {focusedParticipant && (
        <section className="voice-focus-view" aria-label={messages.focusedStream}>
          <header>
            <div>
              {focusedParticipant.videoMode === 'screen' ? (
                <MonitorUp size={18} />
              ) : (
                <Camera size={18} />
              )}
              <strong>
                {focusedParticipant.displayName} ·{' '}
                {focusedParticipant.videoMode === 'screen' ? messages.screenShare : messages.camera}
              </strong>
              {focusedParticipant.videoMode === 'screen' && (
                <span className="crystal-stream-badge">
                  <Sparkles size={13} className="crystal-icon" />
                  {messages.crystalStreamBadge ?? '✦ Kristal Akış · 1080p 60FPS'}
                </span>
              )}
            </div>
            <div>
              <button
                aria-label={messages.pictureInPicture}
                onClick={(event) => {
                  const video = event.currentTarget
                    .closest('.voice-focus-view')
                    ?.querySelector('video');
                  if (video && document.pictureInPictureEnabled)
                    void video.requestPictureInPicture();
                }}
              >
                <PictureInPicture2 size={17} />
              </button>
              <button
                aria-label={messages.fullScreen}
                onClick={(event) =>
                  void event.currentTarget.closest('.voice-focus-view')?.requestFullscreen()
                }
              >
                <Maximize2 size={17} />
              </button>
              <button
                aria-label={messages.close}
                onClick={() => connection.setFocusedConnectionId(null)}
              >
                ×
              </button>
            </div>
          </header>
          <VoiceVideo stream={focusedStream} className="voice-focus-video" />
          {focusedParticipant.videoPaused && (
            <div className="voice-paused-overlay">
              <Pause size={22} /> {messages.videoPaused}
            </div>
          )}
        </section>
      )}
      <div className="voice-participant-grid">
        {participants.map((participant) => (
          <article
            className={`voice-participant-card${
              connection.speakingConnectionIds.includes(participant.connectionId) ? ' speaking' : ''
            }`}
            key={participant.connectionId}
            onClick={(event) => {
              if (onOpenProfile) {
                const targetMember = findMemberForParticipant(participant);
                onOpenProfile(targetMember, event.currentTarget);
              }
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              setContextMenuTarget({
                participant,
                position: { left: event.clientX, top: event.clientY },
              });
            }}
          >
            <VoiceVideo
              stream={
                disabledVideos.has(participant.userId)
                  ? null
                  : participantVideoStream(connection, participant)
              }
            />
            {participant.videoPaused && (
              <div className="voice-paused-overlay voice-paused-overlay--card">
                <Pause size={18} /> {messages.videoPaused}
              </div>
            )}
            {participant.videoMode === 'screen' && (
              <span
                className="crystal-stream-badge"
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  zIndex: 5,
                  padding: '2px 8px',
                  fontSize: 10,
                }}
              >
                <Sparkles size={11} className="crystal-icon" />
                1080p 60FPS
              </span>
            )}
            <div
              className="voice-avatar"
              aria-label={
                connection.speakingConnectionIds.includes(participant.connectionId)
                  ? messages.speaking
                  : undefined
              }
            >
              {participant.avatarUrl ? (
                <img src={participant.avatarUrl} alt="" />
              ) : (
                participant.displayName.slice(0, 1).toUpperCase()
              )}
            </div>
            <strong>
              {participant.displayName}
              {participant.userId === currentUserId ? ` (${messages.you})` : ''}
            </strong>
            <span>@{participant.username}</span>
            <div className="voice-state-icons">
              {participant.muted && <MicOff size={15} aria-label={messages.microphoneMuted} />}
              {participant.deafened && <VolumeX size={15} aria-label={messages.audioMuted} />}
              {participant.videoMode === 'camera' && (
                <Camera className="video-active" size={15} aria-label={messages.cameraActive} />
              )}
              {participant.videoMode === 'screen' && (
                <MonitorUp
                  className="screen-active"
                  size={15}
                  aria-label={messages.screenShareActive}
                />
              )}
              {participant.videoPaused && <Pause size={15} aria-label={messages.videoPaused} />}
            </div>
            {participant.videoMode && (
              <button
                className="voice-watch-button"
                onClick={(e) => {
                  e.stopPropagation();
                  connection.setFocusedConnectionId(participant.connectionId);
                }}
                aria-label={messages.watchStream}
                title={messages.watchStream}
              >
                <Maximize2 size={15} />
              </button>
            )}
          </article>
        ))}
      </div>
      {contextMenuTarget && server && (
        <VoiceMemberContextMenu
          member={findMemberForParticipant(contextMenuTarget.participant)}
          participant={contextMenuTarget.participant}
          currentMember={currentMember}
          currentUserId={currentUserId}
          server={server}
          channelId={channel.id}
          roles={roles}
          developerMode={developerMode}
          messages={messages}
          locale={locale}
          connection={connection}
          position={contextMenuTarget.position}
          disabledVideo={disabledVideos.has(contextMenuTarget.participant.userId)}
          mutedSoundboard={mutedSoundboards.has(contextMenuTarget.participant.userId)}
          onToggleDisableVideo={toggleDisableVideo}
          onToggleMuteSoundboard={toggleMuteSoundboard}
          onClose={() => setContextMenuTarget(null)}
          onNotice={onNotice ?? (() => undefined)}
          onOpenProfile={(m, anchor, opts) => onOpenProfile?.(m, anchor, opts)}
          onOpenSettings={onOpenSettings}
          onMembersChanged={onMembersChanged}
          onMention={onMention}
          onOpenDirectMessage={onOpenDirectMessage}
        />
      )}
      {isCurrentChannel && connection.joined && (
        <VoiceControlButtons
          messages={messages}
          connection={connection}
          className="voice-controls"
        />
      )}
    </div>
  );
}

function MicrophoneCalibrationDialog({
  open,
  connection,
  messages,
  onClose,
  onContinue,
}: {
  open: boolean;
  connection: VoiceConnection;
  messages: Dictionary;
  onClose: () => void;
  onContinue: (dontShowAgain: boolean) => void;
}) {
  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [enhanced, setEnhanced] = useState<boolean | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [error, setError] = useState('');
  const pipelineRef = useRef<EnhancedMediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function stop() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recorderRef.current = null;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    pipelineRef.current?.close();
    pipelineRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    setRunning(false);
    setRecording(false);
    setLevel(0);
  }

  useEffect(() => {
    if (!open) stop();
    return () => stop();
  }, [open]);

  useEffect(
    () => () => {
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    },
    [playbackUrl],
  );

  async function start() {
    setError('');
    try {
      const raw = await navigator.mediaDevices.getUserMedia({
        audio: voiceAudioConstraints(connection.audioInputDeviceId, {
          echoCancellation: connection.echoCancellation,
          noiseSuppression: connection.noiseSuppression,
          autoGainControl: connection.autoGainControl,
        }),
        video: false,
      });
      const pipeline = await enhanceSpeechStream(raw, connection.noiseSuppression);
      pipelineRef.current = pipeline;
      setEnhanced(pipeline.enhanced);
      setRunning(true);
      // Recording should stay usable even when an embedded WebView cannot
      // create an analyser (for example while an audio device is changing).
      // Metering is helpful feedback, but it is not a prerequisite for capture.
      try {
        const context = new AudioContext();
        contextRef.current = context;
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        context.createMediaStreamSource(pipeline.stream).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        const measure = () => {
          analyser.getByteTimeDomainData(samples);
          let energy = 0;
          for (const sample of samples) energy += ((sample - 128) / 128) ** 2;
          setLevel(Math.min(100, Math.round(Math.sqrt(energy / samples.length) * 260)));
          frameRef.current = requestAnimationFrame(measure);
        };
        measure();
      } catch {
        void contextRef.current?.close();
        contextRef.current = null;
        setLevel(0);
      }
    } catch {
      setError(messages.microphonePermissionError);
      stop();
    }
  }

  function toggleRecording() {
    const stream = pipelineRef.current?.stream;
    if (!stream || typeof MediaRecorder === 'undefined') return;
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
      return;
    }
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    setPlaybackUrl(null);
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : '';
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      setPlaybackUrl(URL.createObjectURL(blob));
      setRecording(false);
    };
    recorder.start();
    setRecording(true);
    window.setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, 8_000);
  }

  if (!open) return null;
  return (
    <div className="calibration-overlay" role="presentation">
      <section
        className="calibration-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calibration-title"
      >
        <header>
          <span>
            <Mic size={24} />
          </span>
          <div>
            <h2 id="calibration-title">{messages.microphoneCalibration}</h2>
            <p>{messages.microphoneCalibrationHint}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label={messages.close}>
            <XIcon />
          </button>
        </header>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="calibration-meter" aria-label={messages.microphoneLevel}>
          <i style={{ width: `${level}%` }} />
          <span>{level}%</span>
        </div>
        <div className="calibration-status">
          <b>{messages.noiseProcessing}</b>
          <span className={enhanced ? 'active' : ''}>
            {enhanced === null
              ? messages.notTested
              : enhanced
                ? messages.gtcrnWorking
                : messages.browserProcessingFallback}
          </span>
        </div>
        <div className="calibration-actions">
          <button
            className="wapve-button wapve-button--secondary"
            onClick={() => void (running ? stop() : start())}
          >
            {running ? messages.stopTest : messages.startTest}
          </button>
          <button
            className="wapve-button wapve-button--secondary"
            disabled={!running}
            onClick={toggleRecording}
          >
            {recording ? messages.stopRecording : messages.recordSample}
          </button>
        </div>
        {playbackUrl && <audio className="calibration-playback" src={playbackUrl} controls />}
        <label className="calibration-dismiss">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(event) => setDontShowAgain(event.target.checked)}
          />
          <span>{messages.dontShowCalibrationAgain}</span>
        </label>
        <footer>
          <button className="wapve-button wapve-button--secondary" onClick={onClose}>
            {messages.cancel}
          </button>
          <button
            className="wapve-button wapve-button--primary"
            onClick={() => {
              stop();
              onContinue(dontShowAgain);
            }}
          >
            {messages.continueToVoice}
          </button>
        </footer>
      </section>
    </div>
  );
}

function XIcon() {
  return <span aria-hidden="true">×</span>;
}

function VoiceControlButtons({
  messages,
  connection,
  className,
  dockMode = false,
  soundboardOpen = false,
  onToggleSoundboard,
}: {
  messages: Dictionary;
  connection: VoiceConnection;
  className: string;
  dockMode?: boolean;
  soundboardOpen?: boolean;
  onToggleSoundboard?: () => void;
}) {
  return (
    <div className={className} aria-label={messages.voiceControls}>
      {!dockMode && (
        <>
          <button
            className={connection.muted ? 'active' : ''}
            onClick={connection.toggleMuted}
            disabled={
              !connection.joined ||
              connection.deafened ||
              !connection.activeChannel?.permissions.SPEAK
            }
            aria-label={connection.muted ? messages.unmuteMicrophone : messages.muteMicrophone}
          >
            {connection.muted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <button
            className={connection.deafened ? 'active' : ''}
            onClick={connection.toggleDeafened}
            disabled={!connection.joined}
            aria-label={connection.deafened ? messages.enableAudio : messages.disableAudio}
          >
            {connection.deafened ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </>
      )}
      {dockMode && (
        <button
          className={soundboardOpen ? 'active' : ''}
          onClick={onToggleSoundboard}
          disabled={!connection.joined}
          aria-label={messages.soundboard}
          aria-expanded={soundboardOpen}
        >
          <AudioLines size={20} />
        </button>
      )}
      <button
        className={connection.videoMode === 'camera' ? 'active' : ''}
        onClick={() => void connection.toggleCamera()}
        disabled={!connection.joined || !connection.activeChannel?.permissions.SPEAK}
        aria-label={
          connection.videoMode === 'camera' ? messages.disableCamera : messages.enableCamera
        }
      >
        {connection.videoMode === 'camera' ? <CameraOff size={20} /> : <Camera size={20} />}
      </button>
      <button
        className={connection.videoMode === 'screen' ? 'active' : ''}
        onClick={() => void connection.toggleScreenShare()}
        disabled={!connection.joined || !connection.activeChannel?.permissions.SPEAK}
        aria-label={
          connection.videoMode === 'screen' ? messages.stopScreenShare : messages.startScreenShare
        }
      >
        <MonitorUp size={20} />
      </button>
      <button
        className={connection.videoPaused ? 'active' : ''}
        onClick={connection.toggleVideoPaused}
        disabled={!connection.joined || !connection.videoMode}
        aria-label={connection.videoPaused ? messages.resumeVideo : messages.pauseVideo}
      >
        {connection.videoPaused ? <Play size={20} /> : <Pause size={20} />}
      </button>
      <button
        className="danger"
        onClick={() => connection.disconnect()}
        aria-label={messages.leaveVoice}
      >
        <PhoneOff size={20} />
      </button>
    </div>
  );
}

function VoiceSoundboardPanel({
  servers,
  activeServerId,
  connection,
  messages,
  onClose,
}: {
  servers: ServerSummary[];
  activeServerId: string;
  connection: VoiceConnection;
  messages: Dictionary;
  onClose: () => void;
}) {
  const tr = messages.soundboard === 'Ses tahtası';
  const searchRef = useRef<HTMLInputElement>(null);
  const [selectedServerId, setSelectedServerId] = useState(activeServerId);
  const [search, setSearch] = useState('');
  const [favoriteBusy, setFavoriteBusy] = useState<string | null>(null);
  const library = useQuery({
    queryKey: ['voice-sound-library', servers.map((server) => server.id).join(',')],
    queryFn: async () =>
      Promise.all(
        servers.map(async (server) => ({
          server,
          sounds: await apiRequest<ServerSound[]>(`/servers/${server.id}/sounds`),
        })),
      ),
    staleTime: 30_000,
  });

  useEffect(() => {
    searchRef.current?.focus();
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose]);

  const allSounds = (library.data ?? []).flatMap(({ server, sounds }) =>
    sounds.map((sound) => ({ ...sound, server })),
  );
  const sourceSounds =
    selectedServerId === 'favorites'
      ? allSounds.filter((sound) => sound.favorite)
      : allSounds.filter((sound) => sound.serverId === selectedServerId);
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleSounds = sourceSounds.filter((sound) =>
    normalizedSearch
      ? `${sound.name} ${sound.server.name}`.toLocaleLowerCase().includes(normalizedSearch)
      : true,
  );
  const selectedServer = servers.find((server) => server.id === selectedServerId);
  const canUseSoundboard = Boolean(connection.activeChannel?.permissions.USE_SOUNDBOARD);
  const canUseExternal = Boolean(connection.activeChannel?.permissions.USE_EXTERNAL_SOUNDS);

  async function toggleFavorite(sound: (typeof allSounds)[number]) {
    setFavoriteBusy(sound.id);
    try {
      await apiRequest(`/servers/${sound.serverId}/sounds/${sound.id}/favorite`, {
        method: sound.favorite ? 'DELETE' : 'POST',
      });
      await library.refetch();
    } finally {
      setFavoriteBusy(null);
    }
  }

  return (
    <section className="voice-soundboard-popover" aria-label={messages.soundboard}>
      <header>
        <label>
          <Search size={18} />
          <input
            ref={searchRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={tr ? 'Mükemmel sesi bul' : 'Find the perfect sound'}
          />
        </label>
        <button
          type="button"
          onClick={onClose}
          aria-label={tr ? 'Ses tahtasını kapat' : 'Close soundboard'}
        >
          <XIcon />
        </button>
      </header>
      <div className="voice-soundboard-layout">
        <nav aria-label={tr ? 'Sunucular' : 'Servers'}>
          <button
            type="button"
            className={selectedServerId === 'favorites' ? 'active' : ''}
            onClick={() => setSelectedServerId('favorites')}
            aria-label={tr ? 'Favoriler' : 'Favorites'}
          >
            <Heart size={20} />
          </button>
          {servers.map((server) => (
            <button
              type="button"
              className={selectedServerId === server.id ? 'active' : ''}
              key={server.id}
              onClick={() => setSelectedServerId(server.id)}
              title={server.name}
              aria-label={server.name}
            >
              {server.iconUrl ? (
                <img src={server.iconUrl} alt="" />
              ) : (
                server.name.slice(0, 1).toUpperCase()
              )}
            </button>
          ))}
        </nav>
        <div className="voice-soundboard-content">
          <div className="voice-soundboard-heading">
            <span>
              {selectedServerId === 'favorites' ? <Heart size={18} /> : <AudioLines size={18} />}
            </span>
            <div>
              <strong>
                {selectedServerId === 'favorites'
                  ? tr
                    ? 'Favoriler'
                    : 'Favorites'
                  : (selectedServer?.name ?? messages.soundboard)}
              </strong>
              <small>
                {visibleSounds.length} {tr ? 'ses' : 'sounds'}
              </small>
            </div>
          </div>
          {!canUseSoundboard && (
            <p className="voice-soundboard-permission">
              {tr
                ? 'Bu ses kanalında ses tahtasını kullanma iznin yok.'
                : 'You cannot use the soundboard in this voice channel.'}
            </p>
          )}
          <div className="voice-soundboard-cards">
            {visibleSounds.map((sound) => {
              const external = sound.serverId !== activeServerId;
              const disabled = !canUseSoundboard || (external && !canUseExternal);
              return (
                <article key={sound.id}>
                  <button
                    type="button"
                    className="voice-sound-trigger"
                    onClick={() => connection.playSound(sound.id)}
                    disabled={disabled}
                    title={
                      disabled && external
                        ? tr
                          ? 'Diğer sunucuların seslerini kullanma izni gerekli'
                          : 'Use External Sounds permission required'
                        : sound.name
                    }
                  >
                    <span>
                      <CustomStatusEmoji value={sound.emoji} />
                    </span>
                    <strong>{sound.name}</strong>
                    <small>{sound.server.name}</small>
                  </button>
                  <button
                    type="button"
                    className={`voice-sound-favorite${sound.favorite ? ' active' : ''}`}
                    disabled={favoriteBusy === sound.id}
                    onClick={() => void toggleFavorite(sound)}
                    aria-label={
                      sound.favorite
                        ? tr
                          ? 'Favorilerden kaldır'
                          : 'Remove from favorites'
                        : tr
                          ? 'Favorilere ekle'
                          : 'Add to favorites'
                    }
                  >
                    <Heart size={15} fill={sound.favorite ? 'currentColor' : 'none'} />
                  </button>
                </article>
              );
            })}
          </div>
          {!library.isPending && !visibleSounds.length && (
            <p className="voice-soundboard-empty">
              {selectedServerId === 'favorites'
                ? tr
                  ? 'Henüz favori sesin yok.'
                  : 'You do not have favorite sounds yet.'
                : tr
                  ? 'Bu sunucuda henüz ses yok.'
                  : 'This server has no sounds yet.'}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function VoiceConnectionDock({
  messages,
  connection,
  mobile = false,
  onOpenChannel,
  showVideoPreview = true,
  servers,
}: {
  messages: Dictionary;
  connection: VoiceConnection;
  mobile?: boolean;
  onOpenChannel: () => void;
  showVideoPreview?: boolean;
  servers: ServerSummary[];
}) {
  const [processingOpen, setProcessingOpen] = useState(false);
  const [soundboardOpen, setSoundboardOpen] = useState(false);
  if (!connection.activeChannel) return null;
  const videoParticipant =
    connection.participants.find(
      (participant) => participant.connectionId === connection.focusedConnectionId,
    ) ?? connection.participants.find((participant) => participant.videoMode);
  const videoStream = videoParticipant
    ? participantVideoStream(connection, videoParticipant)
    : null;

  return (
    <section
      className={`voice-connection-dock${mobile ? ' voice-connection-dock--mobile' : ''}`}
      aria-label={messages.voiceConnectionDock}
    >
      {showVideoPreview &&
        connection.miniPlayerOpen &&
        videoParticipant?.videoMode &&
        videoStream && (
          <div className="voice-mini-player">
            <button
              className="voice-mini-stream"
              onClick={() => {
                connection.setFocusedConnectionId(videoParticipant.connectionId);
                onOpenChannel();
              }}
              aria-label={messages.watchStream}
            >
              <VoiceVideo stream={videoStream} className="voice-mini-video" />
              {videoParticipant.videoPaused && (
                <div className="voice-paused-overlay voice-paused-overlay--mini">
                  <Pause size={15} /> {messages.videoPaused}
                </div>
              )}
              <span>
                {videoParticipant.displayName} ·{' '}
                {videoParticipant.videoMode === 'screen' ? messages.screenShare : messages.camera}
              </span>
            </button>
            <button
              className="voice-mini-close"
              aria-label={messages.closeMiniPlayer}
              onClick={() => connection.setMiniPlayerOpen(false)}
            >
              ×
            </button>
          </div>
        )}
      <button className="voice-dock-channel" onClick={onOpenChannel}>
        <span className="voice-dock-icon" aria-hidden="true">
          {connection.joining ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <Headphones size={17} />
          )}
        </span>
        <span className="voice-dock-copy">
          <strong>{connection.activeChannel.name}</strong>
          <span className="voice-dock-status">
            {connection.reconnecting
              ? messages.voiceReconnecting
              : connection.joining
                ? messages.voiceConnecting
                : messages.voiceConnectedShort}
          </span>
          {connection.joined && (
            <span className="voice-connection-badges">
              <VoiceQualityBadge
                messages={messages}
                quality={connection.quality}
                metrics={connection.qualityMetrics}
              />
            </span>
          )}
        </span>
      </button>
      <VoiceControlButtons
        messages={messages}
        connection={connection}
        className="voice-dock-controls"
        dockMode
        soundboardOpen={soundboardOpen}
        onToggleSoundboard={() => {
          setProcessingOpen(false);
          setSoundboardOpen((open) => !open);
        }}
      />
      <button
        type="button"
        className={`voice-processing-toggle${processingOpen ? ' active' : ''}`}
        onClick={() => {
          setSoundboardOpen(false);
          setProcessingOpen((open) => !open);
        }}
        aria-label={messages.voiceProcessing}
        aria-expanded={processingOpen}
      >
        <SlidersHorizontal size={15} />
      </button>
      {soundboardOpen && (
        <VoiceSoundboardPanel
          servers={servers}
          activeServerId={connection.activeChannel.serverId}
          connection={connection}
          messages={messages}
          onClose={() => setSoundboardOpen(false)}
        />
      )}
      {processingOpen && (
        <div className="voice-processing-popover">
          <header>
            <AudioLines size={17} />
            <span>
              <strong>{messages.voiceProcessing}</strong>
              <small>{messages.voiceProcessingHint}</small>
            </span>
          </header>
          <label>
            <span>
              <strong>{messages.noiseSuppression}</strong>
              <small>
                {connection.speechEnhancementActive
                  ? messages.enhancementActive
                  : messages.enhancementReady}
              </small>
            </span>
            <input
              type="checkbox"
              checked={connection.noiseSuppression}
              onChange={(event) => connection.setNoiseSuppression(event.target.checked)}
            />
          </label>
          <label>
            <span>
              <strong>{messages.echoCancellation}</strong>
            </span>
            <input
              type="checkbox"
              checked={connection.echoCancellation}
              onChange={(event) => connection.setEchoCancellation(event.target.checked)}
            />
          </label>
          <label>
            <span>
              <strong>{messages.autoGainControl}</strong>
            </span>
            <input
              type="checkbox"
              checked={connection.autoGainControl}
              onChange={(event) => connection.setAutoGainControl(event.target.checked)}
            />
          </label>
        </div>
      )}
    </section>
  );
}

function participantVideoStream(
  connection: VoiceConnection,
  participant: VoiceParticipant,
): MediaStream | null {
  return participant.connectionId === connection.selfConnectionId
    ? connection.localVideoStream
    : (connection.remoteStreams[participant.connectionId] ?? null);
}

function VoiceVideo({
  stream,
  className = 'voice-participant-video',
}: {
  stream: MediaStream | null;
  className?: string;
}) {
  const [, setVersion] = useState(0);
  const track = stream?.getVideoTracks()[0];

  useEffect(() => {
    if (!track) return;
    const update = () => setVersion((current) => current + 1);
    track.addEventListener('mute', update);
    track.addEventListener('unmute', update);
    track.addEventListener('ended', update);
    return () => {
      track.removeEventListener('mute', update);
      track.removeEventListener('unmute', update);
      track.removeEventListener('ended', update);
    };
  }, [track]);

  if (!stream || !track || track.readyState !== 'live' || track.muted) return null;
  return (
    <video
      className={className}
      autoPlay
      playsInline
      muted
      ref={(element) => {
        if (element && element.srcObject !== stream) element.srcObject = stream;
      }}
    />
  );
}

function VoiceQualityBadge({
  messages,
  quality,
  metrics,
}: {
  messages: Dictionary;
  quality: VoiceConnectionQuality;
  metrics: VoiceConnectionMetrics;
}) {
  const label =
    quality === 'GOOD'
      ? messages.voiceQualityGood
      : quality === 'FAIR'
        ? messages.voiceQualityFair
        : quality === 'POOR'
          ? messages.voiceQualityPoor
          : messages.voiceConnecting;
  return (
    <span
      className={`voice-quality voice-quality--${quality.toLowerCase()}`}
      title={
        metrics.roundTripMs === null
          ? label
          : `${label} · ${metrics.roundTripMs} ms · ${metrics.jitterMs ?? 0} ms jitter · ${metrics.packetLossPercent ?? 0}% loss`
      }
    >
      <i aria-hidden="true" />
      {label}
    </span>
  );
}

export function VoiceAudioOutput({ connection }: { connection: VoiceConnection }) {
  return (
    <div className="voice-audio-output" aria-hidden="true">
      {Object.entries(connection.remoteStreams).map(([connectionId, stream]) => (
        <VoiceAudioTrack
          key={connectionId}
          stream={stream}
          muted={connection.deafened}
          volume={
            connection.audioOutputVolume *
            (connection.participantVolumes[
              connection.participants.find(
                (participant) => participant.connectionId === connectionId,
              )?.userId ?? ''
            ] ?? 1)
          }
          outputDeviceId={connection.audioOutputDeviceId}
        />
      ))}
    </div>
  );
}

function VoiceAudioTrack({
  stream,
  muted,
  volume,
  outputDeviceId,
}: {
  stream: MediaStream;
  muted: boolean;
  volume: number;
  outputDeviceId: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    element.srcObject = stream;
    const sinkAudio = element as HTMLAudioElement & {
      setSinkId?: (deviceId: string) => Promise<void>;
    };
    let disposed = false;
    const removeResumeListeners = () => {
      window.removeEventListener('pointerdown', resumePlayback);
      window.removeEventListener('keydown', resumePlayback);
    };
    const resumePlayback = () => {
      removeResumeListeners();
      if (!disposed) void element.play().catch(() => undefined);
    };
    const configurePlayback = async () => {
      if (sinkAudio.setSinkId) {
        try {
          await sinkAudio.setSinkId(outputDeviceId);
        } catch {
          if (outputDeviceId !== 'default')
            await sinkAudio.setSinkId('default').catch(() => undefined);
        }
      }
      if (disposed) return;
      try {
        await element.play();
      } catch {
        window.addEventListener('pointerdown', resumePlayback, { once: true });
        window.addEventListener('keydown', resumePlayback, { once: true });
      }
    };
    void configurePlayback();
    return () => {
      disposed = true;
      removeResumeListeners();
      element.pause();
      element.srcObject = null;
    };
  }, [outputDeviceId, stream]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  return <audio ref={audioRef} autoPlay muted={muted} />;
}
