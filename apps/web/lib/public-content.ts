import type { Locale } from '@wapve/contracts';

type Localized = { tr: string; en: string };

export function localized(locale: Locale, value: Localized): string {
  return value[locale];
}

export const faqCategories = [
  {
    title: { tr: 'Başlangıç ve hesap', en: 'Getting started and accounts' },
    items: [
      {
        question: {
          tr: 'Wapve’ye katılmak için davet kodu gerekiyor mu?',
          en: 'Do I need an invite code to join Wapve?',
        },
        answer: {
          tr: 'Hayır. Wapve herkese açıktır; kayıt sayfasından e-posta adresin, kullanıcı adın ve parolanla ücretsiz hesap oluşturabilirsin. E-posta doğrulaması hesap güvenliği için zorunludur.',
          en: 'No. Wapve is open to everyone. Create a free account with your email address, username and password. Email verification is required to protect the account.',
        },
      },
      {
        question: {
          tr: 'Wapve hangi cihazlarda çalışıyor?',
          en: 'Which devices does Wapve support?',
        },
        answer: {
          tr: 'Wapve modern web tarayıcılarında ve Windows masaüstü uygulamasında kullanılabilir. Mobil uygulamalar Android ve iOS için geliştirilmektedir; kullanılabilirlik mağaza dağıtımına göre değişebilir.',
          en: 'Wapve works in modern web browsers and the Windows desktop app. Android and iOS apps are in development; availability may vary by app-store distribution.',
        },
      },
      {
        question: { tr: 'Kullanıcı adımı değiştirebilir miyim?', en: 'Can I change my username?' },
        answer: {
          tr: 'Evet. Hesap ayarlarından kullanıcı adını değiştirebilirsin. Kötüye kullanımı önlemek için değişiklikler arasında bekleme süresi uygulanır; görünen adını ise profilinden ayrıca düzenleyebilirsin.',
          en: 'Yes. Change it from account settings. A cooldown applies between username changes to prevent abuse, while your display name can be edited separately from your profile.',
        },
      },
    ],
  },
  {
    title: { tr: 'Sunucular, mesajlar ve ses', en: 'Servers, messages and voice' },
    items: [
      {
        question: {
          tr: 'Kendi topluluğumu nasıl kurarım?',
          en: 'How do I create my own community?',
        },
        answer: {
          tr: 'Uygulamadaki sunucu ekleme düğmesinden yeni bir sunucu oluştur, roller ve kanal izinlerini ayarla, ardından süreli veya kullanım sınırlı davet bağlantısı paylaş. Sunucu sahibi moderasyon ve denetim araçlarına erişir.',
          en: 'Use the add-server button, configure roles and channel permissions, then share an expiring or usage-limited invite. The server owner gets moderation and audit tools.',
        },
      },
      {
        question: {
          tr: 'Mesajlarda hangi içerikleri paylaşabilirim?',
          en: 'What can I share in messages?',
        },
        answer: {
          tr: 'Metin, yanıt, tepki, GIF ve desteklenen dosya türlerini paylaşabilirsin. Dosyalar boyut ve gerçek içerik türü kontrollerinden geçer. Topluluk Kurallarına aykırı içerikler kaldırılabilir.',
          en: 'You can share text, replies, reactions, GIFs and supported file types. Uploads are checked for size and actual content type. Content that violates the Community Rules may be removed.',
        },
      },
      {
        question: {
          tr: 'Sesli kanallarda IP adresim diğer kullanıcılara açık mı?',
          en: 'Is my IP address exposed to other people in voice channels?',
        },
        answer: {
          tr: 'Ses trafiği Wapve’nin medya aktarım katmanı üzerinden iletilir; katılımcılar arasında doğrudan eşler arası bağlantı kurulmaz. Taşıma şifrelemesi kullanılır, ancak bunu uçtan uca şifreleme olarak tanımlamıyoruz.',
          en: 'Voice traffic is relayed through Wapve’s media layer rather than a direct peer-to-peer connection between participants. Transport encryption is used, but we do not describe it as end-to-end encryption.',
        },
      },
    ],
  },
  {
    title: { tr: 'Wapve+ ve kozmetikler', en: 'Wapve+ and cosmetics' },
    items: [
      {
        question: { tr: 'Wapve+ ücretli mi?', en: 'Is Wapve+ paid?' },
        answer: {
          tr: 'Hayır. Wapve+ ve mevcut kozmetik koleksiyonları yayın sürümünde tüm hesaplara ücretsizdir. Ödeme yöntemi, otomatik yenileme veya ücretli abonelik bulunmaz.',
          en: 'No. Wapve+ and the current cosmetic collections are free for every account in the public release. There is no payment method, automatic renewal or paid subscription.',
        },
      },
      {
        question: {
          tr: 'Kozmetiklerin parasal veya takas değeri var mı?',
          en: 'Do cosmetics have monetary or trade value?',
        },
        answer: {
          tr: 'Hayır. Kozmetikler yalnızca profilini kişiselleştiren dijital öğelerdir; satılamaz, nakde çevrilemez ve Wapve dışında mülkiyet hakkı oluşturmaz.',
          en: 'No. Cosmetics are digital profile customization items only. They cannot be sold, redeemed for cash or treated as property outside Wapve.',
        },
      },
      {
        question: {
          tr: 'Hareketli sunucu emojisini durumumda kullanabilir miyim?',
          en: 'Can I use an animated server emoji in my status?',
        },
        answer: {
          tr: 'Şimdilik hayır. Katıldığın farklı sunuculardaki statik emojileri durumunda kullanabilirsin; hareketli emojiler seçicide gösterilir ancak devre dışıdır.',
          en: 'Not yet. You can use static emojis from any server you joined. Animated emojis appear in the picker but remain disabled for status.',
        },
      },
    ],
  },
  {
    title: { tr: 'Güvenlik, gizlilik ve destek', en: 'Security, privacy and support' },
    items: [
      {
        question: {
          tr: 'Hesabımı nasıl daha iyi korurum?',
          en: 'How can I better protect my account?',
        },
        answer: {
          tr: 'Benzersiz ve uzun bir parola kullan, iki adımlı doğrulamayı veya geçiş anahtarını etkinleştir, tanımadığın oturumları kapat ve giriş onayı e-postalarını dikkate al. Wapve senden parolanı e-posta veya mesajla istemez.',
          en: 'Use a unique long password, enable two-factor authentication or a passkey, revoke unfamiliar sessions and pay attention to login-approval emails. Wapve will never ask for your password by email or message.',
        },
      },
      {
        question: {
          tr: 'Bir kullanıcıyı veya içeriği nasıl bildiririm?',
          en: 'How do I report a user or content?',
        },
        answer: {
          tr: 'Profil ve mesaj menülerindeki Bildir seçeneğini kullan. Acil tehlike varsa önce yerel acil yardım birimleriyle iletişime geç. Hesabına erişemiyorsan destek sayfasındaki e-posta akışını kullanabilirsin.',
          en: 'Use Report from profile and message menus. If there is imminent danger, contact local emergency services first. If you cannot access your account, use the email flow on the Support page.',
        },
      },
      {
        question: {
          tr: 'Verilerimin kopyasını isteyebilir veya hesabımı silebilir miyim?',
          en: 'Can I request my data or delete my account?',
        },
        answer: {
          tr: 'Evet. Hesap ayarlarından silme sürecini başlatabilir; erişim, düzeltme ve diğer gizlilik talepleri için Gizlilik Politikası ve KVKK Aydınlatma Metnindeki iletişim kanalını kullanabilirsin.',
          en: 'Yes. Start account deletion in settings. For access, correction and other privacy requests, use the contact channel in the Privacy Policy and KVKK Notice.',
        },
      },
    ],
  },
] as const;

export const plusBenefits = [
  {
    title: { tr: 'Profil koleksiyonları', en: 'Profile collections' },
    text: {
      tr: 'Avatar dekorasyonları, profil efektleri, çerçeveler ve isim plakalarıyla profilini özgünleştir.',
      en: 'Personalize your profile with avatar decorations, effects, frames and nameplates.',
    },
  },
  {
    title: { tr: 'Ücretsiz erişim', en: 'Free access' },
    text: {
      tr: 'Tüm hesaplar Wapve+ özelliklerine süresiz ve ödeme bilgisi vermeden erişir.',
      en: 'Every account gets Wapve+ features with no expiry and no payment details.',
    },
  },
  {
    title: { tr: 'Sunucu destekleri', en: 'Server supports' },
    text: {
      tr: 'Destek yuvalarını sevdiğin sunuculara ayır; topluluk seviyelerine birlikte katkı sağla.',
      en: 'Assign support slots to communities you care about and contribute to server levels together.',
    },
  },
  {
    title: { tr: 'Koleksiyon paketi', en: 'Collection bundles' },
    text: {
      tr: 'Uyumlu avatar, efekt ve plaka setlerini tek adımda koleksiyonuna ekle.',
      en: 'Add matching avatar, effect and nameplate sets to your collection in one step.',
    },
  },
  {
    title: { tr: 'Cihazlar arası profil', en: 'Cross-device profile' },
    text: {
      tr: 'Seçtiğin görünüm web ve masaüstü deneyiminde profilinde korunur.',
      en: 'Your selected look stays attached to your profile across web and desktop.',
    },
  },
  {
    title: { tr: 'Gizli ücret yok', en: 'No hidden charge' },
    text: {
      tr: 'Satın alma, kart bilgisi, deneme süresi veya otomatik yenileme akışı bulunmaz.',
      en: 'There is no checkout, card storage, trial period or automatic renewal flow.',
    },
  },
] as const;

export const supportTopics = [
  {
    title: { tr: 'Hesap ve giriş', en: 'Account and sign-in' },
    text: {
      tr: 'E-posta doğrulama, parola sıfırlama, iki adımlı doğrulama, geçiş anahtarı veya hesabına erişim.',
      en: 'Email verification, password reset, two-factor authentication, passkeys or account access.',
    },
    subject: 'Account support',
  },
  {
    title: { tr: 'Güvenlik bildirimi', en: 'Security report' },
    text: {
      tr: 'Olası güvenlik açığını; etkilenen adres, tekrar adımları ve etkiyle birlikte gizlice bildir.',
      en: 'Privately report a possible vulnerability with the affected URL, reproduction steps and impact.',
    },
    subject: 'Private security report',
  },
  {
    title: { tr: 'Güven ve güvenlik', en: 'Trust and safety' },
    text: {
      tr: 'Taciz, tehdit, çocuk güvenliği, yasa dışı içerik veya platform kötüye kullanımı. Uygulama içi raporlamayı öncelikle kullan.',
      en: 'Harassment, threats, child safety, illegal content or platform abuse. Prefer in-app reporting when available.',
    },
    subject: 'Trust and safety report',
  },
  {
    title: { tr: 'Telif ve içerik kaldırma', en: 'Copyright and content removal' },
    text: {
      tr: 'Hak sahibiysen içeriğin konumunu, korunan eseri ve iletişim bilgilerini Telif Politikasındaki usule göre gönder.',
      en: 'If you are a rights holder, send the content location, protected work and contact information under the Copyright Policy procedure.',
    },
    subject: 'Copyright notice',
  },
] as const;

export const blogPosts = [
  {
    slug: 'wapve-herkese-acik',
    category: { tr: 'Ürün', en: 'Product' },
    date: '2026-09-01',
    readMinutes: 4,
    title: { tr: 'Wapve artık herkese açık', en: 'Wapve is now open to everyone' },
    summary: {
      tr: 'Davet kodu zorunluluğu kalktı. Wapve’nin kamusal sürümü hesap güvenliği ve topluluk araçlarıyla kullanıma açıldı.',
      en: 'Invite codes are gone. Wapve’s public release is now available with account security and community tools.',
    },
    sections: [
      {
        title: { tr: 'Dalgayı açıyoruz', en: 'Opening the wave' },
        paragraphs: [
          {
            tr: 'Wapve’yi kapalı test döneminden kamusal sürüme taşıyoruz. Yeni hesaplar davet kodu olmadan kaydolabilir, e-posta adresini doğruladıktan sonra topluluklara katılabilir ve kendi sunucusunu kurabilir.',
            en: 'Wapve is moving from closed testing to public release. New accounts can register without an invite code, verify an email address, join communities and create a server.',
          },
        ],
      },
      {
        title: { tr: 'Bugün neler var?', en: 'What is available today?' },
        paragraphs: [
          {
            tr: 'Gerçek zamanlı mesajlaşma, arkadaşlar ve özel mesajlar, sesli kanallar, roller, izinler, moderasyon, bildirimler, iki adımlı doğrulama ve geçiş anahtarları yayın sürümünün parçasıdır.',
            en: 'Real-time messaging, friends and DMs, voice channels, roles, permissions, moderation, notifications, two-factor authentication and passkeys are part of the public release.',
          },
        ],
      },
      {
        title: { tr: 'Geri bildirim sürüyor', en: 'Feedback continues' },
        paragraphs: [
          {
            tr: 'Yayın, geliştirmenin bittiği anlamına gelmiyor. Destek ve uygulama içi raporlama kanalları; hata, güvenlik ve kullanılabilirlik geri bildirimleri için açık kalacak.',
            en: 'Public release does not mean development is finished. Support and in-app reporting remain open for bugs, security and usability feedback.',
          },
        ],
      },
    ],
  },
  {
    slug: 'wapve-plus-ucretsiz-kaliyor',
    category: { tr: 'Wapve+', en: 'Wapve+' },
    date: '2026-09-01',
    readMinutes: 3,
    title: { tr: 'Wapve+ ve kozmetikler ücretsiz kalıyor', en: 'Wapve+ and cosmetics remain free' },
    summary: {
      tr: 'Profil efektleri, avatar dekorasyonları ve koleksiyonlar için kart, deneme veya otomatik yenileme yok.',
      en: 'Profile effects, avatar decorations and collections require no card, trial or renewal.',
    },
    sections: [
      {
        title: { tr: 'Ödeme duvarı yok', en: 'No paywall' },
        paragraphs: [
          {
            tr: 'Kamusal sürümde Wapve+ her aktif hesaba açıktır. Ödeme yöntemi eklemez, deneme süresi başlatmaz ve otomatik yenileme yapmayız.',
            en: 'In the public release, Wapve+ is available to every active account. We do not collect a payment method, start a trial or renew anything automatically.',
          },
        ],
      },
      {
        title: { tr: 'Kozmetik ne demek?', en: 'What are cosmetics?' },
        paragraphs: [
          {
            tr: 'Kozmetikler avatarını, profil kartını ve isim görünümünü değiştiren dijital tasarımlardır. Parasal değerleri yoktur; satılamaz veya nakde çevrilemez.',
            en: 'Cosmetics are digital designs that change the look of your avatar, profile card and name. They have no monetary value and cannot be sold or redeemed for cash.',
          },
        ],
      },
      {
        title: { tr: 'Açık söz', en: 'A clear promise' },
        paragraphs: [
          {
            tr: 'Gelecekte ücretli, ayrı bir ürün sunulursa fiyatı, koşulları ve onay akışı ayrıca ve önceden açıklanır. Mevcut Wapve+ erişimi için sessizce ücret oluşturulmaz.',
            en: 'If a separate paid product is introduced in the future, its price, terms and consent flow will be disclosed in advance. Existing Wapve+ access will not silently generate a charge.',
          },
        ],
      },
    ],
  },
  {
    slug: 'guvenlik-tasarimi',
    category: { tr: 'Güvenlik', en: 'Security' },
    date: '2026-09-01',
    readMinutes: 6,
    title: { tr: 'Wapve’de güvenlik nasıl ele alınıyor?', en: 'How Wapve approaches security' },
    summary: {
      tr: 'Oturumlar, parola koruması, dosya doğrulama, izin kontrolleri ve sorumlu bildirim akışı.',
      en: 'Sessions, password protection, file validation, permission checks and responsible reporting.',
    },
    sections: [
      {
        title: { tr: 'Katmanlı savunma', en: 'Layered defense' },
        paragraphs: [
          {
            tr: 'Tek bir kontrole güvenmek yerine kimlik doğrulama, yetkilendirme, istek doğrulama, hız sınırı, dosya işleme ve denetim kayıtları birbirini tamamlar. Hiçbir sistem için “asla saldırıya uğramaz” iddiasında bulunmuyoruz.',
            en: 'Authentication, authorization, request validation, rate limits, file processing and audit records reinforce one another rather than relying on one control. We do not claim any system can “never be hacked.”',
          },
        ],
      },
      {
        title: { tr: 'Hesap koruması', en: 'Account protection' },
        paragraphs: [
          {
            tr: 'Parolalar Argon2id ile türetilir; oturum belirteçlerinin açık değeri veritabanında tutulmaz. HttpOnly çerezler, CSRF ve Origin kontrolleri, giriş onayı, iki adımlı doğrulama ve geçiş anahtarları hesap katmanını güçlendirir.',
            en: 'Passwords are derived with Argon2id and raw session tokens are not stored in the database. HttpOnly cookies, CSRF and Origin checks, login approval, two-factor authentication and passkeys reinforce the account layer.',
          },
        ],
      },
      {
        title: { tr: 'Sorumlu bildirim', en: 'Responsible reporting' },
        paragraphs: [
          {
            tr: 'Bir güvenlik sorunu bulursan herkese açık alanda ayrıntı yayımlamadan destek sayfasındaki güvenlik bildirim kanalını kullan. Etkilenen adresi, tekrar adımlarını ve olası etkiyi eklemek incelemeyi hızlandırır.',
            en: 'If you find a security issue, use the private security-report channel on the Support page before publishing details. Include the affected URL, reproduction steps and possible impact.',
          },
        ],
      },
    ],
  },
] as const;

export type BlogPost = (typeof blogPosts)[number];

export function blogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}
