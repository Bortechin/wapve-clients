'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import type { Locale } from '@wapve/contracts';

export function PasswordField({ locale, label, name = 'password', id = 'password' }: { locale: Locale; label: string; name?: string; id?: string }) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState('');
  const varieties = [/[a-z]/u, /[A-Z]/u, /\d/u, /[^A-Za-z0-9]/u].filter((rule) =>
    rule.test(value),
  ).length;
  const strength = value.length < 9 ? 0 : Math.min(4, 1 + varieties + (value.length >= 16 ? 1 : 0));
  const strengthText =
    locale === 'tr'
      ? ['9–32 karakter kullan', 'Zayıf', 'Orta', 'İyi', 'Güçlü'][strength]
      : ['Use 9–32 characters', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  return (
    <div className="field password-field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input-wrap">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          required
          minLength={9}
          maxLength={32}
          autoComplete="new-password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={
            visible
              ? locale === 'tr'
                ? 'Parolayı gizle'
                : 'Hide password'
              : locale === 'tr'
                ? 'Parolayı göster'
                : 'Show password'
          }
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      <div className="password-feedback" aria-live="polite">
        <span>{strengthText}</span>
        <span>{value.length}/32</span>
      </div>
      <div className="password-strength" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <i key={index} className={index < strength ? 'active' : ''} />
        ))}
      </div>
    </div>
  );
}
