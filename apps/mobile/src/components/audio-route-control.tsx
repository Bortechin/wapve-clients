import { Text, Modal, Pressable } from '@/components/localized-native';
import {
  colors,
  radius,
  spacing,
  touch,
  typography } from '@wapve/design-tokens';
import { useEffect,
  useState } from 'react';
import {
  PermissionsAndroid,
  Platform,
  StyleSheet,
  View,
} from '@/components/themed-native';
import WapveCall from '../../modules/wapve-call';
import { Icon, type IconName } from './icon';
import { SwipeableSheetSurface } from './swipeable-sheet';

export type AudioRoute = Awaited<ReturnType<typeof WapveCall.getAudioRoutes>>[number];

export function AudioRouteControl({ onSelected }: { onSelected?(route: AudioRoute): void }) {
  const [open, setOpen] = useState(false);
  const [routes, setRoutes] = useState<AudioRoute[]>([]);
  const selected = routes.find((route) => route.selected);
  async function refresh() {
    try {
      if (Platform.OS === 'android' && Platform.Version >= 31) await PermissionsAndroid.request('android.permission.BLUETOOTH_CONNECT');
      setRoutes(await WapveCall.getAudioRoutes());
    } catch { setRoutes([]); }
  }
  useEffect(() => { void refresh(); }, []);
  async function choose(route: AudioRoute) {
    if (await WapveCall.setAudioRoute(route.id)) {
      await refresh();
      onSelected?.(route);
      setOpen(false);
    }
  }
  return (
    <>
      <Pressable style={styles.controlWrap} onPress={() => { setOpen(true); void refresh(); }} accessibilityLabel={`Ses çıkışı: ${selected?.label ?? 'seç'}`}>
        <View style={styles.control}><Icon name={routeIcon(selected?.type)} color={colors.text} size={25} /></View>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} /><SwipeableSheetSurface style={styles.sheet} onClose={() => setOpen(false)}>
          <Text accessibilityRole="header" style={styles.title}>Ses çıkışı</Text>
          <Text style={styles.body}>Görüşme sesini çalacak cihazı seç.</Text>
          {routes.map((route) => <Pressable key={route.id} style={[styles.route, route.selected && styles.routeActive]} onPress={() => void choose(route)} accessibilityRole="radio" accessibilityState={{ checked: route.selected }}><View style={styles.routeIcon}><Icon name={routeIcon(route.type)} color={route.selected ? colors.waveBright : colors.textMuted} size={24} /></View><Text style={styles.routeLabel}>{route.label}</Text><Icon name={route.selected ? 'radiobox-marked' : 'radiobox-blank'} color={route.selected ? colors.waveBright : colors.textDim} size={23} /></Pressable>)}
          {!routes.length ? <Text style={styles.body}>Kullanılabilir ses çıkışı bulunamadı.</Text> : null}
        </SwipeableSheetSurface></View>
      </Modal>
    </>
  );
}

function routeIcon(type?: AudioRoute['type']): IconName {
  if (type === 'speaker') return 'volume-high';
  if (type === 'bluetooth') return 'bluetooth-audio';
  if (type === 'wired' || type === 'usb') return 'headphones';
  return 'phone-in-talk-outline';
}

const styles = StyleSheet.create({
  controlWrap: { width: 60, minHeight: 66, alignItems: 'center', justifyContent: 'center' },
  control: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm, backgroundColor: colors.canvas },
  title: { color: colors.text, ...typography.title },
  body: { color: colors.textMuted, ...typography.body },
  route: { minHeight: touch.minimum + 10, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface },
  routeActive: { borderWidth: 1, borderColor: colors.waveBright, backgroundColor: colors.surfaceRaised },
  routeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  routeLabel: { flex: 1, color: colors.text, ...typography.label },
});
