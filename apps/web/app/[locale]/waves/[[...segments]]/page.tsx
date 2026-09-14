import { AppShell } from '@/components/app-shell';
import { isDesktopPresentation } from '@/lib/desktop-presentation';
import { dictionary, isLocale } from '@/lib/i18n';
import { decodeWaveConversationSegment } from '@/lib/wave-route';
import { notFound } from 'next/navigation';

export default async function WavesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; segments?: string[] }>;
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const [{ locale, segments = [] }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale) || segments.length > 1) notFound();

  const conversationId = decodeWaveConversationSegment(segments[0]);
  if (conversationId === null) notFound();
  const view = Array.isArray(query.view) ? query.view[0] : query.view;

  return (
    <AppShell
      locale={locale}
      messages={dictionary(locale)}
      client={(await isDesktopPresentation()) ? 'desktop' : 'web'}
      initialConversationId={conversationId}
      initialPremiumOpen={!conversationId && view === 'wapve-plus'}
      initialStoreOpen={!conversationId && view === 'store'}
    />
  );
}
