import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FeaturesPage } from '@/components/marketing-site';
import { isLocale } from '@/lib/i18n';
import { marketingCopy } from '@/lib/marketing-copy';

export const metadata: Metadata = {
  title: 'Özellikler · Features',
  description:
    'Wapve sunucuları, sesli sohbet, mesajlaşma, profil kişiselleştirme ve topluluk araçlarını keşfet.',
  alternates: { canonical: 'https://wapve.com/features' },
  openGraph: {
    url: 'https://wapve.com/features',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: 'Wapve özellikleri' }],
  },
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <FeaturesPage locale={locale} copy={marketingCopy(locale)} />;
}
