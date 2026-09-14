import type { PlatformBadge } from '@wapve/contracts';

const badgeOrder: PlatformBadge[] = [
  'PLATFORM_OWNER',
  'SYSTEM',
  'STAFF',
  'MODERATOR',
  'DEVELOPER',
  'SUPPORT',
  'PARTNER',
  'VERIFIED_CREATOR',
  'EARLY_SUPPORTER',
  'BUG_HUNTER',
  'COMMUNITY_CHAMPION',
  'SERVER_SURFER',
  'ALPHA_MEMBER',
];

export function orderedMobileBadges(badges: PlatformBadge[]) {
  const selected = new Set(badges);
  return badgeOrder.filter((badge) => selected.has(badge));
}
