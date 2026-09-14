import type { PremiumCosmeticVisual } from '@wapve/contracts';
import { StyleSheet, View } from '@/components/themed-native';
import { Image } from 'expo-image';
import { mobileNameplateAsset } from './premium-cosmetic-registry';

export function PremiumNameplateBackground({
  visual,
}: {
  visual: PremiumCosmeticVisual | null | undefined;
}) {
  const source = mobileNameplateAsset(visual);
  if (!source) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={source} contentFit="cover" style={StyleSheet.absoluteFill} />
    </View>
  );
}

export function hasPremiumNameplate(visual: PremiumCosmeticVisual | null | undefined): boolean {
  return mobileNameplateAsset(visual) !== null;
}
