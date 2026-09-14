'use client';

import { Bold, Code2, Eye, Italic, List, Quote, Strikethrough, Underline } from 'lucide-react';
import { useRef } from 'react';
import type { Dictionary } from '@/lib/i18n';
import { EmojiPickerPopover } from './emoji-picker-popover';

const TOPIC_MAX_LENGTH = 500;

export function ChannelTopicEditor({
  value,
  locale,
  messages,
  onChange,
}: {
  value: string;
  locale: 'tr' | 'en';
  messages: Dictionary;
  onChange: (value: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insert(prefix: string, suffix = prefix, fallback = '') {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || fallback;
    const next = `${value.slice(0, start)}${prefix}${selected}${suffix}${value.slice(end)}`.slice(
      0,
      TOPIC_MAX_LENGTH,
    );
    onChange(next);
    window.requestAnimationFrame(() => {
      const selectionStart = start + prefix.length;
      const selectionEnd = Math.min(selectionStart + selected.length, next.length);
      textarea?.focus();
      textarea?.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  function insertEmoji(emoji: string) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${emoji}${value.slice(end)}`.slice(0, TOPIC_MAX_LENGTH);
    onChange(next);
    window.requestAnimationFrame(() => {
      const cursor = Math.min(start + emoji.length, next.length);
      textarea?.focus();
      textarea?.setSelectionRange(cursor, cursor);
    });
  }

  function insertLines(prefix: string, fallback: string) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || fallback;
    const formatted = selected
      .split('\n')
      .map((line) => `${prefix}${line}`)
      .join('\n');
    const next = `${value.slice(0, start)}${formatted}${value.slice(end)}`.slice(
      0,
      TOPIC_MAX_LENGTH,
    );
    onChange(next);
    window.requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start, Math.min(start + formatted.length, next.length));
    });
  }

  const tools = [
    { label: messages.formatBold, icon: Bold, prefix: '**', fallback: messages.formatText },
    { label: messages.formatItalic, icon: Italic, prefix: '*', fallback: messages.formatText },
    {
      label: messages.formatUnderline,
      icon: Underline,
      prefix: '__',
      fallback: messages.formatText,
    },
    {
      label: messages.formatStrikethrough,
      icon: Strikethrough,
      prefix: '~~',
      fallback: messages.formatText,
    },
    { label: messages.formatSpoiler, icon: Eye, prefix: '||', fallback: messages.formatText },
    {
      label: locale === 'tr' ? 'Satır içi kod' : 'Inline code',
      icon: Code2,
      prefix: '`',
      fallback: messages.formatText,
    },
  ] as const;

  return (
    <div className="channel-topic-editor">
      <div className="channel-topic-toolbar" role="toolbar" aria-label={messages.formattingTools}>
        {tools.map(({ label, icon: Icon, prefix, fallback }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            title={label}
            onClick={() => insert(prefix, prefix, fallback)}
          >
            <Icon size={18} />
          </button>
        ))}
        <button
          type="button"
          aria-label={locale === 'tr' ? 'Alıntı bloğu' : 'Quote block'}
          title={locale === 'tr' ? 'Alıntı bloğu' : 'Quote block'}
          onClick={() => insertLines('> ', messages.formatText)}
        >
          <Quote size={18} />
        </button>
        <button
          type="button"
          aria-label={locale === 'tr' ? 'Madde listesi' : 'Bullet list'}
          title={locale === 'tr' ? 'Madde listesi' : 'Bullet list'}
          onClick={() => insertLines('- ', messages.formatText)}
        >
          <List size={18} />
        </button>
        <span />
        <EmojiPickerPopover locale={locale} label={messages.addEmoji} onSelect={insertEmoji} />
      </div>
      <textarea
        ref={textareaRef}
        id="channel-settings-topic"
        value={value}
        maxLength={TOPIC_MAX_LENGTH}
        placeholder={messages.channelTopicPlaceholder}
        onChange={(event) => onChange(event.target.value)}
      />
      <output aria-live="polite">
        {value.length}/{TOPIC_MAX_LENGTH}
      </output>
    </div>
  );
}
