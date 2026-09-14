// Adapted from Reacticx Shimmer (MIT): https://reacticx.com/docs/components/shimmer
// The copied component is intentionally restyled for Wapve and avoids a new gradient dependency.
import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from '@/components/themed-native';
import { colors } from '@wapve/design-tokens';

type Props = PropsWithChildren<{
  loading: boolean;
  style?: StyleProp<ViewStyle>;
  duration?: number;
}>;

export function ReacticxShimmer({ children, loading, style, duration = 1_250 }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!loading || width <= 0) {
      progress.stopAnimation();
      progress.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration,
        easing: Easing.inOut(Easing.linear),
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [duration, loading, progress, width]);

  function measure(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  const bandWidth = Math.max(28, width * 0.38);
  return (
    <View onLayout={measure} style={[styles.root, style]}>
      {children}
      {loading && width > 0 ? (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.band,
            {
              width: bandWidth,
              transform: [{
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-bandWidth, width + bandWidth],
                }),
              }],
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.waveBright,
    opacity: 0.16,
  },
});
