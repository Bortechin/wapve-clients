import { describe, expect, it } from 'vitest';
import { localeFromAcceptLanguage } from './request-locale';

describe('localeFromAcceptLanguage', () => {
  it('uses Turkish when it is the preferred supported browser language', () => {
    expect(localeFromAcceptLanguage('tr-TR,tr;q=0.9,en;q=0.8')).toBe('tr');
  });

  it('uses the first supported language even when an unsupported language comes first', () => {
    expect(localeFromAcceptLanguage('fr-FR,fr;q=0.9,tr;q=0.8,en;q=0.7')).toBe('tr');
  });

  it('falls back to English when the browser has no supported language', () => {
    expect(localeFromAcceptLanguage('de-DE,de;q=0.9')).toBe('en');
    expect(localeFromAcceptLanguage(null)).toBe('en');
  });
});
