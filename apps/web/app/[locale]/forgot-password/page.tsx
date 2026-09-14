import { AuthShell } from '@/components/auth-shell';
import { ForgotPasswordForm } from '@/components/forgot-password-form';
import { isDesktopPresentation } from '@/lib/desktop-presentation';
import { dictionary, isLocale } from '@/lib/i18n';
import { notFound } from 'next/navigation';

export default async function ForgotPasswordPage({
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
      <ForgotPasswordForm locale={locale} messages={messages} />
    </AuthShell>
  );
}
