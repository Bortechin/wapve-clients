'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { LockKeyhole, Sparkles, X } from 'lucide-react';
import { WapvePlusBadge } from './wapve-plus-badge';

export function AnimatedEmojiUpgradeDialog({
  open,
  onOpenChange,
  locale,
  onExplore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: 'tr' | 'en';
  onExplore: () => void;
}) {
  const tr = locale === 'tr';
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay animated-emoji-upgrade-overlay" />
        <Dialog.Content
          className="animated-emoji-upgrade-dialog"
          aria-describedby="animated-emoji-upgrade-description"
        >
          <Dialog.Close
            className="icon-button animated-emoji-upgrade-close"
            aria-label={tr ? 'Kapat' : 'Close'}
          >
            <X size={20} />
          </Dialog.Close>
          <div className="animated-emoji-upgrade-art" aria-hidden="true">
            <span className="animated-emoji-spark one">✨</span>
            <WapvePlusBadge size={92} />
            <span className="animated-emoji-sample">💫</span>
            <span className="animated-emoji-spark two">🌊</span>
          </div>
          <span className="animated-emoji-upgrade-kicker">
            <LockKeyhole size={14} /> Wapve+
          </span>
          <Dialog.Title>
            {tr ? 'Hareketli emojilerle dalganı büyüt' : 'Bring your wave to life'}
          </Dialog.Title>
          <Dialog.Description id="animated-emoji-upgrade-description">
            {tr
              ? 'Sunuculardaki hareketli emojileri mesajlarında ve tepkilerinde kullanmak için Wapve+ gerekir. Emojileri önizlemeye devam edebilirsin.'
              : 'Wapve+ is required to use animated server emojis in messages and reactions. You can still preview every emoji.'}
          </Dialog.Description>
          <div className="animated-emoji-upgrade-actions">
            <Dialog.Close>{tr ? 'Şimdi değil' : 'Not now'}</Dialog.Close>
            <button type="button" className="primary" onClick={onExplore}>
              <Sparkles size={16} /> {tr ? 'Wapve+’ı keşfet' : 'Explore Wapve+'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
