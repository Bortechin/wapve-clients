import { describe, expect, it } from '@jest/globals';
import { translateLiteralForLocale } from './i18n';

describe('mobile literal localization bridge', () => {
  it('preserves Turkish and translates common mobile controls to English', () => {
    expect(translateLiteralForLocale('Geri', 'tr')).toBe('Geri');
    expect(translateLiteralForLocale('Geri', 'en')).toBe('Back');
    expect(translateLiteralForLocale('Kamerayı aç', 'en')).toBe('Turn camera on');
  });

  it('translates Turkish long-date words used by existing mobile screens', () => {
    expect(translateLiteralForLocale('26 Ağustos 2026 Çarşamba', 'en')).toBe('26 August 2026 Wednesday');
  });
});
