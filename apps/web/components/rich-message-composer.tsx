'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  GifSearchResult,
  Locale,
  ServerChannel,
  ServerMember,
  ServerPermission,
  ServerRole,
  ScheduledMessage,
  ServerEmoji,
  ServerSummary,
  SocialUser,
  UserProfile,
} from '@wapve/contracts';
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import {
  BarChart3,
  CalendarClock,
  FileUp,
  Hash,
  Headphones,
  LockKeyhole,
  LoaderCircle,
  Mic,
  Plus,
  Search,
  Smile,
  Square,
  X,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { availableCommands, commandUsage, parseServerCommand } from '@/lib/server-commands';
import { apiRequest } from '@/lib/api';
import type { UploadQueueItem } from '@/lib/upload-queue';
import {
  buildComposerMentionAliases,
  canonicalizeComposerMentions,
  displayComposerMentions,
  displayOffsetFromRaw,
  rawOffsetFromDisplay,
  type ComposerMentionAlias,
} from '@/lib/composer-mentions';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';
import { turkishEmojiData } from '@/lib/turkish-emoji-data';
import { canonicalizeCustomEmojiAliases } from '@/lib/custom-emoji-aliases';
import { MarkdownRenderer } from './markdown-renderer';

const MEMBER_MESSAGE_LIMIT = 2_500;
const VOICE_MESSAGE_LIMIT_SECONDS = 300;

type MentionOption = {
  kind: 'member' | 'role' | 'broadcast' | 'channel';
  id: string;
  token: string;
  label: string;
  detail: string;
  avatarUrl?: string | null;
  color?: string;
  channelType?: ServerChannel['type'];
};

type ComposerMentionMember = ServerMember | SocialUser | UserProfile;

const MARKDOWN_DETECT = /\*\*|__|~~|\|\||```|`[^`]+`/;
function hasMarkdown(text: string): boolean {
  return MARKDOWN_DETECT.test(text);
}

export function RichMessageComposer({
  value,
  onChange,
  onSubmit,
  onGif,
  onPoll,
  onSchedule,
  members = [],
  roles = [],
  channels = [],
  canMentionEveryone = false,
  uploadItems,
  onFiles,
  onRemoveFile,
  onClearFiles,
  onVoiceMessage,
  onError,
  disabled,
  busy,
  placeholder,
  ariaLabel,
  locale,
  messages,
  unlimitedText = false,
  statusText,
  customEmojis = [],
  serverId,
  commandPermissions,
  canUseExternalEmojis = true,
  premiumActive = false,
  onPremiumRequired = () => undefined,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => Promise<void> | void;
  onGif: (gif: GifSearchResult) => Promise<void>;
  onPoll?: () => void;
  onSchedule?: (scheduledFor: string) => Promise<void>;
  members?: ComposerMentionMember[];
  roles?: ServerRole[];
  channels?: ServerChannel[];
  canMentionEveryone?: boolean;
  uploadItems: UploadQueueItem[];
  onFiles: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
  onClearFiles: () => void;
  onVoiceMessage: (file: File) => Promise<void>;
  onError: (message: string) => void;
  disabled: boolean;
  busy: boolean;
  placeholder: string;
  ariaLabel?: string;
  locale: Locale;
  messages: Dictionary;
  unlimitedText?: boolean;
  statusText?: string | undefined;
  customEmojis?: ServerEmoji[];
  serverId?: string;
  commandPermissions?: ServerPermission[];
  canUseExternalEmojis?: boolean;
  premiumActive?: boolean;
  onPremiumRequired?: () => void;
}) {
  const queryClient = useQueryClient();
  const [commandIndex, setCommandIndex] = useState(0);
  const [commandsHidden, setCommandsHidden] = useState(false);
  const [commandNotice, setCommandNotice] = useState('');
  const commandBusy = useRef(false);
  const isCommand = Boolean(serverId && commandPermissions && value.startsWith('/'));
  const permittedCommands = availableCommands(commandPermissions ?? []);
  const commandOptions = permittedCommands.filter(command => command.name.startsWith(value.slice(1).split(/\s/u)[0]?.toLowerCase() ?? ''));
  const commandPickerOpen = isCommand && !commandsHidden && !/\s/u.test(value) && commandOptions.length > 0;
  const completeCommand = (name: string) => { onChange(`/${name} `); setCommandsHidden(false); textareaRef.current?.focus(); };
  async function runCommand() {
    if (commandBusy.current || !serverId || !commandPermissions) return;
    commandBusy.current = true;
    setCommandNotice('');
    const submitted = value;
    try {
      if (uploadItems.length) throw new Error(locale === 'tr' ? 'Komut göndermeden önce ekleri kaldır.' : 'Remove attachments before running a command.');
      const command = parseServerCommand(submitted, commandPermissions, members, locale);
      if (command.kind === 'help') {
        setCommandNotice(permittedCommands.map(item => commandUsage(item.usage, locale)).join(' · '));
      } else {
        await apiRequest(`/servers/${serverId}/${command.path}`, { method: command.method, body: JSON.stringify(command.body) });
        setCommandNotice(locale === 'tr' ? `/${command.name} tamamlandı.` : `/${command.name} completed.`);
        void queryClient.invalidateQueries({ queryKey: ['server-members'] });
        void queryClient.invalidateQueries({ queryKey: ['server-audit-logs'] });
        void queryClient.invalidateQueries({ queryKey: ['server-bans'] });
      }
      // Preserve text entered while the request was in flight.
      if (draftValueRef.current === submitted) onChange('');
    } catch (error) { onError(error instanceof Error && !(error as { status?: number }).status ? error.message : errorMessage(error, messages)); }
    finally { commandBusy.current = false; }
  }
  const draftValueRef = useRef(value);
  draftValueRef.current = value;
  const [uploadOpen, setUploadOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [tab, setTab] = useState<'gif' | 'emoji'>('gif');
  const [gifDraft, setGifDraft] = useState('');
  const [gifSearch, setGifSearch] = useState('');
  const [mention, setMention] = useState<{
    start: number;
    end: number;
    query: string;
    trigger: '@' | '#';
  } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [tooLongOpen, setTooLongOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleAt, setScheduleAt] = useState(() => localDateTimeValue(Date.now() + 5 * 60_000));
  const [emojiServerId, setEmojiServerId] = useState<string | null>(serverId ?? null);
  const characterCountId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionOverlayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const recordingTimerRef = useRef<number | null>(null);
  const mentionAliases = useMemo(
    () => buildComposerMentionAliases(members, roles, channels),
    [channels, members, roles],
  );
  const customEmojiComposerAliases = useMemo<ComposerMentionAlias[]>(
    () =>
      customEmojis.map((emoji, index) => ({
        token: `<:${emoji.name}:${emoji.id}>`,
        label: String.fromCodePoint(0xe000 + index),
      })),
    [customEmojis],
  );
  const composerAliases = useMemo(
    () => [...mentionAliases, ...customEmojiComposerAliases],
    [customEmojiComposerAliases, mentionAliases],
  );
  const displayValue = displayComposerMentions(value, composerAliases);
  const previewValue = useMemo(
    () => canonicalizeCustomEmojiAliases(value, customEmojis),
    [customEmojis, value],
  );
  const remainingCharacters = MEMBER_MESSAGE_LIMIT - value.length;
  const gifs = useQuery({
    queryKey: ['gifs', gifSearch, locale],
    queryFn: () =>
      apiRequest<{ items: GifSearchResult[] }>(
        `/gifs/search?q=${encodeURIComponent(gifSearch)}&locale=${locale}&limit=20`,
      ),
    enabled: mediaOpen && tab === 'gif' && !disabled,
    retry: false,
  });
  const scheduledMessages = useQuery({
    queryKey: ['scheduled-messages'],
    queryFn: () => apiRequest<ScheduledMessage[]>('/message-delivery/scheduled'),
    enabled: scheduleOpen,
  });
  const emojiServers = useQuery({
    queryKey: ['emoji-picker-servers'],
    queryFn: () => apiRequest<ServerSummary[]>('/servers'),
    enabled: mediaOpen && tab === 'emoji',
    staleTime: 60_000,
  });
  const permittedEmojiServers = useMemo(() => {
    const servers = emojiServers.data ?? [];
    return servers.filter(
      (server) =>
        server.id === serverId ||
        (canUseExternalEmojis && server.permissions.includes('USE_EXTERNAL_EMOJIS')),
    );
  }, [canUseExternalEmojis, emojiServers.data, serverId]);
  const activeEmojiServerId = emojiServerId ?? serverId ?? permittedEmojiServers[0]?.id ?? null;
  const activeEmojiServer = permittedEmojiServers.find(
    (server) => server.id === activeEmojiServerId,
  );
  const activeEmojiQuery = useQuery({
    queryKey: ['composer-server-emojis', activeEmojiServerId],
    queryFn: () => apiRequest<ServerEmoji[]>(`/servers/${activeEmojiServerId}/emojis`),
    enabled: Boolean(
      mediaOpen && tab === 'emoji' && activeEmojiServerId && activeEmojiServerId !== serverId,
    ),
    staleTime: 60_000,
  });
  const activeCustomEmojis =
    activeEmojiServerId === serverId ? customEmojis : (activeEmojiQuery.data ?? []);

  useEffect(() => {
    if (serverId) setEmojiServerId(serverId);
  }, [serverId]);
  const mentionOptions: MentionOption[] = mention
    ? (mention.trigger === '#'
        ? channels.map((channel) => ({
            kind: 'channel' as const,
            id: channel.id,
            token: channel.name,
            label: channel.type === 'VOICE' ? channel.name : `#${channel.name}`,
            detail: channel.type === 'VOICE' ? messages.voiceChannel : messages.textChannel,
            channelType: channel.type,
          }))
        : [
            ...members.map((member) => ({
              kind: 'member' as const,
              id: member.id,
              token: member.username,
              label: member.displayName,
              detail: `@${member.username}`,
              avatarUrl: member.avatarUrl,
            })),
            ...roles
              .filter((role) => !role.isEveryone && (role.mentionable || canMentionEveryone))
              .sort((left, right) => right.position - left.position)
              .map((role) => ({
                kind: 'role' as const,
                id: role.id,
                token: role.name.replace(/^@/u, ''),
                label: `@${role.name.replace(/^@/u, '')}`,
                detail: locale === 'tr' ? 'Rol etiketi' : 'Role mention',
                color: role.color,
              })),
            ...(canMentionEveryone
              ? [
                  {
                    kind: 'broadcast' as const,
                    id: 'weryone',
                    token: 'weryone',
                    label: '@weryone',
                    detail: locale === 'tr' ? 'Sunucudaki herkesi bildir' : 'Notify everyone',
                  },
                  {
                    kind: 'broadcast' as const,
                    id: 'wave',
                    token: 'wave',
                    label: '@wave',
                    detail: locale === 'tr' ? 'Çevrim içi üyeleri bildir' : 'Notify online members',
                  },
                ]
              : []),
          ]
      )
        .filter((option) => {
          if (isCommand && option.kind !== 'member') return false;
          const query = mention.query.toLocaleLowerCase();
          return (
            option.token.toLocaleLowerCase().includes(query) ||
            option.label.toLocaleLowerCase().includes(query)
          );
        })
        .slice(0, 15)
    : [];
  const mentionGroups = mention
    ? mention.trigger === '#'
      ? [{ key: 'channels', label: messages.channels, options: mentionOptions }]
      : [
          {
            key: 'members',
            label: messages.members,
            options: mentionOptions.filter(
              (option) => option.kind === 'member' || option.kind === 'broadcast',
            ),
          },
          {
            key: 'roles',
            label: messages.roles,
            options: mentionOptions.filter((option) => option.kind === 'role'),
          },
        ].filter((group) => group.options.length > 0)
    : [];

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    const height = Math.min(textarea.scrollHeight, 176);
    textarea.style.height = `${Math.max(height, 24)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 176 ? 'auto' : 'hidden';
  }, [displayValue]);

  useEffect(() => {
    function close(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setUploadOpen(false);
        setMediaOpen(false);
        setMention(null);
      }
    }
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  useEffect(
    () => () => {
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
      discardRecordingRef.current = true;
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  function finishVoiceRecording(discard: boolean) {
    discardRecordingRef.current = discard;
    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    setRecording(false);
  }

  async function startVoiceRecording() {
    if (disabled || busy || recording) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      onError(
        locale === 'tr'
          ? 'Bu tarayıcı güvenli ses kaydını desteklemiyor.'
          : 'This browser does not support secure voice recording.',
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      const preferredType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = preferredType
        ? new MediaRecorder(stream, { mimeType: preferredType })
        : new MediaRecorder(stream);
      recordingChunksRef.current = [];
      discardRecordingRef.current = false;
      recordingStreamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        discardRecordingRef.current = true;
        onError(locale === 'tr' ? 'Ses kaydı tamamlanamadı.' : 'Voice recording failed.');
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        recorderRef.current = null;
        if (discardRecordingRef.current) return;
        const type = recorder.mimeType || preferredType || 'audio/webm';
        const blob = new Blob(recordingChunksRef.current, { type });
        if (!blob.size) {
          onError(locale === 'tr' ? 'Ses kaydı boş.' : 'Voice recording is empty.');
          return;
        }
        const extension = type.includes('mp4') ? 'm4a' : 'webm';
        void onVoiceMessage(new File([blob], `wapve-sesli-mesaj.${extension}`, { type }));
      };
      recorder.start(1_000);
      onClearFiles();
      setRecordingSeconds(0);
      setRecording(true);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((current) => {
          if (current + 1 >= VOICE_MESSAGE_LIMIT_SECONDS)
            window.setTimeout(() => finishVoiceRecording(false), 0);
          return Math.min(current + 1, VOICE_MESSAGE_LIMIT_SECONDS);
        });
      }, 1_000);
    } catch {
      onError(
        locale === 'tr'
          ? 'Mikrofon izni verilmedi veya mikrofon kullanılamıyor.'
          : 'Microphone permission was denied or the microphone is unavailable.',
      );
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((!value.trim() && uploadItems.length === 0) || disabled || busy) return;
    if (!unlimitedText && remainingCharacters < 0) {
      setTooLongOpen(true);
      return;
    }
    if (isCommand) { void runCommand(); return; }
    void onSubmit();
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    if (commandPickerOpen) {
      if (event.key === 'Escape') { event.preventDefault(); setCommandsHidden(true); return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setCommandIndex(index => (index + (event.key === 'ArrowDown' ? 1 : commandOptions.length - 1)) % commandOptions.length); return; }
      if (event.key === 'Tab') { event.preventDefault(); completeCommand((commandOptions[commandIndex] ?? commandOptions[0]!).name); return; }
    }
    if (mention && mentionOptions.length) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setMentionIndex((current) =>
          event.key === 'ArrowDown'
            ? (current + 1) % mentionOptions.length
            : (current - 1 + mentionOptions.length) % mentionOptions.length,
        );
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        insertMention(mentionOptions[mentionIndex] ?? mentionOptions[0]!);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setMention(null);
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function updateValue(next: string, cursor: number) {
    onChange(next);
    setCommandsHidden(false);
    setCommandIndex(0);
    setCommandNotice('');
    const beforeCursor = next.slice(0, cursor);
    const match = beforeCursor.match(/(?:^|\s)([@#])([^@#\n]{0,50})$/u);
    const trigger = match?.[1] as '@' | '#' | undefined;
    const hasOptions =
      trigger === '#'
        ? channels.length > 0
        : members.length > 0 || roles.length > 0 || canMentionEveryone;
    if (!match || !trigger || !hasOptions) {
      setMention(null);
      return;
    }
    const triggerOffset = match[0].lastIndexOf(trigger);
    const triggerStart = cursor - match[0].length + triggerOffset;
    if (next[triggerStart - 1] === '<') {
      setMention(null);
      return;
    }
    setMention({
      start: triggerStart,
      end: cursor,
      query: match[2] ?? '',
      trigger,
    });
    setMentionIndex(0);
  }

  function insertMention(option: MentionOption) {
    if (!mention) return;
    const inserted =
      option.kind === 'channel'
        ? `<#${option.id}> `
        : option.kind === 'broadcast'
          ? `@${option.token} `
          : `<@${option.id}> `;
    const next = `${value.slice(0, mention.start)}${inserted}${value.slice(mention.end)}`;
    const cursor = mention.start + inserted.length;
    onChange(next);
    setMention(null);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const displayCursor = displayOffsetFromRaw(next, cursor, composerAliases);
      textareaRef.current?.setSelectionRange(displayCursor, displayCursor);
    });
  }

  function chooseFiles(files: File[]) {
    if (!files.length) return;
    const valid = files.filter((file) => {
      if (file.size <= 25 * 1024 * 1024) return true;
      onError(messages.errors.attachmentTooLarge);
      return false;
    });
    onFiles(valid);
    setUploadOpen(false);
    setMediaOpen(false);
  }

  function insertEmoji(symbol: string) {
    const textarea = textareaRef.current;
    const displayStart = textarea?.selectionStart ?? displayValue.length;
    const displayEnd = textarea?.selectionEnd ?? displayValue.length;
    const start = rawOffsetFromDisplay(displayValue, displayStart, composerAliases);
    const end = rawOffsetFromDisplay(displayValue, displayEnd, composerAliases);
    onChange(`${value.slice(0, start)}${symbol}${value.slice(end)}`);
    window.requestAnimationFrame(() => {
      textarea?.focus();
      const rawCursor = start + symbol.length;
      const displayCursor = displayOffsetFromRaw(
        `${value.slice(0, start)}${symbol}${value.slice(end)}`,
        rawCursor,
        composerAliases,
      );
      textarea?.setSelectionRange(displayCursor, displayCursor);
    });
  }

  return (
    <div className="rich-composer" ref={rootRef}>
      {mediaOpen && (
        <section className="composer-media-panel" aria-label={messages.mediaPicker}>
          <div className="composer-media-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'gif'}
              className={tab === 'gif' ? 'active' : ''}
              onClick={() => setTab('gif')}
            >
              GIF
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'emoji'}
              className={tab === 'emoji' ? 'active' : ''}
              onClick={() => setTab('emoji')}
            >
              {messages.emoji}
            </button>
            <button
              className="media-close"
              type="button"
              aria-label={messages.close}
              onClick={() => setMediaOpen(false)}
            >
              <X size={17} />
            </button>
          </div>
          {tab === 'gif' ? (
            <>
              <form
                className="composer-gif-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  setGifSearch(gifDraft.trim());
                }}
              >
                <Search size={17} />
                <input
                  value={gifDraft}
                  onChange={(event) => setGifDraft(event.target.value)}
                  placeholder={messages.searchKlipy}
                  maxLength={100}
                  autoFocus
                />
              </form>
              {gifs.isPending ? (
                <div className="gif-state">
                  <LoaderCircle className="spin" /> {messages.loading}
                </div>
              ) : gifs.isError ? (
                <div className="gif-state gif-error">{errorMessage(gifs.error, messages)}</div>
              ) : (
                <div className="gif-grid">
                  {gifs.data?.items.map((gif) => (
                    <button
                      type="button"
                      key={gif.id}
                      onClick={() => {
                        void onGif(gif).then(() => setMediaOpen(false));
                      }}
                      disabled={busy}
                    >
                      <img src={gif.previewUrl} alt={gif.title} loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
              <div className="klipy-attribution">POWERED BY KLIPY</div>
            </>
          ) : (
            <div className="composer-emoji-picker">
              <div className="composer-server-emoji-picker">
                <aside className="composer-server-emoji-rail" aria-label={messages.serverEmojis}>
                  {permittedEmojiServers.map((server) => (
                    <button
                      type="button"
                      key={server.id}
                      className={server.id === activeEmojiServerId ? 'active' : ''}
                      title={server.name}
                      aria-label={server.name}
                      onClick={() => setEmojiServerId(server.id)}
                    >
                      {server.iconUrl ? (
                        <img src={server.iconUrl} alt="" />
                      ) : (
                        <span>{server.name.slice(0, 1).toUpperCase()}</span>
                      )}
                    </button>
                  ))}
                </aside>
                <section
                  className="composer-custom-emojis"
                  aria-label={activeEmojiServer?.name ?? messages.serverEmojis}
                >
                  <header>
                    <strong>{activeEmojiServer?.name ?? messages.serverEmojis}</strong>
                    <small>{activeCustomEmojis.length} / 25</small>
                  </header>
                  <div>
                    {activeCustomEmojis.map((emoji) => (
                      <button
                        type="button"
                        key={emoji.id}
                        title={`:${emoji.name}:`}
                        className={emoji.animated && !premiumActive ? 'is-premium-locked' : ''}
                        aria-label={
                          emoji.animated && !premiumActive
                            ? `${emoji.name} · Wapve+`
                            : `:${emoji.name}:`
                        }
                        onClick={() => {
                          if (emoji.animated && !premiumActive) {
                            setMediaOpen(false);
                            onPremiumRequired();
                            return;
                          }
                          insertEmoji(`<:${emoji.name}:${emoji.id}>`);
                          setMediaOpen(false);
                        }}
                      >
                        <img src={emoji.url} alt={`:${emoji.name}:`} />
                        {emoji.animated && !premiumActive && <LockKeyhole size={13} />}
                      </button>
                    ))}
                    {!activeCustomEmojis.length && (
                      <p className="composer-emoji-empty">{messages.noServerEmojis}</p>
                    )}
                  </div>
                </section>
              </div>
              <EmojiPicker
                width="100%"
                height={355}
                theme={Theme.DARK}
                emojiStyle={EmojiStyle.NATIVE}
                lazyLoadEmojis
                {...(locale === 'tr' ? { emojiData: turkishEmojiData } : {})}
                searchPlaceholder={locale === 'tr' ? 'Emoji ara' : 'Search emoji'}
                searchClearButtonLabel={locale === 'tr' ? 'Aramayı temizle' : 'Clear search'}
                previewConfig={{ showPreview: false }}
                onEmojiClick={(data) => insertEmoji(data.emoji)}
              />
            </div>
          )}
        </section>
      )}
      {uploadOpen && (
        <div className="composer-upload-menu">
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            <span>
              <FileUp size={18} />
            </span>
            <span>
              <strong>{messages.uploadFile}</strong>
              <small>{messages.uploadFileHint}</small>
            </span>
          </button>
          {onPoll && (
            <button
              type="button"
              onClick={() => {
                setUploadOpen(false);
                onPoll();
              }}
            >
              <span>
                <BarChart3 size={18} />
              </span>
              <span>
                <strong>{messages.createPoll}</strong>
                <small>{messages.createPollHint}</small>
              </span>
            </button>
          )}
          {onSchedule && (
            <button
              type="button"
              disabled={!value.trim() || uploadItems.length > 0}
              onClick={() => {
                setUploadOpen(false);
                setScheduleAt(localDateTimeValue(Date.now() + 5 * 60_000));
                setScheduleOpen(true);
              }}
            >
              <span>
                <CalendarClock size={18} />
              </span>
              <span>
                <strong>{messages.scheduleMessage}</strong>
                <small>{messages.scheduleMessageHint}</small>
              </span>
            </button>
          )}
        </div>
      )}
      {commandNotice && <div className="command-notice" role="status">{commandNotice}</div>}
      {commandPickerOpen && <div className="mention-picker command-picker" role="listbox" aria-label={locale === 'tr' ? 'Sunucu komutları' : 'Server commands'}>
        {commandOptions.map((command, index) => <button type="button" role="option" aria-selected={index === commandIndex} className={index === commandIndex ? 'active' : ''} key={command.name} onPointerDown={event => event.preventDefault()} onClick={() => completeCommand(command.name)}>
          <span><strong>{commandUsage(command.usage, locale)}</strong><small>{locale === 'tr' ? command.tr : command.en}</small></span>
        </button>)}
      </div>}
      {mention && mentionOptions.length > 0 && (
        <div className="mention-picker" role="listbox" aria-label={messages.mentionUser}>
          {mentionGroups.map((group) => (
            <section className="mention-picker-group" key={group.key}>
              <h3>{group.label}</h3>
              {group.options.map((option) => {
                const index = mentionOptions.indexOf(option);
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === mentionIndex}
                    className={index === mentionIndex ? 'active' : ''}
                    key={`${option.kind}:${option.id}`}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => insertMention(option)}
                  >
                    <span
                      className={`mention-avatar mention-avatar--${option.kind}`}
                      style={option.color ? { background: option.color } : undefined}
                    >
                      {option.avatarUrl ? (
                        <img src={option.avatarUrl} alt="" />
                      ) : option.kind === 'broadcast' ? (
                        '@'
                      ) : option.kind === 'channel' ? (
                        option.channelType === 'VOICE' ? (
                          <Headphones size={16} />
                        ) : (
                          <Hash size={16} />
                        )
                      ) : (
                        option.label.replace('@', '').slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.detail}</small>
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      )}
      {value.trim() && (hasMarkdown(value) || previewValue !== value) && (
        <div className="composer-preview">
          <span className="composer-preview-label">Ön İzleme</span>
          <div className="composer-preview-content">
            <MarkdownRenderer
              content={previewValue}
              locale={locale}
              showLinkPreview={false}
              mentionNames={roles.map((role) => role.name.replace(/^@/u, ''))}
              members={members}
              roles={roles}
              channels={channels}
              customEmojis={customEmojis}
            />
          </div>
        </div>
      )}
      {uploadItems.length > 0 && (
        <div className="attachment-upload-queue" aria-label={messages.uploadQueue}>
          <header>
            <strong>{messages.uploadQueue}</strong>
            <small>
              {messages.uploadQueueCount.replace('{count}', String(uploadItems.length))}
            </small>
          </header>
          {uploadItems.map((item) => (
            <div className={`upload-queue-item ${item.status}`} key={item.id}>
              <span className="upload-file-icon">
                <FileUp size={16} />
              </span>
              <span className="upload-file-copy">
                <strong title={item.file.name}>{item.file.name}</strong>
                <small>
                  {formatBytes(item.file.size, locale)} ·{' '}
                  {item.status === 'uploading'
                    ? messages.uploadStatusUploading
                    : item.status === 'complete'
                      ? messages.uploadStatusComplete
                      : item.status === 'error'
                        ? messages.uploadStatusError
                        : messages.uploadStatusReady}
                </small>
                <i>
                  <b style={{ width: `${item.progress}%` }} />
                </i>
              </span>
              <button
                type="button"
                aria-label={messages.removeAttachment}
                onClick={() => onRemoveFile(item.id)}
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      {recording && (
        <div className="voice-message-recording" role="status">
          <i aria-hidden="true" />
          <strong>{locale === 'tr' ? 'Ses kaydediliyor' : 'Recording voice'}</strong>
          <time>{formatRecordingTime(recordingSeconds)}</time>
          <button type="button" onClick={() => finishVoiceRecording(false)}>
            <Square size={14} /> {locale === 'tr' ? 'Bitir' : 'Stop'}
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={locale === 'tr' ? 'Kaydı iptal et' : 'Cancel recording'}
            onClick={() => finishVoiceRecording(true)}
          >
            <X size={15} />
          </button>
        </div>
      )}
      <form className="message-composer" onSubmit={submit}>
        {statusText && <small className="composer-channel-status">{statusText}</small>}
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          multiple
          aria-hidden="true"
          tabIndex={-1}
          accept="image/jpeg,image/png,image/webp,audio/mpeg,audio/ogg,audio/wav,audio/webm,audio/mp4,video/mp4,video/webm,application/pdf,text/plain,application/zip,.zip"
          onChange={(event) => {
            chooseFiles(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
        <button
          className={`composer-tool composer-plus${uploadOpen ? ' active' : ''}`}
          type="button"
          disabled={disabled || busy}
          aria-label={messages.addAttachment}
          aria-expanded={uploadOpen}
          onClick={() => {
            setUploadOpen((current) => !current);
            setMediaOpen(false);
          }}
        >
          <Plus size={23} />
        </button>
        <div className="composer-textarea-shell">
          <div ref={mentionOverlayRef} className="composer-mention-overlay" aria-hidden="true">
            {renderComposerHighlight(value, mentionAliases, customEmojis)}
          </div>
          <textarea
            ref={textareaRef}
            className="composer-mention-input"
            name="content"
            rows={1}
            value={displayValue}
            disabled={disabled || busy}
            placeholder={placeholder}
            onChange={(event) => {
              const nextDisplayValue = event.target.value;
              const nextValue = canonicalizeComposerMentions(
                canonicalizeCustomEmojiAliases(nextDisplayValue, customEmojis),
                composerAliases,
              );
              const rawCursor = canonicalizeComposerMentions(
                canonicalizeCustomEmojiAliases(
                  nextDisplayValue.slice(0, event.target.selectionStart),
                  customEmojis,
                ),
                composerAliases,
              ).length;
              updateValue(nextValue, rawCursor);
            }}
            onScroll={(event) => {
              if (!mentionOverlayRef.current) return;
              mentionOverlayRef.current.scrollTop = event.currentTarget.scrollTop;
              mentionOverlayRef.current.scrollLeft = event.currentTarget.scrollLeft;
            }}
            onKeyDown={keyDown}
            aria-label={ariaLabel ?? messages.messagePlaceholder}
            aria-invalid={!unlimitedText && remainingCharacters < 0}
            aria-describedby={
              !unlimitedText && value.length >= 2_200 ? characterCountId : undefined
            }
          />
        </div>
        <div className="composer-actions">
          <button
            className={`composer-tool composer-mic${recording ? ' active recording' : ''}`}
            type="button"
            disabled={disabled || busy}
            aria-label={
              recording
                ? locale === 'tr'
                  ? 'Ses kaydını bitir'
                  : 'Stop voice recording'
                : locale === 'tr'
                  ? 'Sesli mesaj kaydet'
                  : 'Record a voice message'
            }
            onClick={() => (recording ? finishVoiceRecording(false) : void startVoiceRecording())}
          >
            {recording ? <Square size={18} /> : <Mic size={20} />}
          </button>
          <button
            className={`composer-tool composer-gif${mediaOpen && tab === 'gif' ? ' active' : ''}`}
            type="button"
            disabled={disabled || busy}
            aria-label={messages.addGif}
            onClick={() => {
              setTab('gif');
              setMediaOpen(true);
              setUploadOpen(false);
              onClearFiles();
            }}
          >
            <span>GIF</span>
          </button>
          <button
            className={`composer-tool${mediaOpen && tab === 'emoji' ? ' active' : ''}`}
            type="button"
            disabled={disabled || busy}
            aria-label={messages.emoji}
            onClick={() => {
              setTab('emoji');
              setMediaOpen(true);
              setUploadOpen(false);
            }}
          >
            <Smile size={21} />
          </button>
        </div>
      </form>
      {!unlimitedText && value.length >= 2_200 && (
        <small
          id={characterCountId}
          className={`composer-character-count${remainingCharacters < 0 ? ' limit' : ''}`}
          aria-live={remainingCharacters < 0 ? 'polite' : 'off'}
        >
          {remainingCharacters}
        </small>
      )}
      <Dialog.Root open={tooLongOpen} onOpenChange={setTooLongOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay composer-limit-overlay" />
          <Dialog.Content
            className="composer-limit-dialog"
            aria-describedby="composer-limit-description"
          >
            <Dialog.Title>
              {locale === 'tr' ? 'Mesajın çok uzun.' : 'Your message is too long.'}
            </Dialog.Title>
            <Dialog.Description id="composer-limit-description">
              {locale === 'tr'
                ? `${value.length} karakter içeren mesajını kısalt. Mesaj sınırı ${MEMBER_MESSAGE_LIMIT} karakter; ${Math.abs(remainingCharacters)} karakter fazlan var.`
                : `Shorten your ${value.length}-character message. The limit is ${MEMBER_MESSAGE_LIMIT} characters; you are ${Math.abs(remainingCharacters)} characters over.`}
            </Dialog.Description>
            <Dialog.Close asChild>
              <button type="button" autoFocus>
                {locale === 'tr' ? 'Tamam' : 'Okay'}
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-card schedule-message-dialog">
            <div className="dialog-title-row">
              <div>
                <Dialog.Title>{messages.scheduleMessage}</Dialog.Title>
                <Dialog.Description>{messages.scheduleMessageDescription}</Dialog.Description>
              </div>
              <Dialog.Close className="icon-button" aria-label={messages.close}>
                <X size={18} />
              </Dialog.Close>
            </div>
            <label className="field-block">
              <span>{messages.sendAt}</span>
              <input
                type="datetime-local"
                value={scheduleAt}
                min={localDateTimeValue(Date.now() + 60_000)}
                max={localDateTimeValue(Date.now() + 7 * 24 * 60 * 60_000)}
                onChange={(event) => setScheduleAt(event.target.value)}
              />
            </label>
            <button
              className="primary-button"
              disabled={scheduleBusy || !scheduleAt}
              onClick={() => {
                void (async () => {
                  if (!onSchedule) return;
                  setScheduleBusy(true);
                  try {
                    await onSchedule(new Date(scheduleAt).toISOString());
                    await scheduledMessages.refetch();
                    setScheduleAt(localDateTimeValue(Date.now() + 5 * 60_000));
                  } catch (error) {
                    onError(errorMessage(error, messages));
                  } finally {
                    setScheduleBusy(false);
                  }
                })();
              }}
            >
              {scheduleBusy ? messages.saving : messages.scheduleMessageAction}
            </button>
            {(scheduledMessages.data?.length ?? 0) > 0 && (
              <section className="scheduled-message-list">
                <h3>{messages.scheduledMessages}</h3>
                {scheduledMessages.data?.map((item) => (
                  <article key={item.id}>
                    <span>
                      <strong>{item.content}</strong>
                      <small>
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(item.scheduledFor))}
                        {item.status === 'FAILED' ? ` · ${messages.scheduleFailed}` : ''}
                      </small>
                    </span>
                    {item.status === 'PENDING' && (
                      <button
                        className="icon-button"
                        aria-label={messages.cancelScheduledMessage}
                        onClick={() => {
                          void (async () => {
                            await apiRequest(`/message-delivery/scheduled/${item.id}`, {
                              method: 'DELETE',
                            });
                            await scheduledMessages.refetch();
                          })();
                        }}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </article>
                ))}
              </section>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function localDateTimeValue(timestamp: number): string {
  const date = new Date(timestamp);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatRecordingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function highlightPendingMentions(text: string, keyPrefix: string): ReactNode[] {
  const result: ReactNode[] = [];
  const pattern = /(^|\s)([@#][^\s@#]*)/gu;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) result.push(text.slice(lastIndex, match.index));
    if (match[1]) result.push(match[1]);
    result.push(
      <span className="composer-mention-highlight" key={`${keyPrefix}-${match.index}`}>
        {match[2]}
      </span>,
    );
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) result.push(text.slice(lastIndex));
  return result;
}

function renderComposerHighlight(
  value: string,
  aliases: ComposerMentionAlias[],
  customEmojis: ServerEmoji[],
): ReactNode[] {
  const labels = new Map(aliases.map((alias) => [alias.token, alias.label]));
  const result: ReactNode[] = [];
  const pattern = /<[@#][^>\s]+>|<:([A-Za-z0-9_]{2,32}):([0-9a-f-]{36})>/gu;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    if (match.index > lastIndex)
      result.push(
        ...highlightPendingMentions(value.slice(lastIndex, match.index), `plain-${lastIndex}`),
      );
    const token = match[0];
    if (token.startsWith('<:')) {
      const emoji = customEmojis.find(
        (candidate) => candidate.name === match?.[1] && candidate.id === match?.[2],
      );
      result.push(
        emoji ? (
          <img
            className="composer-inline-custom-emoji"
            key={`emoji-${match.index}`}
            src={emoji.url}
            alt={`:${emoji.name}:`}
          />
        ) : (
          `:${match[1]}:`
        ),
      );
      lastIndex = pattern.lastIndex;
      continue;
    }
    result.push(
      <span
        className={`composer-mention-highlight${token.startsWith('<#') ? ' channel' : ''}`}
        key={`mention-${match.index}`}
      >
        {labels.get(token) ?? token}
      </span>,
    );
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < value.length)
    result.push(...highlightPendingMentions(value.slice(lastIndex), `plain-${lastIndex}`));
  return result;
}

function formatBytes(bytes: number, locale: Locale): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024)
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
}
