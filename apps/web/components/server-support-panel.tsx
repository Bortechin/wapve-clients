'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ServerSummary, ServerSupportOverview, ServerWoostUnlockKey } from '@wapve/contracts';
import {
  Check,
  Gauge,
  Info,
  LoaderCircle,
  LockKeyhole,
  SmilePlus,
  Sparkles,
  Tag,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

function WoostIcon({ size = 19, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      className={`woost-icon ${className}`.trim()}
      src="/brand/woost-icon.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
    />
  );
}

const spritePosition: Record<string, string> = {
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
function TagBadgeSprite({ id }: { id: string }) {
  return (
    <i
      className="tag-badge-sprite"
      style={{ backgroundPosition: spritePosition[id] ?? '0% 0%' }}
      aria-hidden="true"
    />
  );
}

export function ServerSupportGoal({
  server,
  onClick,
  disabled = false,
}: {
  server: ServerSummary;
  onClick: () => void;
  disabled?: boolean;
}) {
  const nextCost =
    server.supportLevel === 0
      ? 2
      : server.supportLevel === 1
        ? 5
        : server.supportLevel === 2
          ? 7
          : 1;
  const progress = server.unlimitedWoost
    ? 100
    : Math.min(100, (server.availableWoost / nextCost) * 100);
  return (
    <button
      className={`server-support-goal${disabled ? ' is-disabled' : ''}`}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="server-support-goal-heading">
        <WoostIcon size={18} />
        <strong>Woost Merkezi</strong>
      </span>
      <span className="server-support-goal-count">
        {server.unlimitedWoost ? '∞ Woost' : `${server.availableWoost} kullanılabilir`}
      </span>
      <i>
        <b style={{ width: `${progress}%` }} />
      </i>
    </button>
  );
}

export function ServerSupportOverviewPanel({
  server,
  locale,
  onSupported,
}: {
  server: ServerSummary;
  locale: 'tr' | 'en';
  onSupported?: () => void;
}) {
  const tr = locale === 'tr';
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [unlocking, setUnlocking] = useState<ServerWoostUnlockKey | null>(null);
  const [notice, setNotice] = useState('');
  const [celebrating, setCelebrating] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<
    ServerSupportOverview['levels'][number] | null
  >(null);
  useEffect(() => {
    if (!celebrating) return undefined;
    const timer = window.setTimeout(() => setCelebrating(false), 2200);
    return () => window.clearTimeout(timer);
  }, [celebrating]);
  const overview = useQuery({
    queryKey: ['server-support', server.id],
    queryFn: () => apiRequest<ServerSupportOverview>(`/premium/servers/${server.id}`),
  });
  async function refresh() {
    await Promise.all([
      overview.refetch(),
      queryClient.invalidateQueries({ queryKey: ['servers'] }),
      queryClient.invalidateQueries({ queryKey: ['premium-dashboard'] }),
    ]);
    onSupported?.();
  }
  async function support() {
    setBusy(true);
    setNotice('');
    try {
      await apiRequest(`/premium/servers/${server.id}/support`, { method: 'POST', body: '{}' });
      await refresh();
      setNotice(tr ? 'Yeni Woost kasaya eklendi.' : 'A new Woost was added to the vault.');
      setCelebrating(true);
    } catch {
      setNotice(
        tr
          ? 'Woost verilemedi. Wapve+ ve yuva durumunu kontrol et.'
          : 'Woost failed. Check Wapve+ and your slot status.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function unlock(key: ServerWoostUnlockKey) {
    setUnlocking(key);
    setNotice('');
    try {
      await apiRequest(`/premium/servers/${server.id}/unlocks`, {
        method: 'POST',
        body: JSON.stringify({ key }),
      });
      await refresh();
      setNotice(tr ? 'Avantaj Woost kasasından açıldı.' : 'Perk unlocked from the Woost vault.');
      setSelectedLevel(null);
    } catch {
      setNotice(
        tr
          ? 'Bu avantaj açılamadı. Bakiye ve ön koşulları kontrol et.'
          : 'Could not unlock this perk. Check balance and prerequisites.',
      );
    } finally {
      setUnlocking(null);
    }
  }
  if (overview.isPending || !overview.data)
    return (
      <div className="support-panel-loading">
        <LoaderCircle className="spin" size={22} />{' '}
        {tr ? 'Woost merkezi hazırlanıyor…' : 'Loading Woost hub…'}
      </div>
    );
  const data = overview.data;
  const blockedLabel =
    data.supportDisabledReason === 'WAPVE_PLUS_REQUIRED'
      ? tr
        ? 'Wapve+ üyeliği gerekir'
        : 'Wapve+ membership required'
      : data.supportDisabledReason === 'ALREADY_SUPPORTED'
        ? tr
          ? 'Woost zaten bu sunucuda'
          : 'Already supporting this server'
        : data.supportDisabledReason === 'NO_SUPPORT_SLOT'
          ? tr
            ? 'Boş Woost yuvan yok'
            : 'No Woost slot available'
          : data.supportDisabledReason === 'UNLIMITED_WOOST'
            ? tr
              ? 'Sonsuz Woost etkin'
              : 'Unlimited Woost active'
            : '';
  const date = (value: string) =>
    new Intl.DateTimeFormat(tr ? 'tr-TR' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  const packName = (id: string) =>
    ({
      OCEAN_PULSE: tr ? 'Okyanus Nabzı' : 'Ocean Pulse',
      NIGHT_SKY: tr ? 'Gece Göğü' : 'Night Sky',
      WILD_TRAIL: tr ? 'Vahşi Patika' : 'Wild Trail',
      PRESTIGE: tr ? 'Prestij' : 'Prestige',
    })[id] ?? id;

  return (
    <div className="server-support-panel server-support-workspace woost-hub">
      <main className="support-level-workspace">
        <header className="support-page-intro woost-hub-intro">
          <div>
            <span>WOOST VAULT</span>
            <h2>{tr ? 'Sunucunun rotasını sen aç' : 'Unlock your server’s route'}</h2>
            <p>
              {tr
                ? 'Gelen Woostlar kasada birikir. Yöneticiler seviyeleri ve özel avantajları seçerek açar.'
                : 'Incoming Woosts collect in the vault. Managers choose which levels and perks to unlock.'}
            </p>
          </div>
          <div className="woost-balance-orbit">
            <WoostIcon size={42} />
            <b>{data.unlimited ? '∞' : data.availableCount}</b>
            <span>{tr ? 'kullanılabilir' : 'available'}</span>
          </div>
        </header>
        <div className="woost-ledger-strip">
          <span>
            <b>{data.unlimited ? '∞' : data.currentCount}</b>
            {tr ? 'Toplam' : 'Total'}
          </span>
          <span>
            <b>{data.unlimited ? '—' : data.spentCount}</b>
            {tr ? 'Harcanan' : 'Spent'}
          </span>
          <span>
            <b>{data.unlimited ? '∞' : data.availableCount}</b>
            {tr ? 'Kasada' : 'In vault'}
          </span>
        </div>

        <section className="woost-route-section">
          <header>
            <span>{tr ? 'SEVİYE ROTASI' : 'LEVEL ROUTE'}</span>
            <h3>{tr ? 'Temel kapasiteyi adım adım büyüt' : 'Grow core capacity step by step'}</h3>
          </header>
          <div className="woost-route-cards">
            {data.levels.map((level) => (
              <article className={level.unlocked ? 'unlocked' : ''} key={level.level}>
                <button
                  className="woost-level-card-main"
                  type="button"
                  onClick={() => setSelectedLevel(level)}
                >
                  <header>
                    <span className="woost-route-node">
                      {level.unlocked ? <Check size={15} /> : level.level}
                    </span>
                    <WoostIcon size={30} />
                  </header>
                  <h3>{tr ? `${level.level}. Akıntı` : `Current ${level.level}`}</h3>
                  <ul>
                    <li>
                      <SmilePlus size={16} /> {level.perks.emojiSlots}{' '}
                      {tr ? 'emoji yuvası' : 'emoji slots'}
                    </li>
                    <li>
                      <Gauge size={16} /> {level.perks.voiceBitrateKbps} kbps
                    </li>
                    <li>
                      <Sparkles size={16} />{' '}
                      {level.perks.discoveryPriority
                        ? tr
                          ? 'Keşif önceliği'
                          : 'Discovery priority'
                        : tr
                          ? 'Topluluk görünümü'
                          : 'Community appearance'}
                    </li>
                  </ul>
                </button>
                <footer>
                  <b>{level.cost} Woost</b>
                  {level.unlocked ? (
                    <span>
                      <Check size={14} />
                      {tr ? 'Açık' : 'Active'}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!level.canUnlock || unlocking !== null}
                      onClick={() => void unlock(level.unlockKey)}
                    >
                      {unlocking === level.unlockKey ? (
                        <LoaderCircle className="spin" size={14} />
                      ) : (
                        <Unlock size={14} />
                      )}
                      {tr ? 'Aç' : 'Unlock'}
                    </button>
                  )}
                </footer>
              </article>
            ))}
          </div>
        </section>

        <section className="support-extra-section woost-choice-section">
          <header>
            <div>
              <span>{tr ? 'ÖZEL SEÇİMLER' : 'SPECIAL CHOICES'}</span>
              <h2>{tr ? 'Topluluğuna karakter kat' : 'Give your community character'}</h2>
            </div>
          </header>
          <div>
            {data.extras.map((extra) => (
              <article key={extra.key} className={extra.unlocked ? 'unlocked' : ''}>
                {extra.key === 'SERVER_TAG' ? <Tag size={23} /> : <Sparkles size={23} />}
                <div>
                  <b>
                    {extra.key === 'SERVER_TAG'
                      ? tr
                        ? 'Sunucu Etiketi'
                        : 'Server Tag'
                      : tr
                        ? 'Gelişmiş Keşif'
                        : 'Enhanced Discovery'}
                  </b>
                  <p>
                    {extra.key === 'SERVER_TAG'
                      ? tr
                        ? 'Üyelerin profilinde görünen kısa sunucu kimliği.'
                        : 'A compact identity on member profiles.'
                      : tr
                        ? 'Keşif kartına ve görünürlüğe özel yükseltme.'
                        : 'An upgrade for discovery visibility.'}
                  </p>
                </div>
                {extra.unlocked ? (
                  <span>
                    <Check size={15} />
                    {tr ? 'Açık' : 'Active'}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={!extra.canUnlock || unlocking !== null}
                    onClick={() => void unlock(extra.key)}
                  >
                    {extra.cost} Woost
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="woost-tag-packs">
          <header>
            <span>{tr ? 'ETİKET ROZETLERİ' : 'TAG BADGES'}</span>
            <h2>{tr ? 'Wapve’ye özel rozet paketleri' : 'Badge packs made for Wapve'}</h2>
            <p>
              {tr
                ? 'Önce Sunucu Etiketini aç; ardından istediğin paketi kasadan seç.'
                : 'Unlock Server Tag first, then choose a pack from the vault.'}
            </p>
          </header>
          <div>
            {data.tagPacks.map((pack) => (
              <article className={pack.unlocked ? 'unlocked' : ''} key={pack.id}>
                <div className="woost-pack-icons">
                  {pack.badgeIds.map((badge) => (
                    <TagBadgeSprite id={badge} key={badge} />
                  ))}
                </div>
                <h3>{packName(pack.id)}</h3>
                <footer>
                  {pack.unlocked ? (
                    <span>
                      <Check size={14} />
                      {tr ? 'Kullanıma açık' : 'Available'}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!pack.canUnlock || unlocking !== null}
                      onClick={() => void unlock(pack.unlockKey)}
                    >
                      {pack.canUnlock ? <Unlock size={14} /> : <LockKeyhole size={14} />}
                      {pack.cost} Woost
                    </button>
                  )}
                </footer>
              </article>
            ))}
          </div>
        </section>
      </main>

      <aside className="support-summary-sidebar woost-ledger-sidebar">
        <header>
          <div className="support-server-avatar">
            {server.iconUrl ? (
              <img src={server.iconUrl} alt="" />
            ) : (
              server.name.slice(0, 1).toUpperCase()
            )}
            <WoostIcon size={20} />
          </div>
          <div>
            <span>{tr ? 'WOOST DEFTERİ' : 'WOOST LEDGER'}</span>
            <h3>{server.name}</h3>
            <p>
              {data.unlimited
                ? tr
                  ? 'Resmî sunucu · Sonsuz akış'
                  : 'Official server · Infinite flow'
                : tr
                  ? `${data.supporters.filter((item) => item.active).length} aktif destekçi`
                  : `${data.supporters.filter((item) => item.active).length} active supporters`}
            </p>
          </div>
        </header>
        {notice && (
          <p className="support-panel-notice" role="status">
            {notice}
          </p>
        )}
        <button
          className={`support-primary-button${busy ? ' is-boosting' : ''}${celebrating ? ' is-complete' : ''}`}
          type="button"
          aria-busy={busy}
          disabled={busy || !data.canSupport}
          onClick={() => void support()}
        >
          <span className="support-button-icon">
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : celebrating ? (
              <Check size={18} />
            ) : (
              <WoostIcon size={25} />
            )}
          </span>
          <span>
            {busy
              ? tr
                ? 'Woost aktarılıyor…'
                : 'Sending Woost…'
              : celebrating
                ? tr
                  ? 'Kasaya eklendi'
                  : 'Added to vault'
                : data.canSupport
                  ? tr
                    ? 'Bu sunucuya Woost ver'
                    : 'Woost this server'
                  : blockedLabel}
          </span>
        </button>
        <section className="woost-supporters">
          <header>
            <Users size={17} />
            <b>{tr ? 'Destekçiler' : 'Supporters'}</b>
            <span>{data.supporters.length}</span>
          </header>
          {data.supporters.length ? (
            <div>
              {data.supporters.map((supporter, index) => (
                <article
                  className={supporter.active ? '' : 'expired'}
                  key={`${supporter.id}-${supporter.slot}-${index}`}
                >
                  <span className="woost-supporter-avatar">
                    {supporter.avatarUrl ? (
                      <img src={supporter.avatarUrl} alt="" />
                    ) : (
                      supporter.displayName.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <div>
                    <b>{supporter.displayName}</b>
                    <small>
                      {tr
                        ? `Verildi: ${date(supporter.assignedAt)}`
                        : `Assigned: ${date(supporter.assignedAt)}`}
                    </small>
                    <small>
                      {supporter.expiresAt
                        ? tr
                          ? `Bitiş: ${date(supporter.expiresAt)}`
                          : `Ends: ${date(supporter.expiresAt)}`
                        : tr
                          ? 'Süresiz yuva'
                          : 'No expiry'}
                    </small>
                  </div>
                  <i className={supporter.active ? 'active' : ''} />
                </article>
              ))}
            </div>
          ) : (
            <p>{tr ? 'Henüz kullanıcı Woost’u yok.' : 'No member Woosts yet.'}</p>
          )}
        </section>
        <div className="support-how-card">
          <Info size={22} />
          <div>
            <b>{tr ? 'Kontrol sende' : 'You’re in control'}</b>
            <p>
              {tr
                ? 'Woost kasada bekler; yalnızca sunucu sahibi veya Sunucuyu Yönet izni olan kişiler harcayabilir.'
                : 'Woost stays in the vault; only the owner or members with Manage Server can spend it.'}
            </p>
          </div>
        </div>
      </aside>

      <Dialog.Root
        open={Boolean(selectedLevel)}
        onOpenChange={(open) => !open && setSelectedLevel(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay woost-level-overlay" />
          {selectedLevel && (
            <Dialog.Content className="woost-level-dialog">
              <Dialog.Close className="woost-level-close" aria-label={tr ? 'Kapat' : 'Close'}>
                <X size={20} />
              </Dialog.Close>
              <WoostIcon size={104} />
              <Dialog.Title>
                {tr ? `${selectedLevel.level}. Akıntı` : `Current ${selectedLevel.level}`}
              </Dialog.Title>
              <Dialog.Description>{selectedLevel.cost} Woost</Dialog.Description>
              <div className="woost-level-perks">
                <span>
                  <SmilePlus size={18} /> {selectedLevel.perks.emojiSlots}{' '}
                  {tr ? 'emoji yuvası' : 'emoji slots'}
                </span>
                <span>
                  <Gauge size={18} /> {selectedLevel.perks.voiceBitrateKbps} kbps
                </span>
                <span>
                  <Sparkles size={18} />{' '}
                  {selectedLevel.perks.discoveryPriority
                    ? tr
                      ? 'Keşif önceliği'
                      : 'Discovery priority'
                    : tr
                      ? 'Gelişmiş görünüm'
                      : 'Enhanced appearance'}
                </span>
              </div>
              {selectedLevel.unlocked ? (
                <button className="woost-level-state" type="button" disabled>
                  {tr ? 'Etkin' : 'Active'}
                </button>
              ) : (
                <button
                  className="woost-level-state unlock"
                  type="button"
                  disabled={!selectedLevel.canUnlock || unlocking !== null}
                  onClick={() => void unlock(selectedLevel.unlockKey)}
                >
                  {unlocking === selectedLevel.unlockKey ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Unlock size={17} />
                  )}
                  {tr ? 'Kasadan aç' : 'Unlock from vault'}
                </button>
              )}
            </Dialog.Content>
          )}
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
