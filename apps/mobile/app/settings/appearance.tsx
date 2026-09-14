import { useState } from 'react';
import { router } from 'expo-router';
import { View, ScrollView, SafeAreaView, StyleSheet } from '@/components/themed-native';
import { Text, Pressable } from '@/components/localized-native';
import { ScreenHeader } from '@/components/ui';
import { mobileThemes, useAppearance, type MobileThemeId } from '@/lib/appearance';
import { useI18n } from '@/lib/i18n';
import { colors } from '@wapve/design-tokens';

export default function AppearanceScreen() {
  const { theme, setTheme } = useAppearance();
  const { locale } = useI18n();
  const tr = locale === 'tr';
  const [error, setError] = useState(false);
  const names = tr ? ['Koyu', 'Mor', 'Mavi', 'Yeşil', 'Bordo'] : ['Dark', 'Purple', 'Blue', 'Green', 'Burgundy'];
  return <SafeAreaView style={styles.root}>
    <ScreenHeader title={tr ? 'Görünüm' : 'Appearance'} left={<Pressable accessibilityLabel={tr ? 'Geri' : 'Back'} onPress={() => router.back()} style={styles.back}><Text style={styles.title}>‹</Text></Pressable>} />
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{tr ? 'Kendi rengini seç' : 'Choose your colors'}</Text>
      <Text style={styles.description}>{tr ? 'Tema bu cihazdaki tüm ekranlara uygulanır.' : 'Your theme applies to every screen on this device.'}</Text>
      {(Object.keys(mobileThemes) as MobileThemeId[]).map((id, index) => <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: theme === id }} onPress={() => { setError(false); void setTheme(id).catch(() => setError(true)); }} style={[styles.card, theme === id && styles.selected]}>
        <View style={[styles.preview, { backgroundColor: mobileThemes[id].ink }]}><View style={[styles.rail, { backgroundColor: mobileThemes[id].surfaceRaised }]} /><View style={{ flex: 1, gap: 7 }}><View style={[styles.line, { backgroundColor: mobileThemes[id].wave }]} /><View style={[styles.line, { backgroundColor: mobileThemes[id].surfaceSoft, width: '75%' }]} /></View></View>
        <Text style={styles.name}>{names[index]}</Text><Text style={styles.name}>{theme === id ? '✓' : ''}</Text>
      </Pressable>)}
      {error && <Text accessibilityRole="alert" style={styles.description}>{tr ? 'Kaydedilemedi. Tekrar dene.' : 'Could not save. Try again.'}</Text>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.ink }, back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, content: { padding: 20, gap: 14 }, title: { color: colors.text, fontSize: 24, fontWeight: '700' }, description: { color: colors.textMuted, fontSize: 15, lineHeight: 22 }, card: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 16, backgroundColor: colors.surface, padding: 14, borderWidth: 2, borderColor: 'transparent' }, selected: { borderColor: colors.wave }, preview: { width: 88, height: 58, padding: 8, borderRadius: 8, flexDirection: 'row', gap: 8, alignItems: 'center' }, rail: { width: 12, height: 42, borderRadius: 4 }, line: { height: 8, borderRadius: 3 }, name: { color: colors.text, fontSize: 17, flex: 1 } });
