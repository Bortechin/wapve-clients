import { TextInput, Modal, Text, Pressable } from '@/components/localized-native';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import type { ContentReportReason } from '@wapve/contracts';
import {
  useEffect,
  useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from '@/components/themed-native';
import { colors, radius, spacing, typography } from '@wapve/design-tokens';
import { api } from '@/lib/client';
import { Button } from './ui';
import { Icon, type IconName } from './icon';
import { SwipeableSheetSurface } from './swipeable-sheet';

type Category = 'BUG' | 'FEEDBACK' | 'SAFETY' | 'OTHER';

const categories: Array<{ value: Category; label: string; icon: IconName }> = [
  { value: 'BUG', label: 'Hata', icon: 'bug-outline' },
  { value: 'FEEDBACK', label: 'Öneri', icon: 'lightbulb-outline' },
  { value: 'SAFETY', label: 'Güvenlik', icon: 'shield-alert-outline' },
  { value: 'OTHER', label: 'Diğer', icon: 'dots-horizontal-circle-outline' },
];

const reportReasons: Array<{ value: ContentReportReason; label: string }> = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'HARASSMENT', label: 'Taciz' },
  { value: 'HATE_SPEECH', label: 'Nefret söylemi' },
  { value: 'SEXUAL_CONTENT', label: 'Cinsel içerik' },
  { value: 'VIOLENCE', label: 'Şiddet' },
  { value: 'SCAM_FRAUD', label: 'Dolandırıcılık' },
  { value: 'ILLEGAL_CONTENT', label: 'Yasa dışı içerik' },
  { value: 'SELF_HARM', label: 'Kendine zarar' },
  { value: 'IMPERSONATION', label: 'Kimliğe bürünme' },
  { value: 'OTHER', label: 'Diğer' },
];

export type ReportSubject =
  | { kind: 'user'; userId: string; displayName: string; username: string }
  | {
      kind: 'message';
      targetType: 'CHANNEL_MESSAGE' | 'DIRECT_MESSAGE' | 'GROUP_MESSAGE';
      messageId: string;
      preview?: string;
    }
  | { kind: 'server'; serverId: string; serverName: string };

function subjectTitle(subject: ReportSubject): string {
  if (subject.kind === 'user') return 'Kullanıcıyı bildir';
  if (subject.kind === 'server') return 'Sunucuyu bildir';
  return 'Mesajı bildir';
}

function subjectSubtitle(subject: ReportSubject): string {
  if (subject.kind === 'user')
    return `@${subject.username} hakkındaki bildirimi Wapve sahibine gönder.`;
  if (subject.kind === 'server')
    return `${subject.serverName} sunucusu hakkındaki bildirimi Wapve sahibine gönder.`;
  return 'Bu mesaj hakkındaki bildirimi Wapve sahibine gönder.';
}

export function ReportSheet({ visible, close, subject }: { visible: boolean; close(): void; subject?: ReportSubject | undefined }) {
  const { width, height } = useWindowDimensions();
  const [category, setCategory] = useState<Category>('BUG');
  const [reason, setReason] = useState<ContentReportReason>('SPAM');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [already, setAlready] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setError('');
    setSent(false);
    setAlready(false);
    if (subject?.kind === 'user') setReason('HARASSMENT');
    else setReason('SPAM');
    setDescription('');
  }, [subject, visible]);

  async function submit() {
    if (busy) return;
    if (subject) {
      setBusy(true);
      setError('');
      try {
        const result = await api.request<{ id: string; alreadyReported: boolean }>('/reports/content', {
          method: 'POST',
          body: {
            targetType: subject.kind === 'user' ? 'USER' : subject.kind === 'server' ? 'SERVER' : subject.targetType,
            targetId: subject.kind === 'user' ? subject.userId : subject.kind === 'server' ? subject.serverId : subject.messageId,
            reason,
            ...(description.trim() ? { description: description.trim() } : {}),
          },
        });
        if (result.alreadyReported) setAlready(true);
        else setSent(true);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Bildirim gönderilemedi.');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (title.trim().length < 3 || description.trim().length < 10) return;
    setBusy(true);
    setError('');
    try {
      await api.request('/reports', {
        method: 'POST',
        body: {
          category,
          title: title.trim(),
          description: description.trim(),
          pageUrl: 'https://wapve.com/mobile',
          context: {
            viewport: `${Math.round(width)}x${Math.round(height)}`,
            userAgent: `${Device.manufacturer ?? 'Android'} ${Device.modelName ?? ''}; Wapve ${Application.nativeApplicationVersion ?? '0.1.0'}`,
          },
        },
      });
      setTitle('');
      setDescription('');
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Bildirim gönderilemedi.');
    } finally {
      setBusy(false);
    }
  }

  const submitDisabled = subject
    ? busy || sent || already
    : busy || title.trim().length < 3 || description.trim().length < 10;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <SwipeableSheetSurface onClose={close} style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Icon name={subject ? 'flag-outline' : 'bug-outline'} color={colors.waveBright} size={24} />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{subject ? subjectTitle(subject) : 'Sorun bildir'}</Text>
              <Text style={styles.subtitle}>{subject ? subjectSubtitle(subject) : 'Hata, güvenlik sorunu veya önerini Wapve ekibine gönder.'}</Text>
            </View>
            <Pressable style={styles.close} onPress={close} accessibilityLabel="Kapat">
              <Icon name="close" color={colors.textMuted} size={24} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            {subject ? (
              <>
                {subject.kind === 'message' && subject.preview ? (
                  <Text numberOfLines={3} style={styles.preview}>{subject.preview}</Text>
                ) : null}
                <Text style={styles.label}>NEDEN</Text>
                <View style={styles.categories}>
                  {reportReasons.map((item) => (
                    <Pressable
                      key={item.value}
                      style={[styles.category, reason === item.value && styles.categoryActive]}
                      onPress={() => setReason(item.value)}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                    >
                      <Text style={[styles.categoryText, reason === item.value && styles.categoryTextActive]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.label}>AYRINTI (İSTEĞE BAĞLI)</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  maxLength={2000}
                  multiline
                  textAlignVertical="top"
                  style={[styles.input, styles.description]}
                  placeholder="Eklemek istediğin ayrıntılar"
                  placeholderTextColor={colors.textDim}
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>TÜR</Text>
                <View style={styles.categories}>
                  {categories.map((item) => (
                    <Pressable
                      key={item.value}
                      style={[styles.category, category === item.value && styles.categoryActive]}
                      onPress={() => setCategory(item.value)}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                    >
                      <Icon
                        name={item.icon}
                        color={category === item.value ? colors.waveBright : colors.textMuted}
                        size={20}
                      />
                      <Text style={[styles.categoryText, category === item.value && styles.categoryTextActive]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.label}>BAŞLIK</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  maxLength={120}
                  style={styles.input}
                  placeholder="Kısaca ne oldu?"
                  placeholderTextColor={colors.textDim}
                />
                <Text style={styles.label}>AÇIKLAMA</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  maxLength={4000}
                  multiline
                  textAlignVertical="top"
                  style={[styles.input, styles.description]}
                  placeholder="Sorunu yeniden oluşturma adımlarını ve beklediğin davranışı anlat."
                  placeholderTextColor={colors.textDim}
                />
              </>
            )}
            {sent ? <Text style={styles.success}>Bildirimin uygulama sahibine ulaştı.</Text> : null}
            {already ? <Text style={styles.success}>Bu içeriği zaten bildirdin.</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label="Gönder"
              loading={busy}
              disabled={submitDisabled}
              onPress={() => void submit()}
            />
          </ScrollView>
        </SwipeableSheetSurface>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { maxHeight: '92%', paddingBottom: spacing.xl, borderWidth: 1, borderColor: colors.line },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  headerIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { color: colors.text, ...typography.title },
  subtitle: { color: colors.textMuted, ...typography.caption, marginTop: 2 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.xxl },
  label: { color: colors.textDim, ...typography.caption, fontWeight: '800', letterSpacing: 1 },
  preview: { color: colors.textMuted, ...typography.body, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  category: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  categoryActive: { borderColor: colors.waveBright, backgroundColor: colors.surfaceRaised },
  categoryText: { color: colors.textMuted, ...typography.caption, fontWeight: '700' },
  categoryTextActive: { color: colors.text },
  input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: spacing.md, ...typography.body },
  description: { minHeight: 110, paddingTop: spacing.sm },
  success: { color: colors.success, ...typography.caption },
  error: { color: colors.danger, ...typography.caption },
});
