'use client';

import type { AuthSession, Locale, ServerInvitePreview } from '@wapve/contracts';
import { WapveLogo } from '@wapve/ui';
import { ArrowRight, Hash, LoaderCircle, LockKeyhole, ShieldCheck, Users, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import { dictionary } from '@/lib/i18n';
import { BirthDateFields } from './birth-date-fields';
import { InviteTurnstile } from './invite-turnstile';

type QuickRegistrationResult = {
  serverId: string;
  channel: ServerInvitePreview['channel'];
};

export function PublicInvite({
  code,
  locale,
  preview,
}: {
  code: string;
  locale: Locale;
  preview: ServerInvitePreview | null;
}) {
  const tr = locale === 'tr';
  const messages = dictionary(locale);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void apiRequest<AuthSession>('/auth/session')
      .then(setSession)
      .catch(() => undefined)
      .finally(() => setSessionChecked(true));
  }, []);

  function openTarget(serverId: string, channel: ServerInvitePreview['channel']) {
    const channelPath = channel?.type === 'TEXT' ? `/${encodeURIComponent(channel.publicId)}` : '';
    window.location.assign(`/${locale}/channels/${encodeURIComponent(serverId)}${channelPath}`);
  }

  async function acceptExisting() {
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest<{ server: { publicId: string }; channel: ServerInvitePreview['channel'] }>(
        '/servers/actions/accept-invite',
        { method: 'POST', body: JSON.stringify({ code }) },
      );
      openTarget(result.server.publicId, result.channel);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest<QuickRegistrationResult>('/auth/invite-register', {
        method: 'POST',
        body: JSON.stringify({
          code,
          displayName: data.get('displayName'),
          username: data.get('username'),
          birthDate: data.get('birthDate'),
          locale,
          turnstileToken,
        }),
      });
      openTarget(result.serverId, result.channel);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  const backgroundStyle = preview?.server.bannerUrl
    ? ({ '--invite-banner': `url("${preview.server.bannerUrl}")` } as CSSProperties)
    : undefined;

  return (
    <main className={`public-invite-page${preview?.server.bannerUrl ? ' has-banner' : ''}`} style={backgroundStyle} lang={locale}>
      <div className="public-invite-waves" aria-hidden="true"><i /><i /><i /></div>
      <header className="public-invite-brand"><WapveLogo /></header>
      <section className="public-invite-card">
        {!preview ? (
          <div className="public-invite-unavailable">
            <span><LockKeyhole size={28} /></span>
            <h1>{tr ? 'Bu davet artık kullanılamıyor' : 'This invite is no longer available'}</h1>
            <p>{tr ? 'Bağlantı geçersiz, süresi dolmuş veya kullanım sınırına ulaşmış olabilir.' : 'The link may be invalid, expired, or at its usage limit.'}</p>
            <Link href={`/${locale}`}>{tr ? 'Wapve ana sayfasına dön' : 'Return to Wapve'}</Link>
          </div>
        ) : (
          <>
            <div className="public-invite-server">
              <div className="public-invite-icon">
                {preview.server.iconUrl ? <img src={preview.server.iconUrl} alt="" /> : preview.server.name.slice(0, 1).toUpperCase()}
              </div>
              <p>{tr ? 'Bir topluluğa davet edildin' : 'You have been invited to a community'}</p>
              <h1>{preview.server.name}</h1>
              {preview.server.description && <div className="public-invite-description">{preview.server.description}</div>}
              <div className="public-invite-stats">
                <span><i className="online" /> {preview.server.onlineCount.toLocaleString(locale)} {tr ? 'çevrimiçi' : 'online'}</span>
                <span><Users size={14} /> {preview.server.memberCount.toLocaleString(locale)} {tr ? 'üye' : 'members'}</span>
              </div>
              {preview.channel && (
                <div className="public-invite-target">
                  {preview.channel.type === 'VOICE' ? <Volume2 size={16} /> : <Hash size={16} />}
                  <span>{preview.channel.name}</span>
                  <small>{preview.channel.type === 'VOICE' ? (tr ? 'Ses için e-posta doğrulaması gerekir' : 'Email verification is required for voice') : (tr ? 'Katıldıktan sonra açılır' : 'Opens after joining')}</small>
                </div>
              )}
            </div>
            <div className="public-invite-divider" />
            {!sessionChecked ? (
              <div className="public-invite-loading"><LoaderCircle className="spin" /></div>
            ) : session ? (
              <div className="public-invite-existing">
                <span className="public-invite-kicker">{tr ? 'OTURUM AÇIK' : 'SIGNED IN'}</span>
                <h2>{tr ? `Hazırsın, ${session.user.displayName}` : `You’re ready, ${session.user.displayName}`}</h2>
                <p>{tr ? 'Bu daveti kabul ederek topluluğa katıl.' : 'Accept this invite to join the community.'}</p>
                {error && <div className="form-error" role="alert">{error}</div>}
                <button className="public-invite-submit" onClick={() => void acceptExisting()} disabled={busy}>
                  {busy ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}
                  {tr ? 'Daveti kabul et' : 'Accept invite'}
                </button>
              </div>
            ) : (
              <form className="public-invite-form" onSubmit={(event) => void register(event)}>
                <div>
                  <span className="public-invite-kicker">{tr ? 'HIZLI KATILIM' : 'QUICK JOIN'}</span>
                  <h2>{tr ? 'Birkaç saniyede aramıza katıl' : 'Join in just a few seconds'}</h2>
                </div>
                <div className="field">
                  <label htmlFor="invite-display-name">{tr ? 'Görünen ad' : 'Display name'}</label>
                  <input id="invite-display-name" name="displayName" required maxLength={32} autoComplete="name" placeholder={tr ? 'İnsanlar sana nasıl hitap etsin?' : 'How should people call you?'} />
                </div>
                <div className="field">
                  <label htmlFor="invite-username">{tr ? 'Kullanıcı adı' : 'Username'}</label>
                  <input id="invite-username" name="username" required minLength={3} maxLength={32} autoComplete="username" pattern="[a-zA-Z0-9][a-zA-Z0-9._]*[a-zA-Z0-9]|[a-zA-Z0-9]{3}" placeholder="dalga.gezgini" />
                </div>
                <BirthDateFields locale={locale} />
                <p className="public-invite-legal">
                  {tr ? 'Katıl’a basarak ' : 'By joining, you agree to the '}
                  <Link href={`/${locale}/legal/terms`}>{tr ? 'Koşullarımızı' : 'Terms'}</Link>
                  {tr ? ' ve ' : ' and '}
                  <Link href={`/${locale}/legal/privacy`}>{tr ? 'Gizlilik Politikamızı' : 'Privacy Policy'}</Link>
                  {tr ? ' kabul edersin.' : '.'}
                </p>
                <InviteTurnstile locale={locale} onToken={setTurnstileToken} />
                {error && <div className="form-error" role="alert">{error}</div>}
                <button className="public-invite-submit" type="submit" disabled={busy || !turnstileToken}>
                  {busy ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}
                  {tr ? 'Hesap oluştur ve katıl' : 'Create account and join'}
                </button>
                <div className="public-invite-warning"><ShieldCheck size={16} /><span>{tr ? 'E-posta ve parola ekleyene kadar bu hesap, oturum kaybolursa geri alınamaz.' : 'Until you add email and password, this account cannot be recovered if the session is lost.'}</span></div>
                <p className="public-invite-login">{tr ? 'Zaten hesabın var mı?' : 'Already have an account?'} <Link href={`/${locale}/login?invite=${encodeURIComponent(code)}`}>{tr ? 'Giriş yap' : 'Log in'}</Link></p>
              </form>
            )}
          </>
        )}
      </section>
    </main>
  );
}
