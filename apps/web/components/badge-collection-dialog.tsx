'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { PlatformBadge } from '@wapve/contracts';
import { Crown, X } from 'lucide-react';
import Image from 'next/image';
import { ownedBadges, platformBadgeRegistry } from './badge-registry';

export function BadgeCollectionDialog({
  open,
  onOpenChange,
  badges,
  premiumActive,
  locale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badges: PlatformBadge[];
  premiumActive: boolean;
  locale: 'tr' | 'en';
}) {
  const items = ownedBadges(badges, premiumActive);
  const tr = locale === 'tr';
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay badge-collection-overlay" />
        <Dialog.Content className="badge-collection-dialog" aria-describedby="badge-collection-copy">
          <header>
            <div>
              <span className="badge-collection-kicker"><Crown size={15} /> {tr ? 'PROFİL KOLEKSİYONU' : 'PROFILE COLLECTION'}</span>
              <Dialog.Title>{tr ? 'Rozetlerin' : 'Your badges'}</Dialog.Title>
              <Dialog.Description id="badge-collection-copy">
                {tr ? `${items.length} rozet hesabının hikâyesini anlatıyor.` : `${items.length} badges tell your account story.`}
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label={tr ? 'Kapat' : 'Close'}><X size={20} /></Dialog.Close>
          </header>
          <div className="badge-collection-grid">
            {items.map((item) => {
              if (item.kind === 'premium') {
                return (
                  <article className="badge-collection-card is-premium" key={item.id}>
                    <span className="badge-collection-art"><Image src="/premium/wapve-plus-badge.webp" width={64} height={64} alt="" /></span>
                    <span><small>{tr ? 'WAPVE+ ÜYELİĞİ' : 'WAPVE+ MEMBERSHIP'}</small><strong>Wapve+</strong><p>{tr ? 'Rozetler, profil kozmetikleri ve topluluk avantajları açık.' : 'Badges, profile cosmetics, and community benefits are unlocked.'}</p></span>
                  </article>
                );
              }
              const presentation = platformBadgeRegistry[item.id];
              return (
                <article className="badge-collection-card" key={item.id} style={{ '--badge-accent': presentation.color } as React.CSSProperties}>
                  <span className="badge-collection-art"><Image src={presentation.image} width={64} height={64} alt="" /></span>
                  <span><small>{presentation.eyebrow[locale]}</small><strong>{presentation.title[locale]}</strong><p>{presentation.description[locale]}</p></span>
                </article>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
