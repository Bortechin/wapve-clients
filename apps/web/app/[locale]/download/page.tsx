import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DownloadMarketingPage } from '@/components/marketing-site';
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
    title: isEnglish
      ? 'Download Wapve for Windows · Secure Desktop Client'
      : 'Windows İçin Wapve İndir · Güvenli Masaüstü İstemcisi',
    description: isEnglish
      ? 'Download the official Wapve desktop app for Windows 10/11. Cryptographically verified with SHA-256.'
      : 'Windows 10 ve 11 için resmi Wapve masaüstü uygulamasını indirin. Kriptografik SHA-256 ile doğrulanmış ve güvenli.',
    alternates: { canonical: 'https://wapve.com/download' },
    openGraph: {
      url: 'https://wapve.com/download',
      images: [
        {
          url: '/opengraph-image.png',
          width: 1200,
          height: 630,
          alt: 'Wapve Windows İndir',
        },
      ],
    },
  };
}

export default async function DownloadPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <DownloadMarketingPage locale={locale} copy={marketingCopy(locale)} />;
}
