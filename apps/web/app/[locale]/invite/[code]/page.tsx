import type { ServerInvitePreview } from '@wapve/contracts';
import { PublicInvite } from '@/components/public-invite';
import { isLocale } from '@/lib/i18n';
import { notFound } from 'next/navigation';

export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  if (!isLocale(locale)) notFound();
  if (!/^[A-Za-z0-9_+-]{4,64}$/u.test(code)) notFound();
  const apiUrl =
    process.env.API_INTERNAL_URL ??
    (process.env.NODE_ENV === 'production' ? 'http://api:4000' : 'http://localhost:4000');
  const response = await fetch(
    `${apiUrl}/api/v1/servers/invites/public/${encodeURIComponent(code)}`,
    { cache: 'no-store' },
  ).catch(() => null);
  const preview = response?.ok ? ((await response.json()) as ServerInvitePreview) : null;
  return <PublicInvite code={code} locale={locale} preview={preview} />;
}
