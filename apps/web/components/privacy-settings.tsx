'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  readPrivacySettings,
  type PrivacySettings as Settings,
  type ServerSummary,
  type UserProfile,
} from '@wapve/contracts';
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
  RotateCcw,
  LoaderCircle,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import styles from './privacy-settings.module.css';

function Toggle({
  title,
  hint,
  checked,
  onChange,
  disabled = false,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={styles.toggle}>
      <span>
        <strong>{title}</strong>
        <small>{hint}</small>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <header>
        <h3>{title}</h3>
        <p>{hint}</p>
      </header>
      {children}
    </section>
  );
}
const preferences = (user: UserProfile) => ({
  showMutualFriends: user.showMutualFriends,
  showMutualServers: user.showMutualServers,
  showBadgesInChat: user.showBadgesInChat,
  autoConvertEmoticons: user.autoConvertEmoticons,
});
export function PrivacySettings({
  user,
  servers,
  locale,
  onUser,
  onStateChange,
}: {
  user: UserProfile;
  servers: ServerSummary[];
  locale: 'tr' | 'en';
  onUser: (user: UserProfile) => void;
  onStateChange?: (state: {dirty:boolean;busy:boolean}) => void;
}) {
  const tr = locale === 'tr';
  const queryClient = useQueryClient();
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<Settings>(() => readPrivacySettings(user.privacy));
  const [saved, setSaved] = useState(draft);
  const [prefs, setPrefs] = useState(() => preferences(user));
  const [savedPrefs, setSavedPrefs] = useState(prefs);
  const [section, setSection] = useState<'profile' | 'contact' | 'media'>('profile');
  const [serverId, setServerId] = useState('');
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const busyRef = useRef(false);
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(saved) ||
    JSON.stringify(prefs) !== JSON.stringify(savedPrefs);
  useEffect(()=>{onStateChange?.({dirty,busy});},[dirty,busy,onStateChange]);
  useEffect(()=>()=>onStateChange?.({dirty:false,busy:false}),[onStateChange]);
  async function load() {
    setLoading(true);
    setError('');
    try {
      const next = await apiRequest<Settings>('/users/me/privacy');
      setDraft(next);
      setSaved(next);
      setLoaded(true);
    } catch {
      setError(
        tr
          ? 'Gizlilik ayarları yüklenemedi. Tekrar deneyebilirsin.'
          : 'Could not load privacy settings. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  function change<K extends keyof Settings>(key: K, value: Settings[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice('');
  }
  async function save() {
    if (busyRef.current || !dirty || !loaded) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await apiRequest<Settings>('/users/me/privacy', {
        method: 'PATCH',
        body: JSON.stringify(draft),
      });
      const nextUser =
        JSON.stringify(prefs) !== JSON.stringify(savedPrefs)
          ? await apiRequest<UserProfile>('/users/me', {
              method: 'PATCH',
              body: JSON.stringify(prefs),
            })
          : { ...user, privacy: next };
      setSaved(next);
      setDraft(next);
      setSavedPrefs(prefs);
      onUser({ ...nextUser, privacy: next });
      setNotice(
        tr ? 'Gizlilik tercihlerin kaydedildi.' : 'Your privacy preferences have been saved.',
      );
      queryClient.setQueryData(['privacy-settings', user.id], next);
      await queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
    } catch {
      setError(
        tr
          ? 'Kaydetme tamamlanamadı. Değişikliklerin burada; tekrar deneyebilirsin.'
          : 'Could not finish saving. Your changes are still here; please try again.',
      );
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }
  const override = draft.serverOverrides.find((item) => item.serverId === serverId);
  const directAllowed = override?.allowDirectMessages ?? draft.allowServerDirectMessages;
  const filterRequests = override?.filterMessageRequests ?? draft.filterMessageRequests;
  function changeDirect(key: 'allowDirectMessages' | 'filterMessageRequests', value: boolean) {
    if (!serverId) {
      change(
        key === 'allowDirectMessages' ? 'allowServerDirectMessages' : 'filterMessageRequests',
        value,
      );
      return;
    }
    change('serverOverrides', [
      ...draft.serverOverrides.filter((item) => item.serverId !== serverId),
      {
        serverId,
        allowDirectMessages: directAllowed,
        filterMessageRequests: filterRequests,
        [key]: value,
      },
    ]);
  }
  if (loading)
    return (
      <div className={styles.loading} role="status">
        <LoaderCircle className="spin" size={24} />
        {tr ? 'Tercihlerin yükleniyor…' : 'Loading your preferences…'}
      </div>
    );
  if (!loaded)
    return (
      <div className={styles.error} role="alert">
        {error}
        <button type="button" onClick={() => void load()}>
          {tr ? 'Tekrar dene' : 'Try again'}
        </button>
      </div>
    );
  return (
    <form id="account-privacy-form" className={styles.center}
      onSubmit={(event) => { event.preventDefault(); void save(); }}
      onReset={(event) => { event.preventDefault(); if (busyRef.current) return; setDraft(saved); setPrefs(savedPrefs); setError(''); setNotice(''); }}
    >
      <header className={styles.hero}>
        <span className={styles.heroIcon}>
          <ShieldCheck size={25} />
        </span>
        <div>
          <small>WAPVE / {tr ? 'DALGA KONTROLÜ' : 'WAVE CONTROL'}</small>
          <h2>{tr ? 'Kimin ne göreceğine sen karar ver.' : 'You set the pace of what people see.'}</h2>
          <p>
            {tr
              ? 'Profilini, sohbet akışını ve görsel paylaşımları kendi ritmine göre düzenle.'
              : 'Shape your profile, conversations, and visual flow around your own pace.'}
          </p>
        </div>
      </header>
      <nav className={styles.tabs} aria-label={tr ? 'Gizlilik bölümleri' : 'Privacy sections'}>
        {(
          [
            { id: 'profile', label: tr ? 'Profil görünümü' : 'Profile view', icon: UserRound },
            {
              id: 'contact',
              label: tr ? 'Sohbet erişimi' : 'Chat access',
              icon: Mail,
            },
            { id: 'media', label: tr ? 'Medya akışı' : 'Media flow', icon: Eye },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            aria-pressed={section === id}
            onClick={() => setSection(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <div className={styles.error} role="alert">
          {error}
          <button type="button" onClick={() => void (dirty ? save() : load())} disabled={busy}>
            {tr ? 'Tekrar dene' : 'Try again'}
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      <fieldset className={styles.fields} disabled={busy}>
        {section === 'profile' && (
          <>
            <Section
              title={tr ? 'Detaylı profilimi kimler görebilir?' : 'Who can see my detailed profile?'}
              hint={
                tr
                  ? 'Biyografin, özel durumun ve rozetlerin bu tercihe göre paylaşılır. Avatarın, afişin, kullanıcı adın ve görünen adın görünür kalır.'
                  : 'This controls your bio, custom status, and badges. Your avatar, banner, username, and display name stay visible.'
              }
            >
              <div className={styles.choices}>
                {(
                  [
                    {
                      value: 'FRIENDS_AND_SERVERS',
                      title: tr ? 'Arkadaşlar + ortak sunucular' : 'Friends + shared servers',
                      hint: tr
                        ? 'Arkadaşların ve aynı sunucuda olduğun kişiler tam profilini görür.'
                        : 'Friends and people in your shared servers can see your full profile.',
                    },
                    {
                      value: 'FRIENDS_AND_SMALL_SERVERS',
                      title: tr ? 'Arkadaşlar + küçük topluluklar' : 'Friends + small communities',
                      hint: tr
                        ? 'Arkadaşların ve en fazla 200 üyeli ortak sunuculardaki kişiler.'
                        : 'Friends and people in shared servers with up to 200 members.',
                    },
                    {
                      value: 'FRIENDS_ONLY',
                      title: tr ? 'Yalnızca arkadaş çevrem' : 'My friend circle only',
                      hint: tr
                        ? 'Diğer kişiler sınırlı profilini ve kısa bir erişim notunu görür.'
                        : 'Everyone else sees a limited profile with a short access note.',
                    },
                  ] as const
                ).map((option) => (
                  <label className={styles.choice} key={option.value}>
                    <input
                      type="radio"
                      name="profile-visibility"
                      checked={draft.profileVisibility === option.value}
                      onChange={() => change('profileVisibility', option.value)}
                    />
                    <span>
                      <strong>{option.title}</strong>
                      <small>{option.hint}</small>
                    </span>
                  </label>
                ))}
              </div>
              <div className={styles.preview}>
                <LockKeyhole size={23} />
                <div>
                  <strong>{tr ? 'Sınırlı profil görünümü' : 'Limited profile view'}</strong>
                  <p>
                    {tr
                      ? 'Bu profil sınırlı görünüyor. Daha fazlası için bağlantı kurabilirsiniz.'
                      : 'This profile is limited. Connect to see more.'}
                  </p>
                </div>
              </div>
            </Section>
            <Section
              title={tr ? 'Ortak dalgalar' : 'Shared waves'}
              hint={
                tr
                  ? 'Ortak bağlantılarını profilinden bağımsız olarak yönet.'
                  : 'Control mutual connections separately from your full profile.'
              }
            >
              <Toggle
                title={tr ? 'Ortak arkadaşları göster' : 'Show shared friends'}
                hint={
                  tr
                    ? 'Yalnızca ikinizin de arkadaş olduğu kişiler gösterilir.'
                    : 'Only friends you both share are shown.'
                }
                checked={prefs.showMutualFriends}
                onChange={(value) =>
                  setPrefs((current) => ({ ...current, showMutualFriends: value }))
                }
              />
              <Toggle
                title={tr ? 'Ortak toplulukları göster' : 'Show shared communities'}
                hint={
                  tr
                    ? 'Yalnızca ikinizin de üye olduğu sunucular gösterilir.'
                    : 'Only servers you both belong to are shown.'
                }
                checked={prefs.showMutualServers}
                onChange={(value) =>
                  setPrefs((current) => ({ ...current, showMutualServers: value }))
                }
              />
            </Section>
          </>
        )}
        {section === 'contact' && (
          <>
            <Section
              title={tr ? 'Sohbet erişimi' : 'Chat access'}
              hint={
                tr
                  ? 'Arkadaşların sana mesaj gönderebilir. Diğer kişiler için ortak sunucularının izinleri uygulanır.'
                  : 'Friends can message you. Shared-server permissions apply to everyone else.'
              }
            >
              <label className={styles.select}>
                <span>{tr ? 'Hangi sunucu için?' : 'Apply to'}</span>
                <select value={serverId} onChange={(e) => setServerId(e.target.value)}>
                  <option value="">
                    {tr ? 'Varsayılan · tüm sunucular' : 'Default · all servers'}
                  </option>
                  {servers.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className={styles.hint}>
                {serverId
                  ? override
                    ? tr
                      ? 'Bu sunucu için özel tercihler kullanılıyor.'
                      : 'Custom preferences apply to this server.'
                    : tr
                      ? 'Bu sunucu varsayılan tercihlerini kullanıyor.'
                      : 'This server uses your defaults.'
                  : tr
                    ? 'Mevcut ve yeni sunucularına uygulanır. Özel tercihi olan sunucular değişmez.'
                    : 'Applies to current and new servers. Servers with custom preferences keep their settings.'}
              </p>
              <Toggle
                title={tr ? 'Ortak sunuculardan sohbet al' : 'Allow chats from shared servers'}
                hint={
                  tr
                    ? 'Kapalıyken bu sunucudaki arkadaş olmayan kişiler sana yeni sohbet başlatamaz.'
                    : 'When off, non-friends in this server cannot start a new chat with you.'
                }
                checked={directAllowed}
                onChange={(value) => changeDirect('allowDirectMessages', value)}
              />
              <Toggle
                title={
                  tr
                    ? 'Yeni sohbetleri istek kutusuna al'
                    : 'Route new chats to requests'
                }
                hint={
                  tr
                    ? 'Yeni sohbetler ayrı kutuya gider; kabul edene kadar ana akışını bölmez.'
                    : 'New chats go to a separate inbox and stay out of your main flow until accepted.'
                }
                checked={filterRequests}
                disabled={!directAllowed}
                onChange={(value) => changeDirect('filterMessageRequests', value)}
              />
              {override && (
                <button
                  type="button"
                  className={styles.reset}
                  onClick={() =>
                    change(
                      'serverOverrides',
                      draft.serverOverrides.filter((item) => item.serverId !== serverId),
                    )
                  }
                >
                  <RotateCcw size={14} />
                  {tr ? 'Bu sunucuda varsayılanı kullan' : 'Use defaults for this server'}
                </button>
              )}
            </Section>
            <Section
              title={tr ? 'Arkadaşlık isteği kaynakları' : 'Friend request sources'}
              hint={
                tr
                  ? 'Tüm seçenekleri kapatırsan yeni arkadaşlık isteği almazsın. Mevcut arkadaşların etkilenmez.'
                  : 'Turn all options off to stop new friend requests. Existing friendships stay unchanged.'
              }
            >
              <Toggle
                title={tr ? 'Açık dalga' : 'Open wave'}
                hint={
                  tr
                    ? 'Kullanıcı adını bilen kişiler istek gönderebilir.'
                    : 'Anyone who knows your username can send a request.'
                }
                checked={draft.friendRequestsEveryone}
                onChange={(value) => change('friendRequestsEveryone', value)}
              />
              <Toggle
                title={tr ? 'Ortak arkadaş çevresi' : 'Shared friend circle'}
                hint={
                  tr
                    ? 'En az bir ortak arkadaşınız varsa.'
                    : 'People with at least one mutual friend.'
                }
                disabled={draft.friendRequestsEveryone}
                checked={draft.friendRequestsMutualFriends}
                onChange={(value) => change('friendRequestsMutualFriends', value)}
              />
              <Toggle
                title={tr ? 'Aynı topluluktaki kişiler' : 'People in the same community'}
                hint={
                  tr
                    ? 'Sohbet alımına izin verdiğin ortak sunuculardaki kişiler.'
                    : 'People in shared servers where you allow new chats.'
                }
                disabled={draft.friendRequestsEveryone}
                checked={draft.friendRequestsServerMembers}
                onChange={(value) => change('friendRequestsServerMembers', value)}
              />
            </Section>
            <Section
              title={tr ? 'Akış filtresi' : 'Flow filter'}
              hint={
                tr
                  ? 'Tekrarlanan mesajlar ve yoğun bağlantı paylaşımı gibi belirgin sinyalleri kullanan temel filtre. Şüpheli konuşmalar ayrı akışa alınır; istediğin zaman kabul edebilirsin.'
                  : 'A basic filter for clear signals such as repeated messages and many links. Suspicious conversations move to a separate flow, where you can accept them.'
              }
            >
              <label className={styles.select}>
                <span>{tr ? 'Kimlerden gelen mesajlar?' : 'Filter messages from'}</span>
                <select
                  value={draft.spamFilter}
                  onChange={(e) => change('spamFilter', e.target.value as Settings['spamFilter'])}
                >
                  <option value="ALL">{tr ? 'Tüm akış' : 'All incoming flow'}</option>
                  <option value="NON_FRIENDS">
                    {tr ? 'Arkadaş olmayan kişiler' : 'Non-friends'}
                  </option>
                  <option value="OFF">{tr ? 'Filtreleme' : 'No filtering'}</option>
                </select>
              </label>
            </Section>
          </>
        )}
        {section === 'media' && (
          <>
            <Section
              title={tr ? 'Görsel akışın' : 'Your visual flow'}
              hint={
                tr
                  ? 'Görseller, videolar ve GIF’ler için tercihlerini seç. Bu ayarlar medyanın içeriğini otomatik sınıflandırmaz; seçtiğin kaynaktaki tüm görsel medyaya uygulanır.'
                  : 'Choose how images, videos, and GIFs appear. These controls do not classify content; they apply to all visual media from each source.'
              }
            >
              {(
                [
                  {
                    key: 'mediaFriends',
                    label: tr ? 'Arkadaş sohbetleri' : 'Friend conversations',
                  },
                  {
                    key: 'mediaOthers',
                    label: tr ? 'Yeni kişilerden gelen sohbetler' : 'Conversations from new people',
                  },
                  {
                    key: 'mediaServers',
                    label: tr ? 'Sunucu ve grup akışı' : 'Server and group flow',
                  },
                ] as const
              ).map((item) => (
                <label key={item.key} className={styles.mediaRow}>
                  <span>
                    <EyeOff size={17} />
                    {item.label}
                  </span>
                  <select
                    aria-label={item.label}
                    value={draft[item.key]}
                    onChange={(e) => change(item.key, e.target.value as Settings['mediaFriends'])}
                  >
                    <option value="SHOW">{tr ? 'Göster' : 'Show'}</option>
                    <option value="HIDE">
                      {tr ? 'Tıklayana kadar gizle' : 'Hide until opened'}
                    </option>
                    <option value="BLOCK">{tr ? 'Gösterme' : 'Do not display'}</option>
                  </select>
                </label>
              ))}
              <p className={styles.hint}>
                {tr
                  ? '“Gösterme” seçeneğinde medya yüklenmez. Açmak için buradaki tercihini değiştirmen gerekir.'
                  : 'With “Do not display”, media is not loaded. Change this preference to view it.'}
              </p>
            </Section>
            <Section
              title={tr ? 'Sohbet dokunuşları' : 'Chat touches'}
              hint={
                tr
                  ? 'Mesajlarındaki küçük detayları da sen seç.'
                  : 'Choose the little details in your messages.'
              }
            >
              <Toggle
                title={tr ? 'Sohbette rozetlerimi göster' : 'Show my badges in chat'}
                hint={
                  tr
                    ? 'Profil görünümün kısıtlıysa rozetlerin yine gizli kalır.'
                    : 'Badges stay hidden when your profile view is restricted.'
                }
                checked={prefs.showBadgesInChat}
                onChange={(value) =>
                  setPrefs((current) => ({ ...current, showBadgesInChat: value }))
                }
              />
              <Toggle
                title={tr ? 'İfadeleri emojiye dönüştür' : 'Convert emoticons to emoji'}
                hint={
                  tr
                    ? ':) ve <3 gibi ifadeleri otomatik dönüştür.'
                    : 'Automatically convert emoticons such as :) and <3.'
                }
                checked={prefs.autoConvertEmoticons}
                onChange={(value) =>
                  setPrefs((current) => ({ ...current, autoConvertEmoticons: value }))
                }
              />
            </Section>
          </>
        )}
      </fieldset>

    </form>
  );
}
