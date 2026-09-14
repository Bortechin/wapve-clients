'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  LinkPreview,
  InternalMessagePreview,
  ServerChannel,
  ServerInvitePreview,
  ServerMember,
  ServerRole,
  ServerEmoji,
  SocialUser,
} from '@wapve/contracts';
import { Hash, Headphones, Link2, MessageCircle, Volume2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { Fragment, useState } from 'react';
import { apiRequest } from '@/lib/api';
import {
  isSameMessageRoute,
  MESSAGE_LINK_NAVIGATION_EVENT,
  parseInternalMessageLink,
  type MessageLinkTarget,
} from '@/lib/message-link';
import { ExternalLinkDialog } from './external-link-dialog';

const INLINE_CODE_REGEX = /`([^`]+)`/g;
const BOLD_REGEX = /\*\*([^*]+)\*\*/g;
const UNDERLINE_REGEX = /__([^_]+)__/g;
const ITALIC_REGEX = /\*([^*]+)\*|_([^_]+)_/g;
const STRIKE_REGEX = /~~([^~]+)~~/g;
const SPOILER_REGEX = /\|\|([^|]+)\|\|/g;
const WAPVE_SHORT_INVITE_HOSTS = new Set(['wapve.cc', 'www.wapve.cc']);
const WAPVE_PRIMARY_HOSTS = new Set(['wapve.com', 'www.wapve.com']);
const WAPVE_INVITE_CODE_PATTERN = /^[A-Za-z0-9_+-]{4,64}$/u;

function inviteCodeFromUrl(parsed: URL, currentOrigin?: string): string | null {
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    parsed.search ||
    parsed.hash
  )
    return null;
  const host = parsed.hostname.toLowerCase();
  if (WAPVE_SHORT_INVITE_HOSTS.has(host)) {
    const match = parsed.pathname.match(/^\/([A-Za-z0-9_+-]{4,64})\/?$/u);
    return match && WAPVE_INVITE_CODE_PATTERN.test(match[1] ?? '') ? (match[1] ?? null) : null;
  }
  if (!WAPVE_PRIMARY_HOSTS.has(host) && parsed.origin !== currentOrigin) return null;
  const match = parsed.pathname.match(/^\/invite\/([A-Za-z0-9_+-]{4,64})\/?$/u);
  return match && WAPVE_INVITE_CODE_PATTERN.test(match[1] ?? '') ? (match[1] ?? null) : null;
}

type MentionLookup = {
  members: Array<ServerMember | SocialUser>;
  roles: ServerRole[];
  channels: ServerChannel[];
  customEmojis: ServerEmoji[];
};

type MentionActions = {
  onOpenMember: ((member: ServerMember | SocialUser, anchor: HTMLElement) => void) | undefined;
  onOpenChannel: ((channel: ServerChannel) => void) | undefined;
};

function parseInline(
  text: string,
  onLinkClick: (url: string) => void,
  mentionNames: string[],
  lookup: MentionLookup,
  actions: MentionActions,
): React.ReactNode {
  const tokens: React.ReactNode[] = [];
  let lastIndex = 0;

  const rolePattern = mentionNames
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
    .join('|');
  const combinedRegex = new RegExp(
    `(https?:\\/\\/[^\\s]+)|(<@[^>\\s]+>|<#[^>\\s]+>)|(@(?:weryone|everyone|wave${rolePattern ? `|${rolePattern}` : ''}|[a-z0-9._]+))`,
    'giu',
  );

  let match;
  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(formatText(text.substring(lastIndex, match.index), lookup.customEmojis));
    }

    if (match[1]) {
      const url = match[1];
      tokens.push(
        <a
          key={match.index}
          href={url}
          onClick={(e) => {
            e.preventDefault();
            onLinkClick(url);
          }}
          className="message-link"
        >
          {url}
        </a>,
      );
    } else if (match[2]) {
      const token = match[2];
      const id = token.slice(2, -1);
      if (token.startsWith('<#')) {
        const channel = lookup.channels.find(
          (candidate) => candidate.id === id || candidate.publicId === id,
        );
        const channelLabel = (
          <>
            {channel?.type === 'VOICE' ? <Headphones size={13} aria-hidden="true" /> : '#'}
            <span>{channel?.name ?? id}</span>
          </>
        );
        tokens.push(
          channel && actions.onOpenChannel ? (
            <button
              type="button"
              key={match.index}
              className="structured-mention structured-channel-mention structured-mention-button"
              onClick={() => actions.onOpenChannel?.(channel)}
            >
              {channelLabel}
            </button>
          ) : (
            <span key={match.index} className="structured-mention structured-channel-mention">
              {channelLabel}
            </span>
          ),
        );
      } else {
        const member = lookup.members.find(
          (candidate) => candidate.id === id || candidate.publicId === id,
        );
        const role = lookup.roles.find((candidate) => candidate.id === id);
        const label = `@${member?.displayName ?? role?.name.replace(/^@/u, '') ?? id}`;
        tokens.push(
          member && actions.onOpenMember ? (
            <button
              type="button"
              key={match.index}
              className="structured-mention structured-mention-button"
              onClick={(event) => actions.onOpenMember?.(member, event.currentTarget)}
            >
              {label}
            </button>
          ) : (
            <span
              key={match.index}
              className="structured-mention"
              style={role ? ({ '--mention-color': role.color } as React.CSSProperties) : undefined}
            >
              {label}
            </span>
          ),
        );
      }
    } else if (match[3]) {
      const username = match[3].slice(1).toLocaleLowerCase();
      const member = lookup.members.find(
        (candidate) => candidate.username.toLocaleLowerCase() === username,
      );
      tokens.push(
        member && actions.onOpenMember ? (
          <button
            type="button"
            key={match.index}
            className="structured-mention structured-mention-button"
            onClick={(event) => actions.onOpenMember?.(member, event.currentTarget)}
          >
            {match[3]}
          </button>
        ) : (
          <span key={match.index} className="structured-mention">
            {match[3]}
          </span>
        ),
      );
    }
    lastIndex = combinedRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(formatText(text.substring(lastIndex), lookup.customEmojis));
  }

  return (
    <>
      {tokens.map((t, i) => (
        <Fragment key={i}>{t}</Fragment>
      ))}
    </>
  );
}

function formatText(text: string, customEmojis: ServerEmoji[] = []): React.ReactNode {
  let parts: React.ReactNode[] = [text];

  const applyRegex = (
    regex: RegExp,
    render: (content: React.ReactNode, i: number) => React.ReactNode,
  ) => {
    parts = parts.flatMap((part) => {
      if (typeof part !== 'string') return [part];
      const result: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;
      const r = new RegExp(regex);
      while ((match = r.exec(part)) !== null) {
        if (match.index > lastIndex) result.push(part.substring(lastIndex, match.index));
        result.push(render(match[1] || match[2], match.index));
        lastIndex = r.lastIndex;
      }
      if (lastIndex < part.length) result.push(part.substring(lastIndex));
      return result;
    });
  };

  applyRegex(INLINE_CODE_REGEX, (content, i) => (
    <code
      key={`code-${i}`}
      className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-sm text-slate-200"
    >
      {content}
    </code>
  ));
  applyRegex(SPOILER_REGEX, (content, i) => <Spoiler key={`spoiler-${i}`}>{content}</Spoiler>);
  applyRegex(BOLD_REGEX, (content, i) => (
    <strong key={`bold-${i}`} className="font-bold">
      {content}
    </strong>
  ));
  applyRegex(UNDERLINE_REGEX, (content, i) => <u key={`u-${i}`}>{content}</u>);
  applyRegex(STRIKE_REGEX, (content, i) => <s key={`s-${i}`}>{content}</s>);
  applyRegex(ITALIC_REGEX, (content, i) => (
    <em key={`em-${i}`} className="italic">
      {content}
    </em>
  ));

  const customEmojiRegex = /<:([A-Za-z0-9_]{2,32}):([0-9a-f-]{36})>/gu;
  parts = parts.flatMap((part) => {
    if (typeof part !== 'string') return [part];
    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = customEmojiRegex.exec(part)) !== null) {
      if (match.index > lastIndex) result.push(part.substring(lastIndex, match.index));
      const emoji = customEmojis.find(
        (candidate) => candidate.id === match?.[2] && candidate.name === match?.[1],
      );
      result.push(
        emoji ? (
          <img
            key={`custom-emoji-${match.index}`}
            className="message-custom-emoji"
            src={emoji.url}
            alt={`:${emoji.name}:`}
            title={`:${emoji.name}:`}
          />
        ) : (
          `:${match[1]}:`
        ),
      );
      lastIndex = customEmojiRegex.lastIndex;
    }
    if (lastIndex < part.length) result.push(part.substring(lastIndex));
    customEmojiRegex.lastIndex = 0;
    return result;
  });

  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </>
  );
}

function Spoiler({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        setRevealed((current) => !current);
      }}
      className={`wapve-frosted-spoiler ${revealed ? 'revealed-state' : 'hidden-state'}`}
    >
      {children}
    </span>
  );
}

export function MarkdownRenderer({
  content,
  mentionNames = [],
  members = [],
  roles = [],
  channels = [],
  customEmojis = [],
  onOpenMember,
  onOpenChannel,
  showLinkPreview = true,
  locale = 'tr',
}: {
  content: string;
  mentionNames?: string[];
  members?: Array<ServerMember | SocialUser>;
  roles?: ServerRole[];
  channels?: ServerChannel[];
  customEmojis?: ServerEmoji[];
  onOpenMember?: (member: ServerMember | SocialUser, anchor: HTMLElement) => void;
  onOpenChannel?: (channel: ServerChannel) => void;
  showLinkPreview?: boolean;
  locale?: 'tr' | 'en';
}) {
  const router = useRouter();
  const [externalUrl, setExternalUrl] = useState<string | null>(null);
  const lookup = { members, roles, channels, customEmojis };
  const mentionActions = { onOpenMember, onOpenChannel };
  const soleUrl = firstHttpUrl(content);
  const soleMessageLink = parseInternalMessageLink(
    soleUrl,
    typeof window === 'undefined' ? 'https://wapve.com' : window.location.origin,
  );
  const renderedContent = soleMessageLink && content.trim() === soleUrl ? '' : content;
  const onlyCustomEmojis =
    /<:[A-Za-z0-9_]{2,32}:[0-9a-f-]{36}>/u.test(renderedContent) &&
    renderedContent.replace(/<:[A-Za-z0-9_]{2,32}:[0-9a-f-]{36}>/gu, '').trim().length === 0;

  const handleLinkClick = (url: string) => {
    try {
      const parsed = new URL(url);
      const messageLink = parseInternalMessageLink(url, window.location.origin);
      if (messageLink) {
        if (isSameMessageRoute(messageLink.pathname, window.location.pathname)) {
          window.dispatchEvent(
            new CustomEvent<MessageLinkTarget>(MESSAGE_LINK_NAVIGATION_EVENT, {
              detail: messageLink,
            }),
          );
        } else {
          router.push(messageLink.href, { scroll: false });
        }
        return;
      }
      const inviteCode = inviteCodeFromUrl(parsed, window.location.origin);
      if (inviteCode) {
        window.dispatchEvent(
          new CustomEvent('wapve:open-invite', {
            detail: { code: inviteCode },
          }),
        );
        return;
      }
      if (parsed.origin === window.location.origin) {
        router.push(`${parsed.pathname}${parsed.search}${parsed.hash}`, { scroll: false });
      } else {
        setExternalUrl(url);
      }
    } catch {
      setExternalUrl(url);
    }
  };

  const codeBlockRe = /```([\s\S]*?)```/g;
  const blocks: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRe.exec(renderedContent)) !== null) {
    if (match.index > lastIndex) {
      blocks.push(
        parseBlock(
          renderedContent.substring(lastIndex, match.index),
          handleLinkClick,
          mentionNames,
          lookup,
          mentionActions,
        ),
      );
    }
    blocks.push(
      <pre
        key={`pre-${match.index}`}
        className="my-2 overflow-x-auto rounded-md bg-[#0F141B] p-3 font-mono text-sm text-slate-300 shadow-inner"
      >
        <code>{match[1]}</code>
      </pre>,
    );
    lastIndex = codeBlockRe.lastIndex;
  }

  if (lastIndex < renderedContent.length) {
    blocks.push(
      parseBlock(
        renderedContent.substring(lastIndex),
        handleLinkClick,
        mentionNames,
        lookup,
        mentionActions,
      ),
    );
  }

  return (
    <>
      <div
        className={`whitespace-pre-wrap break-words${onlyCustomEmojis ? ' custom-emoji-only' : ''}`}
      >
        {blocks.map((b, i) => (
          <Fragment key={i}>{b}</Fragment>
        ))}
      </div>
      {showLinkPreview && (
        <LinkPreviewCard content={content} locale={locale} onOpen={handleLinkClick} />
      )}
      <ExternalLinkDialog
        url={externalUrl}
        open={!!externalUrl}
        onOpenChange={(open) => !open && setExternalUrl(null)}
      />
    </>
  );
}

function firstHttpUrl(content: string): string | null {
  const match = content.match(/https?:\/\/[^\s<>]+/iu)?.[0];
  return match?.replace(/[),.;!?]+$/u, '') ?? null;
}

function LinkPreviewCard({
  content,
  locale,
  onOpen,
}: {
  content: string;
  locale: 'tr' | 'en';
  onOpen: (url: string) => void;
}) {
  const url = firstHttpUrl(content);
  let parsed: URL | null = null;
  try {
    parsed = url ? new URL(url) : null;
  } catch {
    parsed = null;
  }
  const inviteCode = parsed
    ? inviteCodeFromUrl(
        parsed,
        typeof window === 'undefined' ? 'https://wapve.com' : window.location.origin,
      )
    : null;
  const messageUrl = parseInternalMessageLink(
    url,
    typeof window === 'undefined' ? 'https://wapve.com' : window.location.origin,
  );
  const internal = useQuery({
    queryKey: ['message-link-preview', url],
    queryFn: () =>
      apiRequest<InternalMessagePreview | null>('/links/message-preview', {
        method: 'POST',
        body: JSON.stringify({ url }),
      }),
    enabled: Boolean(messageUrl),
    staleTime: 60_000,
    retry: false,
  });
  const external = useQuery({
    queryKey: ['link-preview', url],
    queryFn: () =>
      apiRequest<LinkPreview | null>('/links/preview', {
        method: 'POST',
        body: JSON.stringify({ url }),
      }),
    enabled: Boolean(url && !inviteCode && !messageUrl),
    staleTime: 15 * 60_000,
    retry: false,
  });
  const invite = useQuery({
    queryKey: ['invite-preview', inviteCode],
    queryFn: () =>
      apiRequest<ServerInvitePreview | null>('/servers/invites/preview', {
        method: 'POST',
        body: JSON.stringify({ code: inviteCode }),
      }),
    enabled: Boolean(inviteCode),
    staleTime: 60_000,
    retry: false,
  });
  if (!url) return null;
  if (internal.data) {
    return (
      <button className="message-link-preview internal-message-preview" onClick={() => onOpen(url)}>
        <span className="internal-message-preview-row">
          <span className="internal-message-preview-avatar">
            {internal.data.author.avatarUrl ? (
              <img src={internal.data.author.avatarUrl} alt="" />
            ) : (
              internal.data.author.displayName.slice(0, 1).toUpperCase()
            )}
          </span>
          <strong>{internal.data.author.displayName}</strong>
          <MessageCircle size={15} aria-hidden="true" />
        </span>
        <span className="internal-message-preview-row context">
          <span className="internal-message-preview-avatar">
            {internal.data.context.iconUrl ? (
              <img src={internal.data.context.iconUrl} alt="" />
            ) : (
              internal.data.context.name.slice(0, 1).toUpperCase()
            )}
          </span>
          <strong>{internal.data.context.name}</strong>
          <MessageCircle size={15} aria-hidden="true" />
        </span>
        {internal.data.excerpt && <small>{internal.data.excerpt}</small>}
      </button>
    );
  }
  if (messageUrl && internal.isPending) {
    return <span className="internal-message-preview-loading" aria-hidden="true" />;
  }
  if (messageUrl) {
    return (
      <button
        className="message-link-preview internal-message-preview unavailable"
        onClick={() => onOpen(url)}
      >
        <span className="internal-message-preview-row">
          <MessageCircle size={16} aria-hidden="true" />
          <strong>{locale === 'tr' ? 'Mesaj bağlantısı' : 'Message link'}</strong>
        </span>
      </button>
    );
  }
  if (invite.data) {
    const Icon = invite.data.channel?.type === 'VOICE' ? Volume2 : Hash;
    const numberFormat = new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US');
    const onlineLabel = `${numberFormat.format(invite.data.server.onlineCount)} ${locale === 'tr' ? 'Çevrim içi' : 'Online'}`;
    const memberLabel = `${numberFormat.format(invite.data.server.memberCount)} ${locale === 'tr' ? 'Üye' : 'Members'}`;
    const createdLabel = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
      month: 'short',
      year: 'numeric',
    }).format(new Date(invite.data.server.createdAt));
    return (
      <button className="message-link-preview message-invite-preview" onClick={() => onOpen(url)}>
        <span className="message-invite-banner">
          {invite.data.server.bannerUrl && <img src={invite.data.server.bannerUrl} alt="" />}
        </span>
        <span className="message-invite-body">
          <span className="message-invite-heading">
            <span className="message-invite-icon">
              {invite.data.server.iconUrl ? (
                <img src={invite.data.server.iconUrl} alt="" />
              ) : (
                invite.data.server.name.slice(0, 2).toUpperCase()
              )}
            </span>
            <span>
              <strong>{invite.data.server.name}</strong>
            </span>
          </span>
          <span className="message-invite-meta">
            <i /> {onlineLabel} <b>·</b> <i className="total" /> {memberLabel}
          </span>
          <span className="message-invite-created">
            {locale === 'tr' ? 'Kuruluş' : 'Created'}: {createdLabel}
          </span>
          {invite.data.server.description && (
            <small className="message-invite-description">{invite.data.server.description}</small>
          )}
          {invite.data.channel && (
            <span className="message-invite-channel">
              <Icon size={15} /> {invite.data.channel.name}
            </span>
          )}
          <span className="message-invite-action">
            {locale === 'tr'
              ? invite.data.alreadyMember
                ? 'Sunucuya git'
                : 'Sunucuya katıl'
              : invite.data.alreadyMember
                ? 'Open server'
                : 'Join server'}
          </span>
        </span>
      </button>
    );
  }
  if (!external.data) return null;
  return (
    <button className="message-link-preview" onClick={() => onOpen(url)}>
      <span className="message-preview-site">
        <Link2 size={13} /> {external.data.siteName}
      </span>
      <strong>{external.data.title}</strong>
      {external.data.description && <small>{external.data.description}</small>}
    </button>
  );
}

function parseBlock(
  text: string,
  onLinkClick: (url: string) => void,
  mentionNames: string[],
  lookup: MentionLookup,
  actions: MentionActions,
): React.ReactNode {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let currentQuote: string[] = [];
  let currentList: string[] = [];

  const flushQuote = () => {
    if (currentQuote.length > 0) {
      result.push(
        <blockquote
          key={`quote-${result.length}`}
          className="my-1 border-l-4 border-slate-600 pl-3 italic text-slate-400"
        >
          {parseInline(currentQuote.join('\n'), onLinkClick, mentionNames, lookup, actions)}
        </blockquote>,
      );
      currentQuote = [];
    }
  };

  const flushList = () => {
    if (currentList.length > 0) {
      result.push(
        <ul key={`list-${result.length}`} className="message-markdown-list">
          {currentList.map((item, index) => (
            <li key={index}>{parseInline(item, onLinkClick, mentionNames, lookup, actions)}</li>
          ))}
        </ul>,
      );
      currentList = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';
    if (line.trim().startsWith('> ')) {
      flushList();
      currentQuote.push(line.replace(/^>\s/, ''));
    } else if (line.trim().startsWith('- ')) {
      flushQuote();
      currentList.push(line.replace(/^\s*-\s/u, ''));
    } else {
      flushQuote();
      flushList();
      if (line || i < lines.length - 1) {
        result.push(
          <Fragment key={`line-${i}`}>
            {parseInline(line, onLinkClick, mentionNames, lookup, actions)}
            {i < lines.length - 1 && '\n'}
          </Fragment>,
        );
      }
    }
  }
  flushQuote();
  flushList();

  return <>{result}</>;
}
