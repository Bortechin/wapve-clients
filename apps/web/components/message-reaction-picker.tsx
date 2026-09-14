'use client';

import type { ServerEmoji } from '@wapve/contracts';
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import { LockKeyhole, Plus, Smile } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { turkishEmojiData } from '@/lib/turkish-emoji-data';

export function MessageReactionPicker({
  locale,
  label,
  customEmojis,
  customEmojiLabel,
  premiumActive = false,
  onPremiumRequired = () => undefined,
  triggerVariant = 'icon',
  onSelect,
  anchorRect,
  isOpen,
  onClose,
}: {
  locale: 'tr' | 'en';
  label: string;
  customEmojis: ServerEmoji[];
  customEmojiLabel: string;
  premiumActive?: boolean;
  onPremiumRequired?: () => void;
  triggerVariant?: 'icon' | 'menu';
  onSelect: (emoji: string) => void;
  anchorRect?: DOMRect | null;
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;

  const setOpen = (value: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof value === 'function' ? value(open) : value;
    if (isOpen !== undefined) {
      if (!next) onClose?.();
    } else {
      setInternalOpen(next);
      if (!next) onClose?.();
    }
  };

  const [position, setPosition] = useState<{ left: number; top?: number; bottom?: number }>({
    left: 8,
    top: 8,
  });

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = anchorRect ?? triggerRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const width = Math.min(360, window.innerWidth - 16);
      const panelHeight = Math.min(panelRef.current?.offsetHeight ?? 460, window.innerHeight - 16);
      const left = Math.max(8, Math.min(trigger.right - width, window.innerWidth - width - 8));
      if (trigger.top >= panelHeight + 8) {
        setPosition({ left, bottom: window.innerHeight - trigger.top + 8 });
      } else {
        setPosition({
          left,
          top: Math.max(8, Math.min(trigger.bottom + 8, window.innerHeight - panelHeight - 8)),
        });
      }
    };
    const repositionOnExternalScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && panelRef.current?.contains(target)) return;
      place();
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', repositionOnExternalScroll, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', repositionOnExternalScroll, true);
    };
  }, [anchorRect, customEmojis.length, open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target))
        setOpen(false);
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

  const select = (emoji: string) => {
    onSelect(emoji);
    setOpen(false);
  };

  return (
    <>
      {!anchorRect && (
        <button
          ref={triggerRef}
          type="button"
          className={`reaction-picker-trigger${triggerVariant === 'menu' ? ' reaction-picker-menu-trigger' : ''}${open ? ' active' : ''}`}
          role={triggerVariant === 'menu' ? 'menuitem' : undefined}
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {triggerVariant === 'menu' ? (
            <>
              <Smile size={15} /> {label}
            </>
          ) : (
            <>
              <Smile size={17} />
              <span aria-hidden="true">
                <Plus size={9} strokeWidth={3} />
              </span>
            </>
          )}
        </button>
      )}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="message-reaction-picker-panel"
            style={position}
            role="dialog"
            aria-label={label}
          >
            {customEmojis.length > 0 && (
              <section className="reaction-picker-custom-emojis">
                <header>{customEmojiLabel}</header>
                <div>
                  {customEmojis.map((emoji) => (
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
                          setOpen(false);
                          onPremiumRequired();
                          return;
                        }
                        select(`<:${emoji.name}:${emoji.id}>`);
                      }}
                    >
                      <img src={emoji.url} alt={`:${emoji.name}:`} />
                      {emoji.animated && !premiumActive && <LockKeyhole size={13} />}
                    </button>
                  ))}
                </div>
              </section>
            )}
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
              onEmojiClick={(data) => select(data.emoji)}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
