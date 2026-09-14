import * as SecureStore from 'expo-secure-store';

const CATEGORY_STORAGE_KEY = 'wapve.mobile.collapsed-categories.v1';

function parse(value: string | null): Record<string, string[]> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).map(([serverId, ids]) => [
        serverId,
        Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [],
      ]),
    );
  } catch {
    return {};
  }
}

export async function readCollapsedCategories(serverId: string): Promise<Set<string>> {
  const current = parse(await SecureStore.getItemAsync(CATEGORY_STORAGE_KEY));
  return new Set(current[serverId] ?? []);
}

export async function writeCollapsedCategories(serverId: string, ids: Set<string>): Promise<void> {
  const current = parse(await SecureStore.getItemAsync(CATEGORY_STORAGE_KEY));
  const next = { ...current, [serverId]: [...ids] };
  await SecureStore.setItemAsync(CATEGORY_STORAGE_KEY, JSON.stringify(next));
}
