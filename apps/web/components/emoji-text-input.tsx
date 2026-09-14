'use client';

import { useRef } from 'react';
import { EmojiPickerPopover } from './emoji-picker-popover';

export function EmojiTextInput({
  id,
  name,
  value,
  maxLength,
  locale,
  emojiLabel,
  autoFocus,
  required,
  onChange,
}: {
  id: string;
  name?: string;
  value: string;
  maxLength: number;
  locale: 'tr' | 'en';
  emojiLabel: string;
  autoFocus?: boolean;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function insertEmoji(emoji: string) {
    const input = inputRef.current;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${emoji}${value.slice(end)}`.slice(0, maxLength);
    onChange(next);
    window.requestAnimationFrame(() => {
      const cursor = Math.min(start + emoji.length, next.length);
      input?.focus();
      input?.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="emoji-text-input">
      <input
        ref={inputRef}
        id={id}
        name={name}
        value={value}
        minLength={required ? 1 : undefined}
        maxLength={maxLength}
        required={required}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
      />
      <EmojiPickerPopover locale={locale} label={emojiLabel} onSelect={insertEmoji} />
    </div>
  );
}
