'use client';

import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import { Smile } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { turkishEmojiData } from '@/lib/turkish-emoji-data';

export function EmojiPickerPopover({
  locale,
  label,
  onSelect,
}: {
  locale: 'tr' | 'en';
  label: string;
  onSelect: (emoji: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', closeOnKey);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', closeOnKey);
    };
  }, [open]);

  return (
    <div className="field-emoji-picker" ref={rootRef}>
      <button
        type="button"
        className={open ? 'active' : ''}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Smile size={17} />
      </button>
      {open && (
        <div className="field-emoji-picker-panel">
          <EmojiPicker
            width="100%"
            height={350}
            theme={Theme.DARK}
            emojiStyle={EmojiStyle.NATIVE}
            lazyLoadEmojis
            {...(locale === 'tr' ? { emojiData: turkishEmojiData } : {})}
            searchPlaceholder={locale === 'tr' ? 'Emoji ara' : 'Search emoji'}
            searchClearButtonLabel={locale === 'tr' ? 'Aramayı temizle' : 'Clear search'}
            previewConfig={{ showPreview: false }}
            onEmojiClick={(data) => {
              onSelect(data.emoji);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
