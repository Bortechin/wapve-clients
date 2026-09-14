import * as SecureStore from 'expo-secure-store';
import type { MobileTokens, TokenStorage } from '@wapve/api-client';

const SESSION_KEY = 'wapve.mobile.session.v1';
const DEVICE_KEY = 'wapve.mobile.device.v1';

export async function mobileDeviceId(): Promise<string> {
  const current = await SecureStore.getItemAsync(DEVICE_KEY);
  if (current) return current;
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.map((value) => value.toString(16).padStart(2, '0')).join('');
  const created = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  await SecureStore.setItemAsync(DEVICE_KEY, created, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return created;
}

export const secureTokenStorage: TokenStorage = {
  async load() {
    const value = await SecureStore.getItemAsync(SESSION_KEY);
    if (!value) return null;
    try {
      return JSON.parse(value) as MobileTokens;
    } catch {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      return null;
    }
  },
  async save(tokens) {
    const { sessionId, accessToken, accessExpiresAt, refreshToken, refreshExpiresAt } = tokens;
    await SecureStore.setItemAsync(
      SESSION_KEY,
      JSON.stringify({ sessionId, accessToken, accessExpiresAt, refreshToken, refreshExpiresAt }),
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    );
  },
  clear() {
    return SecureStore.deleteItemAsync(SESSION_KEY);
  },
};
