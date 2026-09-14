import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { localeFromAcceptLanguage } from '@/lib/request-locale';

export default async function RootPage() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const savedLocale = cookieStore.get('wapve_locale')?.value;
  const locale = savedLocale === 'tr' || savedLocale === 'en'
    ? savedLocale
    : localeFromAcceptLanguage(headerStore.get('accept-language'));
  redirect(`/${locale}`);
}
