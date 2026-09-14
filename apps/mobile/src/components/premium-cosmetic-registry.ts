import type { PremiumCosmeticVisual } from '@wapve/contracts';

type AvatarDefinition = { kind: 'avatar'; asset: number };
type ProfileDefinition =
  | { kind: 'profile'; top: number; bottom: number; topOffset?: number; bottomOffset?: number }
  | { kind: 'profile'; overlay: number };
type NameplateDefinition = { kind: 'nameplate'; asset: number };
type Definition = AvatarDefinition | ProfileDefinition | NameplateDefinition;

export const mobilePremiumCosmeticRegistry = {
  DEAD_PIRATE_AVATAR: { kind: 'avatar', asset: require('../../../web/public/premium/dead-pirate-avatar-frame.webp') as number },
  DEAD_PIRATE_FRAME: {
    kind: 'profile',
    top: require('../../../web/public/premium/dead-pirate-profile-top.webp') as number,
    bottom: require('../../../web/public/premium/dead-pirate-profile-bottom.webp') as number,
    topOffset: -36,
    bottomOffset: 18,
  },
  DEAD_PIRATE_NAMEPLATE: { kind: 'nameplate', asset: require('../../../web/public/premium/dead-pirate-nameplate-v2.webp') as number },
  WAVE_ORBIT: {
    kind: 'avatar',
    asset: require('../../assets/premium/wave-orbit-frame.webp') as number,
  },
  CORAL_GUARDIAN: {
    kind: 'avatar',
    asset: require('../../assets/premium/coral-guardian-frame.webp') as number,
  },
  POLAR_COMPASS: {
    kind: 'avatar',
    asset: require('../../assets/premium/polar-compass-frame.webp') as number,
  },
  SAKURA_RAIN: {
    kind: 'profile',
    top: require('../../assets/premium/sakura-spirit-profile-top-v3.webp') as number,
    bottom: require('../../assets/premium/sakura-spirit-profile-bottom-v3.webp') as number,
  },
  COSMIC_ATLAS: {
    kind: 'profile',
    top: require('../../assets/premium/cosmic-atlas-profile-top-v3.webp') as number,
    bottom: require('../../assets/premium/cosmic-atlas-profile-bottom-v3.webp') as number,
  },
  CRESCENT_TIDE: {
    kind: 'nameplate',
    asset: require('../../assets/premium/crescent-tide-nameplate.webp') as number,
  },
  DRAGON_SEAL: {
    kind: 'nameplate',
    asset: require('../../assets/premium/dragon-seal-nameplate.webp') as number,
  },
  CRYSTAL_GROVE: {
    kind: 'nameplate',
    asset: require('../../assets/premium/crystal-grove-nameplate.webp') as number,
  },
  WOLF_MOON_FRAME: {
    kind: 'avatar',
    asset: require('../../assets/premium/wolf-moon-frame.webp') as number,
  },
  WOLF_MOON_EFFECT: {
    kind: 'profile',
    top: require('../../assets/premium/wolf-moon-profile-top-v3.webp') as number,
    bottom: require('../../assets/premium/wolf-moon-profile-bottom-v3.webp') as number,
  },
  WOLF_MOON_CARD: {
    kind: 'nameplate',
    asset: require('../../assets/premium/wolf-moon-nameplate.webp') as number,
  },
  BEAR_AMBER_FRAME: {
    kind: 'avatar',
    asset: require('../../assets/premium/bear-amber-frame.webp') as number,
  },
  BEAR_AMBER_EFFECT: {
    kind: 'profile',
    top: require('../../assets/premium/bear-amber-profile-top-v3.webp') as number,
    bottom: require('../../assets/premium/bear-amber-profile-bottom-v3.webp') as number,
  },
  BEAR_AMBER_CARD: {
    kind: 'nameplate',
    asset: require('../../assets/premium/bear-amber-nameplate.webp') as number,
  },
  CRESCENT_TIDE_AVATAR: {
    kind: 'avatar',
    asset: require('../../assets/premium/crescent-tide-avatar-frame.webp') as number,
  },
  CRESCENT_TIDE_FRAME: {
    kind: 'profile',
    top: require('../../assets/premium/crescent-tide-profile-top-v3.webp') as number,
    bottom: require('../../assets/premium/crescent-tide-profile-bottom-v3.webp') as number,
  },
  ATATURK_CUMHURIYET_FRAME: {
    kind: 'avatar',
    asset: require('../../assets/premium/ataturk-cumhuriyet-frame.png') as number,
  },
  FATIH_FETIH_FRAME: {
    kind: 'avatar',
    asset: require('../../assets/premium/fatih-fetih-frame.png') as number,
  },
  SULEYMAN_DIVAN_PLATE: {
    kind: 'nameplate',
    asset: require('../../assets/premium/suleyman-divan-nameplate.webp') as number,
  },
  CUMHURIYET_PLAKASI_V2: {
    kind: 'nameplate',
    asset: require('../../assets/premium/cumhuriyet-plakasi-v2.webp') as number,
  },
  FETIH_FERMANI_V2: {
    kind: 'nameplate',
    asset: require('../../assets/premium/fetih-fermani-v2.webp') as number,
  },
  DIVAN_LALESI_FRAME_V2: {
    kind: 'avatar',
    asset: require('../../assets/premium/divan-lalesi-frame-v2.png') as number,
  },
  WHITE_LEAF_FALL: {
    kind: 'profile',
    overlay: require('../../assets/premium/white-leaf-fall-profile-effect.webp') as number,
  },
} satisfies Record<PremiumCosmeticVisual, Definition>;

export function mobileAvatarAsset(visual: PremiumCosmeticVisual | null | undefined) {
  if (!visual) return null;
  const definition = mobilePremiumCosmeticRegistry[visual];
  return definition.kind === 'avatar' ? definition.asset : null;
}

export function mobileProfileFrame(visual: PremiumCosmeticVisual | null | undefined) {
  if (!visual) return null;
  const definition = mobilePremiumCosmeticRegistry[visual];
  if (definition.kind !== 'profile') return null;
  return 'overlay' in definition
    ? { kind: 'overlay' as const, asset: definition.overlay }
    : {
        kind: 'frame' as const,
        top: definition.top,
        bottom: definition.bottom,
        ...('topOffset' in definition && definition.topOffset !== undefined ? { topOffset: definition.topOffset } : {}),
        ...('bottomOffset' in definition && definition.bottomOffset !== undefined ? { bottomOffset: definition.bottomOffset } : {}),
      };
}

export function mobileNameplateAsset(visual: PremiumCosmeticVisual | null | undefined) {
  if (!visual) return null;
  const definition = mobilePremiumCosmeticRegistry[visual];
  return definition.kind === 'nameplate' ? definition.asset : null;
}
