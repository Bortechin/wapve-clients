import { z } from 'zod';

export const voiceJoinSchema = z.object({ channelId: z.string().uuid() });
export const voiceWatchSchema = z.object({ serverId: z.string().uuid() });
export const voiceStateSchema = z.object({
  muted: z.boolean(),
  deafened: z.boolean(),
  videoMode: z.enum(['camera', 'screen']).nullable().optional(),
  videoPaused: z.boolean().optional(),
});

export const voiceIceServerSchema = z.object({
  urls: z.array(z.string().min(1).max(2_048)).min(1).max(8),
  username: z.string().min(1).max(256).optional(),
  credential: z.string().min(1).max(512).optional(),
});

export const voiceIceConfigurationSchema = z.object({
  iceServers: z.array(voiceIceServerSchema).max(8),
  turnEnabled: z.boolean(),
  iceTransportPolicy: z.enum(['all', 'relay']),
  expiresAt: z.iso.datetime().nullable(),
});

export const voiceDiagnosticSchema = z
  .object({
    event: z.enum([
      'ICE_CONFIGURATION_FAILED',
      'SOCKET_CONNECTION_FAILED',
      'SIGNALING_FAILED',
      'PEER_CONNECTION_FAILED',
      'ICE_RESTART_FAILED',
      'PRIVACY_POLICY_VIOLATION',
    ]),
    channelId: z.string().uuid().optional(),
    connectionState: z
      .enum(['new', 'connecting', 'connected', 'disconnected', 'failed', 'closed'])
      .optional(),
    iceConnectionState: z
      .enum(['new', 'checking', 'connected', 'completed', 'failed', 'disconnected', 'closed'])
      .optional(),
    signalingState: z
      .enum([
        'stable',
        'have-local-offer',
        'have-remote-offer',
        'have-local-pranswer',
        'have-remote-pranswer',
        'closed',
      ])
      .optional(),
    errorName: z
      .string()
      .regex(/^[A-Za-z][A-Za-z0-9]*$/)
      .max(64)
      .optional(),
    candidateType: z.enum(['host', 'srflx', 'prflx', 'relay']).optional(),
  })
  .strict();

const sessionDescriptionSchema = z.object({
  type: z.enum(['offer', 'answer', 'pranswer', 'rollback']),
  sdp: z.string().max(100_000).optional(),
});

const iceCandidateSchema = z.object({
  candidate: z.string().max(8_192),
  sdpMid: z.string().max(256).nullable().optional(),
  sdpMLineIndex: z.number().int().min(0).max(65_535).nullable().optional(),
  usernameFragment: z.string().max(256).nullable().optional(),
});

export const voiceSignalSchema = z
  .object({
    targetConnectionId: z.string().min(1).max(128),
    description: sessionDescriptionSchema.optional(),
    candidate: iceCandidateSchema.nullable().optional(),
  })
  .refine((value) => value.description !== undefined || value.candidate !== undefined);

export const voiceParticipantSchema = z.object({
  connectionId: z.string(),
  userId: z.string().uuid(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  muted: z.boolean(),
  deafened: z.boolean(),
  videoMode: z.enum(['camera', 'screen']).nullable(),
  videoPaused: z.boolean().default(false),
  canSpeak: z.boolean(),
});

export const voiceChannelSummarySchema = z.object({
  channelId: z.string().uuid(),
  participants: z.array(voiceParticipantSchema),
});

export const voiceChannelConfigSchema = z.object({
  channelId: z.string().uuid(),
  userLimit: z.number().int().min(0).max(50),
  bitrateKbps: z.number().int().min(8).max(384),
});

export type VoiceJoin = z.infer<typeof voiceJoinSchema>;
export type VoiceState = z.infer<typeof voiceStateSchema>;
export type VoiceSignal = z.infer<typeof voiceSignalSchema>;
export type VoiceParticipant = z.infer<typeof voiceParticipantSchema>;
export type VoiceChannelSummary = z.infer<typeof voiceChannelSummarySchema>;
export type VoiceChannelConfig = z.infer<typeof voiceChannelConfigSchema>;
export type VoiceIceServer = z.infer<typeof voiceIceServerSchema>;
export type VoiceIceConfiguration = z.infer<typeof voiceIceConfigurationSchema>;
export type VoiceDiagnostic = z.infer<typeof voiceDiagnosticSchema>;

export const voiceDisconnectUserSchema = z.object({
  targetUserId: z.string().uuid(),
  channelId: z.string().uuid(),
});

export const voiceServerMuteUserSchema = z.object({
  targetUserId: z.string().uuid(),
  channelId: z.string().uuid(),
  muted: z.boolean(),
});

export const voiceServerDeafenUserSchema = z.object({
  targetUserId: z.string().uuid(),
  channelId: z.string().uuid(),
  deafened: z.boolean(),
});

export type VoiceDisconnectUser = z.infer<typeof voiceDisconnectUserSchema>;
export type VoiceServerMuteUser = z.infer<typeof voiceServerMuteUserSchema>;
export type VoiceServerDeafenUser = z.infer<typeof voiceServerDeafenUserSchema>;

