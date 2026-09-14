'use client';

import { Copy, Ellipsis, FileText, Flag, Pin, Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Dictionary } from '@/lib/i18n';

export function MessageMoreMenu({
  messages,
  pinned,
  content,
  canPin,
  canDelete,
  showMessageId,
  onTogglePin,
  onCopyContent,
  onCopyLink,
  onCopyId,
  onDelete,
  onReport,
  onClose,
}: {
  messages: Dictionary;
  pinned: boolean;
  content: string | null;
  canPin: boolean;
  canDelete: boolean;
  showMessageId: boolean;
  onTogglePin: () => Promise<void> | void;
  onCopyContent: () => Promise<void> | void;
  onCopyLink: () => Promise<void> | void;
  onCopyId: () => Promise<void> | void;
  onDelete: (options?: { shiftKey?: boolean }) => Promise<void> | void;
  onReport?: () => void;
  onClose: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });

  function close() {
    setOpen(false);
    onClose();
  }

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const width = 230;
      const height = panelRef.current?.offsetHeight ?? 240;
      const left = Math.max(8, Math.min(trigger.right - width, window.innerWidth - width - 8));
      const top =
        trigger.top >= height + 8
          ? trigger.top - height - 8
          : Math.max(8, Math.min(trigger.bottom + 8, window.innerHeight - height - 8));
      setPosition({ left, top });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [canDelete, canPin, content, open, showMessageId]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) close();
    };
    const closeOnKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('keydown', closeOnKey);
    window.requestAnimationFrame(() =>
      panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus(),
    );
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('keydown', closeOnKey);
    };
  });

  function run(action: () => Promise<void> | void) {
    close();
    void action();
  }

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
    if (!buttons.length) return;
    event.preventDefault();
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : event.key === 'ArrowDown'
            ? (current + 1 + buttons.length) % buttons.length
            : (current - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={open ? 'active' : ''}
        aria-label={messages.messageActions}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (open) close();
          else setOpen(true);
        }}
      >
        <Ellipsis size={17} />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="message-more-menu"
            role="menu"
            aria-label={messages.messageActions}
            style={position}
            onKeyDown={moveFocus}
          >
            {canPin && (
              <button role="menuitem" onClick={() => run(onTogglePin)}>
                <Pin size={16} /> {pinned ? messages.unpinMessage : messages.pinMessage}
              </button>
            )}
            {content && (
              <button role="menuitem" onClick={() => run(onCopyContent)}>
                <FileText size={16} /> {messages.copyMessage}
              </button>
            )}
            <button role="menuitem" onClick={() => run(onCopyLink)}>
              <Copy size={16} /> {messages.copyMessageLink}
            </button>
            {showMessageId && (
              <button role="menuitem" onClick={() => run(onCopyId)}>
                <Copy size={16} /> {messages.copyMessageId}
              </button>
            )}
            {onReport && (
              <button role="menuitem" onClick={() => run(onReport)}>
                <Flag size={16} /> {messages.reportMessage}
              </button>
            )}
            {canDelete && (
              <button
                role="menuitem"
                className="danger"
                onClick={(event) => {
                  const shiftKey = event.shiftKey;
                  run(() => onDelete({ shiftKey }));
                }}
              >
                <Trash2 size={16} /> {messages.deleteMessage}
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
