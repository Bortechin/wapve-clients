const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const MESSAGE_HASH_PATTERN = new RegExp(`^#message-(${UUID_PATTERN.source.slice(1, -1)})$`, 'iu');
const SAFE_RETURN_PATH = /^\/(?:invite|channels|waves)\/[^\s?#]+(?:\/[^\s?#]+)?(?:\?messageId=[0-9a-f-]{36})?$/iu;

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function decodeRouteSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function messageIdFromUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).hash.match(MESSAGE_HASH_PATTERN)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function safeReturnPath(value: string | string[] | undefined): Extract<Href, string> | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !SAFE_RETURN_PATH.test(candidate)) return null;
  return candidate;
}

export function deepLinkReturnPath(path: string, messageId?: string | null) {
  return messageId && isUuid(messageId)
    ? `${path}?messageId=${encodeURIComponent(messageId)}`
    : path;
}
import type { Href } from 'expo-router';
