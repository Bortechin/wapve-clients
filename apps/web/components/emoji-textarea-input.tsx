'use client';

import { useRef } from 'react';
import { EmojiPickerPopover } from './emoji-picker-popover';

export function EmojiTextareaInput({
  id,
  name,
  value,
  maxLength,
  locale,
  emojiLabel,
  placeholder,
  onChange,
}: {
  id: string;
  name?: string;
  value: string;
  maxLength: number;
  locale: 'tr' | 'en';
  emojiLabel: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function insertEmoji(emoji: string) {
    const start = ref.current?.selectionStart ?? value.length;
    const end = ref.current?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${emoji}${value.slice(end)}`.slice(0, maxLength);
    onChange(next);
    window.requestAnimationFrame(() => {
      const cursor = Math.min(start + emoji.length, next.length);
      ref.current?.focus();
      ref.current?.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="emoji-textarea-input">
      <textarea
        ref={ref}
        id={id}
        name={name}
        value={value}
        maxLength={maxLength}
        rows={4}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="emoji-textarea-footer">
        <span>{value.length}/{maxLength}</span>
        <EmojiPickerPopover locale={locale} label={emojiLabel} onSelect={insertEmoji} />
      </div>
    </div>
  );
}
