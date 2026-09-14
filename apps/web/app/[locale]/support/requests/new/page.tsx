import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SupportCenter } from '@/components/support-center/support-center';
import { isLocale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Bir Talep Gönder · Submit a Request | Wapve Destek',
  description: 'Wapve destek ekibine bilet gönderin; hesap, teknik sorunlar ve güvenlik bildirimleri.',
  alternates: { canonical: 'https://wapve.com/support/requests/new' },
};

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return <SupportCenter locale={locale} initialView="ticket" />;
}
