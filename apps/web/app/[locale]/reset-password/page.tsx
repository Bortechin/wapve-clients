import { Suspense } from 'react';
import { AuthShell } from '@/components/auth-shell';
import { ResetPasswordForm } from '@/components/reset-password-form';
import { isDesktopPresentation } from '@/lib/desktop-presentation';
import { dictionary, isLocale } from '@/lib/i18n';
import { notFound } from 'next/navigation';

export default async function ResetPasswordPage({
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
        <ResetPasswordForm locale={locale} messages={messages} />
      </Suspense>
    </AuthShell>
  );
}
