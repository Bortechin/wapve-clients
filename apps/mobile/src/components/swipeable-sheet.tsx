import { Text } from '@/components/localized-native';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, type PropsWithChildren } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from '@/components/themed-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, spacing, typography } from '@wapve/design-tokens';
import { useI18n } from '@/lib/i18n';

type Props = PropsWithChildren<{
  onClose(): void;
  style?: StyleProp<ViewStyle>;
  hint?: string;
  showHint?: boolean;
  dragFromContent?: boolean;
}>;

export function SwipeableSheetSurface({
  children,
  onClose,
  style,
  hint = 'Paneli kapatmak için aşağı sürükle',
  showHint = false,
  dragFromContent = false,
}: Props) {
  const { height } = useWindowDimensions();
  const { translateLiteral } = useI18n();
  const translateY = useSharedValue(28);
  const closing = useRef(false);

  useEffect(() => {
    closing.current = false;
    translateY.value = 28;
    translateY.value = withTiming(0, {
      duration: 190,
      easing: Easing.out(Easing.cubic),
    });
  }, [translateY]);

  const finishClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (Platform.OS === 'android') {
      void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Gesture_End).catch(() => undefined);
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
    onClose();
  }, [onClose]);

  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    translateY.value = withTiming(
      height + 80,
      { duration: 190, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onClose)();
      },
    );
  }, [height, onClose, translateY]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(2)
        .activeOffsetY([-4, 4])
        .failOffsetX([-42, 42])
        .shouldCancelWhenOutside(false)
        .onUpdate((event) => {
          translateY.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
          const projectedDistance = event.translationY + Math.max(0, event.velocityY) * 0.12;
          if (event.translationY > 34 || event.velocityY > 420 || projectedDistance > 72) {
            translateY.value = withTiming(
              height + 80,
              { duration: 190, easing: Easing.in(Easing.cubic) },
              (finished) => {
                if (finished) runOnJS(finishClose)();
              },
            );
            return;
          }
          translateY.value = withSpring(0, {
            damping: 24,
            stiffness: 260,
            mass: 0.72,
          });
        }),
    [finishClose, height, translateY],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const { outerStyle, contentStyle } = useMemo(() => splitSurfaceStyle(style), [style]);

  const handle = (
    <GestureDetector gesture={pan}>
      <View
        style={styles.handleArea}
        collapsable={false}
        accessible
        accessibilityRole="button"
        accessibilityLabel={translateLiteral(hint)}
        accessibilityHint={translateLiteral('Çift dokunarak da kapatabilirsin')}
        onAccessibilityTap={dismiss}
        hitSlop={{ top: 10, bottom: 10, left: 24, right: 24 }}
      >
        <View style={styles.handle} />
        {showHint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    </GestureDetector>
  );

  const surface = (
    <Animated.View style={[styles.surface, outerStyle, animatedStyle]}>
      {dragFromContent ? (
        <View style={styles.compactHandle} accessibilityElementsHidden>
          <View style={styles.handle} />
        </View>
      ) : handle}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </Animated.View>
  );

  return dragFromContent ? <GestureDetector gesture={pan}>{surface}</GestureDetector> : surface;
}

const styles = StyleSheet.create({
  surface: {
    overflow: 'hidden',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  content: {
    minHeight: 0,
  },
  handleArea: {
    width: '100%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingTop: spacing.xxs,
    paddingBottom: spacing.xxs,
  },
  compactHandle: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 46,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.lineStrong,
  },
  hint: {
    color: colors.textMuted,
    ...typography.caption,
  },
});

function splitSurfaceStyle(style: StyleProp<ViewStyle>) {
  const flattened = StyleSheet.flatten(style) ?? {};
  const {
    padding,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
    paddingHorizontal,
    paddingVertical,
    gap,
    rowGap,
    columnGap,
    alignItems,
    justifyContent,
    ...outerStyle
  } = flattened;
  return {
    outerStyle,
    contentStyle: {
      ...(flattened.height !== undefined ? { flex: 1 } : {}),
      ...(flattened.maxHeight !== undefined ? { flexShrink: 1 } : {}),
      padding,
      paddingTop: paddingTop ?? paddingVertical ?? spacing.xxs,
      paddingRight,
      paddingBottom,
      paddingLeft,
      paddingHorizontal,
      paddingVertical,
      gap,
      rowGap,
      columnGap,
      alignItems,
      justifyContent,
    },
  };
}
