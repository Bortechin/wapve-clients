import { DesktopGateway } from '@/components/desktop-gateway';
import { sanitizeDesktopNext } from '@/lib/desktop-route';
import { dictionary, isLocale } from '@/lib/i18n';
import { notFound } from 'next/navigation';

export default async function DesktopPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  if (!isLocale(locale)) notFound();
  return (
    <DesktopGateway
      locale={locale}
      messages={dictionary(locale)}
      next={sanitizeDesktopNext(next)}
    />
  );
}
