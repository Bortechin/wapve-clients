import { describe, expect, it } from 'vitest';
import { orderedPlatformBadges, ownedBadges, platformBadgeRegistry } from './badge-registry';

describe('badge registry', () => {
  it('keeps Wapve+ first and orders special badges before platform badges', () => {
    expect(ownedBadges(['ALPHA_MEMBER', 'MODERATOR', 'PLATFORM_OWNER'], true)).toEqual([
      { kind: 'premium', id: 'WAPVE_PLUS' },
      { kind: 'platform', id: 'PLATFORM_OWNER' },
      { kind: 'platform', id: 'MODERATOR' },
      { kind: 'platform', id: 'ALPHA_MEMBER' },
    ]);
  });

  it('deduplicates badges and exposes complete presentation copy', () => {
    expect(orderedPlatformBadges(['STAFF', 'STAFF', 'DEVELOPER'])).toEqual(['STAFF', 'DEVELOPER']);
    expect(
      Object.values(platformBadgeRegistry).every(
        (badge) => badge.title.tr && badge.title.en && badge.description.tr && badge.description.en,
      ),
    ).toBe(true);
    expect(platformBadgeRegistry.SERVER_SURFER).toMatchObject({
      image: '/brand/badge-server-surfer.png',
      title: { tr: 'Sunucu Sörfçüsü', en: 'Server Surfer' },
    });
  });

  it('orders the dynamic server-support badge before the alpha badge', () => {
    expect(orderedPlatformBadges(['ALPHA_MEMBER', 'SERVER_SURFER'])).toEqual([
      'SERVER_SURFER',
      'ALPHA_MEMBER',
    ]);
  });

  it('handles the quick-profile boundaries without inventing badges', () => {
    expect(ownedBadges([], false)).toHaveLength(0);
    expect(ownedBadges(['STAFF', 'DEVELOPER'], true)).toHaveLength(3);
    expect(ownedBadges(['STAFF', 'DEVELOPER', 'SUPPORT'], true).slice(0, 3)).toEqual([
      { kind: 'premium', id: 'WAPVE_PLUS' },
      { kind: 'platform', id: 'STAFF' },
      { kind: 'platform', id: 'DEVELOPER' },
    ]);
  });
});
