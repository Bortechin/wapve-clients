import {
  AccessibilityInfo,
  Alert as NativeAlert,
  findNodeHandle,
  Modal as NativeModal,
  Pressable as NativePressable,
  Switch as NativeSwitch,
  Text as NativeText,
  TextInput as NativeTextInput,
  View,
  type ModalProps,
  type PressableProps,
  type SwitchProps,
  type AlertButton,
  type AlertOptions,
  type TextInputProps,
  type TextProps,
} from '@/components/themed-native';
import { Children, forwardRef, useEffect, useRef, type ReactNode, type Ref } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { translateCurrentLiteral, useI18n } from '@/lib/i18n';

export const Text = forwardRef<React.ElementRef<typeof NativeText>, TextProps>(function LocalizedText(
  { children, maxFontSizeMultiplier = 2, ...props },
  ref,
) {
  const { translateLiteral } = useI18n();
  const localized = Children.map(children, (child: ReactNode): ReactNode =>
    typeof child === 'string' ? translateLiteral(child) : child,
  );
  return <NativeText ref={ref} maxFontSizeMultiplier={maxFontSizeMultiplier} {...props}>{localized}</NativeText>;
});

export const TextInput = forwardRef<React.ElementRef<typeof NativeTextInput>, TextInputProps>(function LocalizedTextInput(
  { placeholder, maxFontSizeMultiplier = 2, ...props },
  ref,
) {
  const { translateLiteral } = useI18n();
  return <NativeTextInput ref={ref} placeholder={placeholder ? translateLiteral(placeholder) : placeholder} maxFontSizeMultiplier={maxFontSizeMultiplier} {...props} />;
});

export const Pressable = forwardRef<React.ElementRef<typeof NativePressable>, PressableProps>(function LocalizedPressable(
  { accessibilityLabel, accessibilityHint, onPress, ...props },
  ref,
) {
  const { translateLiteral } = useI18n();
  const localRef = useRef<React.ElementRef<typeof NativePressable>>(null);
  return (
    <NativePressable
      ref={(value) => {
        localRef.current = value;
        assignRef(ref, value);
      }}
      {...(accessibilityLabel ? { accessibilityLabel: translateLiteral(accessibilityLabel) } : {})}
      {...(accessibilityHint ? { accessibilityHint: translateLiteral(accessibilityHint) } : {})}
      onPress={onPress ? (event) => {
        lastTriggerHandle = findNodeHandle(localRef.current);
        onPress(event);
      } : undefined}
      {...props}
    />
  );
});

export const Switch = forwardRef<React.ElementRef<typeof NativeSwitch>, SwitchProps>(function LocalizedSwitch(
  { accessibilityLabel, accessibilityHint, ...props },
  ref,
) {
  const { translateLiteral } = useI18n();
  return (
    <NativeSwitch
      ref={ref}
      {...(accessibilityLabel ? { accessibilityLabel: translateLiteral(accessibilityLabel) } : {})}
      {...(accessibilityHint ? { accessibilityHint: translateLiteral(accessibilityHint) } : {})}
      {...props}
    />
  );
});

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    NativeAlert.alert(
      translateCurrentLiteral(title),
      message ? translateCurrentLiteral(message) : message,
      buttons?.map((button) => ({
        ...button,
        ...(button.text ? { text: translateCurrentLiteral(button.text) } : {}),
      })),
      options,
    );
  },
};

export function Modal({ children, onShow, onDismiss, accessibilityLabel, ...props }: ModalProps & { accessibilityLabel?: string }) {
  const { translateLiteral } = useI18n();
  const focusRef = useRef<React.ElementRef<typeof View>>(null);
  const restoreHandle = useRef<number | null>(null);
  const wasVisible = useRef(Boolean(props.visible));
  useEffect(() => {
    const visible = Boolean(props.visible);
    if (visible && !wasVisible.current) restoreHandle.current = lastTriggerHandle;
    if (!visible && wasVisible.current) {
      void AccessibilityInfo.announceForAccessibility(translateLiteral('Panel kapandı'));
      if (restoreHandle.current) AccessibilityInfo.setAccessibilityFocus(restoreHandle.current);
    }
    wasVisible.current = visible;
  }, [props.visible, translateLiteral]);
  return (
    <NativeModal
      {...props}
      animationType={props.transparent && props.animationType === 'slide' ? 'fade' : props.animationType}
      onShow={(event) => {
        restoreHandle.current ??= lastTriggerHandle;
        const node = findNodeHandle(focusRef.current);
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
        void AccessibilityInfo.announceForAccessibility(translateLiteral(accessibilityLabel ?? 'Panel açıldı'));
        onShow?.(event);
      }}
      onDismiss={() => {
        onDismiss?.();
      }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View ref={focusRef} style={{ flex: 1 }} accessibilityViewIsModal>
          {children}
        </View>
      </GestureHandlerRootView>
    </NativeModal>
  );
}

let lastTriggerHandle: number | null = null;

function assignRef<T>(ref: Ref<T>, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}
