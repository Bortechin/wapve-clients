import { describe, expect, it } from 'vitest';
import { hasSpeakingVolume } from './voice-activity';
import {
  classifyVoiceTransport,
  iceCandidateMatchesRemoteDescription,
  isCanonicalTurnUri,
  isPrivateVoiceConfiguration,
} from './voice-network';

describe('voice activity detection', () => {
  it('separates silence from speaking-level audio samples', () => {
    expect(hasSpeakingVolume(new Uint8Array(64).fill(128))).toBe(false);
    expect(hasSpeakingVolume(new Uint8Array(64).fill(150))).toBe(true);
  });

  it('does not classify an empty stream as speaking', () => {
    expect(hasSpeakingVolume(new Uint8Array())).toBe(false);
  });
});

describe('voice network path classification', () => {
  it('prefers relayed when any selected candidate uses TURN', () => {
    expect(classifyVoiceTransport(['host', 'relay'])).toBe('RELAYED');
  });

  it('distinguishes direct and not-yet-selected paths', () => {
    expect(classifyVoiceTransport(['srflx', 'host'])).toBe('DIRECT');
    expect(classifyVoiceTransport([])).toBe('CHECKING');
  });
});

describe('private voice configuration', () => {
  const privateConfiguration = {
    turnEnabled: true,
    iceTransportPolicy: 'relay' as const,
    expiresAt: '2026-08-20T00:00:00.000Z',
    iceServers: [
      {
        urls: ['turn:localhost:3478?transport=udp'],
        username: 'temporary-user',
        credential: 'temporary-credential',
      },
    ],
  };

  it('accepts authenticated relay-only TURN configuration', () => {
    expect(isPrivateVoiceConfiguration(privateConfiguration)).toBe(true);
  });

  it('rejects URL-style TURN syntax before it reaches RTCPeerConnection', () => {
    expect(isCanonicalTurnUri('turns:turn.example.com:5349?transport=tcp')).toBe(true);
    expect(isCanonicalTurnUri('turns://turn.example.com:5349?transport=tcp')).toBe(false);
    expect(
      isPrivateVoiceConfiguration({
        ...privateConfiguration,
        iceServers: [
          {
            ...privateConfiguration.iceServers[0]!,
            urls: ['turns://turn.example.com:5349?transport=tcp'],
          },
        ],
      }),
    ).toBe(false);
  });

  it('rejects direct, STUN and unauthenticated configuration', () => {
    expect(
      isPrivateVoiceConfiguration({ ...privateConfiguration, iceTransportPolicy: 'all' }),
    ).toBe(false);
    expect(
      isPrivateVoiceConfiguration({
        ...privateConfiguration,
        iceServers: [{ urls: ['stun:localhost:3478'] }],
      }),
    ).toBe(false);
  });
});

describe('ICE generation matching', () => {
  const remoteSdp = 'v=0\r\na=ice-ufrag:current-generation\r\n';

  it('accepts candidates from the active remote ICE generation', () => {
    expect(
      iceCandidateMatchesRemoteDescription(
        {
          candidate: 'candidate:1 1 udp 1 127.0.0.1 3478 typ relay',
          usernameFragment: 'current-generation',
        },
        remoteSdp,
      ),
    ).toBe(true);
  });

  it('drops a late candidate from a previous ICE restart', () => {
    expect(
      iceCandidateMatchesRemoteDescription(
        { candidate: 'candidate:1 1 udp 1 127.0.0.1 3478 typ relay ufrag old-generation' },
        remoteSdp,
      ),
    ).toBe(false);
  });

  it('keeps compatibility when a browser omits the ICE username fragment', () => {
    expect(
      iceCandidateMatchesRemoteDescription(
        { candidate: 'candidate:1 1 udp 1 127.0.0.1 3478 typ relay' },
        remoteSdp,
      ),
    ).toBe(true);
  });
});
