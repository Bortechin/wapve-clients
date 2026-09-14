'use client';

import { useQuery } from '@tanstack/react-query';
import type { ServerSummary, ServerTag, ServerTagPreview } from '@wapve/contracts';
import { Compass, LoaderCircle, Shield, Star, Waves } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest } from '@/lib/api';

type TagAnchor = { left: number; right: number; top: number; bottom: number };

function TagIcon({ tag, size }: { tag: ServerTag; size: number }) {
  const spritePosition: Partial<Record<ServerTag['badge'], string>> = {
    OCEAN_WAVE: '0% 0%',
    OCEAN_SHELL: '33.333% 0%',
    OCEAN_COMPASS: '66.666% 0%',
    OCEAN_CORAL: '100% 0%',
    NIGHT_MOON: '0% 33.333%',
    NIGHT_STAR: '33.333% 33.333%',
    NIGHT_COMET: '66.666% 33.333%',
    NIGHT_AURORA: '100% 33.333%',
    WILD_FOX: '0% 66.666%',
    WILD_OWL: '33.333% 66.666%',
    WILD_MOUNTAIN: '66.666% 66.666%',
    WILD_SPROUT: '100% 66.666%',
    PRESTIGE_GEM: '0% 100%',
    PRESTIGE_CROWN: '33.333% 100%',
    PRESTIGE_FLAME: '66.666% 100%',
    PRESTIGE_INFINITY: '100% 100%',
  };
  if (spritePosition[tag.badge]) {
    return (
      <i
        className="server-tag-generated-icon"
        style={{ width: size, height: size, backgroundPosition: spritePosition[tag.badge] }}
        aria-hidden="true"
      />
    );
  }
  const Icon =
    tag.badge === 'COMPASS'
      ? Compass
      : tag.badge === 'STAR'
        ? Star
        : tag.badge === 'SHIELD'
          ? Shield
          : Waves;
  return <Icon size={size} strokeWidth={2.6} />;
}

export function ServerTagChip({
  tag,
  compact = false,
  interactive = true,
}: {
  tag: ServerTag;
  compact?: boolean;
  interactive?: boolean;
}) {
  const [anchor, setAnchor] = useState<TagAnchor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const tr = typeof document === 'undefined' || document.documentElement.lang !== 'en';
  const preview = useQuery({
    queryKey: ['server-tag-preview', tag.serverId],
    queryFn: () => apiRequest<ServerTagPreview>(`/servers/tags/${tag.serverId}/preview`),
    enabled: interactive && Boolean(anchor),
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!anchor) return undefined;
    const close = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setAnchor(null);
    };
    const closeOnKey = (event: KeyboardEvent) => event.key === 'Escape' && setAnchor(null);
    const closeOnViewportChange = () => setAnchor(null);
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', closeOnKey);
    window.addEventListener('resize', closeOnViewportChange);
    window.addEventListener('scroll', closeOnViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', closeOnKey);
      window.removeEventListener('resize', closeOnViewportChange);
      window.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, [anchor]);

  const openServer = (server?: ServerSummary) => {
    window.dispatchEvent(
      new CustomEvent('wapve:open-server', {
        detail: server ? { server } : { serverId: tag.serverId },
      }),
    );
    setAnchor(null);
  };

  const joinOrOpen = async () => {
    if (!preview.data) return;
    if (preview.data.alreadyMember) {
      openServer();
      return;
    }
    setBusy(true);
    setError('');
    try {
      openServer(
        await apiRequest<ServerSummary>(`/servers/tags/${tag.serverId}/join`, {
          method: 'POST',
          body: '{}',
        }),
      );
    } catch {
      setError(tr ? 'Sunucuya katılınamadı.' : 'Could not join the server.');
    } finally {
      setBusy(false);
    }
  };

  const width = typeof window === 'undefined' ? 296 : Math.min(296, window.innerWidth - 20);
  const left = anchor
    ? Math.max(
        10,
        Math.min(
          window.innerWidth - width - 10,
          anchor.left + (anchor.right - anchor.left) / 2 - width / 2,
        ),
      )
    : 0;
  const top = anchor
    ? anchor.bottom + 326 < window.innerHeight
      ? anchor.bottom + 8
      : Math.max(10, anchor.top - 318)
    : 0;

  const chipContents = (
    <>
      <TagIcon tag={tag} size={compact ? 14 : 16} />
      <b>{tag.code}</b>
    </>
  );

  return (
    <>
      {interactive ? (
        <button
          type="button"
          className={`server-tag-chip${compact ? ' compact' : ''}`}
          style={{ '--server-tag-color': tag.color } as React.CSSProperties}
          aria-label={`${tag.serverName}: ${tag.code}`}
          aria-expanded={Boolean(anchor)}
          onClick={(event) => {
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            setError('');
            setAnchor((current) =>
              current
                ? null
                : { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
            );
          }}
        >
          {chipContents}
        </button>
      ) : (
        <span
          className={`server-tag-chip is-static${compact ? ' compact' : ''}`}
          style={{ '--server-tag-color': tag.color } as React.CSSProperties}
          aria-label={`${tag.serverName}: ${tag.code}`}
        >
          {chipContents}
        </span>
      )}
      {interactive &&
        anchor &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            className="server-tag-invite-popover"
            role="dialog"
            aria-label={tr ? `${tag.serverName} sunucu daveti` : `${tag.serverName} server invite`}
            style={{ left, top, width, '--server-tag-color': tag.color } as React.CSSProperties}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {preview.isPending ? (
              <div className="server-tag-invite-loading">
                <LoaderCircle className="spin" size={22} />
                {tr ? 'Sunucu hazırlanıyor…' : 'Loading server…'}
              </div>
            ) : preview.data ? (
              <>
                <div className="server-tag-invite-banner">
                  {preview.data.bannerUrl && <img src={preview.data.bannerUrl} alt="" />}
                  <span className="server-tag-invite-mark">
                    <TagIcon tag={tag} size={16} />
                    <b>{tag.code}</b>
                  </span>
                </div>
                <div className="server-tag-invite-body">
                  <div className="server-tag-invite-title">
                    <span>
                      {preview.data.iconUrl ? (
                        <img src={preview.data.iconUrl} alt="" />
                      ) : (
                        preview.data.name.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <div>
                      <b>{preview.data.name}</b>
                      <small>
                        {tr ? 'Sunucu etiketi' : 'Server tag'} · {tag.code}
                      </small>
                    </div>
                  </div>
                  <div className="server-tag-invite-counts">
                    <span>
                      <i className="online" />
                      {preview.data.onlineCount} {tr ? 'Çevrimiçi' : 'Online'}
                    </span>
                    <span>
                      <i />
                      {preview.data.memberCount} {tr ? 'Üye' : 'Members'}
                    </span>
                  </div>
                  {preview.data.description && <p>{preview.data.description}</p>}
                  <small>
                    {tr ? 'Kuruluş' : 'Created'}:{' '}
                    {new Intl.DateTimeFormat(tr ? 'tr-TR' : 'en-US', {
                      month: 'short',
                      year: 'numeric',
                    }).format(new Date(preview.data.createdAt))}
                  </small>
                  {error && <em role="alert">{error}</em>}
                  <button type="button" disabled={busy} onClick={() => void joinOrOpen()}>
                    {busy ? <LoaderCircle className="spin" size={17} /> : null}
                    {preview.data.alreadyMember
                      ? tr
                        ? 'Sunucuya git'
                        : 'Go to server'
                      : tr
                        ? 'Sunucuya katıl'
                        : 'Join server'}
                  </button>
                </div>
              </>
            ) : (
              <div className="server-tag-invite-loading">
                {tr
                  ? 'Bu sunucu daveti artık kullanılamıyor.'
                  : 'This server invite is no longer available.'}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
