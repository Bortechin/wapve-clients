import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FaqPage } from '@/components/marketing-site';
import { isLocale } from '@/lib/i18n';
import { marketingCopy } from '@/lib/marketing-copy';

export const metadata: Metadata = {
  title: 'SSS · FAQ',
  description:
    'Wapve hesapları, sunucuları, sesli iletişim, Wapve+ ve gizlilik hakkında sık sorulan sorular.',
  alternates: { canonical: 'https://wapve.com/faq' },
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <FaqPage locale={locale} copy={marketingCopy(locale)} />;
}
