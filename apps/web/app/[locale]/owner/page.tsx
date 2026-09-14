import type { Metadata } from 'next';
import type { AuthSession } from '@wapve/contracts';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { OwnerAdminPanel } from '@/components/owner-admin-panel';
import { dictionary, isLocale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Wapve',
  robots: { index: false, follow: false },
};

export default async function OwnerConsolePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const cookieHeader = (await cookies())
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
  if (!session.user.badges.includes('PLATFORM_OWNER')) notFound();
  return (
    <main className="owner-console-page">
      <div className="owner-console-frame">
        <OwnerAdminPanel messages={dictionary(locale)} />
      </div>
    </main>
  );
}
