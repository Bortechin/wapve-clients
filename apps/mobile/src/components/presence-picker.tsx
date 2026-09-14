import { Text, Modal, Pressable } from '@/components/localized-native';
import type { PresenceStatus } from '@wapve/contracts';
import {
  useState } from 'react';
import {
  StyleSheet,
  View,
} from '@/components/themed-native';
import { colors, radius, spacing, touch, typography } from '@wapve/design-tokens';
import { Icon } from './icon';
import { SwipeableSheetSurface } from './swipeable-sheet';

const statuses: { value: PresenceStatus; label: string; description: string; color: string }[] = [
  {
    value: 'ONLINE',
    label: 'Çevrimiçi',
    description: 'Çevrimiçi olduğunu göster',
    color: colors.success,
  },
  { value: 'IDLE', label: 'Boşta', description: 'Bir süre uzaktasın', color: colors.warning },
  {
    value: 'DND',
    label: 'Rahatsız etmeyin',
    description: 'Bildirimleri sessize al',
    color: colors.danger,
  },
  { value: 'INVISIBLE', label: 'Görünmez', description: 'Çevrimdışı görün', color: colors.textDim },
];

const durations: { label: string; milliseconds: number | null }[] = [
  { label: '15 dakika', milliseconds: 15 * 60 * 1000 },
  { label: '1 saat', milliseconds: 60 * 60 * 1000 },
  { label: '8 saat', milliseconds: 8 * 60 * 60 * 1000 },
  { label: '24 saat', milliseconds: 24 * 60 * 60 * 1000 },
  { label: '3 gün', milliseconds: 3 * 24 * 60 * 60 * 1000 },
  { label: 'Her zaman', milliseconds: null },
];

export function presenceLabel(status: PresenceStatus | 'OFFLINE') {
  return statuses.find((item) => item.value === status)?.label ?? 'Çevrimdışı';
}

export function PresencePickerSheet({
  visible,
  currentStatus,
  onClose,
  onSelect,
}: {
  visible: boolean;
  currentStatus: PresenceStatus;
  onClose(): void;
  onSelect(status: PresenceStatus, statusExpiresAt: string | null): Promise<void>;
}) {
  const [durationStatus, setDurationStatus] = useState<PresenceStatus | null>(null);
  const [saving, setSaving] = useState(false);

  function close() {
    setDurationStatus(null);
    onClose();
  }

  async function chooseStatus(status: PresenceStatus) {
    if (saving) return;
    setSaving(true);
    try {
      // Seçim yapıldığı anda kalıcı olarak uygulanır; süre seçilmezse "Her zaman" kalır.
      await onSelect(status, null);
      if (status === 'ONLINE') close();
      else setDurationStatus(status);
    } finally {
      setSaving(false);
    }
  }

  async function chooseDuration(milliseconds: number | null) {
    if (!durationStatus || saving) return;
    setSaving(true);
    try {
      await onSelect(
        durationStatus,
        milliseconds === null ? null : new Date(Date.now() + milliseconds).toISOString(),
      );
      close();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <SwipeableSheetSurface onClose={close} style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                {durationStatus ? 'Ne kadar sürsün?' : 'Durumunu seç'}
              </Text>
              <Text style={styles.subtitle}>
                {durationStatus
                  ? `${presenceLabel(durationStatus)} durumu için süre seç.`
                  : 'Seçim tüm cihazlarında güncellenir.'}
              </Text>
            </View>
            {durationStatus ? (
              <Pressable
                style={styles.iconButton}
                onPress={() => setDurationStatus(null)}
                accessibilityLabel="Durumlara dön"
              >
                <Icon name="arrow-left" size={22} color={colors.text} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.list}>
            {(durationStatus ? durations : statuses).map((item) => {
              if ('value' in item) {
                return (
                  <Pressable
                    key={item.value}
                    style={styles.row}
                    onPress={() => void chooseStatus(item.value)}
                    disabled={saving}
                  >
                    <View style={[styles.dot, { backgroundColor: item.color }]} />
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle}>{item.label}</Text>
                      <Text style={styles.rowDescription}>{item.description}</Text>
                    </View>
                    {currentStatus === item.value ? (
                      <Icon name="check" size={20} color={colors.waveBright} />
                    ) : (
                      <Icon name="chevron-right" size={20} color={colors.textMuted} />
                    )}
                  </Pressable>
                );
              }
              return (
                <Pressable
                  key={item.label}
                  style={styles.row}
                  onPress={() => void chooseDuration(item.milliseconds)}
                  disabled={saving}
                >
                  <Icon name="clock-outline" size={22} color={colors.waveBright} />
                  <Text style={styles.rowTitle}>{item.label}</Text>
                  <Icon name="chevron-right" size={20} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
        </SwipeableSheetSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { paddingBottom: spacing.xl, borderWidth: 1, borderColor: colors.line },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  title: { color: colors.text, ...typography.heading },
  subtitle: { color: colors.textMuted, ...typography.caption, marginTop: spacing.xxs },
  iconButton: {
    width: touch.minimum,
    height: touch.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
  },
  list: { paddingHorizontal: spacing.md, gap: spacing.xs },
  row: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  dot: { width: 13, height: 13, borderRadius: radius.pill },
  rowText: { flex: 1 },
  rowTitle: { flex: 1, color: colors.text, ...typography.label },
  rowDescription: { color: colors.textMuted, ...typography.caption, marginTop: 2 },
});
