import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import webEn from '../../../web/messages/en.json';
import webTr from '../../../web/messages/tr.json';
import generatedMobileEnglish from './mobile-literals.en.json';
const normalizedMobileEnglish = new Map(Object.entries(generatedMobileEnglish).map(([source, target]) => [source.replace(/\s+/gu, ' ').trim(), target]));

export type Locale = 'tr' | 'en';
let activeLocale: Locale = 'tr';

const mobileMessages = {
  tr: {
    chat: 'Sohbet', notifications: 'Bildirimler', you: 'Sen', login: 'Giriş yap', register: 'Hesap oluştur',
    identifier: 'E-posta veya kullanıcı adı', password: 'Parola', forgotPassword: 'Parolanı mı unuttun?',
    welcome: 'Dalgana yeniden katıl.', noAccount: 'Wapve’de yeni misin?', continue: 'Devam et',
    servers: 'Sunucular', directMessages: 'Özel mesajlar', friends: 'Arkadaşlar', search: 'Ara',
    offlineTitle: 'Dalga koptu', offlineBody: 'Ağı dinliyoruz. Bağlantı gelince kaldığın yerden devam edeceksin.',
    retrying: 'Tekrar bağlanılıyor…', retry: 'Şimdi dene', scanQr: 'QR ile bilgisayara giriş',
    qrPermission: 'QR kodunu okuyabilmek için kamera izni gerekiyor.', allowCamera: 'Kameraya izin ver',
    approveLogin: 'Bu bilgisayarda oturum açılsın mı?', approve: 'Onayla', reject: 'Vazgeç',
    homeEmpty: 'Sohbetlerini, gruplarını ve sunucularını tek dalgada bul.', openDrawer: 'Sohbet çekmecesini aç',
    profile: 'Profil', settings: 'Ayarlar', logout: 'Çıkış yap', accessibility: 'Erişilebilirlik',
    loading: 'Wapve hazırlanıyor…', twoFactor: 'İki adımlı doğrulama', code: '6 haneli kod veya kurtarma kodu',
    call: 'Ara', members: 'Üyeler', messagePlaceholder: 'Mesaj gönder', send: 'Gönder',
    searchEverywhere: 'Wapve’de ara', searchAllDescription: 'Bütün sonuç türlerini göster',
    searchPeopleDescription: 'Arkadaşlar ve özel konuşmalar', conversations: 'Konuşmalar',
    searchConversationsDescription: 'Özel mesajlar ve gruplar', searchServersDescription: 'Katıldığın sunucular',
    searchChannelsDescription: 'Metin ve ses kanalları', searchMessagesDescription: 'DM, grup ve kanal mesajları',
    searchFilter: 'Arama filtresi', searchingEverywhere: 'Kanallar ve konuşmalar aranıyor…',
    searchMinimum: 'Mesaj aramak için en az iki karakter yaz.', noSearchResults: 'Sonuç bulunamadı',
    noSearchResultsBody: 'Arama ifadesini veya seçili filtreyi değiştirmeyi dene.',
    findOnWapve: 'Wapve’de bul', findOnWapveBody: 'Kişiler, konuşmalar, sunucular, kanallar ve bütün mesajların arasında tek yerden ara.',
    privateMessage: 'Özel mesaj', group: 'Grup', voice: 'Ses', textChannel: 'Metin', clearSearch: 'Aramayı temizle',
    uploadProgress: '%{percent} yükleniyor', uploadTooLarge: '{name} 25 MB sınırını aşıyor. Daha küçük bir dosya seç.',
    uploadLimit: 'Tek seferde en fazla {count} dosya gönderebilirsin.',
    socialUnreadLabel: '{title}, {count} okunmamış mesaj', ageRestrictedChannel: '18 yaş ve üzeri kanal',
  },
  en: {
    chat: 'Chat', notifications: 'Notifications', you: 'You', login: 'Log in', register: 'Create account',
    identifier: 'Email or username', password: 'Password', forgotPassword: 'Forgot password?',
    welcome: 'Rejoin your wave.', noAccount: 'New to Wapve?', continue: 'Continue',
    servers: 'Servers', directMessages: 'Direct messages', friends: 'Friends', search: 'Search',
    offlineTitle: 'The wave dropped', offlineBody: 'We are listening for the network. You will resume where you left off.',
    retrying: 'Reconnecting…', retry: 'Try now', scanQr: 'Log in to a computer with QR',
    qrPermission: 'Camera permission is required to scan the QR code.', allowCamera: 'Allow camera',
    approveLogin: 'Log in on this computer?', approve: 'Approve', reject: 'Cancel',
    homeEmpty: 'Find your chats, groups and servers in one wave.', openDrawer: 'Open chat drawer',
    profile: 'Profile', settings: 'Settings', logout: 'Log out', accessibility: 'Accessibility',
    loading: 'Preparing Wapve…', twoFactor: 'Two-factor authentication', code: '6-digit or recovery code',
    call: 'Call', members: 'Members', messagePlaceholder: 'Send a message', send: 'Send',
    searchEverywhere: 'Search Wapve', searchAllDescription: 'Show every result type',
    searchPeopleDescription: 'Friends and direct conversations', conversations: 'Conversations',
    searchConversationsDescription: 'Direct messages and groups', searchServersDescription: 'Servers you have joined',
    searchChannelsDescription: 'Text and voice channels', searchMessagesDescription: 'DM, group, and channel messages',
    searchFilter: 'Search filter', searchingEverywhere: 'Searching channels and conversations…',
    searchMinimum: 'Type at least two characters to search messages.', noSearchResults: 'No results found',
    noSearchResultsBody: 'Try changing the search phrase or selected filter.',
    findOnWapve: 'Find on Wapve', findOnWapveBody: 'Search people, conversations, servers, channels, and all messages in one place.',
    privateMessage: 'Direct message', group: 'Group', voice: 'Voice', textChannel: 'Text', clearSearch: 'Clear search',
    uploadProgress: '{percent}% uploading', uploadTooLarge: '{name} exceeds the 25 MB limit. Choose a smaller file.',
    uploadLimit: 'You can send up to {count} files at once.',
    socialUnreadLabel: '{title}, {count} unread messages', ageRestrictedChannel: 'Age-restricted channel',
  },
} as const;

const messages = {
  tr: { ...webTr, ...mobileMessages.tr },
  en: { ...webEn, ...mobileMessages.en },
} as const;

export type MessageKey = string;
export type TranslationValues = Record<string, string | number>;
type I18nContextValue = {
  locale: Locale;
  setLocale(locale: Locale): void;
  t(key: MessageKey, values?: TranslationValues): string;
  translateLiteral(value: string): string;
};
const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: PropsWithChildren) {
  const system = getLocales()[0]?.languageCode === 'en' ? 'en' : 'tr';
  const [locale, setLocale] = useState<Locale>(system);
  activeLocale = locale;
  useEffect(() => {
    void SecureStore.getItemAsync('wapve.locale.v1').then((saved) => {
      if (saved === 'tr' || saved === 'en') setLocale(saved);
    });
  }, []);
  const selectLocale = useCallback((next: Locale) => {
    setLocale(next);
    void SecureStore.setItemAsync('wapve.locale.v1', next);
  }, []);
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: selectLocale,
      t: (key, values) => interpolate(resolveMessage(messages[locale], key) ?? key, values),
      translateLiteral: (input) => translateLiteralForLocale(input, locale),
    }),
    [locale, selectLocale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

const literalKeyByTurkish = new Map<string, string>();
const foldedLiteralKeyByTurkish = new Map<string, string>();
const templateLiteralTranslations: Array<{ pattern: RegExp; names: string[]; key: string }> = [];
function indexLiterals(value: unknown, prefix = '') {
  if (typeof value === 'string') {
    if (!literalKeyByTurkish.has(value)) literalKeyByTurkish.set(value, prefix);
    const folded = value.toLocaleLowerCase('tr');
    if (!foldedLiteralKeyByTurkish.has(folded)) foldedLiteralKeyByTurkish.set(folded, prefix);
    const names = [...value.matchAll(/\{([A-Za-z0-9_]+)\}/gu)]
      .map((match) => match[1])
      .filter((name): name is string => Boolean(name));
    if (names.length && value.replace(/\{[A-Za-z0-9_]+\}/gu, '').trim().length >= 2) {
      const parts = value.split(/\{[A-Za-z0-9_]+\}/gu).map(escapeRegex);
      const source = parts.map((part, index) => index < names.length ? `${part}(.+?)` : part).join('');
      templateLiteralTranslations.push({ pattern: new RegExp(`^${source}$`, 'u'), names, key: prefix });
    }
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) indexLiterals(child, prefix ? `${prefix}.${key}` : key);
}
indexLiterals(messages.tr);
templateLiteralTranslations.sort((left, right) => right.pattern.source.length - left.pattern.source.length);

const mobileLiteralEnglish: Record<string, string> = {
  'Bu cihazı doğrulamak için e-postana gönderdiğimiz bağlantıyı aç, sonra yeniden giriş yap.':
    'Open the link we sent to your email to verify this device, then sign in again.',
  'Geri': 'Back',
  'Kapat': 'Close',
  'Vazgeç': 'Cancel',
  'Kaydet': 'Save',
  'Sil': 'Delete',
  'Düzenle': 'Edit',
  'Açık': 'On',
  'Süresiz': 'Forever',
  'Yükleniyor…': 'Loading…',
  'İşlem yapılıyor…': 'Working…',
  'Kullanıcı bulunamadı': 'User not found',
  'Kullanıcı işlemleri': 'User actions',
  'Profili görüntüle': 'View profile',
  'Mesaj gönder': 'Send message',
  'Arkadaş ekle': 'Add friend',
  'Arkadaşlıktan çıkar': 'Remove friend',
  'Kullanıcıyı engelle': 'Block user',
  'Engeli kaldır': 'Unblock',
  'Kullanıcıyı bildir': 'Report user',
  'Sunucuya davet et': 'Invite to server',
  'Gelen': 'Incoming',
  'Giden': 'Outgoing',
  'Engellenen': 'Blocked',
  'Tüm arkadaşlar': 'All friends',
  'Gelen istekler': 'Incoming requests',
  'Giden istekler': 'Outgoing requests',
  'Sistem ayarlarını aç': 'Open system settings',
  'Push kaydını yeniden dene': 'Retry push registration',
  'Kullanıcılar': 'Users',
  'Raporlar': 'Reports',
  'Platform yönetimi': 'Platform administration',
  'Yönetim panelini aç': 'Open administration panel',
  'Kullanıcı ara': 'Search users',
  'Ara': 'Search',
  'Daha fazla sonuç': 'More results',
  'Anket kapandı': 'Poll closed',
  'Toplam oy': 'Total votes',
  'Sıfırla': 'Reset',
  'Kırpmayı kullan': 'Use crop',
  'Fotoğraf çek': 'Take photo',
  'Galeriden seç': 'Choose from gallery',
  'Görseli sil': 'Delete image',
  'Çevrimiçi': 'Online',
  'Çevrimdışı': 'Offline',
  'Boşta': 'Idle',
  'Rahatsız etmeyin': 'Do not disturb',
  'Bağlanıyor…': 'Connecting…',
  'Bağlandı': 'Connected',
  'Yeniden bağlanma başarısız': 'Reconnection failed',
  'Bağlantı kurtarma yeniden denenecek': 'Connection recovery will retry',
  'Bağlantı bekleniyor': 'Waiting for connection',
  'Zayıf bağlantı': 'Poor connection',
  'Orta bağlantı': 'Fair connection',
  'İyi bağlantı': 'Good connection',
  'Ölçülüyor': 'Measuring',
  'Yanıt bekleniyor…': 'Waiting for an answer…',
  'Katılımcı': 'Participant',
  'Kamerayı aç': 'Turn camera on',
  'Kamerayı kapat': 'Turn camera off',
  'Ekranı paylaş': 'Share screen',
  'Paylaşımı durdur': 'Stop sharing',
  'Sesi aç': 'Unmute',
  'Sustur': 'Mute',
  'Hoparlör': 'Speaker',
  'Kulaklık': 'Earpiece',
  'Bugün': 'Today',
  'Dün': 'Yesterday',
  'Belirtilmedi': 'Not specified',
  'Etkin': 'Enabled',
  'Etkin değil': 'Not enabled',
  'Aktif': 'Active',
  'Yasaklı': 'Banned',
  'Onayla': 'Confirm',
  'Paylaş': 'Share',
  'Oluştur': 'Create',
  'İptal et': 'Cancel',
  'Ses ve görüntü': 'Voice & video',
  'Ses bağlantısı doktoru': 'Voice connection doctor',
  'YASAL VE HESAP': 'LEGAL & ACCOUNT',
  'Gizlilik Politikası': 'Privacy Policy',
  'Kullanım Koşulları': 'Terms of Use',
  'Sesi artır': 'Increase volume',
  'Sesi azalt': 'Decrease volume',
  '18 yaş ve üzeri kanal': 'Age-restricted channel',
  'Arama kontrollerini göster': 'Show call controls',
  'Aramaya dön': 'Return to call',
  'Ayarları aç': 'Open settings',
  'Aynı dosya zaten yükleme kuyruğunda.': 'The same file is already in the upload queue.',
  'Baloncuğu etkinleştir': 'Enable bubble',
  'Diğer uygulamaların üzerindeki Wapve logosundan mikrofon, görüşme sesi, hoparlör ve ayrıl kontrollerine ulaş.': 'Use the Wapve logo above other apps to access microphone, call audio, speaker, and leave controls.',
  'Fotoğraf izni gerekli': 'Photo permission required',
  'Fotoğraf ve video seçmek için Wapve’ye medya izni ver.': 'Allow Wapve to access media so you can choose photos and videos.',
  'Fotoğraf veya video çekmek için Wapve’ye kamera izni ver.': 'Allow Wapve to use the camera to take photos or videos.',
  'Hoparlöre geç': 'Switch to speaker',
  'İzni yönet': 'Manage permission',
  'Telefon sesine geç': 'Switch to phone audio',
  'Uygulamayı küçülttüğünde sürüklenebilir Wapve logosu ve hızlı ses kontrolleri gösterilir.': 'A draggable Wapve logo with quick audio controls appears when you minimize the app.',
  'Yüklenemedi · yeniden dene': 'Upload failed · retry',
  'Yüzen sesli sohbet baloncuğu': 'Floating voice chat bubble',
};

const generatedLiteralTemplates = Object.entries(generatedMobileEnglish)
  .filter(([source]) => /\{\d+\}/u.test(source))
  .map(([source, target]) => {
    const names = [...source.matchAll(/\{(\d+)\}/gu)].map((match) => match[1] ?? '0');
    const parts = source.split(/\{\d+\}/gu).map(escapeRegex);
    return {
      pattern: new RegExp(`^${parts.map((part, index) => index < names.length ? `${part}(.+?)` : part).join('')}$`, 'u'),
      names,
      target,
    };
  })
  .sort((left, right) => right.pattern.source.length - left.pattern.source.length);

function translateTurkishLiteral(input: string): string {
  const match = /^(\s*)(.*?)(\s*)$/su.exec(input);
  const body = match?.[2] ?? input;
  const key = literalKeyByTurkish.get(body) ?? foldedLiteralKeyByTurkish.get(body.toLocaleLowerCase('tr'));
  const direct = mobileLiteralEnglish[body]
    ?? generatedMobileEnglish[body as keyof typeof generatedMobileEnglish]
    ?? normalizedMobileEnglish.get(body.replace(/\s+/gu, ' ').trim())
    ?? (() => {
      return key ? resolveMessage(messages.en, key) : null;
    })();
  if (direct) {
    const value = body === body.toLocaleUpperCase('tr') ? direct.toLocaleUpperCase('en') : direct;
    return `${match?.[1] ?? ''}${value}${match?.[3] ?? ''}`;
  }
  for (const template of generatedLiteralTemplates) {
    const templateMatch = template.pattern.exec(body);
    if (!templateMatch) continue;
    const translated = template.target.replace(/\{(\d+)\}/gu, (_match, index: string) => templateMatch[Number(index) + 1] ?? '');
    return `${match?.[1] ?? ''}${translated}${match?.[3] ?? ''}`;
  }
  for (const template of templateLiteralTranslations) {
    const templateMatch = template.pattern.exec(body);
    const target = resolveMessage(messages.en, template.key);
    if (!templateMatch || !target) continue;
    const values = Object.fromEntries(template.names.map((name, index) => [name, templateMatch[index + 1] ?? '']));
    return `${match?.[1] ?? ''}${interpolate(target, values)}${match?.[3] ?? ''}`;
  }
  const translated = body
    .replace(/\büyeler\b/giu, 'members')
    .replace(/\büye\b/giu, 'members')
    .replace(/\boturumlar\b/giu, 'sessions')
    .replace(/\boturum\b/giu, 'sessions')
    .replace(/\bsaat kaldı\b/giu, 'hours left')
    .replace(/\bdk kaldı\b/giu, 'min left')
    .replace(/\bgün kaldı\b/giu, 'days left')
    .replace(/Ocak/gu, 'January').replace(/Şubat/gu, 'February')
    .replace(/Mart/gu, 'March').replace(/Nisan/gu, 'April')
    .replace(/Mayıs/gu, 'May').replace(/Haziran/gu, 'June')
    .replace(/Temmuz/gu, 'July').replace(/Ağustos/gu, 'August')
    .replace(/Eylül/gu, 'September').replace(/Ekim/gu, 'October')
    .replace(/Kasım/gu, 'November').replace(/Aralık/gu, 'December')
    .replace(/Pazartesi/gu, 'Monday').replace(/Salı/gu, 'Tuesday')
    .replace(/Çarşamba/gu, 'Wednesday').replace(/Perşembe/gu, 'Thursday')
    .replace(/Cumartesi/gu, 'Saturday').replace(/Cuma/gu, 'Friday')
    .replace(/Pazar/gu, 'Sunday');
  return `${match?.[1] ?? ''}${translated}${match?.[3] ?? ''}`;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export function translateLiteralForLocale(input: string, locale: Locale) {
  return locale === 'tr' ? input : translateTurkishLiteral(input);
}

export function translateCurrentLiteral(input: string) {
  return translateLiteralForLocale(input, activeLocale);
}

function resolveMessage(dictionary: object, key: string): string | null {
  let current: unknown = dictionary;
  for (const segment of key.split('.')) {
    if (!current || typeof current !== 'object' || !(segment in current)) return null;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' ? current : null;
}

function interpolate(message: string, values?: TranslationValues) {
  if (!values) return message;
  return message.replace(/\{([A-Za-z0-9_]+)\}/gu, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  );
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
