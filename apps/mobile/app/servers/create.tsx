import { Text, Pressable } from '@/components/localized-native';
import type { ServerSummary } from '@wapve/contracts';
import {
  colors,
  radius,
  spacing,
  typography } from '@wapve/design-tokens';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { Button, Field, ScreenHeader } from '@/components/ui';
import { Icon } from '@/components/icon';
import { api } from '@/lib/client';

type Mode = 'create' | 'join';

export default function CreateServerScreen() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>('create');
  const [name, setName] = useState('');
  const [invite, setInvite] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function complete(action: () => Promise<ServerSummary>) {
    setLoading(true);
    setError('');
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ['servers'] });
      router.back();
    } catch {
      setError(
        mode === 'create'
          ? 'Sunucu oluşturulamadı. Ad 2–100 karakter olmalı.'
          : 'Davet geçersiz, süresi dolmuş veya kullanım sınırına ulaşmış.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScreenHeader
        title="Sunucu ekle"
        left={
          <Pressable style={styles.back} onPress={() => router.back()} accessibilityLabel="Geri">
            <Icon name="arrow-left" color={colors.text} size={26} />
          </Pressable>
        }
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, mode === 'create' && styles.tabActive]}
              onPress={() => {
                setMode('create');
                setError('');
              }}
            >
              <Icon
                name="plus-circle-outline"
                color={mode === 'create' ? colors.text : colors.textMuted}
                size={22}
              />
              <Text style={[styles.tabText, mode === 'create' && styles.tabTextActive]}>
                Sunucu oluştur
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, mode === 'join' && styles.tabActive]}
              onPress={() => {
                setMode('join');
                setError('');
              }}
            >
              <Icon
                name="link-variant"
                color={mode === 'join' ? colors.text : colors.textMuted}
                size={22}
              />
              <Text style={[styles.tabText, mode === 'join' && styles.tabTextActive]}>
                Sunucuya katıl
              </Text>
            </Pressable>
          </View>
          <View style={styles.hero}>
            <View style={styles.mark}>
              <Icon
                name={mode === 'create' ? 'creation-outline' : 'account-multiple-plus-outline'}
                color={colors.waveBright}
                size={38}
              />
            </View>
            <Text style={styles.title}>
              {mode === 'create' ? 'Yeni bir dalga başlat.' : 'Var olan bir dalgaya katıl.'}
            </Text>
            <Text style={styles.body}>
              {mode === 'create'
                ? 'Topluluğuna bir ad ver. Kanal, rol ve izinleri sunucu açıldıktan sonra düzenleyebilirsin.'
                : 'Davet kodunu ya da sana gönderilen tam davet bağlantısını yapıştır.'}
            </Text>
          </View>
          <View style={styles.form}>
            {mode === 'create' ? (
              <Field
                label="Sunucu adı"
                value={name}
                onChangeText={setName}
                maxLength={100}
                returnKeyType="done"
              />
            ) : (
              <Field
                label="Davet kodu veya bağlantı"
                value={invite}
                onChangeText={setInvite}
                maxLength={256}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />
            )}
            {error ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
            {mode === 'create' ? (
              <Button
                label="Sunucuyu oluştur"
                loading={loading}
                disabled={name.trim().length < 2}
                onPress={() =>
                  void complete(() =>
                    api.request<ServerSummary>('/servers', {
                      method: 'POST',
                      body: { name: name.trim() },
                    }),
                  )
                }
              />
            ) : (
              <Button
                label="Davetle katıl"
                loading={loading}
                disabled={invite.trim().length < 6}
                onPress={() =>
                  void complete(() =>
                    api.request<ServerSummary>('/servers/actions/join', {
                      method: 'POST',
                      body: { code: invite.trim() },
                    }),
                  )
                }
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xxl * 2, gap: spacing.xl },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tab: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
  },
  tabActive: { backgroundColor: colors.surfaceRaised },
  tabText: { color: colors.textMuted, ...typography.caption },
  tabTextActive: { color: colors.text },
  hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.lg },
  mark: {
    width: 78,
    height: 78,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.wave,
  },
  title: { color: colors.text, ...typography.title, textAlign: 'center' },
  body: { maxWidth: 430, color: colors.textMuted, ...typography.body, textAlign: 'center' },
  form: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  error: { color: colors.danger, ...typography.caption },
});
