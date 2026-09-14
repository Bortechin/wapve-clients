import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { WapvePlusPage } from '@/components/marketing-site';
import { isLocale } from '@/lib/i18n';
import { marketingCopy } from '@/lib/marketing-copy';

export const metadata: Metadata = {
  title: 'Wapve+ · Ücretsiz profil kozmetikleri',
  description:
    'Wapve+ profil efektleri, avatar dekorasyonları, koleksiyonlar ve sunucu destekleri tüm hesaplar için ücretsiz.',
  alternates: { canonical: 'https://wapve.com/wapve-plus' },
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <WapvePlusPage locale={locale} copy={marketingCopy(locale)} />;
}
