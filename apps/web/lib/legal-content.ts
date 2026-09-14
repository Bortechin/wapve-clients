import type { Locale } from '@wapve/contracts';

export const legalSlugs = [
  'terms',
  'privacy',
  'kvkk',
  'cookies',
  'community',
  'copyright',
] as const;

export type LegalSlug = (typeof legalSlugs)[number];

type LegalSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

export type LegalDocument = {
  title: string;
  eyebrow: string;
  summary: string;
  updatedAt: string;
  sections: LegalSection[];
};

const contactTr =
  'Bu metinle ilgili bildirim ve taleplerinizi info@wapve.com adresine iletebilirsiniz.';
const contactEn = 'You may send notices and requests concerning this document to info@wapve.com.';

const tr: Record<LegalSlug, LegalDocument> = {
  terms: {
    title: 'Kullanım Koşulları',
    eyebrow: 'WAPVE YASAL',
    summary:
      'Bu koşullar; Wapve internet sitesi, topluluk sunucuları, mesajlaşma, sesli ve görüntülü iletişim ile bağlantılı hizmetlerin kullanımını düzenler.',
    updatedAt: '4 Eylül 2026',
    sections: [
      {
        title: '1. Taraflar ve kabul',
        paragraphs: [
          'Wapve hizmetlerini kullanmanız, bu Kullanım Koşulları ile Gizlilik Politikası, KVKK Aydınlatma Metni, Çerez Politikası ve Topluluk Kurallarının size uygulanacağını kabul ettiğiniz anlamına gelir. Aydınlatma metninin sunulması, kişisel veri işleme için ayrıca açık rıza gereken durumlarda rıza yerine geçmez.',
          'Bu koşulları kabul etmiyorsanız hesap oluşturmamalı veya hizmeti kullanmamalısınız.',
        ],
      },
      {
        title: '2. Uygunluk ve hesap güvenliği',
        items: [
          'Hizmeti kullanmak için en az 13 yaşında olmalısınız. Reşit değilseniz hizmeti velinizin veya yasal temsilcinizin bilgisi ve gözetimiyle kullanmalısınız.',
          'Kayıt sırasında doğru ve güncel bilgi vermeli, hesabınızı başkasına devretmemeli ve giriş bilgilerinizi korumalısınız.',
          'Hesabınızda yetkisiz kullanım fark ederseniz gecikmeden info@wapve.com adresine bildirmelisiniz.',
          'Bir kişi adına hesap açmak, kimliğe bürünmek veya teknik sınırlamaları aşmak yasaktır.',
        ],
      },
      {
        title: '3. Hizmetin kapsamı, ücretsiz erişim ve Wapve+',
        paragraphs: [
          'Wapve herkese açık, ücretsiz bir iletişim hizmetidir. Planlı bakım, güvenlik olayı, kapasite veya makul kontrol dışı olaylar nedeniyle özellikler geçici olarak sınırlandırılabilir ya da kesinti yaşanabilir.',
          'Wapve+ ve mevcut profil kozmetikleri için ödeme, deneme süresi, otomatik yenileme veya abonelik ücreti bulunmaz. Kozmetiklerin parasal ya da takas değeri yoktur; satılamaz ve nakde çevrilemez.',
          'Gelecekte ayrı bir ücretli ürün sunulursa fiyat, yenileme, cayma ve uygulanabilir tüketici koşulları satın alma öncesinde ayrıca gösterilir ve gerekli onay alınır. Bu koşullar tek başına herhangi bir ücret doğurmaz.',
        ],
      },
      {
        title: '4. Kullanıcı içeriği',
        paragraphs: [
          'Mesaj, dosya, görsel, profil bilgisi, sunucu adı ve benzeri içerikleriniz üzerindeki haklarınız size aittir. İçeriği Wapve’ye yükleyerek yalnızca hizmeti barındırmak, iletmek, görüntülemek, güvenliğini sağlamak ve sizin talep ettiğiniz özellikleri sunmak için gereken, dünya çapında, münhasır olmayan ve hizmetle sınırlı teknik kullanım iznini verirsiniz.',
          'İçeriği paylaşmaya yetkili olduğunuzu ve içeriğin üçüncü kişilerin fikrî mülkiyet, kişilik, gizlilik veya diğer haklarını ihlal etmediğini garanti edersiniz. Başka kullanıcıların içeriklerini Wapve dışında kullanmak için ayrıca izin almalısınız.',
        ],
      },
      {
        title: '5. Yasaklanan kullanım',
        items: [
          'Hukuka aykırı, tehditkâr, taciz edici, nefret içeren, şiddeti teşvik eden veya çocukların güvenliğini tehlikeye atan içerik ve davranışlar',
          'İzinsiz kişisel veri paylaşımı, dolandırıcılık, kimlik avı, spam, zararlı yazılım, saldırı veya hizmeti bozma girişimleri',
          'Telif, marka, özel hayat, haberleşmenin gizliliği veya diğer hakları ihlal eden içerikler',
          'Erişim kontrollerini, hız sınırlarını, moderasyon kararlarını veya güvenlik önlemlerini aşma girişimleri',
          'Hizmeti izinsiz ticari veri toplama, otomatik hesap üretme, kazıma veya yeniden satış amacıyla kullanma',
        ],
      },
      {
        title: '6. Moderasyon ve yaptırımlar',
        paragraphs: [
          'Wapve ve yetkili topluluk yöneticileri, güvenlik ve kuralların uygulanması için içeriği inceleyebilir; içeriği kaldırabilir, görünürlüğünü sınırlayabilir, hesabı geçici olarak kısıtlayabilir veya sonlandırabilir. Acil risklerde önceden bildirim yapılmayabilir.',
          'Hukuken saklanması gereken kayıtlar korunabilir ve geçerli bir yetkili makam talebi üzerine ilgili makamlarla paylaşılabilir. Moderasyon kararına info@wapve.com üzerinden gerekçenizle itiraz edebilirsiniz.',
        ],
      },
      {
        title: '7. Fikrî mülkiyet',
        paragraphs: [
          'Wapve adı, logosu, maskotu, arayüzü, yazılımı ve Wapve tarafından üretilen içerikler ilgili hak sahiplerine aittir. Bu koşullar size hizmeti kişisel ve koşullara uygun kullanmak dışında bir lisans vermez.',
          'Hak ihlali bildirimi; hak sahibini, ihlal edildiği ileri sürülen eseri veya hakkı, ilgili içeriğin konumunu, iletişim bilgilerini ve beyanın doğruluğuna ilişkin açıklamayı içermelidir.',
        ],
      },
      {
        title: '8. Üçüncü taraf hizmetleri',
        paragraphs: [
          'GIF araması veya dış bağlantılar gibi özellikler üçüncü taraf içerik ve hizmetlerine erişim sağlayabilir. Bu hizmetlerin kendi koşulları geçerli olabilir. Wapve, üçüncü taraf bir hizmetin içeriğini veya kesintisiz çalışmasını garanti etmez.',
        ],
      },
      {
        title: '9. Sorumluluğun sınırı',
        paragraphs: [
          'Emredici mevzuatın izin verdiği ölçüde hizmet mevcut hâliyle sunulur. Wapve; kullanıcıların oluşturduğu içerikten, kullanıcılar arası işlemlerden veya makul kontrolü dışındaki kesintilerden sorumlu değildir. Bu hüküm, kasıt veya ağır kusurdan doğan sorumluluğu ve tüketicinin vazgeçilemez haklarını ortadan kaldırmaz.',
          'Veri kaybı riskine karşı önemli içeriklerinizi ayrıca saklamanız gerekir.',
        ],
      },
      {
        title: '10. Değişiklik, sona erme ve hukuk',
        paragraphs: [
          'Esaslı değişiklikler yürürlüğe girmeden önce site veya uygun bir iletişim kanalı üzerinden duyurulur. Değişiklik sonrası kullanıma devam etmeniz güncel koşullara tabi olur; emredici hukuk kapsamında ayrıca onay gereken hâller saklıdır.',
          'Bu koşullara Türkiye Cumhuriyeti hukuku uygulanır. Tüketici işlemlerinde yetkili tüketici hakem heyetleri ve tüketici mahkemeleri dâhil emredici yetki kuralları korunur.',
          contactTr,
        ],
      },
    ],
  },
  privacy: {
    title: 'Gizlilik Politikası',
    eyebrow: 'GİZLİLİK',
    summary:
      'Wapve’nin hangi bilgileri neden kullandığını, kimlerle paylaştığını ve seçimlerinizi sade bir dille açıklar.',
    updatedAt: '1 Eylül 2026',
    sections: [
      {
        title: '1. Kapsam',
        paragraphs: [
          'Bu politika Wapve web sitesi ve uygulamasını kullanan ziyaretçiler, hesap sahipleri ve topluluk üyeleri için geçerlidir. Wapve içinde bağlantı verilen bağımsız üçüncü taraf hizmetlerinin kendi gizlilik metinleri geçerlidir.',
        ],
      },
      {
        title: '2. Toplanan bilgiler',
        items: [
          'Hesap bilgileri: e-posta adresi, kullanıcı adı, görünen ad, parola özeti, dil, durum, e-posta doğrulama bilgisi, iki adımlı doğrulama veya geçiş anahtarı kaydı ve isteğe bağlı profil görselleri',
          'Topluluk ve içerik bilgileri: sunucular, roller, kanallar, arkadaşlıklar, mesajlar, tepkiler, anketler, bildirimler, yüklenen dosyalar ve moderasyon kayıtları',
          'İletişim bilgileri: destek, itiraz, hak talebi ve güvenlik bildirimi içerikleri',
          'Teknik ve güvenlik bilgileri: IP adresi, yaklaşık ülke, tarayıcı veya cihaz bilgisi, cihaz/push belirteci, oturum zamanı, istek ve güvenlik olay kayıtları',
          'Ses ve görüntü: görüşme medyası Wapve tarafından yönetilen TURN aktarım katmanı üzerinden gerçek zamanlı taşınır; katılımcılar arasında doğrudan eşler arası bağlantı kurulmaz ve Wapve görüşme sesini veya görüntüsünü kaydetmez. Bağlantı durumu ve sınırlı hata tanıları işlenebilir.',
        ],
      },
      {
        title: '3. Kullanım amaçları',
        items: [
          'Hesap açmak, kimlik doğrulamak ve oturumları korumak',
          'Mesajlaşma, topluluk, arkadaşlık, bildirim, dosya ve sesli veya görüntülü iletişim özelliklerini sunmak',
          'Kötüye kullanım, spam, dolandırıcılık ve güvenlik tehditlerini önlemek; moderasyon kararlarını uygulamak',
          'Hataları gidermek, performansı ve hizmet güvenilirliğini ölçmek',
          'Yasal yükümlülükleri yerine getirmek ve geçerli başvurulara yanıt vermek',
        ],
      },
      {
        title: '4. Hukuki dayanaklar',
        paragraphs: [
          'Veriler; kullanıcıyla kurulan sözleşmenin ifası için gerekli olma, veri sorumlusunun hukuki yükümlülüğünü yerine getirmesi, bir hakkın tesisi veya korunması ve temel haklara zarar vermemek kaydıyla meşru menfaat dayanaklarıyla işlenir. Mevzuatın açık rıza gerektirdiği ayrı bir işlem olursa amaç, veri türü ve seçim ayrıca gösterilir; hizmet için zorunlu olmayan rıza her zaman geri alınabilir.',
        ],
      },
      {
        title: '5. Paylaşım ve hizmet sağlayıcılar',
        items: [
          'Türkiye’deki barındırma, veri tabanı, nesne depolama, e-posta ve altyapı sağlayıcıları hizmetin işletilmesi için sınırlı veri işleyebilir.',
          'Cloudflare güvenlik, DNS, CDN ve saldırı önleme hizmetleri kapsamında ağ ve istek verilerini işleyebilir.',
          'KLIPY, GIF araması veya GIF paylaşımı istediğinizde arama ve seçime ilişkin sınırlı teknik verileri işleyebilir.',
          'Geçerli ve bağlayıcı bir hukuki talep olduğunda yetkili kamu kurumlarıyla gerekli bilgiler paylaşılabilir.',
          'Wapve kişisel verileri satmaz ve davranışsal reklam amacıyla paylaşmaz.',
        ],
      },
      {
        title: '6. Yurt dışına aktarım',
        paragraphs: [
          'Cloudflare veya isteğe bağlı üçüncü taraf içerik sağlayıcılarının küresel altyapısı nedeniyle sınırlı teknik veriler Türkiye dışında işlenebilir. Böyle bir aktarım yalnızca 6698 sayılı Kanun’un 9. maddesindeki aktarım şartlarından biri ve gerekli teknik/idari güvenceler sağlandığında gerçekleştirilir. Aktarımın dayanağı uygun güvence veya mevzuatta izin verilen istisnai hâl olabilir; yalnızca bu metni okumanız açık rıza sayılmaz.',
        ],
      },
      {
        title: '7. Saklama ve silme',
        items: [
          'Hesap ve profil bilgileri hesap aktif olduğu sürece; sonrasında talep, uyuşmazlık ve yasal yükümlülükler için gerekli süre boyunca tutulur.',
          'Mesaj ve dosyalar kullanıcı veya yetkili tarafından silinene, ilgili alan kaldırılana ya da hesabın kapatılması kapsamındaki silme süreci tamamlanana kadar saklanır.',
          'Oturum çerezleri en çok 30 gün geçerlidir; doğrulama bağlantıları 24 saat, parola sıfırlama bağlantıları 30 dakika geçerlidir.',
          'Silinen üretim verileri, döngüsel yedeklerde en fazla 7 gün daha bulunabilir ve geri yükleme dışında kullanılamaz.',
          'Güvenlik, denetim ve hukuki kayıtlar olayın niteliğine ve uygulanabilir zamanaşımı veya saklama yükümlülüklerine göre yalnızca gerekli süre boyunca tutulur.',
        ],
      },
      {
        title: '8. Güvenlik',
        paragraphs: [
          'Wapve; şifreli aktarım, parola özetleme, HttpOnly oturum çerezleri, CSRF ve origin doğrulaması, hız sınırlama, erişim kontrolleri, yedekleme ve güvenlik duvarı gibi önlemler kullanır. İnternet üzerinden hiçbir sistem mutlak güvenlik garanti edemez.',
        ],
      },
      {
        title: '9. Seçimleriniz ve çocuklar',
        paragraphs: [
          'Profil ve oturum ayarlarınızı uygulama içinden yönetebilir, içeriklerinizi silebilir ve hukuki haklarınız için başvurabilirsiniz. Wapve 13 yaş altındaki kişilere yönelik değildir. Böyle bir hesaptan haberdar olursak doğrulama isteyebilir ve hesabı kapatabiliriz.',
        ],
      },
      {
        title: '10. İletişim ve değişiklikler',
        paragraphs: [
          'Politikadaki önemli değişiklikler yürürlüğe girmeden önce uygun kanallardan bildirilir ve güncelleme tarihi değiştirilir.',
          contactTr,
        ],
      },
    ],
  },
  kvkk: {
    title: 'KVKK Aydınlatma Metni',
    eyebrow: '6698 SAYILI KANUN',
    summary:
      'Wapve kullanıcıları ve ziyaretçileri için, 6698 sayılı Kişisel Verilerin Korunması Kanunu’nun 10. maddesi kapsamındaki aydınlatma metnidir.',
    updatedAt: '1 Eylül 2026',
    sections: [
      {
        title: '1. Veri sorumlusu ve iletişim',
        paragraphs: [
          'Kişisel verileriniz bakımından veri sorumlusu Wapve hizmetinin işletmecisi Wapve’dir. Veri sorumlusuna ilişkin başvurular info@wapve.com adresine gönderilebilir.',
        ],
      },
      {
        title: '2. İşlenen kişisel veriler',
        items: [
          'Kimlik ve hesap: kullanıcı adı, görünen ad, doğum tarihi, e-posta, Wapve kullanıcı numarası, dil, durum ve doğrulama bilgileri',
          'İşlem güvenliği: IP adresi, cihaz/tarayıcı bilgisi, oturum ve erişim kayıtları, güvenlik ve denetim olayları',
          'İletişim ve içerik: mesajlar, dosyalar, tepkiler, anketler, topluluk üyelikleri, arkadaşlıklar, bildirimler ve destek yazışmaları',
          'Görsel kayıtlar: kullanıcının yüklediği avatar, profil afişi, sunucu ikonu ve mesaj ekleri',
          'Hukuki işlem: talep, şikâyet, itiraz ve yetkili makam yazışmaları',
        ],
      },
      {
        title: '3. Amaçlar ve hukuki sebepler',
        items: [
          'Hesabın, yaş uygunluğu kontrolünün ve hizmetlerin sunulması: Kanun m.5/2(c), sözleşmenin kurulması veya ifası için gerekli olma',
          'Güvenlik, dolandırıcılık ve kötüye kullanımın önlenmesi: Kanun m.5/2(f), temel haklara zarar vermemek kaydıyla meşru menfaat',
          'Kayıt, taleplere yanıt ve yetkili makam yükümlülükleri: Kanun m.5/2(a) ve (ç), kanunlarda açıkça öngörülme ve hukuki yükümlülüğün yerine getirilmesi',
          'Uyuşmazlık ve hakların korunması: Kanun m.5/2(e), bir hakkın tesisi, kullanılması veya korunması',
          'Açık rıza gerektiren isteğe bağlı işlemler: Kanun m.5/1; rıza aydınlatmadan ayrı, belirli ve geri alınabilir biçimde alınır',
        ],
      },
      {
        title: '4. Toplama yöntemi',
        paragraphs: [
          'Veriler; kayıt ve profil formları, Wapve içindeki eylemleriniz, yüklediğiniz içerikler, destek iletişimi, tarayıcı çerezleri, sunucu ve güvenlik kayıtları ile bağlı hizmet sağlayıcıların teknik bildirimleri üzerinden otomatik veya kısmen otomatik yollarla elektronik ortamda toplanır.',
        ],
      },
      {
        title: '5. Aktarım',
        paragraphs: [
          'Veriler; yalnızca belirtilen amaçlar için ve gerekli ölçüde barındırma, e-posta, depolama, ağ güvenliği/CDN ve kullanıcı talebiyle GIF hizmeti sunan veri işleyenlere; ayrıca hukuki zorunluluk hâlinde yetkili kurumlara aktarılabilir. Yurt dışı aktarım söz konusuysa Kanun’un 9. maddesindeki yeterlilik, uygun güvence veya izin verilen istisnai aktarım şartlarından biri uygulanır.',
        ],
      },
      {
        title: '6. İlgili kişinin hakları',
        items: [
          'Kişisel verinizin işlenip işlenmediğini öğrenme ve işlenmişse bilgi isteme',
          'İşleme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme',
          'Yurt içinde veya yurt dışında verilerin aktarıldığı üçüncü kişileri bilme',
          'Eksik veya yanlış işlenen verilerin düzeltilmesini isteme',
          'Kanun’daki şartlarla verilerin silinmesini veya yok edilmesini ve bu işlemlerin alıcılara bildirilmesini isteme',
          'Münhasıran otomatik sistem analizi sonucu aleyhe bir sonuca itiraz etme',
          'Kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme',
        ],
      },
      {
        title: '7. Başvuru usulü',
        paragraphs: [
          'Başvurunuzda ad-soyad, başvuruyla ilişkili hesap/e-posta bilgisi, talebiniz ve kimliğinizi doğrulamaya yarayan bilgiler bulunmalıdır. Gereksiz hassas belge göndermeyin. Başvurular niteliğine göre en kısa sürede ve en geç 30 gün içinde ücretsiz sonuçlandırılır; işlemin ayrıca maliyet gerektirmesi hâlinde mevzuattaki tarife uygulanabilir.',
          'Başvurunun reddedilmesi, cevabın yetersiz bulunması veya süresinde cevap verilmemesi hâlinde 6698 sayılı Kanun’daki süreler içinde Kişisel Verileri Koruma Kuruluna şikâyette bulunabilirsiniz.',
        ],
      },
    ],
  },
  cookies: {
    title: 'Çerez Politikası',
    eyebrow: 'ÇEREZLER',
    summary:
      'Wapve’de kullanılan zorunlu çerezleri, yerel tarayıcı depolamasını ve bunları nasıl yönetebileceğinizi açıklar.',
    updatedAt: '1 Eylül 2026',
    sections: [
      {
        title: '1. Yaklaşımımız',
        paragraphs: [
          'Wapve şu anda reklam, çapraz site takip veya pazarlama analitiği çerezi kullanmaz. Hizmetin güvenli çalışması ve açıkça seçtiğiniz tercihlerin hatırlanması için birinci taraf zorunlu çerezler ve yerel depolama kullanılır. Bu nedenle pazarlama çerezi onay bandı gösterilmez.',
        ],
      },
      {
        title: '2. Kullanılan çerezler',
        items: [
          'wapve_session: Oturum açmış kullanıcıyı güvenli biçimde tanır. Birinci taraf, HttpOnly, Secure ve SameSite=Lax; en çok 30 gün.',
          'wapve_csrf: Sahte istek saldırılarını engellemek için istek doğrulama değeri taşır. Birinci taraf, Secure ve SameSite=Lax; oturumla birlikte en çok 30 gün, giriş öncesinde kısa süreli.',
          'wapve_locale: Seçtiğiniz Türkçe veya İngilizce dilini hatırlar. Birinci taraf, SameSite=Lax; en çok 1 yıl.',
          'Cloudflare güvenlik çerezleri: Şüpheli trafiği doğrulamak veya kötüye kullanımı engellemek için yalnızca gerekli olduğunda Cloudflare tarafından kısa süreli güvenlik çerezleri yerleştirilebilir.',
        ],
      },
      {
        title: '3. Yerel depolama',
        items: [
          'wapve:developer-mode: Bu cihazda geliştirici görünümü tercihini saklar.',
          'wapve:skip-voice-switch-confirmation: Ses kanalı geçiş onayı tercihini saklar.',
          'nsfw-confirmed:[kanal]: Bu cihazda belirli bir hassas içerik uyarısının onaylandığını hatırlar.',
        ],
      },
      {
        title: '4. Yönetim ve değişiklikler',
        paragraphs: [
          'Tarayıcı ayarlarınızdan çerezleri silebilir veya engelleyebilirsiniz. Zorunlu çerezleri engellemek giriş, güvenlik doğrulaması ve dil tercihi gibi işlevlerin çalışmamasına neden olabilir. Gelecekte zorunlu olmayan çerezler eklenirse, bunlar etkinleştirilmeden önce eşit seçenekli ve ayrıntılı bir tercih aracı sunulur.',
          contactTr,
        ],
      },
    ],
  },
  copyright: {
    title: 'Telif ve İçerik Kaldırma Politikası',
    eyebrow: 'HAK SAHİPLERİ',
    summary:
      'Telif, marka veya başka bir fikrî hak ihlali iddiasını bildirme, içerik sahibinin yanıt verme ve Wapve’nin inceleme usulünü açıklar.',
    updatedAt: '1 Eylül 2026',
    sections: [
      {
        title: '1. Kapsam ve temel ilke',
        paragraphs: [
          'Wapve, fikrî mülkiyet haklarına saygı gösterir ve kullanıcıların yalnızca paylaşmaya yetkili oldukları içerikleri yüklemelerini ister. Bu politika telif hakkı, marka ve benzeri hak iddiaları için bildirim ve yanıt sürecini belirler.',
          'Wapve bir mahkeme değildir ve karmaşık hak sahipliği uyuşmazlıklarında nihai karar vermez. Tarafların mahkemeye veya yetkili makama başvurma hakkı saklıdır.',
        ],
      },
      {
        title: '2. Hak ihlali bildirimi',
        items: [
          'Hak sahibinin veya yetkili temsilcisinin adı, kurum bilgisi, e-posta adresi ve ulaşılabilir iletişim bilgileri',
          'Korunduğu ileri sürülen eser, marka veya hakkın açık tanımı ve mümkünse hak sahipliğini destekleyen kayıt veya bağlantı',
          'İhlal edildiği ileri sürülen Wapve içeriğinin bulunmasını sağlayacak sunucu, kanal, mesaj, kullanıcı veya dosya kimliği ve varsa adresi',
          'Kullanımın hak sahibi, temsilcisi veya hukuk tarafından yetkilendirilmediğine iyi niyetle inanıldığına dair beyan',
          'Bilgilerin doğru olduğuna ve bildirimi yapmaya yetkili olunduğuna dair beyan ile elektronik ya da fiziksel imza',
        ],
      },
      {
        title: '3. Gönderim ve inceleme',
        paragraphs: [
          'Eksiksiz bildirimi, konu satırına “Telif bildirimi” yazarak info@wapve.com adresine gönderin. Gereksiz kimlik belgesi, parola, iki adımlı doğrulama kodu veya hassas kişisel veri eklemeyin.',
          'Wapve bildirimin yeterliliğini ve içeriğin bulunabilirliğini inceler; ek bilgi isteyebilir, içeriği geçici olarak sınırlandırabilir veya kaldırabilir ve hukuken uygun olduğu ölçüde bildirimi içerik sahibine iletebilir. Eksik, belirsiz veya açıkça kötüye kullanılan bildirimler işleme alınmayabilir.',
        ],
      },
      {
        title: '4. İçerik sahibinin yanıtı',
        items: [
          'Ad, iletişim bilgisi ve ilgili Wapve hesap bilgisi',
          'Kaldırılan veya sınırlandırılan içeriğin kimliği ve daha önce bulunduğu yer',
          'Kaldırmanın hata veya yanlış tanımlama sonucu olduğuna neden inanıldığı ve kullanım yetkisini destekleyen bilgi',
          'Bilgilerin doğruluğuna ilişkin beyan ve elektronik ya da fiziksel imza',
        ],
      },
      {
        title: '5. Tekrarlanan ihlal ve kötüye kullanım',
        paragraphs: [
          'Koşullara uygun durumlarda tekrarlayan veya ağır hak ihlallerinde içerik kaldırılabilir, özellikler sınırlandırılabilir ya da hesap kapatılabilir. Bilerek yanlış bildirim veya yanıt göndermek başkalarına zarar verebilir ve hukuki sorumluluk doğurabilir.',
        ],
      },
      {
        title: '6. Gizlilik ve hukuki talepler',
        paragraphs: [
          'Bildirim ve yanıtlardaki bilgiler talebi incelemek, taraflarla iletişim kurmak, uyuşmazlığı belgelemek ve hukuki yükümlülükleri yerine getirmek için işlenir. Geçerli ve bağlayıcı makam talepleri ayrıca değerlendirilir.',
          contactTr,
        ],
      },
    ],
  },
  community: {
    title: 'Topluluk Kuralları',
    eyebrow: 'GÜVENLİ TOPLULUK',
    summary:
      'Wapve’de herkesin güvenle iletişim kurabilmesi için kullanıcılar, içerikler ve topluluk yöneticileri için ortak kurallar.',
    updatedAt: '1 Eylül 2026',
    sections: [
      {
        title: '1. İnsanlara saygı göster',
        items: [
          'Taciz, hedef gösterme, tehdit, ısrarlı takip, nefret söylemi veya bir kişiyi korunan özelliği nedeniyle aşağılama yasaktır.',
          'Bir kişinin özel bilgilerini, görüntülerini veya yazışmalarını izinsiz yayımlamayın.',
          'Başkasının kimliğine bürünmeyin ve yanıltıcı biçimde kişi ya da kurum temsilcisi olduğunuzu söylemeyin.',
        ],
      },
      {
        title: '2. Çocuk güvenliği',
        paragraphs: [
          'Çocukların cinsel istismarı veya sömürüsüyle bağlantılı içerik, cinsel amaçlı iletişim, şantaj veya çocukları tehlikeye atan davranışlara sıfır tolerans uygulanır. Böyle içerikler kaldırılır, hesaplar kapatılır ve hukuken gerektiğinde yetkili makamlara bildirilir. Acil tehlikede yerel acil yardım birimleriyle iletişime geçin.',
        ],
      },
      {
        title: '3. Güvenlik ve hukuka uygunluk',
        items: [
          'Dolandırıcılık, kimlik avı, zararlı yazılım, hesap hırsızlığı, saldırı planlama veya güvenlik önlemlerini aşma yasaktır.',
          'Terör propagandası, insan ticareti, yasa dışı mal veya hizmet satışı ve ciddi şiddet tehdidine izin verilmez.',
          'Spam, sahte etkileşim, toplu istenmeyen ileti ve izinsiz otomasyon kullanmayın.',
        ],
      },
      {
        title: '4. Uygunsuz ve hassas içerik',
        items: [
          'Yetişkinlere yönelik yasal içerik yalnızca uygun şekilde işaretlenmiş ve erişimi sınırlandırılmış alanlarda paylaşılabilir; reşit olmayanlarla bağlantılı cinsel içerik hiçbir koşulda kabul edilmez.',
          'Aşırı şiddet, kendine zarar verme veya intiharı teşvik eden içerik yasaktır. Yardım arayan kişilere destekleyici ve güvenli kaynaklar yönlendirilmelidir.',
          'Telif veya marka hakkını ihlal eden içerikleri paylaşmayın.',
        ],
      },
      {
        title: '5. Sunucu yöneticilerinin sorumluluğu',
        paragraphs: [
          'Sunucu sahipleri ve moderatörler kuralları açık, tutarlı ve ölçülü uygular; yetkilerini taciz, ayrımcılık veya misilleme için kullanamaz. Yerel sunucu kuralları bu kuralları gevşetemez.',
        ],
      },
      {
        title: '6. Bildirim ve yaptırım',
        paragraphs: [
          'İhlalleri mümkünse uygulama içindeki bildirim araçlarıyla, değilse içerik bağlantısı veya kimliği ve kısa açıklamayla info@wapve.com adresine iletin. İyi niyetli bildirim yapan kişilere karşı misilleme yasaktır.',
          'İhlalin ağırlığına göre içerik kaldırma, uyarı, özellik kısıtlaması, geçici uzaklaştırma veya kalıcı hesap kapatma uygulanabilir. Yakın ve ciddi tehlike içeren durumlarda kayıtlar korunabilir ve yetkili makamlara başvurulabilir.',
        ],
      },
    ],
  },
};

const en: Record<LegalSlug, LegalDocument> = {
  terms: {
    title: 'Terms of Use',
    eyebrow: 'WAPVE LEGAL',
    summary:
      'These terms govern your use of the Wapve website, community servers, messaging, voice and video communications, and related services.',
    updatedAt: 'September 4, 2026',
    sections: [
      {
        title: '1. Agreement',
        paragraphs: [
          'By using Wapve, you agree to these Terms, the Privacy Policy, Cookie Policy and Community Rules. The KVKK Notice informs users subject to Turkish law and does not replace consent where separate consent is legally required.',
          'Do not create an account or use the service if you do not agree.',
        ],
      },
      {
        title: '2. Eligibility and account security',
        items: [
          'You must be at least 13. If you are not legally an adult, use Wapve with the knowledge and supervision of a parent or legal guardian.',
          'Provide accurate information, keep it current, do not transfer your account and protect your credentials.',
          'Notify info@wapve.com promptly if you detect unauthorized account use.',
          'Impersonation, deceptive accounts and bypassing technical limits are prohibited.',
        ],
      },
      {
        title: '3. Service scope, free access and Wapve+',
        paragraphs: [
          'Wapve is a public, free communication service. Features may be temporarily limited and service may be interrupted by maintenance, security events, capacity or circumstances outside reasonable control.',
          'Wapve+ and the current profile cosmetics have no payment, trial period, automatic renewal or subscription fee. Cosmetics have no monetary or trade value and cannot be sold or redeemed for cash.',
          'If a separate paid product is offered in the future, its price, renewal, withdrawal and applicable consumer terms will be shown separately before purchase and the required agreement will be collected. These Terms alone never create a charge.',
        ],
      },
      {
        title: '4. Your content',
        paragraphs: [
          'You retain your rights in messages, files, images, profile information and other content. You grant Wapve a worldwide, non-exclusive, service-limited technical license only to host, transmit, display, secure and operate features you request.',
          'You must have the right to share your content and must not violate intellectual property, privacy, personality or other rights. You need separate permission to use another user’s content outside Wapve.',
        ],
      },
      {
        title: '5. Prohibited conduct',
        items: [
          'Illegal, threatening, harassing, hateful or violent conduct, or anything that endangers children',
          'Doxxing, fraud, phishing, spam, malware, attacks or attempts to disrupt the service',
          'Content that infringes copyright, trademark, privacy, communications secrecy or other rights',
          'Attempts to bypass access controls, rate limits, moderation or security measures',
          'Unauthorized scraping, automated account creation, commercial data collection or resale',
        ],
      },
      {
        title: '6. Moderation and enforcement',
        paragraphs: [
          'Wapve and authorized community moderators may review or remove content, limit visibility, restrict accounts or terminate access to protect users and enforce these terms. Urgent risks may be handled without advance notice. Records may be preserved where legally required and disclosed in response to a valid binding request.',
          'You may appeal a Wapve enforcement decision to info@wapve.com with the relevant context.',
        ],
      },
      {
        title: '7. Intellectual property and third parties',
        paragraphs: [
          'The Wapve name, logo, mascot, interface, software and Wapve-created materials belong to their respective rights holders. No license is granted except the limited right to use the service under these terms.',
          'GIF search and external links may use independent third-party services. Their terms may apply and Wapve does not guarantee their content or availability.',
        ],
      },
      {
        title: '8. Disclaimers and liability',
        paragraphs: [
          'To the extent permitted by mandatory law, the service is provided as available. Wapve is not responsible for user content, transactions between users or interruptions outside reasonable control. Nothing here excludes liability for intent, gross negligence or non-waivable consumer rights.',
          'Keep a separate copy of content that is important to you.',
        ],
      },
      {
        title: '9. Changes, termination and law',
        paragraphs: [
          'Material changes will be announced before they take effect through the site or another appropriate channel. Continued use is subject to the current terms, except where mandatory law requires separate agreement.',
          'The laws of the Republic of Türkiye apply, without limiting mandatory consumer protections or jurisdiction rules that apply to you.',
          contactEn,
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    eyebrow: 'PRIVACY',
    summary:
      'This policy explains what Wapve processes, why, with whom it is shared and your choices.',
    updatedAt: 'September 1, 2026',
    sections: [
      {
        title: '1. Scope',
        paragraphs: [
          'This policy applies to visitors, account holders and community members using the Wapve website and application. Independent third-party services linked from Wapve have their own privacy terms.',
        ],
      },
      {
        title: '2. Information we process',
        items: [
          'Account data: date of birth, email, username, display name, password hash, language, presence, verification status, two-factor or passkey registration records and optional profile images',
          'Community and content data: servers, roles, channels, friendships, messages, reactions, polls, notifications, uploads and moderation records',
          'Support data: requests, appeals, rights requests and security reports',
          'Technical data: IP address, approximate country, browser or device details, device/push token, session timing, request and security event records',
          'Voice and video: media is relayed in real time through Wapve-managed TURN without a direct peer-to-peer connection between participants and is not recorded by Wapve; connection state and limited diagnostics may be processed',
        ],
      },
      {
        title: '3. Purposes and legal bases',
        paragraphs: [
          'We use data to provide and secure accounts, communications, communities and uploads; prevent abuse; diagnose reliability issues; comply with law; and protect legal rights. Depending on applicable law, the basis is contract performance, legal obligation, establishment or protection of rights, legitimate interests that do not override fundamental rights, or separate consent for an optional activity when required.',
        ],
      },
      {
        title: '4. Sharing',
        items: [
          'Infrastructure, hosting, storage and email providers process limited data to operate the service.',
          'Cloudflare may process network and request data for DNS, CDN and security.',
          'KLIPY may process limited query and technical data when you request GIF search or sharing.',
          'Information may be disclosed to authorities only where a valid binding legal request applies.',
          'Wapve does not sell personal data or share it for behavioral advertising.',
        ],
      },
      {
        title: '5. International processing',
        paragraphs: [
          'The global infrastructure of Cloudflare or optional content providers may process limited technical data outside Türkiye. Transfers are made only where an applicable legal transfer mechanism and necessary safeguards are in place. Reading this policy is not treated as consent.',
        ],
      },
      {
        title: '6. Retention',
        items: [
          'Account and profile data is kept while the account is active and afterward only for requests, disputes and legal obligations.',
          'Messages and files remain until removed by a user or authorized moderator, the relevant space is deleted, or account closure deletion is completed.',
          'Session cookies last up to 30 days, verification links 24 hours and password reset links 30 minutes.',
          'Deleted production data may remain in rolling backups for up to 7 days and is used only for disaster recovery.',
          'Security, audit and legal records are kept only as long as required for the incident and applicable limitation or retention duties.',
        ],
      },
      {
        title: '7. Security, choices and children',
        paragraphs: [
          'Wapve uses encrypted transport, password hashing, HttpOnly session cookies, CSRF and origin validation, rate limits, access controls, backups and network security controls. No internet system can guarantee absolute security.',
          'You can manage profile and session settings, delete available content and submit a legal rights request. Wapve is not intended for children under 13 and may verify or close an underage account.',
        ],
      },
      {
        title: '8. Contact and updates',
        paragraphs: [
          'Material changes will be announced through an appropriate channel and the update date will change.',
          contactEn,
        ],
      },
    ],
  },
  kvkk: {
    title: 'KVKK Privacy Notice',
    eyebrow: 'TURKISH LAW NO. 6698',
    summary:
      'The English convenience translation of Wapve’s Turkish notice under Article 10 of the Turkish Personal Data Protection Law. The Turkish text governs in case of inconsistency.',
    updatedAt: 'September 1, 2026',
    sections: [
      {
        title: '1. Controller and contact',
        paragraphs: [
          'The controller is Wapve, the operator of the Wapve service. Data-subject applications may be sent to info@wapve.com.',
        ],
      },
      {
        title: '2. Data categories and collection',
        paragraphs: [
          'Wapve processes account identifiers, contact data, profile images, community and communication content, transaction security records, support communications and legal request records. Data is collected electronically through forms, actions in Wapve, uploads, cookies, server and security logs, support communications and technical notices from service providers.',
        ],
      },
      {
        title: '3. Purposes and legal grounds',
        items: [
          'Providing accounts and services: Article 5/2(c), necessity for a contract',
          'Security and abuse prevention: Article 5/2(f), legitimate interests without harming fundamental rights',
          'Legal duties and official requests: Article 5/2(a) and (ç)',
          'Establishing, exercising or protecting rights: Article 5/2(e)',
          'Optional activities requiring consent: Article 5/1, using separate, specific and withdrawable consent',
        ],
      },
      {
        title: '4. Recipients and transfers',
        paragraphs: [
          'Data may be transferred, only as necessary, to hosting, email, storage, network security/CDN and user-requested GIF processors, and to competent authorities where legally required. Any transfer abroad relies on an available mechanism under Article 9, such as adequacy, appropriate safeguards or a permitted exceptional transfer.',
        ],
      },
      {
        title: '5. Your Article 11 rights',
        items: [
          'Learn whether your data is processed and request information',
          'Learn the purpose of processing and whether data is used accordingly',
          'Know recipients in Türkiye or abroad',
          'Request correction, deletion or destruction where conditions apply, and notification of recipients',
          'Object to an adverse result produced solely by automated analysis',
          'Request compensation for damage caused by unlawful processing',
        ],
      },
      {
        title: '6. Applications',
        paragraphs: [
          'Include your name, account or email information related to the request, the request itself and enough information to verify identity. Do not send unnecessary sensitive documents. Requests are answered as soon as possible and no later than 30 days, normally free of charge, subject to the official tariff where extra cost is required.',
          'You may complain to the Turkish Personal Data Protection Board within the statutory deadlines if a request is rejected, answered inadequately or not answered in time.',
        ],
      },
    ],
  },
  cookies: {
    title: 'Cookie Policy',
    eyebrow: 'COOKIES',
    summary: 'The strictly necessary cookies and local browser storage used by Wapve.',
    updatedAt: 'September 1, 2026',
    sections: [
      {
        title: '1. Our approach',
        paragraphs: [
          'Wapve currently uses no advertising, cross-site tracking or marketing analytics cookies. First-party essential cookies and local storage are used for security and choices you explicitly make, so no marketing-cookie banner is shown.',
        ],
      },
      {
        title: '2. Cookies',
        items: [
          'wapve_session: authenticates a signed-in user; first party, HttpOnly, Secure, SameSite=Lax; up to 30 days.',
          'wapve_csrf: prevents forged requests; first party, Secure, SameSite=Lax; up to 30 days with a session and short-lived before sign-in.',
          'wapve_locale: remembers Turkish or English; first party, SameSite=Lax; up to one year.',
          'Cloudflare security cookies: short-lived cookies may be set when necessary to verify suspicious traffic or prevent abuse.',
        ],
      },
      {
        title: '3. Local storage',
        items: [
          'wapve:developer-mode stores the developer-view preference on this device.',
          'wapve:skip-voice-switch-confirmation stores the voice-channel switch preference.',
          'nsfw-confirmed:[channel] remembers that a sensitive-content warning was acknowledged for a channel on this device.',
        ],
      },
      {
        title: '4. Controls',
        paragraphs: [
          'You can delete or block cookies in browser settings. Blocking essential cookies may prevent sign-in, security validation or language preferences from working. If non-essential cookies are introduced, an equally presented accept, reject and preference control will appear before activation.',
          contactEn,
        ],
      },
    ],
  },
  copyright: {
    title: 'Copyright and Content Removal Policy',
    eyebrow: 'RIGHTS HOLDERS',
    summary:
      'The notice, response and review process for claims that content infringes copyright, trademark or another intellectual-property right.',
    updatedAt: 'September 1, 2026',
    sections: [
      {
        title: '1. Scope and principle',
        paragraphs: [
          'Wapve respects intellectual-property rights and requires users to upload only content they are authorized to share. This policy provides a notice-and-response process for copyright, trademark and similar rights claims.',
          'Wapve is not a court and does not finally decide complex ownership disputes. Each party retains the right to apply to a court or competent authority.',
        ],
      },
      {
        title: '2. Infringement notice',
        items: [
          'The name, organization, email address and reachable contact details of the rights holder or authorized representative',
          'A clear description of the protected work, trademark or right and, where available, a registration or link supporting ownership',
          'The server, channel, message, user or file ID and any URL sufficient to locate the Wapve content at issue',
          'A good-faith statement that the use is not authorized by the rights holder, its representative or law',
          'A statement that the information is accurate and the sender is authorized to act, plus an electronic or physical signature',
        ],
      },
      {
        title: '3. Submission and review',
        paragraphs: [
          'Send a complete notice to info@wapve.com with “Copyright notice” in the subject. Do not include unnecessary identity documents, passwords, two-factor codes or sensitive personal data.',
          'Wapve reviews whether the notice is sufficient and the content can be located. We may request more information, temporarily restrict or remove content and, where legally appropriate, forward the notice to the content owner. Incomplete, vague or clearly abusive notices may not be processed.',
        ],
      },
      {
        title: '4. Content-owner response',
        items: [
          'Name, contact information and relevant Wapve account details',
          'The identity and former location of the removed or restricted content',
          'Why the action is believed to result from error or misidentification and information supporting authorization to use the material',
          'A statement that the information is accurate, plus an electronic or physical signature',
        ],
      },
      {
        title: '5. Repeat infringement and abuse',
        paragraphs: [
          'Where appropriate, repeated or serious infringement may result in content removal, feature restrictions or account termination. Knowingly false notices or responses may harm others and create legal liability.',
        ],
      },
      {
        title: '6. Privacy and legal requests',
        paragraphs: [
          'Information in notices and responses is processed to review the request, contact the parties, document the dispute and comply with legal duties. Valid binding authority requests are assessed separately.',
          contactEn,
        ],
      },
    ],
  },
  community: {
    title: 'Community Rules',
    eyebrow: 'SAFE COMMUNITIES',
    summary:
      'Shared rules for users, content and moderators so people can communicate safely on Wapve.',
    updatedAt: 'September 1, 2026',
    sections: [
      {
        title: '1. Respect people',
        items: [
          'No harassment, targeting, threats, stalking, hate speech or attacks based on protected characteristics.',
          'Do not share private information, images or communications without authorization.',
          'Do not impersonate others or deceptively claim to represent a person or organization.',
        ],
      },
      {
        title: '2. Child safety',
        paragraphs: [
          'Wapve has zero tolerance for child sexual abuse or exploitation material, grooming, sextortion or conduct that endangers children. Content is removed, accounts are terminated and reports are made to competent authorities when legally required. Contact local emergency services for immediate danger.',
        ],
      },
      {
        title: '3. Safety and legality',
        items: [
          'No fraud, phishing, malware, account theft, attack planning or bypassing security controls.',
          'No terrorist propaganda, trafficking, illegal goods or services, or credible serious violence threats.',
          'No spam, fake engagement, mass unsolicited contact or unauthorized automation.',
        ],
      },
      {
        title: '4. Sensitive content and rights',
        items: [
          'Lawful adult content may appear only in properly labeled, access-restricted spaces; sexual content involving minors is never allowed.',
          'Do not encourage extreme violence, self-harm or suicide. Direct people seeking help toward supportive and safe resources.',
          'Do not share content that infringes copyright, trademark or privacy rights.',
        ],
      },
      {
        title: '5. Moderators, reports and enforcement',
        paragraphs: [
          'Server owners and moderators must apply rules clearly, consistently and proportionately and may not use their authority for harassment, discrimination or retaliation. Local rules cannot weaken these rules.',
          'Report violations in-app where available or send the content identifier and concise context to info@wapve.com. Depending on severity, Wapve may remove content, warn, restrict features, suspend or terminate an account and preserve records or contact authorities for a serious imminent risk.',
        ],
      },
    ],
  },
};

export function isLegalSlug(value: string): value is LegalSlug {
  return legalSlugs.includes(value as LegalSlug);
}

export function legalDocument(locale: Locale, slug: LegalSlug): LegalDocument {
  return (locale === 'en' ? en : tr)[slug];
}
