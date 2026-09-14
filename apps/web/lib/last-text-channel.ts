export const LAST_TEXT_CHANNELS_STORAGE_KEY = 'wapve:last-text-channels:v1';

export function parseLastTextChannels(value: string | null): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          entry[0].length > 0 && typeof entry[1] === 'string' && entry[1].length > 0,
      ),
    );
  } catch {
    return {};
  }
}

export function readLastTextChannel(serverPublicId: string): string | null {
  if (typeof window === 'undefined') return null;
  return (
    parseLastTextChannels(window.localStorage.getItem(LAST_TEXT_CHANNELS_STORAGE_KEY))[
      serverPublicId
    ] ?? null
  );
}

export function rememberLastTextChannel(serverPublicId: string, channelPublicId: string): void {
  if (typeof window === 'undefined') return;
  const current = parseLastTextChannels(
    window.localStorage.getItem(LAST_TEXT_CHANNELS_STORAGE_KEY),
  );
  window.localStorage.setItem(
    LAST_TEXT_CHANNELS_STORAGE_KEY,
    JSON.stringify({ ...current, [serverPublicId]: channelPublicId }),
  );
}
