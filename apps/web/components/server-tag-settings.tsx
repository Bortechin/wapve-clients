'use client';

import type { ServerSummary, ServerTagBadge } from '@wapve/contracts';
import { Check, Compass, LoaderCircle, LockKeyhole, Shield, Star, Waves } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { ServerTagChip } from './server-tag-chip';

const badges: Array<{
  id: ServerTagBadge;
  pack?: 'OCEAN_PULSE' | 'NIGHT_SKY' | 'WILD_TRAIL' | 'PRESTIGE';
  position?: string;
  icon?: typeof Waves;
}> = [
  { id: 'WAVE', icon: Waves },
  { id: 'COMPASS', icon: Compass },
  { id: 'STAR', icon: Star },
  { id: 'SHIELD', icon: Shield },
  ...(['OCEAN_WAVE', 'OCEAN_SHELL', 'OCEAN_COMPASS', 'OCEAN_CORAL'] as const).map((id, index) => ({
    id,
    pack: 'OCEAN_PULSE' as const,
    position: `${index * 33.333}% 0%`,
  })),
  ...(['NIGHT_MOON', 'NIGHT_STAR', 'NIGHT_COMET', 'NIGHT_AURORA'] as const).map((id, index) => ({
    id,
    pack: 'NIGHT_SKY' as const,
    position: `${index * 33.333}% 33.333%`,
  })),
  ...(['WILD_FOX', 'WILD_OWL', 'WILD_MOUNTAIN', 'WILD_SPROUT'] as const).map((id, index) => ({
    id,
    pack: 'WILD_TRAIL' as const,
    position: `${index * 33.333}% 66.666%`,
  })),
  ...(['PRESTIGE_GEM', 'PRESTIGE_CROWN', 'PRESTIGE_FLAME', 'PRESTIGE_INFINITY'] as const).map(
    (id, index) => ({ id, pack: 'PRESTIGE' as const, position: `${index * 33.333}% 100%` }),
  ),
];

export function ServerTagSettings({
  server,
  locale,
  canManage,
  onUpdated,
}: {
  server: ServerSummary;
  locale: 'tr' | 'en';
  canManage: boolean;
  onUpdated: (server: ServerSummary, notice?: string) => void;
}) {
  const tr = locale === 'tr';
  const [code, setCode] = useState(server.tag?.code ?? '');
  const [badge, setBadge] = useState<ServerTagBadge>(server.tag?.badge ?? 'WAVE');
  const [color, setColor] = useState(server.tag?.color ?? '#38bdf8');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setCode(server.tag?.code ?? '');
    setBadge(server.tag?.badge ?? 'WAVE');
    setColor(server.tag?.color ?? '#38bdf8');
  }, [server.id, server.tag?.badge, server.tag?.code, server.tag?.color]);
  async function save() {
    setBusy(true);
    setError('');
    try {
      const updated = await apiRequest<ServerSummary>(`/servers/${server.id}/tag`, {
        method: 'PATCH',
        body: JSON.stringify({ code, badge, color }),
      });
      onUpdated(
        updated,
        tr
          ? 'Sunucu etiketi kaydedildi. Üyeler etiketi yeniden seçebilir.'
          : 'Server tag saved. Members can select it again.',
      );
    } catch {
      setError(
        tr
          ? 'Etiket kaydedilemedi. 1–4 harf/rakam kullan.'
          : 'Could not save the tag. Use 1–4 letters or numbers.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function select(enabled: boolean) {
    setBusy(true);
    setError('');
    try {
      const updated = await apiRequest<ServerSummary>(`/servers/${server.id}/tag/me`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
      onUpdated(
        updated,
        enabled
          ? tr
            ? 'Sunucu etiketi profiline eklendi.'
            : 'Server tag added to your profile.'
          : tr
            ? 'Sunucu etiketi profilinden kaldırıldı.'
            : 'Server tag removed from your profile.',
      );
    } catch {
      setError(tr ? 'Etiket seçimi güncellenemedi.' : 'Could not update tag selection.');
    } finally {
      setBusy(false);
    }
  }
  if (!server.tagUnlocked)
    return (
      <section className="server-tag-settings locked">
        <Waves size={42} />
        <h3>{tr ? 'Sunucu Etiketi' : 'Server Tag'}</h3>
        <p>
          {tr
            ? 'Woost Merkezi’nden bu özelliği aç. Etiket, üyelerin adının yanında Wapve’nin her yerinde görünür.'
            : 'Unlock this from the Woost Hub. The tag appears beside members across Wapve.'}
        </p>
        <strong>
          {server.availableWoost} {tr ? 'kullanılabilir Woost' : 'Woost available'}
        </strong>
      </section>
    );
  const preview = {
    serverId: server.id,
    serverName: server.name,
    code: code || 'WAVE',
    badge,
    color,
  };
  return (
    <section className="server-tag-settings">
      <header>
        <div>
          <span>WAPVE SERVER TAG</span>
          <h3>{tr ? 'Sunucu Etiketi' : 'Server Tag'}</h3>
          <p>
            {tr
              ? 'En fazla 4 karakterlik kimliğini, rozetini ve rengini belirle.'
              : 'Choose an identity up to 4 characters, a badge, and a color.'}
          </p>
        </div>
        <ServerTagChip tag={preview} />
      </header>
      {canManage && (
        <div className="server-tag-editor">
          <label>
            <span>{tr ? 'Etiket' : 'Tag'}</span>
            <input
              value={code}
              maxLength={4}
              placeholder="WAVE"
              onChange={(event) => setCode(event.target.value.toLocaleUpperCase(locale))}
            />
          </label>
          <label>
            <span>{tr ? 'Renk' : 'Color'}</span>
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
          </label>
          <div
            className="server-tag-badges"
            role="radiogroup"
            aria-label={tr ? 'Rozet biçimi' : 'Badge style'}
          >
            {badges.map(({ id, icon: Icon, pack, position }) => {
              const locked = Boolean(pack && !server.tagBadgePacks.includes(pack));
              return (
                <button
                  key={id}
                  type="button"
                  className={`${badge === id ? 'active ' : ''}${locked ? 'locked' : ''}`.trim()}
                  disabled={locked}
                  onClick={() => setBadge(id)}
                  aria-pressed={badge === id}
                  title={locked ? (tr ? `${pack} paketi kilitli` : `${pack} pack is locked`) : id}
                >
                  {Icon ? (
                    <Icon size={22} />
                  ) : (
                    <i
                      className="server-tag-generated-icon"
                      style={{ width: 30, height: 30, backgroundPosition: position }}
                    />
                  )}
                  {locked && <LockKeyhole className="server-tag-badge-lock" size={13} />}
                  <span>{id.replace(/^[A-Z]+_/u, '')}</span>
                </button>
              );
            })}
          </div>
          <button
            className="server-tag-save"
            type="button"
            disabled={busy || !code.trim()}
            onClick={() => void save()}
          >
            {busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
            {tr ? 'Etiketi kaydet' : 'Save tag'}
          </button>
        </div>
      )}
      {server.tag && (
        <div className="server-tag-member-choice">
          <div>
            <strong>{tr ? 'Profilinde göster' : 'Show on your profile'}</strong>
            <span>
              {tr
                ? 'Seçtiğinde bu etiket mesajlarında ve profilinde görünür.'
                : 'When selected, this tag appears in your messages and profile.'}
            </span>
          </div>
          <button
            type="button"
            disabled={busy}
            className={server.tagSelectedByMe ? 'active' : ''}
            onClick={() => void select(!server.tagSelectedByMe)}
          >
            {server.tagSelectedByMe
              ? tr
                ? 'Kullanımda'
                : 'Selected'
              : tr
                ? 'Etiketi kullan'
                : 'Use tag'}
          </button>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
