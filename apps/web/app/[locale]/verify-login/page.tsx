import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { VerifyLoginLocationCard } from '@/components/verify-login-location-card';
import { isDesktopPresentation } from '@/lib/desktop-presentation';
import { dictionary, isLocale } from '@/lib/i18n';

export default async function VerifyLoginLocationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = dictionary(locale);
  const desktop = await isDesktopPresentation();
  return (
    <AuthShell locale={locale} messages={messages} desktop={desktop}>
      <Suspense fallback={<div className="auth-card">{messages.loading}</div>}>
        <VerifyLoginLocationCard locale={locale} />
      </Suspense>
    </AuthShell>
  );
}
