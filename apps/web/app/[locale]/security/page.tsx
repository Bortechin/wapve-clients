import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SecurityPage } from '@/components/marketing-site';
import { isLocale } from '@/lib/i18n';
import { marketingCopy } from '@/lib/marketing-copy';

export const metadata: Metadata = {
  title: 'Güvenlik · Security',
  description:
    'Wapve güvenlik yaklaşımı, hesap koruması, gizlilik ve topluluk güvenliği özellikleri.',
  alternates: { canonical: 'https://wapve.com/security' },
  openGraph: {
    url: 'https://wapve.com/security',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: 'Wapve güvenliği' }],
  },
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <SecurityPage locale={locale} copy={marketingCopy(locale)} />;
}
