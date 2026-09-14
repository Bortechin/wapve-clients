import type { Locale } from '@wapve/contracts';
import en from '../messages/en.json';
import tr from '../messages/tr.json';

export const locales = ['tr', 'en'] as const;
export type Dictionary = typeof tr;

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function dictionary(locale: Locale): Dictionary {
  return locale === 'en' ? (en as Dictionary) : tr;
}
