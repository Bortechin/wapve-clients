import type { Locale } from '@wapve/contracts';

export type MarketingCopy = {
  nav: {
    features: string;
    plus: string;
    faq: string;
    support: string;
    blog: string;
    security: string;
    roadmap: string;
    download: string;
    login: string;
    openApp: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    accent: string;
    description: string;
    primary: string;
    secondary: string;
    downloadWindows: string;
    downloadVersion: string;
    verifyHash: string;
    note: string;
    mascotAlt: string;
  };
  proof: Array<{ value: string; label: string }>;
  home: {
    featuresEyebrow: string;
    featuresTitle: string;
    featuresText: string;
    featureCards: Array<{
      icon: string;
      title: string;
      text: string;
      state: 'ready' | 'next' | 'planned';
    }>;
    stateLabels: { ready: string; next: string; planned: string };
    principleEyebrow: string;
    principleTitle: string;
    principleText: string;
    principles: Array<{ title: string; text: string }>;
    ctaTitle: string;
    ctaText: string;
  };
  pages: {
    features: {
      eyebrow: string;
      title: string;
      intro: string;
      groups: Array<{
        title: string;
        text: string;
        items: string[];
        state: 'ready' | 'next' | 'planned';
      }>;
    };
    security: {
      eyebrow: string;
      title: string;
      intro: string;
      cards: Array<{ title: string; text: string }>;
      noteTitle: string;
      noteText: string;
    };
    roadmap: {
      eyebrow: string;
      title: string;
      intro: string;
      phases: Array<{
        number: string;
        title: string;
        text: string;
        items: string[];
        state: 'ready' | 'next' | 'planned';
      }>;
    };
    download: {
      eyebrow: string;
      title: string;
      accent: string;
      description: string;
      downloadButton: string;
      versionBadge: string;
      architectureBadge: string;
      requirements: string;
      webAlternative: string;
      securityHeading: string;
      securityBadge: string;
      securityDescription: string;
      sha256Label: string;
      copyHash: string;
      hashCopied: string;
      copyCommand: string;
      commandCopied: string;
      howToVerifyTitle: string;
      step1: string;
      step2: string;
      step3: string;
      smartScreenTitle: string;
      smartScreenText: string;
    };
  };
  footer: {
    product: string;
    legal: string;
    legalLinks: {
      terms: string;
      privacy: string;
      kvkk: string;
      cookies: string;
      community: string;
    };
    rights: string;
  };
};

const tr: MarketingCopy = {
  nav: {
    features: 'Özellikler',
    plus: 'Wapve+',
    faq: 'SSS',
    support: 'Destek',
    blog: 'Blog',
    security: 'Güvenlik',
    roadmap: 'Yol haritası',
    download: 'İndir',
    login: 'Giriş yap',
    openApp: "Wapve'yi aç",
  },
  hero: {
    eyebrow: 'Toplulukların yeni buluşma noktası',
    title: 'Sesin, ekibin, topluluğun.',
    accent: 'Tek dalgada.',
    description:
      'Wapve; sohbet etmek, birlikte üretmek ve ait olduğun topluluklarla bağ kurmak için geliştirilen güvenli, sade ve bağımsız bir iletişim platformu.',
    primary: 'Ücretsiz hesap oluştur',
    secondary: 'Özellikleri keşfet',
    downloadWindows: 'Windows İçin İndir',
    downloadVersion: 'v0.3.4 (64-bit)',
    verifyHash: 'SHA-256 Doğrulama',
    note: 'Davet kodu gerekmez · Wapve+ ve kozmetikler ücretsiz',
    mascotAlt: 'Mavi ve mor ışıklı Wapve maskotu',
  },
  proof: [
    { value: 'TR + EN', label: 'Çoklu dil altyapısı' },
    { value: 'Web-first', label: 'Her ekrana uyumlu' },
    { value: 'Secure by default', label: 'Güvenli oturumlar' },
  ],
  home: {
    featuresEyebrow: 'WAPVE DENEYİMİ',
    featuresTitle: 'Kalabalık değil, sana ait bir alan.',
    featuresText:
      'Her parçayı acele etmeden, gerçek kullanım senaryolarına ve güvenliğe göre inşa ediyoruz.',
    featureCards: [
      {
        icon: 'server',
        title: 'Topluluk sunucuları',
        text: 'Sunucunu oluştur, ikonunu seç, süreli davet bağlantılarıyla insanları bir araya getir.',
        state: 'ready',
      },
      {
        icon: 'message',
        title: 'Akıcı mesajlaşma',
        text: 'Yanıtlar, tepkiler, GIF ve dosyalarla gerçek zamanlı sohbet deneyimi.',
        state: 'ready',
      },
      {
        icon: 'voice',
        title: 'Sesli odalar',
        text: 'Topluluğunla düşük gecikmeli sesli kanallarda buluş.',
        state: 'ready',
      },
      {
        icon: 'shield',
        title: 'Kontrol sende',
        text: 'Roller, kanal izinleri ve moderasyon araçlarıyla alanını güvenle yönet.',
        state: 'ready',
      },
      {
        icon: 'user',
        title: 'Gerçek bir profil',
        text: 'Kullanıcı adı, görünen ad, avatar, durum ve aktif oturum yönetimi.',
        state: 'ready',
      },
      {
        icon: 'devices',
        title: 'Her yerde Wapve',
        text: 'Responsive web ve Windows masaüstü; Android ve iOS deneyimleriyle tek hesap.',
        state: 'ready',
      },
    ],
    stateLabels: { ready: 'Kullanıma hazır', next: 'Sıradaki paket', planned: 'Planlandı' },
    principleEyebrow: 'BİZİM YAKLAŞIMIMIZ',
    principleTitle: 'Güveni sonradan eklemiyoruz.',
    principleText:
      'Wapve daha ilk satırından itibaren özel iletişim alanlarına yakışan güvenlik yaklaşımıyla geliştiriliyor.',
    principles: [
      {
        title: 'Şeffaf geliştirme',
        text: 'Hazır olanı, geliştirileni ve planlananı açıkça ayırıyoruz.',
      },
      {
        title: 'Gizlilik odaklı',
        text: 'Oturum anahtarları tarayıcı depolamasında tutulmaz; hassas veriler loglarda maskelenir.',
      },
      {
        title: 'İnsan ölçeğinde',
        text: 'Gürültüyü değil, toplulukların doğal iletişimini güçlendiren bir deneyim tasarlıyoruz.',
      },
    ],
    ctaTitle: 'Kendi dalganı bugün başlat.',
    ctaText: 'Wapve herkese açık. Davet kodu gerekmeden ücretsiz hesabını oluştur.',
  },
  pages: {
    features: {
      eyebrow: 'ÜRÜN ÖZELLİKLERİ',
      title: 'Bugün çalışanlar, yarın gelecekler.',
      intro:
        'Wapve’nin bugün kullanılabilen iletişim, topluluk, güvenlik ve kişiselleştirme araçlarını keşfet.',
      groups: [
        {
          title: 'Hesap ve profil',
          text: 'Güvenli hesap deneyiminin temeli hazır.',
          items: [
            'E-posta doğrulama',
            'Avatar ve görünen ad',
            'Çevrimiçi durumları',
            'Şifre ve oturum yönetimi',
            'Türkçe ve İngilizce',
          ],
          state: 'ready',
        },
        {
          title: 'Topluluk sunucuları',
          text: 'Kendi alanını oluştur ve üyelerini davet et.',
          items: [
            'Sunucu oluşturma',
            'İkon ve ad yönetimi',
            'Süreli davet kodları',
            'Katılma ve ayrılma',
            'Üye görünümü',
          ],
          state: 'ready',
        },
        {
          title: 'Kanallar ve mesajlar',
          text: 'Gerçek zamanlı topluluk iletişimi kullanıma hazır.',
          items: [
            'Kategori sistemi',
            'Metin ve ses kanalları',
            'Gerçek zamanlı mesajlar',
            'Yanıt, mention ve tepkiler',
            'Dosya ve görsel paylaşımı',
          ],
          state: 'ready',
        },
        {
          title: 'Bağlantılar ve yönetim',
          text: 'Arkadaşlık, özel mesajlaşma ve moderasyon araçları kullanıma hazır.',
          items: [
            'Arkadaşlar ve DM',
            'Roller ve izinler',
            'Kick, ban ve timeout',
            'Bildirimler',
            'Bildirim merkezi ve denetim günlüğü',
          ],
          state: 'ready',
        },
      ],
    },
    security: {
      eyebrow: 'GÜVENLİK',
      title: 'Güvenliğin temeli en baştan atıldı.',
      intro:
        'Hiçbir yazılım “asla saldırıya uğramaz” diyemez. Wapve, riski azaltmak ve sorunları hızla tespit etmek için katmanlı güvenlik yaklaşımı kullanır.',
      cards: [
        {
          title: 'Güvenli oturumlar',
          text: 'Rastgele opaque oturum anahtarları HttpOnly çerezlerde tutulur; veritabanında yalnızca hash değerleri saklanır.',
        },
        {
          title: 'Modern parola koruması',
          text: 'Parolalar Argon2id ile hashlenir, zayıf parolalar reddedilir ve sıfırlama işlemi aktif oturumları kapatır.',
        },
        {
          title: 'İstek koruması',
          text: 'Mutasyonlarda CSRF ve Origin kontrolü; hassas uçlarda IP ve hesap bazlı hız sınırı uygulanır.',
        },
        {
          title: 'Güvenli dosyalar',
          text: 'Yüklemelerde yalnızca uzantıya güvenilmez; gerçek içerik ve magic-byte doğrulanır, görseller yeniden kodlanır.',
        },
        {
          title: 'En az yetki',
          text: 'Doğrulanmamış hesaplar kısıtlanır; sahiplik ve üyelik kontrolleri her istek üzerinde sunucuda uygulanır.',
        },
        {
          title: 'Sürekli kontrol',
          text: 'Lint, tip kontrolü, birim ve uçtan uca testler ile bağımlılık ve secret taramaları kalite kapısının parçasıdır.',
        },
      ],
      noteTitle: 'Bir güvenlik sorunu mu buldun?',
      noteText:
        'Olası bir güvenlik sorununu destek sayfasındaki özel bildirim akışıyla info@wapve.com adresine ilet.',
    },
    roadmap: {
      eyebrow: 'YOL HARİTASI',
      title: 'Wapve dalga dalga büyüyor.',
      intro:
        'Tarihe değil kaliteye odaklanıyoruz. Sıralama ürün ihtiyaçlarına göre güncellenebilir; aşağıdaki aşamalar mevcut çalışma yönümüzdür.',
      phases: [
        {
          number: '01',
          title: 'Güvenli temel',
          text: 'Kimlik, profil ve topluluk sunucularının çekirdeği.',
          items: [
            'Hesap ve e-posta doğrulama',
            'Profil, durum ve oturumlar',
            'Sunucu ve davet sistemi',
            'Responsive uygulama kabuğu',
          ],
          state: 'ready',
        },
        {
          number: '02',
          title: 'Topluluk iletişimi',
          text: 'Sunucuların gerçekten yaşamaya başladığı paket.',
          items: [
            'Kategori ve kanal sistemi',
            'Kanal izinleri',
            'Gerçek zamanlı mesajlaşma',
            'Dosyalar, tepkiler ve mention',
          ],
          state: 'ready',
        },
        {
          number: '03',
          title: 'Birlikte olma',
          text: 'İletişimi ses, arkadaşlık ve yönetimle tamamlama.',
          items: [
            'WebRTC sesli sohbet',
            'Arkadaşlar ve özel mesajlar',
            'Roller ve moderasyon',
            'Bildirim sistemi',
          ],
          state: 'ready',
        },
        {
          number: '04',
          title: 'Her platformda',
          text: 'Wapve’yi web, Windows ve mobil cihazlarda sürdürme.',
          items: [
            'Windows masaüstü uygulaması',
            'iOS ve Android',
            'Üretim altyapısı',
            'Daha fazla dil',
          ],
          state: 'ready',
        },
      ],
    },
    download: {
      eyebrow: 'WAPVE MASAÜSTÜ',
      title: 'Masaüstünde',
      accent: 'tam odak.',
      description:
        'Daha akıcı ses kanalları, sistem tepsisi ve izole masaüstü penceresiyle Wapve deneyimini Windows bilgisayarında yaşa.',
      downloadButton: 'Windows İçin İndir',
      versionBadge: 'Sürüm 0.3.4 (x64 Setup)',
      architectureBadge: 'Windows 10 / 11 · 64-bit',
      requirements: '64-bit Windows 10 (1809+) veya Windows 11 gereklidir.',
      webAlternative: 'İndirmek istemiyorsan tarayıcıda aç',
      securityHeading: 'Güvenlik ve Bütünlük Denetimi',
      securityBadge: 'Kriptografik SHA-256 Onaylı',
      securityDescription:
        'İndirdiğiniz kurulum dosyası, sunucuda resmi derleme sırasında hesaplanan SHA-256 parmak iziyle korunur. Siber saldırı veya araya girme durumunda dosya 1 bit bile değiştirilirse sistemimiz dosyayı sunmayı derhal durdurur.',
      sha256Label: 'Resmi SHA-256 Özeti',
      copyHash: 'Özeti Kopyala',
      hashCopied: 'Kopyalandı!',
      copyCommand: 'PowerShell Doğrulama Komutunu Kopyala',
      commandCopied: 'Komut Kopyalandı!',
      howToVerifyTitle: 'Dosyayı Çalıştırmadan Önce Nasıl Doğrulayabilirsiniz?',
      step1: 'Windows tuşuna basıp "PowerShell" açın.',
      step2: 'Yukarıdaki doğrulama komutunu PowerShell penceresine yapıştırıp Enter tuşuna basın.',
      step3:
        'Çıktı "True" dönüyorsa dosyanın %100 orijinal olduğu ve hiçbir zararlı müdahaleye uğramadığı kanıtlanmıştır.',
      smartScreenTitle: 'Windows Koruması (SmartScreen) Uyarısı',
      smartScreenText:
        'Wapve henüz kurumsal EV sertifikası aşamasına geçmemiştir. Windows SmartScreen mavi ekranı çıkarsa "Ek bilgi" -> "Yine de çalıştır" seçeneğini kullanabilirsiniz. Yukarıdaki SHA-256 kontrolü ile dosyanın Wapve tarafından üretildiğinden emin olabilirsiniz.',
    },
  },
  footer: {
    product: 'Ürün',
    legal: 'Yasal',
    legalLinks: {
      terms: 'Kullanım Koşulları',
      privacy: 'Gizlilik Politikası',
      kvkk: 'KVKK Aydınlatma Metni',
      cookies: 'Çerez Politikası',
      community: 'Topluluk Kuralları',
    },
    rights: 'Tüm hakları saklıdır.',
  },
};

const en: MarketingCopy = {
  nav: {
    features: 'Features',
    plus: 'Wapve+',
    faq: 'FAQ',
    support: 'Support',
    blog: 'Blog',
    security: 'Security',
    roadmap: 'Roadmap',
    download: 'Download',
    login: 'Sign in',
    openApp: 'Open Wapve',
  },
  hero: {
    eyebrow: 'A new place for communities',
    title: 'Your voice, your people.',
    accent: 'One shared wave.',
    description:
      'Wapve is a secure, focused and independent communication platform for conversations, collaboration and the communities you belong to.',
    primary: 'Create a free account',
    secondary: 'Explore features',
    downloadWindows: 'Download for Windows',
    downloadVersion: 'v0.3.4 (64-bit)',
    verifyHash: 'SHA-256 Verification',
    note: 'No invite required · Wapve+ and cosmetics are free',
    mascotAlt: 'Wapve mascot glowing in blue and violet',
  },
  proof: [
    { value: 'TR + EN', label: 'Multilingual foundation' },
    { value: 'Web-first', label: 'Responsive by design' },
    { value: 'Secure by default', label: 'Hardened sessions' },
  ],
  home: {
    featuresEyebrow: 'THE WAPVE EXPERIENCE',
    featuresTitle: 'Less noise. More belonging.',
    featuresText: 'Every piece is built deliberately around real community needs and security.',
    featureCards: [
      {
        icon: 'server',
        title: 'Community servers',
        text: 'Create your server, choose an icon and bring people together with expiring invites.',
        state: 'ready',
      },
      {
        icon: 'message',
        title: 'Fluid messaging',
        text: 'Real-time conversations with replies, reactions, GIFs and files.',
        state: 'ready',
      },
      {
        icon: 'voice',
        title: 'Voice rooms',
        text: 'Meet your community in low-latency voice channels.',
        state: 'ready',
      },
      {
        icon: 'shield',
        title: 'You stay in control',
        text: 'Manage your space with roles, channel permissions and moderation tools.',
        state: 'ready',
      },
      {
        icon: 'user',
        title: 'A real profile',
        text: 'Username, display name, avatar, presence and active session controls.',
        state: 'ready',
      },
      {
        icon: 'devices',
        title: 'Wapve everywhere',
        text: 'Responsive web and Windows desktop, with Android and iOS experiences on one account.',
        state: 'ready',
      },
    ],
    stateLabels: { ready: 'Available now', next: 'Next package', planned: 'Planned' },
    principleEyebrow: 'OUR APPROACH',
    principleTitle: "Security isn't an afterthought.",
    principleText:
      'Wapve has been designed from its first line for the trust private communication spaces deserve.',
    principles: [
      {
        title: 'Honest progress',
        text: 'We clearly separate what is ready, in development and planned.',
      },
      {
        title: 'Privacy-minded',
        text: 'Session secrets avoid browser storage and sensitive values are redacted from logs.',
      },
      {
        title: 'Human scale',
        text: 'We design for natural community communication, not endless noise.',
      },
    ],
    ctaTitle: 'Start your own wave today.',
    ctaText: 'Wapve is open to everyone. Create your free account without an invite code.',
  },
  pages: {
    features: {
      eyebrow: 'PRODUCT FEATURES',
      title: 'Working today. Coming tomorrow.',
      intro:
        'Explore the communication, community, security and customization tools available in Wapve today.',
      groups: [
        {
          title: 'Account and profile',
          text: 'The secure account foundation is ready.',
          items: [
            'Email verification',
            'Avatar and display name',
            'Presence states',
            'Password and session management',
            'Turkish and English',
          ],
          state: 'ready',
        },
        {
          title: 'Community servers',
          text: 'Create your space and invite your members.',
          items: [
            'Server creation',
            'Icon and name controls',
            'Expiring invite codes',
            'Joining and leaving',
            'Member view',
          ],
          state: 'ready',
        },
        {
          title: 'Channels and messages',
          text: 'Real-time community communication is available now.',
          items: [
            'Category system',
            'Text and voice channels',
            'Real-time messaging',
            'Replies, mentions and reactions',
            'File and image sharing',
          ],
          state: 'ready',
        },
        {
          title: 'Connections and control',
          text: 'Friends, direct messaging and moderation tools are available now.',
          items: [
            'Friends and DMs',
            'Roles and permissions',
            'Kick, ban and timeout',
            'Notifications',
            'Notification center and audit log',
          ],
          state: 'ready',
        },
      ],
    },
    security: {
      eyebrow: 'SECURITY',
      title: 'A secure foundation from day one.',
      intro:
        'No software can promise it will “never be hacked.” Wapve uses layered controls to reduce risk and detect problems early.',
      cards: [
        {
          title: 'Hardened sessions',
          text: 'Random opaque session secrets stay in HttpOnly cookies; only their hashes are stored in the database.',
        },
        {
          title: 'Modern password protection',
          text: 'Passwords use Argon2id, weak choices are rejected and resets revoke active sessions.',
        },
        {
          title: 'Request protection',
          text: 'Mutations require CSRF and Origin checks; sensitive endpoints use IP and account rate limits.',
        },
        {
          title: 'Safer uploads',
          text: 'Uploads are inspected beyond extensions using content and magic-byte validation, then images are re-encoded.',
        },
        {
          title: 'Least privilege',
          text: 'Unverified accounts are restricted and ownership or membership is checked server-side on every request.',
        },
        {
          title: 'Continuous checks',
          text: 'Linting, types, unit and end-to-end tests, dependency audits and secret scans form the quality gate.',
        },
      ],
      noteTitle: 'Found a security issue?',
      noteText:
        'Privately report a possible security issue to info@wapve.com through the flow on the Support page.',
    },
    roadmap: {
      eyebrow: 'ROADMAP',
      title: 'Wapve grows in waves.',
      intro:
        'We optimize for quality, not arbitrary dates. Ordering may evolve with product needs; these are our current development phases.',
      phases: [
        {
          number: '01',
          title: 'Secure foundation',
          text: 'The core of identity, profiles and community servers.',
          items: [
            'Account and email verification',
            'Profile, presence and sessions',
            'Server and invite system',
            'Responsive app shell',
          ],
          state: 'ready',
        },
        {
          number: '02',
          title: 'Community communication',
          text: 'The package that brings servers to life.',
          items: [
            'Categories and channels',
            'Channel permissions',
            'Real-time messaging',
            'Files, reactions and mentions',
          ],
          state: 'ready',
        },
        {
          number: '03',
          title: 'Being together',
          text: 'Completing communication with voice, friends and control.',
          items: [
            'WebRTC voice chat',
            'Friends and direct messages',
            'Roles and moderation',
            'Notification system',
          ],
          state: 'ready',
        },
        {
          number: '04',
          title: 'Every platform',
          text: 'Keeping Wapve available across web, Windows and mobile devices.',
          items: [
            'Windows desktop app',
            'iOS and Android',
            'Production infrastructure',
            'More languages',
          ],
          state: 'ready',
        },
      ],
    },
    download: {
      eyebrow: 'WAPVE DESKTOP',
      title: 'Full focus',
      accent: 'on your desktop.',
      description:
        'Experience Wapve on your Windows PC with smoother voice channels, system tray minimization and an isolated desktop frame.',
      downloadButton: 'Download for Windows',
      versionBadge: 'Version 0.3.4 (x64 Setup)',
      architectureBadge: 'Windows 10 / 11 · 64-bit',
      requirements: 'Requires 64-bit Windows 10 (1809+) or Windows 11.',
      webAlternative: 'Prefer the browser? Open web app',
      securityHeading: 'Security & Integrity Verification',
      securityBadge: 'Cryptographic SHA-256 Pinned',
      securityDescription:
        'The downloaded installer is protected by a cryptographic SHA-256 fingerprint computed during the official release build. If the file is altered by even a single bit in a cyberattack or MITM event, our server halts delivery immediately.',
      sha256Label: 'Official SHA-256 Checksum',
      copyHash: 'Copy Checksum',
      hashCopied: 'Copied!',
      copyCommand: 'Copy PowerShell Verification Command',
      commandCopied: 'Command Copied!',
      howToVerifyTitle: 'How to Verify the File Before Running',
      step1: 'Press the Windows key and open PowerShell.',
      step2: 'Paste the verification command above into your PowerShell window and press Enter.',
      step3:
        'If the output is "True", the file is 100% authentic and has not been tampered with.',
      smartScreenTitle: 'Windows Defender SmartScreen Notice',
      smartScreenText:
        'Wapve is not yet signed with an enterprise EV certificate. If Windows SmartScreen appears, click "More info" -> "Run anyway". You can verify the SHA-256 hash above to be completely confident the binary is authentic.',
    },
  },
  footer: {
    product: 'Product',
    legal: 'Legal',
    legalLinks: {
      terms: 'Terms of Use',
      privacy: 'Privacy Policy',
      kvkk: 'KVKK Notice',
      cookies: 'Cookie Policy',
      community: 'Community Rules',
    },
    rights: 'All rights reserved.',
  },
};

export function marketingCopy(locale: Locale): MarketingCopy {
  return locale === 'en' ? en : tr;
}
