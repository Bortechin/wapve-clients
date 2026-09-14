'use client';

import { Check, ChevronDown, Languages } from 'lucide-react';
import type { Locale } from '@wapve/contracts';

const languageOptions: Array<{ value: Locale; shortLabel: string; label: string }> = [
  { value: 'tr', shortLabel: 'TR', label: 'Türkçe' },
  { value: 'en', shortLabel: 'EN', label: 'English' },
];

export function LocaleSwitch({ locale }: { locale: Locale }) {
  const activeLanguage = languageOptions.find((language) => language.value === locale) ?? {
    value: 'en',
    shortLabel: 'EN',
    label: 'English',
  };
  const pickerLabel = locale === 'tr' ? 'Dil seç' : 'Choose language';

  function switchLocale(nextLocale: Locale, details: HTMLDetailsElement) {
    details.open = false;
    if (nextLocale === locale) return;
    document.cookie = `wapve_locale=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.location.reload();
  }

  return (
    <details className="locale-picker">
      <summary aria-label={pickerLabel} aria-haspopup="listbox">
        <Languages size={17} aria-hidden="true" />
        <span>{activeLanguage.label}</span>
        <small>{activeLanguage.shortLabel}</small>
        <ChevronDown size={15} aria-hidden="true" />
      </summary>
      <div className="locale-picker-menu" role="listbox" aria-label={pickerLabel}>
        <span>{pickerLabel}</span>
        {languageOptions.map((language) => (
          <button
            key={language.value}
            type="button"
            role="option"
            aria-selected={language.value === locale}
            onClick={(event) => switchLocale(language.value, event.currentTarget.closest('details')!)}
          >
            <i aria-hidden="true">{language.shortLabel}</i>
            <span>{language.label}</span>
            {language.value === locale ? <Check size={16} aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
    </details>
  );
}
