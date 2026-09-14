'use client';

import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useId, useRef, useState } from 'react';

export function WapvePlusBadge({ size = 28, label = false, onClick }: { size?: number; label?: boolean; onClick?: () => void }) {
  const trigger = useRef<HTMLElement>(null);
  const tooltipId = useId();
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  function showCard() {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 270;
    const height = 92;
    setPosition({ left: Math.max(10, Math.min(window.innerWidth - width - 10, rect.left + rect.width / 2 - width / 2)), top: rect.top >= height + 18 ? rect.top - height - 10 : rect.bottom + 10 });
  }
  const content = <><span className="wapve-plus-badge-art" style={{ width: size, height: size }} aria-hidden="true"><Image src="/premium/wapve-plus-badge.webp" alt="" width={size} height={size} /></span>{label && <strong>Wapve+</strong>}</>;
  return (
    <>
      {onClick ? <button type="button" ref={(node) => { trigger.current = node; }} className={`wapve-plus-badge${label ? ' with-label' : ''} interactive`} aria-label="Wapve+ üyelik ekranını aç" aria-describedby={position ? tooltipId : undefined} onClick={onClick} onMouseEnter={showCard} onMouseLeave={() => setPosition(null)} onFocus={showCard} onBlur={() => setPosition(null)}>{content}</button> : <span ref={trigger} className={`wapve-plus-badge${label ? ' with-label' : ''}`} title="Wapve+" aria-label="Wapve+" onMouseEnter={showCard} onMouseLeave={() => setPosition(null)} onFocus={showCard} onBlur={() => setPosition(null)} tabIndex={0}>{content}</span>}
      {position && createPortal(<div id={tooltipId} className="platform-owner-card alpha-member-card wapve-plus-tooltip" role="tooltip" style={{ left: position.left, top: position.top }}><span className="alpha-member-card-icon"><Image src="/premium/wapve-plus-badge.webp" width={44} height={44} sizes="44px" alt="" /></span><span><small>WAPVE+ ÜYELİĞİ</small><strong>Wapve+</strong><span>Rozetler, profil kozmetikleri ve topluluk avantajları açık.</span></span></div>, document.body)}
    </>
  );
}
