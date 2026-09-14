import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Locale } from '@wapve/contracts';
import { DESKTOP_PRESENTATION_COOKIE } from './lib/desktop-route';
import { localeFromAcceptLanguage } from './lib/request-locale';

const localeCookie = 'wapve_locale';
const localePrefix = /^\/(tr|en)(?=\/|$)/u;

function preferredLocale(request: NextRequest): Locale {
  const savedLocale = request.cookies.get(localeCookie)?.value;
  if (savedLocale === 'tr' || savedLocale === 'en') return savedLocale;
  return localeFromAcceptLanguage(request.headers.get('accept-language'));
}

function rememberLocale(response: NextResponse, request: NextRequest, locale: Locale) {
  response.cookies.set(localeCookie, locale, {
    path: '/',
    maxAge: 31_536_000,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
  });
  return response;
}

function rememberDesktopPresentation(response: NextResponse, request: NextRequest) {
  response.cookies.set(DESKTOP_PRESENTATION_COOKIE, '1', {
    path: '/',
    maxAge: 31_536_000,
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
  });
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const prefixedLocale = localePrefix.exec(pathname)?.[1] as Locale | undefined;

  if (prefixedLocale) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.pathname = pathname.replace(localePrefix, '') || '/';
    return rememberLocale(NextResponse.redirect(cleanUrl, 308), request, prefixedLocale);
  }

  const locale = preferredLocale(request);
  const internalUrl = request.nextUrl.clone();
  internalUrl.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  const response = NextResponse.rewrite(internalUrl);
  if (!request.cookies.has(localeCookie)) rememberLocale(response, request, locale);
  if (pathname === '/desktop') rememberDesktopPresentation(response, request);
  return response;
}

export const config = {
  matcher: '/((?!api|socket.io|_next/static|_next/image|.*\\..*).*)',
};
