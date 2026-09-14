import { z } from 'zod';

export const platformBadgeSchema = z.enum([
  'PLATFORM_OWNER',
  'ALPHA_MEMBER',
  'SYSTEM',
  'STAFF',
  'MODERATOR',
  'DEVELOPER',
  'SUPPORT',
  'PARTNER',
  'VERIFIED_CREATOR',
  'EARLY_SUPPORTER',
  'BUG_HUNTER',
  'COMMUNITY_CHAMPION',
  'SERVER_SURFER',
]);

export const platformStaffRoleSchema = z.enum([
  'SUPPORT',
  'MODERATOR',
  'SECURITY',
  'BILLING',
  'ANALYST',
]);
export type PlatformStaffRole = z.infer<typeof platformStaffRoleSchema>;

export type PlatformBadge = z.infer<typeof platformBadgeSchema>;

export const localeSchema = z.enum(['tr', 'en']);
export const presenceStatusSchema = z.enum(['ONLINE', 'IDLE', 'DND', 'INVISIBLE']);
export const effectivePresenceSchema = z.enum(['ONLINE', 'IDLE', 'DND', 'INVISIBLE', 'OFFLINE']);

export const apiFieldErrorSchema = z.object({
  path: z.string(),
  messageKey: z.string(),
});

export const apiErrorSchema = z.object({
  code: z.string(),
  messageKey: z.string(),
  fieldErrors: z.array(apiFieldErrorSchema).optional(),
  requestId: z.string().optional(),
  retryAfterSeconds: z.number().int().positive().optional(),
  availableAt: z.string().datetime().optional(),
  remainingSeconds: z.number().int().nonnegative().optional(),
});

export type Locale = z.infer<typeof localeSchema>;
export type PresenceStatus = z.infer<typeof presenceStatusSchema>;
export type EffectivePresence = z.infer<typeof effectivePresenceSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
