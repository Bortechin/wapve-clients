'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  BarChart3,
  CheckCheck,
  Clock3,
  Inbox,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MessageSquareText,
  RefreshCw,
  Search,
  UserRound,
} from 'lucide-react';
import type {
  SupportCannedReply,
  SupportCategory,
  SupportStaffIdentity,
  SupportTicketDetail,
  SupportTicketSummary,
} from '@wapve/contracts';
import { apiRequest, ApiClientError } from '@/lib/api';
import {
  categories,
  Conversation,
  date,
  priorities,
  StatusBadge,
  statuses,
  supportError,
  WorkspaceHeader,
} from './support-workspace-shared';
import { SupportAdminTools } from './support-admin-tools';
import styles from './support-workspace.module.css';

type Queue = {
  items: SupportTicketSummary[];
  nextCursor: string | null;
  counts: { mine: number; unassigned: number; waiting: number; resolved: number };
};
const empty: Queue = {
  items: [],
  nextCursor: null,
  counts: { mine: 0, unassigned: 0, waiting: 0, resolved: 0 },
};
type View =
  | 'overview'
  | 'mine'
  | 'unassigned'
  | 'waiting'
  | 'resolved'
  | 'all'
  | 'canned'
  | 'analytics';
const nav = [
  ['overview', 'Genel bakış', LayoutDashboard],
  ['mine', 'Bana atananlar', UserRound],
  ['unassigned', 'Sahipsiz talepler', Inbox],
  ['waiting', 'Bekleyenler', Clock3],
  ['resolved', 'Çözülenler', CheckCheck],
  ['canned', 'Hazır cevaplar', MessageSquareText],
] as const;

export function SupportStaffWorkspace() {
  const [identity, setIdentity] = useState<SupportStaffIdentity | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>('overview');
  const [category, setCategory] = useState<SupportCategory | ''>('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [queue, setQueue] = useState<Queue>(empty);
  const [mine, setMine] = useState<SupportTicketSummary[]>([]);
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [canned, setCanned] = useState<SupportCannedReply[]>([]);
  const [live, setLive] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const currentTicket = useRef<string | null>(null);
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const fail = useCallback((error: unknown) => {
    setError(supportError(error));
    if (error instanceof ApiClientError && error.status === 401) {
      setIdentity(null);
      setTicket(null);
      setQueue(empty);
      setMine([]);
      setCanned([]);
    }
  }, []);
  useEffect(() => {
    void apiRequest<SupportStaffIdentity>('/support/staff/me')
      .then(setIdentity)
      .catch((e: unknown) => {
        if (!(e instanceof ApiClientError && e.status === 401)) fail(e);
      })
      .finally(() => setChecking(false));
  }, [fail]);
  useEffect(() => {
    const timeout = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);
  useEffect(() => {
    currentTicket.current = ticket?.id ?? null;
  }, [ticket]);
  useEffect(() => {
    if (!identity || identity.needsOnboarding) return;
    const abort = new AbortController();
    const params = new URLSearchParams({
      view:
        view === 'overview' ? 'unassigned' : ['canned', 'analytics'].includes(view) ? 'all' : view,
    });
    if (category) params.set('category', category);
    if (query) params.set('search', query);
    void apiRequest<Queue>(`/support/staff/tickets?${params}`, { signal: abort.signal })
      .then(setQueue)
      .catch((e: unknown) => {
        if (!abort.signal.aborted) fail(e);
      });
    if (view === 'overview')
      void apiRequest<Queue>('/support/staff/tickets?view=mine', { signal: abort.signal })
        .then((data) => setMine(data.items))
        .catch((e: unknown) => {
          if (!abort.signal.aborted) fail(e);
        });
    return () => abort.abort();
  }, [identity, view, category, query, refresh, fail]);
  useEffect(() => {
    if (identity && !identity.needsOnboarding)
      void apiRequest<SupportCannedReply[]>('/support/staff/canned-replies')
        .then(setCanned)
        .catch(fail);
  }, [identity, refresh, fail]);
  useEffect(() => {
    if (!identity || identity.needsOnboarding) return;
    const origin = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1').replace(
      /\/api\/v1\/?$/,
      '',
    );
    const socket = io(`${origin}/support`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const reload = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        setRefresh((n) => n + 1);
        if (currentTicket.current)
          void apiRequest<SupportTicketDetail>(`/support/staff/tickets/${currentTicket.current}`)
            .then(setTicket)
            .catch(fail);
      }, 200);
    };
    socket.on('support:ready', () => setLive(true));
    socket.on('disconnect', () => setLive(false));
    socket.on('connect_error', () => setLive(false));
    for (const event of [
      'ticket.created',
      'ticket.updated',
      'ticket.claimed',
      'ticket.message',
      'ticket.resolved',
    ])
      socket.on(event, reload);
    const heartbeat = setInterval(() => socket.emit('support:heartbeat'), 30_000);
    const fallback = setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, 60_000);
    let lastActivity = 0;
    const activity = () => {
      if (Date.now() - lastActivity < 60_000) return;
      lastActivity = Date.now();
      void apiRequest('/support/staff/activity', { method: 'POST' }).catch(fail);
    };
    window.addEventListener('pointerdown', activity);
    window.addEventListener('keydown', activity);
    return () => {
      clearTimeout(debounce);
      clearInterval(heartbeat);
      clearInterval(fallback);
      socket.disconnect();
      window.removeEventListener('pointerdown', activity);
      window.removeEventListener('keydown', activity);
    };
  }, [identity, fail]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    await run(async () => {
      setTicket(await apiRequest<SupportTicketDetail>(`/support/staff/tickets/${id}`));
    });
  }
  function navigate(next: View, cat: SupportCategory | '' = '') {
    setView(next);
    setCategory(cat);
    setTicket(null);
    setError('');
  }
  function table(items: SupportTicketSummary[]) {
    return items.length ? (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Talep</th>
              <th>Durum</th>
              <th>Kategori</th>
              <th>Öncelik</th>
              <th>Görevli</th>
              <th>Son hareket / Bekleme</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td>
                  <button className={styles.ticketLink} onClick={() => void open(row.id)}>
                    {row.hasCustomerUpdate && (
                      <span className={styles.dot} aria-label="Müşteri yanıtı bekliyor" />
                    )}
                    {row.subject}
                    <small>{row.reference}</small>
                  </button>
                </td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>{categories[row.category]}</td>
                <td>{priorities[row.priority]}</td>
                <td>{row.assignedAgentName ?? 'Sahipsiz'}</td>
                <td>
                  {date(row.lastActivityAt)}
                  <div className={styles.muted}>
                    {Math.max(
                      0,
                      Math.floor((Date.now() - new Date(row.lastActivityAt).getTime()) / 60000),
                    )}{' '}
                    dk
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className={styles.empty}>Bu görünümde talep yok. Yeni talepler burada görünecek.</div>
    );
  }
  if (checking)
    return (
      <div className={styles.shell}>
        <WorkspaceHeader />
        <div className={styles.authArea}>
          <p role="status">Oturum kontrol ediliyor…</p>
        </div>
      </div>
    );
  if (!identity || identity.needsOnboarding)
    return (
      <div className={styles.shell}>
        <WorkspaceHeader>
          <span className={styles.muted}>Yalnız yetkili destek ekibi</span>
        </WorkspaceHeader>
        <main className={styles.authArea}>
          <section className={styles.authCard}>
            <div className={styles.lock}>
              <LockKeyhole size={23} />
            </div>
            <h1>{identity ? 'Seni nasıl tanıyalım?' : 'Destek vardiyanı aç'}</h1>
            <p className={styles.muted}>
              {identity
                ? 'Müşteriler yanıtlarında bu adı görecek. Sonradan yalnız platform sahibi değiştirebilir.'
                : 'Wapve hesabının şifresi ve doğrulama uygulamandaki altı haneli kod ile giriş yap.'}
            </p>
            {error && (
              <div className={styles.error} role="alert">
                {error}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  if (identity) {
                    await apiRequest('/support/staff/onboarding', {
                      method: 'POST',
                      body: JSON.stringify({ displayName }),
                    });
                    setIdentity(await apiRequest<SupportStaffIdentity>('/support/staff/me'));
                  } else {
                    setIdentity(
                      await apiRequest<SupportStaffIdentity>('/support/staff/login', {
                        method: 'POST',
                        body: JSON.stringify({ email, password, code }),
                      }),
                    );
                    setPassword('');
                    setCode('');
                  }
                });
              }}
            >
              {identity ? (
                <label className={styles.field}>
                  Destek görünen adı
                  <input
                    className={styles.input}
                    required
                    minLength={2}
                    maxLength={40}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    autoComplete="given-name"
                  />
                </label>
              ) : (
                <>
                  <label className={styles.field}>
                    E-posta
                    <input
                      className={styles.input}
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="username"
                    />
                  </label>
                  <label className={styles.field}>
                    Şifre
                    <input
                      className={styles.input}
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </label>
                  <label className={styles.field}>
                    TOTP doğrulama kodu
                    <input
                      className={styles.input}
                      required
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      autoComplete="one-time-code"
                      placeholder="000000"
                    />
                  </label>
                </>
              )}
              <button className={styles.button} disabled={busy}>
                {busy ? 'Kontrol ediliyor…' : identity ? 'Kaydet ve devam et' : 'Güvenli giriş yap'}
              </button>
            </form>
            <p className={styles.muted}>
              Vardiya 4 saat, hareketsizlik sınırı 30 dakikadır. 2FA kapalıysa{' '}
              <a href="/app">Wapve → Kullanıcı ayarları → Güvenlik</a> bölümünden etkinleştir.
            </p>
          </section>
        </main>
      </div>
    );
  return (
    <div className={styles.shell}>
      <WorkspaceHeader>
        <span className={live ? styles.live : styles.offline}>
          {live ? '● Canlı bağlantı' : '● Yeniden bağlanıyor'}
        </span>
        <span className={styles.muted}>
          {identity.displayName} · {identity.owner ? 'Yönetici' : 'Destek görevlisi'}
        </span>
        <button
          className={styles.secondary}
          aria-label="Vardiyayı kapat"
          onClick={() =>
            void run(async () => {
              await apiRequest('/support/staff/logout', { method: 'POST' });
              setIdentity(null);
              setTicket(null);
              setQueue(empty);
            })
          }
        >
          <LogOut size={16} />
        </button>
      </WorkspaceHeader>
      <div className={styles.layout}>
        <nav className={styles.sidebar} aria-label="Destek paneli">
          <div className={styles.navLabel}>Çalışma alanı</div>
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              className={styles.navButton}
              aria-current={view === key && !category ? 'page' : undefined}
              onClick={() => navigate(key)}
            >
              <Icon size={17} />
              {label}
              {key in queue.counts && <span>{queue.counts[key as keyof typeof queue.counts]}</span>}
            </button>
          ))}
          <div className={styles.navLabel}>Kategoriler</div>
          {Object.entries(categories).map(([key, label]) => (
            <button
              key={key}
              className={styles.navButton}
              aria-current={category === key ? 'page' : undefined}
              onClick={() => navigate('all', key as SupportCategory)}
            >
              {label}
            </button>
          ))}
          {identity.owner && (
            <>
              <div className={styles.navLabel}>Yönetim</div>
              <button
                className={styles.navButton}
                aria-current={view === 'analytics' ? 'page' : undefined}
                onClick={() => navigate('analytics')}
              >
                <BarChart3 size={17} />
                Raporlar ve denetim
              </button>
            </>
          )}
        </nav>
        <main className={styles.main}>
          {error && (
            <div role="alert" className={styles.error}>
              {error}
            </div>
          )}
          {ticket ? (
            <TicketEditor
              key={ticket.id}
              ticket={ticket}
              identity={identity}
              canned={canned}
              busy={busy}
              back={() => setTicket(null)}
              act={(path, body, method = 'POST') =>
                run(async () => {
                  setTicket(
                    await apiRequest<SupportTicketDetail>(
                      `/support/staff/tickets/${ticket.id}${path}`,
                      { method, body: JSON.stringify(body) },
                    ),
                  );
                  setRefresh((n) => n + 1);
                })
              }
              reload={() => void open(ticket.id)}
              fail={fail}
            />
          ) : view === 'analytics' || view === 'canned' ? (
            <SupportAdminTools
              view={view}
              identity={identity}
              canned={canned}
              refresh={() => setRefresh((n) => n + 1)}
              fail={fail}
            />
          ) : (
            <>
              <div className={styles.heading}>
                <div>
                  <span className={styles.eyebrow}>DESTEK OPERASYONU</span>
                  <h1>
                    {category
                      ? categories[category]
                      : (nav.find(([key]) => key === view)?.[1] ?? 'Tüm talepler')}
                  </h1>
                  <p className={styles.muted}>Her konuşma, çözümüne bir adım daha yakın.</p>
                </div>
                <button className={styles.secondary} onClick={() => setRefresh((n) => n + 1)}>
                  <RefreshCw size={15} />
                  Yenile
                </button>
              </div>
              <div className={styles.stats}>
                {(
                  [
                    ['Bana atanan', queue.counts.mine],
                    ['Sahipsiz', queue.counts.unassigned],
                    ['Müşteri bekleniyor', queue.counts.waiting],
                    ['Çözülen / kapanan', queue.counts.resolved],
                  ] as const
                ).map(([label, value]) => (
                  <div className={styles.stat} key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              {view === 'overview' && (
                <section className={styles.panel}>
                  <h2>Önce senin taleplerin</h2>
                  {table(mine)}
                </section>
              )}
              <section className={styles.panel}>
                <h2>{view === 'overview' ? 'Sahipsiz güncel kuyruk' : 'Talepler'}</h2>
                <div className={styles.toolbar}>
                  <Search size={18} />
                  <input
                    className={styles.input}
                    aria-label="Talep ara"
                    placeholder="Takip numarası, konu veya e-posta ara"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {table(queue.items)}
                {queue.nextCursor && (
                  <button
                    className={styles.secondary}
                    onClick={() =>
                      void run(async () => {
                        const params = new URLSearchParams({
                          view: view === 'overview' ? 'unassigned' : view,
                          cursor: queue.nextCursor!,
                        });
                        if (category) params.set('category', category);
                        if (query) params.set('search', query);
                        const next = await apiRequest<Queue>(`/support/staff/tickets?${params}`);
                        setQueue({ ...next, items: [...queue.items, ...next.items] });
                      })
                    }
                  >
                    Daha fazla göster
                  </button>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function TicketEditor({
  ticket,
  identity,
  canned,
  busy,
  back,
  act,
  reload,
  fail,
}: {
  ticket: SupportTicketDetail;
  identity: SupportStaffIdentity;
  canned: SupportCannedReply[];
  busy: boolean;
  back: () => void;
  act: (path: string, body: unknown, method?: string) => Promise<boolean>;
  reload: () => void;
  fail: (e: unknown) => void;
}) {
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [status, setStatus] = useState('IN_PROGRESS');
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [agents, setAgents] = useState<
    { id: string; email: string; supportAgentProfile: { displayName: string } | null }[]
  >([]);
  const editable = identity.owner || ticket.assignedAgentId === identity.userId;
  useEffect(() => {
    if (identity.owner)
      void apiRequest<typeof agents>('/support/staff/agents').then(setAgents).catch(fail);
  }, [identity.owner, fail]);
  const signature =
    ticket.locale === 'tr'
      ? `\n\nİyi dileklerimle,\n${identity.displayName}\nWapve Destek Ekibi`
      : `\n\nBest regards,\n${identity.displayName}\nWapve Support`;
  return (
    <>
      <div className={styles.heading}>
        <div>
          <button className={styles.secondary} onClick={back}>
            ← Kuyruğa dön
          </button>
          <p className={styles.eyebrow}>{ticket.reference}</p>
          <h1>{ticket.subject}</h1>
          <StatusBadge status={ticket.status} />
        </div>
        {!ticket.assignedAgentId && !['RESOLVED', 'CLOSED', 'SPAM'].includes(ticket.status) && (
          <button className={styles.button} disabled={busy} onClick={() => void act('/claim', {})}>
            Talebi üstlen
          </button>
        )}
      </div>
      <div className={styles.detailLayout}>
        <div>
          <section className={styles.panel}>
            <Conversation ticket={ticket} staff />
          </section>
          {editable && (
            <section className={styles.panel}>
              <h2>{internal ? 'Dahili not' : 'Müşteriye yanıt'}</h2>
              <div className={styles.toolbar}>
                <select
                  aria-label="Hazır yanıt seç"
                  className={styles.select}
                  value=""
                  onChange={(e) => {
                    const selected = canned.find((row) => row.id === e.target.value);
                    if (selected)
                      setBody(
                        selected.body.replace(
                          /\{\{(\w+)\}\}/g,
                          (match, key: string) =>
                            ({
                              customer_name: ticket.requesterName ?? 'Wapve kullanıcısı',
                              ticket_reference: ticket.reference,
                              agent_name: identity.displayName ?? '',
                              article_url: 'https://wapve.com/support',
                              next_step: '[Sonraki adımı burada belirtin]',
                            })[key] ?? match,
                        ),
                      );
                  }}
                >
                  <option value="">Hazır cevap seç…</option>
                  {canned
                    .filter(
                      (row) =>
                        row.active &&
                        row.locale === ticket.locale &&
                        (!row.category || row.category === ticket.category),
                    )
                    .map((row) => (
                      <option value={row.id} key={row.id}>
                        {row.title}
                      </option>
                    ))}
                </select>
                <button className={styles.secondary} onClick={() => setPreview(!preview)}>
                  {preview ? 'Düzenle' : 'Önizle'}
                </button>
              </div>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                />
                Dahili not — müşteriye ve e-postaya gönderilmez
              </label>
              {preview ? (
                <div className={styles.preview}>
                  {body}
                  {!internal && signature}
                </div>
              ) : (
                <textarea
                  className={styles.textarea}
                  maxLength={3800}
                  aria-label="Yanıt metni"
                  placeholder="Yanıtını yaz…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              )}
              <p className={styles.muted}>
                {internal
                  ? 'Yalnız destek ekibi görebilir.'
                  : 'İmzan sunucu tarafından otomatik eklenir. Şifre veya doğrulama kodu isteme.'}
              </p>
              <div className={styles.actions}>
                {!internal && (
                  <select
                    aria-label="Yanıttan sonraki durum"
                    className={styles.select}
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="IN_PROGRESS">İşlemde tut</option>
                    <option value="WAITING_CUSTOMER">Müşteriden bilgi bekle</option>
                    <option value="RESOLVED">Çöz ve kapatma sürecini başlat</option>
                  </select>
                )}
                <button
                  className={styles.button}
                  disabled={
                    busy ||
                    !body.trim() ||
                    (!internal && ['CLOSED', 'SPAM'].includes(ticket.status)) ||
                    /\{\{\w+\}\}|\[Sonraki adımı/.test(body)
                  }
                  onClick={() =>
                    void act('/messages', {
                      body,
                      internal,
                      ...(!internal ? { status } : {}),
                    }).then((success) => {
                      if (!success) return;
                      setBody('');
                      setPreview(false);
                    })
                  }
                >
                  {busy ? 'Kaydediliyor…' : internal ? 'Notu kaydet' : 'Yanıtı gönder'}
                </button>
              </div>
              <label className={styles.field} style={{ marginTop: 20 }}>
                Son gönderdiğin mesaja dosya ekle (3 × 10 MB)
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.log"
                  disabled={uploading || busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const data = new FormData();
                    data.append('file', file);
                    setUploading(true);
                    void apiRequest(`/support/staff/tickets/${ticket.id}/attachments`, {
                      method: 'POST',
                      body: data,
                    })
                      .then(reload)
                      .catch(fail)
                      .finally(() => setUploading(false));
                    e.target.value = '';
                  }}
                />
              </label>
              {uploading && <p role="status">Dosya güvenlik taramasından geçiriliyor…</p>}
            </section>
          )}
        </div>
        <aside>
          <section className={styles.panel}>
            <h2>Talep bilgileri</h2>
            <dl className={styles.detailsList}>
              <div>
                <dt>Müşteri</dt>
                <dd>
                  {ticket.requesterName ?? 'Talep sahibi'}
                  <br />
                  {ticket.requesterEmail}
                </dd>
              </div>
              <div>
                <dt>Görevli</dt>
                <dd>{ticket.assignedAgentName ?? 'Henüz atanmadı'}</dd>
              </div>
              <div>
                <dt>Açılış</dt>
                <dd>{date(ticket.createdAt)}</dd>
              </div>
              <div>
                <dt>İç ilk yanıt hedefi</dt>
                <dd>{ticket.firstResponseDueAt ? date(ticket.firstResponseDueAt) : '—'}</dd>
              </div>
              {ticket.relatedEntity && (
                <div>
                  <dt>İlgili kimlik</dt>
                  <dd>{ticket.relatedEntity}</dd>
                </div>
              )}
            </dl>
          </section>
          {editable && (
            <section className={styles.panel}>
              <h2>İşlemler</h2>
              <label className={styles.field}>
                Kategori
                <select
                  className={styles.select}
                  disabled={busy}
                  value={ticket.category}
                  onChange={(e) => void act('', { category: e.target.value }, 'PATCH')}
                >
                  {Object.entries(categories).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Öncelik
                <select
                  className={styles.select}
                  disabled={busy}
                  value={ticket.priority}
                  onChange={(e) => void act('', { priority: e.target.value }, 'PATCH')}
                >
                  {Object.entries(priorities).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {identity.owner && (
                <label className={styles.field}>
                  Görevliyi değiştir
                  <select
                    className={styles.select}
                    value={ticket.assignedAgentId ?? ''}
                    disabled={busy}
                    onChange={(e) =>
                      void act('/assignment', { agentId: e.target.value || null }, 'PATCH')
                    }
                  >
                    <option value="">Sahipsiz bırak</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.supportAgentProfile?.displayName ?? agent.email}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className={styles.field}>
                Durum
                <select
                  className={styles.select}
                  value={ticket.status}
                  disabled={busy}
                  onChange={(e) => void act('', { status: e.target.value }, 'PATCH')}
                >
                  {Object.entries(statuses)
                    .filter(([value]) => identity.owner || !['NEW', 'CLOSED'].includes(value))
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>
              <p className={styles.muted}>
                Çözülen talepler 7 gün sonra kapanır. Müşteri bu sürede yanıt verirse yeniden
                açılır.
              </p>
            </section>
          )}
          {ticket.rating && (
            <section className={styles.panel}>
              <h2>Değerlendirme · {ticket.rating.overall}/5</h2>
              <p className={styles.body}>{ticket.rating.comment ?? 'Yorum yok.'}</p>
            </section>
          )}
          <section className={styles.panel}>
            <h2>İşlem geçmişi</h2>
            {ticket.events.map((event) => (
              <div key={event.id} className={styles.message}>
                <strong className={styles.muted}>
                  {event.type} · {event.actorName ?? 'Sistem'}
                </strong>
                <p className={styles.muted}>{date(event.createdAt)}</p>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </>
  );
}
