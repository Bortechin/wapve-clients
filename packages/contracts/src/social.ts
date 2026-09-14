import { z } from 'zod';
import { gameActivitySchema } from './game-activity.js';
import { usernameSchema } from './auth.js';
import { effectivePresenceSchema, platformBadgeSchema } from './common.js';
import { premiumPublicStyleSchema } from './premium.js';
import { serverTagSchema } from './server.js';

export const socialUserSchema = z.object({
  profileRestricted: z.boolean().optional(),
  id: z.string().uuid(),
  publicId: z.string().regex(/^\d{11}$/u),
  createdAt: z.string().datetime().optional(),
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
});

export const sendFriendRequestSchema = z.object({ username: usernameSchema });
export const blockUserSchema = z.object({ userId: z.string().uuid() });

export const friendVoiceActivitySchema = z.object({
  serverId: z.string().uuid(),
  serverName: z.string(),
  serverPublicId: z.string(),
  channelId: z.string().uuid(),
  channelName: z.string(),
  channelPublicId: z.string(),
  participantCount: z.number().int().min(1),
});

export const friendSchema = z.object({
  friendshipId: z.string().uuid(),
  conversationId: z.string().uuid(),
  since: z.string().datetime(),
  user: socialUserSchema,
  activeVoice: friendVoiceActivitySchema.optional(),
});

export const friendRequestSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  user: socialUserSchema,
});

export const friendRequestsSchema = z.object({
  incoming: z.array(friendRequestSchema),
  outgoing: z.array(friendRequestSchema),
});

export const blockedUserSchema = z.object({
  createdAt: z.string().datetime(),
  user: socialUserSchema,
});

export type SocialUser = z.infer<typeof socialUserSchema>;
export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>;
export type BlockUserInput = z.infer<typeof blockUserSchema>;
export type Friend = z.infer<typeof friendSchema>;
export type FriendVoiceActivity = z.infer<typeof friendVoiceActivitySchema>;
export type FriendRequest = z.infer<typeof friendRequestSchema>;
export type FriendRequests = z.infer<typeof friendRequestsSchema>;
export type BlockedUser = z.infer<typeof blockedUserSchema>;
