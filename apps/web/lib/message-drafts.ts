const DRAFT_PREFIX = 'wapve:message-draft:v1';
const MAX_DRAFT_LENGTH = 4000;

export function messageDraftKey(
  userId: string,
  kind: 'channel' | 'direct' | 'group',
  conversationId: string,
): string {
  return `${DRAFT_PREFIX}:${userId}:${kind}:${conversationId}`;
}

export function readMessageDraft(key: string): string {
  try {
    return window.localStorage.getItem(key)?.slice(0, MAX_DRAFT_LENGTH) ?? '';
  } catch {
    return '';
  }
}

export function writeMessageDraft(key: string, value: string): void {
  try {
    const normalized = value.slice(0, MAX_DRAFT_LENGTH);
    if (normalized) window.localStorage.setItem(key, normalized);
    else window.localStorage.removeItem(key);
  } catch {
    // Draft persistence is a convenience; messaging must still work when storage is unavailable.
  }
}

export function removeMessageDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore unavailable or blocked storage.
  }
}
