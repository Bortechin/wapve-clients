'use client';
import { useEffect, useState } from 'react';
import type {
  SupportCannedReply,
  SupportCannedReplyInput,
  SupportCategory,
  SupportStaffIdentity,
} from '@wapve/contracts';
import { apiRequest } from '@/lib/api';
import { categories, date } from './support-workspace-shared';
import styles from './support-workspace.module.css';

type Analytics = {
  overdue: number;
  failedEmails: number;
  ratingCount: number;
  averageRating: number | null;
  participationRate: number | null;
  resolutionRate: number | null;
  averageFirstResponseHours: number | null;
  ratings: {
    id: string;
    overall: number;
    resolved: boolean;
    speed: number;
    clarity: number;
    professionalism: number;
    comment: string | null;
    mayContact: boolean;
    createdAt: string;
    agentName: string | null;
    ticket: { reference: string; subject: string; category: SupportCategory };
  }[];
  performance: {
    agentName: string;
    assigned: number;
    resolved: number;
    averageRating: number | null;
  }[];
};
type Agent = {
  id: string;
  email: string;
  supportAgentProfile: { displayName: string } | null;
  twoFactorEnabled: boolean;
};
type Quarantined = {
  id: string;
  sender: string;
  subject: string;
  reference: string | null;
  reason: string;
  createdAt: string;
  body?: string;
};
type Audit = { id: string; action: string; createdAt: string; metadata: unknown };
const initial: SupportCannedReplyInput = {
  category: null,
  locale: 'tr',
  title: '',
  body: '',
  active: true,
  sortOrder: 0,
};
export function SupportAdminTools({
  view,
  identity,
  canned,
  refresh,
  fail,
}: {
  view: 'canned' | 'analytics';
  identity: SupportStaffIdentity;
  canned: SupportCannedReply[];
  refresh: () => void;
  fail: (e: unknown) => void;
}) {
  const [filter, setFilter] = useState('');
  const [language, setLanguage] = useState('tr');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [quarantine, setQuarantine] = useState<Quarantined[]>([]);
  const [selected, setSelected] = useState<Quarantined | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (identity.owner) {
      void apiRequest<Agent[]>('/support/staff/agents').then(setAgents).catch(fail);
    }
  }, [identity.owner, fail]);
  useEffect(() => {
    if (view !== 'analytics' || !identity.owner) return;
    const params = new URLSearchParams();
    if (filter) params.set('category', filter);
    if (agentId) params.set('agentId', agentId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    void apiRequest<Analytics>(`/support/staff/analytics?${params}`).then(setAnalytics).catch(fail);
    void apiRequest<Quarantined[]>('/support/staff/quarantine').then(setQuarantine).catch(fail);
    void apiRequest<Audit[]>('/support/staff/audit').then(setAudit).catch(fail);
  }, [view, identity.owner, filter, agentId, from, to, fail]);
  if (view === 'canned')
    return (
      <>
        <div className={styles.heading}>
          <div>
            <span className={styles.eyebrow}>YANIT KÜTÜPHANESİ</span>
            <h1>Hazır cevaplar</h1>
            <p className={styles.muted}>
              Kategoriye uygun bir başlangıç seç; her yanıtı müşterinin durumuna göre düzenle.
            </p>
          </div>
          {identity.owner && (
            <button
              className={styles.button}
              onClick={() => {
                setEditing('new');
                setDraft(initial);
              }}
            >
              Yeni hazır cevap
            </button>
          )}
        </div>
        <div className={styles.toolbar}>
          <select
            className={styles.select}
            aria-label="Kategori"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Tüm kategoriler</option>
            {Object.entries(categories).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            aria-label="Dil"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="tr">Türkçe</option>
            <option value="en">English</option>
          </select>
        </div>
        {editing && identity.owner && (
          <form
            className={styles.panel}
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              void apiRequest(
                `/support/staff/canned-replies${editing === 'new' ? '' : `/${editing}`}`,
                { method: editing === 'new' ? 'POST' : 'PATCH', body: JSON.stringify(draft) },
              )
                .then(() => {
                  setEditing(null);
                  refresh();
                })
                .catch(fail)
                .finally(() => setBusy(false));
            }}
          >
            <h2>Hazır cevap düzenle</h2>
            <label className={styles.field}>
              Başlık
              <input
                className={styles.input}
                required
                minLength={2}
                maxLength={120}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <div className={styles.toolbar}>
              <select
                className={styles.select}
                aria-label="Şablon kategorisi"
                value={draft.category ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, category: (e.target.value as SupportCategory) || null })
                }
              >
                <option value="">Genel / tüm kategoriler</option>
                {Object.entries(categories).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                className={styles.select}
                aria-label="Şablon dili"
                value={draft.locale}
                onChange={(e) => setDraft({ ...draft, locale: e.target.value as 'tr' | 'en' })}
              >
                <option value="tr">Türkçe</option>
                <option value="en">English</option>
              </select>
            </div>
            <label className={styles.field}>
              Metin
              <textarea
                className={styles.textarea}
                required
                minLength={3}
                maxLength={3800}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              />
            </label>
            <p className={styles.muted}>
              Değişkenler:{' '}
              {
                '{{customer_name}}, {{ticket_reference}}, {{agent_name}}, {{article_url}}, {{next_step}}'
              }
              . İmza otomatik eklenir.
            </p>
            <label className={styles.field}>
              Sıra
              <input
                className={styles.input}
                type="number"
                min={0}
                max={10000}
                value={draft.sortOrder}
                onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })}
              />
            </label>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              />
              Etkin
            </label>
            <div className={styles.actions}>
              <button className={styles.button} disabled={busy}>
                Kaydet
              </button>
              <button type="button" className={styles.secondary} onClick={() => setEditing(null)}>
                Vazgeç
              </button>
            </div>
          </form>
        )}
        {canned
          .filter((row) => row.locale === language && (!filter || row.category === filter))
          .map((row) => (
            <article key={row.id} className={styles.panel}>
              <div className={styles.heading}>
                <h2>
                  {row.title} {!row.active && <span className={styles.badge}>Devre dışı</span>}
                </h2>
                {identity.owner && (
                  <button
                    className={styles.secondary}
                    onClick={() => {
                      setEditing(row.id);
                      setDraft(row);
                    }}
                  >
                    Düzenle
                  </button>
                )}
              </div>
              <p className={styles.body}>{row.body}</p>
            </article>
          ))}
      </>
    );
  if (!identity.owner) return null;
  return (
    <>
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>YÖNETİCİ GÖRÜNÜMÜ</span>
          <h1>Raporlar ve denetim</h1>
          <p className={styles.muted}>
            Gerçek değerlendirmeler, görevli performansı ve güvenlik incelemeleri.
          </p>
        </div>
      </div>
      <div className={styles.toolbar}>
        <select
          className={styles.select}
          aria-label="Görevli filtresi"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
        >
          <option value="">Tüm görevliler</option>
          {agents.map((agent) => (
            <option value={agent.id} key={agent.id}>
              {agent.supportAgentProfile?.displayName ?? agent.email}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          aria-label="Kategori filtresi"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Tüm kategoriler</option>
          {Object.entries(categories).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <input
          className={styles.input}
          type="date"
          aria-label="Başlangıç tarihi"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          className={styles.input}
          type="date"
          aria-label="Bitiş tarihi"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      {analytics && (
        <>
          <div className={styles.stats}>
            {[
              ['Ortalama puan', analytics.averageRating?.toFixed(2) ?? '—'],
              ['Değerlendirme', analytics.ratingCount],
              ['Yanıt hedefi geçen', analytics.overdue],
              ['Başarısız e-posta', analytics.failedEmails],
              [
                'Çözüldü diyenler',
                analytics.resolutionRate != null
                  ? `%${(analytics.resolutionRate * 100).toFixed(0)}`
                  : '—',
              ],
              [
                'Değerlendirme katılımı',
                analytics.participationRate != null
                  ? `%${(analytics.participationRate * 100).toFixed(0)}`
                  : '—',
              ],
              [
                'Ortalama ilk yanıt',
                analytics.averageFirstResponseHours != null
                  ? `${analytics.averageFirstResponseHours.toFixed(1)} sa`
                  : '—',
              ],
            ].map(([label, value]) => (
              <div key={label} className={styles.stat}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <section className={styles.panel}>
            <h2>Görevli performansı</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Görevli</th>
                    <th>Atanan</th>
                    <th>Çözülen</th>
                    <th>Ortalama puan</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.performance?.map((row) => (
                    <tr key={row.agentName}>
                      <td>{row.agentName}</td>
                      <td>{row.assigned}</td>
                      <td>{row.resolved}</td>
                      <td>{row.averageRating?.toFixed(2) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className={styles.panel}>
            <h2>Müşteri değerlendirmeleri (son 200)</h2>
            {analytics.ratings.length === 0 && (
              <p className={styles.empty}>Henüz değerlendirme yok.</p>
            )}
            {analytics.ratings.map((row) => (
              <details key={row.id} className={styles.message}>
                <summary>
                  {row.overall <= 2 ? '⚠ İnceleme gerekli · ' : ''}
                  {row.overall}/5 · {row.agentName ?? 'Görevli yok'} · {row.ticket.reference} ·{' '}
                  {date(row.createdAt)}
                </summary>
                <p className={styles.body}>
                  {row.ticket.subject}
                  <br />
                  Çözüldü: {row.resolved ? 'Evet' : 'Hayır'} · Hız: {row.speed}/5 · Açıklık:{' '}
                  {row.clarity}/5 · Nezaket: {row.professionalism}/5
                  <br />
                  {row.comment ?? 'Yorum yok.'}
                  <br />
                  Tekrar iletişim izni: {row.mayContact ? 'Var' : 'Yok'}
                </p>
              </details>
            ))}
          </section>
        </>
      )}
      <section className={styles.panel}>
        <h2>Görevli görünen adları</h2>
        {agents.map((agent) => (
          <form
            key={agent.id}
            className={styles.toolbar}
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              void apiRequest(`/support/staff/agents/${agent.id}/name`, {
                method: 'PATCH',
                body: JSON.stringify({
                  displayName: agentNames[agent.id] ?? agent.supportAgentProfile?.displayName ?? '',
                }),
              })
                .then(() => apiRequest<Agent[]>('/support/staff/agents'))
                .then(setAgents)
                .catch(fail)
                .finally(() => setBusy(false));
            }}
          >
            <label className={styles.field}>
              {agent.email} · {agent.twoFactorEnabled ? '2FA etkin' : '2FA gerekli'}
              <input
                className={styles.input}
                required
                minLength={2}
                maxLength={40}
                value={agentNames[agent.id] ?? agent.supportAgentProfile?.displayName ?? ''}
                onChange={(e) => setAgentNames({ ...agentNames, [agent.id]: e.target.value })}
              />
            </label>
            <button className={styles.secondary} disabled={busy}>
              Adı kaydet
            </button>
          </form>
        ))}
      </section>
      <section className={styles.panel}>
        <h2>E-posta karantinası (son 100)</h2>
        <p className={styles.muted}>
          Bu iletiler taleplere eklenmedi. İçerik düz metin olarak gösterilir; otomatik içeri
          aktarma yoktur.
        </p>
        {quarantine.map((mail) => (
          <div key={mail.id} className={styles.message}>
            <button
              className={styles.ticketLink}
              onClick={() =>
                void apiRequest<Quarantined>(`/support/staff/quarantine/${mail.id}`)
                  .then(setSelected)
                  .catch(fail)
              }
            >
              {mail.subject || '(Konusuz)'}
              <small>
                {mail.sender} · {mail.reason} · {date(mail.createdAt)}
              </small>
            </button>
          </div>
        ))}
        {!quarantine.length && <p className={styles.muted}>Karantinada ileti yok.</p>}
        {selected && (
          <div className={styles.preview}>
            <strong>{selected.subject}</strong>
            <p>{selected.body}</p>
            <button className={styles.secondary} onClick={() => setSelected(null)}>
              Kapat
            </button>
          </div>
        )}
      </section>
      <section className={styles.panel}>
        <h2>Destek denetim geçmişi (son 100)</h2>
        {audit.map((event) => (
          <details className={styles.message} key={event.id}>
            <summary>
              {event.action} · {date(event.createdAt)}
            </summary>
            <pre className={styles.body}>{JSON.stringify(event.metadata, null, 2)}</pre>
          </details>
        ))}
      </section>
    </>
  );
}
