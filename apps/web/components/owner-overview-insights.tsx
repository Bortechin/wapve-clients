import type { OwnerAdminCase, OwnerAnalytics, OwnerOperations, OwnerRiskEvent } from '@wapve/contracts';
import { Activity, ArrowUpRight, Database, ShieldAlert } from 'lucide-react';
import type { OwnerSection } from './owner-navigation';

export function OwnerOverviewInsights({ analytics, operations, reports, cases, risks, onSelect }: {
  analytics: OwnerAnalytics | null; operations: OwnerOperations | null; reports: number;
  cases: OwnerAdminCase[]; risks: OwnerRiskEvent[]; onSelect: (section: OwnerSection) => void;
}) {
  const days = [...(analytics?.daily ?? [])].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  const maximum = Math.max(1, ...days.map((day) => day.newUsers));
  const queue = [
    { label: 'İnceleme bekleyen bildirim', count: reports, target: 'reports' },
    { label: 'Açık vaka ve destek talebi', count: cases.filter((item) => ['OPEN', 'IN_REVIEW'].includes(item.status)).length, target: 'cases' },
    { label: 'Açık güvenlik olayı', count: risks.filter((item) => item.status === 'OPEN').length, target: 'security' },
  ] as const;
  return <div className="owner-insights-grid">
    <section className="owner-console-card owner-growth-card">
      <div className="owner-card-heading"><h2><Activity size={18} /> Topluluğun büyümesi</h2><button type="button" onClick={() => onSelect('analytics')}>Analitik <ArrowUpRight size={15} /></button></div>
      <strong className="owner-growth-number">{analytics ? days.reduce((sum, day) => sum + day.newUsers, 0).toLocaleString('tr') : '—'} <small>yeni kullanıcı</small></strong>
      <p>Son {days.length || 14} günlük kayıtlar · Her çubuk bir günü gösterir.</p>
      {days.length ? <div className="owner-growth-chart" role="list" aria-label="Günlük yeni kullanıcılar">{days.map((day) => <div role="listitem" key={day.date} tabIndex={0} aria-label={`${day.date}: ${day.newUsers} yeni kullanıcı`} title={`${day.date} · ${day.newUsers} yeni kullanıcı`}><span style={{ height: `${Math.max(2, day.newUsers / maximum * 100)}%` }} /><small>{new Date(`${day.date.slice(0, 10)}T12:00:00`).getDate()}</small></div>)}</div> : <p className="owner-empty-state">Bu dönem için günlük veri bulunmuyor.</p>}
      <div className="owner-chart-caption"><span>{days[0]?.date.slice(0, 10) ?? '—'}</span><span>{days.at(-1)?.date.slice(0, 10) ?? '—'}</span></div>
    </section>
    <section className="owner-console-card"><h2><ShieldAlert size={18} /> Öncelik masası</h2><p>İlgili kuyruğa geçerek incelemeye başla.</p><div className="owner-queue-list">{queue.map((item) => <button key={item.target} type="button" onClick={() => onSelect(item.target)}><span>{item.label}</span><b>{item.count}</b><ArrowUpRight size={16} /></button>)}</div><small>Yüklenen kayıtlardaki açık işler</small></section>
    <section className="owner-console-card owner-service-card"><div className="owner-card-heading"><h2><Database size={18} /> Servis görünümü</h2><button type="button" onClick={() => onSelect('operations')}>Ayrıntılar <ArrowUpRight size={15} /></button></div><div className="owner-service-grid">
      {(['database', 'redis'] as const).map((key) => <div key={key}><span>{key === 'database' ? 'Veritabanı' : 'Redis'}</span><strong className={operations?.[key] === 'HEALTHY' ? 'owner-status-ok' : 'owner-status-warning'}>{!operations ? 'Veri yok' : operations[key] === 'HEALTHY' ? 'Erişilebilir' : 'Kontrol gerekli'}</strong></div>)}
      <div><span>Ses bağlantısı</span><strong>{operations?.realtime.activeVoiceConnections ?? '—'}</strong></div>
      <div><span>Bekleyen mesaj işi</span><strong>{operations?.jobs.pendingScheduledMessages ?? '—'}</strong></div>
      <div><span>Başarısız mesaj işi</span><strong>{operations?.jobs.failedScheduledMessages ?? '—'}</strong></div>
      <div><span>API çalışma süresi</span><strong>{operations ? `${Math.floor(operations.uptimeSeconds / 3600)} sa ${Math.floor(operations.uptimeSeconds % 3600 / 60)} dk` : '—'}</strong></div>
    </div><small>Son ölçüm: {operations ? new Date(operations.generatedAt).toLocaleString('tr') : 'Henüz alınmadı'}</small></section>
  </div>;
}
