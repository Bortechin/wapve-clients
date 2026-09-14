import type { PremiumCosmeticVisual } from '@wapve/contracts';
import { premiumCosmeticRegistry } from './premium-cosmetic-registry';

function nameplateSlug(visual: PremiumCosmeticVisual): string {
  return visual.toLowerCase().replaceAll('_', '-');
}

function supportedNameplate(
  visual: PremiumCosmeticVisual | null | undefined,
): visual is PremiumCosmeticVisual {
  return Boolean(visual && premiumCosmeticRegistry[visual].kind === 'nameplate');
}

export function premiumNameplateSurfaceClass(
  visual: PremiumCosmeticVisual | null | undefined,
): string {
  return supportedNameplate(visual)
    ? ` premium-nameplate-surface premium-nameplate-surface-${nameplateSlug(visual)}`
    : '';
}
