import { Text, Modal, Pressable } from '@/components/localized-native';
import type { SocialCallSession } from '@wapve/contracts';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { router } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState, StyleSheet, View } from '@/components/themed-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@wapve/design-tokens';
import WapveCall, { type CallBubbleAction } from '../../modules/wapve-call';
import { Avatar, Button } from '@/components/ui';
import { Icon } from '@/components/icon';
import { realtime } from './client';
import { useAuth } from './auth';

export type ActiveCall = {
  kind: 'direct' | 'group' | 'voice';
  conversationId?: string;
  serverId?: string;
  channelId?: string;
  callId?: string;
  mode: 'audio' | 'video';
  title: string;
  status: string;
  muted: boolean;
  deafened?: boolean;
  speakerEnabled?: boolean;
  minimized: boolean;
  endRequestedAt?: number;
  controlAction?: { type: Exclude<CallBubbleAction, 'hangup'>; nonce: number };
};
type CallContextValue = {
  incoming: SocialCallSession | null;
  active: ActiveCall | null;
  setActive(value: ActiveCall | null | ((current: ActiveCall | null) => ActiveCall | null)): void;
  decline(): void;
  accept(): void;
  stopIncomingRing(): void;
  requestControl(action: CallBubbleAction): void;
};
const CallContext = createContext<CallContextValue | null>(null);
const incomingSound = require('../../assets/audio/incoming-ring.wav') as number;

export function CallProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [barHeight, setBarHeight] = useState(60);
  const [incoming, setIncoming] = useState<SocialCallSession | null>(null);
  const [active, setActive] = useState<ActiveCall | null>(null);
  const [applicationState, setApplicationState] = useState(AppState.currentState);
  const incomingRef = useRef<SocialCallSession | null>(null);
  const player = useRef<AudioPlayer | null>(null);
  const silenced = useRef(new Set<string>());
  const bubbleCallId = useRef<string | null>(null);
  function setIncomingCall(call: SocialCallSession | null) {
    incomingRef.current = call;
    setIncoming(call);
  }
  function stopIncomingRing() {
    const call = incomingRef.current;
    player.current?.pause();
    player.current?.remove();
    player.current = null;
    if (call) silenced.current.add(call.id);
  }
  useEffect(() => {
    if (!user) return;
    let active = true;
    let cleanup: (() => void) | undefined;
    void realtime.connect('/calls').then((socket) => {
      if (!active) return;
      const onIncoming = (call: SocialCallSession) => {
        if (silenced.current.has(call.id) || call.joinedUserIds.includes(user.id)) return;
        if (incomingRef.current?.id && incomingRef.current.id !== call.id) stopIncomingRing();
        setIncomingCall(call);
        void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }).then(
          () => {
            if (silenced.current.has(call.id)) return;
            player.current?.remove();
            player.current = createAudioPlayer(incomingSound, { downloadFirst: true });
            player.current.loop = true;
            player.current.play();
          },
        );
        void WapveCall.showIncomingCall(
          call.id,
          call.title,
          `wapve://call/${call.kind}/${call.conversationId}?callId=${call.id}`,
        );
      };
      const onEnded = ({ callId }: { callId: string }) => {
        if (incomingRef.current?.id === callId) {
          silenced.current.add(callId);
          stopIncomingRing();
          setIncomingCall(null);
        }
        setActive((current) => (current?.callId === callId ? null : current));
        void WapveCall.stopCall(callId);
      };
      socket.on('call:incoming', onIncoming);
      socket.on('call:ended', onEnded);
      cleanup = () => {
        socket.off('call:incoming', onIncoming);
        socket.off('call:ended', onEnded);
      };
    });
    return () => {
      active = false;
      cleanup?.();
      stopIncomingRing();
    };
  }, [user?.id]);
  const dispatchControl = useCallback((action: CallBubbleAction, nativeSpeakerChange = false) => {
    setActive((current) => {
      if (!current) return current;
      if (action === 'hangup') return { ...current, endRequestedAt: Date.now() };
      if (action === 'speaker') {
        const next = !current.speakerEnabled;
        if (!nativeSpeakerChange) void WapveCall.setSpeakerEnabled(next);
        return { ...current, speakerEnabled: next };
      }
      return { ...current, controlAction: { type: action, nonce: Date.now() } };
    });
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setApplicationState);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    const subscription = WapveCall.addListener('onCallBubbleAction', ({ action, nativeApplied }) =>
      dispatchControl(action, nativeApplied === true),
    );
    return () => subscription.remove();
  }, [dispatchControl]);
  useEffect(() => {
    const callId = active?.callId;
    if (callId) {
      bubbleCallId.current = callId;
      void WapveCall.setCallBubbleVisible(callId, active.title, applicationState !== 'active');
      return;
    }
    bubbleCallId.current = null;
  }, [active?.callId, active?.title, applicationState]);
  function decline() {
    const call = incomingRef.current;
    if (!call) return;
    silenced.current.add(call.id);
    stopIncomingRing();
    setIncomingCall(null);
    void realtime
      .connect('/calls')
      .then((socket) => socket.emit('call:decline', { callId: call.id }));
    void WapveCall.stopCall(call.id);
  }
  function accept() {
    const call = incomingRef.current;
    if (!call) return;
    silenced.current.add(call.id);
    stopIncomingRing();
    setIncomingCall(null);
    void WapveCall.stopCall(call.id);
    router.push({
      pathname: '/call/[kind]/[conversationId]',
      params: {
        kind: call.kind,
        conversationId: call.conversationId,
        callId: call.id,
        mode: call.mode,
        title: call.title,
      },
    });
  }
  return (
    <CallContext.Provider
      value={{
        incoming,
        active,
        setActive,
        decline,
        accept,
        stopIncomingRing,
        requestControl: dispatchControl,
      }}
    >
      <View
        style={{
          flex: 1,
          paddingBottom: active?.minimized
            ? barHeight + Math.max(insets.bottom, spacing.sm) + spacing.sm
            : 0,
        }}
      >
        {children}
      </View>
      {active?.minimized ? (
        <MiniCallBar
          onHeight={setBarHeight}
          call={active}
          open={() => {
            setActive((current) => (current ? { ...current, minimized: false } : null));
            if (active.kind === 'voice' && active.serverId && active.channelId)
              router.dismissTo({
                pathname: '/voice/[serverId]/[channelId]',
                params: {
                  serverId: active.serverId,
                  channelId: active.channelId,
                  name: active.title,
                },
              });
            else if (active.conversationId && active.kind !== 'voice')
              router.dismissTo({
                pathname: '/call/[kind]/[conversationId]',
                params: {
                  kind: active.kind,
                  conversationId: active.conversationId,
                  mode: active.mode,
                  title: active.title,
                  ...(active.callId ? { callId: active.callId } : {}),
                },
              });
          }}
          control={dispatchControl}
        />
      ) : null}
      <IncomingCall call={incoming} decline={decline} accept={accept} />
    </CallContext.Provider>
  );
}

function MiniCallBar({
  call,
  open,
  control,
  onHeight,
}: {
  call: ActiveCall;
  open(): void;
  control(action: CallBubbleAction): void;
  onHeight(height: number): void;
}) {
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  const reconnecting = /bağlan|yenilen|beklen|failed|connect/iu.test(call.status);
  return (
    <View
      onLayout={(event) => onHeight(event.nativeEvent.layout.height)}
      style={[styles.mini, { bottom: Math.max(insets.bottom, spacing.sm) }]}
    >
      <View style={styles.miniMain}>
        <Pressable
          style={styles.miniOpen}
          onPress={open}
          accessibilityLabel="Devam eden aramaya dön"
        >
          <View style={styles.miniPulse}>
            <Icon
              name={call.mode === 'video' ? 'video-outline' : 'phone-outline'}
              color={reconnecting ? colors.warning : colors.success}
              size={21}
            />
          </View>
          <View style={styles.miniCopy}>
            <Text style={styles.miniTitle} numberOfLines={1}>
              {call.title}
            </Text>
            <Text
              style={[styles.miniStatus, reconnecting && styles.miniStatusReconnecting]}
              numberOfLines={1}
            >
              {call.status}
              {call.muted ? ' · Mikrofon kapalı' : ''}
            </Text>
          </View>
        </Pressable>
        <Pressable
          style={[styles.miniControl, call.muted && styles.miniControlActive]}
          onPress={() => control('mute')}
          accessibilityLabel={call.muted ? 'Sesi aç' : 'Sustur'}
        >
          <Icon name={call.muted ? 'microphone-off' : 'microphone'} color={colors.text} size={20} />
        </Pressable>
        <Pressable
          style={styles.miniControl}
          onPress={() => setExpanded((value) => !value)}
          accessibilityLabel="Arama kontrollerini göster"
          accessibilityState={{ expanded }}
        >
          <Icon
            name={expanded ? 'chevron-down' : 'chevron-up'}
            color={colors.textMuted}
            size={22}
          />
        </Pressable>
      </View>
      {expanded ? (
        <View style={styles.miniActions}>
          <MiniAction
            label={call.deafened ? 'Görüşme sesini aç' : 'Görüşme sesini kapat'}
            icon={call.deafened ? 'headphones-off' : 'headphones'}
            active={Boolean(call.deafened)}
            onPress={() => control('deafen')}
          />
          <MiniAction
            label={call.speakerEnabled ? 'Telefon sesine geç' : 'Hoparlöre geç'}
            icon={call.speakerEnabled ? 'volume-high' : 'volume-medium'}
            active={Boolean(call.speakerEnabled)}
            onPress={() => control('speaker')}
          />
          <MiniAction label="Aramaya dön" icon="arrow-expand" onPress={open} />
          <MiniAction
            label="Aramayı kapat"
            icon="phone-hangup"
            danger
            onPress={() => control('hangup')}
          />
        </View>
      ) : null}
    </View>
  );
}

function MiniAction({
  label,
  icon,
  active,
  danger,
  onPress,
}: {
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
  active?: boolean;
  danger?: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      style={[
        styles.miniAction,
        active && styles.miniControlActive,
        danger && styles.miniActionDanger,
      ]}
      onPress={onPress}
      accessibilityLabel={label}
    >
      <Icon name={icon} color={colors.text} size={20} />
      <Text style={styles.miniActionLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

function IncomingCall({
  call,
  decline,
  accept,
}: {
  call: SocialCallSession | null;
  decline(): void;
  accept(): void;
}) {
  return (
    <Modal
      visible={Boolean(call)}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={decline}
    >
      <View style={styles.overlay}>
        {call ? (
          <View style={styles.card}>
            <View style={styles.pulse}>
              <Avatar name={call.caller.displayName} uri={call.caller.avatarUrl} size={92} online />
            </View>
            <Text style={styles.title}>{call.title}</Text>
            <Text style={styles.subtitle}>
              {call.mode === 'video' ? 'Görüntülü' : 'Sesli'} Wapve araması
            </Text>
            <View style={styles.actions}>
              <Pressable
                testID="incoming-call.decline"
                style={[styles.round, styles.decline]}
                onPress={decline}
                accessibilityLabel="Aramayı reddet"
              >
                <Icon name="phone-hangup" color={colors.text} size={30} />
              </Pressable>
              <Pressable
                testID="incoming-call.accept"
                style={[styles.round, styles.accept]}
                onPress={accept}
                accessibilityLabel="Aramayı kabul et"
              >
                <Icon name="phone" color={colors.text} size={30} />
              </Pressable>
            </View>
            <Button label="Şimdi uygun değilim" variant="ghost" onPress={decline} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
export function useCalls() {
  const value = useContext(CallContext);
  if (!value) throw new Error('useCalls must be inside CallProvider');
  return value;
}
const styles = StyleSheet.create({
  mini: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    zIndex: 1000,
    elevation: 20,
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.success,
    backgroundColor: colors.surface,
  },
  miniMain: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  miniOpen: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  miniPulse: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  miniCopy: { flex: 1, minWidth: 0 },
  miniTitle: { color: colors.text, ...typography.label },
  miniStatus: { color: colors.success, ...typography.caption },
  miniStatusReconnecting: { color: colors.warning },
  miniControl: {
    width: 48,
    height: 48,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  miniControlActive: { backgroundColor: colors.wave },
  miniActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.xs,
    padding: spacing.xs,
    paddingTop: 0,
  },
  miniAction: {
    flex: 1,
    minHeight: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: colors.surfaceRaised,
  },
  miniActionDanger: { backgroundColor: colors.danger },
  miniActionLabel: { color: colors.textMuted, fontSize: 11, lineHeight: 15, textAlign: 'center' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2,7,18,.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  pulse: {
    width: 126,
    height: 126,
    borderRadius: 63,
    borderWidth: 2,
    borderColor: colors.wave,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { color: colors.text, ...typography.title, textAlign: 'center' },
  subtitle: { color: colors.textMuted, ...typography.body },
  actions: { flexDirection: 'row', gap: 56, marginVertical: spacing.xl },
  round: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decline: { backgroundColor: colors.danger },
  accept: { backgroundColor: colors.success },
});
