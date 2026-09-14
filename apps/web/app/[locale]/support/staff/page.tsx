import type { Metadata } from 'next';
import type { AuthSession } from '@wapve/contracts';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { SupportStaffWorkspace } from '@/components/support-center/support-staff-workspace';
import { isLocale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Wapve',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${encodeURIComponent(value)}`)
    .join('; ');

  const apiUrl =
    process.env.API_INTERNAL_URL ??
    (process.env.NODE_ENV === 'production' ? 'http://api:4000' : 'http://localhost:4000');

  const response = await fetch(`${apiUrl}/api/v1/auth/session`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  }).catch(() => null);

  if (!response?.ok) notFound();

  const session = (await response.json()) as AuthSession;
  const isAuthorized =
    session.user.badges.includes('PLATFORM_OWNER') ||
    session.user.badges.includes('SUPPORT') ||
    session.user.badges.includes('STAFF') ||
    session.user.platformStaffRole === 'SUPPORT';

  if (!isAuthorized) notFound();

  return <SupportStaffWorkspace />;
}

