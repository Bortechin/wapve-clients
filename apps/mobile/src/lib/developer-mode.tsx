import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

const storageKey = 'wapve.developer-mode.v1';

type DeveloperModeContextValue = {
  enabled: boolean;
  ready: boolean;
  setEnabled(value: boolean): Promise<void>;
};

const DeveloperModeContext = createContext<DeveloperModeContextValue | null>(null);

export function DeveloperModeProvider({ children }: PropsWithChildren) {
  const [enabled, setEnabledState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(storageKey)
      .then((value) => {
        if (active) setEnabledState(value === 'enabled');
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const setEnabled = useCallback(async (value: boolean) => {
    setEnabledState(value);
    await SecureStore.setItemAsync(storageKey, value ? 'enabled' : 'disabled', {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }, []);

  const value = useMemo(() => ({ enabled, ready, setEnabled }), [enabled, ready, setEnabled]);
  return <DeveloperModeContext.Provider value={value}>{children}</DeveloperModeContext.Provider>;
}

export function useDeveloperMode() {
  const value = useContext(DeveloperModeContext);
  if (!value) throw new Error('useDeveloperMode must be used inside DeveloperModeProvider');
  return value;
}
