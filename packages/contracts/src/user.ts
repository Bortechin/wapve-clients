import { z } from 'zod';
import { gameActivitySchema } from './game-activity.js';
import { displayNameSchema, usernameSchema } from './auth.js';
import {
  localeSchema,
  platformBadgeSchema,
  platformStaffRoleSchema,
  presenceStatusSchema,
} from './common.js';
import { premiumPublicStyleSchema } from './premium.js';
import { privacySettingsSchema } from './privacy.js';

export const serverLayoutItemSchema = z.object({
  type: z.enum(['server', 'folder']),
  id: z.string(), // server id or random folder id
  name: z.string().trim().max(40).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/iu)
    .optional(),
  serverIds: z
    .array(z.string().uuid())
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, 'validation.duplicateServers')
    .optional(),
  expanded: z.boolean().optional(),
});

export const pinnedSocialConversationSchema = z
  .string()
  .regex(/^(?:direct|group):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu);

const customServerStatusEmojiPattern =
  /^<:([A-Za-z0-9_]{2,32}):([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})>$/iu;

export function parseCustomServerStatusEmoji(value: string): { name: string; id: string } | null {
  const match = customServerStatusEmojiPattern.exec(value);
  return match?.[1] && match[2] ? { name: match[1].toLowerCase(), id: match[2] } : null;
}

export const customStatusEmojiSchema = z
  .string()
  .trim()
  .max(80, 'validation.customStatusEmojiTooLong')
  .refine(
    (value) =>
      Boolean(parseCustomServerStatusEmoji(value)) ||
      (value.length <= 32 &&
        !value.includes('<') &&
        !value.includes('>') &&
        ![...value].some((character) => {
          const code = character.codePointAt(0) ?? 0;
          return code <= 31 || (code >= 127 && code <= 159);
        })),
    'validation.invalidCustomStatusEmoji',
  );

export const updateProfileSchema = z
  .object({
    username: usernameSchema.optional(),
    displayName: displayNameSchema.optional(),
    locale: localeSchema.optional(),
    status: presenceStatusSchema.optional(),
    statusExpiresAt: z.string().datetime().nullable().optional(),
    customStatusText: z.string().max(128).nullable().optional(),
    customStatusEmoji: customStatusEmojiSchema.nullable().optional(),
    bio: z.string().max(190).nullable().optional(),
    autoConvertEmoticons: z.boolean().optional(),
    showBadgesInChat: z.boolean().optional(),
    showMutualFriends: z.boolean().optional(),
    showMutualServers: z.boolean().optional(),
    pinnedSocialConversations: z
      .array(pinnedSocialConversationSchema)
      .max(100)
      .refine((items) => new Set(items).size === items.length, 'validation.duplicatePins')
      .optional(),
    serverLayout: z.array(serverLayoutItemSchema).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'validation.emptyUpdate');

export const userProfileSchema = z.object({
  privacy: privacySettingsSchema.optional(),
  id: z.string().uuid(),
  publicId: z.string().regex(/^\d{11}$/u),
  email: z.string().email().nullable(),
  hasCredentials: z.boolean(),
  socialUnlockAt: z.string().datetime(),
  emailVerified: z.boolean(),
  twoFactorEnabled: z.boolean(),
  system: z.boolean().default(false),
  badges: z.array(platformBadgeSchema),
  platformStaffRole: platformStaffRoleSchema.nullable().default(null),
  premium: premiumPublicStyleSchema.optional(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  locale: localeSchema,
  status: presenceStatusSchema,
  statusExpiresAt: z.string().datetime().nullable(),
  gameActivity: gameActivitySchema.nullable().optional(),
  customStatusText: z.string().nullable(),
  customStatusEmoji: z.string().nullable(),
  bio: z.string().nullable(),
  autoConvertEmoticons: z.boolean(),
  showBadgesInChat: z.boolean(),
  showMutualFriends: z.boolean(),
  showMutualServers: z.boolean(),
  pinnedSocialConversations: z.array(pinnedSocialConversationSchema),
  serverLayout: z.array(serverLayoutItemSchema).nullable(),
  usernameChangedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  deletionRequestedAt: z.string().datetime().nullable(),
  deletionScheduledFor: z.string().datetime().nullable(),
});

export const sessionSchema = z.object({
  id: z.string().uuid(),
  current: z.boolean(),
  deviceName: z.string(),
  browserName: z.string(),
  osName: z.string(),
  countryCode: z.string().length(2).nullable(),
  loginMethod: z.enum(['PASSWORD', 'PASSWORD_2FA', 'PASSKEY', 'REGISTRATION']),
  suspicious: z.boolean(),
  createdAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export const requestAccountDeletionSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  code: z.string().trim().min(6).max(32).optional(),
  confirmation: z.literal('DELETE'),
});

export const authSessionSchema = z.object({
  user: userProfileSchema,
  csrfToken: z.string(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type UserSession = z.infer<typeof sessionSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type ServerLayoutItem = z.infer<typeof serverLayoutItemSchema>;
export type RequestAccountDeletionInput = z.infer<typeof requestAccountDeletionSchema>;
