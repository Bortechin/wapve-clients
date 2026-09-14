'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type {
  PremiumCosmeticItem,
  PremiumCosmeticBundle,
  PremiumCosmeticStoreCategory,
  PremiumCosmeticType,
  PremiumDashboard,
  UserProfile,
} from '@wapve/contracts';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Crown,
  Frame,
  Layers3,
  LoaderCircle,
  Package,
  Search,
  Shapes,
  ShoppingBag,
  Sparkles,
  Tag,
  WandSparkles,
  Waves,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { apiRequest } from '@/lib/api';
import { PremiumCosmeticPreview } from './premium-cosmetic-preview';
import styles from './premium-store.module.css';

export type StoreCategory = 'featured' | 'all' | PremiumCosmeticStoreCategory | 'bundles' | 'owned';
const fieldByType: Record<PremiumCosmeticType, keyof PremiumDashboard['equipped']> = {
  AVATAR_DECORATION: 'avatarDecorationId',
  PROFILE_EFFECT: 'profileEffectId',
  NAMEPLATE: 'nameplateId',
};
function accent(item: { accent: string }): CSSProperties {
  return { '--store-accent': item.accent } as CSSProperties;
}
function typeLabel(category: PremiumCosmeticStoreCategory, tr: boolean) {
  if (category === 'AVATAR_DECORATION') return tr ? 'Avatar dekorasyonu' : 'Avatar decoration';
  if (category === 'PROFILE_EFFECT') return tr ? 'Profil efekti' : 'Profile effect';
  if (category === 'PROFILE_FRAME') return tr ? 'Profil çerçevesi' : 'Profile frame';
  return tr ? 'İsim plakası' : 'Nameplate';
}
function rarityLabel(rarity: PremiumCosmeticItem['rarity'], tr: boolean) {
  if (rarity === 'LEGENDARY') return tr ? 'Efsanevi' : 'Legendary';
  if (rarity === 'RARE') return tr ? 'Nadir' : 'Rare';
  return tr ? 'Standart' : 'Standard';
}
function Artwork({
  item,
  user,
  expanded = false,
}: {
  item: PremiumCosmeticItem;
  user: UserProfile;
  expanded?: boolean;
}) {
  return (
    <div className={`${styles.artwork} ${expanded ? styles.expanded : ''}`} style={accent(item)}>
      <PremiumCosmeticPreview user={user} item={item} />
    </div>
  );
}

export function PremiumStore({
  locale,
  user,
  onUser,
  onOpenPremium,
  initialCategory = 'featured',
}: {
  locale: 'tr' | 'en';
  user: UserProfile;
  onUser: (user: UserProfile) => void;
  onOpenPremium: () => void;
  initialCategory?: StoreCategory;
}) {
  const tr = locale === 'tr';
  const [dashboard, setDashboard] = useState<PremiumDashboard | null>(null);
  const [category, setCategory] = useState<StoreCategory>(initialCategory);
  const [query, setQuery] = useState('');
  const [collection, setCollection] = useState('');
  const [sort, setSort] = useState('default');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const resultsRef = useRef<HTMLElement>(null);
  const itemTriggerRef = useRef<HTMLElement | null>(null);
  const load = useCallback(async () => {
    setError('');
    try {
      setDashboard(await apiRequest<PremiumDashboard>('/premium/me'));
    } catch {
      setError(tr ? 'Mağaza şu anda yüklenemiyor.' : 'The store is unavailable right now.');
    }
  }, [tr]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setCategory(initialCategory);
    setCollection('');
    setQuery('');
  }, [initialCategory]);

  const catalog = useMemo(() => dashboard?.catalog ?? [], [dashboard]);
  const bundles = dashboard?.bundles ?? [];
  const collections = [...new Set(catalog.map((item) => item.collection))];
  const spotlight = catalog.at(-1);
  const companion = [...catalog]
    .reverse()
    .find((item) => item.type === 'AVATAR_DECORATION' && item.collection !== spotlight?.collection);
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const matches = (item: { name: string; description: string; collection: string }) =>
    (!collection || item.collection === collection) &&
    `${item.name} ${item.description} ${item.collection}`
      .toLocaleLowerCase(locale)
      .includes(normalizedQuery);
  const visible = catalog
    .filter((item) => {
      if (category === 'bundles') return false;
      if (category === 'owned' && !item.owned) return false;
      if (!['all', 'featured', 'owned'].includes(category) && item.storeCategory !== category)
        return false;
      if (
        category === 'featured' &&
        !normalizedQuery &&
        !collection &&
        !catalog.slice(-6).includes(item)
      )
        return false;
      return matches(item);
    })
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name, locale)
        : sort === 'owned'
          ? Number(b.owned) - Number(a.owned)
          : 0,
    );
  const visibleBundles = bundles
    .filter(matches)
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name, locale)
        : sort === 'owned'
          ? b.ownedCount - a.ownedCount
          : 0,
    );
  const selected = catalog.find((item) => item.id === selectedId);
  const ownedCount = catalog.filter((item) => item.owned).length;
  const categories = [
    { id: 'featured', label: tr ? 'Keşfet' : 'Discover', icon: Sparkles },
    { id: 'all', label: tr ? 'Tüm ürünler' : 'All items', icon: Shapes },
    {
      id: 'AVATAR_DECORATION',
      label: tr ? 'Avatar dekorasyonları' : 'Avatar decorations',
      icon: Crown,
    },
    {
      id: 'PROFILE_EFFECT',
      label: tr ? 'Profil efektleri' : 'Profile effects',
      icon: WandSparkles,
    },
    { id: 'PROFILE_FRAME', label: tr ? 'Profil çerçeveleri' : 'Profile frames', icon: Frame },
    { id: 'NAMEPLATE', label: tr ? 'İsim plakaları' : 'Nameplates', icon: Tag },
    { id: 'bundles', label: tr ? 'Paketler' : 'Bundles', icon: Package },
    { id: 'owned', label: tr ? 'Koleksiyonum' : 'My collection', icon: Layers3 },
  ] satisfies Array<{ id: StoreCategory; label: string; icon: typeof Sparkles }>;
  function switchCategory(next: StoreCategory) {
    setCategory(next);
    setCollection('');
    setQuery('');
  }
  function exploreCollection(name: string) {
    setCategory('all');
    setQuery('');
    setCollection(name);
    requestAnimationFrame(() =>
      resultsRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }),
    );
  }
  function openItem(id: string) {
    itemTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setError('');
    setNotice('');
    setSelectedId(id);
  }
  function openPremium() {
    setSelectedId(null);
    onOpenPremium();
  }
  async function mutate(
    id: string,
    action: () => Promise<PremiumDashboard>,
    message: string,
    refreshUser = false,
  ) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(id);
    setError('');
    setNotice('');
    try {
      const next = await action();
      if (refreshUser) onUser(await apiRequest<UserProfile>('/users/me'));
      setDashboard(next);
      setNotice(message);
    } catch {
      setError(
        tr
          ? 'İşlem tamamlanamadı. Tekrar deneyebilirsin.'
          : 'Could not complete this action. Please try again.',
      );
    } finally {
      busyRef.current = false;
      setBusy('');
    }
  }
  function equip(item: PremiumCosmeticItem, remove = false) {
    void mutate(
      item.id,
      () =>
        apiRequest('/premium/equipped', {
          method: 'PATCH',
          body: JSON.stringify({ [fieldByType[item.type]]: remove ? null : item.id }),
        }),
      remove
        ? tr
          ? 'Görünüm kaldırıldı.'
          : 'Appearance removed.'
        : tr
          ? `${item.name} kullanılıyor.`
          : `${item.name} is equipped.`,
      true,
    );
  }
  function primaryAction(item: PremiumCosmeticItem) {
    if (!dashboard?.membership.active) return openPremium();
    if (item.owned) return equip(item);
    if (!item.claimable) return;
    void mutate(
      item.id,
      () => apiRequest(`/premium/cosmetics/${item.id}/claim`, { method: 'POST' }),
      tr ? `${item.name} koleksiyonuna eklendi.` : `${item.name} was added to your collection.`,
    );
  }
  function claimBundle(bundle: PremiumCosmeticBundle) {
    if (!dashboard?.membership.active) return openPremium();
    if (!bundle.claimable) return;
    void mutate(
      bundle.id,
      () => apiRequest(`/premium/bundles/${bundle.id}/claim`, { method: 'POST' }),
      tr ? `${bundle.name} koleksiyonuna eklendi.` : `${bundle.name} was added to your collection.`,
    );
  }
  const actionLabel = (item: PremiumCosmeticItem) =>
    item.equipped
      ? tr
        ? 'Kullanımda'
        : 'Equipped'
      : !dashboard?.membership.active
        ? tr
          ? 'Wapve+ ile aç'
          : 'Unlock with Wapve+'
        : item.owned
          ? tr
            ? 'Profilimde kullan'
            : 'Equip on my profile'
          : item.claimable
            ? tr
              ? 'Koleksiyona ekle'
              : 'Add to collection'
            : tr
              ? 'Şu anda kullanılamıyor'
              : 'Currently unavailable';
  const feedback = (error || notice) && (
    <div
      className={`${styles.feedback} ${error ? styles.error : ''}`}
      role={error ? 'alert' : 'status'}
    >
      {error || notice}
    </div>
  );

  if (!dashboard)
    return (
      <div className={styles.loading} role="status">
        {!error && <LoaderCircle className="spin" size={28} />}
        <strong>{error || (tr ? 'Mağaza hazırlanıyor…' : 'Preparing the store…')}</strong>
        {error && (
          <button className={styles.secondary} onClick={() => void load()}>
            {tr ? 'Tekrar dene' : 'Try again'}
          </button>
        )}
      </div>
    );

  return (
    <div className={styles.store}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span>
            <ShoppingBag size={22} />
          </span>
          <div>
            <small>WAPVE / {tr ? 'KENDİ DALGAN' : 'YOUR OWN WAVE'}</small>
            <h1>{tr ? 'Mağaza' : 'Store'}</h1>
          </div>
        </div>
        <label className={styles.search}>
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr ? 'Yeni görünümünü bul' : 'Find your next look'}
            aria-label={tr ? 'Mağazada ara' : 'Search the store'}
          />
          {query && (
            <button
              aria-label={tr ? 'Aramayı temizle' : 'Clear search'}
              onClick={() => setQuery('')}
            >
              <X size={16} />
            </button>
          )}
        </label>
        <button className={styles.collectionLink} onClick={() => switchCategory('owned')}>
          <Layers3 size={17} />
          <span>{tr ? 'Koleksiyonum' : 'My collection'}</span>
          <b>{ownedCount}</b>
        </button>
      </header>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <small className={styles.eyebrow}>{tr ? 'GÖRÜNÜMÜNÜ KEŞFET' : 'EXPLORE YOUR LOOK'}</small>
          <nav
            className={styles.categories}
            aria-label={tr ? 'Mağaza kategorileri' : 'Store categories'}
          >
            {categories.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                aria-current={category === id ? 'page' : undefined}
                onClick={() => switchCategory(id)}
              >
                <Icon size={18} />
                <span>{label}</span>
                {id !== 'featured' && (
                  <small>
                    {id === 'all'
                      ? catalog.length
                      : id === 'owned'
                        ? ownedCount
                        : id === 'bundles'
                          ? bundles.length
                          : catalog.filter((item) => item.storeCategory === id).length}
                  </small>
                )}
              </button>
            ))}
          </nav>
          <div className={styles.membership}>
            <Waves size={24} />
            <strong>{tr ? 'Biraz daha sen.' : 'A little more you.'}</strong>
            <p>
              {tr
                ? 'Dekorasyonlar, efektler ve sana ait bir görünüm.'
                : 'Decorations, effects, and a look that feels like you.'}
            </p>
            <button onClick={openPremium}>
              Wapve+ <ArrowRight size={16} />
            </button>
          </div>
        </aside>
        <div className={styles.main}>
          {category === 'featured' && !normalizedQuery && !collection && spotlight && (
            <div className={styles.showcase}>
              <section className={styles.hero} style={accent(spotlight)}>
                <div className={styles.heroCopy}>
                  <span className={styles.eyebrow}>
                    <Sparkles size={14} />
                    {tr ? 'KOLEKSİYON VİTRİNİ' : 'COLLECTION SPOTLIGHT'}
                  </span>
                  <h2>
                    {tr ? (
                      <>
                        Tarzını bul.
                        <br />
                        <em>Dalganı yarat.</em>
                      </>
                    ) : (
                      <>
                        Find your style.
                        <br />
                        <em>Make your wave.</em>
                      </>
                    )}
                  </h2>
                  <p>
                    {spotlight.collection} — {spotlight.description}
                  </p>
                  <button
                    className={styles.primary}
                    onClick={() => exploreCollection(spotlight.collection)}
                  >
                    {tr ? 'Koleksiyonu keşfet' : 'Explore collection'}
                    <ArrowRight size={17} />
                  </button>
                </div>
                <button
                  className={styles.heroArt}
                  onClick={() => openItem(spotlight.id)}
                  aria-label={tr ? `${spotlight.name} ürününü incele` : `Preview ${spotlight.name}`}
                >
                  <Artwork user={user} item={spotlight} />
                  <span>
                    {spotlight.name}
                    <ChevronRight size={15} />
                  </span>
                </button>
              </section>
              {companion && (
                <button
                  className={styles.collectionFeature}
                  style={accent(companion)}
                  onClick={() => exploreCollection(companion.collection)}
                >
                  <span className={styles.eyebrow}>
                    {tr ? 'DETAYLAR FARK YARATIR' : 'IT’S IN THE DETAILS'}
                  </span>
                  <Artwork user={user} item={companion} />
                  <span>
                    <small>{tr ? 'Koleksiyonu keşfet' : 'Explore collection'}</small>
                    <strong>{companion.collection}</strong>
                  </span>
                  <ArrowRight className={styles.featureArrow} size={19} />
                </button>
              )}
            </div>
          )}
          {!selected && feedback}
          <section className={styles.results} ref={resultsRef}>
            <header className={styles.resultsHeader}>
              <div>
                <span className={styles.eyebrow}>
                  {categories.find((item) => item.id === category)?.label}
                </span>
                <h2>
                  {normalizedQuery
                    ? tr
                      ? 'Arama sonuçları'
                      : 'Search results'
                    : collection ||
                      (category === 'featured'
                        ? tr
                          ? 'Göz atmaya değer'
                          : 'Worth a closer look'
                        : category === 'owned'
                          ? tr
                            ? 'Senin koleksiyonun'
                            : 'Your collection'
                          : category === 'bundles'
                            ? tr
                              ? 'Birlikte daha güzel'
                              : 'Better together'
                            : tr
                              ? 'Görünümünü tamamla'
                              : 'Complete your look')}
                </h2>
              </div>
              <span className={styles.resultCount} role="status">
                {category === 'bundles' ? visibleBundles.length : visible.length}{' '}
                {category === 'bundles' ? (tr ? 'paket' : 'bundles') : tr ? 'ürün' : 'items'}
              </span>
            </header>
            <div className={styles.filters}>
              <label>
                {tr ? 'Koleksiyon' : 'Collection'}
                <select value={collection} onChange={(e) => setCollection(e.target.value)}>
                  <option value="">{tr ? 'Tüm koleksiyonlar' : 'All collections'}</option>
                  {collections.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                {tr ? 'Sıralama' : 'Sort by'}
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="default">{tr ? 'Önerilen' : 'Recommended'}</option>
                  <option value="name">{tr ? 'İsim: A–Z' : 'Name: A–Z'}</option>
                  <option value="owned">{tr ? 'Önce koleksiyonum' : 'Owned first'}</option>
                </select>
              </label>
              {(query || collection) && (
                <button
                  onClick={() => {
                    setQuery('');
                    setCollection('');
                  }}
                >
                  <X size={14} />
                  {tr ? 'Filtreleri temizle' : 'Clear filters'}
                </button>
              )}
            </div>
            {category === 'bundles' ? (
              <div className={styles.bundleGrid}>
                {visibleBundles.map((bundle) => {
                  const complete = bundle.ownedCount === bundle.totalCount;
                  const items = bundle.itemIds.flatMap((id) => {
                    const item = catalog.find((entry) => entry.id === id);
                    return item ? [item] : [];
                  });
                  return (
                    <article className={styles.bundle} key={bundle.id} style={accent(bundle)}>
                      <div className={styles.bundlePreviews}>
                        {items.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => openItem(item.id)}
                            aria-label={tr ? `${item.name} ürününü incele` : `Preview ${item.name}`}
                          >
                            <Artwork user={user} item={item} />
                          </button>
                        ))}
                      </div>
                      <div className={styles.bundleCopy}>
                        <small>{bundle.collection}</small>
                        <h3>{bundle.name}</h3>
                        <p>{bundle.description}</p>
                        <div className={styles.progressLabel}>
                          <span>
                            {bundle.ownedCount}/{bundle.totalCount}{' '}
                            {tr ? 'koleksiyonunda' : 'owned'}
                          </span>
                          {complete && <Check size={16} />}
                        </div>
                        <progress
                          value={bundle.ownedCount}
                          max={bundle.totalCount}
                          aria-label={bundle.name}
                        />
                        <button
                          className={styles.secondary}
                          disabled={
                            Boolean(busy) ||
                            complete ||
                            (dashboard.membership.active && !bundle.claimable)
                          }
                          onClick={() => claimBundle(bundle)}
                        >
                          {busy === bundle.id ? (
                            <LoaderCircle className="spin" size={16} />
                          ) : complete ? (
                            <Check size={16} />
                          ) : (
                            <Package size={16} />
                          )}{' '}
                          {complete
                            ? tr
                              ? 'Koleksiyonunda'
                              : 'Owned'
                            : !dashboard.membership.active
                              ? tr
                                ? 'Wapve+ ile aç'
                                : 'Unlock with Wapve+'
                              : !bundle.claimable
                                ? tr
                                  ? 'Şu anda kullanılamıyor'
                                  : 'Currently unavailable'
                                : tr
                                  ? 'Paketi koleksiyona ekle'
                                  : 'Add bundle to collection'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className={styles.grid}>
                {visible.map((item) => (
                  <button
                    className={styles.card}
                    key={item.id}
                    style={accent(item)}
                    onClick={() => openItem(item.id)}
                  >
                    <div className={styles.cardArt}>
                      <Artwork user={user} item={item} />
                      {(item.equipped || item.owned) && (
                        <span className={`${styles.badge} ${item.equipped ? styles.equipped : ''}`}>
                          <Check size={12} />
                          {item.equipped
                            ? tr
                              ? 'Kullanımda'
                              : 'Equipped'
                            : tr
                              ? 'Koleksiyonunda'
                              : 'Owned'}
                        </span>
                      )}
                      <span className={styles.previewHint}>
                        {tr ? 'Üzerinde gör' : 'Try the look'}
                        <ArrowRight size={14} />
                      </span>
                    </div>
                    <span className={styles.cardCopy}>
                      <small>{item.collection}</small>
                      <strong>{item.name}</strong>
                      <span>
                        {typeLabel(item.storeCategory, tr)}
                        <ChevronRight size={15} />
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {(category === 'bundles' ? !visibleBundles.length : !visible.length) && (
              <div className={styles.empty}>
                <Search size={27} />
                <h3>
                  {category === 'owned' && !ownedCount
                    ? tr
                      ? 'Koleksiyonun seni bekliyor'
                      : 'Your collection starts here'
                    : tr
                      ? 'Bir eşleşme bulamadık'
                      : 'No matches yet'}
                </h3>
                <p>
                  {tr
                    ? 'Başka bir koleksiyona göz at veya filtrelerini değiştir.'
                    : 'Explore another collection or change your filters.'}
                </p>
                <button className={styles.secondary} onClick={() => switchCategory('all')}>
                  {tr ? 'Tüm ürünlere göz at' : 'Browse all items'}
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
            {category === 'featured' && !query && !collection && visible.length > 0 && (
              <button className={styles.browseAll} onClick={() => switchCategory('all')}>
                {tr ? 'Tüm ürünleri keşfet' : 'Explore all items'}
                <ArrowRight size={17} />
              </button>
            )}
          </section>
        </div>
      </div>
      <Dialog.Root
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open && !busyRef.current) setSelectedId(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          {selected && (
            <Dialog.Content
              className={styles.dialog}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                itemTriggerRef.current?.focus();
              }}
              onEscapeKeyDown={(event) => {
                if (busyRef.current) event.preventDefault();
              }}
              onInteractOutside={(event) => {
                if (busyRef.current) event.preventDefault();
              }}
            >
              <section className={styles.detailStage} style={accent(selected)}>
                <span className={styles.eyebrow}>
                  {tr ? 'SENİN PROFİLİNDE' : 'ON YOUR PROFILE'}
                </span>
                <Artwork user={user} item={selected} expanded />
                <span className={styles.previewCaption}>
                  {tr
                    ? 'Avatarın ve profilinle canlı önizleme'
                    : 'A preview with your avatar and profile'}
                </span>
              </section>
              <section className={styles.detailCopy}>
                <span className={styles.eyebrow}>{selected.collection}</span>
                <Dialog.Title>{selected.name}</Dialog.Title>
                <div className={styles.meta}>
                  <span>{typeLabel(selected.storeCategory, tr)}</span>
                  <span>{rarityLabel(selected.rarity, tr)}</span>
                </div>
                <Dialog.Description>{selected.description}</Dialog.Description>
                <div className={styles.ownership}>
                  <span>{selected.owned ? <Layers3 size={20} /> : <Sparkles size={20} />}</span>
                  <div>
                    <strong>
                      {selected.owned
                        ? tr
                          ? 'Koleksiyonunun bir parçası'
                          : 'Part of your collection'
                        : tr
                          ? 'Wapve+ koleksiyonundan'
                          : 'From the Wapve+ collection'}
                    </strong>
                    <p>
                      {selected.owned
                        ? tr
                          ? 'Dilediğin zaman kullan veya kaldır.'
                          : 'Equip or remove it whenever you like.'
                        : tr
                          ? 'Koleksiyonuna ekle, profilini kişiselleştir.'
                          : 'Add it to your collection and make it yours.'}
                    </p>
                  </div>
                </div>
                {feedback}
                <div className={styles.detailActions}>
                  <button
                    className={styles.primary}
                    disabled={
                      Boolean(busy) ||
                      selected.equipped ||
                      (dashboard.membership.active && !selected.owned && !selected.claimable)
                    }
                    onClick={() => primaryAction(selected)}
                  >
                    {busy ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : selected.equipped ? (
                      <Check size={17} />
                    ) : (
                      <Sparkles size={17} />
                    )}{' '}
                    {actionLabel(selected)}
                  </button>
                  {selected.equipped && (
                    <button
                      className={styles.secondary}
                      disabled={Boolean(busy)}
                      onClick={() => equip(selected, true)}
                    >
                      {tr ? 'Profilden kaldır' : 'Remove from profile'}
                    </button>
                  )}
                </div>
              </section>
              <Dialog.Close
                className={styles.close}
                disabled={Boolean(busy)}
                aria-label={tr ? 'Kapat' : 'Close'}
              >
                <X size={20} />
              </Dialog.Close>
            </Dialog.Content>
          )}
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
