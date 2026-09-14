import type { PremiumCosmeticVisual } from '@wapve/contracts';

type AvatarDefinition = { kind: 'avatar'; asset: string };
type ProfileDefinition =
  | { kind: 'profile'; top: string; bottom: string; topOffset?: number; bottomOffset?: number }
  | { kind: 'profile'; overlay: string };
type NameplateDefinition = { kind: 'nameplate'; asset: string };

export type PremiumCosmeticDefinition = AvatarDefinition | ProfileDefinition | NameplateDefinition;

export const premiumCosmeticRegistry = {
  WAVE_ORBIT: { kind: 'avatar', asset: '/premium/wave-orbit-frame.webp' },
  CORAL_GUARDIAN: { kind: 'avatar', asset: '/premium/coral-guardian-frame.webp' },
  POLAR_COMPASS: { kind: 'avatar', asset: '/premium/polar-compass-frame.webp' },
  SAKURA_RAIN: {
    kind: 'profile',
    top: '/premium/sakura-spirit-profile-top-v3.webp',
    bottom: '/premium/sakura-spirit-profile-bottom-v3.webp',
  },
  COSMIC_ATLAS: {
    kind: 'profile',
    top: '/premium/cosmic-atlas-profile-top-v3.webp',
    bottom: '/premium/cosmic-atlas-profile-bottom-v3.webp',
  },
  CRESCENT_TIDE: { kind: 'nameplate', asset: '/premium/crescent-tide-nameplate.webp' },
  DRAGON_SEAL: { kind: 'nameplate', asset: '/premium/dragon-seal-nameplate.webp' },
  CRYSTAL_GROVE: { kind: 'nameplate', asset: '/premium/crystal-grove-nameplate.webp' },
  WOLF_MOON_FRAME: { kind: 'avatar', asset: '/premium/wolf-moon-frame.webp' },
  WOLF_MOON_EFFECT: {
    kind: 'profile',
    top: '/premium/wolf-moon-profile-top-v3.webp',
    bottom: '/premium/wolf-moon-profile-bottom-v3.webp',
  },
  WOLF_MOON_CARD: { kind: 'nameplate', asset: '/premium/wolf-moon-nameplate.webp' },
  BEAR_AMBER_FRAME: { kind: 'avatar', asset: '/premium/bear-amber-frame.webp' },
  BEAR_AMBER_EFFECT: {
    kind: 'profile',
    top: '/premium/bear-amber-profile-top-v3.webp',
    bottom: '/premium/bear-amber-profile-bottom-v3.webp',
  },
  BEAR_AMBER_CARD: { kind: 'nameplate', asset: '/premium/bear-amber-nameplate.webp' },
  CRESCENT_TIDE_AVATAR: { kind: 'avatar', asset: '/premium/crescent-tide-avatar-frame.webp' },
  CRESCENT_TIDE_FRAME: {
    kind: 'profile',
    top: '/premium/crescent-tide-profile-top-v3.webp',
    bottom: '/premium/crescent-tide-profile-bottom-v3.webp',
  },
  ATATURK_CUMHURIYET_FRAME: { kind: 'avatar', asset: '/premium/ataturk-cumhuriyet-frame.png' },
  FATIH_FETIH_FRAME: { kind: 'avatar', asset: '/premium/fatih-fetih-frame.png' },
  SULEYMAN_DIVAN_PLATE: { kind: 'nameplate', asset: '/premium/suleyman-divan-nameplate.webp' },
  CUMHURIYET_PLAKASI_V2: { kind: 'nameplate', asset: '/premium/cumhuriyet-plakasi-v2.webp' },
  FETIH_FERMANI_V2: { kind: 'nameplate', asset: '/premium/fetih-fermani-v2.webp' },
  DIVAN_LALESI_FRAME_V2: { kind: 'avatar', asset: '/premium/divan-lalesi-frame-v2.png' },
  WHITE_LEAF_FALL: { kind: 'profile', overlay: '/premium/white-leaf-fall-profile-effect.png' },
  DEAD_PIRATE_AVATAR: { kind: 'avatar', asset: '/premium/dead-pirate-avatar-frame.webp' },
  DEAD_PIRATE_FRAME: {
    kind: 'profile',
    top: '/premium/dead-pirate-profile-top.webp',
    bottom: '/premium/dead-pirate-profile-bottom.webp',
    topOffset: -36,
    bottomOffset: 18,
  },
  DEAD_PIRATE_NAMEPLATE: { kind: 'nameplate', asset: '/premium/dead-pirate-nameplate-v2.webp' },
} satisfies Record<PremiumCosmeticVisual, PremiumCosmeticDefinition>;

export function avatarDecorationAsset(
  visual: PremiumCosmeticVisual | null | undefined,
): string | null {
  if (!visual) return null;
  const definition = premiumCosmeticRegistry[visual];
  return definition.kind === 'avatar' ? definition.asset : null;
}

export function profileFrameAsset(
  visual: PremiumCosmeticVisual | null | undefined,
): { kind: 'frame'; top: string; bottom: string; topOffset?: number; bottomOffset?: number } | { kind: 'overlay'; asset: string } | null {
  if (!visual) return null;
  const definition = premiumCosmeticRegistry[visual];
  if (definition.kind !== 'profile') return null;
  return 'overlay' in definition
    ? { kind: 'overlay', asset: definition.overlay }
    : {
      kind: 'frame', top: definition.top, bottom: definition.bottom,
      ...('topOffset' in definition ? { topOffset: definition.topOffset } : {}),
      ...('bottomOffset' in definition ? { bottomOffset: definition.bottomOffset } : {}),
    };
}

export function nameplateAsset(visual: PremiumCosmeticVisual | null | undefined): string | null {
  if (!visual) return null;
  const definition = premiumCosmeticRegistry[visual];
  return definition.kind === 'nameplate' ? definition.asset : null;
}
