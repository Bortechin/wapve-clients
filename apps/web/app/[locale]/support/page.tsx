import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SupportCenter } from '@/components/support-center/support-center';
import { isLocale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Wapve Yardım Merkezi · Support Center',
  description:
    'Wapve hesap ayarları, sunucu ve kanal izinleri, Woost, ses/video sorun giderme ve destek biletleri.',
  alternates: { canonical: 'https://wapve.com/support' },
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ category?: string; article?: string; view?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const query = searchParams ? await searchParams : {};
  const initialView = query.view === 'ticket' ? 'ticket' : 'home';

  return (
    <SupportCenter
      locale={locale}
      initialCategory={query.category}
      initialArticle={query.article}
      initialView={initialView}
    />
  );
}
