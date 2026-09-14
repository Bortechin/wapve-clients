import { AppShell } from '@/components/app-shell';
import { isDesktopPresentation } from '@/lib/desktop-presentation';
import { dictionary, isLocale } from '@/lib/i18n';
import { notFound, redirect } from 'next/navigation';

export default async function ChannelsPage({
  params,
}: {
  params: Promise<{ locale: string; segments?: string[] }>;
}) {
  const { locale, segments = [] } = await params;
  if (!isLocale(locale) || segments.length > 2) notFound();

  if (!segments.length) redirect('/waves');
  if (segments[0] === '@me' || segments[0]?.toLowerCase() === '%40me')
    redirect(`/waves${segments[1] ? `/${encodeURIComponent(segments[1])}` : ''}`);

  return (
    <AppShell
      locale={locale}
      messages={dictionary(locale)}
      client={(await isDesktopPresentation()) ? 'desktop' : 'web'}
      initialServerId={segments[0]}
      initialChannelId={segments[1]}
    />
  );
}
