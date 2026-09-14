import { z } from 'zod';

export const globalMessageSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  cursor: z.string().trim().min(8).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export const globalMessageSearchItemSchema = z.object({
  kind: z.enum(['channel', 'direct', 'group']),
  messageId: z.string().uuid(),
  content: z.string(),
  createdAt: z.string().datetime(),
  author: z.object({
    id: z.string().uuid(),
    username: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }).nullable(),
  title: z.string(),
  context: z.string(),
  avatarUrl: z.string().nullable(),
  serverId: z.string().uuid().nullable(),
  channelId: z.string().uuid().nullable(),
  conversationId: z.string().uuid().nullable(),
});

export const globalMessageSearchPageSchema = z.object({
  items: z.array(globalMessageSearchItemSchema),
  nextCursor: z.string().nullable(),
});

export type GlobalMessageSearchQuery = z.infer<typeof globalMessageSearchQuerySchema>;
export type GlobalMessageSearchItem = z.infer<typeof globalMessageSearchItemSchema>;
export type GlobalMessageSearchPage = z.infer<typeof globalMessageSearchPageSchema>;
