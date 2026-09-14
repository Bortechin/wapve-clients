import { z } from 'zod';
import { contentReportReasonSchema, contentReportTargetTypeSchema } from './content-report.js';
import { socialUserSchema } from './social.js';

export const notificationTypeSchema = z.enum([
  'MENTION',
  'CHANNEL_MESSAGE',
  'DIRECT_MESSAGE',
  'FRIEND_REQUEST',
  'SERVER_MEMBER_JOINED',
  'VOICE_CHANNEL_JOINED',
  'MODERATION_ACTION',
  'CONTENT_REPORT',
]);

export const notificationLevelSchema = z.enum(['ALL_MESSAGES', 'MENTIONS_ONLY', 'NOTHING']);

export const notificationMuteSchema = z.enum([
  'UNMUTED',
  'MINUTES_15',
  'HOUR_1',
  'HOURS_3',
  'HOURS_8',
  'HOURS_24',
  'FOREVER',
]);

export const serverNotificationPreferenceSchema = z.object({
  level: notificationLevelSchema,
  mutedUntil: z.string().datetime().nullable(),
  mutedIndefinitely: z.boolean(),
  mutePreset: notificationMuteSchema.nullable(),
  isMuted: z.boolean(),
});

export const channelNotificationPreferenceSchema = z.object({
  level: notificationLevelSchema.nullable(),
  effectiveLevel: notificationLevelSchema,
  mutedUntil: z.string().datetime().nullable(),
  mutedIndefinitely: z.boolean(),
  mutePreset: notificationMuteSchema.nullable(),
  isMuted: z.boolean(),
});

export const updateServerNotificationPreferenceSchema = z
  .object({
    level: notificationLevelSchema.optional(),
    mute: notificationMuteSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'validation.emptyUpdate');

export const updateChannelNotificationPreferenceSchema = z
  .object({
    level: notificationLevelSchema.nullable().optional(),
    mute: notificationMuteSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'validation.emptyUpdate');

export const notificationListQuerySchema = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export const notificationSchema = z.object({
  id: z.string().uuid(),
  type: notificationTypeSchema,
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  actor: socialUserSchema.omit({ status: true }).nullable(),
  server: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  channel: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  conversationId: z.string().uuid().nullable(),
  messageId: z.string().uuid().nullable(),
  moderation: z
    .object({
      action: z.enum(['WARN', 'TIMEOUT', 'KICK', 'BAN', 'AUTOMOD_WARN', 'AUTOMOD_TIMEOUT']),
      reason: z.string().nullable(),
      durationMinutes: z.number().int().positive().nullable(),
    })
    .nullable()
    .optional(),
  contentReport: z
    .object({
      reportId: z.string().uuid(),
      targetType: contentReportTargetTypeSchema,
      reason: contentReportReasonSchema,
    })
    .nullable()
    .optional(),
});

export const notificationPageSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: z.string().uuid().nullable(),
  unreadCount: z.number().int().nonnegative(),
});

export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type NotificationLevel = z.infer<typeof notificationLevelSchema>;
export type NotificationMute = z.infer<typeof notificationMuteSchema>;
export type ServerNotificationPreference = z.infer<typeof serverNotificationPreferenceSchema>;
export type ChannelNotificationPreference = z.infer<typeof channelNotificationPreferenceSchema>;
export type UpdateServerNotificationPreferenceInput = z.infer<
  typeof updateServerNotificationPreferenceSchema
>;
export type UpdateChannelNotificationPreferenceInput = z.infer<
  typeof updateChannelNotificationPreferenceSchema
>;
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type AppNotification = z.infer<typeof notificationSchema>;
export type NotificationPage = z.infer<typeof notificationPageSchema>;
