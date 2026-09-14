'use client';
import { useEffect, useRef, useState } from 'react';
import type { SupportTicketDetail } from '@wapve/contracts';
import { apiRequest } from '@/lib/api';
import {
  Conversation,
  StatusBadge,
  supportError,
  WorkspaceHeader,
} from './support-workspace-shared';
import { SupportTurnstile } from './support-turnstile';
import styles from './support-workspace.module.css';

export function SupportCustomerPortal({
  reference,
  locale,
}: {
  reference: string;
  locale: string;
}) {
  const tr = locale !== 'en';
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [body, setBody] = useState('');
  const [survey, setSurvey] = useState('');
  const [turnstile, setTurnstile] = useState('');
  const [reset, setReset] = useState(0);
  const initialized = useRef(false);
  const base = `/support/customer/tickets/${reference}`;
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get('token');
    const rating = hash.get('survey');
    window.history.replaceState(null, '', window.location.pathname);
    if (rating) {
      setSurvey(rating);
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        if (token)
          await apiRequest('/support/customer/exchange', {
            method: 'POST',
            body: JSON.stringify({ reference, token }),
          });
        setTicket(await apiRequest<SupportTicketDetail>(base));
      } catch (e) {
        setError(supportError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [reference, base]);
  async function send() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setTicket(
        await apiRequest<SupportTicketDetail>(`${base}/messages`, {
          method: 'POST',
          body: JSON.stringify({ body }),
        }),
      );
      setBody('');
      setNotice(tr ? 'Yanıtın kaydedildi.' : 'Your reply was saved.');
    } catch (e) {
      setError(supportError(e));
    } finally {
      setBusy(false);
    }
  }
  const open =
    ticket &&
    !['CLOSED', 'SPAM'].includes(ticket.status) &&
    (ticket.status !== 'RESOLVED' ||
      Boolean(ticket.reopenUntil && new Date(ticket.reopenUntil).getTime() > Date.now()));
  return (
    <div className={styles.shell}>
      <WorkspaceHeader>
        <a href="/support">{tr ? 'Yardım merkezine dön' : 'Back to help center'}</a>
      </WorkspaceHeader>
      <main className={styles.portal}>
        {survey ? (
          <Survey reference={reference} token={survey} tr={tr} />
        ) : loading ? (
          <p role="status">{tr ? 'Talebin açılıyor…' : 'Opening your request…'}</p>
        ) : (
          <>
            {error && (
              <div className={styles.error} role="alert">
                {error}
              </div>
            )}
            {notice && (
              <div className={styles.success} role="status">
                {notice}
              </div>
            )}
            {ticket ? (
              <>
                <div className={styles.heading}>
                  <div>
                    <span className={styles.eyebrow}>{reference}</span>
                    <h1>{ticket.subject}</h1>
                    <p className={styles.muted}>
                      {tr
                        ? 'Destek ekibinle konuşman burada.'
                        : 'Your conversation with our support team.'}
                    </p>
                  </div>
                  <StatusBadge status={ticket.status} />
                </div>
                {ticket.status === 'RESOLVED' && (
                  <div className={styles.success}>
                    {tr
                      ? 'Talebin çözüldü. Aynı sorun devam ediyorsa çözümden sonraki 7 gün içinde yanıt vererek yeniden açabilirsin.'
                      : 'Your request is resolved. Reply within 7 days of resolution to reopen it if the same issue continues.'}
                  </div>
                )}
                <section className={styles.panel}>
                  <Conversation ticket={ticket} />
                </section>
                {open ? (
                  <section className={styles.panel}>
                    <h2>{tr ? 'Yanıt gönder' : 'Send a reply'}</h2>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void send();
                      }}
                    >
                      <label className={styles.field}>
                        {tr ? 'Mesajın' : 'Your message'}
                        <textarea
                          className={styles.textarea}
                          required
                          maxLength={4000}
                          value={body}
                          onChange={(e) => setBody(e.target.value)}
                        />
                      </label>
                      <p className={styles.muted}>
                        {tr
                          ? 'Şifreni, doğrulama veya kurtarma kodlarını paylaşma.'
                          : 'Do not share passwords, verification codes or recovery codes.'}
                      </p>
                      <button className={styles.button} disabled={busy || !body.trim()}>
                        {busy
                          ? tr
                            ? 'Gönderiliyor…'
                            : 'Sending…'
                          : tr
                            ? 'Yanıtı gönder'
                            : 'Send reply'}
                      </button>
                    </form>
                    <label className={styles.field} style={{ marginTop: 24 }}>
                      {tr
                        ? 'Son mesajına dosya ekle — en fazla 3 dosya, her biri 10 MB'
                        : 'Attach to your latest message — up to 3 files, 10 MB each'}
                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.log"
                        disabled={busy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setBusy(true);
                          setError('');
                          setNotice(
                            tr ? 'Dosya güvenlik taramasından geçiriliyor…' : 'Scanning the file…',
                          );
                          const data = new FormData();
                          data.append('file', file);
                          void apiRequest(`${base}/attachments`, { method: 'POST', body: data })
                            .then(() => apiRequest<SupportTicketDetail>(base))
                            .then((updated) => {
                              setTicket(updated);
                              setNotice(tr ? 'Dosya güvenle eklendi.' : 'File attached.');
                            })
                            .catch((error: unknown) => {
                              setError(supportError(error));
                              setNotice('');
                            })
                            .finally(() => setBusy(false));
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </section>
                ) : (
                  <p className={styles.muted}>
                    {tr
                      ? 'Bu talep kapalı. Farklı bir sorun için yeni talep açabilirsin.'
                      : 'This request is closed. You can open a new request for another issue.'}
                  </p>
                )}
                <button
                  className={styles.secondary}
                  onClick={() => {
                    setError('');
                    void apiRequest<SupportTicketDetail>(base)
                      .then(setTicket)
                      .catch((e: unknown) => setError(supportError(e)));
                  }}
                >
                  {tr ? 'Konuşmayı yenile' : 'Refresh conversation'}
                </button>
              </>
            ) : (
              <section className={styles.authCard} style={{ margin: '50px auto' }}>
                <h1>{tr ? 'Güvenli erişim bağlantısı' : 'Secure access link'}</h1>
                <p className={styles.muted}>
                  {reference}
                  <br />
                  {tr
                    ? 'Bu talebin e-posta adresini gir. Bilgiler eşleşiyorsa yeni bağlantı gönderilir.'
                    : 'Enter the email address for this request. If the details match, we will send a new link.'}
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setBusy(true);
                    setError('');
                    void apiRequest('/support/customer/access', {
                      method: 'POST',
                      body: JSON.stringify({ reference, email, turnstileToken: turnstile }),
                    })
                      .then(() =>
                        setNotice(
                          tr
                            ? 'Bilgiler eşleşiyorsa erişim bağlantısı e-posta adresine gönderilecek.'
                            : 'If the details match, an access link will be emailed to you.',
                        ),
                      )
                      .catch((e: unknown) => setError(supportError(e)))
                      .finally(() => {
                        setBusy(false);
                        setTurnstile('');
                        setReset((n) => n + 1);
                      });
                  }}
                >
                  <label className={styles.field}>
                    {tr ? 'E-posta' : 'Email'}
                    <input
                      className={styles.input}
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                  <SupportTurnstile onToken={setTurnstile} resetKey={reset} />
                  <button className={styles.button} disabled={busy}>
                    {tr ? 'Bağlantı iste' : 'Request link'}
                  </button>
                </form>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Survey({ reference, token, tr }: { reference: string; token: string; tr: boolean }) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [resolved, setResolved] = useState('');
  const [comment, setComment] = useState('');
  const [contact, setContact] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  if (done)
    return (
      <section className={styles.panel}>
        <h1>{tr ? 'Geri bildirimin için teşekkürler.' : 'Thank you for your feedback.'}</h1>
        <p>
          {tr
            ? 'Değerlendirmen kaydedildi ve destek kalitemizi geliştirmek için incelenecek.'
            : 'Your feedback was saved and will help improve our support.'}
        </p>
      </section>
    );
  return (
    <section className={`${styles.panel} ${styles.survey}`}>
      <span className={styles.eyebrow}>{reference}</span>
      <h1>{tr ? 'Destek deneyimin nasıldı?' : 'How was your support experience?'}</h1>
      <p className={styles.muted}>
        {tr
          ? 'Yanıtların bu talep ve ilgilenen görevliyle eşleştirilir; platform sahibi tarafından incelenebilir. Bağlantı 14 gün geçerlidir ve yalnız bir kez kullanılabilir.'
          : 'Your answers are linked to this request and its support agent, and can be reviewed by the platform owner. The link is valid for 14 days and can be used once.'}
      </p>
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          void apiRequest('/support/customer/rating', {
            method: 'POST',
            body: JSON.stringify({
              reference,
              token,
              ...scores,
              resolved: resolved === 'yes',
              comment,
              mayContact: contact,
            }),
          })
            .then(() => setDone(true))
            .catch((e: unknown) => setError(supportError(e)))
            .finally(() => setBusy(false));
        }}
      >
        {(
          [
            ['overall', tr ? 'Genel memnuniyet' : 'Overall satisfaction'],
            ['speed', tr ? 'Yanıt hızı' : 'Response speed'],
            ['clarity', tr ? 'Açıklık ve fayda' : 'Clarity and usefulness'],
            ['professionalism', tr ? 'Nezaket ve profesyonellik' : 'Courtesy and professionalism'],
          ] as const
        ).map(([key, label]) => (
          <fieldset key={key} style={{ border: 0, padding: 0, margin: 0 }}>
            <legend>{label}</legend>
            <div className={styles.score}>
              {[1, 2, 3, 4, 5].map((score) => (
                <label key={score}>
                  <input
                    required
                    type="radio"
                    name={key}
                    value={score}
                    checked={scores[key] === score}
                    onChange={() => setScores({ ...scores, [key]: score })}
                  />
                  <span>{score}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <p className={styles.muted}>
          {tr ? '1 = Çok kötü, 5 = Çok iyi' : '1 = Very poor, 5 = Excellent'}
        </p>
        <label className={styles.field}>
          {tr ? 'Sorunun çözüldü mü?' : 'Was your issue resolved?'}
          <select
            className={styles.select}
            required
            value={resolved}
            onChange={(e) => setResolved(e.target.value)}
          >
            <option value="">{tr ? 'Seç' : 'Select'}</option>
            <option value="yes">{tr ? 'Evet' : 'Yes'}</option>
            <option value="no">{tr ? 'Hayır' : 'No'}</option>
          </select>
        </label>
        <label className={styles.field}>
          {tr ? 'Eklemek istediğin bir şey var mı? (isteğe bağlı)' : 'Anything else? (optional)'}
          <textarea
            className={styles.textarea}
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={contact} onChange={(e) => setContact(e.target.checked)} />
          {tr
            ? 'Bu değerlendirmeyle ilgili benimle tekrar iletişim kurulabilir.'
            : 'You may contact me about this feedback.'}
        </label>
        <button className={styles.button} disabled={busy}>
          {busy
            ? tr
              ? 'Gönderiliyor…'
              : 'Sending…'
            : tr
              ? 'Değerlendirmeyi gönder'
              : 'Submit feedback'}
        </button>
      </form>
    </section>
  );
}
