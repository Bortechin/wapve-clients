import { Text } from '@/components/localized-native';
import {
  colors,
  radius,
  spacing,
  typography } from '@wapve/design-tokens';
import { ActivityIndicator,
  StyleSheet,
  View,
} from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { Button, SecureImage } from './ui';
import { Icon, type IconName } from './icon';

export function DeepLinkState({
  title,
  body,
  loading = false,
  icon = 'link-variant',
  imageUrl,
  primary,
  secondary,
  testID = 'deep-link.state',
}: {
  title: string;
  body: string;
  loading?: boolean;
  icon?: IconName;
  imageUrl?: string | null;
  primary?: { label: string; action(): void; loading?: boolean; disabled?: boolean };
  secondary?: { label: string; action(): void };
  testID?: string;
}) {
  return (
    <SafeAreaView style={styles.root} testID={testID}>
      <View style={styles.card} accessibilityLiveRegion="polite">
        {imageUrl ? (
          <View style={styles.image}><SecureImage uri={imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" /></View>
        ) : (
          <View style={styles.icon}><Icon name={icon} color={colors.waveBright} size={46} /></View>
        )}
        {loading ? <ActivityIndicator color={colors.waveBright} size="large" /> : null}
        <Text accessibilityRole="header" style={styles.title} testID={`${testID}.title`}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        {primary ? <Button testID={`${testID}.primary`} label={primary.label} {...(primary.loading === undefined ? {} : { loading: primary.loading })} {...(primary.disabled === undefined ? {} : { disabled: primary.disabled })} onPress={primary.action} /> : null}
        {secondary ? <Button testID={`${testID}.secondary`} label={secondary.label} variant="ghost" onPress={secondary.action} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink, justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: spacing.md, padding: spacing.xl, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas },
  icon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', backgroundColor: colors.surfaceRaised },
  image: { width: 96, height: 96, borderRadius: 28, overflow: 'hidden', alignSelf: 'center', backgroundColor: colors.surfaceRaised },
  title: { color: colors.text, ...typography.title, textAlign: 'center' },
  body: { color: colors.textMuted, ...typography.body, textAlign: 'center' },
});
