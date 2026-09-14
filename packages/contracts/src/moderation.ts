import { z } from 'zod';

const blockedDirectionalCharacters = /[\u202A-\u202E\u2066-\u2069]/u;

export const serverPermissionSchema = z.enum([
  'MANAGE_SERVER',
  'MANAGE_ROLES',
  'MANAGE_AUTOMOD',
  'MANAGE_EXPRESSIONS',
  'USE_EXTERNAL_EMOJIS',
  'USE_SOUNDBOARD',
  'USE_EXTERNAL_SOUNDS',
  'CREATE_INVITES',
  'VIEW_AUDIT_LOG',
  'MENTION_EVERYONE',
  'KICK_MEMBERS',
  'BAN_MEMBERS',
  'TIMEOUT_MEMBERS',
  'MANAGE_CHANNELS',
  'MANAGE_MESSAGES',
  'VIEW_CHANNEL',
  'SEND_MESSAGES',
  'ATTACH_FILES',
  'USE_GIFS',
  'ADD_REACTIONS',
  'CREATE_POLLS',
  'CONNECT',
  'SPEAK',
  'USE_CAMERA',
  'SHARE_SCREEN',
]);

export const roleNameSchema = z
  .string()
  .trim()
  .min(1, 'validation.roleNameTooShort')
  .max(32, 'validation.roleNameTooLong')
  .refine(
    (value) =>
      ![...value].some((character) => {
        const code = character.codePointAt(0) ?? 0;
        return code <= 31 || (code >= 127 && code <= 159);
      }),
    'validation.roleNameControlCharacters',
  )
  .refine((value) => !blockedDirectionalCharacters.test(value), 'validation.roleNameDirection');

export const roleColorSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^#[0-9A-F]{6}$/u, 'validation.roleColor');

export const createServerRoleSchema = z.object({
  name: roleNameSchema,
  color: roleColorSchema.default('#3B82F6'),
  hoist: z.boolean().default(false),
  mentionable: z.boolean().default(false),
  permissions: z
    .array(serverPermissionSchema)
    .max(serverPermissionSchema.options.length)
    .refine((items) => new Set(items).size === items.length, 'validation.duplicatePermission')
    .default([]),
});

export const updateServerRoleSchema = createServerRoleSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'validation.emptyUpdate');

export const moderationReasonSchema = z.string().trim().max(512).optional();
export const moderationActionSchema = z.object({ reason: moderationReasonSchema });
export const warnMemberSchema = moderationActionSchema;
export const banMemberSchema = moderationActionSchema.extend({
  deleteMessageSeconds: z.enum(['0', '3600', '21600', '86400', '604800']).default('0'),
});
export const timeoutMemberSchema = z.object({
  durationMinutes: z.number().int().min(1).max(40_320).nullable(),
  reason: moderationReasonSchema,
});

export const customServerRoleSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: roleColorSchema,
  hoist: z.boolean(),
  mentionable: z.boolean(),
  isEveryone: z.boolean(),
  position: z.number().int().nonnegative(),
  permissions: z.array(serverPermissionSchema),
  memberCount: z.number().int().nonnegative(),
});

export const reorderRolesSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        position: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(50),
});

export const serverBanSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    username: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  moderatorId: z.string().uuid(),
  reason: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const autoModActionSchema = z.enum([
  'DELETE_MESSAGE',
  'WARN_USER',
  'TIMEOUT_5M',
  'TIMEOUT_30M',
  'TIMEOUT_1H',
]);

const unsafeRegexConstruct = /\\[1-9]|\(\?(?:[=!]|<[=!])|\(\?<[A-Za-z]|\([^)]*[+*][^)]*\)[+*{]/u;
export const autoModRegexPatternSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((pattern) => !unsafeRegexConstruct.test(pattern), 'validation.unsafeRegexPattern')
  .refine((pattern) => {
    try {
      void new RegExp(pattern, 'iu');
      return true;
    } catch {
      return false;
    }
  }, 'validation.invalidRegexPattern');

export const autoModConfigSchema = z.object({
  enabled: z.boolean(),
  bannedWords: z.array(z.string()),
  bannedWordsEnabled: z.boolean(),
  bannedWordsAction: autoModActionSchema,
  regexEnabled: z.boolean(),
  regexPatterns: z
    .array(autoModRegexPatternSchema)
    .max(25)
    .refine(
      (patterns) => new Set(patterns).size === patterns.length,
      'validation.duplicateRegexPattern',
    ),
  regexAction: autoModActionSchema,
  linkProtection: z.boolean(),
  linkProtectionAction: autoModActionSchema,
  allowedDomains: z.array(z.string().trim().min(1).max(253)).max(100),
  spamProtection: z.boolean(),
  spamMaxMessages: z.number().int().min(2).max(20),
  spamInterval: z.number().int().min(2).max(30),
  spamAction: autoModActionSchema,
  repeatedMessageProtection: z.boolean(),
  repeatedMessageMax: z.number().int().min(2).max(10),
  repeatedMessageInterval: z.number().int().min(5).max(120),
  repeatedMessageAction: autoModActionSchema,
  mentionSpamProtection: z.boolean(),
  mentionMaxCount: z.number().int().min(2).max(50),
  mentionAction: autoModActionSchema,
  capsProtection: z.boolean(),
  capsMinLength: z.number().int().min(5).max(50),
  capsPercentage: z.number().int().min(50).max(100),
  capsAction: autoModActionSchema,
  emojiSpamProtection: z.boolean(),
  emojiMaxCount: z.number().int().min(3).max(50),
  emojiAction: autoModActionSchema,
  exemptRoles: z.array(z.string().uuid()),
  exemptChannels: z.array(z.string().uuid()),
  logChannelId: z.string().uuid().nullable(),
});

export const updateAutoModConfigSchema = autoModConfigSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'validation.emptyUpdate');

export const auditLogQuerySchema = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
  action: z.string().trim().max(80).optional(),
  actorId: z.string().uuid().optional(),
  targetId: z.string().uuid().optional(),
});

const auditUserSchema = z.object({
  id: z.string().uuid().nullable(),
  username: z.string().nullable(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
});

export const serverAuditEventSchema = z.object({
  id: z.string().uuid(),
  action: z.string(),
  createdAt: z.string().datetime(),
  actor: auditUserSchema.nullable(),
  target: auditUserSchema.nullable(),
  channel: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  role: z.object({ id: z.string().uuid(), name: z.string(), color: roleColorSchema }).nullable(),
  reason: z.string().nullable(),
  durationMinutes: z.number().int().positive().nullable(),
});

export const serverAuditPageSchema = z.object({
  items: z.array(serverAuditEventSchema),
  nextCursor: z.string().uuid().nullable(),
});

export type ServerPermission = z.infer<typeof serverPermissionSchema>;
export type CreateServerRoleInput = z.infer<typeof createServerRoleSchema>;
export type UpdateServerRoleInput = z.infer<typeof updateServerRoleSchema>;
export type ModerationActionInput = z.infer<typeof moderationActionSchema>;
export type BanMemberInput = z.infer<typeof banMemberSchema>;
export type TimeoutMemberInput = z.infer<typeof timeoutMemberSchema>;
export type ReorderRolesInput = z.infer<typeof reorderRolesSchema>;
export type ServerRole = z.infer<typeof customServerRoleSchema>;
export type ServerBan = z.infer<typeof serverBanSchema>;
export type AutoModAction = z.infer<typeof autoModActionSchema>;
export type AutoModConfig = z.infer<typeof autoModConfigSchema>;
export type UpdateAutoModConfigInput = z.infer<typeof updateAutoModConfigSchema>;
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
export type ServerAuditEvent = z.infer<typeof serverAuditEventSchema>;
export type ServerAuditPage = z.infer<typeof serverAuditPageSchema>;
