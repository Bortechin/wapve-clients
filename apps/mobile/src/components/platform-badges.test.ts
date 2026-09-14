import { describe, expect, it } from '@jest/globals';
import { orderedMobileBadges } from './badge-order';

describe('mobile badge ordering', () => {
  it('uses the stable authority-first order and removes unknown duplicates', () => {
    expect(orderedMobileBadges(['ALPHA_MEMBER', 'STAFF', 'PLATFORM_OWNER', 'STAFF'])).toEqual([
      'PLATFORM_OWNER',
      'STAFF',
      'ALPHA_MEMBER',
    ]);
  });

  it('supports empty and exact-three badge collections', () => {
    expect(orderedMobileBadges([])).toEqual([]);
    expect(orderedMobileBadges(['SUPPORT', 'DEVELOPER', 'MODERATOR'])).toEqual([
      'MODERATOR',
      'DEVELOPER',
      'SUPPORT',
    ]);
  });

  it('keeps the server-support badge ahead of the alpha badge', () => {
    expect(orderedMobileBadges(['ALPHA_MEMBER', 'SERVER_SURFER'])).toEqual([
      'SERVER_SURFER',
      'ALPHA_MEMBER',
    ]);
  });
});
