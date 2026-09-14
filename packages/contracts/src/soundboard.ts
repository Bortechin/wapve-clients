import { z } from 'zod';

export const serverSoundSchema = z.object({
  id: z.string().uuid(),
  serverId: z.string().uuid(),
  name: z.string().min(1).max(32),
  emoji: z.string().min(1).max(120),
  volume: z.number().int().min(0).max(200),
  durationMs: z.number().int().positive().nullable(),
  audioUrl: z.string(),
  favorite: z.boolean().default(false),
  createdAt: z.string().datetime(),
  uploader: z.object({
    id: z.string().uuid(),
    displayName: z.string(),
  }),
});

export const uploadServerSoundQuerySchema = z.object({
  name: z.string().trim().min(1).max(32),
  emoji: z.string().trim().min(1).max(120).default('🔊'),
  volume: z.coerce.number().int().min(0).max(200).default(100),
  clipStartMs: z.coerce.number().int().min(0).max(86_400_000).default(0),
  clipDurationMs: z.coerce.number().int().min(250).max(6_000).default(6_000),
});

export const playServerSoundSchema = z.object({
  soundId: z.string().uuid(),
  volume: z.number().int().min(0).max(200).optional(),
});

export type ServerSound = z.infer<typeof serverSoundSchema>;
export type UploadServerSoundQuery = z.infer<typeof uploadServerSoundQuerySchema>;
export type PlayServerSoundInput = z.infer<typeof playServerSoundSchema>;
