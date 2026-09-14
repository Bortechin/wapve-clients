'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@wapve/ui';
import type { Locale, ServerSummary, UserProfile, UserSession } from '@wapve/contracts';
import {
  AudioLines,
  Activity,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Code2,
  Copy,
  Crown,
  ExternalLink,
  KeyRound,
  Languages,
  LogOut,
  Mic,
  MonitorSmartphone,
  RotateCcw,
  Save,
  ShieldCheck,
  UserRound,
  Volume2,
  Waves,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';
import {
  formatVoiceShortcut,
  shortcutFromKeyboardEvent,
  voiceShortcutActions,
  type VoiceShortcutAction,
} from '@/lib/voice-shortcuts';
import type { VoiceConnection, VoiceDoctorCheck } from './voice-channel';
import { TwoFactorSettings } from './two-factor-settings';
import { PasskeySettings } from './passkey-settings';
import { AccountDeletionSettings } from './account-deletion-settings';
import { ProfileMediaEditor, type ProfileMediaKind } from './profile-media-editor';
import { PremiumCenter } from './premium-center';
import { PasswordField } from './password-field';
import { StatusEmojiPicker } from './status-emoji-picker';
import { AppearanceSettings } from './appearance-settings';
import { PrivacySettings } from './privacy-settings';

export type AccountSettingsTab =
  | 'appearance'
  | 'profile'
  | 'privacy'
  | 'premium'
  | 'voice'
  | 'security'
  | 'advanced'
  | 'language';

function useAnimatedPresence(visible: boolean, exitDuration = 320) {
  const [mounted, setMounted] = useState(visible);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    if (visible) {
      setMounted(true);
      setLeaving(false);
    } else if (mounted) {
      setLeaving(true);
      timeout = setTimeout(() => {
        setMounted(false);
        setLeaving(false);
      }, exitDuration);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [exitDuration, mounted, visible]);

  return { mounted, leaving };
}

export function AccountSettings({
  open,
  onOpenChange,
  locale,
  messages,
  user,
  servers,
  onUser,
  voiceConnection,
  initialTab = 'profile',
  developerMode,
  onDeveloperModeChange,
  client = 'web',
  onLogout,
  onOpenStore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
  messages: Dictionary;
  user: UserProfile;
  servers: ServerSummary[];
  onUser: (user: UserProfile) => void;
  voiceConnection: VoiceConnection;
  initialTab?: AccountSettingsTab;
  developerMode: boolean;
  onDeveloperModeChange: (enabled: boolean) => void;
  client?: 'web' | 'desktop';
  onLogout?: () => void | Promise<void>;
  onOpenStore?: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<AccountSettingsTab>(initialTab);
  const [mediaEditorKind, setMediaEditorKind] = useState<ProfileMediaKind | null>(null);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [busy, setBusy] = useState(false);
  const [privacyState,setPrivacyState]=useState({dirty:false,busy:false});
  function changeTab(next:AccountSettingsTab) {
    if(privacyState.busy)return;
    if(tab==='privacy' && next!=='privacy' && privacyState.dirty && !window.confirm(locale==='tr'?'Kaydedilmemiş gizlilik değişikliklerini silmek istiyor musun?':'Discard unsaved privacy changes?'))return;
    setTab(next);
  }
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [profileDraft, setProfileDraft] = useState(() => ({
    username: user.username,
    displayName: user.displayName,
    bio: user.bio ?? '',
    status: user.status,
    customStatusText: user.customStatusText ?? '',
    customStatusEmoji: user.customStatusEmoji ?? '',
    locale,
    autoConvertEmoticons: user.autoConvertEmoticons,
    showBadgesInChat: user.showBadgesInChat,
    showMutualFriends: user.showMutualFriends,
    showMutualServers: user.showMutualServers,
  }));

  const resetProfileDraft = () =>
    setProfileDraft({
      username: user.username,
      displayName: user.displayName,
      bio: user.bio ?? '',
      status: user.status,
      customStatusText: user.customStatusText ?? '',
      customStatusEmoji: user.customStatusEmoji ?? '',
      locale,
      autoConvertEmoticons: user.autoConvertEmoticons,
      showBadgesInChat: user.showBadgesInChat,
      showMutualFriends: user.showMutualFriends,
      showMutualServers: user.showMutualServers,
    });

  useEffect(() => {
    if (open) {
      resetProfileDraft();
    }
  }, [initialTab, open, user]);
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [initialTab, open]);

  useEffect(() => {
    if (open && tab === 'security') {
      void apiRequest<UserSession[]>('/users/me/sessions')
        .then(setSessions)
        .catch(() => setSessions([]));
    }
  }, [open, tab]);

  async function saveProfile(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const nextLocale = profileDraft.locale;
    try {
      const updated = await apiRequest<UserProfile>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          username: profileDraft.username,
          displayName: profileDraft.displayName,
          bio: profileDraft.bio.trim() || null,
          status: profileDraft.status,
          customStatusText: profileDraft.customStatusText.trim() || null,
          customStatusEmoji: profileDraft.customStatusEmoji.trim() || null,
          locale: nextLocale,
          autoConvertEmoticons: profileDraft.autoConvertEmoticons,
          showBadgesInChat: profileDraft.showBadgesInChat,
          showMutualFriends: profileDraft.showMutualFriends,
          showMutualServers: profileDraft.showMutualServers,
        }),
      });
      onUser(updated);
      setNotice(messages.profileSaved);
      if (nextLocale !== locale) {
        document.cookie = `wapve_locale=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
        router.replace('/app');
        router.refresh();
      }
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(file: File | undefined): Promise<boolean> {
    if (!file) return false;
    const body = new FormData();
    body.append('avatar', file);
    setBusy(true);
    setError('');
    try {
      const updated = await apiRequest<UserProfile>('/users/me/avatar', { method: 'POST', body });
      onUser({
        ...updated,
        avatarUrl: updated.avatarUrl ? `${updated.avatarUrl}?v=${Date.now()}` : null,
      });
      return true;
    } catch (caught) {
      setError(errorMessage(caught, messages));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function removeAvatar(): Promise<boolean> {
    setBusy(true);
    setError('');
    try {
      await apiRequest('/users/me/avatar', { method: 'DELETE' });
      onUser({ ...user, avatarUrl: null });
      return true;
    } catch (caught) {
      setError(errorMessage(caught, messages));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function uploadBanner(file: File | undefined): Promise<boolean> {
    if (!file) return false;
    const body = new FormData();
    body.append('banner', file);
    setBusy(true);
    setError('');
    try {
      const updated = await apiRequest<UserProfile>('/users/me/banner', { method: 'POST', body });
      onUser({
        ...updated,
        bannerUrl: updated.bannerUrl ? `${updated.bannerUrl}?v=${Date.now()}` : null,
      });
      return true;
    } catch (caught) {
      setError(errorMessage(caught, messages));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function removeBanner(): Promise<boolean> {
    setBusy(true);
    setError('');
    try {
      await apiRequest('/users/me/banner', { method: 'DELETE' });
      onUser({ ...user, bannerUrl: null });
      return true;
    } catch (caught) {
      setError(errorMessage(caught, messages));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await apiRequest('/auth/password/change', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: data.get('currentPassword'),
          newPassword: data.get('newPassword'),
        }),
      });
      setNotice(messages.passwordChanged);
      form.reset();
      setSessions(await apiRequest<UserSession[]>('/users/me/sessions'));
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function revokeSession(id: string) {
    try {
      await apiRequest(`/users/me/sessions/${id}`, { method: 'DELETE' });
      setSessions((current) => current.filter((session) => session.id !== id));
    } catch (caught) {
      setError(errorMessage(caught, messages));
    }
  }

  const profileDirty =
    profileDraft.username !== user.username ||
    profileDraft.displayName !== user.displayName ||
    profileDraft.bio !== (user.bio ?? '') ||
    profileDraft.status !== user.status ||
    profileDraft.customStatusText !== (user.customStatusText ?? '') ||
    profileDraft.customStatusEmoji !== (user.customStatusEmoji ?? '') ||
    profileDraft.locale !== locale ||
    profileDraft.autoConvertEmoticons !== user.autoConvertEmoticons ||
    profileDraft.showBadgesInChat !== user.showBadgesInChat ||
    profileDraft.showMutualFriends !== user.showMutualFriends ||
    profileDraft.showMutualServers !== user.showMutualServers;
  const saveDockPresence = useAnimatedPresence((tab === 'profile' && profileDirty) || (tab === 'privacy' && privacyState.dirty));
  const saveDockBusy = tab === 'privacy' ? privacyState.busy : busy;
  const tabTitle = tab === 'appearance' ? (locale === 'tr' ? 'Görünüm' : 'Appearance') :
    tab === 'profile'
      ? locale === 'tr'
        ? 'Profil'
        : 'Profile'
      : tab === 'privacy'
        ? (messages.privacyAndPreferences ??
          (locale === 'tr' ? 'Gizlilik ve Tercihler' : 'Privacy & Preferences'))
        : tab === 'premium'
          ? 'Wapve+'
          : tab === 'voice'
            ? messages.voiceAndVideo
            : tab === 'security'
              ? messages.security
              : tab === 'advanced'
                ? messages.advanced
                : (messages.language ?? (locale === 'tr' ? 'Dil' : 'Language'));

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if(!nextOpen && (busy||privacyState.busy))return;
        if(!nextOpen && privacyState.dirty && !window.confirm(locale==='tr'?'Kaydedilmemiş gizlilik değişikliklerini silmek istiyor musun?':'Discard unsaved privacy changes?'))return;
        if (!nextOpen) setMediaEditorKind(null);
        onOpenChange(nextOpen);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay account-settings-overlay" />
        <Dialog.Content
          className="settings-dialog account-settings-dialog"
          aria-describedby="settings-description"
        >
          <aside className="settings-nav account-settings-nav">
            <div className="account-settings-brand">
              <span className="account-settings-mark" aria-hidden="true">
                <img src="/brand/wapve-wave-mark-v2.png" alt="" />
              </span>
              <div>
                <strong>Wapve</strong>
                <small>{locale === 'tr' ? 'Kendi Dalgan' : 'Your Own Wave'}</small>
              </div>
            </div>
            <label className="settings-mobile-picker">
              <span>{locale === 'tr' ? 'Ayar kategorisi' : 'Settings category'}</span>
              <select
                aria-label={locale === 'tr' ? 'Ayar kategorisi' : 'Settings category'}
                value={tab}
                onChange={(event) => changeTab(event.target.value as AccountSettingsTab)}
              >
                <option value="appearance">{locale === 'tr' ? 'Görünüm' : 'Appearance'}</option>
                <option value="profile">{locale === 'tr' ? 'Profil' : 'Profile'}</option>
                <option value="privacy">
                  {messages.privacyAndPreferences ??
                    (locale === 'tr' ? 'Gizlilik ve Tercihler' : 'Privacy & Preferences')}
                </option>
                <option value="premium">Wapve+</option>
                <option value="voice">{messages.voiceAndVideo}</option>
                <option value="security">{messages.security}</option>
                <option value="advanced">{messages.advanced}</option>
                <option value="language">
                  {messages.language ?? (locale === 'tr' ? 'Dil' : 'Language')}
                </option>
              </select>
            </label>
            <p className="settings-nav-label">{locale === 'tr' ? 'HESABIN' : 'YOUR ACCOUNT'}</p>
            <button className={tab === 'profile' ? 'active' : ''} onClick={() => changeTab('profile')}>
              <UserRound size={17} />
              {locale === 'tr' ? 'Profil' : 'Profile'}
            </button>
            <button className={tab === 'privacy' ? 'active' : ''} onClick={() => changeTab('privacy')}>
              <ShieldCheck size={17} />
              {messages.privacyAndPreferences ??
                (locale === 'tr' ? 'Gizlilik ve Tercihler' : 'Privacy & Preferences')}
            </button>
            <button
              className={`premium-nav-button${tab === 'premium' ? ' active' : ''}`}
              onClick={() => changeTab('premium')}
            >
              <Crown size={17} />
              Wapve+
              {user.premium?.active && <span>{locale === 'tr' ? 'AKTİF' : 'ACTIVE'}</span>}
            </button>
            <button className={tab === 'appearance' ? 'active' : ''} onClick={() => changeTab('appearance')}><MonitorSmartphone size={17} />{locale === 'tr' ? 'Görünüm' : 'Appearance'}</button>
            <button className={tab === 'voice' ? 'active' : ''} onClick={() => changeTab('voice')}>
              <AudioLines size={17} />
              {messages.voiceAndVideo}
            </button>
            <button
              className={tab === 'security' ? 'active' : ''}
              onClick={() => changeTab('security')}
            >
              <KeyRound size={17} />
              {messages.security}
            </button>
            <button
              className={tab === 'advanced' ? 'active' : ''}
              onClick={() => changeTab('advanced')}
            >
              <Code2 size={17} />
              {messages.advanced}
            </button>
            <p className="settings-nav-label" style={{ marginTop: 16 }}>
              {messages.appSettings ?? (locale === 'tr' ? 'UYGULAMA AYARLARI' : 'APP SETTINGS')}
            </p>
            <button
              className={tab === 'language' ? 'active' : ''}
              onClick={() => changeTab('language')}
            >
              <Languages size={17} />
              {messages.language ?? (locale === 'tr' ? 'Dil' : 'Language')}
            </button>
            {client === 'desktop' && (
              <div className="account-settings-nav-footer">
                <p className="settings-nav-label">
                  {locale === 'tr' ? 'YASAL VE HESAP' : 'LEGAL & ACCOUNT'}
                </p>
                <a href="https://wapve.com/legal/privacy" target="_blank" rel="noreferrer noopener">
                  <ExternalLink size={16} />
                  {locale === 'tr' ? 'Gizlilik politikası' : 'Privacy policy'}
                </a>
                <a href="https://wapve.com/legal/terms" target="_blank" rel="noreferrer noopener">
                  <ExternalLink size={16} />
                  {locale === 'tr' ? 'Kullanım koşulları' : 'Terms of use'}
                </a>
                <button
                  type="button"
                  className="account-settings-logout"
                  onClick={() => void onLogout?.()}
                >
                  <LogOut size={17} />
                  {messages.logout}
                </button>
              </div>
            )}
          </aside>
          <section className="settings-content">
            <div className="settings-inner">
              <header className="settings-title">
                <div>
                  <span className="settings-eyebrow">
                    <Waves size={14} /> {locale === 'tr' ? 'WAPVE AYARLARI' : 'WAPVE SETTINGS'}
                  </span>
                  <Dialog.Title asChild>
                    <h2>{tabTitle}</h2>
                  </Dialog.Title>
                  <Dialog.Description
                    id="settings-description"
                    style={{ color: 'var(--text-muted)', marginTop: 6 }}
                  >
                    {messages.account}
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <button
                    className="icon-button account-settings-close"
                    aria-label={messages.close}
                  >
                    <X size={20} />
                  </button>
                </Dialog.Close>
              </header>
              {error && (
                <div className="form-error" role="alert" style={{ marginBottom: 16 }}>
                  {error}
                </div>
              )}
              {notice && (
                <div className="form-success" role="status" style={{ marginBottom: 16 }}>
                  {notice}
                </div>
              )}
              {tab === 'appearance' ? <AppearanceSettings locale={locale} desktop={client === 'desktop'} /> : tab === 'profile' ? (
                <form id="account-profile-form" onSubmit={(event) => void saveProfile(event)}>
                  <div className="settings-section account-profile-section account-profile-appearance">
                    <header className="settings-card-heading">
                      <span>
                        <Camera size={18} />
                      </span>
                      <div>
                        <h3>{locale === 'tr' ? 'Profil Görünümü' : 'Profile Appearance'}</h3>
                        <p>
                          {locale === 'tr'
                            ? 'Avatarını, afişini ve profil durumunu tek yerden düzenle.'
                            : 'Edit your avatar, banner, and profile status in one place.'}
                        </p>
                      </div>
                    </header>
                    <div className="account-profile-media-card">
                      <button
                        className="account-profile-banner-button"
                        type="button"
                        onClick={() => setMediaEditorKind('banner')}
                      >
                        {user.bannerUrl ? <img src={user.bannerUrl} alt="" /> : <span />}
                        <b>
                          <Camera size={15} />{' '}
                          {locale === 'tr' ? 'Afişi değiştir' : 'Change banner'}
                        </b>
                      </button>
                      <button
                        className="account-profile-avatar-button"
                        type="button"
                        onClick={() => setMediaEditorKind('avatar')}
                        aria-label={locale === 'tr' ? 'Avatarı değiştir' : 'Change avatar'}
                      >
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="" />
                        ) : (
                          user.displayName.slice(0, 1).toUpperCase()
                        )}
                        <span>
                          <Camera size={15} />
                        </span>
                      </button>
                      <div className="account-profile-media-copy">
                        <strong>{user.displayName}</strong>
                        <small>@{user.username}</small>
                      </div>
                    </div>
                    <div className="account-profile-details-grid">
                      <div className="field">
                        <label htmlFor="settings-profile-presence">
                          {locale === 'tr' ? 'Durum' : 'Presence'}
                        </label>
                        <select
                          id="settings-profile-presence"
                          value={profileDraft.status}
                          onChange={(event) =>
                            setProfileDraft((current) => ({
                              ...current,
                              status: event.target.value as UserProfile['status'],
                            }))
                          }
                        >
                          <option value="ONLINE">{locale === 'tr' ? 'Çevrimiçi' : 'Online'}</option>
                          <option value="IDLE">{locale === 'tr' ? 'Boşta' : 'Idle'}</option>
                          <option value="DND">
                            {locale === 'tr' ? 'Rahatsız etmeyin' : 'Do not disturb'}
                          </option>
                          <option value="INVISIBLE">
                            {locale === 'tr' ? 'Görünmez' : 'Invisible'}
                          </option>
                        </select>
                      </div>
                      <div className="field account-profile-status-field">
                        <label htmlFor="settings-profile-status">
                          {locale === 'tr' ? 'Özel durum' : 'Custom status'}
                        </label>
                        <div>
                          <StatusEmojiPicker
                            locale={locale}
                            servers={servers}
                            value={profileDraft.customStatusEmoji}
                            onSelect={(customStatusEmoji) =>
                              setProfileDraft((current) => ({ ...current, customStatusEmoji }))
                            }
                          />
                          <input
                            id="settings-profile-status"
                            value={profileDraft.customStatusText}
                            maxLength={128}
                            placeholder={locale === 'tr' ? 'Ne yapıyorsun?' : 'What are you up to?'}
                            onChange={(event) =>
                              setProfileDraft((current) => ({
                                ...current,
                                customStatusText: event.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="field account-profile-bio-field">
                        <label htmlFor="settings-profile-bio">
                          {locale === 'tr' ? 'Hakkımda' : 'About me'}
                        </label>
                        <textarea
                          id="settings-profile-bio"
                          value={profileDraft.bio}
                          maxLength={190}
                          rows={4}
                          placeholder={
                            locale === 'tr'
                              ? 'Kendinden biraz bahset…'
                              : 'Tell people a little about yourself…'
                          }
                          onChange={(event) =>
                            setProfileDraft((current) => ({ ...current, bio: event.target.value }))
                          }
                        />
                        <small>{profileDraft.bio.length}/190</small>
                      </div>
                    </div>
                  </div>
                  <div className="settings-section account-profile-section account-identity-section">
                    <header className="settings-card-heading">
                      <span>
                        <UserRound size={18} />
                      </span>
                      <div>
                        <h3>{locale === 'tr' ? 'Profili Düzenle' : 'Edit Profile'}</h3>
                        <p>
                          {locale === 'tr'
                            ? 'Görünen adını ve benzersiz kullanıcı adını buradan güncelle.'
                            : 'Update your display name and unique username here.'}
                        </p>
                      </div>
                    </header>
                    <div className="form-row">
                      <div className="field">
                        <label htmlFor="settings-display-name">{messages.displayName}</label>
                        <input
                          id="settings-display-name"
                          name="displayName"
                          minLength={1}
                          maxLength={48}
                          value={profileDraft.displayName}
                          onChange={(event) =>
                            setProfileDraft((current) => ({
                              ...current,
                              displayName: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="settings-username">{messages.username}</label>
                        <input
                          id="settings-username"
                          name="username"
                          minLength={3}
                          maxLength={32}
                          value={profileDraft.username}
                          onChange={(event) =>
                            setProfileDraft((current) => ({
                              ...current,
                              username: event.target.value.toLowerCase(),
                            }))
                          }
                          autoCapitalize="none"
                          autoCorrect="off"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </form>
              ) : tab === 'privacy' ? (
                <PrivacySettings user={user} servers={servers} locale={locale} onUser={onUser} onStateChange={setPrivacyState} />
              ) : tab === 'premium' ? (
                <PremiumCenter locale={locale} {...(onOpenStore ? { onOpenStore } : {})} />
              ) : tab === 'voice' ? (
                <VoiceVideoSettings connection={voiceConnection} messages={messages} />
              ) : tab === 'security' ? (
                <>
                  <TwoFactorSettings user={user} messages={messages} onUser={onUser} />
                  <PasskeySettings messages={messages} />
                  <form
                    className="settings-section"
                    onSubmit={(event) => void changePassword(event)}
                  >
                    <h3>{messages.password}</h3>
                    <div className="form-stack">
                      <div className="field">
                        <label htmlFor="current-password">{messages.currentPassword}</label>
                        <input
                          id="current-password"
                          name="currentPassword"
                          type="password"
                          required
                          autoComplete="current-password"
                        />
                      </div>
                      <PasswordField
                        locale={locale}
                        label={messages.newPassword}
                        name="newPassword"
                        id="new-password"
                      />
                      <Button type="submit" disabled={busy}>
                        {messages.save}
                      </Button>
                    </div>
                  </form>
                  <div className="settings-section">
                    <h3>{messages.sessions}</h3>
                    {sessions.map((session) => (
                      <div className="session-row" key={session.id}>
                        <MonitorSmartphone size={20} />
                        <div className="session-copy">
                          <strong>
                            {session.deviceName}
                            {session.current ? ` · ${messages.currentSession}` : ''}
                          </strong>
                          <span>
                            {session.browserName} · {session.osName} ·{' '}
                            {session.countryCode ??
                              (locale === 'tr' ? 'Konum bilinmiyor' : 'Unknown location')}
                          </span>
                          <small>
                            {locale === 'tr' ? 'Son etkinlik' : 'Last active'}:{' '}
                            {new Date(session.lastSeenAt).toLocaleString(locale)} ·{' '}
                            {session.loginMethod}
                          </small>
                        </div>
                        {!session.current && (
                          <Button variant="danger" onClick={() => void revokeSession(session.id)}>
                            {messages.revoke}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <AccountDeletionSettings
                    user={user}
                    onUser={onUser}
                    locale={locale}
                    messages={messages}
                  />
                </>
              ) : tab === 'advanced' ? (
                <div className="settings-section">
                  <h3>{messages.developerOptions}</h3>
                  <label className="settings-toggle" htmlFor="developer-mode">
                    <span>
                      <strong>{messages.developerMode}</strong>
                      <small>{messages.developerModeHint}</small>
                    </span>
                    <input
                      id="developer-mode"
                      type="checkbox"
                      checked={developerMode}
                      onChange={(event) => onDeveloperModeChange(event.target.checked)}
                    />
                  </label>
                  {developerMode && (
                    <div className="developer-id-row">
                      <span>
                        <small>{messages.userId}</small>
                        <code>{user.publicId}</code>
                      </span>
                      <button
                        className="icon-button"
                        onClick={() => void navigator.clipboard.writeText(user.publicId)}
                        aria-label={messages.copyUserId}
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ) : tab === 'language' ? (
                <div className="settings-section">
                  <header className="settings-card-heading">
                    <span>
                      <Languages size={18} />
                    </span>
                    <div>
                      <h3>
                        {messages.interfaceLanguage ??
                          (locale === 'tr' ? 'Arayüz Dili' : 'Interface Language')}
                      </h3>
                      <p>
                        {messages.chooseInterfaceLanguage ??
                          (locale === 'tr'
                            ? 'Wapve arayüzünde kullanmak istediğiniz dili seçin.'
                            : 'Choose the language you would like to use in Wapve.')}
                      </p>
                    </div>
                  </header>
                  <div className="language-settings-grid">
                    <button
                      type="button"
                      className={`language-card${locale === 'tr' ? ' active' : ''}`}
                      onClick={() => {
                        if (locale === 'tr') return;
                        document.cookie = 'wapve_locale=tr; Path=/; Max-Age=31536000; SameSite=Lax';
                        window.location.reload();
                      }}
                    >
                      <div className="language-card-info">
                        <span className="language-code">TR</span>
                        <div>
                          <strong>Türkçe</strong>
                          <small>Türkiye</small>
                        </div>
                      </div>
                      {locale === 'tr' && (
                        <CheckCircle2 size={18} className="language-active-icon" />
                      )}
                    </button>
                    <button
                      type="button"
                      className={`language-card${locale === 'en' ? ' active' : ''}`}
                      onClick={() => {
                        if (locale === 'en') return;
                        document.cookie = 'wapve_locale=en; Path=/; Max-Age=31536000; SameSite=Lax';
                        window.location.reload();
                      }}
                    >
                      <div className="language-card-info">
                        <span className="language-code">EN</span>
                        <div>
                          <strong>English</strong>
                          <small>United States</small>
                        </div>
                      </div>
                      {locale === 'en' && (
                        <CheckCircle2 size={18} className="language-active-icon" />
                      )}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            {saveDockPresence.mounted && (
              <div
                className={`settings-save-dock${saveDockPresence.leaving ? ' is-leaving' : ''}`}
                role="status"
              >
                <span className="settings-save-state">
                  <ShieldCheck size={18} />
                  <span>
                    <strong>
                      {locale === 'tr'
                        ? 'Kaydedilmemiş değişiklikler var'
                        : 'You have unsaved changes'}
                    </strong>
                    <small>
                      {locale === 'tr'
                        ? (tab === 'privacy' ? 'Tercihlerini güncellemek için değişiklikleri kaydet.' : 'Profilini güncellemek için değişiklikleri kaydet.')
                        : (tab === 'privacy' ? 'Save to update your preferences.' : 'Save to update your profile.')}
                    </small>
                  </span>
                </span>
                <button
                  type={tab === 'privacy' ? 'reset' : 'button'}
                  form={tab === 'privacy' ? 'account-privacy-form' : undefined}
                  className="settings-discard-button"
                  onClick={tab === 'privacy' ? undefined : resetProfileDraft}
                  disabled={saveDockBusy || saveDockPresence.leaving}
                >
                  <RotateCcw size={16} /> {locale === 'tr' ? 'Geri al' : 'Discard'}
                </button>
                <Button
                  type="submit"
                  form={tab === 'privacy' ? 'account-privacy-form' : 'account-profile-form'}
                  disabled={saveDockBusy || saveDockPresence.leaving}
                >
                  <Save size={16} /> {saveDockBusy ? messages.saving : messages.save}
                </Button>
              </div>
            )}
          </section>
        </Dialog.Content>
      </Dialog.Portal>
      {mediaEditorKind && (
        <ProfileMediaEditor
          kind={mediaEditorKind}
          open
          locale={locale}
          currentUrl={mediaEditorKind === 'avatar' ? user.avatarUrl : user.bannerUrl}
          busy={busy}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setMediaEditorKind(null);
          }}
          onApply={(file) =>
            mediaEditorKind === 'avatar' ? uploadAvatar(file) : uploadBanner(file)
          }
          onRemove={() => (mediaEditorKind === 'avatar' ? removeAvatar() : removeBanner())}
        />
      )}
    </Dialog.Root>
  );
}

function VoiceVideoSettings({
  connection,
  messages,
}: {
  connection: VoiceConnection;
  messages: Dictionary;
}) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [testingMicrophone, setTestingMicrophone] = useState(false);
  const [microphoneLevel, setMicrophoneLevel] = useState(0);
  const [capturingKey, setCapturingKey] = useState(false);
  const [capturingShortcut, setCapturingShortcut] = useState<VoiceShortcutAction | null>(null);
  const [doctorRunning, setDoctorRunning] = useState(false);
  const [doctorChecks, setDoctorChecks] = useState<VoiceDoctorCheck[]>([]);
  const testStreamRef = useRef<MediaStream | null>(null);
  const testContextRef = useRef<AudioContext | null>(null);
  const testFrameRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const next = await navigator.mediaDevices.enumerateDevices();
        if (active) setDevices(next);
      } catch {
        if (active) setDevices([]);
      }
    };
    void refresh();
    const onChange = () => void refresh();
    navigator.mediaDevices?.addEventListener?.('devicechange', onChange);
    return () => {
      active = false;
      navigator.mediaDevices?.removeEventListener?.('devicechange', onChange);
    };
  }, []);

  function stopMicrophoneTest() {
    if (testFrameRef.current !== null) cancelAnimationFrame(testFrameRef.current);
    testFrameRef.current = null;
    for (const track of testStreamRef.current?.getTracks() ?? []) track.stop();
    testStreamRef.current = null;
    void testContextRef.current?.close();
    testContextRef.current = null;
    setTestingMicrophone(false);
    setMicrophoneLevel(0);
  }

  useEffect(() => stopMicrophoneTest, []);

  async function toggleMicrophoneTest() {
    if (testingMicrophone) {
      stopMicrophoneTest();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(connection.audioInputDeviceId !== 'default'
            ? { deviceId: { exact: connection.audioInputDeviceId } }
            : {}),
          echoCancellation: connection.echoCancellation,
          noiseSuppression: connection.noiseSuppression,
          autoGainControl: connection.autoGainControl,
        },
        video: false,
      });
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const samples = new Uint8Array(analyser.frequencyBinCount);
      testStreamRef.current = stream;
      testContextRef.current = context;
      setTestingMicrophone(true);
      const measure = () => {
        analyser.getByteFrequencyData(samples);
        const average = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
        setMicrophoneLevel(Math.min(100, Math.round((average / 110) * 100)));
        testFrameRef.current = requestAnimationFrame(measure);
      };
      measure();
      setDevices(await navigator.mediaDevices.enumerateDevices());
    } catch {
      setTestingMicrophone(false);
    }
  }

  async function testOutput() {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const destination = context.createMediaStreamDestination();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.75);
    oscillator.frequency.setValueAtTime(523.25, context.currentTime);
    oscillator.connect(gain);
    gain.connect(destination);
    const audio = document.createElement('audio') as HTMLAudioElement & {
      setSinkId?: (id: string) => Promise<void>;
    };
    audio.srcObject = destination.stream;
    audio.volume = connection.audioOutputVolume;
    if (audio.setSinkId)
      await audio.setSinkId(connection.audioOutputDeviceId).catch(() => undefined);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.8);
    await audio.play();
    window.setTimeout(() => {
      audio.pause();
      for (const track of destination.stream.getTracks()) track.stop();
      void context.close();
    }, 950);
  }

  async function runDoctor() {
    setDoctorRunning(true);
    setDoctorChecks([]);
    try {
      setDoctorChecks(await connection.runDoctor());
    } finally {
      setDoctorRunning(false);
    }
  }

  const inputs = devices.filter((device) => device.kind === 'audioinput');
  const outputs = devices.filter((device) => device.kind === 'audiooutput');

  return (
    <div className="settings-section voice-video-settings">
      <h3>{messages.voiceAndVideo}</h3>
      <div className="voice-settings-grid">
        <label className="field">
          <span>{messages.audioInputDevice}</span>
          <select
            value={connection.audioInputDeviceId}
            onChange={(event) => void connection.selectAudioInputDevice(event.target.value)}
          >
            <option value="default">{messages.systemDefault}</option>
            {inputs
              .filter((device) => device.deviceId !== 'default')
              .map((device, index) => (
                <option value={device.deviceId} key={device.deviceId}>
                  {device.label || `${messages.microphone} ${index + 1}`}
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          <span>{messages.audioOutputDevice}</span>
          <select
            value={connection.audioOutputDeviceId}
            onChange={(event) => connection.selectAudioOutputDevice(event.target.value)}
          >
            <option value="default">{messages.systemDefault}</option>
            {outputs
              .filter((device) => device.deviceId !== 'default')
              .map((device, index) => (
                <option value={device.deviceId} key={device.deviceId}>
                  {device.label || `${messages.speaker} ${index + 1}`}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="voice-test-card">
        <div>
          <Mic size={19} />
          <span>
            <strong>{messages.microphoneTest}</strong>
            <small>{messages.microphoneTestHint}</small>
          </span>
        </div>
        <div className="microphone-test-meter">
          <i style={{ width: `${microphoneLevel}%` }} />
        </div>
        <Button type="button" variant="secondary" onClick={() => void toggleMicrophoneTest()}>
          {testingMicrophone ? messages.stopTest : messages.startTest}
        </Button>
      </div>
      <section className="voice-doctor-card">
        <header>
          <span>
            <Activity size={21} />
          </span>
          <div>
            <strong>{messages.voiceDoctor}</strong>
            <small>{messages.voiceDoctorHint}</small>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={doctorRunning}
            onClick={() => void runDoctor()}
          >
            {doctorRunning ? messages.testing : messages.runVoiceDoctor}
          </Button>
        </header>
        {doctorChecks.length > 0 && (
          <div className="voice-doctor-results">
            {doctorChecks.map((check) => (
              <div className={`voice-doctor-result ${check.status.toLowerCase()}`} key={check.key}>
                {check.status === 'PASS' ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                <span>
                  <strong>{messages.voiceDoctorChecks[check.key]}</strong>
                  <small>{check.detail}</small>
                </span>
                <b>{messages.voiceDoctorStatuses[check.status]}</b>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="voice-test-card">
        <div>
          <Volume2 size={19} />
          <span>
            <strong>{messages.speakerTest}</strong>
            <small>{messages.speakerTestHint}</small>
          </span>
        </div>
        <label className="voice-output-slider">
          <span>{messages.outputVolume}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(connection.audioOutputVolume * 100)}
            onChange={(event) => connection.setAudioOutputVolume(Number(event.target.value) / 100)}
          />
        </label>
        <Button type="button" variant="secondary" onClick={() => void testOutput()}>
          {messages.playTestSound}
        </Button>
      </div>
      <div className="voice-settings-options">
        <label className="settings-toggle">
          <span>
            <strong>{messages.pushToTalk}</strong>
            <small>{messages.pushToTalkHint}</small>
          </span>
          <input
            type="checkbox"
            checked={connection.pushToTalk}
            onChange={(event) => connection.setPushToTalk(event.target.checked)}
          />
        </label>
        {connection.pushToTalk && (
          <div className="voice-keybind-row">
            <span>{messages.pushToTalkKey}</span>
            <button
              type="button"
              data-shortcut-capture="true"
              className={capturingKey ? 'capturing' : ''}
              onClick={() => setCapturingKey(true)}
              onKeyDown={(event) => {
                if (!capturingKey) return;
                event.preventDefault();
                event.stopPropagation();
                connection.setPushToTalkKey(event.code);
                setCapturingKey(false);
              }}
            >
              {capturingKey ? messages.pressAnyKey : connection.pushToTalkKey}
            </button>
          </div>
        )}
        <label className="settings-toggle">
          <span>
            <strong>{messages.echoCancellation}</strong>
            <small>{messages.echoCancellationHint}</small>
          </span>
          <input
            type="checkbox"
            checked={connection.echoCancellation}
            onChange={(event) => connection.setEchoCancellation(event.target.checked)}
          />
        </label>
        <label className="settings-toggle">
          <span>
            <strong>{messages.noiseSuppression}</strong>
            <small>{messages.noiseSuppressionHint}</small>
            {connection.noiseSuppression && (
              <small className="voice-enhancement-state">
                {connection.speechEnhancementActive
                  ? messages.speechEnhancementActive
                  : messages.speechEnhancementReady}
              </small>
            )}
          </span>
          <input
            type="checkbox"
            checked={connection.noiseSuppression}
            onChange={(event) => connection.setNoiseSuppression(event.target.checked)}
          />
        </label>
        <label className="settings-toggle">
          <span>
            <strong>{messages.autoGainControl}</strong>
            <small>{messages.autoGainControlHint}</small>
          </span>
          <input
            type="checkbox"
            checked={connection.autoGainControl}
            onChange={(event) => connection.setAutoGainControl(event.target.checked)}
          />
        </label>
      </div>
      <section className="voice-shortcut-settings">
        <header>
          <div>
            <strong>{messages.keyboardShortcuts}</strong>
            <small>{messages.keyboardShortcutsHint}</small>
          </div>
          <Button type="button" variant="secondary" onClick={connection.resetShortcuts}>
            {messages.resetShortcuts}
          </Button>
        </header>
        <div className="voice-shortcut-list">
          {voiceShortcutActions.map((action) => {
            const labels: Record<VoiceShortcutAction, string> = {
              toggleMute: messages.shortcutToggleMute,
              toggleDeafen: messages.shortcutToggleDeafen,
              toggleCamera: messages.shortcutToggleCamera,
              toggleScreenShare: messages.shortcutToggleScreenShare,
              toggleVideoPause: messages.shortcutToggleVideoPause,
              disconnect: messages.shortcutDisconnect,
            };
            return (
              <div className="voice-shortcut-row" key={action}>
                <span>{labels[action]}</span>
                <button
                  type="button"
                  data-shortcut-capture="true"
                  className={capturingShortcut === action ? 'capturing' : ''}
                  onClick={() => setCapturingShortcut(action)}
                  onKeyDown={(event) => {
                    if (capturingShortcut !== action) return;
                    event.preventDefault();
                    event.stopPropagation();
                    if (event.code === 'Escape' || event.code === 'Backspace') {
                      connection.setShortcut(action, null);
                      setCapturingShortcut(null);
                      return;
                    }
                    const binding = shortcutFromKeyboardEvent(event.nativeEvent);
                    if (!binding) return;
                    connection.setShortcut(action, binding);
                    setCapturingShortcut(null);
                  }}
                >
                  {capturingShortcut === action
                    ? messages.pressAnyKey
                    : formatVoiceShortcut(connection.shortcuts[action])}
                </button>
                <button
                  type="button"
                  className="voice-shortcut-clear"
                  onClick={() => connection.setShortcut(action, null)}
                  disabled={!connection.shortcuts[action]}
                  aria-label={`${messages.clearShortcut}: ${labels[action]}`}
                >
                  <X size={15} />
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
