import * as SecureStore from 'expo-secure-store';
import { fetch as expoFetch } from 'expo/fetch';
import { apiUrl } from './client';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type {
  MobileSupportStaffSession,
  MobileSupportCustomerSession,
  SupportStaffIdentity,
  SupportStaffLoginInput,
} from '@wapve/contracts';

const key = (accountId: string, scope: string) => `wapve.support.v1.${accountId}.${scope}`;
const scopesKey = (accountId: string) => `wapve.support.scopes.v1.${accountId}`;
export async function restoreSupportIdentity(accountId: string) {
  if (!(await SecureStore.getItemAsync(key(accountId, 'staff')))) return null;
  return supportRequest<SupportStaffIdentity>(
    accountId,
    'staff',
    '/support/staff/me',
  );
}
async function rememberScope(accountId: string, scope: string) {
  let scopes: string[] = [];
  try {
    const value: unknown = JSON.parse(
      (await SecureStore.getItemAsync(scopesKey(accountId))) ?? '[]',
    );
    if (Array.isArray(value))
      scopes = value.filter(
        (item): item is string => typeof item === 'string' && /^(staff|WP-[A-Z0-9-]+)$/i.test(item),
      );
  } catch {
    /* Rebuild corrupt metadata. */
  }
  await SecureStore.setItemAsync(
    scopesKey(accountId),
    JSON.stringify([...new Set([...scopes, scope])]),
  );
}
export async function supportRequest<T>(
  accountId: string,
  scope: string,
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  if (!path.startsWith('/support/')) throw new Error('Invalid support path');
  const token = await SecureStore.getItemAsync(key(accountId, scope));
  const response = await expoFetch(`${apiUrl}${path}`, {
    method,
    credentials: 'omit',
    headers: {
      'x-wapve-client': 'mobile',
      'User-Agent': 'WapveMobileSupport/1',
      ...(token
        ? { [scope === 'staff' ? 'x-wapve-support-staff' : 'x-wapve-support-customer']: token }
        : {}),
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body !== undefined ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    if (response.status === 401) await SecureStore.deleteItemAsync(key(accountId, scope));
    throw new Error(`Support request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
export async function supportLogin(accountId: string, input: SupportStaffLoginInput) {
  const result = await supportRequest<MobileSupportStaffSession>(
    accountId,
    'staff',
    '/support/staff/mobile-login',
    'POST',
    input,
  );
  await SecureStore.setItemAsync(key(accountId, 'staff'), result.token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await rememberScope(accountId, 'staff');
  return {
    userId: result.userId,
    email: result.email,
    displayName: result.displayName,
    owner: result.owner,
    needsOnboarding: result.needsOnboarding,
    expiresAt: result.expiresAt,
  };
}
export async function supportExchange(accountId: string, reference: string, token: string) {
  const result = await supportRequest<MobileSupportCustomerSession>(
    accountId,
    reference,
    '/support/customer/mobile-exchange',
    'POST',
    { reference, token },
  );
  await SecureStore.setItemAsync(key(accountId, reference), result.token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await rememberScope(accountId, reference);
}
export async function supportLogout(accountId: string) {
  try {
    await supportRequest(accountId, 'staff', '/support/staff/logout', 'POST');
  } finally {
    await SecureStore.deleteItemAsync(key(accountId, 'staff'));
  }
}
export async function clearSupportSessions(accountId: string) {
  try {
    if (await SecureStore.getItemAsync(key(accountId, 'staff'))) await supportLogout(accountId);
  } catch {
    /* Local credentials still must be removed while offline. */
  }
  let scopes: unknown = [];
  try {
    scopes = JSON.parse((await SecureStore.getItemAsync(scopesKey(accountId))) ?? '[]');
  } catch {
    /* Corrupt metadata contains no usable sessions. */
  }
  if (Array.isArray(scopes))
    for (const scope of scopes)
      if (typeof scope === 'string' && /^(staff|WP-[A-Z0-9-]+)$/i.test(scope))
        await SecureStore.deleteItemAsync(key(accountId, scope));
  await SecureStore.deleteItemAsync(key(accountId, 'staff'));
  await SecureStore.deleteItemAsync(scopesKey(accountId));
}

export async function shareSupportAttachment(
  accountId: string,
  scope: string,
  path: string,
  name: string,
) {
  if (!/^\/support\/(?:staff|customer)\/tickets\/[^/]+\/attachments\/[0-9a-f-]+$/i.test(path))
    throw new Error('Invalid attachment path');
  const token = await SecureStore.getItemAsync(key(accountId, scope));
  if (!token) throw new Error('Support session expired');
  const response = await expoFetch(`${apiUrl}${path}`, {
    credentials: 'omit',
    headers: {
      'x-wapve-client': 'mobile',
      'User-Agent': 'WapveMobileSupport/1',
      [scope === 'staff' ? 'x-wapve-support-staff' : 'x-wapve-support-customer']: token,
    },
  });
  if (!response.ok) throw new Error(`Attachment unavailable (${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 10 * 1024 * 1024) throw new Error('Attachment exceeds limit');
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
  const file = new File(Paths.cache, `support-${Date.now()}-${safeName}`);
  try {
    file.write(bytes);
    await Sharing.shareAsync(file.uri);
  } finally {
    if (file.exists) file.delete();
  }
}
