'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { ServerLayoutItem } from '@wapve/contracts';
import { Check, MailCheck, Palette, Settings, X } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { Dictionary } from '@/lib/i18n';

const folderColors = [
  '#1478ff',
  '#00b8d9',
  '#20c997',
  '#36c76d',
  '#f2b01e',
  '#ff7a1a',
  '#f04444',
  '#e72e72',
  '#9a60e8',
  '#66788f',
];

export function ServerFolderContextMenu({
  item,
  messages,
  children,
  onChange,
  onMarkRead,
}: {
  item: ServerLayoutItem;
  messages: Dictionary;
  children: ReactNode;
  onChange: (patch: Pick<ServerLayoutItem, 'name' | 'color'>) => void;
  onMarkRead: () => Promise<void>;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [name, setName] = useState(item.name ?? '');
  const [color, setColor] = useState(item.color ?? folderColors[0]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!position) return;
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setPosition(null);
    };
    const closeOnKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPosition(null);
    };
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', closeOnKey);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', closeOnKey);
    };
  }, [position]);

  function openMenu(event: MouseEvent<HTMLSpanElement>) {
    event.preventDefault();
    event.stopPropagation();
    setPosition({
      left: Math.max(8, Math.min(event.clientX, window.innerWidth - 244)),
      top: Math.max(8, Math.min(event.clientY, window.innerHeight - 112)),
    });
  }

  async function markRead() {
    setBusy(true);
    try {
      await onMarkRead();
      setPosition(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <span className="server-folder-context-trigger" onContextMenu={openMenu}>
        {children}
      </span>
      {position &&
        createPortal(
          <div
            ref={menuRef}
            className="server-context-menu compact-context-menu"
            role="menu"
            style={position}
            onContextMenu={(event) => event.preventDefault()}
          >
            <button
              role="menuitem"
              disabled={busy}
              onClick={() => void markRead()}
            >
              <MailCheck size={16} /> {messages.markFolderRead}
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setName(item.name ?? '');
                setColor(item.color ?? folderColors[0]);
                setPosition(null);
                setSettingsOpen(true);
              }}
            >
              <Settings size={16} /> {messages.folderSettings}
            </button>
          </div>,
          document.body,
        )}
      <Dialog.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-card server-folder-dialog">
            <div className="dialog-title-row">
              <div>
                <Dialog.Title>{messages.folderSettings}</Dialog.Title>
                <Dialog.Description>{messages.folderSettingsDescription}</Dialog.Description>
              </div>
              <Dialog.Close className="icon-button" aria-label={messages.close}>
                <X size={18} />
              </Dialog.Close>
            </div>
            <label className="field-block">
              <span>{messages.folderName}</span>
              <input
                value={name}
                maxLength={40}
                onChange={(event) => setName(event.target.value)}
                placeholder={messages.folderNamePlaceholder}
              />
            </label>
            <fieldset className="folder-color-fieldset">
              <legend>
                <Palette size={15} /> {messages.folderColor}
              </legend>
              <div className="folder-color-grid">
                {folderColors.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    className={choice === color ? 'active' : ''}
                    style={{ background: choice }}
                    aria-label={choice}
                    aria-pressed={choice === color}
                    onClick={() => setColor(choice)}
                  >
                    {choice === color && <Check size={16} />}
                  </button>
                ))}
              </div>
            </fieldset>
            <button
              className="primary-button folder-save-button"
              onClick={() => {
                onChange({ name: name.trim() || undefined, color });
                setSettingsOpen(false);
              }}
            >
              {messages.save}
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
