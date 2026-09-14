import { ApiError } from '@wapve/api-client';
import tr from '../../../web/messages/tr.json';
import en from '../../../web/messages/en.json';

export function normalizeLoginIdentifier(identifier: string): string {
  const value = identifier.trim();
  return value.startsWith('@') && !value.slice(1).includes('@') ? value.slice(1) : value;
}

export function loginErrorMessage(error: unknown, locale: 'tr' | 'en', passkey = false): string {
  const messages: Record<string, string> = locale === 'tr' ? tr.errors : en.errors;
  if (error instanceof ApiError) {
    const key = error.messageKey.replace(/^errors\./, '').replace('invalidCredentails', 'invalidCredentials');
    return Object.prototype.hasOwnProperty.call(messages, key)
      ? messages[key]!
      : locale === 'tr' ? 'Giriş tamamlanamadı. Lütfen tekrar dene.' : 'Sign-in could not finish. Please retry.';
  }
  const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
  if (passkey) {
    if (code === 'PASSKEY_CANCELLED') return locale === 'tr' ? 'Geçiş anahtarı işlemi kapatıldı. Hazır olduğunda tekrar deneyebilirsin.' : 'The passkey request was closed. Try again when ready.';
    if (code === 'PASSKEY_NO_CREDENTIAL' || code === 'PASSKEY_PROVIDER_UNAVAILABLE') return locale === 'tr' ? 'Geçiş anahtarı bulunamadı. Parola sağlayıcısı ayarlarından Proton Pass veya kullandığın sağlayıcıyı etkinleştir.' : 'No passkey found. Enable Proton Pass or your provider in password provider settings.';
    if (code === 'PASSKEY_INTERRUPTED') return locale === 'tr' ? 'Geçiş anahtarı işlemi kesildi. Tekrar dene.' : 'The passkey request was interrupted. Please retry.';
    if (code === 'PASSKEY_UNSUPPORTED') return locale === 'tr' ? 'Bu cihazda geçiş anahtarı kullanılamıyor. Şifrenle giriş yapabilirsin.' : 'Passkeys are unavailable on this device. Sign in with your password.';
    return locale === 'tr' ? 'Geçiş anahtarı doğrulanamadı. Sağlayıcı ayarlarını ve bağlantını kontrol et.' : 'Passkey verification failed. Check your provider settings and connection.';
  }
  return locale === 'tr' ? 'Bağlantı kurulamadı.' : 'Could not connect.';
}
