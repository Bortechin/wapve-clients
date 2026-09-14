import { AuthShell } from '@/components/auth-shell';
import { RegisterForm } from '@/components/register-form';
import { desktopAuthHref, sanitizeDesktopNext } from '@/lib/desktop-route';
import { isDesktopPresentation } from '@/lib/desktop-presentation';
import { dictionary, isLocale } from '@/lib/i18n';
import { notFound } from 'next/navigation';

export default async function RegisterPage({
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
  const next = sanitizeDesktopNext(requestedNext);
  return (
    <AuthShell locale={locale} messages={messages} mode="register" desktop={desktop}>
      <RegisterForm
        locale={locale}
        messages={messages}
        loginHref={desktopAuthHref('/login', next)}
        redirectTo={next ? `/verify-email?next=${encodeURIComponent(next)}` : '/verify-email'}
      />
    </AuthShell>
  );
}
