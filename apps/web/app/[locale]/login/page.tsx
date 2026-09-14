import { AuthShell } from '@/components/auth-shell';
import { LoginForm } from '@/components/login-form';
import { desktopAuthHref, sanitizeDesktopNext } from '@/lib/desktop-route';
import { isDesktopPresentation } from '@/lib/desktop-presentation';
import { dictionary, isLocale } from '@/lib/i18n';
import { notFound } from 'next/navigation';

export default async function LoginPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ invite?: string; next?: string | string[] }> }) {
  const { locale } = await params;
  const { invite, next: requestedNext } = await searchParams;
  if (!isLocale(locale)) notFound();
  const messages = dictionary(locale);
  const desktop = await isDesktopPresentation();
  const next = sanitizeDesktopNext(requestedNext);
  const redirectTo = next ?? (invite ? `/app?invite=${encodeURIComponent(invite)}` : '/app');
  return (
    <AuthShell locale={locale} messages={messages} mode="login" desktop={desktop}>
      <LoginForm
        messages={messages}
        redirectTo={redirectTo}
        registerHref={desktopAuthHref('/register', next)}
      />
    </AuthShell>
  );
}
