'use client';

import { CheckCircle2, MapPinCheck, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { apiRequest } from '@/lib/api';

type State = 'missing' | 'ready' | 'verifying' | 'success' | 'failed';

export function VerifyLoginLocationCard({ locale }: { locale: 'tr' | 'en' }) {
  const tr = locale === 'tr';
  const token = useSearchParams().get('token');
  const [state, setState] = useState<State>(token ? 'ready' : 'missing');

  async function approve() {
    if (!token || state === 'verifying') return;
    setState('verifying');
    try {
      await apiRequest<void>('/auth/login-location/confirm', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      setState('success');
    } catch {
      setState('failed');
    }
  }

  return (
    <div className="auth-card verify-login-location-card">
      <div className="empty-illustration">
        {state === 'success' ? (
          <CheckCircle2 size={46} />
        ) : state === 'failed' ? (
          <XCircle size={46} />
        ) : (
          <MapPinCheck size={46} />
        )}
      </div>
      <h1>
        {state === 'success'
          ? tr
            ? 'Konum doğrulandı'
            : 'Location approved'
          : tr
            ? 'Giriş konumunu doğrula'
            : 'Verify sign-in location'}
      </h1>
      <p>
        {state === 'verifying'
          ? tr
            ? 'Tek kullanımlık bağlantı kontrol ediliyor…'
            : 'Checking the single-use link…'
          : state === 'success'
            ? tr
              ? 'Bu cihaz ve konum hesabın için onaylandı. Şimdi giriş ekranına dönüp yeniden giriş yapabilirsin.'
              : 'This device and location are now approved. Return to sign in and try again.'
            : state === 'ready'
              ? tr
                ? 'Bu giriş sana aitse aşağıdaki düğmeyle cihazı onayla. Bağlantıyı açmak tek başına hesabında değişiklik yapmaz.'
                : 'If this sign-in is yours, approve the device below. Opening the link alone does not change your account.'
              : tr
                ? 'Bağlantı geçersiz, kullanılmış veya süresi dolmuş. Giriş ekranından yeni bir doğrulama e-postası iste.'
                : 'This link is invalid, already used, or expired. Request a new verification email from sign in.'}
      </p>
      {state === 'ready' || state === 'verifying' ? (
        <button
          className="wapve-button wapve-button--primary wapve-button--full"
          type="button"
          disabled={state === 'verifying'}
          onClick={() => void approve()}
        >
          {state === 'verifying'
            ? tr
              ? 'Doğrulanıyor…'
              : 'Approving…'
            : tr
              ? 'Bu cihazı doğrula'
              : 'Approve this device'}
        </button>
      ) : (
        <Link className="wapve-button wapve-button--primary wapve-button--full" href="/login">
          {tr ? 'Girişe dön' : 'Return to sign in'}
        </Link>
      )}
    </div>
  );
}
