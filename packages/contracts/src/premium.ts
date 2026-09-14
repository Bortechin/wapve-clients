import { z } from 'zod';

export const premiumCosmeticTypeSchema = z.enum([
  'AVATAR_DECORATION',
  'PROFILE_EFFECT',
  'NAMEPLATE',
]);

export const premiumCosmeticStoreCategorySchema = z.enum([
  'AVATAR_DECORATION',
  'PROFILE_EFFECT',
  'PROFILE_FRAME',
  'NAMEPLATE',
]);

export const premiumCosmeticVisualSchema = z.enum([
  'WAVE_ORBIT',
  'CORAL_GUARDIAN',
  'POLAR_COMPASS',
  'SAKURA_RAIN',
  'COSMIC_ATLAS',
  'CRESCENT_TIDE',
  'DRAGON_SEAL',
  'CRYSTAL_GROVE',
  'WOLF_MOON_FRAME',
  'WOLF_MOON_EFFECT',
  'WOLF_MOON_CARD',
  'BEAR_AMBER_FRAME',
  'BEAR_AMBER_EFFECT',
  'BEAR_AMBER_CARD',
  'CRESCENT_TIDE_AVATAR',
  'CRESCENT_TIDE_FRAME',
  'ATATURK_CUMHURIYET_FRAME',
  'FATIH_FETIH_FRAME',
  'SULEYMAN_DIVAN_PLATE',
  'CUMHURIYET_PLAKASI_V2',
  'FETIH_FERMANI_V2',
  'DIVAN_LALESI_FRAME_V2',
  'WHITE_LEAF_FALL',
  'DEAD_PIRATE_AVATAR',
  'DEAD_PIRATE_FRAME',
  'DEAD_PIRATE_NAMEPLATE',
]);

export const premiumCosmeticItemSchema = z.object({
  id: z.string().min(2).max(64),
  type: premiumCosmeticTypeSchema,
  storeCategory: premiumCosmeticStoreCategorySchema,
  visual: premiumCosmeticVisualSchema,
  name: z.string(),
  description: z.string(),
  collection: z.string(),
  rarity: z.enum(['STANDARD', 'RARE', 'LEGENDARY']),
  accent: z.string().regex(/^#[0-9a-f]{6}$/iu),
  owned: z.boolean(),
  equipped: z.boolean(),
  claimable: z.boolean(),
});

export const premiumCosmeticBundleSchema = z.object({
  id: z.string().min(2).max(64),
  name: z.string(),
  description: z.string(),
  collection: z.string(),
  accent: z.string().regex(/^#[0-9a-f]{6}$/iu),
  itemIds: z.array(z.string().min(2).max(64)).min(2).max(6),
  ownedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().positive(),
  claimable: z.boolean(),
});

export const premiumEquippedSchema = z.object({
  avatarDecorationId: z.string().max(64).nullable(),
  profileEffectId: z.string().max(64).nullable(),
  nameplateId: z.string().max(64).nullable(),
});

export const premiumPublicStyleSchema = z.object({
  active: z.boolean(),
  avatarDecoration: premiumCosmeticVisualSchema.nullable(),
  profileEffect: premiumCosmeticVisualSchema.nullable(),
  nameplate: premiumCosmeticVisualSchema.nullable(),
});

export const premiumMembershipSchema = z.object({
  active: z.boolean(),
  source: z.enum(['PUBLIC', 'ALPHA', 'PLATFORM_OWNER', 'OWNER_GRANT', 'GIFT']).nullable(),
  expiresAt: z.string().datetime().nullable(),
  giftPassesRemaining: z.number().int().min(0).max(3),
  supportSlots: z.number().int().min(2).max(10),
});

export const premiumServerSummarySchema = z.object({
  id: z.string().uuid(),
  publicId: z.string().regex(/^\d{15}$/u),
  name: z.string(),
  iconUrl: z.string().nullable(),
  supportCount: z.number().int().nonnegative(),
  supportLevel: z.number().int().min(0).max(3),
  unlimitedWoost: z.boolean().default(false),
  customInviteSlug: z.string().nullable().optional(),
});

export const serverSupportPerksSchema = z.object({
  voiceBitrateKbps: z.number().int().min(8).max(384),
  emojiSlots: z.number().int().min(25).max(200),
  discoveryPriority: z.boolean(),
});

export const serverWoostUnlockKeySchema = z.enum([
  'LEVEL_1',
  'LEVEL_2',
  'LEVEL_3',
  'SERVER_TAG',
  'DISCOVERY_PLUS',
  'TAG_PACK_OCEAN_PULSE',
  'TAG_PACK_NIGHT_SKY',
  'TAG_PACK_WILD_TRAIL',
  'TAG_PACK_PRESTIGE',
]);

export const unlockServerWoostSchema = z.object({ key: serverWoostUnlockKeySchema });

export const serverSupportOverviewSchema = z.object({
  server: premiumServerSummarySchema,
  currentLevel: z.number().int().min(0).max(3),
  currentCount: z.number().int().nonnegative(),
  spentCount: z.number().int().nonnegative(),
  availableCount: z.number().int().nonnegative(),
  unlimited: z.boolean().default(false),
  canManage: z.boolean().default(false),
  nextThreshold: z.number().int().positive().nullable(),
  progressPercent: z.number().min(0).max(100),
  perks: serverSupportPerksSchema,
  levels: z.array(
    z.object({
      level: z.number().int().min(1).max(3),
      requiredSupports: z.number().int().positive(),
      cost: z.number().int().positive(),
      unlockKey: serverWoostUnlockKeySchema,
      unlocked: z.boolean(),
      canUnlock: z.boolean(),
      perks: serverSupportPerksSchema,
    }),
  ),
  extras: z.array(
    z.object({
      key: serverWoostUnlockKeySchema,
      title: z.string(),
      description: z.string(),
      cost: z.number().int().positive(),
      unlocked: z.boolean(),
      canUnlock: z.boolean(),
    }),
  ),
  tagPacks: z.array(
    z.object({
      id: z.enum(['OCEAN_PULSE', 'NIGHT_SKY', 'WILD_TRAIL', 'PRESTIGE']),
      unlockKey: serverWoostUnlockKeySchema,
      cost: z.number().int().positive(),
      unlocked: z.boolean(),
      canUnlock: z.boolean(),
      badgeIds: z.array(z.string()),
    }),
  ),
  supporters: z.array(
    z.object({
      id: z.string().uuid(),
      displayName: z.string(),
      avatarUrl: z.string().nullable(),
      slot: z.number().int().positive(),
      assignedAt: z.string().datetime(),
      expiresAt: z.string().datetime().nullable(),
      active: z.boolean(),
    }),
  ),
  canSupport: z.boolean().default(false),
  supportDisabledReason: z
    .enum(['WAPVE_PLUS_REQUIRED', 'ALREADY_SUPPORTED', 'NO_SUPPORT_SLOT', 'UNLIMITED_WOOST'])
    .nullable()
    .default(null),
});

export const SERVER_SUPPORT_LEVELS = [
  { level: 1, requiredSupports: 2, voiceBitrateKbps: 128, emojiSlots: 50 },
  { level: 2, requiredSupports: 7, voiceBitrateKbps: 256, emojiSlots: 100 },
  { level: 3, requiredSupports: 14, voiceBitrateKbps: 384, emojiSlots: 200 },
] as const;

export function serverSupportLevel(count: number): 0 | 1 | 2 | 3 {
  return count >= 14 ? 3 : count >= 7 ? 2 : count >= 2 ? 1 : 0;
}

export function serverSupportPerks(count: number) {
  const level = serverSupportLevel(count);
  return {
    voiceBitrateKbps: level === 3 ? 384 : level === 2 ? 256 : level === 1 ? 128 : 96,
    emojiSlots: level === 3 ? 200 : level === 2 ? 100 : level === 1 ? 50 : 25,
    discoveryPriority: level === 3,
  } as const;
}

export const premiumServerSupportSchema = z.object({
  slot: z.number().int().min(1).max(10),
  assignedAt: z.string().datetime(),
  cooldownUntil: z.string().datetime(),
  server: premiumServerSummarySchema,
});

export const premiumGiftSchema = z.object({
  id: z.string().uuid(),
  recipient: z.object({
    id: z.string().uuid(),
    publicId: z.string().regex(/^\d{11}$/u),
    username: z.string(),
    displayName: z.string(),
  }),
  durationDays: z.literal(7),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const premiumDashboardSchema = z.object({
  membership: premiumMembershipSchema,
  catalog: z.array(premiumCosmeticItemSchema),
  bundles: z.array(premiumCosmeticBundleSchema).default([]),
  equipped: premiumEquippedSchema,
  supports: z.array(premiumServerSupportSchema),
  eligibleServers: z.array(premiumServerSummarySchema),
  recentGifts: z.array(premiumGiftSchema),
});

export const equipPremiumCosmeticSchema = premiumEquippedSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'validation.emptyUpdate');

export const sendPremiumGiftSchema = z.object({
  recipient: z.string().trim().min(3).max(64),
});

export const assignServerSupportSchema = z.object({
  serverId: z.string().uuid(),
});

export const ownerWapvePlusGrantSchema = z.object({
  days: z.number().int().min(0).max(3650),
});

export const ownerSupportSlotsSchema = z.object({
  slots: z.number().int().min(2).max(10),
  reason: z.string().trim().min(3).max(512),
});

export type PremiumCosmeticType = z.infer<typeof premiumCosmeticTypeSchema>;
export type PremiumCosmeticStoreCategory = z.infer<typeof premiumCosmeticStoreCategorySchema>;
export type PremiumCosmeticVisual = z.infer<typeof premiumCosmeticVisualSchema>;
export type PremiumCosmeticItem = z.infer<typeof premiumCosmeticItemSchema>;
export type PremiumCosmeticBundle = z.infer<typeof premiumCosmeticBundleSchema>;
export type PremiumEquipped = z.infer<typeof premiumEquippedSchema>;
export type PremiumPublicStyle = z.infer<typeof premiumPublicStyleSchema>;
export type PremiumMembership = z.infer<typeof premiumMembershipSchema>;
export type PremiumServerSummary = z.infer<typeof premiumServerSummarySchema>;
export type PremiumServerSupport = z.infer<typeof premiumServerSupportSchema>;
export type ServerSupportPerks = z.infer<typeof serverSupportPerksSchema>;
export type ServerSupportOverview = z.infer<typeof serverSupportOverviewSchema>;
export type ServerWoostUnlockKey = z.infer<typeof serverWoostUnlockKeySchema>;
export type UnlockServerWoostInput = z.infer<typeof unlockServerWoostSchema>;
export type PremiumGift = z.infer<typeof premiumGiftSchema>;
export type PremiumDashboard = z.infer<typeof premiumDashboardSchema>;
export type EquipPremiumCosmeticInput = z.infer<typeof equipPremiumCosmeticSchema>;
export type SendPremiumGiftInput = z.infer<typeof sendPremiumGiftSchema>;
export type AssignServerSupportInput = z.infer<typeof assignServerSupportSchema>;
export type OwnerWapvePlusGrantInput = z.infer<typeof ownerWapvePlusGrantSchema>;
export type OwnerSupportSlotsInput = z.infer<typeof ownerSupportSlotsSchema>;
