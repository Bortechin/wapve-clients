import { z } from 'zod';
import {
  gifTokenSchema,
  messageAttachmentSchema,
  messageContentSchema,
  messageGifSchema,
  messageReactionSchema,
  messageReplySchema,
} from './message.js';
import { forwardedMessageSnapshotSchema } from './delivery.js';
import { notificationMuteSchema } from './notification.js';
import { socialUserSchema } from './social.js';

export const directMessageInputSchema = z.object({ content: messageContentSchema });
export const createDirectMessageSchema = z
  .object({
    content: messageContentSchema.optional(),
    gifToken: gifTokenSchema.optional(),
    replyToId: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.content || value.gifToken), {
    message: 'errors.messageContentRequired',
    path: ['content'],
  });
export const directAttachmentMessageQuerySchema = z.object({
  content: messageContentSchema.optional(),
  replyToId: z.string().uuid().optional(),
});
export const directMessageListQuerySchema = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const socialMessageSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});
export const socialCallJoinSchema = z.object({
  conversationId: z.string().uuid(),
  kind: z.enum(['direct', 'group']),
  mode: z.enum(['audio', 'video']).default('video'),
});
export type SocialCallJoin = z.infer<typeof socialCallJoinSchema>;

export const socialCallPersonSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
});

export const socialCallSessionSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  kind: z.enum(['direct', 'group']),
  mode: z.enum(['audio', 'video']),
  title: z.string(),
  caller: socialCallPersonSchema,
  invited: z.array(socialCallPersonSchema),
  joinedUserIds: z.array(z.string().uuid()),
  declinedUserIds: z.array(z.string().uuid()),
  startedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});
export type SocialCallSession = z.infer<typeof socialCallSessionSchema>;

export const createGroupConversationSchema = z.object({
  name: z.string().trim().min(2, 'validation.groupNameTooShort').max(50),
  memberIds: z
    .array(z.string().uuid())
    .min(1, 'validation.groupMembersMinimum')
    .max(9, 'validation.groupMembersMaximum')
    .refine((ids) => new Set(ids).size === ids.length, 'validation.groupMembersUnique'),
});

export const updateGroupConversationSchema = z.object({
  name: z.string().trim().min(2, 'validation.groupNameTooShort').max(50),
});

export const groupMemberInputSchema = z.object({ userId: z.string().uuid() });

export const groupNotificationPreferenceSchema = z.object({
  mutedUntil: z.string().datetime().nullable(),
  mutedIndefinitely: z.boolean(),
  isMuted: z.boolean(),
});

export const updateGroupNotificationPreferenceSchema = z.object({
  mute: notificationMuteSchema,
});

export const directMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  content: z.string().nullable(),
  systemAction: z.enum(['CALL_STARTED', 'CALL_ENDED']).nullable().optional(),
  systemDurationSeconds: z.number().int().min(0).nullable().optional(),
  deleted: z.boolean(),
  editedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  author: socialUserSchema.omit({ status: true }),
  replyTo: messageReplySchema.nullable(),
  reactions: z.array(messageReactionSchema),
  attachments: z.array(messageAttachmentSchema),
  gif: messageGifSchema.nullable(),
  forwardedFrom: forwardedMessageSnapshotSchema.nullable(),
});

export const directMessagePageSchema = z.object({
  items: z.array(directMessageSchema),
  nextCursor: z.string().uuid().nullable(),
  lastReadAt: z.string().datetime(),
});

export const directConversationSchema = z.object({
  inboxState: z.enum(['ACCEPTED', 'REQUEST', 'SPAM', 'DECLINED']).optional(),
  id: z.string().uuid(),
  otherUser: socialUserSchema,
  lastMessage: directMessageSchema.nullable(),
  lastMessageAt: z.string().datetime().nullable(),
  canMessage: z.boolean(),
  unreadCount: z.number().int().min(0),
  hidden: z.boolean().default(false),
});

export const groupMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  content: z.string().nullable(),
  systemAction: z.enum(['CALL_STARTED', 'CALL_ENDED']).nullable().optional(),
  systemDurationSeconds: z.number().int().min(0).nullable().optional(),
  deleted: z.boolean(),
  editedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  author: socialUserSchema.omit({ status: true }),
  replyTo: messageReplySchema.nullable(),
  reactions: z.array(messageReactionSchema),
  attachments: z.array(messageAttachmentSchema),
  gif: messageGifSchema.nullable(),
  forwardedFrom: forwardedMessageSnapshotSchema.nullable(),
});

export const groupMessagePageSchema = z.object({
  items: z.array(groupMessageSchema),
  nextCursor: z.string().uuid().nullable(),
  lastReadAt: z.string().datetime(),
});

export const groupConversationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  ownerId: z.string().uuid(),
  createdAt: z.string().datetime(),
  members: z.array(socialUserSchema).min(2).max(10),
  lastMessage: groupMessageSchema.nullable(),
  lastMessageAt: z.string().datetime().nullable(),
  unreadCount: z.number().int().min(0),
});

export const directMessageContextSchema = z.object({
  items: z.array(directMessageSchema),
  targetId: z.string().uuid(),
});

export const groupMessageContextSchema = z.object({
  items: z.array(groupMessageSchema),
  targetId: z.string().uuid(),
});

export const initiateDirectConversationSchema = z.object({
  recipientId: z.string().uuid(),
});

export type DirectMessageInput = z.infer<typeof directMessageInputSchema>;
export type CreateDirectMessageInput = z.infer<typeof createDirectMessageSchema>;
export type InitiateDirectConversationInput = z.infer<typeof initiateDirectConversationSchema>;
export type DirectAttachmentMessageQuery = z.infer<typeof directAttachmentMessageQuerySchema>;
export type DirectMessageListQuery = z.infer<typeof directMessageListQuerySchema>;
export type SocialMessageSearchQuery = z.infer<typeof socialMessageSearchQuerySchema>;
export type DirectMessage = z.infer<typeof directMessageSchema>;
export type DirectMessagePage = z.infer<typeof directMessagePageSchema>;
export type DirectConversation = z.infer<typeof directConversationSchema>;
export type CreateGroupConversationInput = z.infer<typeof createGroupConversationSchema>;
export type UpdateGroupConversationInput = z.infer<typeof updateGroupConversationSchema>;
export type GroupMemberInput = z.infer<typeof groupMemberInputSchema>;
export type GroupNotificationPreference = z.infer<typeof groupNotificationPreferenceSchema>;
export type UpdateGroupNotificationPreferenceInput = z.infer<
  typeof updateGroupNotificationPreferenceSchema
>;
export type GroupMessage = z.infer<typeof groupMessageSchema>;
export type GroupMessagePage = z.infer<typeof groupMessagePageSchema>;
export type GroupConversation = z.infer<typeof groupConversationSchema>;
export type DirectMessageContext = z.infer<typeof directMessageContextSchema>;
export type GroupMessageContext = z.infer<typeof groupMessageContextSchema>;
