'use client';

import { useState } from 'react';
import { Activity, BadgeCheck, BarChart3, BriefcaseBusiness, Flag, Gauge, Megaphone, ReceiptText, Search, Server, Settings2, ShieldAlert, ShieldCheck, Users } from 'lucide-react';

export const ownerSections = [
  { id: 'overview', label: 'Genel bakış', group: 'PLATFORM', icon: Activity, description: 'Wapve’de bugün neler oluyor?' },
  { id: 'analytics', label: 'Büyüme ve kullanım', group: 'PLATFORM', icon: BarChart3, description: 'Kayıtlar, kullanım ve gelir hareketleri.' },
  { id: 'users', label: 'Kullanıcılar', group: 'TOPLULUK', icon: Users, description: 'Hesaplar, yetkiler ve üyelik işlemleri.' },
  { id: 'servers', label: 'Sunucular', group: 'TOPLULUK', icon: Server, description: 'Toplulukları incele ve görünürlüklerini yönet.' },
  { id: 'badges', label: 'Rozetler', group: 'TOPLULUK', icon: BadgeCheck, description: 'Platform kimlikleri ve rozet kataloğu.' },
  { id: 'reports', label: 'Bildirimler', group: 'GÜVEN VE DESTEK', icon: Flag, description: 'Kullanıcı ve içerik bildirimlerini değerlendir.' },
  { id: 'cases', label: 'Vakalar ve destek', group: 'GÜVEN VE DESTEK', icon: BriefcaseBusiness, description: 'Destek talepleri, kanıtlar ve vaka kararları.' },
  { id: 'appeals', label: 'İtirazlar', group: 'GÜVEN VE DESTEK', icon: Flag, description: 'Yönetim kararlarına gelen itirazları incele.' },
  { id: 'security', label: 'Güvenlik', group: 'GÜVEN VE DESTEK', icon: ShieldCheck, description: 'Risk olayları, oturumlar ve erişim engelleri.' },
  { id: 'billing', label: 'Ödemeler', group: 'YÖNETİM', icon: ReceiptText, description: 'Wapve+ hareketleri ve ödeme kayıtları.' },
  { id: 'announcements', label: 'Duyurular', group: 'YÖNETİM', icon: Megaphone, description: 'Wapve sistem hesabından duyuru yayınla.' },
  { id: 'settings', label: 'Platform ayarları', group: 'YÖNETİM', icon: Settings2, description: 'Platform genelindeki tercihleri düzenle.' },
  { id: 'operations', label: 'Sistem durumu', group: 'YÖNETİM', icon: Gauge, description: 'Servisler, kaynak kullanımı ve arka plan işleri.' },
  { id: 'audit', label: 'İşlem geçmişi', group: 'YÖNETİM', icon: ShieldAlert, description: 'Yönetim işlemlerinin izini sür.' },
] as const;

export type OwnerSection = (typeof ownerSections)[number]['id'];

export function OwnerNavigation({ section, onSelect, counts }: {
  section: OwnerSection;
  onSelect: (section: OwnerSection) => void;
  counts: Partial<Record<OwnerSection, number>>;
}) {
  const [search, setSearch] = useState('');
  const visible = ownerSections.filter((item) => `${item.label} ${item.description}`.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr')));
  return <nav className="owner-sidebar" id="owner-navigation" aria-label="Yönetim bölümleri">
    <div className="owner-sidebar-brand"><ShieldCheck size={26} /><div><strong>Wapve</strong><small>OWNER STUDIO</small></div></div>
    <label className="owner-nav-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Bölüm bul…" aria-label="Yönetim bölümü ara" /></label>
    {['PLATFORM', 'TOPLULUK', 'GÜVEN VE DESTEK', 'YÖNETİM'].map((group) => {
      const items = visible.filter((item) => item.group === group);
      return items.length > 0 && <div className="owner-nav-group" key={group}><span>{group}</span>{items.map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-current={section === id ? 'page' : undefined} onClick={() => onSelect(id)}><Icon size={18} /><span>{label}</span>{(counts[id] ?? 0) > 0 && <b>{counts[id]}</b>}</button>)}</div>;
    })}
    {visible.length === 0 && <p className="field-hint">Eşleşen bölüm bulunamadı.</p>}
    <a className="owner-back-link" href="/">← Wapve’ye dön</a>
  </nav>;
}
