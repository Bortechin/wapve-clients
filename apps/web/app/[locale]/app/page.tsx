import { AppShell } from '@/components/app-shell';
import { isDesktopPresentation } from '@/lib/desktop-presentation';
import { dictionary, isLocale } from '@/lib/i18n';
import { notFound } from 'next/navigation';

export default async function ApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ invite?: string; discover?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { invite, discover } = await searchParams;
  return (
    <AppShell
      locale={locale}
      messages={dictionary(locale)}
      initialInviteCode={invite}
      initialDiscoveryOpen={discover === '1' || discover === 'true'}
      client={(await isDesktopPresentation()) ? 'desktop' : 'web'}
    />
  );
}
