import { SERVER_SUPPORT_LEVELS } from '@wapve/contracts';

export const SUPPORT_BRAND_LOGO_SRC = '/brand/wapve-wave-mark-v2.png';

export type SupportCategory = {
  id: string;
  slug: string;
  title: { tr: string; en: string };
  description: { tr: string; en: string };
  icon: string; // Lucide icon name
  badgeColor?: string | undefined;
};

export type SupportArticle = {
  id: string;
  slug: string;
  categoryId: string;
  title: { tr: string; en: string };
  summary: { tr: string; en: string };
  tags: string[];
  readingTimeMinutes: number;
  content: { tr: string; en: string }; // Markdown or formatted text
};

export const SUPPORT_CATEGORIES: SupportCategory[] = [
  {
    id: 'basics',
    slug: 'basics',
    title: { tr: 'Wapve Temel Bilgileri', en: 'Wapve Basics' },
    description: {
      tr: 'Sağlam ilerlemek için doğru adımları at; mesajlaşma, ses kanalları ve arkadaşlar.',
      en: 'Take the right steps forward: messaging, voice channels, and friends.',
    },
    icon: 'BookOpen',
    badgeColor: '#38bdf8',
  },
  {
    id: 'account',
    slug: 'account',
    title: { tr: 'Hesap Ayarları & Güvenlik', en: 'Account Settings & Security' },
    description: {
      tr: 'Profilini, özel durumunu, iki adımlı doğrulamayı (2FA) ve geçiş anahtarlarını yönet.',
      en: 'Manage your profile, custom status, two-factor auth (2FA), and passkeys.',
    },
    icon: 'UserCheck',
    badgeColor: '#818cf8',
  },
  {
    id: 'server',
    slug: 'server',
    title: { tr: 'Sunucu & Kanal Yönetimi', en: 'Server & Channel Management' },
    description: {
      tr: 'Rol hiyerarşisi, kanal izinleri, kategori düzeni ve topluluk özellikleri.',
      en: 'Role hierarchy, channel permissions, category layout, and community tools.',
    },
    icon: 'LayoutDashboard',
    badgeColor: '#34d399',
  },
  {
    id: 'woost',
    slug: 'woost',
    title: { tr: 'Woost, Mağaza ve Wapve+', en: 'Woost, Store & Wapve+' },
    description: {
      tr: 'Ücretsiz Wapve+ erişimi, kozmetikler, destek yuvaları ve Woost seviyeleri.',
      en: 'Free Wapve+ access, cosmetics, support slots, and Woost server levels.',
    },
    icon: 'Flame',
    badgeColor: '#fb923c',
  },
  {
    id: 'voice',
    slug: 'voice',
    title: { tr: 'Ses, Video & Ekran Yayını', en: 'Voice, Video & Screen Share' },
    description: {
      tr: 'Ses aygıtları, gürültü azaltma, görüntülü görüşme ve ekran paylaşımı.',
      en: 'Audio devices, noise reduction, video calls, and screen sharing.',
    },
    icon: 'Headphones',
    badgeColor: '#a78bfa',
  },
  {
    id: 'safety',
    slug: 'safety',
    title: { tr: 'Güvenlik, Gizlilik ve Politika', en: 'Safety, Privacy & Policy' },
    description: {
      tr: 'Kendini ve topluluğunu koru; kullanıcı engelleme, içerik raporlama ve kurallar.',
      en: 'Protect yourself and your community: user blocking, content reporting, and guidelines.',
    },
    icon: 'ShieldCheck',
    badgeColor: '#38bdf8',
  },
  {
    id: 'troubleshooting',
    slug: 'troubleshooting',
    title: { tr: 'Bilinen Sorunlar ve Sorun Giderme', en: 'Troubleshooting & Known Issues' },
    description: {
      tr: 'Ses, mikrofon, masaüstü uygulaması ve bağlantı sorunları için çözüm adımları.',
      en: 'Self-service troubleshooting center for audio, microphone, and connection issues.',
    },
    icon: 'Wrench',
    badgeColor: '#e879f9',
  },
];

export const SUPPORT_ARTICLES: SupportArticle[] = [
  // 1. Wapve Temel Bilgileri
  {
    id: 'getting-started-guide',
    slug: 'getting-started-guide',
    categoryId: 'basics',
    title: {
      tr: 'Wapve Başlangıç Rehberi',
      en: 'Wapve Getting Started Guide',
    },
    summary: {
      tr: "Wapve'e hoş geldin! Hesap oluşturma, arayüzü tanıma ve ilk sunucuna katılma adımları.",
      en: 'Welcome to Wapve! Steps to create an account, navigate the interface, and join your first server.',
    },
    tags: ['başlangıç', 'kayıt', 'arayüz', 'rehber', 'intro', 'start'],
    readingTimeMinutes: 3,
    content: {
      tr: `### Wapve'e Hoş Geldin!

Wapve; arkadaşların ve topluluklarınla metin, ses, görüntülü görüşme ve ekran paylaşımı üzerinden iletişim kurabileceğin bir platformdur. Kayıt herkese açıktır ve davet kodu gerekmez. Mesaj ve dosya gönderebilmek için e-posta adresini doğrulaman gerekir.

#### 1. Arayüzün Ana Bölümleri
- **Sol Sunucu Şeridi:** Katıldığın tüm sunucular, özel mesajlar (DM) ve Keşfet paneli burada yer alır.
- **Kanal Listesi:** Seçili sunucunun metin ve ses kanallarını listeler.
- **Sohbet & Medya Alanı:** Kanal mesajlaşması, dosya paylaşımları ve ses bağlantı paneli.
- **Sağ Üye Paneli:** Çevrim içi üyeler, rolleri ve anlık durumları.

#### 2. İlk Sunucunu Oluşturma veya Katılma
1. Sol sunucu şeridindeki **"+"** simgesine tıkla.
2. Sıfırdan bir sunucu açmak için bir ad seç veya sana iletilen **wapve.cc/...** bağlantısını ya da davet kodunu kullanarak bir sunucuya katıl.

#### 3. Web ve Masaüstü Tercihi
Wapve'yi güncel bir web tarayıcısında kullanabilir veya Windows 10/11 (64 bit) için resmi masaüstü uygulamasını yalnızca [wapve.com/download](https://wapve.com/download) adresinden indirebilirsin.`,
      en: `### Welcome to Wapve!

Wapve lets you communicate with friends and communities through text, voice, video calls, and screen sharing. Registration is public and does not require an alpha invite code. You must verify your email before sending messages or files.

#### 1. Main Interface Layout
- **Left Server Rail:** Lists all your servers, Direct Messages (DMs), and Server Discovery.
- **Channel Sidebar:** Displays text and voice channels for the active server.
- **Main Chat & Media Area:** Where conversations, file sharing, and voice activities take place.
- **Right Member List:** Shows online members, their server roles, and current statuses.

#### 2. Joining or Creating a Server
1. Click the **"+"** button on the server rail.
2. Name your server to start from scratch, or use a **wapve.cc/...** link or invite code to join one.

#### 3. Web and Windows
Use Wapve in a current web browser, or download the official 64-bit Windows 10/11 app only from [wapve.com/download](https://wapve.com/download).`,
    },
  },
  {
    id: 'markdown-formatting-101',
    slug: 'markdown-formatting-101',
    categoryId: 'basics',
    title: {
      tr: 'Markdown Metin Biçimlendirme 101',
      en: 'Markdown Text Formatting 101',
    },
    summary: {
      tr: 'Mesajlarını kalın, italik, altı çizili, kod bloğu veya spoyler olarak nasıl biçimlendirirsin?',
      en: 'How to format your messages with bold, italics, code blocks, spoilers, and quotes.',
    },
    tags: ['markdown', 'kalın', 'italik', 'kod', 'spoyler', 'yazı'],
    readingTimeMinutes: 2,
    content: {
      tr: `### Wapve Markdown Rehberi

Wapve sohbetlerinde metinlerini kolayca zenginleştirebilirsin:

| Biçim | Yazım Şekli | Çıktı |
| :--- | :--- | :--- |
| **Kalın** | \`**metin**\` | **metin** |
| *İtalik* | \`*metin*\` veya \`_metin_\` | *metin* |
| ~~Üstü Çizili~~ | \`~~metin~~\` | ~~metin~~ |
| __Altı Çizili__ | \`__metin__\` | __metin__ |
| \`Satır İçi Kod\` | \`\` \`kod\` \`\` | \`kod\` |
| **Spoyler (Gizli)** | \`||gizli içerik||\` | Tıklayınca açılan karartı |
| **Alıntı** | \`> alıntı metni\` | Solunda dikey çizgi olan blok |

#### Çok Satırlı Kod Blokları
Üç adet ters tırnak kullanarak kod blokları oluşturabilirsin:
\`\`\`javascript
console.log("Wapve ile ses harika!");
\`\`\``,
      en: `### Wapve Markdown Guide

Format your chat messages using standard Markdown syntax:

| Style | Syntax | Result |
| :--- | :--- | :--- |
| **Bold** | \`**text**\` | **text** |
| *Italics* | \`*text*\` | *text* |
| ~~Strikethrough~~ | \`~~text~~\` | ~~text~~ |
| __Underline__ | \`__text__\` | __text__ |
| \`Inline Code\` | \`\` \`code\` \`\` | \`code\` |
| **Spoiler** | \`||hidden text||\` | Tap to reveal |
| **Quote** | \`> quote text\` | Blockquote formatting |`,
    },
  },
  {
    id: 'friends-and-direct-messages',
    slug: 'friends-and-direct-messages',
    categoryId: 'basics',
    title: {
      tr: 'Arkadaş Ekleme ve Özel Mesajlar (DM)',
      en: 'Adding Friends & Direct Messages (DMs)',
    },
    summary: {
      tr: 'Arkadaşlık istekleri gönderme, kullanıcı adı arama ve birebir sohbet başlatma.',
      en: 'Sending friend requests, finding usernames, and starting 1-on-1 direct messages.',
    },
    tags: ['arkadaş', 'dm', 'özel mesaj', 'kullanıcı ara', 'sohbet'],
    readingTimeMinutes: 2,
    content: {
      tr: `### Arkadaşlık ve Özel Sohbetler

#### Arkadaş Ekleme
1. Sol üstteki **Wapve Simgesine (Ana Sayfa)** tıkla.
2. Üstteki **"Arkadaş Ekle"** butonuna bas.
3. Arkadaşının kullanıcı adını gir ve **"Arkadaş ekle"** butonuna bas. İstek kabul edildiğinde kullanıcı arkadaş listende görünür.

#### Doğrudan Mesaj (DM) Başlatma
- Arkadaşlar listesindeki **"Mesaj"** eylemini veya özel mesajlar listesindeki konuşmayı seç.
- DM konuşmalarında metin ve desteklenen dosyaları gönderebilir; sesli/görüntülü arama ve ekran paylaşımı başlatabilirsin.`,
      en: `### Friends & Direct Messages

#### Adding a Friend
1. Click the **Wapve Logo (Home)** icon in the top-left corner.
2. Select **"Add Friend"** in the top bar.
3. Enter the username and select **"Add friend"**. The user appears in your friends list after accepting the request.

#### Starting a Direct Message
Use the **"Message"** action in the friends list or select an existing conversation. Direct conversations support text, supported file uploads, voice/video calls, and screen sharing.`,
    },
  },

  // 2. Hesap Ayarları & Güvenlik
  {
    id: 'two-factor-authentication-guide',
    slug: 'two-factor-authentication-guide',
    categoryId: 'account',
    title: {
      tr: 'İki Adımlı Doğrulama (2FA) ve Yedek Kodlar',
      en: 'Two-Factor Authentication (2FA) & Backup Codes',
    },
    summary: {
      tr: 'Hesabını Google Authenticator veya benzeri uygulamalarla nasıl korursun ve yedek kodlarını nerede saklamalısın?',
      en: 'Protect your account using authenticator apps and how to securely store your recovery codes.',
    },
    tags: ['2fa', 'güvenlik', 'şifre', 'authenticator', 'kurtarma kodu', 'mfa'],
    readingTimeMinutes: 3,
    content: {
      tr: `### İki Adımlı Doğrulama (2FA) Kurulumu

2FA, parola girişlerine uyumlu bir doğrulama uygulamasının ürettiği 6 haneli kodu ekler:

1. Sağ alttaki kullanıcı panelinden **Ayarlar (Çark Simgesi)** menüsünü aç.
2. **Güvenlik** sekmesine git.
3. **"İki Adımlı Doğrulamayı Etkinleştir"** butonuna tıkla.
4. Ekrana gelen QR kodunu Google Authenticator, Microsoft Authenticator, 1Password veya başka bir uyumlu TOTP uygulamasıyla tara.
5. Uygulamanın ürettiği 6 haneli kodu girerek onayla.

#### Kurtarma Kodları
2FA etkinleştirildiğinde tek kullanımlık kurtarma kodları yalnızca bir kez gösterilir. Bunları çevrim dışı ve güvenli bir yerde sakla; telefonuna erişemediğinde girişte bu kodlardan birini kullanabilirsin. Wapve çalışanları senden doğrulama veya kurtarma kodu istemez.

**Geçiş anahtarı:** Güvenlik sekmesinden desteklenen cihazına bir geçiş anahtarı da ekleyebilirsin.`,
      en: `### Two-Factor Authentication Setup

Protect your Wapve account by requiring a 6-digit TOTP code upon login:
1. Open **User Settings (Gear Icon)**.
2. Navigate to **Security**.
3. Click **"Enable Two-Factor Authentication"**.
4. Scan the QR code using Google Authenticator, Authy, or your preferred authenticator app.
5. Enter the 6-digit code to confirm.

#### Recovery Codes
One-time recovery codes are shown only once when 2FA is enabled. Store them offline in a safe place and use one if you lose access to your authenticator. Wapve staff will not ask for an authentication or recovery code.

You can also add a passkey from the Security tab on a supported device.`,
    },
  },
  {
    id: 'profile-customization',
    slug: 'profile-customization',
    categoryId: 'account',
    title: {
      tr: 'Profil Özelleştirme: Avatar, Banner ve Durum',
      en: 'Customizing Your Profile: Avatar, Banner & Status',
    },
    summary: {
      tr: 'Görünen adını değiştirme, özel durum emojisi ayarlama ve profil stüdyosu kullanımı.',
      en: 'Changing display name, setting custom status emoji, and using the Profile Studio.',
    },
    tags: ['profil', 'avatar', 'banner', 'durum', 'özel durum', 'emoji'],
    readingTimeMinutes: 2,
    content: {
      tr: `### Profilini Kişiselleştir

Wapve profili, topluluklarda seni yansıtan vitrindir.

#### Profil Bilgilerini Düzenleme
- **Ayarlar > Profil** sayfasına git.
- **Görünen Ad (Display Name):** Sunucularda ve arkadaş listelerinde görünen adındır; hesap ayarlarından değiştirebilirsin.
- **Avatar ve Banner:** JPEG, PNG veya WebP biçimindeki profil fotoğrafını ve banner görselini yükle. Yüklenen görseller güvenli WebP çıktısına dönüştürülür; hareketli profil görseli desteklenmez.
- **Hakkımda (Bio):** Kendin hakkında kısa bir tanıtım metni yaz.

#### Özel Durum Emojisi
Sol alttaki avatarına tıkla ve **"Özel Durum Ayarla"** seçeneğini seç. Standart emoji veya üyesi olduğun sunuculardaki statik özel emojilerden birini seçebilirsin. Hareketli sunucu emojileri özel durumda şimdilik kullanılamaz.`,
      en: `### Profile Customization

Make your profile stand out across servers:
- **Display Name:** Change how other users see your name without altering your login username.
- **Avatar & Banner:** Upload a JPEG, PNG, or WebP image. Uploads are converted to a safe WebP output; animated profile images are not supported.
- **Custom Status:** Click your avatar in the bottom dock and set a message with a standard emoji or a static custom emoji from a server you belong to. Animated server emojis are currently disabled for custom status.`,
    },
  },

  // 3. Sunucu & Kanal Yönetimi
  {
    id: 'channel-permissions-and-private-channels',
    slug: 'channel-permissions-and-private-channels',
    categoryId: 'server',
    title: {
      tr: 'Kanal İzinleri ve Gizli Kanallar Rehberi',
      en: 'Channel Permissions & Private Channels Guide',
    },
    summary: {
      tr: 'Belirli rollerin kanalları görmesini engelleme (VIEW_CHANNEL), moderatör izinleri ve kanal gizleme kuralları.',
      en: 'Restricting roles from viewing channels (VIEW_CHANNEL), moderator permissions, and private channel rules.',
    },
    tags: ['izin', 'kanal', 'rol', 'view_channel', 'gizli kanal', 'sunucu ayarları'],
    readingTimeMinutes: 4,
    content: {
      tr: `### Kanal İzinleri Nasıl Çalışır?

Sunucundaki bir kanalı sadece yetkili kişilere açmak veya belirli bir rolün o kanalı görmesini engellemek için kanal izin geçersiz kılmalarını (*Permission Overwrites*) kullanabilirsin.

#### Bir Kanalı Belirli Bir Role Gizleme (Özel Kanal)
1. İlgili kanalın üzerine gelip **Çark Simgesine (Kanal Ayarları)** tıkla.
2. Sol menüden **İzinler** sekmesine geç.
3. Rol listesinden engellemek istediğin rolü seç (veya herkes için \`@everyone\`).
4. **"Kanalı Görüntüle" (\`VIEW_CHANNEL\`)** iznini **Kırmızı Çarpı (Engelle)** durumuna getir.
5. Değişiklikleri kaydet.

Kanalı görüntüleme izni olmayan üyeler kanalı listede göremez ve kanal içeriğine API üzerinden de erişemez. Sunucu sahibi tüm kanalları görebilir.`,
      en: `### How Channel Permissions Work

Control who can read, speak, or view channels in your server:
1. Hover over a channel and click the **Gear Icon (Channel Settings)**.
2. Go to **Permissions**.
3. Select a role (or \`@everyone\`).
4. Toggle **"View Channel" (\`VIEW_CHANNEL\`)** to red cross (Deny).
5. Save changes.

Members without view permission cannot see the channel in the list or access its content through the API. The server owner can always view server channels.`,
    },
  },
  {
    id: 'server-roles-and-hierarchy',
    slug: 'server-roles-and-hierarchy',
    categoryId: 'server',
    title: {
      tr: 'Rol Hiyerarşisi ve Yetkilendirme',
      en: 'Role Hierarchy and Permission Management',
    },
    summary: {
      tr: 'Sunucu rolleri nasıl oluşturulur, renkler nasıl atanır ve hiyerarşi sırası yetkileri nasıl etkiler?',
      en: 'How to create server roles, assign custom colors, and how the hierarchy order affects moderation.',
    },
    tags: ['rol', 'hiyerarşi', 'yetki', 'moderatör', 'yönetici', 'renk'],
    readingTimeMinutes: 3,
    content: {
      tr: `### Rol Hiyerarşisi ve Öncelik Kuralları

Wapve sunucularında roller yukarıdan aşağıya doğru bir yetki sırasına sahiptir:

#### 1. Sıralama Kuralları
- Üstte yer alan bir role sahip üye, alttaki rollere sahip üyeleri zaman aşımına uğratabilir, sunucudan atabilir veya yasaklayabilir (ilgili moderatör yetkisi varsa).
- Bir üye kendi en yüksek rolünden daha üstte yer alan bir rolü başkasına veremez veya geri alamaz.

#### 2. Rol Renkleri
- Bir üyenin adı, sahip olduğu en üstteki renkli rolün rengiyle görüntülenir.
- Rolleri düzenlemek için: **Sunucu Ayarları > Roller** sekmesini kullanabilirsin.`,
      en: `### Role Hierarchy Rules

Roles in Wapve follow a top-down priority:
- A user with a higher role can moderate members with lower roles.
- A user's name color inherits the highest role they possess that has an assigned color.`,
    },
  },

  // 4. Woost & Wapve+
  {
    id: 'what-is-woost-server-support',
    slug: 'what-is-woost-server-support',
    categoryId: 'woost',
    title: {
      tr: 'Woost Sistemi Nedir? Sunucu Seviye Rotası',
      en: 'What is Woost? Server Tier Route & Perks',
    },
    summary: {
      tr: 'Ücretsiz destek yuvalarını kullanma; Woost seviyeleri, emoji kapasitesi ve ses bit hızı.',
      en: 'Using free support slots; Woost levels, emoji capacity, and voice bitrate.',
    },
    tags: ['woost', 'takviye', 'seviye', 'kapasite', 'akıntı', 'bitrate', 'emoji'],
    readingTimeMinutes: 3,
    content: {
      tr: `### Woost: Sunucunun Rotasını Sen Aç

Her aktif hesabın iki ücretsiz sunucu destek yuvası vardır. Bir yuvayı üyesi olduğun sunucuya atadığında sunucunun kullanılabilir Woost bakiyesine katkı sağlarsın. Yuva başka bir sunucuya taşındıktan sonra yeniden taşınmadan önce 7 günlük bekleme süresi uygulanır.

Sunucu sahibi veya **Sunucuyu Yönet** izni olan üyeler seviyeleri sırayla açar. Seviye maliyetleri 2, ardından 5, ardından 7 Woost'tur; toplam eşikler aşağıdadır.

#### Seviye Kapasiteleri (Akıntı Seviyeleri)

| Seviye | Gerekli Woost | Avantajlar |
| :--- | :--- | :--- |
| **1. Akıntı** | ${SERVER_SUPPORT_LEVELS[0].requiredSupports} Woost | ${SERVER_SUPPORT_LEVELS[0].emojiSlots} emoji yuvası, ${SERVER_SUPPORT_LEVELS[0].voiceBitrateKbps} kbps ses |
| **2. Akıntı** | ${SERVER_SUPPORT_LEVELS[1].requiredSupports} Woost | ${SERVER_SUPPORT_LEVELS[1].emojiSlots} emoji yuvası, ${SERVER_SUPPORT_LEVELS[1].voiceBitrateKbps} kbps ses |
| **3. Akıntı** | ${SERVER_SUPPORT_LEVELS[2].requiredSupports} Woost | ${SERVER_SUPPORT_LEVELS[2].emojiSlots} emoji yuvası, ${SERVER_SUPPORT_LEVELS[2].voiceBitrateKbps} kbps ses, özel davet URL'si |

#### Woost Nasıl Verilir?
Sunucu menüsündeki **"Woost yap"** eylemini kullan veya Wapve+ panelindeki destek yuvalarından birine sunucuyu ata. Seviye avantajları ancak sunucu yöneticisi ilgili seviyeyi açtıktan sonra etkinleşir.`,
      en: `### Woost: Unlock Your Server Route

Every active account has two free server support slots. Assigning a slot contributes to that server's available Woost balance. A moved slot has a seven-day cooldown before it can be moved again.

The server owner or a member with **Manage Server** permission unlocks levels in order. The incremental costs are 2, then 5, then 7 Woosts:
- **Tier 1 (${SERVER_SUPPORT_LEVELS[0].requiredSupports} total):** ${SERVER_SUPPORT_LEVELS[0].emojiSlots} emoji slots and ${SERVER_SUPPORT_LEVELS[0].voiceBitrateKbps} kbps voice.
- **Tier 2 (${SERVER_SUPPORT_LEVELS[1].requiredSupports} total):** ${SERVER_SUPPORT_LEVELS[1].emojiSlots} emoji slots and ${SERVER_SUPPORT_LEVELS[1].voiceBitrateKbps} kbps voice.
- **Tier 3 (${SERVER_SUPPORT_LEVELS[2].requiredSupports} total):** ${SERVER_SUPPORT_LEVELS[2].emojiSlots} emoji slots, ${SERVER_SUPPORT_LEVELS[2].voiceBitrateKbps} kbps voice, and a custom invite URL.

Perks become active only after a server manager unlocks the corresponding level.`,
    },
  },
  {
    id: 'wapve-plus-subscription-perks',
    slug: 'wapve-plus-subscription-perks',
    categoryId: 'woost',
    title: {
      tr: 'Ücretsiz Wapve+ Erişimi ve Özellikleri',
      en: 'Free Wapve+ Access & Features',
    },
    summary: {
      tr: 'Ücretsiz kozmetikler, özel emojiler, profil rozeti ve sunucu destek yuvaları.',
      en: 'Free cosmetics, custom emojis, a profile badge, and server support slots.',
    },
    tags: ['wapve+', 'ücretsiz', 'kozmetik', 'rozet', 'emoji', 'woost'],
    readingTimeMinutes: 2,
    content: {
      tr: `### Wapve+ Ücretsizdir

Kamusal sürümde Wapve+ tüm aktif hesaplarda süresiz ve ücretsiz olarak açıktır. Ödeme yöntemi, deneme süresi, otomatik yenileme veya ücretli abonelik akışı yoktur.

- **Kozmetik Koleksiyonları:** Mağazadaki mevcut avatar dekorasyonlarını, profil çerçevelerini/efektlerini ve isim plakalarını ücretsiz alıp kullanabilirsin.
- **Özel Emojiler:** Üyesi olduğun sunucuların emojilerini DM ve grup konuşmalarında kullanabilirsin. Sunucu kanallarında başka bir sunucunun emojisini kullanmak için ilgili kanal/sunucu izni gerekir.
- **Profil Rozeti:** Wapve+ etkinliği profil kimliğinde gösterilebilir.
- **Sunucu Desteği:** İki destek yuvasını üyesi olduğun sunuculara atayabilirsin.

Hareketli avatar/banner ve Wapve+'a özel daha yüksek dosya yükleme limiti şu anda sunulmaz. Özel durumda hareketli sunucu emojileri de şimdilik kapalıdır.`,
      en: `### Wapve+ Is Free

In the public release, Wapve+ is enabled for every active account at no charge and without an expiry date. There is no payment method, trial, automatic renewal, or paid subscription flow.

- **Cosmetics:** Claim and use the current avatar decorations, profile frames/effects, and nameplates for free.
- **Custom Emojis:** Use emojis from servers you belong to in DMs and group conversations. Using an emoji from another server inside a server channel also requires the applicable channel/server permission.
- **Profile Badge:** Wapve+ status can appear on your profile identity.
- **Server Support:** Assign two support slots to servers you belong to.

Animated avatars/banners and a Wapve+-only higher upload limit are not currently offered. Animated server emojis are also disabled in custom status for now.`,
    },
  },

  // 5. Ses, Video & Ekran Yayını
  {
    id: 'audio-microphone-troubleshooting',
    slug: 'audio-microphone-troubleshooting',
    categoryId: 'voice',
    title: {
      tr: 'Ses ve Mikrofon Sorun Giderme Rehberi',
      en: 'Voice & Microphone Troubleshooting Guide',
    },
    summary: {
      tr: 'Mikrofonumdan ses gitmiyor, ses robotlaşıyor veya arkadaşlarımı duyamıyorum sorunlarının çözümleri.',
      en: 'Fixes for microphone not transmitting audio, robotic voice, or being unable to hear friends.',
    },
    tags: ['mikrofon', 'ses gitmiyor', 'duyamıyorum', 'webrtc', 'aygıt', 'gürültü'],
    readingTimeMinutes: 4,
    content: {
      tr: `### Ses ve Mikrofon Sorunları Nasıl Çözülür?

Ses kanalında sesin iletilmiyorsa aşağıdaki adımları sırayla uygula:

#### 1. Doğru Giriş/Çıkış Aygıtını Seç
**Ayarlar > Ses & Görüntü** bölümünü aç.
- **Giriş Aygıtı (Mikrofon):** Varsayılan yerine doğrudan kulaklığının veya harici mikrofonunun adını seç.
- **Mikrofon Testi:** Konuşurken seviye çubuğunun hareket ettiğini doğrula.
- **Ses İşleme:** Gerekirse yankı engelleme, gürültü azaltma ve otomatik mikrofon seviyesi seçeneklerini ayrı ayrı dene.

#### 2. Tarayıcı veya Windows İzinleri
- **Tarayıcıda:** Adres çubuğundaki kilit simgesine tıkla ve **"Mikrofon: İzin Ver"** olarak ayarlandığından emin ol.
- **Windows'ta:** *Başlat > Ayarlar > Gizlilik ve Güvenlik > Mikrofon* bölümünden **"Masaüstü uygulamalarının mikrofona erişmesine izin ver"** ayarını açık konuma getir.

#### 3. Bağlantı Durumu
Ses bağlantısı kurulamıyorsa VPN, proxy, kurumsal ağ veya güvenlik duvarı WebRTC/TURN trafiğini engelliyor olabilir. Farklı bir ağda dene; sorun sürerse destek talebine işletim sistemi, tarayıcı/uygulama sürümü ve denediğin adımları ekle.`,
      en: `### Resolving Microphone & Audio Issues

If your voice is not transmitting:
1. Open **Settings > Voice & Video**.
2. Select your exact microphone under **Input Device** instead of Default.
3. Run the microphone test and confirm the level meter moves while you speak.
4. Try echo cancellation, noise reduction, and automatic input level separately.
5. Ensure browser or Windows permissions allow microphone access for \`wapve.com\`.

If voice still cannot connect, a VPN, proxy, corporate network, or firewall may be blocking WebRTC/TURN traffic. Try another network and include your OS and app/browser version in a support request.`,
    },
  },
  {
    id: 'screen-share-and-stream-quality',
    slug: 'screen-share-and-stream-quality',
    categoryId: 'voice',
    title: {
      tr: 'Ekran Paylaşımı ve Yayın Kalitesi Ayarları',
      en: 'Screen Sharing & Stream Quality Settings',
    },
    summary: {
      tr: 'Sesli kanalda tüm ekranı veya belirli bir pencereyi 720p/30 ya da 1080p/60 kalitesinde paylaşma.',
      en: 'Sharing an entire screen or a specific window at 720p/30 or 1080p/60.',
    },
    tags: ['ekran paylaşımı', 'yayın', 'fps', 'kalite', 'pencere', 'ses aktarımı'],
    readingTimeMinutes: 2,
    content: {
      tr: `### Ekran Paylaşımı Başlatma

1. Bir ses kanalına bağlan.
2. Sol alttaki bağlantı panelinde yer alan **"Ekranı Paylaş" (Monitör Simgesi)** butonuna tıkla.
3. Paylaşmak istediğin **Uygulama Penceresini** veya **Tüm Ekranı** seç.
4. **720p / 30 FPS** veya **1080p / 60 FPS** kalitesini seçerek paylaşımı başlat.

Pencere veya sistem sesi aktarımı işletim sistemi, tarayıcı ve seçilen paylaşım kaynağının sunduğu seçeneklere bağlıdır. Wapve yalnızca sistem paylaşım penceresinde izin verdiğin kaynağı yakalar.`,
      en: `### Starting a Screen Share

1. Join a voice channel.
2. Click the **"Share Screen"** button in the voice status panel.
3. Choose either an entire screen or a specific window.
4. Choose **720p / 30 FPS** or **1080p / 60 FPS** and start sharing.

Window or system-audio capture depends on the operating system, browser, and options offered by the native sharing prompt. Wapve captures only the source you approve there.`,
    },
  },

  // 6. Güvenlik, Gizlilik ve Politika
  {
    id: 'reporting-abusive-behavior',
    slug: 'reporting-abusive-behavior',
    categoryId: 'safety',
    title: {
      tr: 'Kullanıcı ve İçerik Raporlama Kılavuzu',
      en: 'Reporting Users & Content Violations',
    },
    summary: {
      tr: 'Topluluk kurallarını ihlal eden mesajları, taciz vakalarını ve zararlı içerikleri moderatörlere bildirme.',
      en: 'How to report abusive messages, harassment, and community violations to moderators.',
    },
    tags: ['raporla', 'şikayet', 'taciz', 'spam', 'engelle', 'güvenlik'],
    readingTimeMinutes: 3,
    content: {
      tr: `### Kural İhlalini Bildirme

Topluluk Kuralları'na aykırı, taciz edici, tehdit içeren, spam veya yasa dışı olduğunu düşündüğün içeriği bildirebilirsin.

#### Mesaj Raporlama
1. Kural ihlali içeren mesajın üzerine gel ve sağdaki **üç nokta (...)** menüsüne tıkla.
2. **"Mesajı Bildir"** seçeneğini seç.
3. Uygun nedeni seç, gerekli açıklamayı ekle ve bildirimi gönder. Bildirim platform güvenlik ekibinin inceleme kuyruğuna kaydedilir.

#### Kullanıcı Engelleme
Profil kartındaki **"Engelle"** eylemi arkadaşlığı kaldırır ve iki taraf arasında yeni arkadaşlık, doğrudan mesaj, yazıyor etkinliği ve doğrudan arama kurulmasını engeller. Ortak sunuculardaki içerikler sunucu izinleri ve moderasyon kurallarına tabidir.`,
      en: `### Reporting Content Violations

To report an abusive message:
1. Hover over the message and click the **three dots (...)**.
2. Select **"Report Message"**.
3. Choose the reason, add the required detail, and submit. The report is added to the platform safety review queue.

#### Blocking a User
The **"Block"** action removes the friendship and prevents new friendship, direct-message, typing, and direct-call interactions between the two accounts. Content in shared servers remains governed by server permissions and moderation.`,
    },
  },
  {
    id: 'phishing-and-account-safety',
    slug: 'phishing-and-account-safety',
    categoryId: 'safety',
    title: {
      tr: 'Oltalama (Phishing) ve Sahte Mesajlara Karşı Korunma',
      en: 'Protecting Yourself from Phishing & Scams',
    },
    summary: {
      tr: 'Sahte giriş sayfalarını, şifre çalma girişimlerini ve resmi sistem hesabını ayırt etme.',
      en: 'Spotting fake sign-in pages, credential theft attempts, and the official system account.',
    },
    tags: ['oltalama', 'phishing', 'sahte link', 'hesap çalınması', 'sistem mesajı'],
    readingTimeMinutes: 3,
    content: {
      tr: `### Hesabını Oltalama Saldırılarından Koru

- **Kodlarını paylaşma:** Wapve çalışanları ve destek ekibi şifreni, 2FA kodunu veya kurtarma kodunu istemez.
- **Alan adını kontrol et:** Giriş bilgilerini yalnızca adres çubuğunda tam olarak \`wapve.com\` alan adını gördüğünde gir. Şüpheli bağlantıyı açma; mesajı bildir.
- **Ücretsiz Wapve+:** Wapve+ zaten tüm aktif hesaplarda ücretsizdir. Wapve+ vermek için giriş isteyen üçüncü taraf sayfalar Wapve'ye ait değildir.
- **Resmi hesap:** Uygulamadaki tek yönlü Wapve sistem hesabında **SİSTEM** rozeti bulunur; bu hesaba mesaj gönderilemez veya arama başlatılamaz.`,
      en: `### Account Safety & Scam Prevention

- Wapve staff and support will **never** ask for your password, 2FA code, or recovery code.
- Enter credentials only when the address bar shows the exact \`wapve.com\` domain. Do not open suspicious links; report the message.
- Wapve+ is already free for every active account. A third-party page asking you to sign in to receive it is not operated by Wapve.
- The one-way official Wapve system account has a **SYSTEM** badge and cannot receive messages or calls.`,
    },
  },

  {
    id: 'message-and-call-security',
    slug: 'message-and-call-security',
    categoryId: 'safety',
    title: {
      tr: 'Mesaj, Bağlantı ve Arama Güvenliği',
      en: 'Message, Link & Call Security',
    },
    summary: {
      tr: 'Aktarım şifrelemesi, uçtan uca şifreleme sınırı ve mesaj bağlantılarının erişim kontrolü.',
      en: 'Transport encryption, the end-to-end encryption boundary, and access checks on message links.',
    },
    tags: ['şifreleme', 'e2ee', 'uçtan uca', 'mesaj bağlantısı', 'webrtc', 'gizlilik'],
    readingTimeMinutes: 3,
    content: {
      tr: `### Wapve İçeriği Nasıl Korur?

- **Aktarım sırasında şifreleme:** Web, API ve gerçek zamanlı bağlantılar HTTPS/TLS üzerinden taşınır. Ses, görüntü ve ekran paylaşımı WebRTC'nin şifreli medya taşımasını kullanır.
- **Mesajlar uçtan uca şifreli değildir:** DM, grup ve sunucu mesajları; cihazlar arası eşitleme, arama, bildirim, raporlama ve moderasyon özelliklerinin çalışabilmesi için Wapve sunucularında işlenir ve saklanır. Wapve bu içerikler için uçtan uca şifreleme iddiasında bulunmaz.
- **Mesaj bağlantıları yetki vermez:** Bir mesaj URL'sini bilmek tek başına içeriği açmaz. Sunucu üyeliği, kanal görüntüleme izni veya ilgili DM/grup katılımı API tarafından yeniden kontrol edilir.
- **Mutlak güvenlik vaadi yoktur:** Hiçbir çevrim içi sistem için “asla ele geçirilemez” garantisi verilemez. Uzun ve benzersiz parola, 2FA veya geçiş anahtarı kullan; tanımadığın oturumları kapat ve şüpheli içerikleri bildir.

Kişisel verilerin işlenmesi ve saklama esasları için [Gizlilik Politikası](https://wapve.com/legal/privacy) ve [KVKK Aydınlatma Metni](https://wapve.com/legal/kvkk) sayfalarını inceleyebilirsin.`,
      en: `### How Wapve Protects Content

- **Encryption in transit:** Web, API, and realtime connections use HTTPS/TLS. Voice, video, and screen sharing use WebRTC's encrypted media transport.
- **Messages are not end-to-end encrypted:** DMs, group messages, and server messages are processed and stored on Wapve servers so device sync, search, notifications, reporting, and moderation can work. Wapve does not claim end-to-end encryption for this content.
- **Message links do not grant access:** Knowing a message URL is not enough to open its content. The API rechecks server membership, channel view permission, or participation in the relevant DM/group.
- **No absolute-security promise:** No online service can guarantee it can never be compromised. Use a long, unique password, enable 2FA or a passkey, close unfamiliar sessions, and report suspicious content.

See the [Privacy Policy](https://wapve.com/legal/privacy) and [KVKK Notice](https://wapve.com/legal/kvkk) for personal-data processing and retention details.`,
    },
  },

  // 7. Bilinen Sorunlar ve Sorun Giderme
  {
    id: 'windows-desktop-app-troubleshooting',
    slug: 'windows-desktop-app-troubleshooting',
    categoryId: 'troubleshooting',
    title: {
      tr: 'Windows Masaüstü Uygulaması Kurulum ve Sorun Giderme',
      en: 'Windows Desktop App Setup & Troubleshooting',
    },
    summary: {
      tr: 'Resmi Windows kurulum dosyası, SHA-256 doğrulaması ve SmartScreen uyarıları.',
      en: 'The official Windows installer, SHA-256 verification, and SmartScreen prompts.',
    },
    tags: ['windows', 'setup', 'indir', 'kurulum', 'desktop', 'hata'],
    readingTimeMinutes: 3,
    content: {
      tr: `### Windows Uygulamasını Kurma ve Güncelleme

Wapve resmi Windows uygulamasını yalnızca [wapve.com/download](https://wapve.com/download) adresinden indir. Güncel paket Windows 10/11 64 bit içindir.

#### SHA-256 ve SmartScreen
İndirme servisi kurulum dosyasını sunmadan önce boyutunu ve resmi sürüm kaydındaki SHA-256 özetini doğrular. SHA-256 bir bütünlük özetidir; Windows yayıncı kod imzası değildir.

SmartScreen yayıncı uyarısı gösterirse önce dosyanın doğrudan \`wapve.com\` üzerinden indiğini doğrula. Kaynağından emin değilsen çalıştırma ve destek talebi aç. Güvenlik yazılımını kapatma veya üçüncü taraf bir kurulum dosyası kullanma.

#### Uygulama Açılmıyor veya Güncellenmiyorsa
1. Görev Yöneticisi'nden tüm \`Wapve.exe\` işlemlerini sonlandır.
2. Resmi indirme sayfasından en güncel kurulum dosyasını indirip mevcut kurulumun üzerine yeniden kur.
3. Sorun sürerse Windows sürümünü, Wapve sürümünü ve görünen hata metnini destek talebine ekle. Uygulama verilerini silmeden önce destekten yönlendirme al.`,
      en: `### Windows App Setup & Troubleshooting

Download the 64-bit Windows 10/11 app only from [wapve.com/download](https://wapve.com/download).

The download service verifies the installer's size and SHA-256 checksum against the official release record before serving it. SHA-256 is an integrity checksum, not a Windows publisher code signature.

If SmartScreen shows a publisher warning, first confirm the file came directly from \`wapve.com\`. Do not run it if you cannot verify the source; open a support request instead. Do not disable security software or use a third-party installer.

If the app will not open, close every \`Wapve.exe\` process in Task Manager, reinstall the latest official build over the existing installation, and include the Windows version, Wapve version, and exact error text in a support request if the issue continues.`,
    },
  },
  {
    id: 'webrtc-connection-rtc-connecting',
    slug: 'webrtc-connection-rtc-connecting',
    categoryId: 'troubleshooting',
    title: {
      tr: 'Bağlantı Koptu Ekranı ve Ses Bağlantı Hataları',
      en: 'Connection Lost Screen & Voice Connection Errors',
    },
    summary: {
      tr: 'Uygulama bağlantı denetimi, otomatik yeniden deneme ve WebRTC/TURN sorun giderme.',
      en: 'App health checks, automatic retries, and WebRTC/TURN troubleshooting.',
    },
    tags: ['bağlantı koptu', 'yeniden dene', 'webrtc', 'turn', 'ses hatası', 'ağ'],
    readingTimeMinutes: 3,
    content: {
      tr: `### "Bağlantı Koptu" Ekranı Ne Anlama Gelir?

Wapve uygulaması yaklaşık her 30 saniyede bir kendi sağlık uç noktasına kısa bir istek gönderir. Tarayıcı çevrim dışı olduğunu bildirirse veya bu istek yaklaşık 8 saniyelik tolerans süresince başarısız kalırsa bağlantı ekranı açılır. Uygulama 3, 8, 15 ve ardından 30 saniyelik aralıklarla otomatik olarak yeniden dener; **"Şimdi yeniden dene"** ile elle de deneyebilirsin.

Bu ekran sık görünüyorsa:
1. Aynı cihazda [wapve.com/api/v1/health](https://wapve.com/api/v1/health) adresini açmayı dene.
2. VPN/proxy'yi geçici kapat veya başka bir ağda dene.
3. Sistem tarih ve saatinin otomatik olduğunu doğrula.
4. Güvenlik yazılımında \`wapve.com\` HTTPS bağlantısının engellenmediğini kontrol et.

#### Ses Bağlantısı Kurulmuyorsa
Ses, görüntü ve ekran paylaşımı WebRTC üzerinden şifreli medya taşıması ve Wapve TURN altyapısını kullanır. Kanaldan çıkıp yeniden gir; mikrofon iznini kontrol et ve farklı ağda dene. Kurumsal ağ veya güvenlik duvarı WebRTC/TURN trafiğini engelleyebilir.

Sorun sürerse destek talebine yaklaşık saat, internet sağlayıcısı/ağ türü, işletim sistemi, tarayıcı veya masaüstü uygulama sürümü ve görünen hata metnini ekle. Parola ya da doğrulama kodu gönderme.`,
      en: `### What Does the "Connection Lost" Screen Mean?

The Wapve app sends a short request to its health endpoint about every 30 seconds. The screen appears when the browser reports offline status or the request keeps failing through an approximately eight-second grace period. The app retries automatically after 3, 8, 15, and then 30 seconds; you can also select **"Retry now"**.

If it appears frequently:
1. Try opening [wapve.com/api/v1/health](https://wapve.com/api/v1/health) on the same device.
2. Temporarily disable a VPN/proxy or try another network.
3. Confirm the system date and time are automatic.
4. Check that security software is not blocking HTTPS access to \`wapve.com\`.

#### If Voice Will Not Connect
Voice, video, and screen sharing use WebRTC encrypted media transport and Wapve's TURN infrastructure. Leave and rejoin the channel, check microphone permission, and try another network. A corporate network or firewall may block WebRTC/TURN traffic.

If it continues, include the approximate time, ISP/network type, operating system, browser or desktop-app version, and exact error text in a support request. Never send a password or verification code.`,
    },
  },
];
