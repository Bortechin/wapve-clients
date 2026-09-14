import { z } from 'zod';
import { gameActivitySchema } from './game-activity.js';
import { effectivePresenceSchema } from './common.js';

export const presenceWatchSchema = z.object({
  userIds: z.array(z.string().uuid()).max(500),
});

export const presenceUpdateSchema = z.object({
  userId: z.string().uuid(),
  status: effectivePresenceSchema,
  gameActivity: gameActivitySchema.nullable().optional(),
  customStatusText: z.string().nullable().optional(),
  customStatusEmoji: z.string().nullable().optional(),
});

export const presenceSnapshotSchema = z.array(presenceUpdateSchema);

export type PresenceWatch = z.infer<typeof presenceWatchSchema>;
export type PresenceUpdate = z.infer<typeof presenceUpdateSchema>;
