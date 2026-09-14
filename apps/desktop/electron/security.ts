export const PRODUCTION_DESKTOP_URL = 'https://wapve.com/desktop';
export const MAX_DEEP_LINK_LENGTH = 2_048;

export type NavigationDecision =
  | { kind: 'internal'; url: URL }
  | { kind: 'external'; url: URL }
  | { kind: 'blocked' };

export type DesktopKeyboardInput = {
  key: string;
  control?: boolean;
  shift?: boolean;
  meta?: boolean;
  alt?: boolean;
};

const DEVTOOLS_LETTER_SHORTCUTS = new Set(['c', 'i', 'j']);

export function isDevToolsShortcut(input: DesktopKeyboardInput): boolean {
  const key = input.key.toLowerCase();
  if (key === 'f12') return true;
  if (!DEVTOOLS_LETTER_SHORTCUTS.has(key)) return false;
  return Boolean((input.control && input.shift) || (input.meta && input.alt));
}

export function resolveContentHome(candidate: string | undefined, packaged: boolean): URL {
  if (!packaged && candidate) {
    const local = validateDevelopmentHome(candidate);
    if (local) return local;
  }
  return new URL(PRODUCTION_DESKTOP_URL);
}

export function validateDevelopmentHome(input: string): URL | null {
  try {
    const url = new URL(input);
    const production = url.protocol === 'https:' && url.hostname === 'wapve.com' && url.port === '';
    const local =
      url.protocol === 'http:' &&
      ['127.0.0.1', 'localhost'].includes(url.hostname) &&
      url.port === '3000';
    if (
      (!production && !local) ||
      url.username ||
      url.password ||
      url.pathname !== '/desktop' ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function sameOrigin(left: URL, right: URL): boolean {
  return (
    ['http:', 'https:'].includes(left.protocol) &&
    left.protocol === right.protocol &&
    left.hostname === right.hostname &&
    effectivePort(left) === effectivePort(right) &&
    !left.username &&
    !left.password
  );
}

export function isAllowedContentPath(pathname: string): boolean {
  const localized = pathname.match(/^\/(?:tr|en)(?=\/|$)/u);
  const path = localized ? pathname.slice(localized[0].length) || '/' : pathname;
  if (
    [
      '/desktop',
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
      '/verify-email',
      '/app',
    ].includes(path)
  ) {
    return true;
  }
  return ['/invite/', '/channels/', '/waves/'].some(
    (prefix) => path.startsWith(prefix) && path.length > prefix.length,
  );
}

export function isTrustedContentUrl(input: string, home: URL): boolean {
  try {
    const url = new URL(input);
    return sameOrigin(url, home) && isAllowedContentPath(url.pathname);
  } catch {
    return false;
  }
}

export function classifyNavigation(input: string, home: URL): NavigationDecision {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { kind: 'blocked' };
  }
  if (sameOrigin(url, home)) {
    return isAllowedContentPath(url.pathname) ? { kind: 'internal', url } : { kind: 'blocked' };
  }
  if ((url.protocol === 'https:' || url.protocol === 'mailto:') && !url.username && !url.password) {
    return { kind: 'external', url };
  }
  return { kind: 'blocked' };
}

export function classifyNewWindow(input: string, _home: URL): NavigationDecision {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { kind: 'blocked' };
  }
  if ((url.protocol === 'https:' || url.protocol === 'mailto:') && !url.username && !url.password) {
    return { kind: 'external', url };
  }
  return { kind: 'blocked' };
}

export function parseDeepLink(input: string): URL | null {
  if (
    input.length > MAX_DEEP_LINK_LENGTH ||
    input.includes('%') ||
    input.includes('\\') ||
    input.includes('/./') ||
    input.includes('/../') ||
    input.endsWith('/.') ||
    input.endsWith('/..') ||
    [...input].some((character) => /\s|\p{Cc}/u.test(character))
  ) {
    return null;
  }

  let link: URL;
  try {
    link = new URL(input);
  } catch {
    return null;
  }
  if (
    link.protocol !== 'wapve:' ||
    link.username ||
    link.password ||
    link.port ||
    link.search ||
    link.hash
  ) {
    return null;
  }

  const segments = strictSegments(link.pathname);
  if (!segments) return null;
  let destination: string | null = null;
  if (link.hostname === 'open' && segments.length === 0) {
    destination = '/app';
  } else if (
    link.hostname === 'invite' &&
    segments.length === 1 &&
    isBase64Url(segments[0] ?? '', 6, 64)
  ) {
    destination = `/invite/${segments[0]}`;
  } else if (
    link.hostname === 'channels' &&
    (segments.length === 1 || segments.length === 2) &&
    isDigits(segments[0] ?? '', 15) &&
    (segments.length === 1 || isDigits(segments[1] ?? '', 18))
  ) {
    destination = `/channels/${segments.join('/')}`;
  } else if (link.hostname === 'waves' && segments.length === 1 && isWaveId(segments[0] ?? '')) {
    destination = `/waves/${segments[0]}`;
  }

  return destination ? new URL(destination, 'https://wapve.com') : null;
}

export function desktopBootstrapUrl(home: URL, destination: URL | null): URL {
  const bootstrap = new URL(home);
  bootstrap.search = '';
  bootstrap.hash = '';
  if (destination) bootstrap.searchParams.set('next', destination.pathname);
  return bootstrap;
}

export function mapToContentOrigin(home: URL, destination: URL): URL {
  const mapped = new URL(home);
  mapped.pathname = destination.pathname;
  mapped.search = destination.search;
  mapped.hash = '';
  return mapped;
}

export function findDeepLink(argumentsList: readonly string[]): URL | null {
  for (const argument of argumentsList) {
    const link = parseDeepLink(argument);
    if (link) return link;
  }
  return null;
}

export function isCaptureSourceId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 5 &&
    value.length <= 256 &&
    /^(?:window|screen):[-0-9]+:[0-9]+$/u.test(value)
  );
}

function effectivePort(url: URL): string {
  if (url.port) return url.port;
  return url.protocol === 'https:' ? '443' : url.protocol === 'http:' ? '80' : '';
}

function strictSegments(pathname: string): string[] | null {
  if (!pathname || pathname === '/') return [];
  if (!pathname.startsWith('/') || pathname.endsWith('/') || pathname.includes('//')) return null;
  const segments = pathname.slice(1).split('/');
  return segments.some((segment) => !segment || segment === '.' || segment === '..')
    ? null
    : segments;
}

function isBase64Url(value: string, minimum: number, maximum: number): boolean {
  return value.length >= minimum && value.length <= maximum && /^[A-Za-z0-9_-]+$/u.test(value);
}

function isDigits(value: string, exactLength: number): boolean {
  return value.length === exactLength && /^[0-9]+$/u.test(value);
}

function isWaveId(value: string): boolean {
  return isUuid(value) || (value.startsWith('group:') && isUuid(value.slice(6)));
}

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/u.test(
    value,
  );
}

export function isServerErrorStatusCode(statusCode: number): boolean {
  return statusCode >= 500 && statusCode <= 599;
}

export function isCloudflareOrServerErrorTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  return (
    lower.includes('521') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504') ||
    lower.includes('520') ||
    lower.includes('522') ||
    lower.includes('523') ||
    lower.includes('524') ||
    lower.includes('525') ||
    lower.includes('web server is down') ||
    lower.includes('error code') ||
    lower.includes('cloudflare') ||
    lower.includes('bad gateway') ||
    lower.includes('service unavailable') ||
    lower.includes('gateway timeout') ||
    lower.includes('origin is unreachable')
  );
}
