import Constants from 'expo-constants';
import { fetch as expoFetch } from 'expo/fetch';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { WapveApiClient } from '@wapve/api-client';
import { WapveRealtimeClient } from '@wapve/realtime';
import { secureTokenStorage } from './session-storage';

type WapveExtra = { apiUrl?: string; socketUrl?: string };
const extra = (Constants.expoConfig?.extra ?? {}) as WapveExtra;

export const apiUrl = extra.apiUrl ?? 'https://wapve.com/api/v1';
export const socketUrl = extra.socketUrl ?? 'https://wapve.com';
export const api = new WapveApiClient(
  apiUrl.replace(/\/$/, ''),
  Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
  secureTokenStorage,
  expoFetch as unknown as typeof fetch,
);
export const realtime = new WapveRealtimeClient(socketUrl.replace(/\/$/, ''), secureTokenStorage);

/**
 * Expo SDK 57's fetch implementation only accepts real Blob/File parts.
 * The old React Native `{ uri, name, type }` pseudo-file throws
 * `Unsupported FormDataPart implementation` on Android's new architecture.
 */
export async function prepareMobileUploadForm(uri: string, requestedName: string) {
  const safeName = requestedName
    .replace(/[\\/:*?"<>|]/gu, '_')
    .split('')
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
    .trim()
    .slice(0, 180) || 'wapve-file';
  const stagingDirectory = new Directory(
    Paths.cache,
    'wapve-upload-staging',
    `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  stagingDirectory.create({ intermediates: true, idempotent: true });
  const stagedFile = new File(stagingDirectory, safeName);
  try {
    await new File(uri).copy(stagedFile, { overwrite: true });
  } catch (error) {
    try { stagingDirectory.delete(); } catch { /* Best-effort cache cleanup. */ }
    throw error;
  }
  const form = new FormData();
  form.append('file', stagedFile);
  return {
    form,
    cleanup() {
      try { stagingDirectory.delete(); } catch { /* Best-effort cache cleanup. */ }
    },
  };
}

export async function mobileUpload<T = void>(path: string, uri: string, name: string): Promise<T> {
  const prepared = await prepareMobileUploadForm(uri, name);
  try {
    return await api.request<T>(path, { method: 'POST', body: prepared.form });
  } finally {
    prepared.cleanup();
  }
}

export async function mobileUploadWithProgress(
  path: string,
  uri: string,
  name: string,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  onProgress(0.06);
  const prepared = await prepareMobileUploadForm(uri, name);
  let displayedProgress = 0.06;
  const progressTimer = setInterval(() => {
    displayedProgress = Math.min(0.88, displayedProgress + Math.max(0.025, (0.9 - displayedProgress) * 0.12));
    onProgress(displayedProgress);
  }, 180);
  try {
    await api.request<void>(path, {
      method: 'POST',
      body: prepared.form,
      ...(signal ? { signal } : {}),
    });
    onProgress(1);
  } finally {
    clearInterval(progressTimer);
    prepared.cleanup();
  }
}
