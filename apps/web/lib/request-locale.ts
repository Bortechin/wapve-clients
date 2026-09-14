import type { Locale } from '@wapve/contracts';

export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  const requestedLanguages = (header ?? '')
    .toLowerCase()
    .split(',')
    .map((entry) => entry.trim().split(';')[0]?.split('-')[0])
    .filter(Boolean);

  const supportedLanguage = requestedLanguages.find(
    (language): language is Locale => language === 'tr' || language === 'en',
  );

  return supportedLanguage ?? 'en';
}
