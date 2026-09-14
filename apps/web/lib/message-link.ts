const UUID_SOURCE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UUID_PATTERN = new RegExp(`^${UUID_SOURCE}$`, 'iu');
const MESSAGE_HASH_PATTERN = new RegExp(`^#message-(${UUID_SOURCE})$`, 'iu');

export const MESSAGE_LINK_NAVIGATION_EVENT = 'wapve:message-link-navigation';

export type MessageLinkTarget = {
  href: string;
  messageId: string;
  pathname: string;
};

export function messageIdFromHash(hash: string): string | null {
  return hash.match(MESSAGE_HASH_PATTERN)?.[1] ?? null;
}

export function parseInternalMessageLink(
  value: string | null,
  currentOrigin: string,
): MessageLinkTarget | null {
  if (!value) return null;

  let url: URL;
  let localOrigin: string;
  try {
    url = new URL(value);
    localOrigin = new URL(currentOrigin).origin;
  } catch {
    return null;
  }

  const trustedProductionOrigin = ['https://wapve.com', 'https://www.wapve.com'].includes(
    url.origin.toLowerCase(),
  );
  if (
    (url.origin !== localOrigin && !trustedProductionOrigin) ||
    url.username ||
    url.password ||
    url.search
  ) {
    return null;
  }

  const messageId = messageIdFromHash(url.hash);
  if (!messageId) return null;

  const channelRoute = url.pathname.match(/^\/channels\/([^/]+)\/([^/]+)\/?$/u);
  if (channelRoute) {
    let serverId: string;
    let channelId: string;
    try {
      serverId = decodeURIComponent(channelRoute[1]!);
      channelId = decodeURIComponent(channelRoute[2]!);
    } catch {
      return null;
    }
    if (
      (!UUID_PATTERN.test(serverId) && !/^\d{15}$/u.test(serverId)) ||
      (!UUID_PATTERN.test(channelId) && !/^18\d{16}$/u.test(channelId))
    ) {
      return null;
    }
  } else {
    const waveRoute = url.pathname.match(/^\/waves\/([^/]+)\/?$/u);
    if (!waveRoute) return null;
    let conversationId: string;
    try {
      conversationId = decodeURIComponent(waveRoute[1]!);
    } catch {
      return null;
    }
    const rawConversationId = conversationId.startsWith('group:')
      ? conversationId.slice('group:'.length)
      : conversationId;
    if (!UUID_PATTERN.test(rawConversationId)) return null;
  }

  return {
    href: `${url.pathname}${url.hash}`,
    messageId,
    pathname: url.pathname,
  };
}

export function isSameMessageRoute(left: string, right: string): boolean {
  const normalize = (path: string) => {
    let decoded = path;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      // Keep malformed input unequal to valid decoded routes.
    }
    return decoded.replace(/\/+$/u, '') || '/';
  };
  return normalize(left) === normalize(right);
}

function replaceStateWithoutRouterNotification(url: string): void {
  // Intentionally call the browser prototype directly so Next.js' instance wrapper cannot reroute.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const nativeReplaceState = window.History?.prototype.replaceState;
  if (nativeReplaceState) {
    nativeReplaceState.call(window.history, window.history.state, '', url);
    return;
  }
  window.history.replaceState(window.history.state, '', url);
}

export function consumeMessageHash(messageId: string): void {
  if (typeof window === 'undefined' || messageIdFromHash(window.location.hash) !== messageId)
    return;
  replaceStateWithoutRouterNotification(`${window.location.pathname}${window.location.search}`);
}

export async function copyTextPreservingScroll(
  text: string,
  scrollContainer: HTMLElement | null,
): Promise<void> {
  const scrollTop = scrollContainer?.scrollTop;
  const scrollLeft = scrollContainer?.scrollLeft;
  const previousOverflowAnchor = scrollContainer?.style.overflowAnchor;
  if (scrollContainer) scrollContainer.style.overflowAnchor = 'none';

  const restore = () => {
    if (!scrollContainer || scrollTop === undefined || scrollLeft === undefined) return;
    scrollContainer.scrollTop = scrollTop;
    scrollContainer.scrollLeft = scrollLeft;
  };

  try {
    await navigator.clipboard.writeText(text);
  } finally {
    restore();
    window.requestAnimationFrame(() => {
      restore();
      window.requestAnimationFrame(() => {
        restore();
      });
    });
    for (const delay of [40, 100, 180]) window.setTimeout(restore, delay);
    window.setTimeout(() => {
      restore();
      if (scrollContainer) scrollContainer.style.overflowAnchor = previousOverflowAnchor ?? '';
    }, 220);
  }
}
