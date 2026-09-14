import { z } from 'zod';
import { gameActivitySchema } from './game-activity.js';
import { securityLimits } from '@wapve/config';
import { twoFactorCodeSchema } from './auth.js';
import { effectivePresenceSchema, platformBadgeSchema } from './common.js';
import { serverPermissionSchema } from './moderation.js';
import { premiumPublicStyleSchema } from './premium.js';

const blockedDirectionalCharacters = /[\u202A-\u202E\u2066-\u2069]/u;

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 31 || (code >= 127 && code <= 159);
  });
}

export const serverNameSchema = z
  .string()
  .trim()
  .min(2, 'validation.serverNameTooShort')
  .max(100, 'validation.serverNameTooLong')
  .refine((value) => !hasControlCharacters(value), 'validation.serverNameControlCharacters')
  .refine((value) => !blockedDirectionalCharacters.test(value), 'validation.serverNameDirection');

export const serverDescriptionSchema = z
  .string()
  .trim()
  .max(300, 'validation.serverDescriptionTooLong')
  .refine((value) => !hasControlCharacters(value), 'validation.serverDescriptionControlCharacters')
  .refine(
    (value) => !blockedDirectionalCharacters.test(value),
    'validation.serverDescriptionDirection',
  );

export const serverTemplateSchema = z.enum(['CHAT', 'GAMING']);
export const serverTagBadgeSchema = z.enum([
  'WAVE',
  'COMPASS',
  'STAR',
  'SHIELD',
  'OCEAN_WAVE',
  'OCEAN_SHELL',
  'OCEAN_COMPASS',
  'OCEAN_CORAL',
  'NIGHT_MOON',
  'NIGHT_STAR',
  'NIGHT_COMET',
  'NIGHT_AURORA',
  'WILD_FOX',
  'WILD_OWL',
  'WILD_MOUNTAIN',
  'WILD_SPROUT',
  'PRESTIGE_GEM',
  'PRESTIGE_CROWN',
  'PRESTIGE_FLAME',
  'PRESTIGE_INFINITY',
]);
export const serverTagCodeSchema = z
  .string()
  .trim()
  .min(1, 'validation.serverTagTooShort')
  .max(4, 'validation.serverTagTooLong')
  .regex(/^[\p{L}\p{N}_-]{1,4}$/u, 'validation.invalidServerTag')
  .transform((value) => value.toLocaleUpperCase('tr-TR'));
export const serverTagSchema = z.object({
  serverId: z.string().uuid(),
  serverName: z.string(),
  code: serverTagCodeSchema,
  badge: serverTagBadgeSchema,
  color: z
    .string()
    .regex(/^#[a-f0-9]{6}$/iu)
    .transform((value) => value.toUpperCase()),
});
export const configureServerTagSchema = z.object({
  code: serverTagCodeSchema,
  badge: serverTagBadgeSchema,
  color: z
    .string()
    .regex(/^#[a-f0-9]{6}$/iu)
    .transform((value) => value.toUpperCase()),
});
export const selectServerTagSchema = z.object({ enabled: z.boolean() });
export const serverTagPreviewSchema = z.object({
  serverId: z.string().uuid(),
  publicId: z.string().regex(/^\d{15}$/u),
  name: z.string(),
  iconUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  description: z.string().nullable(),
  memberCount: z.number().int().nonnegative(),
  onlineCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  alreadyMember: z.boolean(),
});
export const createServerSchema = z.object({
  name: serverNameSchema,
  template: serverTemplateSchema.default('CHAT'),
});
export const updateServerSchema = z
  .object({
    name: serverNameSchema.optional(),
    description: serverDescriptionSchema.nullable().optional(),
    discoveryEnabled: z.boolean().optional(),
    afkChannelId: z.string().uuid().nullable().optional(),
    afkTimeoutSeconds: z.number().int().min(60).max(3_600).optional(),
    customInviteSlug: z
      .string()
      .trim()
      .toLowerCase()
      .min(6, 'validation.customInviteSlugTooShort')
      .max(32, 'validation.customInviteSlugTooLong')
      .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u, 'validation.invalidCustomInviteSlug')
      .nullable()
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'validation.emptyUpdate');
export const deleteServerSchema = z.object({
  currentPassword: z.string().min(1).max(securityLimits.passwordAuthenticationMax),
  code: twoFactorCodeSchema.optional(),
});
export const createServerInviteSchema = z.object({
  maxUses: z.number().int().min(1).max(1_000_000).default(1),
  expiresInHours: z.number().int().min(1).max(720).default(24),
  channelId: z.string().uuid().optional(),
});
export const WAPVE_INVITE_ORIGIN = 'https://wapve.cc';
const inviteCodePattern = /^[A-Za-z0-9_+-]{4,64}$/u;

export function serverInviteUrl(code: string): string {
  const normalized = code.trim();
  if (!inviteCodePattern.test(normalized)) throw new Error('Invalid Wapve invite code');
  return `${WAPVE_INVITE_ORIGIN}/${encodeURIComponent(normalized).replaceAll('%2B', '+')}`;
}

const inviteCodeInputSchema = z
  .string()
  .trim()
  .min(4)
  .max(256)
  .refine((value) => {
    if (inviteCodePattern.test(value)) return true;
    try {
      const url = new URL(value);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.port ||
        url.search ||
        url.hash
      )
        return false;
      const host = url.hostname.toLowerCase();
      if (host === 'wapve.cc' || host === 'www.wapve.cc')
        return /^\/[A-Za-z0-9_+-]{4,64}\/?$/u.test(url.pathname);
      if (host !== 'wapve.com' && host !== 'www.wapve.com') return false;
      return /^\/(?:invite\/)?[A-Za-z0-9_+-]{4,64}\/?$/u.test(url.pathname);
    } catch {
      return false;
    }
  }, 'validation.invalidServerInvite');
export const joinServerSchema = z.object({ code: inviteCodeInputSchema });
export const previewServerInviteSchema = joinServerSchema;
export const acceptServerInviteSchema = joinServerSchema;

export const serverRoleSchema = z.enum(['OWNER', 'MEMBER']);
export const serverSummarySchema = z.object({
  id: z.string().uuid(),
  publicId: z.string().regex(/^\d{15}$/u),
  name: z.string(),
  iconUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  description: z.string().nullable(),
  discoveryEnabled: z.boolean().default(false),
  ownerId: z.string().uuid(),
  role: serverRoleSchema,
  permissions: z.array(serverPermissionSchema),
  memberCount: z.number().int().nonnegative(),
  supportCount: z.number().int().nonnegative().default(0),
  supportLevel: z.number().int().min(0).max(3).default(0),
  woostSpent: z.number().int().nonnegative().default(0),
  availableWoost: z.number().int().nonnegative().default(0),
  unlimitedWoost: z.boolean().default(false),
  isOfficial: z.boolean().default(false),
  tagUnlocked: z.boolean().default(false),
  tagBadgePacks: z
    .array(z.enum(['OCEAN_PULSE', 'NIGHT_SKY', 'WILD_TRAIL', 'PRESTIGE']))
    .default([]),
  enhancedDiscoveryUnlocked: z.boolean().default(false),
  tagSelectedByMe: z.boolean().default(false),
  tag: serverTagSchema.nullable().default(null),
  customInviteSlug: z.string().nullable().default(null),
  afkChannelId: z.string().uuid().nullable(),
  afkTimeoutSeconds: z.number().int().min(60).max(3_600),
  createdAt: z.string().datetime(),
});
export const serverDiscoveryQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(60).default(48),
});
export const serverDiscoveryEntrySchema = z.object({
  id: z.string().uuid(),
  publicId: z.string().regex(/^\d{15}$/u),
  name: z.string(),
  iconUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  description: z.string().nullable(),
  memberCount: z.number().int().nonnegative(),
  onlineCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  isMember: z.boolean(),
});
export const joinDiscoveryServerSchema = z.object({ serverId: z.string().uuid() });
export const serverMemberSchema = z.object({
  id: z.string().uuid(),
  publicId: z.string().regex(/^\d{11}$/u),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  bannerUrl: z.string().nullable().optional(),
  status: effectivePresenceSchema,
  gameActivity: gameActivitySchema.nullable().optional(),
  customStatusText: z.string().nullable().optional(),
  customStatusEmoji: z.string().nullable().optional(),
  bio: z.string().max(190).nullable().optional(),
  system: z.boolean().default(false),
  badges: z.array(platformBadgeSchema).default([]),
  premium: premiumPublicStyleSchema.optional(),
  serverTag: serverTagSchema.nullable().optional(),
  role: serverRoleSchema,
  roles: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string().trim().min(1).max(32),
      color: z.string().regex(/^#[a-f0-9]{6}$/iu),
      hoist: z.boolean(),
      mentionable: z.boolean(),
      isEveryone: z.boolean(),
      position: z.number().int().nonnegative(),
      permissions: z.array(serverPermissionSchema),
    }),
  ),
  timeoutUntil: z.string().datetime().nullable(),
  timeoutReason: z.string().nullable(),
  createdAt: z.string().datetime().optional(),
  joinedAt: z.string().datetime(),
});

export const serverInviteSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  expiresAt: z.string().datetime(),
  maxUses: z.number().int().positive(),
  usedCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
  creator: z.object({
    id: z.string().uuid(),
    displayName: z.string(),
    username: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  channel: z
    .object({ id: z.string().uuid(), name: z.string(), type: z.enum(['TEXT', 'VOICE']) })
    .nullable(),
});

export const serverInviteTargetSchema = z.object({
  id: z.string().uuid(),
  publicId: z.string().regex(/^18\d{16}$/u),
  name: z.string(),
  type: z.enum(['TEXT', 'VOICE']),
});

export const serverInvitePreviewSchema = z.object({
  code: z.string(),
  expiresAt: z.string().datetime(),
  alreadyMember: z.boolean(),
  server: z.object({
    id: z.string().uuid(),
    publicId: z.string().regex(/^\d{15}$/u),
    name: z.string(),
    iconUrl: z.string().nullable(),
    bannerUrl: z.string().nullable(),
    description: z.string().nullable(),
    memberCount: z.number().int().nonnegative(),
    onlineCount: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
  }),
  channel: serverInviteTargetSchema.nullable(),
});

export const acceptedServerInviteSchema = z.object({
  server: serverSummarySchema,
  channel: serverInviteTargetSchema.nullable(),
});

export const serverInsightsQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .refine((value) => value === 7 || value === 14 || value === 30)
    .default(7),
});

export const serverInsightsDailyPointSchema = z.object({
  date: z.string(),
  messages: z.number().int().nonnegative(),
  joins: z.number().int().nonnegative(),
  activeMembers: z.number().int().nonnegative(),
});

export const serverInsightsTopChannelSchema = z.object({
  channelId: z.string().uuid(),
  channelName: z.string(),
  messageCount: z.number().int().nonnegative(),
});

export const serverInsightsSchema = z.object({
  serverId: z.string().uuid(),
  days: z.number().int(),
  totals: z.object({
    memberCount: z.number().int().nonnegative(),
    joinsLast7Days: z.number().int().nonnegative(),
    messagesToday: z.number().int().nonnegative(),
    messagesLast7Days: z.number().int().nonnegative(),
    messagesLast30Days: z.number().int().nonnegative(),
    activeMembersLast7Days: z.number().int().nonnegative(),
    textChannelCount: z.number().int().nonnegative(),
    voiceChannelCount: z.number().int().nonnegative(),
    onlineCount: z.number().int().nonnegative(),
  }),
  daily: z.array(serverInsightsDailyPointSchema),
  topChannels: z.array(serverInsightsTopChannelSchema),
});

export type CreateServerInput = z.infer<typeof createServerSchema>;
export type ServerTemplate = z.infer<typeof serverTemplateSchema>;
export type UpdateServerInput = z.infer<typeof updateServerSchema>;
export type ServerDiscoveryQuery = z.infer<typeof serverDiscoveryQuerySchema>;
export type ServerDiscoveryEntry = z.infer<typeof serverDiscoveryEntrySchema>;
export type JoinDiscoveryServerInput = z.infer<typeof joinDiscoveryServerSchema>;
export type ServerTag = z.infer<typeof serverTagSchema>;
export type ServerTagBadge = z.infer<typeof serverTagBadgeSchema>;
export type ConfigureServerTagInput = z.infer<typeof configureServerTagSchema>;
export type SelectServerTagInput = z.infer<typeof selectServerTagSchema>;
export type ServerTagPreview = z.infer<typeof serverTagPreviewSchema>;
export type DeleteServerInput = z.infer<typeof deleteServerSchema>;
export type CreateServerInviteInput = z.infer<typeof createServerInviteSchema>;
export type JoinServerInput = z.infer<typeof joinServerSchema>;
export type PreviewServerInviteInput = z.infer<typeof previewServerInviteSchema>;
export type AcceptServerInviteInput = z.infer<typeof acceptServerInviteSchema>;
export type ServerSummary = z.infer<typeof serverSummarySchema>;
export type ServerMember = z.infer<typeof serverMemberSchema>;
export type ServerInvite = z.infer<typeof serverInviteSchema>;
export type ServerInvitePreview = z.infer<typeof serverInvitePreviewSchema>;
export type AcceptedServerInvite = z.infer<typeof acceptedServerInviteSchema>;
export type ServerInsightsQuery = z.infer<typeof serverInsightsQuerySchema>;
export type ServerInsightsDailyPoint = z.infer<typeof serverInsightsDailyPointSchema>;
export type ServerInsightsTopChannel = z.infer<typeof serverInsightsTopChannelSchema>;
export type ServerInsights = z.infer<typeof serverInsightsSchema>;
