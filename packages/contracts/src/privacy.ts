import { z } from 'zod';

export const mediaVisibilitySchema = z.enum(['SHOW', 'HIDE', 'BLOCK']);
export const privacySettingsSchema = z.object({
  profileVisibility: z.enum(['FRIENDS_AND_SERVERS', 'FRIENDS_AND_SMALL_SERVERS', 'FRIENDS_ONLY']).default('FRIENDS_AND_SERVERS'),
  allowServerDirectMessages: z.boolean().default(true),
  filterMessageRequests: z.boolean().default(true),
  friendRequestsEveryone: z.boolean().default(true),
  friendRequestsMutualFriends: z.boolean().default(true),
  friendRequestsServerMembers: z.boolean().default(true),
  spamFilter: z.enum(['ALL', 'NON_FRIENDS', 'OFF']).default('NON_FRIENDS'),
  mediaFriends: mediaVisibilitySchema.default('SHOW'),
  mediaOthers: mediaVisibilitySchema.default('HIDE'),
  mediaServers: mediaVisibilitySchema.default('SHOW'),
  serverOverrides: z.array(z.object({ serverId: z.string().uuid(), allowDirectMessages: z.boolean(), filterMessageRequests: z.boolean() }).strict()).max(100).refine(items => new Set(items.map(item => item.serverId)).size === items.length, 'validation.duplicateServers').default([]),
}).strict();
export const updatePrivacySettingsSchema = z.object({
  profileVisibility: privacySettingsSchema.shape.profileVisibility.removeDefault().optional(),
  allowServerDirectMessages: z.boolean().optional(),
  filterMessageRequests: z.boolean().optional(),
  friendRequestsEveryone: z.boolean().optional(),
  friendRequestsMutualFriends: z.boolean().optional(),
  friendRequestsServerMembers: z.boolean().optional(),
  spamFilter: privacySettingsSchema.shape.spamFilter.removeDefault().optional(),
  mediaFriends: mediaVisibilitySchema.optional(),
  mediaOthers: mediaVisibilitySchema.optional(),
  mediaServers: mediaVisibilitySchema.optional(),
  serverOverrides: privacySettingsSchema.shape.serverOverrides.removeDefault().optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'validation.emptyUpdate');
export const directInboxStateSchema = z.enum(['ACCEPTED', 'REQUEST', 'SPAM', 'DECLINED']);
export const updateDirectInboxSchema = z.object({ action: z.enum(['ACCEPT', 'DECLINE']) }).strict();
export type PrivacySettings = z.infer<typeof privacySettingsSchema>;
export type UpdatePrivacySettingsInput = z.infer<typeof updatePrivacySettingsSchema>;
export type MediaVisibility = z.infer<typeof mediaVisibilitySchema>;
export type DirectInboxState = z.infer<typeof directInboxStateSchema>;
export function readPrivacySettings(value: unknown): PrivacySettings {
  const parsed = privacySettingsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : privacySettingsSchema.parse({ profileVisibility: 'FRIENDS_ONLY', allowServerDirectMessages: false, friendRequestsEveryone: false, friendRequestsMutualFriends: false, friendRequestsServerMembers: false });
}
