import { Text, Modal, Pressable } from '@/components/localized-native';
import {
  manipulateAsync,
  SaveFormat } from 'expo-image-manipulator';
import { Image } from 'expo-image';
import { useEffect,
  useMemo,
  useState } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
} from '@/components/themed-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, radius, spacing, typography } from '@wapve/design-tokens';
import { Button } from './ui';
import { Icon } from './icon';
import { clampCropTranslation, cropRectangle } from '@/lib/image-crop';

export type CropSource = { uri: string; width: number; height: number; fileName: string };
export type CropResult = { uri: string; fileName: string };

export function ImageCropEditor({
  source,
  aspect,
  round = false,
  title,
  close,
  confirm,
}: {
  source: CropSource | null;
  aspect: readonly [number, number];
  round?: boolean;
  title: string;
  close(): void;
  confirm(result: CropResult): void | Promise<void>;
}) {
  const { width, height } = useWindowDimensions();
  const frameWidth = Math.min(width - spacing.lg * 2, 620);
  const frameHeight = Math.min(frameWidth * (aspect[1] / aspect[0]), height * 0.56);
  const [working, setWorking] = useState<CropSource | null>(source);
  const [busy, setBusy] = useState(false);
  const [rotation, setRotation] = useState(0);
  const zoom = useSharedValue(1);
  const startZoom = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const sourceWidth = rotation % 180 === 0 ? (working?.width ?? 1) : (working?.height ?? 1);
  const sourceHeight = rotation % 180 === 0 ? (working?.height ?? 1) : (working?.width ?? 1);
  const baseScale = Math.max(frameWidth / sourceWidth, frameHeight / sourceHeight);
  const renderedWidth = sourceWidth * baseScale;
  const renderedHeight = sourceHeight * baseScale;

  function resetTransform() {
    zoom.value = withTiming(1);
    x.value = withTiming(0);
    y.value = withTiming(0);
  }
  useEffect(() => {
    setWorking(source);
    setRotation(0);
    resetTransform();
  }, [source?.uri]);

  const clampTranslation = (nextX: number, nextY: number, nextZoom: number) => {
    'worklet';
    const clamped = clampCropTranslation(renderedWidth, renderedHeight, frameWidth, frameHeight, nextZoom, nextX, nextY);
    return { nextX: clamped.x, nextY: clamped.y };
  };
  const pan = useMemo(() => Gesture.Pan().onBegin(() => { startX.value = x.value; startY.value = y.value; }).onUpdate((event) => {
    const clamped = clampTranslation(startX.value + event.translationX, startY.value + event.translationY, zoom.value);
    x.value = clamped.nextX;
    y.value = clamped.nextY;
  }), [frameHeight, frameWidth, renderedHeight, renderedWidth]);
  const pinch = useMemo(() => Gesture.Pinch().onBegin(() => { startZoom.value = zoom.value; }).onUpdate((event) => {
    const next = Math.max(1, Math.min(4, startZoom.value * event.scale));
    zoom.value = next;
    const clamped = clampTranslation(x.value, y.value, next);
    x.value = clamped.nextX;
    y.value = clamped.nextY;
  }), [frameHeight, frameWidth, renderedHeight, renderedWidth]);
  const imageStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: zoom.value }, { rotate: `${rotation}deg` }] }));
  const zoomFillStyle = useAnimatedStyle(() => ({ width: `${((zoom.value - 1) / 3) * 100}%` }));

  function changeZoom(delta: number) {
    const next = Math.max(1, Math.min(4, zoom.value + delta));
    zoom.value = withTiming(next);
    const clamped = clampTranslation(x.value, y.value, next);
    x.value = withTiming(clamped.nextX);
    y.value = withTiming(clamped.nextY);
  }
  async function save() {
    if (!working || busy) return;
    setBusy(true);
    try {
      const rotated = rotation
        ? await manipulateAsync(working.uri, [{ rotate: rotation }], { compress: 1, format: SaveFormat.JPEG })
        : { uri: working.uri, width: working.width, height: working.height };
      const crop = cropRectangle({
        sourceWidth: rotated.width,
        sourceHeight: rotated.height,
        frameWidth,
        frameHeight,
        zoom: zoom.value,
        translateX: x.value,
        translateY: y.value,
      });
      const targetWidth = aspect[0] === aspect[1] ? 1024 : 1920;
      const result = await manipulateAsync(rotated.uri, [
        { crop },
        { resize: { width: targetWidth } },
      ], { compress: 0.9, format: SaveFormat.JPEG });
      await confirm({ uri: result.uri, fileName: working.fileName.replace(/\.[^.]+$/u, '') + '-crop.jpg' });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal visible={Boolean(source)} animationType="slide" onRequestClose={close}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable style={styles.iconButton} onPress={close} accessibilityLabel="Düzenleyiciyi kapat"><Icon name="close" color={colors.text} size={27} /></Pressable>
          <View style={styles.headerCopy}><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>Sürükle, iki parmakla yakınlaştır ve çerçeveyi ayarla.</Text></View>
          <Pressable style={styles.iconButton} onPress={() => { setRotation((value) => (value + 90) % 360); resetTransform(); }} accessibilityLabel="90 derece döndür"><Icon name="rotate-right" color={colors.waveBright} size={25} /></Pressable>
        </View>
        <View style={styles.stage}>
          <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
            <View style={[styles.frame, { width: frameWidth, height: frameHeight, borderRadius: round ? frameWidth / 2 : radius.md }]}>
              {working ? <Animated.View style={[{ width: working.width * baseScale, height: working.height * baseScale }, imageStyle]}><Image source={{ uri: working.uri }} style={StyleSheet.absoluteFill} contentFit="fill" /></Animated.View> : null}
              <View pointerEvents="none" style={[styles.cropBorder, { borderRadius: round ? frameWidth / 2 : radius.md }]} />
            </View>
          </GestureDetector>
        </View>
        <View style={styles.controls}>
          <View style={styles.zoomRow}>
            <Pressable style={styles.zoomButton} onPress={() => changeZoom(-0.25)} accessibilityLabel="Uzaklaştır"><Icon name="minus" color={colors.text} size={22} /></Pressable>
            <View style={styles.zoomTrack}><Animated.View style={[styles.zoomFill, zoomFillStyle]} /></View>
            <Pressable style={styles.zoomButton} onPress={() => changeZoom(0.25)} accessibilityLabel="Yakınlaştır"><Icon name="plus" color={colors.text} size={22} /></Pressable>
          </View>
          <Pressable style={styles.reset} onPress={() => { setRotation(0); setWorking(source); resetTransform(); }}><Icon name="restore" color={colors.waveBright} size={21} /><Text style={styles.resetText}>Sıfırla</Text></Pressable>
          <Button label="Kırpmayı kullan" loading={busy} onPress={() => void save()} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  header: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  headerCopy: { flex: 1 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, ...typography.title },
  subtitle: { color: colors.textMuted, ...typography.caption },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  frame: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  cropBorder: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderWidth: 2, borderColor: colors.waveBright },
  controls: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl, backgroundColor: colors.surface },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  zoomButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceRaised },
  zoomTrack: { flex: 1, height: 8, overflow: 'hidden', borderRadius: 4, backgroundColor: colors.lineStrong },
  zoomFill: { height: 8, backgroundColor: colors.waveBright },
  reset: { alignSelf: 'center', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md },
  resetText: { color: colors.waveBright, ...typography.label },
});
