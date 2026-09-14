'use client';

import { useQuery } from '@tanstack/react-query';
import type { Locale, ServerEmoji, ServerSummary } from '@wapve/contracts';
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import { Ban, Smile, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest } from '@/lib/api';
import { turkishEmojiData } from '@/lib/turkish-emoji-data';
import { CustomStatusEmoji } from './custom-status-emoji';

export function StatusEmojiPicker({
  locale,
  servers,
  value,
  onSelect,
}: {
  locale: Locale;
  servers: ServerSummary[];
  value: string;
  onSelect: (value: string) => void;
}) {
  const tr = locale === 'tr';
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [position, setPosition] = useState<{ left: number; top?: number; bottom?: number }>({
    left: 8,
    top: 8,
  });
  const emojis = useQuery({
    queryKey: ['server-emojis', selectedServerId],
    queryFn: () => apiRequest<ServerEmoji[]>(`/servers/${selectedServerId}/emojis`),
    enabled: open && Boolean(selectedServerId),
  });

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const width = Math.min(420, window.innerWidth - 16);
      const height = Math.min(panelRef.current?.offsetHeight ?? 490, window.innerHeight - 16);
      const left = Math.max(8, Math.min(trigger.left, window.innerWidth - width - 8));
      if (trigger.top >= height + 8) {
        setPosition({ left, bottom: window.innerHeight - trigger.top + 8 });
      } else {
        setPosition({
          left,
          top: Math.max(8, Math.min(trigger.bottom + 8, window.innerHeight - height - 8)),
        });
      }
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [emojis.data?.length, open, selectedServerId]);

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

  const choose = (next: string) => {
    onSelect(next);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="status-emoji-trigger"
        aria-label={tr ? 'Durum emojisi seç' : 'Choose status emoji'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {value ? <CustomStatusEmoji value={value} /> : <Smile size={18} aria-hidden="true" />}
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="status-emoji-picker-panel"
            style={position}
            role="dialog"
            aria-label={tr ? 'Durum emojileri' : 'Status emojis'}
          >
            <header className="status-emoji-picker-header">
              <div>
                <strong>{tr ? 'Durum emojisi' : 'Status emoji'}</strong>
                <small>
                  {tr ? 'Unicode veya sunucu emojisi seç' : 'Choose Unicode or a server emoji'}
                </small>
              </div>
              {value && (
                <button type="button" onClick={() => choose('')}>
                  <X size={14} /> {tr ? 'Kaldır' : 'Clear'}
                </button>
              )}
            </header>
            <nav
              className="status-emoji-server-tabs"
              aria-label={tr ? 'Emoji kaynağı' : 'Emoji source'}
            >
              <button
                type="button"
                className={selectedServerId === null ? 'active' : ''}
                aria-label={tr ? 'Standart emojiler' : 'Standard emojis'}
                title={tr ? 'Standart emojiler' : 'Standard emojis'}
                onClick={() => setSelectedServerId(null)}
              >
                <Smile size={18} />
              </button>
              {servers.map((server) => (
                <button
                  type="button"
                  key={server.id}
                  className={selectedServerId === server.id ? 'active' : ''}
                  aria-label={server.name}
                  title={server.name}
                  onClick={() => setSelectedServerId(server.id)}
                >
                  {server.iconUrl ? (
                    <img src={server.iconUrl} alt="" />
                  ) : (
                    server.name.slice(0, 1).toUpperCase()
                  )}
                </button>
              ))}
            </nav>
            <div className="status-emoji-picker-content">
              {selectedServerId === null ? (
                <EmojiPicker
                  width="100%"
                  height={350}
                  theme={Theme.DARK}
                  emojiStyle={EmojiStyle.NATIVE}
                  lazyLoadEmojis
                  {...(tr ? { emojiData: turkishEmojiData } : {})}
                  searchPlaceholder={tr ? 'Emoji ara' : 'Search emoji'}
                  searchClearButtonLabel={tr ? 'Aramayı temizle' : 'Clear search'}
                  previewConfig={{ showPreview: false }}
                  onEmojiClick={(data) => choose(data.emoji)}
                />
              ) : emojis.isPending ? (
                <p className="status-emoji-picker-empty">
                  {tr ? 'Emojiler yükleniyor…' : 'Loading emojis…'}
                </p>
              ) : emojis.isError ? (
                <p className="status-emoji-picker-empty">
                  {tr ? 'Emojiler alınamadı.' : 'Could not load emojis.'}
                </p>
              ) : (emojis.data?.length ?? 0) === 0 ? (
                <p className="status-emoji-picker-empty">
                  {tr ? 'Bu sunucuda emoji yok.' : 'This server has no emojis.'}
                </p>
              ) : (
                <div className="status-emoji-custom-grid">
                  {emojis.data?.map((emoji) => (
                    <button
                      type="button"
                      key={emoji.id}
                      disabled={emoji.animated}
                      title={
                        emoji.animated
                          ? tr
                            ? 'Hareketli emojiler özel durumda henüz kullanılamaz'
                            : 'Animated emojis are not available in custom status yet'
                          : `:${emoji.name}:`
                      }
                      onClick={() => choose(`<:${emoji.name}:${emoji.id}>`)}
                    >
                      <img src={emoji.url} alt={`:${emoji.name}:`} />
                      {emoji.animated && <Ban size={13} aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedServerId && (emojis.data?.some((emoji) => emoji.animated) ?? false) && (
              <p className="status-emoji-animated-note">
                {tr
                  ? 'Hareketli emojiler özel durumda şimdilik kapalıdır.'
                  : 'Animated emojis are currently disabled for custom status.'}
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
