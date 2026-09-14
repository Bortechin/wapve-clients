'use client';

import type { PlatformBadge } from '@wapve/contracts';
import Image from 'next/image';
import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { platformBadgeRegistry } from './badge-registry';

export function PlatformOwnerIcon({
  badges,
  locale,
  size = 19,
  focusable = true,
}: {
  badges: PlatformBadge[];
  locale: string;
  size?: number;
  focusable?: boolean;
}) {
  const language = locale === 'tr' ? 'tr' : 'en';
  const presentation = platformBadgeRegistry.PLATFORM_OWNER;
  const label = presentation.title[language];
  const description = presentation.description[language];
  const trigger = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  if (!badges.includes('PLATFORM_OWNER')) return null;

  function showCard() {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const cardWidth = 260;
    const cardHeight = 94;
    const gap = 10;
    const left = Math.max(
      10,
      Math.min(window.innerWidth - cardWidth - 10, rect.left + rect.width / 2 - cardWidth / 2),
    );
    const top = rect.top >= cardHeight + gap + 10 ? rect.top - cardHeight - gap : rect.bottom + gap;
    setPosition({ left, top });
  }

  return (
    <>
      <span
        ref={trigger}
        className="platform-owner-icon"
        role="img"
        aria-label={label}
        aria-describedby={position ? tooltipId : undefined}
        tabIndex={focusable ? 0 : -1}
        onMouseEnter={showCard}
        onMouseLeave={() => setPosition(null)}
        onFocus={showCard}
        onBlur={() => setPosition(null)}
      >
        <Image
          src={presentation.image}
          width={size}
          height={size}
          sizes={`${size}px`}
          alt=""
          aria-hidden="true"
        />
      </span>
      {position &&
        createPortal(
          <div
            id={tooltipId}
            className="platform-owner-card"
            role="tooltip"
            style={{ left: position.left, top: position.top }}
          >
            <span className="platform-owner-card-icon">
              <Image
                src={presentation.image}
                width={46}
                height={46}
                sizes="46px"
                alt=""
                aria-hidden="true"
              />
            </span>
            <span>
              <small>{presentation.eyebrow[language]}</small>
              <strong>{label}</strong>
              <span>{description}</span>
            </span>
          </div>,
          document.body,
        )}
    </>
  );
}
