import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MarketingHome } from '@/components/marketing-site';
import { isLocale } from '@/lib/i18n';
import { marketingCopy } from '@/lib/marketing-copy';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEnglish = locale === 'en';
  return {
    title: isEnglish ? 'Wapve, your own wave' : 'Wapve, kendi dalgan',
    description: isEnglish
      ? 'A secure, focused communication platform for communities.'
      : 'Topluluklar için güvenli ve sade iletişim platformu.',
    alternates: { canonical: 'https://wapve.com/' },
    openGraph: {
      url: 'https://wapve.com/',
      locale: isEnglish ? 'en_US' : 'tr_TR',
      images: [
        {
          url: '/opengraph-image.png',
          width: 1200,
          height: 630,
          alt: 'Wapve — Kendi dalgan',
        },
      ],
    },
  };
}

export default async function LocalePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Wapve',
    url: 'https://wapve.com',
    applicationCategory: 'CommunicationApplication',
    operatingSystem: 'Web, Windows, Android, iOS',
    description:
      locale === 'en'
        ? 'A secure voice, video and text communication platform for communities.'
        : 'Topluluklar için güvenli sesli, görüntülü ve yazılı iletişim platformu.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'TRY' },
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</gu, '\\u003c'),
        }}
      />
      <MarketingHome locale={locale} copy={marketingCopy(locale)} />
    </>
  );
}
