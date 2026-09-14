import { z } from 'zod';
import { forwardedMessageSnapshotSchema } from './delivery.js';
import { platformBadgeSchema } from './common.js';
import { serverTagSchema } from './server.js';

const blockedDirectionalCharacters = /[\u202A-\u202E\u2066-\u2069]/u;

function hasSafeCharacters(value: string): boolean {
  return (
    !blockedDirectionalCharacters.test(value) &&
    ![...value].some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return (
        code <= 8 ||
        code === 11 ||
        code === 12 ||
        (code >= 14 && code <= 31) ||
        (code >= 127 && code <= 159)
      );
    })
  );
}

export const messageContentSchema = z
  .string()
  .trim()
  .min(1, 'validation.messageEmpty')
  // The API applies the 2,500-character member policy with an owner exemption.
  // Request-body limits remain the transport safety boundary for exempt owner messages.
  .refine(hasSafeCharacters, 'validation.messageCharacters');

const replyMentionSchema = z.preprocess(
  (value) => (value === 'true' ? true : value === 'false' ? false : value),
  z.boolean().default(true),
);

export const gifTokenSchema = z.string().min(32).max(8192);

export const linkPreviewInputSchema = z.object({
  url: z.string().url().max(2048),
});

export const linkPreviewSchema = z.object({
  url: z.string().url(),
  title: z.string().max(300),
  description: z.string().max(600).nullable(),
  siteName: z.string().max(120),
});

export type LinkPreviewInput = z.infer<typeof linkPreviewInputSchema>;
export type LinkPreview = z.infer<typeof linkPreviewSchema>;

export const internalMessagePreviewSchema = z.object({
  url: z.string().url(),
  kind: z.enum(['SERVER', 'DIRECT', 'GROUP']),
  author: z.object({
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  context: z.object({
    name: z.string(),
    iconUrl: z.string().nullable(),
  }),
  excerpt: z.string().max(240).nullable(),
});

export type InternalMessagePreview = z.infer<typeof internalMessagePreviewSchema>;

export const createMessageSchema = z
  .object({
    content: messageContentSchema.optional(),
    replyToId: z.string().uuid().nullable().optional(),
    mentionReplyAuthor: replyMentionSchema.optional(),
    gifToken: gifTokenSchema.optional(),
  })
  .refine((value) => Boolean(value.content || value.gifToken), {
    message: 'validation.messageEmpty',
    path: ['content'],
  });

export const updateMessageSchema = z.object({ content: messageContentSchema });

export const messageReactionInputSchema = z.object({
  emoji: z
    .string()
    .trim()
    .min(1, 'validation.emojiRequired')
    .max(80, 'validation.emojiTooLong')
    .refine(hasSafeCharacters, 'validation.emojiCharacters'),
});

export const messageListQuerySchema = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const messageSearchQuerySchema = z.object({
  q: z.string().trim().min(2, 'validation.searchTooShort').max(100),
  authorId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export const createPollSchema = z.object({
  question: z.string().trim().min(1, 'validation.pollQuestionRequired').max(300),
  options: z
    .array(z.string().trim().min(1, 'validation.pollOptionRequired').max(100))
    .min(2, 'validation.pollOptionsMinimum')
    .max(10, 'validation.pollOptionsMaximum')
    .refine(
      (options) =>
        new Set(options.map((option) => option.toLocaleLowerCase())).size === options.length,
      'validation.pollOptionsUnique',
    ),
  durationMinutes: z.union([
    z.literal(60),
    z.literal(240),
    z.literal(480),
    z.literal(1440),
    z.literal(4320),
    z.literal(10080),
  ]),
});

export const pollVoteSchema = z.object({ choiceId: z.string().uuid() });

export const attachmentMessageQuerySchema = z.object({
  content: messageContentSchema.optional(),
  replyToId: z.string().uuid().nullable().optional(),
  mentionReplyAuthor: replyMentionSchema.optional(),
});

export const chatJoinSchema = z.object({ channelId: z.string().uuid() });

export const messageAuthorSchema = z.object({
  id: z.string().uuid(),
  publicId: z.string().regex(/^\d{11}$/u),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  system: z.boolean().default(false),
  badges: z.array(platformBadgeSchema).default([]),
  serverTag: serverTagSchema.nullable().optional(),
});

export const messageReplySchema = z.object({
  id: z.string().uuid(),
  content: z.string().nullable(),
  deleted: z.boolean(),
  author: messageAuthorSchema,
});

export const messageReactionSchema = z.object({
  emoji: z.string(),
  count: z.number().int().positive(),
  reactedByMe: z.boolean(),
});

export const messageAttachmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  contentType: z.string(),
  size: z.number().int().positive(),
  kind: z.enum(['IMAGE', 'AUDIO', 'VIDEO', 'FILE']),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  url: z.string(),
});

export const messageGifSchema = z.object({
  provider: z.literal('KLIPY'),
  providerId: z.string(),
  alt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  url: z.string(),
});

export const messagePollSchema = z.object({
  question: z.string(),
  closesAt: z.string().datetime(),
  totalVotes: z.number().int().nonnegative(),
  choices: z.array(
    z.object({
      id: z.string().uuid(),
      text: z.string(),
      votes: z.number().int().nonnegative(),
      votedByMe: z.boolean(),
    }),
  ),
});

export const gifSearchQuerySchema = z.object({
  q: z.string().trim().max(100).default(''),
  locale: z.enum(['tr', 'en']).default('tr'),
  limit: z.coerce.number().int().min(1).max(30).default(20),
});

export const gifSearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  previewUrl: z.string(),
  gifToken: z.string(),
});

export const channelMessageSchema = z.object({
  id: z.string().uuid(),
  channelId: z.string().uuid(),
  kind: z.enum(['USER', 'SYSTEM_MODERATION']),
  systemAction: z.string().nullable(),
  systemTarget: z.string().nullable(),
  content: z.string().nullable(),
  deleted: z.boolean(),
  editedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  author: messageAuthorSchema.nullable(),
  replyTo: messageReplySchema.nullable(),
  mentions: z.array(messageAuthorSchema),
  reactions: z.array(messageReactionSchema),
  attachments: z.array(messageAttachmentSchema),
  gif: messageGifSchema.nullable(),
  pinned: z.boolean(),
  poll: messagePollSchema.nullable(),
  forwardedFrom: forwardedMessageSnapshotSchema.nullable(),
});

export const messagePageSchema = z.object({
  items: z.array(channelMessageSchema),
  nextCursor: z.string().uuid().nullable(),
  lastReadMessageId: z.string().uuid().nullable(),
  lastReadAt: z.string().datetime(),
});

export const channelUnreadSummarySchema = z.object({
  serverId: z.string().uuid(),
  channelId: z.string().uuid(),
  unreadCount: z.number().int().nonnegative(),
  mentionCount: z.number().int().nonnegative(),
  lastReadMessageId: z.string().uuid().nullable(),
});

export const channelUnreadSummariesSchema = z.array(channelUnreadSummarySchema);

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;
export type MessageReactionInput = z.infer<typeof messageReactionInputSchema>;
export type MessageListQuery = z.infer<typeof messageListQuerySchema>;
export type MessageSearchQuery = z.infer<typeof messageSearchQuerySchema>;
export type CreatePollInput = z.infer<typeof createPollSchema>;
export type PollVoteInput = z.infer<typeof pollVoteSchema>;
export type AttachmentMessageQuery = z.infer<typeof attachmentMessageQuerySchema>;
export type ChannelMessage = z.infer<typeof channelMessageSchema>;
export type MessagePage = z.infer<typeof messagePageSchema>;
export type ChannelUnreadSummary = z.infer<typeof channelUnreadSummarySchema>;
export type MessageAttachment = z.infer<typeof messageAttachmentSchema>;
export type MessageGif = z.infer<typeof messageGifSchema>;
export type GifSearchQuery = z.infer<typeof gifSearchQuerySchema>;
export type GifSearchResult = z.infer<typeof gifSearchResultSchema>;
