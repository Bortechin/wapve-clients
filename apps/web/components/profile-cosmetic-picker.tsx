'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type {
  PremiumCosmeticItem,
  PremiumCosmeticType,
  PremiumDashboard,
  UserProfile,
} from '@wapve/contracts';
import { Check, LoaderCircle, Search, ShoppingBag, Slash, X } from 'lucide-react';
import { useState } from 'react';
import { PremiumCosmeticPreview } from './premium-cosmetic-preview';
import { ProfileIdentityPreview } from './profile-identity-preview';
import styles from './profile-studio.module.css';

export const cosmeticField = {
  NAMEPLATE: 'nameplateId',
  AVATAR_DECORATION: 'avatarDecorationId',
  PROFILE_EFFECT: 'profileEffectId',
} as const;

export function cosmeticTitle(type: PremiumCosmeticType, tr: boolean) {
  if (type === 'NAMEPLATE') return tr ? 'İsim plakası' : 'Nameplate';
  if (type === 'AVATAR_DECORATION') return tr ? 'Avatar dekorasyonu' : 'Avatar decoration';
  return tr ? 'Profil efekti ve çerçeve' : 'Profile effect & frame';
}

export function CosmeticSwatch({
  item,
  type,
  user,
}: {
  item: PremiumCosmeticItem | null;
  type: PremiumCosmeticType;
  user: UserProfile;
}) {
  return (
    <div
      className={`${styles.swatch} ${type === 'NAMEPLATE' ? styles.nameplate : type === 'AVATAR_DECORATION' ? styles.decoration : styles.effect}`}
    >
      {item ? (
        <PremiumCosmeticPreview item={item} user={user} />
      ) : (
        <div className={styles.unadorned}>
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" />
          ) : (
            <span>{user.displayName.slice(0, 1)}</span>
          )}
          {type === 'NAMEPLATE' ? <strong>{user.displayName}</strong> : <Slash size={18} />}
        </div>
      )}
    </div>
  );
}

export function ProfileCosmeticPicker({
  type,
  dashboard,
  user,
  tr,
  onClose,
  onApply,
  onStore,
  returnFocus,
}: {
  type: PremiumCosmeticType;
  dashboard: PremiumDashboard;
  user: UserProfile;
  tr: boolean;
  onClose: () => void;
  onApply: (type: PremiumCosmeticType, id: string | null) => Promise<boolean>;
  onStore: (type: PremiumCosmeticType) => void;
  returnFocus: HTMLElement | null;
}) {
  const equipped = dashboard.equipped[cosmeticField[type]];
  const [selected, setSelected] = useState<string | null>(equipped);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const owned = dashboard.catalog.filter((item) => item.type === type && item.owned);
  const items = owned.filter((item) =>
    item.name
      .toLocaleLowerCase(tr ? 'tr' : 'en')
      .includes(search.toLocaleLowerCase(tr ? 'tr' : 'en')),
  );
  const candidate = owned.find((item) => item.id === selected) ?? null;

  async function apply() {
    setBusy(true);
    setFailed(false);
    try {
      if (await onApply(type, selected)) onClose();
      else setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.pickerOverlay} />
        <Dialog.Content
          className={styles.picker}
          aria-busy={busy}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus?.focus();
          }}
        >
          <header className={styles.pickerHeader}>
            <div>
              <span className={styles.eyebrow}>{tr ? 'KOLEKSİYONUN' : 'YOUR COLLECTION'}</span>
              <Dialog.Title>{cosmeticTitle(type, tr)}</Dialog.Title>
              <Dialog.Description>
                {tr
                  ? 'Bir görünüm seç. Profilinde nasıl durduğunu gör.'
                  : 'Choose a look. See how it fits your profile.'}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className={styles.close}
              disabled={busy}
              aria-label={tr ? 'Kapat' : 'Close'}
            >
              <X size={20} />
            </Dialog.Close>
          </header>
          <div className={styles.pickerBody}>
            <section
              className={styles.collection}
              aria-label={tr ? 'Sahip olduğun görünümler' : 'Your owned looks'}
            >
              <div className={styles.collectionTools}>
                <label className={styles.search}>
                  <Search size={16} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={tr ? 'Koleksiyonunda ara' : 'Search your collection'}
                    aria-label={tr ? 'Koleksiyonunda ara' : 'Search your collection'}
                  />
                </label>
                <div className={styles.quickActions}>
                  <button
                    type="button"
                    aria-pressed={selected === null}
                    disabled={busy}
                    onClick={() => setSelected(null)}
                  >
                    <Slash size={16} />
                    {tr ? 'Yok' : 'None'}
                    {selected === null && <Check size={14} />}
                  </button>
                  <button type="button" disabled={busy} onClick={() => onStore(type)}>
                    <ShoppingBag size={16} />
                    {tr ? 'Mağaza' : 'Store'}
                  </button>
                </div>
                <small>{tr ? `${owned.length} görünüm` : `${owned.length} looks`}</small>
              </div>
              <div
                className={`${styles.collectionGrid} ${type === 'NAMEPLATE' ? styles.plateCollection : ''}`}
              >
                {items.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={styles.choice}
                    aria-pressed={selected === item.id}
                    aria-label={item.name}
                    disabled={busy}
                    onClick={() => setSelected(item.id)}
                  >
                    <CosmeticSwatch item={item} type={type} user={user} />
                    <span className={styles.choiceLabel}>
                      <strong>{item.name}</strong>
                      {selected === item.id && <Check size={16} />}
                    </span>
                    <small>
                      {item.id === equipped ? (tr ? 'Kullanımda' : 'Equipped') : item.collection}
                    </small>
                  </button>
                ))}
              </div>
              {!items.length && (
                <div className={styles.empty}>
                  <ShoppingBag size={26} />
                  <strong>
                    {owned.length
                      ? tr
                        ? 'Eşleşen görünüm yok'
                        : 'No matching looks'
                      : tr
                        ? 'Koleksiyonun seni bekliyor'
                        : 'Your collection awaits'}
                  </strong>
                  <p>
                    {owned.length
                      ? tr
                        ? 'Başka bir ad aramayı dene.'
                        : 'Try a different name.'
                      : tr
                        ? 'Mağazadan edindiğin görünümler burada yer alacak.'
                        : 'Looks you get from the store will appear here.'}
                  </p>
                </div>
              )}
            </section>
            <aside className={styles.pickerPreview}>
              <span className={styles.eyebrow}>{tr ? 'CANLI ÖNİZLEME' : 'LIVE PREVIEW'}</span>
              {type === 'NAMEPLATE' ? (
                <div className={styles.memberPreview}>
                  <div className={styles.ghostMember}>
                    <i />
                    <span />
                  </div>
                  <CosmeticSwatch item={candidate} type={type} user={user} />
                  <div className={styles.ghostMember}>
                    <i />
                    <span />
                  </div>
                </div>
              ) : (
                <div className={styles.previewCanvas}>
                  <ProfileIdentityPreview
                    user={user}
                    candidate={{ type, visual: candidate?.visual ?? null }}
                  />
                </div>
              )}
              <div className={styles.selectionDetails}>
                <strong>{candidate?.name ?? (tr ? 'Doğal görünümün' : 'Your natural look')}</strong>
                <p>
                  {candidate?.description ??
                    (tr
                      ? 'Bu kategorideki görünüm kaldırılacak.'
                      : 'The cosmetic in this category will be removed.')}
                </p>
              </div>
            </aside>
          </div>
          <footer className={styles.pickerFooter}>
            <span role="status">
              {failed
                ? tr
                  ? 'Kaydedilemedi. Tekrar deneyebilirsin.'
                  : 'Could not save. Please try again.'
                : selected !== equipped
                  ? tr
                    ? 'Uyguladığında herkes görebilir.'
                    : 'Apply to make this look visible to everyone.'
                  : tr
                    ? 'Güncel görünümün seçili.'
                    : 'Your current look is selected.'}
            </span>
            <button type="button" disabled={busy} onClick={onClose}>
              {tr ? 'İptal' : 'Cancel'}
            </button>
            <button
              type="button"
              className={styles.primary}
              disabled={busy || selected === equipped}
              onClick={() => void apply()}
            >
              {busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
              {tr ? 'Uygula' : 'Apply'}
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
