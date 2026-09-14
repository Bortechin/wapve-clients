const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const MESSAGE_HASH = new RegExp(`^#message-(${UUID})$`, 'iu');

export type MobileMessageLinkTarget =
  | { kind: 'channel'; serverId: string; channelId: string; messageId: string; url: string }
  | { kind: 'direct'; conversationId: string; messageId: string; url: string }
  | { kind: 'group'; conversationId: string; messageId: string; url: string };

export function firstHttpUrl(content: string) {
  const value = content.match(/https?:\/\/[^\s<>]+/iu)?.[0];
  return value?.replace(/[),.;!?]+$/u, '') ?? null;
}

export function parseMobileMessageLink(value: string | null): MobileMessageLinkTarget | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    !['wapve.com', 'www.wapve.com'].includes(url.hostname.toLowerCase()) ||
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search
  ) {
    return null;
  }
  const messageId = url.hash.match(MESSAGE_HASH)?.[1];
  if (!messageId) return null;
  const channel = url.pathname.match(/^\/channels\/([^/]+)\/([^/]+)\/?$/u);
  if (channel) {
    try {
      return {
        kind: 'channel',
        serverId: decodeURIComponent(channel[1]!),
        channelId: decodeURIComponent(channel[2]!),
        messageId,
        url: value,
      };
    } catch {
      return null;
    }
  }
  const wave = url.pathname.match(/^\/waves\/([^/]+)\/?$/u);
  if (!wave) return null;
  try {
    const raw = decodeURIComponent(wave[1]!);
    if (raw.startsWith('group:')) {
      return {
        kind: 'group',
        conversationId: raw.slice('group:'.length),
        messageId,
        url: value,
      };
    }
    return { kind: 'direct', conversationId: raw, messageId, url: value };
  } catch {
    return null;
  }
}
