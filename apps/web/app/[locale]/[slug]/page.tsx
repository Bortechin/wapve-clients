import { isLocale } from '@/lib/i18n';
import { notFound, redirect } from 'next/navigation';

// Legacy clean links on wapve.com stay valid. New links are issued on wapve.cc
// and are validated by the short-domain Caddy route before reaching this flow.
export default async function CustomServerInvitePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !/^[a-z0-9](?:[a-z0-9-]{4,30}[a-z0-9])$/u.test(slug)) notFound();
  const apiUrl =
    process.env.API_INTERNAL_URL ??
    (process.env.NODE_ENV === 'production' ? 'http://api:4000' : 'http://localhost:4000');
  const response = await fetch(
    `${apiUrl}/api/v1/servers/invites/custom/${encodeURIComponent(slug)}`,
    { cache: 'no-store' },
  ).catch(() => null);
  if (!response?.ok) notFound();
  redirect(`/${locale}/invite/${encodeURIComponent(slug)}`);
}
