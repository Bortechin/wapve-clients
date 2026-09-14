import { z } from 'zod';

const blockedDirectionalCharacters = /[\u202A-\u202E\u2066-\u2069]/u;

function safeLabel(minimum: number, maximum: number, key: string) {
  return z
    .string()
    .trim()
    .min(minimum, `validation.${key}TooShort`)
    .max(maximum, `validation.${key}TooLong`)
    .refine(
      (value) =>
        ![...value].some((character) => {
          const code = character.codePointAt(0) ?? 0;
          return code <= 31 || (code >= 127 && code <= 159);
        }),
      `validation.${key}ControlCharacters`,
    )
    .refine((value) => !blockedDirectionalCharacters.test(value), `validation.${key}Direction`);
}

export const categoryNameSchema = safeLabel(1, 100, 'categoryName');
export const channelNameSchema = safeLabel(1, 50, 'channelName');
export const channelTopicSchema = z
  .string()
  .trim()
  .max(500, 'validation.channelTopicTooLong')
  .refine(
    (value) =>
      ![...value].some((character) => {
        const code = character.codePointAt(0) ?? 0;
        return (
          (code <= 31 && character !== '\n' && character !== '\r' && character !== '\t') ||
          (code >= 127 && code <= 159)
        );
      }),
    'validation.channelTopicControlCharacters',
  )
  .refine((value) => !blockedDirectionalCharacters.test(value), 'validation.channelTopicDirection');
export const channelTypeSchema = z.enum(['TEXT', 'VOICE']);
export const channelPermissionSchema = z.enum([
  'VIEW_CHANNEL',
  'MANAGE_CHANNELS',
  'SEND_MESSAGES',
  'ATTACH_FILES',
  'USE_GIFS',
  'USE_EXTERNAL_EMOJIS',
  'USE_SOUNDBOARD',
  'USE_EXTERNAL_SOUNDS',
  'ADD_REACTIONS',
  'CREATE_POLLS',
  'CONNECT',
  'SPEAK',
  'USE_CAMERA',
  'SHARE_SCREEN',
]);

export const createCategorySchema = z.object({ name: categoryNameSchema });
export const updateCategorySchema = z.object({ name: categoryNameSchema });
export const reorderCategoriesSchema = z.object({
  categoryIds: z.array(z.string().uuid()).max(100),
});

export const createChannelSchema = z.object({
  name: channelNameSchema,
  type: channelTypeSchema,
  nsfw: z.boolean().default(false),
});
export const duplicateChannelSchema = z.object({ name: channelNameSchema });
export const updateChannelSchema = z
  .object({
    name: channelNameSchema.optional(),
    topic: channelTopicSchema.nullable().optional(),
    slowModeSeconds: z.number().int().nonnegative().optional(),
    nsfw: z.boolean().optional(),
    userLimit: z.number().int().min(0).max(50).optional(),
    bitrateKbps: z.number().int().min(8).max(384).optional(),
    categoryId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'validation.emptyUpdate');
export const reorderChannelsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        categoryId: z.string().uuid().nullable(),
        position: z.number().int().min(0).max(499),
      }),
    )
    .min(1)
    .max(500)
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length, {
      message: 'validation.duplicateChannel',
    }),
});

export const channelPermissionMapSchema = z.object({
  VIEW_CHANNEL: z.boolean(),
  MANAGE_CHANNELS: z.boolean(),
  SEND_MESSAGES: z.boolean(),
  ATTACH_FILES: z.boolean(),
  USE_GIFS: z.boolean(),
  USE_EXTERNAL_EMOJIS: z.boolean().optional(),
  USE_SOUNDBOARD: z.boolean().optional(),
  USE_EXTERNAL_SOUNDS: z.boolean().optional(),
  ADD_REACTIONS: z.boolean(),
  CREATE_POLLS: z.boolean(),
  CONNECT: z.boolean(),
  SPEAK: z.boolean(),
  USE_CAMERA: z.boolean(),
  SHARE_SCREEN: z.boolean(),
});
export const channelPermissionValueSchema = z.enum(['INHERIT', 'ALLOW', 'DENY']);
export const channelPermissionOverrideMapSchema = z.object({
  VIEW_CHANNEL: channelPermissionValueSchema,
  MANAGE_CHANNELS: channelPermissionValueSchema,
  SEND_MESSAGES: channelPermissionValueSchema,
  ATTACH_FILES: channelPermissionValueSchema,
  USE_GIFS: channelPermissionValueSchema,
  USE_EXTERNAL_EMOJIS: channelPermissionValueSchema.optional(),
  USE_SOUNDBOARD: channelPermissionValueSchema.optional(),
  USE_EXTERNAL_SOUNDS: channelPermissionValueSchema.optional(),
  ADD_REACTIONS: channelPermissionValueSchema,
  CREATE_POLLS: channelPermissionValueSchema,
  CONNECT: channelPermissionValueSchema,
  SPEAK: channelPermissionValueSchema,
  USE_CAMERA: channelPermissionValueSchema,
  SHARE_SCREEN: channelPermissionValueSchema,
});
export const channelPermissionTargetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('EVERYONE') }),
  z.object({ type: z.literal('ROLE'), roleId: z.string().uuid() }),
  z.object({ type: z.literal('USER'), userId: z.string().uuid() }),
]);
export const channelPermissionTargetStateSchema = z.object({
  target: channelPermissionTargetSchema,
  permissions: channelPermissionOverrideMapSchema,
});
export const updateChannelPermissionsSchema = z.object({
  targets: z
    .array(channelPermissionTargetStateSchema)
    .min(1)
    .max(501)
    .refine(
      (targets) =>
        new Set(
          targets.map(({ target }) =>
            target.type === 'EVERYONE'
              ? 'EVERYONE'
              : `${target.type}:${target.type === 'ROLE' ? target.roleId : target.userId}`,
          ),
        ).size === targets.length,
      'validation.duplicatePermissionTarget',
    ),
});
export const channelPermissionSettingsSchema = z.object({
  targets: z.array(channelPermissionTargetStateSchema),
});

export const channelCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  position: z.number().int().nonnegative(),
});
export const serverChannelSchema = z.object({
  id: z.string().uuid(),
  publicId: z.string().regex(/^18\d{16}$/u),
  serverId: z.string().uuid(),
  categoryId: z.string().uuid().nullable(),
  name: z.string(),
  topic: z.string().nullable(),
  slowModeSeconds: z.number().int().nonnegative(),
  nsfw: z.boolean(),
  userLimit: z.number().int().min(0).max(50),
  bitrateKbps: z.number().int().min(8).max(384),
  type: channelTypeSchema,
  position: z.number().int().nonnegative(),
  permissions: channelPermissionMapSchema,
  memberPermissions: channelPermissionMapSchema.nullable(),
});
export const channelTreeSchema = z.object({
  categories: z.array(channelCategorySchema),
  channels: z.array(serverChannelSchema),
});

export type ChannelType = z.infer<typeof channelTypeSchema>;
export type ChannelPermission = z.infer<typeof channelPermissionSchema>;
export type ChannelPermissionMap = z.infer<typeof channelPermissionMapSchema>;
export type ChannelPermissionValue = z.infer<typeof channelPermissionValueSchema>;
export type ChannelPermissionOverrideMap = z.infer<typeof channelPermissionOverrideMapSchema>;
export type ChannelPermissionTarget = z.infer<typeof channelPermissionTargetSchema>;
export type ChannelPermissionTargetState = z.infer<typeof channelPermissionTargetStateSchema>;
export type ChannelPermissionSettings = z.infer<typeof channelPermissionSettingsSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type DuplicateChannelInput = z.infer<typeof duplicateChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
export type ReorderChannelsInput = z.infer<typeof reorderChannelsSchema>;
export type UpdateChannelPermissionsInput = z.infer<typeof updateChannelPermissionsSchema>;
export type ChannelCategory = z.infer<typeof channelCategorySchema>;
export type ServerChannel = z.infer<typeof serverChannelSchema>;
export type ChannelTree = z.infer<typeof channelTreeSchema>;
