import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RoadmapPage } from '@/components/marketing-site';
import { isLocale } from '@/lib/i18n';
import { marketingCopy } from '@/lib/marketing-copy';

export const metadata: Metadata = {
  title: 'Yol haritası · Roadmap',
  description: 'Wapve ürün yol haritası, yayımlanan yenilikler ve sıradaki geliştirmeler.',
  alternates: { canonical: 'https://wapve.com/roadmap' },
  openGraph: {
    url: 'https://wapve.com/roadmap',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: 'Wapve yol haritası' }],
  },
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <RoadmapPage locale={locale} copy={marketingCopy(locale)} />;
}
