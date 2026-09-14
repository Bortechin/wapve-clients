'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { PremiumCosmeticType, PremiumDashboard, UserProfile } from '@wapve/contracts';
import { Button } from '@wapve/ui';
import {
  Check,
  ChevronRight,
  ImageIcon,
  LoaderCircle,
  Save,
  ShoppingBag,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';
import { EmojiTextareaInput } from './emoji-textarea-input';
import { ProfileIdentityPreview } from './profile-identity-preview';
import { ProfileMediaEditor, type ProfileMediaKind } from './profile-media-editor';
import { CustomStatusEmoji } from './custom-status-emoji';
import {
  CosmeticSwatch,
  ProfileCosmeticPicker,
  cosmeticField,
  cosmeticTitle,
} from './profile-cosmetic-picker';
import styles from './profile-studio.module.css';

const cosmeticTypes: PremiumCosmeticType[] = ['NAMEPLATE', 'AVATAR_DECORATION', 'PROFILE_EFFECT'];

export function ProfileStudio({
  open,
  onOpenChange,
  user,
  onUser,
  locale,
  messages,
  onOpenStore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile;
  onUser: (user: UserProfile) => void;
  locale: 'tr' | 'en';
  messages: Dictionary;
  onOpenStore: (type?: PremiumCosmeticType) => void;
}) {
  const tr = locale === 'tr';
  const [dashboard, setDashboard] = useState<PremiumDashboard | null>(null);
  const [pickerType, setPickerType] = useState<PremiumCosmeticType | null>(null);
  const pickerTrigger = useRef<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [draftBio, setDraftBio] = useState(user.bio ?? '');
  const [draftStatus, setDraftStatus] = useState(user.customStatusText ?? '');
  const [bioExpanded, setBioExpanded] = useState(false);
  const [statusEditing, setStatusEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mediaEditorKind, setMediaEditorKind] = useState<ProfileMediaKind | null>(null);
  const dirty = draftBio !== (user.bio ?? '') || draftStatus !== (user.customStatusText ?? '');

  useEffect(() => {
    if (!open) return;
    setDraftBio(user.bio ?? '');
    setDraftStatus(user.customStatusText ?? '');
    setBioExpanded(false);
    setStatusEditing(false);
    setPickerType(null);
    setError('');
    setNotice('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setDashboard(null);
    setLoading(true);
    setLoadFailed(false);
    void apiRequest<PremiumDashboard>('/premium/me')
      .then((next) => {
        if (active) setDashboard(next);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, reload]);

  function canLeave() {
    return (
      !busy &&
      (!dirty ||
        window.confirm(
          tr
            ? 'Kaydedilmemiş profil değişikliklerinden vazgeçilsin mi?'
            : 'Discard unsaved profile changes?',
        ))
    );
  }
  function requestClose() {
    if (!canLeave()) return;
    setPickerType(null);
    setMediaEditorKind(null);
    onOpenChange(false);
  }
  function openStore(type?: PremiumCosmeticType) {
    if (!canLeave()) return;
    setPickerType(null);
    onOpenStore(type);
  }
  function openPicker(type: PremiumCosmeticType, trigger: HTMLElement) {
    pickerTrigger.current = trigger;
    setPickerType(type);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await apiRequest<UserProfile>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          bio: draftBio.trim() || null,
          customStatusText: draftStatus.trim() || null,
        }),
      });
      onUser(next);
      setDraftBio(next.bio ?? '');
      setDraftStatus(next.customStatusText ?? '');
      setStatusEditing(false);
      setNotice(tr ? 'Profilin kaydedildi.' : 'Your profile was saved.');
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function applyCosmetic(
    type: PremiumCosmeticType,
    selection: string | null,
  ): Promise<boolean> {
    if (!dashboard || busy) return false;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await apiRequest<PremiumDashboard>('/premium/equipped', {
        method: 'PATCH',
        body: JSON.stringify({ [cosmeticField[type]]: selection }),
      });
      const refreshedUser = await apiRequest<UserProfile>('/users/me');
      setDashboard(next);
      onUser(refreshedUser);
      setNotice(
        selection
          ? tr
            ? 'Yeni görünümün uygulandı.'
            : 'Your new look was applied.'
          : tr
            ? 'Görünüm kaldırıldı.'
            : 'The cosmetic was removed.',
      );
      return true;
    } catch (caught) {
      setError(errorMessage(caught, messages));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function updateMedia(kind: ProfileMediaKind, file: File | undefined): Promise<boolean> {
    if (!file) return false;
    const body = new FormData();
    body.append(kind, file);
    setBusy(true);
    setError('');
    try {
      const next = await apiRequest<UserProfile>(`/users/me/${kind}`, { method: 'POST', body });
      onUser({
        ...next,
        [`${kind}Url`]: next[`${kind}Url`] ? `${next[`${kind}Url`]}?v=${Date.now()}` : null,
      });
      return true;
    } catch (caught) {
      setError(errorMessage(caught, messages));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function removeMedia(kind: ProfileMediaKind): Promise<boolean> {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/users/me/${kind}`, { method: 'DELETE' });
      onUser({ ...user, [`${kind}Url`]: null });
      return true;
    } catch (caught) {
      setError(errorMessage(caught, messages));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (!next ? requestClose() : onOpenChange(true))}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.dialog}
          onEscapeKeyDown={(event) => {
            if (busy || pickerType || mediaEditorKind) {
              event.preventDefault();
              if (!busy) {
                if (mediaEditorKind) setMediaEditorKind(null);
                else setPickerType(null);
              }
            }
          }}
          onInteractOutside={(event) => {
            if (busy || pickerType || mediaEditorKind) event.preventDefault();
          }}
        >
          <header className={styles.header}>
            <div className={styles.brand}>
              <img src="/brand/wapve-wave-mark-v2.png" alt="" />
              <div>
                <span className={styles.eyebrow}>{tr ? 'PROFİL STÜDYOSU' : 'PROFILE STUDIO'}</span>
                <Dialog.Title>{tr ? 'Kendi dalganı yansıt.' : 'Make it your own.'}</Dialog.Title>
              </div>
            </div>
            <Dialog.Description className={styles.headerDescription}>
              {tr ? 'Profilin, senin imzan.' : 'Your profile. Your signature.'}
            </Dialog.Description>
            <button
              type="button"
              className={styles.close}
              onClick={requestClose}
              disabled={busy}
              aria-label={messages.close}
            >
              <X size={20} />
            </button>
          </header>
          <div className={styles.body}>
            <aside
              className={styles.customize}
              aria-label={tr ? 'Profilini özelleştir' : 'Customize your profile'}
            >
              <div className={styles.sectionHeading}>
                <Sparkles size={16} />
                <strong>{tr ? 'Görünümünü özelleştir' : 'Customize your look'}</strong>
              </div>
              <p className={styles.hint}>
                {tr
                  ? 'Bir alana tıkla, koleksiyonunu keşfet.'
                  : 'Pick an area to explore your collection.'}
              </p>
              {loading && (
                <span role="status" className={styles.loading}>
                  <LoaderCircle className="spin" size={16} />
                  {tr ? 'Koleksiyonun yükleniyor…' : 'Loading your collection…'}
                </span>
              )}
              {loadFailed && (
                <div className={styles.loadError} role="alert">
                  <p>{tr ? 'Koleksiyonun yüklenemedi.' : 'Could not load your collection.'}</p>
                  <button onClick={() => setReload((n) => n + 1)}>
                    {tr ? 'Tekrar dene' : 'Try again'}
                  </button>
                </div>
              )}
              {cosmeticTypes.map((type) => {
                const current =
                  dashboard?.catalog.find(
                    (item) => item.id === dashboard.equipped[cosmeticField[type]],
                  ) ?? null;
                return (
                  <div className={styles.customizeCard} key={type}>
                    <button
                      type="button"
                      className={styles.customizeChoice}
                      disabled={!dashboard || busy}
                      onClick={(event) => openPicker(type, event.currentTarget)}
                      aria-label={
                        tr
                          ? cosmeticTitle(type, tr) + ' seç'
                          : 'Choose ' + cosmeticTitle(type, tr).toLowerCase()
                      }
                    >
                      <span className={styles.cardHeading}>
                        {cosmeticTitle(type, tr)}
                        <ChevronRight size={15} />
                      </span>
                      <CosmeticSwatch item={current} type={type} user={user} />
                      <span className={styles.currentLabel}>
                        {current?.name ?? (tr ? 'Görünüm seçilmedi' : 'No cosmetic selected')}
                      </span>
                    </button>
                    {current && (
                      <button
                        type="button"
                        className={styles.remove}
                        disabled={busy}
                        onClick={() => void applyCosmetic(type, null)}
                        aria-label={
                          tr
                            ? cosmeticTitle(type, tr) + ' kaldır'
                            : 'Remove ' + cosmeticTitle(type, tr).toLowerCase()
                        }
                        title={tr ? 'Kaldır' : 'Remove'}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                className={styles.storeLink}
                onClick={() => openStore()}
                disabled={busy}
              >
                <ShoppingBag size={17} />
                <span>{tr ? 'Mağazayı keşfet' : 'Explore the store'}</span>
                <ChevronRight size={16} />
              </button>
            </aside>
            <section
              className={styles.profileDetails}
              aria-label={tr ? 'Ana profil' : 'Main profile'}
            >
              <div className={styles.sectionHeading}>
                <UserRound size={17} />
                <h2>{tr ? 'Ana profil' : 'Main profile'}</h2>
              </div>
              <p className={styles.hint}>
                {tr ? 'Seni anlatan küçük ayrıntılar.' : 'The little details that tell your story.'}
              </p>
              {(error || notice) && (
                <div className={error ? 'form-error' : 'form-success'} role="status">
                  {error || notice}
                </div>
              )}
              <fieldset className={`profile-studio-form ${styles.fields}`} disabled={busy}>
                <div className="profile-studio-media">
                  <button
                    type="button"
                    className="profile-studio-banner"
                    disabled={busy}
                    onClick={() => setMediaEditorKind('banner')}
                    style={
                      user.bannerUrl ? { backgroundImage: `url(${user.bannerUrl})` } : undefined
                    }
                  >
                    <ImageIcon size={19} /> {tr ? 'Afişi değiştir' : 'Change banner'}
                  </button>
                  <button
                    type="button"
                    className="profile-studio-avatar"
                    disabled={busy}
                    aria-label={tr ? 'Avatarı değiştir' : 'Change avatar'}
                    onClick={() => setMediaEditorKind('avatar')}
                  >
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" />
                    ) : (
                      user.displayName.slice(0, 1).toUpperCase()
                    )}
                    <span>
                      <ImageIcon size={16} />
                    </span>
                  </button>
                  <div className={`profile-studio-status-bubble${statusEditing ? ' editing' : ''}`}>
                    {statusEditing ? (
                      <form onSubmit={(event) => void saveProfile(event)}>
                        <input
                          autoFocus
                          aria-label={messages.setCustomStatus}
                          maxLength={128}
                          value={draftStatus}
                          onChange={(event) => setDraftStatus(event.target.value)}
                          placeholder={messages.setCustomStatus}
                        />
                        <Button type="submit" disabled={busy} aria-label={messages.save}>
                          {busy ? <LoaderCircle className="spin" size={14} /> : <Save size={14} />}
                        </Button>
                        <button
                          type="button"
                          aria-label={messages.cancel}
                          onClick={() => {
                            setDraftStatus(user.customStatusText ?? '');
                            setStatusEditing(false);
                          }}
                        >
                          <X size={14} />
                        </button>
                      </form>
                    ) : (
                      <button type="button" onClick={() => setStatusEditing(true)}>
                        {user.customStatusEmoji && (
                          <i>
                            <CustomStatusEmoji value={user.customStatusEmoji} />
                          </i>
                        )}
                        <span>{draftStatus || messages.setCustomStatus}</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="profile-studio-identity">
                  <strong>{user.displayName}</strong>
                  <span>@{user.username}</span>
                </div>
                <div className="profile-studio-profile-options">
                  <button
                    type="button"
                    className={bioExpanded ? 'expanded' : ''}
                    onClick={() => setBioExpanded((current) => !current)}
                    aria-expanded={bioExpanded}
                  >
                    <span>
                      <small>{messages.aboutMe}</small>
                      <strong>{draftBio || (tr ? 'Biyografi ekle' : 'Add a biography')}</strong>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                  {bioExpanded && (
                    <form
                      className="profile-studio-bio-inline"
                      onSubmit={(event) => void saveProfile(event)}
                    >
                      <label htmlFor="profile-studio-bio">{messages.aboutMe}</label>
                      <EmojiTextareaInput
                        id="profile-studio-bio"
                        value={draftBio}
                        onChange={setDraftBio}
                        maxLength={190}
                        locale={locale}
                        emojiLabel={messages.emoji}
                      />
                      <div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setDraftBio(user.bio ?? '');
                            setBioExpanded(false);
                          }}
                        >
                          {tr ? 'İptal' : 'Cancel'}
                        </button>
                        <Button type="submit" disabled={!dirty || busy}>
                          <Save size={16} /> {busy ? messages.saving : messages.save}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              </fieldset>
            </section>
            <aside className={styles.livePreview}>
              <span className={styles.eyebrow}>
                <i />
                {tr ? 'CANLI ÖNİZLEME' : 'LIVE PREVIEW'}
              </span>
              <div className={styles.previewCanvas}>
                <ProfileIdentityPreview
                  user={{ ...user, bio: draftBio || null, customStatusText: draftStatus || null }}
                />
              </div>
              <p>{tr ? 'Topluluğunda böyle görünürsün.' : 'How your community sees you.'}</p>
            </aside>
          </div>
          <footer className={styles.studioFooter}>
            <span>
              <Check size={15} />
              {dirty
                ? tr
                  ? 'Kaydedilmemiş profil değişiklikleri var.'
                  : 'You have unsaved profile changes.'
                : tr
                  ? 'Her ayrıntısıyla sana ait.'
                  : 'Yours, down to the last detail.'}
            </span>
            <button type="button" onClick={requestClose} disabled={busy}>
              {tr ? 'Tamam' : 'Done'}
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
      {pickerType && dashboard && (
        <ProfileCosmeticPicker
          key={pickerType}
          type={pickerType}
          dashboard={dashboard}
          user={user}
          tr={tr}
          onClose={() => setPickerType(null)}
          onApply={applyCosmetic}
          onStore={openStore}
          returnFocus={pickerTrigger.current}
        />
      )}
      {mediaEditorKind && (
        <ProfileMediaEditor
          kind={mediaEditorKind}
          open
          locale={locale}
          currentUrl={mediaEditorKind === 'avatar' ? user.avatarUrl : user.bannerUrl}
          busy={busy}
          onOpenChange={(next) => !next && setMediaEditorKind(null)}
          onApply={(file) => updateMedia(mediaEditorKind, file)}
          onRemove={() => removeMedia(mediaEditorKind)}
        />
      )}
    </Dialog.Root>
  );
}
