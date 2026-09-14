import { z } from 'zod';
import { socialUserSchema } from './social.js';

const deliveryContentSchema = z.string().trim().min(1).max(2_500);

export const messageTargetSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('CHANNEL'),
    serverId: z.string().uuid(),
    channelId: z.string().uuid(),
  }).strict(),
  z.object({ kind: z.literal('DIRECT'), conversationId: z.string().uuid() }).strict(),
  z.object({ kind: z.literal('GROUP'), conversationId: z.string().uuid() }).strict(),
]);

export const messageSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('CHANNEL'),
    serverId: z.string().uuid(),
    channelId: z.string().uuid(),
    messageId: z.string().uuid(),
  }).strict(),
  z.object({
    kind: z.literal('DIRECT'),
    conversationId: z.string().uuid(),
    messageId: z.string().uuid(),
  }).strict(),
  z.object({
    kind: z.literal('GROUP'),
    conversationId: z.string().uuid(),
    messageId: z.string().uuid(),
  }).strict(),
]);

export const scheduledMessageInputSchema = z.object({
  target: messageTargetSchema,
  content: deliveryContentSchema,
  scheduledFor: z.string().datetime({ offset: true }),
});

export const scheduledMessageSchema = z.object({
  id: z.string().uuid(),
  target: messageTargetSchema,
  content: z.string(),
  scheduledFor: z.string().datetime(),
  status: z.enum(['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELED']),
  errorCode: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const forwardedMessageSnapshotSchema = z.object({
  source: messageSourceSchema,
  author: socialUserSchema.pick({
    id: true,
    username: true,
    displayName: true,
    avatarUrl: true,
  }),
  contextName: z.string().max(100),
  contextIconUrl: z.string().nullable(),
  excerpt: z.string().max(500).nullable(),
  createdAt: z.string().datetime(),
});

export const forwardMessageInputSchema = z.object({
  source: messageSourceSchema,
  targets: z
    .array(messageTargetSchema)
    .min(1)
    .max(10)
    .refine(
      (targets) => new Set(targets.map((target) => JSON.stringify(target))).size === targets.length,
      'validation.duplicateForwardTargets',
    ),
  note: deliveryContentSchema.max(500).optional(),
});

export const forwardTargetSchema = z.object({
  target: messageTargetSchema,
  name: z.string(),
  subtitle: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export const mutualConnectionsSchema = z.object({
  friendsVisible: z.boolean(),
  serversVisible: z.boolean(),
  friends: z.array(socialUserSchema),
  servers: z.array(
    z.object({
      id: z.string().uuid(),
      publicId: z.string(),
      name: z.string(),
      iconUrl: z.string().nullable(),
    }),
  ),
});

export type MessageTarget = z.infer<typeof messageTargetSchema>;
export type MessageSource = z.infer<typeof messageSourceSchema>;
export type ScheduledMessageInput = z.infer<typeof scheduledMessageInputSchema>;
export type ScheduledMessage = z.infer<typeof scheduledMessageSchema>;
export type ForwardedMessageSnapshot = z.infer<typeof forwardedMessageSnapshotSchema>;
export type ForwardMessageInput = z.infer<typeof forwardMessageInputSchema>;
export type ForwardTarget = z.infer<typeof forwardTargetSchema>;
export type MutualConnections = z.infer<typeof mutualConnectionsSchema>;
