import type { Metadata } from 'next';
import Link from 'next/link';
import type { Locale } from '@wapve/contracts';

export const metadata: Metadata = {
  title: 'Wapve QR Login',
  robots: { index: false, follow: false, noarchive: true },
};

export default async function QrLoginFallback({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ challenge?: string; token?: string }>;
}) {
  const { locale } = await params;
  const { challenge, token } = await searchParams;
  const tr = locale === 'tr';
  const valid = Boolean(challenge && token);
  const appHref = valid
    ? `wapve://qr-login?challenge=${encodeURIComponent(challenge!)}&token=${encodeURIComponent(token!)}`
    : '/login';
  return (
    <main className="qr-deep-link-page">
      <section>
        <span aria-hidden="true">≈</span>
        <h1>{tr ? 'Wapve mobilde aç' : 'Open in Wapve mobile'}</h1>
        <p>
          {tr
            ? 'Bu kod bilgisayar girişini onaylamak için yalnız Wapve mobil uygulamasında kullanılabilir. Onay ekranında cihaz bilgilerini kontrol et.'
            : 'This code can only be used in the Wapve mobile app to approve a computer login. Verify the device details before approving.'}
        </p>
        <Link href={appHref}>{valid ? (tr ? 'Wapve uygulamasını aç' : 'Open Wapve') : (tr ? 'Girişe dön' : 'Back to login')}</Link>
        <small>{tr ? 'Bu kodu veya ekran görüntüsünü kimseyle paylaşma.' : 'Do not share this code or a screenshot of it.'}</small>
      </section>
    </main>
  );
}
