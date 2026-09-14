import { describe, expect, it } from 'vitest';
import {
  assignServerSupportSchema,
  equipPremiumCosmeticSchema,
  ownerWapvePlusGrantSchema,
  premiumDashboardSchema,
  premiumCosmeticVisualSchema,
  sendPremiumGiftSchema,
  serverSupportLevel,
  serverSupportPerks,
} from './premium.js';

describe('premium contracts', () => {
  it('validates cosmetic equipment changes', () => {
    expect(equipPremiumCosmeticSchema.parse({ avatarDecorationId: 'wave-orbit' })).toEqual({
      avatarDecorationId: 'wave-orbit',
    });
    expect(equipPremiumCosmeticSchema.safeParse({}).success).toBe(false);
  });

  it('bounds support and owner grant inputs', () => {
    expect(
      assignServerSupportSchema.safeParse({ serverId: '550e8400-e29b-41d4-a716-446655440000' })
        .success,
    ).toBe(true);
    expect(ownerWapvePlusGrantSchema.safeParse({ days: 3651 }).success).toBe(false);
  });

  it('normalizes gift recipients', () => {
    expect(sendPremiumGiftSchema.parse({ recipient: '  wave_user  ' })).toEqual({
      recipient: 'wave_user',
    });
  });

  it('accepts a complete premium dashboard', () => {
    expect(
      premiumDashboardSchema.safeParse({
        membership: {
          active: true,
          source: 'PUBLIC',
          expiresAt: null,
          giftPassesRemaining: 3,
          supportSlots: 2,
        },
        catalog: [],
        equipped: {
          avatarDecorationId: null,
          profileEffectId: null,
          nameplateId: null,
        },
        supports: [],
        eligibleServers: [],
        recentGifts: [],
      }).success,
    ).toBe(true);
  });

  it('accepts the new visual collection and rejects retired visuals', () => {
    expect(premiumCosmeticVisualSchema.parse('CORAL_GUARDIAN')).toBe('CORAL_GUARDIAN');
    expect(premiumCosmeticVisualSchema.parse('CRYSTAL_GROVE')).toBe('CRYSTAL_GROVE');
    expect(premiumCosmeticVisualSchema.parse('WOLF_MOON_FRAME')).toBe('WOLF_MOON_FRAME');
    expect(premiumCosmeticVisualSchema.parse('BEAR_AMBER_CARD')).toBe('BEAR_AMBER_CARD');
    expect(premiumCosmeticVisualSchema.parse('DEAD_PIRATE_FRAME')).toBe('DEAD_PIRATE_FRAME');
    expect(premiumCosmeticVisualSchema.parse('CRESCENT_TIDE_AVATAR')).toBe('CRESCENT_TIDE_AVATAR');
    expect(premiumCosmeticVisualSchema.parse('CRESCENT_TIDE_FRAME')).toBe('CRESCENT_TIDE_FRAME');
    expect(premiumCosmeticVisualSchema.parse('WHITE_LEAF_FALL')).toBe('WHITE_LEAF_FALL');
    expect(premiumCosmeticVisualSchema.safeParse('MOONLIGHT_TIDE').success).toBe(false);
    expect(premiumCosmeticVisualSchema.safeParse('FLAME_CROWN').success).toBe(false);
    expect(premiumCosmeticVisualSchema.safeParse('AURORA_BOREALIS').success).toBe(false);
    expect(premiumCosmeticVisualSchema.safeParse('NEON_TIDE').success).toBe(false);
    expect(premiumCosmeticVisualSchema.safeParse('PULSE_LINE').success).toBe(false);
  });

  it('unlocks Woost perks at 2, 7, and 14 supports', () => {
    expect(serverSupportLevel(1)).toBe(0);
    expect(serverSupportPerks(2)).toMatchObject({ voiceBitrateKbps: 128, emojiSlots: 50 });
    expect(serverSupportPerks(7)).toMatchObject({ voiceBitrateKbps: 256, emojiSlots: 100 });
    expect(serverSupportPerks(14)).toEqual({
      voiceBitrateKbps: 384,
      emojiSlots: 200,
      discoveryPriority: true,
    });
  });
});
