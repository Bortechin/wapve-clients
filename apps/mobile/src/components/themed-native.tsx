import * as Native from 'react-native';
import { forwardRef, type ComponentProps, type ElementRef } from 'react';
import { SafeAreaView as NativeSafeAreaView } from 'react-native-safe-area-context';
import { themeColor, useAppearance } from '@/lib/appearance';
export * from 'react-native';

function useStyle() {
  const { palette } = useAppearance();
  return <T extends Native.ViewStyle | Native.TextStyle | Native.ImageStyle>(
    style: Native.StyleProp<T>,
  ): T => {
    const flat = Native.StyleSheet.flatten(style) ?? {};
    return Object.fromEntries(
      Object.entries(flat).map(([name, value]) => [
        name,
        /color$/i.test(name) ? themeColor(value, palette) : value,
      ]),
    ) as T;
  };
}
export const View = forwardRef<ElementRef<typeof Native.View>, Native.ViewProps>(
  function ThemedView({ style, ...props }, ref) {
    const map = useStyle();
    return <Native.View {...props} ref={ref} style={map(style)} />;
  },
);
export const Text = forwardRef<ElementRef<typeof Native.Text>, Native.TextProps>(
  function ThemedText({ style, ...props }, ref) {
    const map = useStyle();
    const { palette } = useAppearance();
    return <Native.Text {...props} ref={ref} style={[{ color: palette.text }, map(style)]} />;
  },
);
export const TextInput = forwardRef<ElementRef<typeof Native.TextInput>, Native.TextInputProps>(
  function ThemedTextInput({ style, placeholderTextColor, selectionColor, ...props }, ref) {
    const map = useStyle();
    const { palette } = useAppearance();
    return (
      <Native.TextInput
        {...props}
        ref={ref}
        style={map(style)}
        placeholderTextColor={themeColor(placeholderTextColor, palette) as Native.ColorValue}
        selectionColor={themeColor(selectionColor, palette) as Native.ColorValue}
      />
    );
  },
);
export const Pressable = forwardRef<ElementRef<typeof Native.Pressable>, Native.PressableProps>(
  function ThemedPressable({ style, ...props }, ref) {
    const map = useStyle();
    return (
      <Native.Pressable
        {...props}
        ref={ref}
        style={(state) => map(typeof style === 'function' ? style(state) : style)}
      />
    );
  },
);
export const ScrollView = forwardRef<ElementRef<typeof Native.ScrollView>, Native.ScrollViewProps>(
  function ThemedScrollView({ style, contentContainerStyle, ...props }, ref) {
    const map = useStyle();
    return (
      <Native.ScrollView
        {...props}
        ref={ref}
        style={map(style)}
        contentContainerStyle={map(contentContainerStyle)}
      />
    );
  },
);
export const KeyboardAvoidingView = forwardRef<
  ElementRef<typeof Native.KeyboardAvoidingView>,
  Native.KeyboardAvoidingViewProps
>(function ThemedKeyboardView({ style, ...props }, ref) {
  const map = useStyle();
  return <Native.KeyboardAvoidingView {...props} ref={ref} style={map(style)} />;
});
export const SafeAreaView = forwardRef<
  ElementRef<typeof NativeSafeAreaView>,
  ComponentProps<typeof NativeSafeAreaView>
>(function ThemedSafeAreaView({ style, ...props }, ref) {
  const map = useStyle();
  return <NativeSafeAreaView {...props} ref={ref} style={map(style)} />;
});
