import { describe, expect, it } from 'vitest';
import {
  voiceChannelConfigSchema,
  voiceDiagnosticSchema,
  voiceIceConfigurationSchema,
  voiceJoinSchema,
  voiceSignalSchema,
  voiceStateSchema,
} from './voice.js';

describe('voice contracts', () => {
  const channelId = '018f0d7a-91ab-7abc-8def-0123456789ab';

  it('validates join and local voice state payloads', () => {
    expect(voiceJoinSchema.safeParse({ channelId }).success).toBe(true);
    expect(voiceStateSchema.safeParse({ muted: true, deafened: false }).success).toBe(true);
    expect(
      voiceStateSchema.safeParse({
        muted: false,
        deafened: false,
        videoMode: 'screen',
        videoPaused: true,
      }).success,
    ).toBe(true);
  });

  it('bounds published voice channel configuration', () => {
    expect(
      voiceChannelConfigSchema.safeParse({ channelId, userLimit: 50, bitrateKbps: 384 }).success,
    ).toBe(true);
    expect(
      voiceChannelConfigSchema.safeParse({ channelId, userLimit: 51, bitrateKbps: 384 }).success,
    ).toBe(false);
  });

  it('requires a bounded signal body', () => {
    expect(
      voiceSignalSchema.safeParse({
        targetConnectionId: 'socket-2',
        description: { type: 'offer', sdp: 'v=0' },
      }).success,
    ).toBe(true);
    expect(voiceSignalSchema.safeParse({ targetConnectionId: 'socket-2' }).success).toBe(false);
  });

  it('validates temporary ICE configuration without accepting arbitrary credentials', () => {
    expect(
      voiceIceConfigurationSchema.safeParse({
        iceServers: [
          { urls: ['stun:turn.wapve.test:3478'] },
          {
            urls: ['turn:turn.wapve.test:3478?transport=udp'],
            username: '1787187600:user-id',
            credential: 'temporary-credential',
          },
        ],
        turnEnabled: true,
        iceTransportPolicy: 'relay',
        expiresAt: '2026-08-20T01:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('restricts diagnostics to non-sensitive connection metadata', () => {
    expect(
      voiceDiagnosticSchema.safeParse({
        event: 'PEER_CONNECTION_FAILED',
        connectionState: 'failed',
        signalingState: 'have-local-offer',
        errorName: 'InvalidStateError',
        candidateType: 'relay',
      }).success,
    ).toBe(true);
    expect(
      voiceDiagnosticSchema.safeParse({
        event: 'PEER_CONNECTION_FAILED',
        sdp: 'must not be accepted',
      }).success,
    ).toBe(false);
  });
});
