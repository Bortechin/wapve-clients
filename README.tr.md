# Wapve İstemcileri

[Wapve](https://wapve.com) için Web, Windows masaüstü ve Android istemci kaynakları.

**Kaynak kodu erişilebilir • Ticari olmayan kaynak lisansı • Katkıya açık**

[English / ayrıntılı kurulum](README.md) · [Lisans](LICENSE) ·
[Katkı rehberi](CONTRIBUTING.md) · [Güvenlik](SECURITY.md)

## Kapsam

`apps/web` Next.js istemcisini, `apps/desktop` Electron masaüstü kabuğunu,
`apps/mobile` Android istemcisini, `packages` ortak istemci paketlerini içerir.
Backend, veritabanı, sunucu dağıtımı, özel operasyon belgeleri ve resmî imzalama
anahtarları bu depoya dahil değildir. Git geçmişi yalnızca istemcilerle başlar.

**Wapve sunucusu ayrı olarak çalışmaya devam eder.** Bu kaynak yayını mevcut
hesapları, kurulu uygulamaları veya hizmeti değiştirmez. Masaüstü kabuğu varsayılan
olarak canlı web istemcisini yükler. Bu depo çevrimdışı çalışan bir ürün veya
Wapve sunucusunu kendi başınıza kurabileceğiniz tam bir sunucu paketi değildir.

## Lisans

Kaynak kodu PolyForm Noncommercial 1.0.0 ile, resmî istemci kullanımı ve katkılar
için ayrıca verilen izinle sunulur. Şirketler resmî Wapve uygulamasını iş amaçlı
iletişimde kullanabilir. Şirket çalışanları dahil katkı verenler kodu inceleyebilir,
derleyebilir, test edebilir ve Wapve'ye katkı hazırlayabilir.

Kodu alıp ücretli, reklamlı, abonelikli veya başka şekilde ticarileştirilen ayrı
bir uygulama/hizmet yapmak, mevcut lisans izinleri kapsamına girmiyorsa ayrıca
yazılı izin gerektirir. Bu nedenle doğru tanım **source-available**'dır;
OSI tanımına göre açık kaynak değildir. Bağlayıcı İngilizce metinler için
[LICENSE](LICENSE) ve [ek izni](licenses/OFFICIAL-CLIENT-PERMISSION.md) okuyun.
Marka ve görsellerin koşulları [TRADEMARKS.md](TRADEMARKS.md) içindedir.
Üçüncü taraf eserler kendi lisanslarını korur.

## Başlangıç

Node.js 24.19.0 ve pnpm 10.34.5 kurun:

```sh
git clone https://github.com/Bortechin/wapve-clients.git
cd wapve-clients
pnpm install --frozen-lockfile
pnpm --filter './packages/*' build
pnpm --filter @wapve/web dev
```

Web: http://localhost:3000. `apps/web/.env.example` dosyasını `.env.local` olarak
kopyalayın. Genel sayfalar backend olmadan incelenebilir; oturum, mesajlaşma ve
görüşmeler yetkili API/realtime erişimi gerektirir. Canlı API adresini yazmak tek
başına CORS, çerez ve güvenlik koşullarını çözmez. Normal kullanım için resmî
Wapve uygulamalarını kullanın.

Masaüstü geliştirme: `pnpm --filter @wapve/desktop dev`.
Android için JDK 21, Android SDK ve native geliştirme derlemesi gerekir;
Expo Go yeterli değildir. Windows'ta `JAVA_HOME` ve `ANDROID_HOME` ayarladıktan
sonra `pnpm --filter @wapve/mobile build:debug` kullanın. Kendi geliştirme API
adreslerinizi `apps/mobile/.env` dosyasına yazın. Üretim imza ve Firebase bilgileri
dahil değildir. Ayrıntılı platform adımları İngilizce README'dedir.

Kontroller: `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint`.
Gerçek doğrulama sonuçları ve sınırlamalar: [docs/VALIDATION.md](docs/VALIDATION.md).

Hata/öneri için issue, kod katkısı için PR açabilirsiniz. Güvenlik açıklarını
public issue üzerinden paylaşmayın; [özel bildirim yolunu](SECURITY.md) kullanın.
