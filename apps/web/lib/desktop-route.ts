const MAX_DESKTOP_TARGET_LENGTH = 512;
const BASE64URL_CODE = /^[A-Za-z0-9_-]{6,64}$/u;
const SERVER_ID = /^\d{15}$/u;
const CHANNEL_ID = /^\d{18}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export const DESKTOP_PRESENTATION_COOKIE = 'wapve_desktop';

export function sanitizeDesktopNext(input: string | string[] | null | undefined): string | null {
  if (typeof input !== 'string' || input.length === 0 || input.length > MAX_DESKTOP_TARGET_LENGTH)
    return null;
  if (
    input.includes('%') ||
    input.includes('\\') ||
    input.includes('//') ||
    input.includes('?') ||
    input.includes('#') ||
    [...input].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 0x20 || codePoint === 0x7f;
    })
  )
    return null;

  if (input === '/app') return input;

  const segments = input.split('/');
  if (segments[0] !== '') return null;

  if (segments.length === 3 && segments[1] === 'invite' && BASE64URL_CODE.test(segments[2] ?? ''))
    return input;

  if (
    segments[1] === 'channels' &&
    (segments.length === 3 || segments.length === 4) &&
    SERVER_ID.test(segments[2] ?? '') &&
    (segments.length === 3 || CHANNEL_ID.test(segments[3] ?? ''))
  )
    return input;

  if (segments.length === 3 && segments[1] === 'waves') {
    const wave = segments[2] ?? '';
    if (UUID.test(wave) || (wave.startsWith('group:') && UUID.test(wave.slice(6)))) return input;
  }

  return null;
}

export function desktopAuthHref(path: '/login' | '/register', next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}
