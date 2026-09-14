import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogPage } from '@/components/marketing-site';
import { isLocale } from '@/lib/i18n';
import { marketingCopy } from '@/lib/marketing-copy';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Wapve ürün duyuruları, güvenlik notları ve topluluk yazıları.',
  alternates: { canonical: 'https://wapve.com/blog' },
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <BlogPage locale={locale} copy={marketingCopy(locale)} />;
}
