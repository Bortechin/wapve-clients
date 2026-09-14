import { Suspense } from 'react';
import { AuthShell } from '@/components/auth-shell';
import { VerifyEmailCard } from '@/components/verify-email-card';
import { sanitizeDesktopNext } from '@/lib/desktop-route';
import { isDesktopPresentation } from '@/lib/desktop-presentation';
import { dictionary, isLocale } from '@/lib/i18n';
import { notFound } from 'next/navigation';

export default async function VerifyEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { locale } = await params;
  const { next: requestedNext } = await searchParams;
  if (!isLocale(locale)) notFound();
  const messages = dictionary(locale);
  const desktop = await isDesktopPresentation();
  return (
    <AuthShell locale={locale} messages={messages} desktop={desktop}>
      <Suspense fallback={<div className="auth-card">{messages.loading}</div>}>
        <VerifyEmailCard messages={messages} continueTo={sanitizeDesktopNext(requestedNext) ?? '/app'} />
      </Suspense>
    </AuthShell>
  );
}
