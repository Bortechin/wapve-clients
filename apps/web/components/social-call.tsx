'use client';

import type { SocialCallSession, VoiceIceConfiguration, VoiceParticipant } from '@wapve/contracts';
import {
  Camera,
  CameraOff,
  ChevronDown,
  Maximize2,
  Mic,
  MicOff,
  MonitorUp,
  PictureInPicture2,
  Phone,
  PhoneCall,
  PhoneOff,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { io, type Socket } from 'socket.io-client';
import { apiRequest } from '@/lib/api';
import { requestWapveMedia } from './media-setup-dialog';
import { enhanceSpeechStream, type EnhancedMediaStream } from '@/lib/speech-enhancement';
import type { Dictionary } from '@/lib/i18n';
import {
  hasRemoteSocialCallParticipant,
  isPoliteSocialCallPeer,
  isSameSocialCall,
  shouldAcceptSocialCallSession,
  shouldEndActiveSocialCall,
  shouldRingForSocialCallSession,
  socialCallParticipantCount,
  type SocialCallEnded,
} from './social-call-lifecycle';
import { iceCandidateMatchesRemoteDescription, isPrivateVoiceConfiguration } from './voice-network';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';
const CALL_RECONNECT_TIMEOUT_MS = 25_000;
const PEER_DISCONNECT_GRACE_MS = 3_000;
const PEER_CONNECT_TIMEOUT_MS = 15_000;
const NEGOTIATION_RETRY_MS = 250;
const MAX_PENDING_SIGNALS = 256;
const PARTICIPANT_VOLUME_STORAGE_KEY = 'wapve:voice-participant-volumes';
const OUTGOING_CALL_TONE_URL = '/audio/call-outgoing.mp3';
const INCOMING_CALL_TONE_URL = '/audio/call-incoming.mp3';

export type CallPerson = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
};

export type SocialCallRequest = {
  conversationId: string;
  kind: 'direct' | 'group';
  mode: 'audio' | 'video';
  title: string;
  people?: CallPerson[];
  outgoing?: boolean;
};

export type SocialCallVoicePreferences = {
  audioInputDeviceId: string;
  audioOutputDeviceId: string;
  audioOutputVolume: number;
  pushToTalk: boolean;
  pushToTalkKey: string;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
};

type IncomingSignal = {
  fromConnectionId: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit | null;
};

type PeerNegotiationState = {
  makingOffer: boolean;
  ignoreOffer: boolean;
  settingRemoteAnswer: boolean;
  revision: number;
};

export function SocialCallManager({
  request,
  onRequestHandled,
  currentUser,
  voicePreferences,
  selectedConversationId,
  channelPanelWidth,
  onOpenConversation,
  prepareForCall,
  messages,
}: {
  request: SocialCallRequest | null;
  onRequestHandled: () => void;
  currentUser: CallPerson;
  voicePreferences: SocialCallVoicePreferences;
  selectedConversationId: string | null;
  channelPanelWidth: number;
  onOpenConversation: (conversationId: string) => void;
  prepareForCall: () => Promise<void> | void;
  messages: Dictionary;
}) {
  const socketRef = useRef<Socket | null>(null);
  const readyRef = useRef(false);
  const serverJoinedRef = useRef(false);
  const pendingJoinRef = useRef<SocialCallRequest | null>(null);
  const activeCallIdRef = useRef<string | null>(null);
  const joinedParticipantRef = useRef<VoiceParticipant | null>(null);
  const pendingPeersRef = useRef<VoiceParticipant[]>([]);
  const pendingSignalsRef = useRef<IncomingSignal[]>([]);
  const pendingParticipantUpdatesRef = useRef(new Map<string, VoiceParticipant>());
  const connectionFailureTimerRef = useRef<number | null>(null);
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const videoSendersRef = useRef(new Map<string, RTCRtpSender>());
  const pendingCandidatesRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const peerNegotiationRef = useRef(new Map<string, PeerNegotiationState>());
  const signalQueuesRef = useRef(new Map<string, Promise<void>>());
  const negotiationTimersRef = useRef(new Map<string, number>());
  const peerConnectTimersRef = useRef(new Map<string, number>());
  const reconnectTimersRef = useRef(new Map<string, number>());
  const restartAttemptsRef = useRef(new Map<string, number>());
  const restartingPeersRef = useRef(new Set<string>());
  const peerEpochRef = useRef(0);
  const callGenerationRef = useRef(0);
  const videoOperationRef = useRef(0);
  const selfConnectionIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const microphonePipelineRef = useRef<EnhancedMediaStream | null>(null);
  const localVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const configurationRef = useRef<RTCConfiguration>({
    iceServers: [],
    iceTransportPolicy: 'relay',
  });
  const [session, setSession] = useState<SocialCallSession | null>(null);
  const [pendingCall, setPendingCall] = useState<SocialCallRequest | null>(null);
  const [incoming, setIncoming] = useState<SocialCallSession | null>(null);
  const [outgoingRinging, setOutgoingRinging] = useState(false);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [stageHost, setStageHost] = useState<HTMLElement | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [participantVolumes, setParticipantVolumes] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem(PARTICIPANT_VOLUME_STORAGE_KEY) ?? '{}',
      ) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(parsed).flatMap(([userId, value]) => {
          const number = Number(value);
          return Number.isFinite(number) ? [[userId, Math.max(0, Math.min(1, number))]] : [];
        }),
      );
    } catch {
      return {};
    }
  });
  const sessionRef = useRef(session);
  const incomingRef = useRef(incoming);
  const pendingCallRef = useRef(pendingCall);
  const joinedRef = useRef(joined);
  const joiningRef = useRef(joining);
  const mutedRef = useRef(muted);
  const cameraOffRef = useRef(cameraOff);
  const sharingScreenRef = useRef(sharingScreen);
  const previousPushToTalkRef = useRef(voicePreferences.pushToTalk);
  const messagesRef = useRef(messages);
  const leaveCallRef = useRef<() => void>(() => undefined);
  sessionRef.current = session;
  incomingRef.current = incoming;
  pendingCallRef.current = pendingCall;
  joinedRef.current = joined;
  joiningRef.current = joining;
  mutedRef.current = muted;
  cameraOffRef.current = cameraOff;
  sharingScreenRef.current = sharingScreen;
  messagesRef.current = messages;

  const details = useMemo(() => {
    if (session) {
      const other =
        session.kind === 'direct'
          ? [session.caller, ...session.invited].find(
              (person) => person.userId !== currentUser.userId,
            )
          : null;
      return {
        conversationId: session.conversationId,
        kind: session.kind,
        mode: session.mode,
        title: other?.displayName || session.title || pendingCall?.title || messages.groupCall,
        people: [session.caller, ...session.invited],
      } satisfies SocialCallRequest;
    }
    return pendingCall;
  }, [currentUser.userId, messages.groupCall, pendingCall, session]);

  const remoteAudioOutputs = useMemo(() => {
    const outputs = new Map<string, { stream: MediaStream; userId: string }>();
    for (const participant of participants) {
      if (participant.userId === currentUser.userId) continue;
      const stream = remoteStreams[participant.connectionId];
      if (!stream?.getAudioTracks().some((track) => track.readyState === 'live')) continue;
      outputs.set(participant.userId, {
        stream,
        userId: participant.userId,
      });
    }
    return [...outputs.values()];
  }, [currentUser.userId, participants, remoteStreams]);

  function clearConnectionFailureTimer() {
    if (connectionFailureTimerRef.current !== null)
      window.clearTimeout(connectionFailureTimerRef.current);
    connectionFailureTimerRef.current = null;
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
    restartingPeersRef.current.delete(connectionId);
    const negotiationTimer = negotiationTimersRef.current.get(connectionId);
    if (negotiationTimer !== undefined) window.clearTimeout(negotiationTimer);
    negotiationTimersRef.current.delete(connectionId);
    const peerConnectTimer = peerConnectTimersRef.current.get(connectionId);
    if (peerConnectTimer !== undefined) window.clearTimeout(peerConnectTimer);
    peerConnectTimersRef.current.delete(connectionId);
    const reconnectTimer = reconnectTimersRef.current.get(connectionId);
    if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
    reconnectTimersRef.current.delete(connectionId);
    setRemoteStreams((current) => {
      if (!(connectionId in current)) return current;
      const next = { ...current };
      delete next[connectionId];
      return next;
    });
  }

  function resetPeers() {
    peerEpochRef.current += 1;
    for (const connectionId of [...peersRef.current.keys()]) closePeer(connectionId);
    peersRef.current.clear();
    videoSendersRef.current.clear();
    pendingCandidatesRef.current.clear();
    peerNegotiationRef.current.clear();
    signalQueuesRef.current.clear();
    restartAttemptsRef.current.clear();
    restartingPeersRef.current.clear();
    for (const timer of negotiationTimersRef.current.values()) window.clearTimeout(timer);
    negotiationTimersRef.current.clear();
    for (const timer of peerConnectTimersRef.current.values()) window.clearTimeout(timer);
    peerConnectTimersRef.current.clear();
    for (const timer of reconnectTimersRef.current.values()) window.clearTimeout(timer);
    reconnectTimersRef.current.clear();
    pendingPeersRef.current = [];
    pendingSignalsRef.current = [];
    pendingParticipantUpdatesRef.current.clear();
    joinedParticipantRef.current = null;
    selfConnectionIdRef.current = null;
    setRemoteStreams({});
    setParticipants([]);
  }

  async function loadIceConfiguration(): Promise<RTCConfiguration | null> {
    try {
      const ice = await apiRequest<VoiceIceConfiguration>('/voice/ice-servers');
      if (!isPrivateVoiceConfiguration(ice)) return null;
      return {
        iceServers: ice.iceServers.map((server) => ({
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

  function negotiationState(connectionId: string): PeerNegotiationState {
    const existing = peerNegotiationRef.current.get(connectionId);
    if (existing) return existing;
    const created = {
      makingOffer: false,
      ignoreOffer: false,
      settingRemoteAnswer: false,
      revision: 0,
    };
    peerNegotiationRef.current.set(connectionId, created);
    return created;
  }

  function armPeerConnectTimeout(
    connectionId: string,
    connection: RTCPeerConnection,
    generation: number,
    peerEpoch: number,
  ) {
    const currentTimer = peerConnectTimersRef.current.get(connectionId);
    if (currentTimer !== undefined) window.clearTimeout(currentTimer);
    peerConnectTimersRef.current.set(
      connectionId,
      window.setTimeout(() => {
        peerConnectTimersRef.current.delete(connectionId);
        if (
          generation !== callGenerationRef.current ||
          peerEpoch !== peerEpochRef.current ||
          peersRef.current.get(connectionId) !== connection ||
          !serverJoinedRef.current ||
          !joinedRef.current ||
          ['connected', 'completed'].includes(connection.iceConnectionState)
        )
          return;
        void restartPeer(connectionId);
      }, PEER_CONNECT_TIMEOUT_MS),
    );
  }

  function updateParticipant(participant: VoiceParticipant) {
    setParticipants((current) => {
      const found = current.some((item) => item.connectionId === participant.connectionId);
      return found
        ? current.map((item) =>
            item.connectionId === participant.connectionId ? participant : item,
          )
        : [...current, participant];
    });
  }

  function emitSignal(
    connectionId: string,
    signal: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit | null },
    socket: Socket | null = socketRef.current,
    generation = callGenerationRef.current,
    peerEpoch = peerEpochRef.current,
    expectedConnection?: RTCPeerConnection,
  ) {
    if (
      !socket?.connected ||
      socket !== socketRef.current ||
      generation !== callGenerationRef.current ||
      peerEpoch !== peerEpochRef.current ||
      !serverJoinedRef.current ||
      !joinedRef.current ||
      (expectedConnection && peersRef.current.get(connectionId) !== expectedConnection)
    )
      return;
    socket.emit('call:signal', { targetConnectionId: connectionId, ...signal });
  }

  function emitCallState() {
    const socket = socketRef.current;
    if (!socket?.connected || !serverJoinedRef.current || !joinedRef.current) return;
    socket.emit('call:state', {
      muted: mutedRef.current,
      deafened: false,
      videoMode: sharingScreenRef.current ? 'screen' : cameraOffRef.current ? null : 'camera',
    });
  }

  function peer(connectionId: string): RTCPeerConnection {
    const existing = peersRef.current.get(connectionId);
    if (existing) return existing;
    const peerSocket = socketRef.current;
    const peerGeneration = callGenerationRef.current;
    const peerEpoch = peerEpochRef.current;
    const connection = new RTCPeerConnection(configurationRef.current);
    const isCurrentPeer = () =>
      peerSocket === socketRef.current &&
      peerGeneration === callGenerationRef.current &&
      peerEpoch === peerEpochRef.current &&
      peersRef.current.get(connectionId) === connection;
    const localStream = localStreamRef.current;
    const localTracks = localStream?.getTracks() ?? [];
    for (const track of localTracks) {
      const sender = connection.addTrack(track, localStream!);
      if (track.kind === 'video') videoSendersRef.current.set(connectionId, sender);
    }
    if (!localTracks.some((track) => track.kind === 'audio'))
      connection.addTransceiver('audio', { direction: 'recvonly' });
    const callMode = pendingJoinRef.current?.mode ?? sessionRef.current?.mode;
    if (callMode === 'video' && !localTracks.some((track) => track.kind === 'video')) {
      const transceiver = connection.addTransceiver('video', { direction: 'recvonly' });
      videoSendersRef.current.set(connectionId, transceiver.sender);
    }
    connection.onicecandidate = ({ candidate }) => {
      if (!candidate || !isCurrentPeer()) return;
      const serialized = candidate.toJSON();
      if (serialized.candidate === undefined) return;
      emitSignal(
        connectionId,
        { candidate: { ...serialized, candidate: serialized.candidate } },
        peerSocket,
        peerGeneration,
        peerEpoch,
        connection,
      );
    };
    connection.ontrack = ({ streams, track }) => {
      if (!isCurrentPeer()) return;
      const receivedStream = streams[0];
      setRemoteStreams((current) => {
        if (receivedStream) {
          if (current[connectionId] === receivedStream) return current;
          return { ...current, [connectionId]: receivedStream };
        }
        const existingStream = current[connectionId];
        const nextStream = new MediaStream(existingStream?.getTracks() ?? []);
        if (!nextStream.getTracks().some((item) => item.id === track.id))
          nextStream.addTrack(track);
        return { ...current, [connectionId]: nextStream };
      });
    };
    connection.onconnectionstatechange = () => {
      if (!isCurrentPeer()) return;
      if (connection.connectionState === 'closed') closePeer(connectionId, connection);
      if (connection.connectionState === 'failed') void restartPeer(connectionId);
    };
    connection.oniceconnectionstatechange = () => {
      if (!isCurrentPeer()) return;
      const state = connection.iceConnectionState;
      if (state === 'connected' || state === 'completed') {
        const peerConnectTimer = peerConnectTimersRef.current.get(connectionId);
        if (peerConnectTimer !== undefined) window.clearTimeout(peerConnectTimer);
        peerConnectTimersRef.current.delete(connectionId);
        const timer = reconnectTimersRef.current.get(connectionId);
        if (timer !== undefined) window.clearTimeout(timer);
        reconnectTimersRef.current.delete(connectionId);
        restartAttemptsRef.current.delete(connectionId);
        setError('');
        return;
      }
      if (state === 'disconnected' && !reconnectTimersRef.current.has(connectionId)) {
        reconnectTimersRef.current.set(
          connectionId,
          window.setTimeout(() => {
            reconnectTimersRef.current.delete(connectionId);
            if (isCurrentPeer() && connection.iceConnectionState === 'disconnected')
              void restartPeer(connectionId);
          }, PEER_DISCONNECT_GRACE_MS),
        );
      }
      if (state === 'failed') {
        const timer = reconnectTimersRef.current.get(connectionId);
        if (timer !== undefined) window.clearTimeout(timer);
        reconnectTimersRef.current.delete(connectionId);
        void restartPeer(connectionId);
      }
    };
    peersRef.current.set(connectionId, connection);
    armPeerConnectTimeout(connectionId, connection, peerGeneration, peerEpoch);
    return connection;
  }

  async function createAndSendOffer(
    connectionId: string,
    options?: RTCOfferOptions,
  ): Promise<void> {
    const connection = peer(connectionId);
    const state = negotiationState(connectionId);
    const generation = callGenerationRef.current;
    const peerEpoch = peerEpochRef.current;
    const isCurrentPeer = () =>
      generation === callGenerationRef.current &&
      peerEpoch === peerEpochRef.current &&
      serverJoinedRef.current &&
      joinedRef.current &&
      peersRef.current.get(connectionId) === connection;
    if (connection.signalingState === 'closed') return;
    if (connection.signalingState !== 'stable' || state.makingOffer) {
      if (!negotiationTimersRef.current.has(connectionId)) {
        negotiationTimersRef.current.set(
          connectionId,
          window.setTimeout(() => {
            negotiationTimersRef.current.delete(connectionId);
            if (isCurrentPeer())
              void createAndSendOffer(connectionId, options).catch(() =>
                handleSignalingFailure(connectionId),
              );
          }, NEGOTIATION_RETRY_MS),
        );
      }
      return;
    }
    state.makingOffer = true;
    const revision = state.revision;
    try {
      const description = await connection.createOffer(options);
      if (!isCurrentPeer() || revision !== state.revision || connection.signalingState !== 'stable')
        return;
      await connection.setLocalDescription(description);
      if (!isCurrentPeer()) return;
      const localDescription = connection.localDescription;
      if (localDescription)
        emitSignal(
          connectionId,
          { description: localDescription.toJSON() },
          socketRef.current,
          generation,
          peerEpoch,
          connection,
        );
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
    const generation = callGenerationRef.current;
    const peerEpoch = peerEpochRef.current;
    const isCurrentPeer = () =>
      generation === callGenerationRef.current &&
      peerEpoch === peerEpochRef.current &&
      serverJoinedRef.current &&
      joinedRef.current &&
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
      state.ignoreOffer =
        !isPoliteSocialCallPeer(selfConnectionIdRef.current, signal.fromConnectionId) &&
        offerCollision;
      if (state.ignoreOffer) {
        pendingCandidatesRef.current.delete(signal.fromConnectionId);
        return;
      }
      state.revision += 1;
      state.settingRemoteAnswer = signal.description.type === 'answer';
      try {
        if (offerCollision && connection.signalingState !== 'stable')
          await connection.setLocalDescription({ type: 'rollback' });
        if (!isCurrentPeer()) return;
        await connection.setRemoteDescription(signal.description);
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
        } catch {
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
          emitSignal(
            signal.fromConnectionId,
            { description: localDescription.toJSON() },
            socketRef.current,
            generation,
            peerEpoch,
            connection,
          );
      }
    }
    if (signal.candidate) {
      if (state.ignoreOffer) return;
      if (connection.remoteDescription) {
        if (
          !iceCandidateMatchesRemoteDescription(signal.candidate, connection.remoteDescription.sdp)
        )
          return;
        try {
          await connection.addIceCandidate(signal.candidate);
        } catch {
          return;
        }
      } else {
        pendingCandidatesRef.current.set(signal.fromConnectionId, [
          ...(pendingCandidatesRef.current.get(signal.fromConnectionId) ?? []),
          signal.candidate,
        ]);
      }
    }
  }

  function queueSignal(signal: IncomingSignal) {
    const connectionId = signal.fromConnectionId;
    const signalSocket = socketRef.current;
    const signalGeneration = callGenerationRef.current;
    const signalPeerEpoch = peerEpochRef.current;
    const isCurrentSignal = () =>
      signalSocket === socketRef.current &&
      signalGeneration === callGenerationRef.current &&
      signalPeerEpoch === peerEpochRef.current &&
      serverJoinedRef.current &&
      joinedRef.current;
    const previous = signalQueuesRef.current.get(connectionId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => {
        if (isCurrentSignal()) return handleSignal(signal);
      })
      .catch(() => {
        if (isCurrentSignal()) handleSignalingFailure(connectionId);
      });
    signalQueuesRef.current.set(connectionId, next);
    void next.finally(() => {
      if (signalQueuesRef.current.get(connectionId) === next)
        signalQueuesRef.current.delete(connectionId);
    });
  }

  async function restartPeer(connectionId: string) {
    const connection = peersRef.current.get(connectionId);
    if (!connection || restartingPeersRef.current.has(connectionId)) return;
    const peerConnectTimer = peerConnectTimersRef.current.get(connectionId);
    if (peerConnectTimer !== undefined) window.clearTimeout(peerConnectTimer);
    peerConnectTimersRef.current.delete(connectionId);
    const generation = callGenerationRef.current;
    const peerEpoch = peerEpochRef.current;
    const isCurrentPeer = () =>
      generation === callGenerationRef.current &&
      peerEpoch === peerEpochRef.current &&
      serverJoinedRef.current &&
      joinedRef.current &&
      peersRef.current.get(connectionId) === connection;
    const attempts = restartAttemptsRef.current.get(connectionId) ?? 0;
    if (attempts >= 1) {
      if (isCurrentPeer()) setError(messagesRef.current.voiceConnectionFailed);
      return;
    }
    restartAttemptsRef.current.set(connectionId, attempts + 1);
    restartingPeersRef.current.add(connectionId);
    try {
      const refreshed = await loadIceConfiguration();
      if (!isCurrentPeer()) return;
      if (['connected', 'completed'].includes(connection.iceConnectionState)) {
        restartAttemptsRef.current.delete(connectionId);
        return;
      }
      if (refreshed) {
        configurationRef.current = refreshed;
        connection.setConfiguration(refreshed);
      }
      connection.restartIce();
      await createAndSendOffer(connectionId, { iceRestart: true });
      if (isCurrentPeer()) armPeerConnectTimeout(connectionId, connection, generation, peerEpoch);
    } catch {
      if (isCurrentPeer()) setError(messagesRef.current.voiceConnectionFailed);
    } finally {
      restartingPeersRef.current.delete(connectionId);
    }
  }

  function handleSignalingFailure(connectionId: string) {
    const connection = peersRef.current.get(connectionId);
    if (!connection) {
      if (!joinedRef.current) return;
      resetMedia();
      setError(messagesRef.current.voiceConnectionFailed);
      return;
    }
    if (connection.signalingState === 'closed') return;
    void restartPeer(connectionId);
  }

  function processPeerList(peers: VoiceParticipant[]) {
    if (peers.some((participant) => participant.userId !== currentUser.userId))
      setOutgoingRinging(false);
    setParticipants(peers);
    for (const participant of peers)
      void offer(participant).catch(() => handleSignalingFailure(participant.connectionId));
  }

  function finalizeServerJoin(participant: VoiceParticipant) {
    const call = pendingJoinRef.current;
    const activeSession = sessionRef.current;
    if (
      !call ||
      !activeSession ||
      !isSameSocialCall(call, activeSession) ||
      !localStreamRef.current ||
      !socketRef.current?.connected
    )
      return;
    activeCallIdRef.current = activeSession.id;
    joinedParticipantRef.current = null;
    selfConnectionIdRef.current = participant.connectionId;
    serverJoinedRef.current = true;
    joinedRef.current = true;
    joiningRef.current = false;
    clearConnectionFailureTimer();
    setJoined(true);
    setJoining(false);
    setError('');
    const peers = pendingPeersRef.current;
    const participantUpdates = [...pendingParticipantUpdatesRef.current.values()];
    const signals = pendingSignalsRef.current;
    pendingPeersRef.current = [];
    pendingParticipantUpdatesRef.current.clear();
    pendingSignalsRef.current = [];
    processPeerList(peers);
    for (const update of participantUpdates) updateParticipant(update);
    for (const signal of signals) queueSignal(signal);
    emitCallState();
  }

  function resetMedia() {
    callGenerationRef.current += 1;
    videoOperationRef.current += 1;
    serverJoinedRef.current = false;
    joinedRef.current = false;
    joiningRef.current = false;
    activeCallIdRef.current = null;
    pendingJoinRef.current = null;
    clearConnectionFailureTimer();
    for (const track of localStreamRef.current?.getTracks() ?? []) track.stop();
    microphonePipelineRef.current?.close();
    microphonePipelineRef.current = null;
    localStreamRef.current = null;
    localVideoTrackRef.current = null;
    resetPeers();
    mutedRef.current = false;
    cameraOffRef.current = false;
    sharingScreenRef.current = false;
    setLocalStream(null);
    setJoined(false);
    setJoining(false);
    setMuted(false);
    setCameraOff(false);
    setSharingScreen(false);
    setOutgoingRinging(false);
  }

  function clearCallState() {
    sessionRef.current = null;
    incomingRef.current = null;
    pendingCallRef.current = null;
    setSession(null);
    setIncoming(null);
    setPendingCall(null);
  }

  function leave() {
    const activeSession = sessionRef.current;
    if (socketRef.current) socketRef.current.emit('call:leave');
    resetMedia();
    if (activeSession?.caller.userId === currentUser.userId) {
      clearCallState();
    }
  }
  leaveCallRef.current = leave;

  function scheduleConnectionFailure() {
    if (connectionFailureTimerRef.current !== null) return;
    const generation = callGenerationRef.current;
    connectionFailureTimerRef.current = window.setTimeout(() => {
      connectionFailureTimerRef.current = null;
      if (
        generation !== callGenerationRef.current ||
        serverJoinedRef.current ||
        (!localStreamRef.current && !joiningRef.current)
      )
        return;
      const activeSession = sessionRef.current;
      const activeCall = pendingCallRef.current;
      const unansweredOutgoing =
        Boolean(activeCall?.outgoing) &&
        !hasRemoteSocialCallParticipant(activeSession?.joinedUserIds ?? [], currentUser.userId);
      const isCallerWithoutGuest =
        activeSession?.caller.userId === currentUser.userId &&
        !hasRemoteSocialCallParticipant(activeSession.joinedUserIds, currentUser.userId);
      // Socket.IO queues this packet if the transport is currently down. When
      // it reconnects, the server can close the unanswered call as well.
      socketRef.current?.emit('call:leave');
      resetMedia();
      if (unansweredOutgoing || isCallerWithoutGuest) clearCallState();
      setError(messagesRef.current.voiceConnectionFailed);
    }, CALL_RECONNECT_TIMEOUT_MS);
  }

  function emitPendingJoin() {
    const call = pendingJoinRef.current;
    const socket = socketRef.current;
    if (
      !call ||
      !localStreamRef.current ||
      !readyRef.current ||
      !socket?.connected ||
      serverJoinedRef.current
    )
      return false;
    socket.emit('call:join', {
      conversationId: call.conversationId,
      kind: call.kind,
      mode: call.mode,
    });
    scheduleConnectionFailure();
    return true;
  }

  async function joinCall(call: SocialCallRequest) {
    const activeCall = pendingJoinRef.current;
    if (
      (joinedRef.current || joiningRef.current || localStreamRef.current) &&
      activeCall &&
      isSameSocialCall(activeCall, call)
    )
      return;
    if (joinedRef.current || joiningRef.current || localStreamRef.current) {
      if (socketRef.current?.connected) socketRef.current.emit('call:leave');
      resetMedia();
    }
    setOutgoingRinging(Boolean(call.outgoing));
    await prepareForCall();
    const generation = ++callGenerationRef.current;
    resetPeers();
    joiningRef.current = true;
    joinedRef.current = false;
    serverJoinedRef.current = false;
    joinedParticipantRef.current = null;
    pendingJoinRef.current = call;
    pendingCallRef.current = call;
    incomingRef.current = null;
    const selectedSession = sessionRef.current;
    if (selectedSession && !isSameSocialCall(selectedSession, call)) {
      sessionRef.current = null;
      activeCallIdRef.current = null;
      setSession(null);
    } else {
      activeCallIdRef.current = selectedSession?.id ?? null;
    }
    setJoining(true);
    setIncoming(null);
    setError('');
    setPendingCall(call);
    const configuration = await loadIceConfiguration();
    if (generation !== callGenerationRef.current) return;
    if (!configuration) {
      resetMedia();
      setError(messagesRef.current.voiceConnectionFailed);
      return;
    }
    try {
      const configurationProbe = new RTCPeerConnection(configuration);
      configurationProbe.close();
    } catch {
      resetMedia();
      setError(messagesRef.current.voiceConnectionFailed);
      return;
    }
    configurationRef.current = configuration;
    try {
      const audioConstraints: MediaTrackConstraints = {
        ...(voicePreferences.audioInputDeviceId !== 'default'
          ? { deviceId: { exact: voicePreferences.audioInputDeviceId } }
          : {}),
        echoCancellation: voicePreferences.echoCancellation,
        noiseSuppression: voicePreferences.noiseSuppression,
        autoGainControl: voicePreferences.autoGainControl,
      };
      let rawStream: MediaStream;
      const preparedVideo = call.mode === 'video' ? await requestWapveMedia('camera') : null;
      if (generation !== callGenerationRef.current) {
        for (const track of preparedVideo?.getTracks() ?? []) track.stop();
        return;
      }
      try {
        rawStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: false,
        });
      } catch (mediaError) {
        for (const track of preparedVideo?.getTracks() ?? []) track.stop();
        throw mediaError;
      }
      const microphonePipeline = await enhanceSpeechStream(
        rawStream,
        voicePreferences.noiseSuppression,
      );
      const stream = microphonePipeline.stream;
      const preparedTrack = preparedVideo?.getVideoTracks()[0];
      if (preparedTrack) stream.addTrack(preparedTrack);
      if (generation !== callGenerationRef.current || pendingJoinRef.current !== call) {
        microphonePipeline.close();
        return;
      }
      microphonePipelineRef.current = microphonePipeline;
      localStreamRef.current = stream;
      localVideoTrackRef.current = stream.getVideoTracks()[0] ?? null;
      setLocalStream(stream);
      const nextCameraOff = !localVideoTrackRef.current;
      cameraOffRef.current = nextCameraOff;
      sharingScreenRef.current = false;
      setCameraOff(nextCameraOff);
      setSharingScreen(false);
      if (voicePreferences.pushToTalk) {
        for (const track of stream.getAudioTracks()) track.enabled = false;
        mutedRef.current = true;
        setMuted(true);
      } else {
        mutedRef.current = false;
        setMuted(false);
      }
      if (!emitPendingJoin()) scheduleConnectionFailure();
    } catch {
      if (generation !== callGenerationRef.current) return;
      resetMedia();
      setError(messagesRef.current.microphonePermissionError);
    }
  }

  useEffect(() => {
    const socket = io(`${SOCKET_URL}/calls`, { withCredentials: true });
    socketRef.current = socket;
    const isCurrentSocket = () => socketRef.current === socket;
    socket.on('call:ready', () => {
      if (!isCurrentSocket()) return;
      readyRef.current = true;
      emitPendingJoin();
    });
    socket.on('call:joined', (participant: VoiceParticipant) => {
      if (!isCurrentSocket() || !pendingJoinRef.current || !localStreamRef.current) return;
      joinedParticipantRef.current = participant;
    });
    socket.on('call:incoming', (payload: SocialCallSession) => {
      if (!isCurrentSocket()) return;
      const knownSession = sessionRef.current?.id === payload.id ? sessionRef.current : payload;
      if (
        !shouldRingForSocialCallSession({
          session: knownSession,
          currentUserId: currentUser.userId,
          activeCallId: activeCallIdRef.current,
          activeCall: pendingJoinRef.current,
        })
      )
        return;
      incomingRef.current = payload;
      setIncoming(payload);
    });
    socket.on('call:session', (payload: SocialCallSession) => {
      if (!isCurrentSocket()) return;
      const activeCall = pendingJoinRef.current;
      const joinedParticipant = joinedParticipantRef.current;
      if (
        !shouldAcceptSocialCallSession({
          session: payload,
          selectedCallId: sessionRef.current?.id ?? null,
          activeCallId: joinedParticipant ? null : activeCallIdRef.current,
          activeCall,
        })
      )
        return;
      sessionRef.current = payload;
      setSession(payload);
      if (hasRemoteSocialCallParticipant(payload.joinedUserIds, currentUser.userId))
        setOutgoingRinging(false);
      if (pendingCallRef.current && !isSameSocialCall(pendingCallRef.current, payload)) {
        pendingCallRef.current = null;
        setPendingCall(null);
      }
      const shouldRing = shouldRingForSocialCallSession({
        session: payload,
        currentUserId: currentUser.userId,
        activeCallId: activeCallIdRef.current,
        activeCall,
      });
      if (shouldRing) {
        incomingRef.current = payload;
        setIncoming(payload);
      } else if (incomingRef.current?.id === payload.id) {
        incomingRef.current = null;
        setIncoming(null);
      }
      if (joinedParticipant && activeCall && isSameSocialCall(payload, activeCall))
        finalizeServerJoin(joinedParticipant);
    });
    socket.on('call:peers', (peers: VoiceParticipant[]) => {
      if (!isCurrentSocket() || !pendingJoinRef.current || !localStreamRef.current) return;
      if (peers.some((participant) => participant.userId !== currentUser.userId))
        setOutgoingRinging(false);
      if (!serverJoinedRef.current) {
        pendingPeersRef.current = peers;
        return;
      }
      processPeerList(peers);
    });
    socket.on('call:peer-joined', (participant: VoiceParticipant) => {
      if (!isCurrentSocket() || !pendingJoinRef.current || !localStreamRef.current) return;
      if (participant.userId !== currentUser.userId) setOutgoingRinging(false);
      if (!serverJoinedRef.current || !joinedRef.current) {
        pendingParticipantUpdatesRef.current.set(participant.connectionId, participant);
        return;
      }
      updateParticipant(participant);
    });
    socket.on('call:participant-updated', (participant: VoiceParticipant) => {
      if (!isCurrentSocket() || !pendingJoinRef.current || !localStreamRef.current) return;
      if (!serverJoinedRef.current || !joinedRef.current) {
        pendingParticipantUpdatesRef.current.set(participant.connectionId, participant);
        return;
      }
      updateParticipant(participant);
    });
    socket.on('call:peer-left', ({ connectionId }: { connectionId: string }) => {
      if (!isCurrentSocket()) return;
      pendingPeersRef.current = pendingPeersRef.current.filter(
        (participant) => participant.connectionId !== connectionId,
      );
      pendingSignalsRef.current = pendingSignalsRef.current.filter(
        (signal) => signal.fromConnectionId !== connectionId,
      );
      pendingParticipantUpdatesRef.current.delete(connectionId);
      if (!serverJoinedRef.current) return;
      closePeer(connectionId);
      setParticipants((current) => current.filter((item) => item.connectionId !== connectionId));
    });
    socket.on('call:signal', (signal: IncomingSignal) => {
      if (!isCurrentSocket() || !pendingJoinRef.current || !localStreamRef.current) return;
      if (!serverJoinedRef.current || !joinedRef.current) {
        if (pendingSignalsRef.current.length >= MAX_PENDING_SIGNALS)
          pendingSignalsRef.current.shift();
        pendingSignalsRef.current.push(signal);
        return;
      }
      queueSignal(signal);
    });
    socket.on('call:ended', (ended: SocialCallEnded) => {
      if (!isCurrentSocket()) return;
      const sessionEnded = sessionRef.current?.id === ended.callId;
      const incomingEnded = incomingRef.current?.id === ended.callId;
      const endsActiveCall = shouldEndActiveSocialCall({
        ended,
        activeCallId: activeCallIdRef.current,
        activeCall: pendingJoinRef.current,
      });
      if (sessionEnded) {
        sessionRef.current = null;
        setSession(null);
      }
      if (incomingEnded) {
        incomingRef.current = null;
        setIncoming(null);
      }
      if (
        pendingCallRef.current &&
        isSameSocialCall(pendingCallRef.current, ended) &&
        (sessionEnded || incomingEnded || endsActiveCall)
      ) {
        pendingCallRef.current = null;
        setPendingCall(null);
      }
      if (!endsActiveCall) return;
      resetMedia();
    });
    socket.on('call:error', ({ code }: { code: string }) => {
      if (!isCurrentSocket()) return;
      if (['INVALID_CALL_SIGNAL', 'CALL_NOT_CONNECTED'].includes(code)) return;
      if (code === 'CALL_CONNECTION_REPLACED') {
        resetMedia();
        setError(messagesRef.current.voiceConnectionFailed);
        return;
      }
      if (!joiningRef.current || !pendingJoinRef.current) {
        setError(messagesRef.current.voiceConnectionFailed);
        return;
      }
      if (socket.connected) socket.emit('call:leave');
      resetMedia();
      setError(messagesRef.current.voiceConnectionFailed);
    });
    const handleSocketInterruption = () => {
      if (!isCurrentSocket()) return;
      readyRef.current = false;
      if (!localStreamRef.current) return;
      serverJoinedRef.current = false;
      joinedRef.current = false;
      joiningRef.current = true;
      setJoined(false);
      setJoining(true);
      resetPeers();
      scheduleConnectionFailure();
    };
    socket.on('connect_error', handleSocketInterruption);
    socket.on('disconnect', handleSocketInterruption);
    return () => {
      if (socket.connected) socket.emit('call:leave');
      socket.removeAllListeners();
      resetMedia();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
      readyRef.current = false;
      serverJoinedRef.current = false;
    };
  }, [currentUser.userId]);

  useEffect(() => {
    const leaveActiveCall = () => leaveCallRef.current();
    window.addEventListener('wapve:leave-social-call', leaveActiveCall);
    return () => window.removeEventListener('wapve:leave-social-call', leaveActiveCall);
  }, []);

  useEffect(() => {
    if (!joined) return;
    const applyMutedState = (nextMuted: boolean) => {
      for (const track of localStreamRef.current?.getAudioTracks() ?? [])
        track.enabled = !nextMuted;
      mutedRef.current = nextMuted;
      setMuted(nextMuted);
      emitCallState();
    };
    if (!voicePreferences.pushToTalk) {
      const nextMuted = previousPushToTalkRef.current ? false : mutedRef.current;
      previousPushToTalkRef.current = false;
      applyMutedState(nextMuted);
      return;
    }
    previousPushToTalkRef.current = true;
    const applyTalkState = (talking: boolean) => applyMutedState(!talking);
    applyTalkState(false);
    const editable = (target: EventTarget | null) => {
      const element = target instanceof HTMLElement ? target : null;
      return Boolean(element?.isContentEditable || element?.closest('input, textarea, select'));
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.code !== voicePreferences.pushToTalkKey || event.repeat || editable(event.target))
        return;
      event.preventDefault();
      applyTalkState(true);
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code !== voicePreferences.pushToTalkKey || editable(event.target)) return;
      event.preventDefault();
      applyTalkState(false);
    };
    const release = () => applyTalkState(false);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', release);
    };
  }, [joined, voicePreferences.pushToTalk, voicePreferences.pushToTalkKey]);

  useEffect(() => {
    if (!request) return;
    if (session && isSameSocialCall(session, request) && !joined)
      void joinCall({ ...request, mode: session.mode });
    else if (!joined) void joinCall(request);
    onRequestHandled();
  }, [request]);

  useEffect(() => {
    if (!details) {
      setStageHost(null);
      return;
    }
    const selectionId =
      details.kind === 'group' ? `group:${details.conversationId}` : details.conversationId;
    if (selectionId !== selectedConversationId) {
      setStageHost(null);
      return;
    }
    const locate = () =>
      setStageHost(
        document.getElementById(`social-call-host-${details.kind}-${details.conversationId}`),
      );
    locate();
    const frame = window.requestAnimationFrame(locate);
    return () => window.cancelAnimationFrame(frame);
  }, [details?.conversationId, details?.kind, selectedConversationId]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [session]);

  function toggleMuted() {
    if (!joinedRef.current) return;
    const next = !mutedRef.current;
    for (const track of localStreamRef.current?.getAudioTracks() ?? []) track.enabled = !next;
    mutedRef.current = next;
    setMuted(next);
    emitCallState();
  }

  async function setVideoTrack(
    track: MediaStreamTrack | null,
    mode: 'camera' | 'screen' | null,
    generation: number,
    operation: number,
  ) {
    const stream = localStreamRef.current;
    if (
      !stream ||
      !joinedRef.current ||
      generation !== callGenerationRef.current ||
      operation !== videoOperationRef.current
    ) {
      track?.stop();
      return;
    }
    const previous = localVideoTrackRef.current;
    if (previous && previous !== track) {
      previous.onended = null;
      stream.removeTrack(previous);
      previous.stop();
    }
    if (track && !stream.getTracks().some((item) => item.id === track.id)) stream.addTrack(track);
    localVideoTrackRef.current = track;
    cameraOffRef.current = mode !== 'camera';
    sharingScreenRef.current = mode === 'screen';
    setLocalStream(new MediaStream(stream.getTracks()));
    setCameraOff(cameraOffRef.current);
    setSharingScreen(sharingScreenRef.current);
    emitCallState();
    const peerEpoch = peerEpochRef.current;
    await Promise.all(
      [...peersRef.current.entries()].map(async ([connectionId, connection]) => {
        const isCurrentPeer = () =>
          generation === callGenerationRef.current &&
          operation === videoOperationRef.current &&
          peerEpoch === peerEpochRef.current &&
          peersRef.current.get(connectionId) === connection;
        if (!isCurrentPeer()) return;
        try {
          const sender = videoSendersRef.current.get(connectionId);
          if (sender) {
            const transceiver = connection.getTransceivers().find((item) => item.sender === sender);
            const nextDirection: RTCRtpTransceiverDirection = track ? 'sendrecv' : 'recvonly';
            const needsNegotiation = Boolean(
              transceiver && transceiver.direction !== nextDirection,
            );
            if (transceiver && needsNegotiation) transceiver.direction = nextDirection;
            await sender.replaceTrack(track);
            if (needsNegotiation && isCurrentPeer()) await createAndSendOffer(connectionId);
            return;
          }
          if (!track) return;
          videoSendersRef.current.set(connectionId, connection.addTrack(track, stream));
          if (isCurrentPeer()) await createAndSendOffer(connectionId);
        } catch {
          if (isCurrentPeer()) handleSignalingFailure(connectionId);
        }
      }),
    );
  }

  async function toggleCamera() {
    if (!joinedRef.current) return;
    const generation = callGenerationRef.current;
    const operation = ++videoOperationRef.current;
    if (!cameraOffRef.current && !sharingScreenRef.current) {
      await setVideoTrack(null, null, generation, operation);
      return;
    }
    try {
      const stream = await requestWapveMedia('camera');
      if (!stream) return;
      if (
        generation !== callGenerationRef.current ||
        operation !== videoOperationRef.current ||
        !joinedRef.current
      ) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      const track = stream.getVideoTracks()[0] ?? null;
      await setVideoTrack(track, track ? 'camera' : null, generation, operation);
    } catch {
      if (generation === callGenerationRef.current && operation === videoOperationRef.current)
        setError(messagesRef.current.cameraPermissionError);
    }
  }

  async function toggleScreenShare() {
    if (!joinedRef.current) return;
    const generation = callGenerationRef.current;
    const operation = ++videoOperationRef.current;
    if (sharingScreenRef.current) {
      await setVideoTrack(null, null, generation, operation);
      return;
    }
    try {
      const stream = await requestWapveMedia('screen');
      if (!stream) return;
      const track = stream.getVideoTracks()[0] ?? null;
      if (
        generation !== callGenerationRef.current ||
        operation !== videoOperationRef.current ||
        !joinedRef.current
      ) {
        for (const item of stream.getTracks()) item.stop();
        return;
      }
      if (track)
        track.onended = () => {
          if (generation !== callGenerationRef.current || operation !== videoOperationRef.current)
            return;
          const endedOperation = ++videoOperationRef.current;
          void setVideoTrack(null, null, generation, endedOperation);
        };
      await setVideoTrack(track, track ? 'screen' : null, generation, operation);
    } catch {
      if (generation === callGenerationRef.current && operation === videoOperationRef.current)
        setError(messagesRef.current.screenSharePermissionError);
    }
  }

  function decline() {
    const activeIncoming = incomingRef.current;
    if (!activeIncoming) return;
    if (socketRef.current?.connected)
      socketRef.current.emit('call:decline', { callId: activeIncoming.id });
    incomingRef.current = null;
    setIncoming(null);
  }

  function openConversation(call: Pick<SocialCallSession, 'kind' | 'conversationId'>) {
    onOpenConversation(
      call.kind === 'group' ? `group:${call.conversationId}` : call.conversationId,
    );
  }

  const remainingSeconds = session
    ? Math.max(0, Math.ceil((new Date(session.expiresAt).getTime() - now) / 1_000))
    : 120;
  const callAnswered = Boolean(
    joined && session && hasRemoteSocialCallParticipant(session.joinedUserIds, currentUser.userId),
  );
  const participantCount = socialCallParticipantCount(
    session?.joinedUserIds ?? [],
    currentUser.userId,
    joined,
  );
  const stage = details ? (
    <CallStage
      details={details}
      session={session}
      currentUser={currentUser}
      participants={participants}
      remoteStreams={remoteStreams}
      localStream={localStream}
      joined={joined}
      joining={joining}
      muted={muted}
      cameraOff={cameraOff}
      sharingScreen={sharingScreen}
      collapsed={collapsed}
      remainingSeconds={remainingSeconds}
      error={error}
      messages={messages}
      voicePreferences={voicePreferences}
      participantVolumes={participantVolumes}
      onParticipantVolume={(userId, volume) =>
        setParticipantVolumes((current) => {
          const next = { ...current, [userId]: Math.max(0, Math.min(1, volume)) };
          window.localStorage.setItem(PARTICIPANT_VOLUME_STORAGE_KEY, JSON.stringify(next));
          return next;
        })
      }
      onToggleCollapsed={() => setCollapsed((value) => !value)}
      onJoin={() => void joinCall(details)}
      onMuted={toggleMuted}
      onCamera={() => void toggleCamera()}
      onScreen={() => void toggleScreenShare()}
      onLeave={leave}
    />
  ) : null;

  return (
    <>
      {outgoingRinging && !incoming && (
        <CallTone
          src={OUTGOING_CALL_TONE_URL}
          outputDeviceId={voicePreferences.audioOutputDeviceId}
          volume={voicePreferences.audioOutputVolume}
        />
      )}
      {incoming && (
        <CallTone
          src={INCOMING_CALL_TONE_URL}
          outputDeviceId={voicePreferences.audioOutputDeviceId}
          volume={voicePreferences.audioOutputVolume}
        />
      )}
      {remoteAudioOutputs.map(({ stream, userId }) => (
        <CallMedia
          key={`social-call-audio-${userId}`}
          stream={stream}
          muted={false}
          audioOnly
          outputDeviceId={voicePreferences.audioOutputDeviceId}
          outputVolume={voicePreferences.audioOutputVolume * (participantVolumes[userId] ?? 1)}
        />
      ))}
      {incoming &&
        createPortal(
          <div className="incoming-call-backdrop" role="presentation">
            <section
              className="incoming-call"
              role="dialog"
              aria-modal="true"
              aria-label={incoming.caller.displayName}
            >
              <CallAvatar person={incoming.caller} ringing />
              <div>
                <span>
                  {incoming.mode === 'audio'
                    ? messages.incomingAudioCall
                    : messages.incomingVideoCall}
                </span>
                <strong>{incoming.caller.displayName}</strong>
                <small>{messages.callCanBeJoinedLater}</small>
              </div>
              <div className="incoming-call-actions">
                <button
                  className="call-decline"
                  onClick={decline}
                  aria-label={messages.declineCall}
                >
                  <PhoneOff size={20} />
                </button>
                <button
                  className="call-accept"
                  onClick={() => {
                    openConversation(incoming);
                    void joinCall({
                      conversationId: incoming.conversationId,
                      kind: incoming.kind,
                      mode: incoming.mode,
                      title: incoming.caller.displayName,
                      people: [incoming.caller, ...incoming.invited],
                    });
                  }}
                  aria-label={messages.answerCall}
                >
                  {incoming.mode === 'audio' ? <Phone size={20} /> : <Video size={20} />}
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
      {stage && stageHost && createPortal(stage, stageHost)}
      {details &&
        joined &&
        createPortal(
          <section
            className="social-call-connection-dock"
            style={{ '--channel-panel-width': `${channelPanelWidth}px` } as CSSProperties}
            aria-label={messages.voiceConnectionDock}
          >
            <button
              className="social-call-dock-copy"
              onClick={() => session && openConversation(session)}
            >
              <span className="social-call-dock-signal">
                <PhoneCall size={16} />
              </span>
              <span>
                <strong>
                  {callAnswered ? messages.voiceConnectedShort : messages.callWaiting}
                </strong>
                <small>
                  {callAnswered
                    ? `${details.title} · ${participantCount} ${messages.participants}`
                    : `${details.title} · ${remainingSeconds} sn`}
                </small>
              </span>
            </button>
            <div>
              <button
                className={sharingScreen ? 'active' : ''}
                onClick={() => void toggleScreenShare()}
                aria-label={messages.startScreenShare}
              >
                <MonitorUp size={16} />
              </button>
              <button
                className={!cameraOff ? 'active' : ''}
                onClick={() => void toggleCamera()}
                aria-label={messages.enableCamera}
              >
                {!cameraOff ? <CameraOff size={16} /> : <Camera size={16} />}
              </button>
              <button className="danger" onClick={leave} aria-label={messages.leaveVoice}>
                <PhoneOff size={16} />
              </button>
            </div>
          </section>,
          document.body,
        )}
    </>
  );
}

function CallStage({
  details,
  session,
  currentUser,
  participants,
  remoteStreams,
  localStream,
  joined,
  joining,
  muted,
  cameraOff,
  sharingScreen,
  collapsed,
  remainingSeconds,
  error,
  messages,
  voicePreferences,
  participantVolumes,
  onParticipantVolume,
  onToggleCollapsed,
  onJoin,
  onMuted,
  onCamera,
  onScreen,
  onLeave,
}: {
  details: SocialCallRequest;
  session: SocialCallSession | null;
  currentUser: CallPerson;
  participants: VoiceParticipant[];
  remoteStreams: Record<string, MediaStream>;
  localStream: MediaStream | null;
  joined: boolean;
  joining: boolean;
  muted: boolean;
  cameraOff: boolean;
  sharingScreen: boolean;
  collapsed: boolean;
  remainingSeconds: number;
  error: string;
  messages: Dictionary;
  voicePreferences: SocialCallVoicePreferences;
  participantVolumes: Record<string, number>;
  onParticipantVolume: (userId: string, volume: number) => void;
  onToggleCollapsed: () => void;
  onJoin: () => void;
  onMuted: () => void;
  onCamera: () => void;
  onScreen: () => void;
  onLeave: () => void;
}) {
  const [volumeMenu, setVolumeMenu] = useState<{
    person: CallPerson;
    left: number;
    top: number;
  } | null>(null);
  const [focusedMedia, setFocusedMedia] = useState<{
    person: CallPerson;
    stream: MediaStream;
  } | null>(null);
  const people = details.people ?? [];
  const joinedIds = new Set(session?.joinedUserIds ?? (joined ? [currentUser.userId] : []));
  const declinedIds = new Set(session?.declinedUserIds ?? []);
  const answered = Boolean(
    joined && session && hasRemoteSocialCallParticipant(session.joinedUserIds, currentUser.userId),
  );
  const participantCount = socialCallParticipantCount(
    session?.joinedUserIds ?? [],
    currentUser.userId,
    joined,
  );
  useEffect(() => {
    if (!volumeMenu) return;
    const close = () => setVolumeMenu(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [volumeMenu]);
  return (
    <>
      <section
        className={`social-call-stage${collapsed ? ' collapsed' : ''}`}
        aria-label={details.title}
      >
        <header>
          <div>
            {details.mode === 'audio' ? <PhoneCall size={17} /> : <Video size={17} />}
            <span>
              <strong>{details.title}</strong>
              <small>
                {answered
                  ? `${messages.voiceConnectedShort} · ${participantCount} ${messages.participants}`
                  : `${messages.callWaiting} · ${remainingSeconds} sn`}
              </small>
            </span>
          </div>
          <button
            onClick={onToggleCollapsed}
            aria-label={collapsed ? messages.expand : messages.collapse}
          >
            {collapsed ? <Maximize2 size={16} /> : <ChevronDown size={17} />}
          </button>
        </header>
        {!collapsed && (
          <>
            <div className="social-call-people">
              {[
                currentUser,
                ...people.filter((person) => person.userId !== currentUser.userId),
              ].map((person) => {
                const userParticipants = participants.filter(
                  (item) => item.userId === person.userId,
                );
                const participant =
                  [...userParticipants]
                    .reverse()
                    .find((item) =>
                      remoteStreams[item.connectionId]
                        ?.getTracks()
                        .some((track) => track.readyState === 'live'),
                    ) ?? userParticipants[userParticipants.length - 1];
                const personJoined =
                  person.userId === currentUser.userId ? joined : joinedIds.has(person.userId);
                const ringing =
                  person.userId !== currentUser.userId &&
                  !personJoined &&
                  !declinedIds.has(person.userId);
                const stream =
                  person.userId === currentUser.userId
                    ? localStream
                    : participant
                      ? (remoteStreams[participant.connectionId] ?? null)
                      : null;
                return (
                  <article
                    className={`social-call-person${personJoined ? ' joined' : ' waiting'}`}
                    key={person.userId}
                    onContextMenu={(event) => {
                      if (person.userId === currentUser.userId) return;
                      event.preventDefault();
                      event.stopPropagation();
                      setVolumeMenu({
                        person,
                        left: Math.max(8, Math.min(event.clientX, window.innerWidth - 270)),
                        top: Math.max(8, Math.min(event.clientY, window.innerHeight - 112)),
                      });
                    }}
                  >
                    {stream?.getVideoTracks().some((track) => track.readyState === 'live') ? (
                      <>
                        <CallMedia
                          stream={stream}
                          muted
                          outputDeviceId={voicePreferences.audioOutputDeviceId}
                          outputVolume={voicePreferences.audioOutputVolume}
                        />
                        <button
                          className="social-call-expand-media"
                          onClick={() => setFocusedMedia({ person, stream })}
                          aria-label={messages.fullScreen}
                          title={messages.fullScreen}
                        >
                          <Maximize2 size={15} />
                        </button>
                      </>
                    ) : (
                      <CallAvatar person={person} ringing={ringing} />
                    )}
                    <strong>
                      {person.userId === currentUser.userId ? messages.you : person.displayName}
                    </strong>
                    <span>
                      {personJoined
                        ? messages.inCall
                        : declinedIds.has(person.userId)
                          ? messages.callDeclined
                          : messages.callRinging}
                    </span>
                  </article>
                );
              })}
            </div>
            {volumeMenu &&
              createPortal(
                <div
                  className="voice-user-volume-menu social-call-volume-menu"
                  style={{ left: volumeMenu.left, top: volumeMenu.top }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <header>
                    <Volume2 size={15} />
                    <strong>{messages.userVolume}</strong>
                    <b>{Math.round((participantVolumes[volumeMenu.person.userId] ?? 1) * 100)}%</b>
                  </header>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={(participantVolumes[volumeMenu.person.userId] ?? 1) * 100}
                    onChange={(event) =>
                      onParticipantVolume(
                        volumeMenu.person.userId,
                        Number(event.target.value) / 100,
                      )
                    }
                    aria-label={`${volumeMenu.person.displayName} ${messages.userVolume}`}
                  />
                </div>,
                document.body,
              )}
            {error && <div className="message-error">{error}</div>}
            <footer>
              {!joined ? (
                <button className="social-call-join" onClick={onJoin} disabled={joining}>
                  <Phone size={18} /> {joining ? messages.callConnecting : messages.joinCall}
                </button>
              ) : (
                <>
                  <button
                    className={muted ? 'off' : ''}
                    onClick={onMuted}
                    aria-label={messages.muteMicrophone}
                  >
                    {muted ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>
                  <button
                    className={!cameraOff ? 'active' : ''}
                    onClick={onCamera}
                    aria-label={messages.enableCamera}
                  >
                    {cameraOff ? <Camera size={20} /> : <CameraOff size={20} />}
                  </button>
                  <button
                    className={sharingScreen ? 'active' : ''}
                    onClick={onScreen}
                    aria-label={messages.startScreenShare}
                  >
                    <MonitorUp size={20} />
                  </button>
                  <button className="hangup" onClick={onLeave} aria-label={messages.leaveVoice}>
                    <PhoneOff size={20} />
                  </button>
                </>
              )}
            </footer>
          </>
        )}
      </section>
      {focusedMedia &&
        createPortal(
          <div className="social-call-media-backdrop" role="presentation">
            <section className="social-call-media-focus" role="dialog" aria-modal="true">
              <header>
                <span>
                  <Video size={18} />
                  <strong>{focusedMedia.person.displayName}</strong>
                </span>
                <div>
                  <button
                    aria-label={messages.pictureInPicture}
                    onClick={(event) => {
                      const video = event.currentTarget
                        .closest('.social-call-media-focus')
                        ?.querySelector('video');
                      if (video && document.pictureInPictureEnabled)
                        void video.requestPictureInPicture();
                    }}
                  >
                    <PictureInPicture2 size={18} />
                  </button>
                  <button
                    aria-label={messages.fullScreen}
                    onClick={(event) =>
                      void event.currentTarget
                        .closest('.social-call-media-focus')
                        ?.requestFullscreen()
                    }
                  >
                    <Maximize2 size={18} />
                  </button>
                  <button aria-label={messages.close} onClick={() => setFocusedMedia(null)}>
                    <X size={19} />
                  </button>
                </div>
              </header>
              <CallMedia
                stream={focusedMedia.stream}
                muted
                className="social-call-focused-video"
                outputDeviceId={voicePreferences.audioOutputDeviceId}
                outputVolume={voicePreferences.audioOutputVolume}
              />
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}

function CallAvatar({ person, ringing = false }: { person: CallPerson; ringing?: boolean }) {
  return (
    <div className={`social-call-avatar${ringing ? ' ringing' : ''}`}>
      <i />
      <i />
      <span>
        {person.avatarUrl ? (
          <img src={person.avatarUrl} alt="" />
        ) : (
          person.displayName.slice(0, 1).toUpperCase()
        )}
      </span>
    </div>
  );
}

function CallTone({
  src,
  outputDeviceId,
  volume,
}: {
  src: string;
  outputDeviceId: string;
  volume: number;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let cancelled = false;
    const media = audio as HTMLAudioElement & {
      setSinkId?: (deviceId: string) => Promise<void>;
    };
    const start = async () => {
      if (media.setSinkId) await media.setSinkId(outputDeviceId).catch(() => undefined);
      if (cancelled) return;
      audio.currentTime = 0;
      await audio.play().catch(() => undefined);
    };
    void start();
    return () => {
      cancelled = true;
      audio.pause();
      audio.currentTime = 0;
    };
  }, [outputDeviceId, src]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.max(0, Math.min(1, volume));
  }, [volume]);

  return <audio ref={audioRef} src={src} preload="auto" loop aria-hidden="true" />;
}

function CallMedia({
  stream,
  muted,
  audioOnly = false,
  outputDeviceId,
  outputVolume,
  className,
}: {
  stream: MediaStream;
  muted: boolean;
  audioOnly?: boolean;
  outputDeviceId: string;
  outputVolume: number;
  className?: string;
}) {
  const ref = useRef<HTMLMediaElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (element.srcObject !== stream) element.srcObject = stream;
    void element.play().catch(() => undefined);
    return () => {
      if (element.srcObject === stream) element.srcObject = null;
    };
  }, [stream]);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const media = element as HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> };
    if (media.setSinkId) void media.setSinkId(outputDeviceId).catch(() => undefined);
    media.volume = Math.max(0, Math.min(1, outputVolume));
  }, [outputDeviceId, outputVolume]);
  return audioOnly ? (
    <audio ref={ref as React.RefObject<HTMLAudioElement>} autoPlay muted={muted} />
  ) : (
    <video
      ref={ref as React.RefObject<HTMLVideoElement>}
      className={className}
      autoPlay
      playsInline
      muted={muted}
    />
  );
}
