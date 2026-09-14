import { TextInput, Text, Pressable } from '@/components/localized-native';
import * as Haptics from 'expo-haptics';
import {
  Image } from 'expo-image';
import { forwardRef,
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from '@/components/themed-native';
import { colors, radius, spacing, touch, typography } from '@wapve/design-tokens';
import { apiUrl } from '@/lib/client';
import { secureTokenStorage } from '@/lib/session-storage';
import { useI18n } from '@/lib/i18n';
import type { PremiumCosmeticVisual } from '@wapve/contracts';
import { mobileAvatarAsset } from './premium-cosmetic-registry';

type ButtonProps = {
  label: string;
  onPress(): void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: ReactNode;
  testID?: string;
};

export function Button({ label, onPress, disabled, loading, variant = 'primary', icon, testID }: ButtonProps) {
  const { translateLiteral } = useI18n();
  const localizedLabel = translateLiteral(label);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={localizedLabel}
      accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(loading) }}
      testID={testID}
      disabled={disabled || loading}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [styles.button, styles[`button_${variant}`], pressed && styles.pressed, (disabled || loading) && styles.disabled]}
    >
      {loading ? <ActivityIndicator color={colors.text} /> : <>{icon}<Text style={[styles.buttonText, variant === 'ghost' && styles.buttonGhostText]}>{label}</Text></>}
    </Pressable>
  );
}

type FieldProps = ComponentProps<typeof TextInput> & { label: string; error?: string };
export const Field = forwardRef<React.ElementRef<typeof TextInput>, FieldProps>(function Field({ label, error, ...props }, ref) {
  const { translateLiteral } = useI18n();
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={translateLiteral(label)}
        accessibilityHint={props.placeholder ? translateLiteral(props.placeholder) : undefined}
        placeholderTextColor={colors.textDim}
        selectionColor={colors.waveBright}
        {...props}
        style={[styles.field, props.style, error && styles.fieldError]}
      />
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
});

export function absoluteMedia(path: string) {
  return /^https?:\/\//u.test(path) ? path : `${apiUrl.replace(/\/api\/v1$/u, '')}${path}`;
}

function mediaNeedsAuthorization(originalUri: string, absoluteUri: string) {
  if (!/^https?:\/\//u.test(originalUri)) return true;
  try {
    return new URL(absoluteUri).origin === new URL(apiUrl).origin;
  } catch {
    return false;
  }
}

type SecureMediaSource = { uri: string; cacheKey: string; headers?: { Authorization: string } };
const sourceCache = new Map<string, SecureMediaSource>();

export function useSecureMediaSource(
  uri: string,
  revision?: string | number | null,
): SecureMediaSource | null {
  const sourceKey = revision == null ? uri : `${uri}::${revision}`;
  const [source, setSource] = useState<SecureMediaSource | null>(
    () => sourceCache.get(sourceKey) ?? null,
  );
  useEffect(() => {
    let active = true;
    const cached = sourceCache.get(sourceKey);
    if (cached) setSource(cached);
    void secureTokenStorage.load().then((tokens) => {
      if (!active) return;
      const absoluteUri = absoluteMedia(uri);
      const resolvedUri = revision == null
        ? absoluteUri
        : `${absoluteUri}${absoluteUri.includes('?') ? '&' : '?'}wapve_rev=${encodeURIComponent(String(revision))}`;
      const next: SecureMediaSource = tokens?.accessToken && mediaNeedsAuthorization(uri, absoluteUri)
        ? { uri: resolvedUri, cacheKey: sourceKey, headers: { Authorization: `Bearer ${tokens.accessToken}` } }
        : { uri: resolvedUri, cacheKey: sourceKey };
      sourceCache.set(sourceKey, next);
      setSource(next);
    });
    return () => { active = false; };
  }, [revision, sourceKey, uri]);
  return source;
}

type SecureImageProps = Omit<ComponentProps<typeof Image>, 'source'> & {
  uri: string;
  revision?: string | number | null | undefined;
};

export function SecureImage({ uri, revision, ...props }: SecureImageProps) {
  const source = useSecureMediaSource(uri, revision);
  if (!source) return null;
  return <Image source={source} cachePolicy="memory-disk" recyclingKey={source.cacheKey} {...props} />;
}

export function Avatar({ name, uri, revision, size = 44, online = false, status, decoration }: { name: string; uri?: string | null | undefined; revision?: string | number | null | undefined; size?: number; online?: boolean; status?: string | undefined; decoration?: PremiumCosmeticVisual | null | undefined }) {
  const { t } = useI18n();
  const asset = mobileAvatarAsset(decoration);
  const statusColor = status === 'DND' ? colors.danger : status === 'IDLE' ? colors.warning : status === 'OFFLINE' || status === 'INVISIBLE' ? colors.textDim : colors.success;
  return (
    <View accessible accessibilityRole="image" style={{ width: size, height: size }} accessibilityLabel={`${name}${online ? `, ${t('online')}` : ''}`}>
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }]}>
        {uri ? <SecureImage uri={uri} revision={revision} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} /> : <Text style={[styles.avatarText, { fontSize: Math.max(13, size * 0.36) }]}>{name.trim().slice(0, 1).toLocaleUpperCase('tr')}</Text>}
      </View>
      {asset ? <Image pointerEvents="none" source={asset} contentFit="contain" style={{ position: 'absolute', left: -size * 0.13, top: -size * 0.13, width: size * 1.26, height: size * 1.26 }} /> : null}
      {online || status ? <View style={[styles.online, { right: -2, bottom: -2, backgroundColor: statusColor }]} /> : null}
    </View>
  );
}

export function ScreenHeader({
  title,
  left,
  right,
  onTitlePress,
  titleAccessory,
  titleLeading,
  titleAccessibilityLabel,
}: {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
  onTitlePress?: (() => void) | undefined;
  titleAccessory?: ReactNode;
  titleLeading?: ReactNode;
  titleAccessibilityLabel?: string | undefined;
}) {
  return (
    <View style={styles.header}>
      {left}
      {onTitlePress ? (
        <Pressable
          style={({ pressed }) => [styles.headerTitleButton, pressed && styles.pressed]}
          onPress={onTitlePress}
          accessibilityRole="button"
          accessibilityLabel={titleAccessibilityLabel ?? title}
        >
          {titleLeading}
          <Text accessibilityRole="header" numberOfLines={1} style={styles.headerTitle}>
            {title}
          </Text>
          {titleAccessory}
          <Text style={{ color: colors.textMuted, fontSize: 22 }}>›</Text>
        </Pressable>
      ) : (
        <Text accessibilityRole="header" numberOfLines={1} style={styles.headerTitle}>
          {title}
        </Text>
      )}
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: touch.minimum, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.lg },
  button_primary: { backgroundColor: colors.wave },
  button_secondary: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.lineStrong },
  button_danger: { backgroundColor: colors.danger },
  button_ghost: { backgroundColor: 'transparent' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.45 },
  buttonText: { color: colors.text, ...typography.label },
  buttonGhostText: { color: colors.waveBright },
  fieldWrap: { gap: spacing.xs },
  label: { color: colors.textMuted, ...typography.label },
  field: { minHeight: touch.minimum, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: spacing.md, ...typography.body },
  fieldError: { borderColor: colors.danger },
  error: { color: colors.danger, ...typography.caption },
  avatar: { backgroundColor: colors.wave, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.waveBright },
  avatarText: { color: colors.text, fontWeight: '800' },
  online: { position: 'absolute', width: 13, height: 13, borderRadius: 7, backgroundColor: colors.success, borderWidth: 3, borderColor: colors.canvas },
  header: { minHeight: 64, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, backgroundColor: colors.canvas },
  headerTitle: { flex: 1, color: colors.text, ...typography.heading },
  headerTitleButton: { flex: 1, minWidth: 0, minHeight: touch.minimum, flexDirection: 'row', alignItems: 'center', gap: 3 },
  headerRight: { minWidth: touch.minimum, alignItems: 'flex-end' },
});
