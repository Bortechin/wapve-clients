import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Platform } from '@/components/themed-native';
import { api } from './client';
import { useAuth } from './auth';
import { useI18n } from './i18n';
import { classifyPushFailure } from './push-diagnostics';

Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
});

export type PushRuntimeStatus = {
  phase:
    | 'idle'
    | 'unsupported'
    | 'permission_denied'
    | 'permission_error'
    | 'fetching_token'
    | 'registering'
    | 'registered'
    | 'token_error'
    | 'server_error';
  detail: string;
  lastAttemptAt: string | null;
};

type PushStatusContextValue = {
  status: PushRuntimeStatus;
  register(locale: 'tr' | 'en'): Promise<PushRuntimeStatus>;
};

const statusStorageKey = 'wapve.push-status.v1';
const initialStatus: PushRuntimeStatus = {
  phase: 'idle',
  detail: 'Henüz bu oturumda push kaydı denenmedi.',
  lastAttemptAt: null,
};
const PushStatusContext = createContext<PushStatusContextValue | null>(null);

export function PushStatusProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState(initialStatus);
  const running = useRef<Promise<PushRuntimeStatus> | null>(null);

  useEffect(() => {
    void SecureStore.getItemAsync(statusStorageKey).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as PushRuntimeStatus;
        if (saved.phase && typeof saved.detail === 'string') setStatus(saved);
      } catch {
        // A corrupt diagnostic must never prevent a new registration attempt.
      }
    });
  }, []);

  const commit = useCallback(async (next: PushRuntimeStatus) => {
    setStatus(next);
    await SecureStore.setItemAsync(statusStorageKey, JSON.stringify(next), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return next;
  }, []);

  const register = useCallback((locale: 'tr' | 'en') => {
    if (running.current) return running.current;
    const task = (async () => {
      const attemptedAt = new Date().toISOString();
      if (Platform.OS !== 'android' || !Device.isDevice) {
        return commit({
          phase: 'unsupported',
          detail: 'FCM kaydı yalnız gerçek Android cihazında yapılabilir.',
          lastAttemptAt: attemptedAt,
        });
      }
      await Notifications.setNotificationChannelAsync('wapve_messages', {
        name: 'Wapve mesajları',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 160, 90, 160],
      });
      let permission: Notifications.NotificationPermissionsStatus;
      try {
        permission = await Notifications.requestPermissionsAsync();
      } catch (error) {
        return commit({ ...classifyPushFailure('permission', error), lastAttemptAt: attemptedAt });
      }
      if (!permission.granted) {
        return commit({
          phase: 'permission_denied',
          detail: 'Android bildirim izni verilmedi.',
          lastAttemptAt: attemptedAt,
        });
      }
      setStatus({
        phase: 'fetching_token',
        detail: 'FCM token alınıyor…',
        lastAttemptAt: attemptedAt,
      });
      let token: Notifications.DevicePushToken;
      try {
        token = await Notifications.getDevicePushTokenAsync();
      } catch (error) {
        return commit({ ...classifyPushFailure('token', error), lastAttemptAt: attemptedAt });
      }
      setStatus({
        phase: 'registering',
        detail: 'FCM token Wapve sunucusuna kaydediliyor…',
        lastAttemptAt: attemptedAt,
      });
      try {
        await api.request('/devices/push/current', {
          method: 'PUT',
          body: {
            platform: 'ANDROID',
            token: String(token.data),
            deviceName: Device.deviceName ?? Device.modelName ?? 'Android',
            appVersion: Application.nativeApplicationVersion ?? '0.1.0',
            locale,
          },
        });
      } catch (error) {
        return commit({ ...classifyPushFailure('server', error), lastAttemptAt: attemptedAt });
      }
      return commit({
        phase: 'registered',
        detail: 'FCM token bu mobil oturum için sunucuya kaydedildi.',
        lastAttemptAt: attemptedAt,
      });
    })().finally(() => {
      running.current = null;
    });
    running.current = task;
    return task;
  }, [commit]);

  const value = useMemo(() => ({ status, register }), [register, status]);
  return <PushStatusContext.Provider value={value}>{children}</PushStatusContext.Provider>;
}

export function usePushStatus() {
  const value = useContext(PushStatusContext);
  if (!value) throw new Error('usePushStatus must be used inside PushStatusProvider');
  return value;
}

export function PushRegistration() {
  const { user } = useAuth();
  const { locale } = useI18n();
  const { register } = usePushStatus();
  useEffect(() => {
    if (!user) return;
    void register(locale);
  }, [locale, register, user?.id]);
  return null;
}
