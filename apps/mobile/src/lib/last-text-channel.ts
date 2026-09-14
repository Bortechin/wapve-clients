import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'wapve:last-text-channels:v1';

type LastTextChannel = { channelId: string; name?: string };

function parse(value: string | null): Record<string, LastTextChannel> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, LastTextChannel>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function rememberLastTextChannel(serverId: string, channelId: string, name?: string) {
  const current = parse(await SecureStore.getItemAsync(STORAGE_KEY));
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify({
    ...current,
    [serverId]: { channelId, ...(name ? { name } : {}) },
  }));
}

export async function readLastTextChannel(serverId: string) {
  const current = parse(await SecureStore.getItemAsync(STORAGE_KEY));
  return current[serverId] ?? null;
}
