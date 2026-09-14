'use client';

import { useMemo, useState } from 'react';
import type { Locale } from '@wapve/contracts';

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year || 2000, month, 0)).getUTCDate();
}

export function BirthDateFields({ locale, name = 'birthDate' }: { locale: Locale; name?: string }) {
  const now = new Date();
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const years = useMemo(
    () => Array.from({ length: 108 }, (_, index) => now.getUTCFullYear() - 13 - index),
    [now],
  );
  const maximumDay = daysInMonth(Number(year), Number(month));
  const normalizedDay = Number(day) > maximumDay ? String(maximumDay) : day;
  const value =
    normalizedDay && month && year
      ? `${year}-${month.padStart(2, '0')}-${normalizedDay.padStart(2, '0')}`
      : '';
  const labels =
    locale === 'tr'
      ? { title: 'Doğum tarihi', day: 'Gün', month: 'Ay', year: 'Yıl' }
      : { title: 'Date of birth', day: 'Day', month: 'Month', year: 'Year' };

  return (
    <fieldset className="birth-date-fieldset">
      <legend>{labels.title}</legend>
      <input type="hidden" name={name} value={value} />
      <div className="birth-date-grid">
        <label>
          <span className="sr-only">{labels.day}</span>
          <select
            aria-label={labels.day}
            required
            value={normalizedDay}
            onChange={(event) => setDay(event.target.value)}
          >
            <option value="">{labels.day}</option>
            {Array.from({ length: maximumDay }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">{labels.month}</span>
          <select
            aria-label={labels.month}
            required
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          >
            <option value="">{labels.month}</option>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>
                {new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
                  new Date(Date.UTC(2000, value - 1, 1)),
                )}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">{labels.year}</span>
          <select
            aria-label={labels.year}
            required
            value={year}
            onChange={(event) => setYear(event.target.value)}
          >
            <option value="">{labels.year}</option>
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
    </fieldset>
  );
}
