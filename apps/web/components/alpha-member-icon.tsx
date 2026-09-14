'use client';

import type { PlatformBadge } from '@wapve/contracts';
import Image from 'next/image';
import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { orderedPlatformBadges, platformBadgeRegistry } from './badge-registry';

type SecondaryBadge = Exclude<PlatformBadge, 'PLATFORM_OWNER'>;

export function AlphaMemberIcon({ badges, locale, size = 19, focusable = true }: { badges: PlatformBadge[]; locale: string; size?: number; focusable?: boolean }) {
  const visible = orderedPlatformBadges(badges).filter((badge): badge is SecondaryBadge => badge !== 'PLATFORM_OWNER');
  if (!visible.length) return null;
  return <>{visible.map((badge) => <PlatformBadgeIcon key={badge} badge={badge} locale={locale} size={size} focusable={focusable} />)}</>;
}

function PlatformBadgeIcon({ badge, locale, size, focusable }: { badge: SecondaryBadge; locale: string; size: number; focusable: boolean }) {
  const badgeInfo = platformBadgeRegistry[badge];
  const trigger = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const language = locale === 'tr' ? 'tr' : 'en';
  const label = badgeInfo.title[language];
  const description = badgeInfo.description[language];
  function showCard() {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const cardWidth = 280;
    const cardHeight = 100;
    const left = Math.max(10, Math.min(window.innerWidth - cardWidth - 10, rect.left + rect.width / 2 - cardWidth / 2));
    setPosition({ left, top: rect.top >= cardHeight + 20 ? rect.top - cardHeight - 10 : rect.bottom + 10 });
  }
  const artwork = <Image src={badgeInfo.image} width={size} height={size} sizes={`${size}px`} alt="" aria-hidden="true" />;
  return <>
    <span ref={trigger} className="alpha-member-icon" role="img" aria-label={label} aria-describedby={position ? tooltipId : undefined} tabIndex={focusable ? 0 : -1} onMouseEnter={showCard} onMouseLeave={() => setPosition(null)} onFocus={showCard} onBlur={() => setPosition(null)}>{artwork}</span>
    {position && createPortal(<div id={tooltipId} className="platform-owner-card alpha-member-card" role="tooltip" style={{ left: position.left, top: position.top }}><span className="alpha-member-card-icon" aria-hidden="true"><Image src={badgeInfo.image} width={48} height={48} sizes="48px" alt="" /></span><span><small>{badgeInfo.eyebrow[language]}</small><strong>{label}</strong><span>{description}</span></span></div>, document.body)}
  </>;
}
