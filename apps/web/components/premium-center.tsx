'use client';

import type { PremiumDashboard } from '@wapve/contracts';
import { Check, Gift, LoaderCircle, Palette, Server, ShieldCheck, ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { WapvePlusBadge } from './wapve-plus-badge';

function sourceLabel(source: PremiumDashboard['membership']['source'], tr: boolean) {
  if (source === 'PUBLIC') return tr ? 'Ücretsiz Wapve+ erişimi' : 'Free Wapve+ access';
  if (source === 'ALPHA') return tr ? 'Öncü üyeliği' : 'Early membership';
  if (source === 'PLATFORM_OWNER') return tr ? 'Platform sahibi' : 'Platform owner';
  if (source === 'OWNER_GRANT') return tr ? 'Wapve ekibi hediyesi' : 'Wapve team grant';
  if (source === 'GIFT') return tr ? 'Arkadaş hediyesi' : 'Friend gift';
  return tr ? 'Etkin değil' : 'Not active';
}

export function PremiumCenter({
  locale,
  onOpenStore,
}: {
  locale: 'tr' | 'en';
  onOpenStore?: () => void;
}) {
  const tr = locale === 'tr';
  const [dashboard, setDashboard] = useState<PremiumDashboard | null>(null);
  const [busy, setBusy] = useState('');
  const [recipient, setRecipient] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      setDashboard(await apiRequest<PremiumDashboard>('/premium/me'));
    } catch {
      setError(tr ? 'Wapve+ bilgileri yüklenemedi.' : 'Wapve+ could not be loaded.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function giftPass(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy('gift');
    setError('');
    setNotice('');
    try {
      await apiRequest('/premium/gifts', {
        method: 'POST',
        body: JSON.stringify({ recipient }),
      });
      setRecipient('');
      await load();
      setNotice(tr ? '7 günlük Wapve+ hediyesi gönderildi.' : 'A 7-day Wapve+ gift was sent.');
    } catch {
      setError(
        tr
          ? 'Hediye gönderilemedi. Kullanıcı adı/ID ve hediye hakkını kontrol et.'
          : 'Gift failed. Check the username/ID and your gift allowance.',
      );
    } finally {
      setBusy('');
    }
  }

  async function support(slot: number, serverId: string) {
    if (!serverId) return;
    setBusy(`support-${slot}`);
    setError('');
    setNotice('');
    try {
      setDashboard(
        await apiRequest<PremiumDashboard>(`/premium/server-supports/${slot}`, {
          method: 'POST',
          body: JSON.stringify({ serverId }),
        }),
      );
      setNotice(tr ? 'Sunucu desteği güncellendi.' : 'Server support updated.');
    } catch {
      setError(
        tr
          ? 'Destek taşınamadı. Yedi günlük bekleme süresi devam ediyor olabilir.'
          : 'Support could not be moved. The seven-day cooldown may still be active.',
      );
    } finally {
      setBusy('');
    }
  }

  if (!dashboard) {
    return (
      <div className="premium-loading" role="status">
        <LoaderCircle className="spin" size={24} />
        <span>{error || (tr ? 'Wapve+ hazırlanıyor…' : 'Preparing Wapve+…')}</span>
        {error && <button onClick={() => void load()}>{tr ? 'Tekrar dene' : 'Try again'}</button>}
      </div>
    );
  }

  const { membership } = dashboard;
  return (
    <div className="premium-center">
      <section className={`premium-hero${membership.active ? ' is-active' : ''}`}>
        <div className="premium-hero-mark">
          <WapvePlusBadge size={52} />
        </div>
        <div>
          <span className="premium-kicker">WAPVE+</span>
          <h3>
            {membership.active
              ? tr
                ? 'Dalgana karakter kat'
                : 'Make your wave yours'
              : tr
                ? 'Wapve+ önizlemesi'
                : 'Wapve+ preview'}
          </h3>
          <p>
            {membership.active
              ? tr
                ? `${sourceLabel(membership.source, tr)} ile tüm koleksiyon ve destek özellikleri açık.`
                : `All collection and support features are open through ${sourceLabel(membership.source, tr).toLowerCase()}.`
              : tr
                ? 'Ödeme sistemi açılmadan önce Wapve+; öncü üyeler, hediyeler ve ekip davetleriyle kullanılabilir.'
                : 'Before payments launch, Wapve+ is available to early members, gifts, and team grants.'}
          </p>
          {membership.expiresAt && (
            <small>
              {tr ? 'Bitiş' : 'Ends'}: {new Date(membership.expiresAt).toLocaleDateString(locale)}
            </small>
          )}
        </div>
        <span className="premium-status">
          <ShieldCheck size={15} />{' '}
          {membership.active ? (tr ? 'AKTİF' : 'ACTIVE') : tr ? 'ÖNİZLEME' : 'PREVIEW'}
        </span>
      </section>

      {(error || notice) && (
        <div className={error ? 'form-error' : 'form-success'} role="status">
          {error || notice}
        </div>
      )}

      <div className="premium-benefits">
        <article>
          <Palette size={20} />
          <strong>{tr ? 'Kişisel görünüm' : 'Personal style'}</strong>
          <span>
            {tr
              ? 'Avatar dekorasyonu, profil çerçevesi ve isim plakası.'
              : 'Avatar decorations, profile frames, and nameplates.'}
          </span>
        </article>
        <article>
          <Gift size={20} />
          <strong>{tr ? 'Arkadaşına hediye' : 'Gift a friend'}</strong>
          <span>
            {tr
              ? 'Her 30 günde üç kişiye 7 günlük Wapve+.'
              : 'Three 7-day Wapve+ gifts every 30 days.'}
          </span>
        </article>
        <article>
          <Server size={20} />
          <strong>{tr ? 'Sunucunu destekle' : 'Support servers'}</strong>
          <span>
            {tr
              ? `${membership.supportSlots} destek yuvasıyla topluluk seviyesine katkı ver.`
              : `Contribute to community levels with ${membership.supportSlots} support slots.`}
          </span>
        </article>
      </div>

      <section
        className="premium-comparison"
        aria-label={tr ? 'Paket karşılaştırması' : 'Plan comparison'}
      >
        <header>
          <span>{tr ? 'KARŞILAŞTIRMA' : 'COMPARISON'}</span>
          <h3>
            {tr
              ? 'Standarttan daha kişisel, topluluklarda daha güçlü.'
              : 'More personal than Standard, stronger in communities.'}
          </h3>
        </header>
        <div className="premium-comparison-grid">
          <div className="comparison-feature">
            <b>{tr ? 'Özellik' : 'Feature'}</b>
            <span>{tr ? 'Profil kimliği' : 'Profile identity'}</span>
            <span>{tr ? 'Kozmetik koleksiyonu' : 'Cosmetic collection'}</span>
            <span>{tr ? 'Woost desteği' : 'Woost supports'}</span>
            <span>{tr ? 'Arkadaş hediyesi' : 'Friend gifts'}</span>
          </div>
          <div>
            <b>{tr ? 'Standart' : 'Standard'}</b>
            <span>{tr ? 'Temel' : 'Basic'}</span>
            <span>—</span>
            <span>—</span>
            <span>—</span>
          </div>
          <div className="plus">
            <b>
              <WapvePlusBadge size={30} /> Wapve+
            </b>
            <span>
              <Check size={15} /> {tr ? 'Rozet + özel görünüm' : 'Badge + custom style'}
            </span>
            <span>
              <Check size={15} />{' '}
              {tr
                ? `${dashboard.catalog.length} özel koleksiyon öğesi`
                : `${dashboard.catalog.length} exclusive collection items`}
            </span>
            <span>
              <Check size={15} /> {tr ? '2 aktif yuva' : '2 active slots'}
            </span>
            <span>
              <Check size={15} /> {tr ? 'Ayda 3 × 7 gün' : '3 × 7 days monthly'}
            </span>
          </div>
        </div>
      </section>

      <section className="premium-section premium-store-teaser">
        <header>
          <div>
            <span className="premium-section-icon">
              <ShoppingBag size={18} />
            </span>
            <div>
              <h3>{tr ? 'Wapve Mağaza' : 'Wapve Store'}</h3>
              <p>
                {tr
                  ? `${dashboard.catalog.length} dekorasyon, çerçeve ve isim plakası şu an ücretsiz.`
                  : `${dashboard.catalog.length} decorations, frames, and nameplates are currently free.`}
              </p>
            </div>
          </div>
        </header>
        <button className="premium-store-teaser-button" onClick={onOpenStore}>
          <ShoppingBag size={18} /> {tr ? 'Mağazaya git' : 'Open store'}
        </button>
      </section>

      <div className="premium-two-column">
        <section className="premium-section premium-gift-card">
          <header>
            <div>
              <span className="premium-section-icon">
                <Gift size={18} />
              </span>
              <div>
                <h3>{tr ? 'Wapve+ hediye et' : 'Gift Wapve+'}</h3>
                <p>
                  {membership.giftPassesRemaining}{' '}
                  {tr ? 'hediye hakkın kaldı' : 'gift passes remaining'}
                </p>
              </div>
            </div>
          </header>
          <form onSubmit={(event) => void giftPass(event)}>
            <input
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder={tr ? 'Kullanıcı adı veya 11 haneli ID' : 'Username or 11-digit ID'}
              minLength={3}
              maxLength={64}
              required
              disabled={!membership.active || membership.source === 'GIFT'}
            />
            <button
              type="submit"
              disabled={
                !membership.active ||
                membership.source === 'GIFT' ||
                membership.giftPassesRemaining < 1 ||
                busy === 'gift'
              }
            >
              {busy === 'gift' ? <LoaderCircle className="spin" size={16} /> : <Gift size={16} />}
              {tr ? '7 gün gönder' : 'Send 7 days'}
            </button>
          </form>
          {dashboard.recentGifts.length > 0 && (
            <div className="premium-gift-history">
              {dashboard.recentGifts.slice(0, 3).map((gift) => (
                <span key={gift.id}>
                  <Check size={13} /> @{gift.recipient.username}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="premium-section premium-support-card">
          <header>
            <div>
              <span className="premium-section-icon">
                <Server size={18} />
              </span>
              <div>
                <h3>{tr ? 'Sunucu destekleri' : 'Server supports'}</h3>
                <p>
                  {tr
                    ? 'Seviyeler 2, 5 ve 10 destekte açılır.'
                    : 'Levels unlock at 2, 5, and 10 supports.'}
                </p>
              </div>
            </div>
          </header>
          {Array.from({ length: membership.supportSlots }, (_, index) => index + 1).map((slot) => {
            const assigned = dashboard.supports.find((supportItem) => supportItem.slot === slot);
            const locked = Boolean(
              assigned && new Date(assigned.cooldownUntil).getTime() > Date.now(),
            );
            return (
              <label className="premium-support-slot" key={slot}>
                <span>
                  <b>
                    {tr ? 'Yuva' : 'Slot'} {slot}
                  </b>
                  {assigned && (
                    <small>
                      {tr
                        ? `Seviye ${assigned.server.supportLevel} · ${assigned.server.supportCount} destek`
                        : `Level ${assigned.server.supportLevel} · ${assigned.server.supportCount} supports`}
                    </small>
                  )}
                </span>
                <select
                  value={assigned?.server.id ?? ''}
                  disabled={!membership.active || locked || busy === `support-${slot}`}
                  onChange={(event) => void support(slot, event.target.value)}
                >
                  <option value="">{tr ? 'Sunucu seç' : 'Choose server'}</option>
                  {dashboard.eligibleServers.map((serverItem) => (
                    <option value={serverItem.id} key={serverItem.id}>
                      {serverItem.name}
                    </option>
                  ))}
                </select>
                {locked && (
                  <small>
                    {tr
                      ? `${new Date(assigned!.cooldownUntil).toLocaleDateString(locale)} tarihine kadar kilitli`
                      : `Locked until ${new Date(assigned!.cooldownUntil).toLocaleDateString(locale)}`}
                  </small>
                )}
              </label>
            );
          })}
        </section>
      </div>
    </div>
  );
}
