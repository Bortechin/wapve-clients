'use client';

import './owner-admin-panel.css';
import { OwnerNavigation, ownerSections, type OwnerSection } from './owner-navigation';
import { OwnerOverviewInsights } from './owner-overview-insights';

import type {
  AuthSession,
  ContentReport,
  OwnerAnnouncement,
  OwnerAdminCase,
  OwnerAuditEntry,
  OwnerAuditAction,
  OwnerBadgeCatalogEntry,
  OwnerDashboard,
  OwnerOperations,
  OwnerRiskEvent,
  OwnerBillingEntry,
  OwnerServerInspectResult,
  OwnerAnalytics,
  OwnerIpBlock,
  OwnerPlatformSetting,
  OwnerServer,
  OwnerUser,
  PlatformBadge,
  UserReport,
} from '@wapve/contracts';
import { Button } from '@wapve/ui';
import { Menu, X, Activity, BadgeCheck, BarChart3, BriefcaseBusiness, Database, Flag, Gauge, LockKeyhole, Megaphone, MessageSquare, Network, ReceiptText, RefreshCw, Search, Send, Server, Settings2, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/error-message';
import type { Dictionary } from '@/lib/i18n';

const CONTENT_REPORT_TARGET_LABELS: Record<ContentReport['targetType'], string> = {
  CHANNEL_MESSAGE: 'Kanal mesajı',
  DIRECT_MESSAGE: 'Özel mesaj',
  GROUP_MESSAGE: 'Grup mesajı',
  USER: 'Kullanıcı',
  SERVER: 'Sunucu',
};

const CONTENT_REPORT_REASON_LABELS: Record<ContentReport['reason'], string> = {
  SPAM: 'Spam',
  HARASSMENT: 'Taciz',
  HATE_SPEECH: 'Nefret söylemi',
  SEXUAL_CONTENT: 'Cinsel içerik',
  VIOLENCE: 'Şiddet',
  SCAM_FRAUD: 'Dolandırıcılık',
  ILLEGAL_CONTENT: 'Yasa dışı içerik',
  SELF_HARM: 'Kendine zarar',
  IMPERSONATION: 'Kimliğe bürünme',
  OTHER: 'Diğer',
};

const BADGE_ART: Partial<Record<PlatformBadge, string>> = {
  STAFF: '/brand/badge-staff.png',
  MODERATOR: '/brand/badge-moderator.png',
  DEVELOPER: '/brand/badge-developer.png',
  SUPPORT: '/brand/badge-support.png',
  PARTNER: '/brand/badge-partner.png',
  VERIFIED_CREATOR: '/brand/badge-verified-creator.png',
  EARLY_SUPPORTER: '/brand/badge-early-supporter.png',
  BUG_HUNTER: '/brand/badge-bug-hunter.png',
  COMMUNITY_CHAMPION: '/brand/badge-community-champion.png',
  ALPHA_MEMBER: '/brand/alpha-member-badge.png',
  SYSTEM: '/brand/wapve-system-badge.png',
  PLATFORM_OWNER: '/brand/platform-owner-badge.png',
};

function formText(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

function safeReportPageUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

type OwnerModalField = {
  name: string;
  label: string;
  type?: 'text' | 'password' | 'textarea' | 'select';
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  options?: Array<{ value: string; label: string }>;
};

type OwnerModalConfig = {
  title: string;
  description?: string;
  fields: OwnerModalField[];
  submitLabel?: string;
  danger?: boolean;
  onSubmit: (values: Record<string, string>) => Promise<void> | void;
};

export function OwnerAdminPanel({ messages }: { messages: Dictionary }) {
  const [identity, setIdentity] = useState<'loading' | 'allowed' | 'denied'>('loading');
  const [token, setToken] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [section, setSection] = useState<OwnerSection>('overview');
  const [menuOpen, setMenuOpen] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    setMenuOpen(!window.matchMedia('(max-width: 900px)').matches);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('.owner-modal-backdrop')) {
        setMenuOpen(false);
        document.querySelector<HTMLButtonElement>('.owner-menu-toggle')?.focus();
      }
    };
    window.addEventListener('keydown', closeMenu);
    return () => window.removeEventListener('keydown', closeMenu);
  }, [menuOpen]);
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [users, setUsers] = useState<OwnerUser[]>([]);
  const [servers, setServers] = useState<OwnerServer[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [contentReports, setContentReports] = useState<ContentReport[]>([]);
  const [audit, setAudit] = useState<OwnerAuditAction[]>([]);
  const [auditEvents, setAuditEvents] = useState<OwnerAuditEntry[]>([]);
  const [badgeCatalog, setBadgeCatalog] = useState<OwnerBadgeCatalogEntry[]>([]);
  const [platformSettings, setPlatformSettings] = useState<OwnerPlatformSetting[]>([]);
  const [operations, setOperations] = useState<OwnerOperations | null>(null);
  const [announcements, setAnnouncements] = useState<OwnerAnnouncement[]>([]);
  const [cases, setCases] = useState<OwnerAdminCase[]>([]);
  const [riskEvents, setRiskEvents] = useState<OwnerRiskEvent[]>([]);
  const [billingEntries, setBillingEntries] = useState<OwnerBillingEntry[]>([]);
  const [serverInspect, setServerInspect] = useState<OwnerServerInspectResult | null>(null);
  const [analytics, setAnalytics] = useState<OwnerAnalytics | null>(null);
  const [ipBlocks, setIpBlocks] = useState<OwnerIpBlock[]>([]);
  const [appeals, setAppeals] = useState<Array<{ id: string; caseId: string; userId: string; reason: string; status: string; response: string | null; createdAt: string }>>([]);
  const [staffRole, setStaffRole] = useState<string | null>(null);
  const [inspectingCase, setInspectingCase] = useState<OwnerAdminCase | null>(null);
  const [caseReplyText, setCaseReplyText] = useState('');
  const [caseReplyStatus, setCaseReplyStatus] = useState<OwnerAdminCase['status']>('RESOLVED');
  const [caseReplySendEmail, setCaseReplySendEmail] = useState(true);
  const [caseReplySubmitting, setCaseReplySubmitting] = useState(false);
  const [caseCategoryFilter, setCaseCategoryFilter] = useState<'ALL' | 'SUPPORT' | 'PLATFORM'>('ALL');
  const [caseActionNotice, setCaseActionNotice] = useState<string | null>(null);
  const [syncingEmails, setSyncingEmails] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<OwnerModalConfig | null>(null);
  const [modalValues, setModalValues] = useState<Record<string, string>>({});
  const headers: HeadersInit = { 'X-Wapve-Owner-Access': token };

  function openModal(config: OwnerModalConfig, initialValues: Record<string, string> = {}) {
    setModal(config);
    setModalValues(Object.fromEntries(config.fields.map((field) => [field.name, initialValues[field.name] ?? field.defaultValue ?? ''])));
  }

  async function submitModal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    setBusy(true);
    setError('');
    try {
      await modal.onSubmit(modalValues);
      setModal(null);
      setModalValues({});
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    void apiRequest<AuthSession>('/auth/session')
      .then((session) => {
        if (active) {
          setStaffRole(session.user.platformStaffRole);
          setIdentity(session.user.badges.includes('PLATFORM_OWNER') ? 'allowed' : 'denied');
        }
      })
      .catch(() => {
        if (active) setIdentity('denied');
      });
    return () => {
      active = false;
      setToken('');
    };
  }, []);

  useEffect(() => {
    if (!token || !expiresAt) return;
    const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
    const timeout = window.setTimeout(() => {
      setToken('');
      setExpiresAt('');
      setDashboard(null);
      setUsers([]);
      setReports([]);
      setContentReports([]);
      setAudit([]);
      setAuditEvents([]);
      setBadgeCatalog([]);
      setPlatformSettings([]);
      setOperations(null);
      setAnnouncements([]);
      setCases([]);
      setRiskEvents([]);
      setBillingEntries([]);
      setServerInspect(null);
      setAnalytics(null);
      setIpBlocks([]);
      setAppeals([]);
      setError('Oturum kilitlendi. Yeniden doğrulama gerekli.');
    }, remaining);
    return () => window.clearTimeout(timeout);
  }, [expiresAt, token]);

  const loadConsole = async (accessToken: string) => {
    const accessHeaders: HeadersInit = { 'X-Wapve-Owner-Access': accessToken };
    const [overview, nextUsers, nextReports, nextContentReports, nextAudit, nextAuditEvents, nextServers, nextBadges, nextSettings, nextOperations, nextAnnouncements, nextCases, nextRiskEvents, nextBilling, nextAnalytics, nextIpBlocks, nextAppeals] = await Promise.all([
      apiRequest<OwnerDashboard>('/owner/dashboard', { headers: accessHeaders }),
      apiRequest<OwnerUser[]>('/owner/users?limit=50', { headers: accessHeaders }),
      apiRequest<UserReport[]>('/owner/reports', { headers: accessHeaders }),
      apiRequest<ContentReport[]>('/owner/content-reports', { headers: accessHeaders }),
      apiRequest<OwnerAuditAction[]>('/owner/audit', { headers: accessHeaders }),
      apiRequest<OwnerAuditEntry[]>('/owner/audit/events?limit=200', { headers: accessHeaders }),
      apiRequest<OwnerServer[]>('/owner/servers', { headers: accessHeaders }),
      apiRequest<OwnerBadgeCatalogEntry[]>('/owner/badges', { headers: accessHeaders }),
      apiRequest<OwnerPlatformSetting[]>('/owner/settings', { headers: accessHeaders }),
      apiRequest<OwnerOperations>('/owner/operations', { headers: accessHeaders }),
      apiRequest<OwnerAnnouncement[]>('/owner/announcements', { headers: accessHeaders }),
      apiRequest<OwnerAdminCase[]>('/owner/cases?limit=100', { headers: accessHeaders }),
      apiRequest<OwnerRiskEvent[]>('/owner/risk-events?limit=100', { headers: accessHeaders }),
      apiRequest<OwnerBillingEntry[]>('/owner/billing?limit=100', { headers: accessHeaders }),
      apiRequest<OwnerAnalytics>('/owner/analytics', { headers: accessHeaders }),
      apiRequest<OwnerIpBlock[]>('/owner/ip-blocks', { headers: accessHeaders }),
      apiRequest<Array<{ id: string; caseId: string; userId: string; reason: string; status: string; response: string | null; createdAt: string }>>('/owner/appeals?limit=100', { headers: accessHeaders }),
    ]);
    setDashboard(overview);
    setUsers(nextUsers);
    setReports(nextReports);
    setContentReports(nextContentReports);
    setAudit(nextAudit);
    setAuditEvents(nextAuditEvents);
    setServers(nextServers);
    setBadgeCatalog(nextBadges);
    setPlatformSettings(nextSettings);
    setOperations(nextOperations);
    setAnnouncements(nextAnnouncements);
    setCases(nextCases);
    setRiskEvents(nextRiskEvents);
    setBillingEntries(nextBilling);
    setAnalytics(nextAnalytics);
    setIpBlocks(nextIpBlocks);
    setAppeals(nextAppeals);
  };

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const result = await apiRequest<{ token: string; expiresAt: string }>('/owner/unlock', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: data.get('currentPassword'),
          code: data.get('code'),
        }),
      });
      setToken(result.token);
      setExpiresAt(result.expiresAt);
      await loadConsole(result.token);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function lock() {
    if (!token) return;
    try {
      await apiRequest('/owner/lock', { method: 'POST', headers });
    } catch {
      // Lock locally even if the network is unavailable; the server token will expire.
    }
    setToken('');
    setExpiresAt('');
    setDashboard(null);
    setUsers([]);
    setReports([]);
    setContentReports([]);
    setAudit([]);
    setAuditEvents([]);
    setServers([]);
    setBadgeCatalog([]);
    setPlatformSettings([]);
    setOperations(null);
    setAnnouncements([]);
    setCases([]);
    setRiskEvents([]);
    setBillingEntries([]);
    setServerInspect(null);
    setAnalytics(null);
    setIpBlocks([]);
    setAppeals([]);
    setSection('overview');
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rawQuery = new FormData(event.currentTarget).get('query');
    const query = typeof rawQuery === 'string' ? rawQuery : '';
    try {
      setUsers(
        await apiRequest<OwnerUser[]>(`/owner/users?q=${encodeURIComponent(query)}&limit=100`, {
          headers,
        }),
      );
    } catch (caught) {
      setError(errorMessage(caught, messages));
    }
  }

  function assignStaffRole(user: OwnerUser) {
    if (user.system || user.platformRole === 'OWNER') return;
    openModal({
      title: `${user.displayName} · panel yetkisi`,
      description: 'Rol değişikliği tüm yönetim işlemlerini etkiler ve denetim günlüğüne yazılır.',
      fields: [
        { name: 'role', label: 'Panel rolü', type: 'select', defaultValue: user.platformStaffRole ?? 'NONE', options: [{ value: 'NONE', label: 'Yetki yok' }, { value: 'SUPPORT', label: 'Destek' }, { value: 'MODERATOR', label: 'Moderatör' }, { value: 'SECURITY', label: 'Güvenlik' }, { value: 'BILLING', label: 'Faturalama' }, { value: 'ANALYST', label: 'Analitik' }] },
        { name: 'reason', label: 'Değişiklik gerekçesi', type: 'textarea', required: true, placeholder: 'Örn. vardiya sorumluluğu güncellendi' },
      ],
      submitLabel: 'Yetkiyi kaydet',
      onSubmit: async (values) => {
        const role = values.role;
        const reason = (values.reason ?? '').trim();
        if (reason.length < 3) throw new Error('Gerekçe en az 3 karakter olmalı.');
        const result = await apiRequest<{ role: string | null }>(`/owner/users/${user.id}/staff-role`, { method: 'PATCH', headers, body: JSON.stringify({ role: role === 'NONE' ? null : role, reason }) });
        setUsers((current) => current.map((item) => item.id === user.id ? { ...item, platformStaffRole: result.role as OwnerUser['platformStaffRole'] } : item));
        setError('Panel yetkisi güncellendi.');
      },
    });
  }

  function createCaseFromPrompt() {
    openModal({
      title: 'Yeni vaka dosyası',
      description: 'Bildirim, kanıt, not ve kararları tek bir izlenebilir dosyada topla.',
      fields: [
        { name: 'summary', label: 'Vaka özeti', type: 'textarea', required: true, placeholder: 'Ne oldu, kim etkilendi, hangi aksiyon bekleniyor?' },
        { name: 'category', label: 'Kategori', type: 'select', defaultValue: 'SAFETY', options: [{ value: 'SAFETY', label: 'Güvenlik' }, { value: 'ABUSE', label: 'Kötüye kullanım' }, { value: 'SECURITY', label: 'Hesap güvenliği' }, { value: 'BILLING', label: 'Faturalama' }, { value: 'OTHER', label: 'Diğer' }] },
      ],
      submitLabel: 'Vakayı oluştur',
      onSubmit: async (values) => {
        const summary = (values.summary ?? '').trim();
        if (summary.length < 3) throw new Error('Vaka özeti en az 3 karakter olmalı.');
        const item = await apiRequest<OwnerAdminCase>('/owner/cases', { method: 'POST', headers, body: JSON.stringify({ category: values.category, priority: 'NORMAL', summary }) });
        setCases((current) => [item, ...current]);
        setSection('cases');
      },
    });
  }

  async function updateRisk(id: string, status: OwnerRiskEvent['status']) {
    try {
      await apiRequest(`/owner/risk-events/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ status }) });
      setRiskEvents((current) => current.map((item) => item.id === id ? { ...item, status, reviewedAt: new Date().toISOString() } : item));
    } catch (caught) {
      setError(errorMessage(caught, messages));
    }
  }

  function blockRiskIp(item: OwnerRiskEvent) {
    if (!item.ipHash) return;
    openModal({
      title: 'IP adresini engelle',
      description: 'Kayıtlar hashlenmiş tutulur. Varsayılan süre 24 saattir.',
      fields: [{ name: 'reason', label: 'Engelleme gerekçesi', type: 'textarea', required: true, placeholder: 'Örn. tekrarlayan oturum denemeleri' }],
      submitLabel: '24 saat engelle',
      danger: true,
      onSubmit: async (values) => {
        const reason = (values.reason ?? '').trim();
        if (reason.length < 3) throw new Error('Gerekçe en az 3 karakter olmalı.');
        const block = await apiRequest<OwnerIpBlock>('/owner/ip-blocks', { method: 'POST', headers, body: JSON.stringify({ ipHash: item.ipHash, reason, durationMinutes: 1440 }) });
        setIpBlocks((current) => [block, ...current.filter((row) => row.ipHash !== block.ipHash)]);
      },
    });
  }

  async function revokeIpBlock(block: OwnerIpBlock) {
    try {
      await apiRequest(`/owner/ip-blocks/${block.id}/revoke`, { method: 'POST', headers });
      setIpBlocks((current) => current.map((row) => row.id === block.id ? { ...row, revokedAt: new Date().toISOString() } : row));
    } catch (caught) { setError(errorMessage(caught, messages)); }
  }

  function quarantineRiskSession(item: OwnerRiskEvent) {
    if (!item.userId || !item.sessionId) return;
    openModal({
      title: 'Cihazı karantinaya al',
      description: 'Oturum sonlandırılır ve aynı cihazdan gelen yeni erişimler risk olarak işaretlenir.',
      fields: [{ name: 'reason', label: 'Karantina gerekçesi', type: 'textarea', required: true, placeholder: 'Örn. şüpheli yeni cihaz' }],
      submitLabel: 'Karantinaya al',
      danger: true,
      onSubmit: async (values) => {
        const reason = (values.reason ?? '').trim();
        if (reason.length < 3) throw new Error('Gerekçe en az 3 karakter olmalı.');
        await apiRequest(`/owner/users/${item.userId}/sessions/${item.sessionId}/quarantine`, { method: 'POST', headers, body: JSON.stringify({ reason }) });
        setRiskEvents((current) => current.map((row) => row.id === item.id ? { ...row, status: 'RESOLVED' } : row));
      },
    });
  }

  async function inspectServerDetails(serverId: string) {
    try {
      setServerInspect(await apiRequest<OwnerServerInspectResult>(`/owner/servers/${serverId}/inspect?messageLimit=100`, { headers }));
    } catch (caught) {
      setError(errorMessage(caught, messages));
    }
  }

  function action(
    userId: string,
    name: 'ban' | 'unban' | 'mute' | 'unmute' | 'revoke-sessions',
  ) {
    const needsReason = name === 'ban' || name === 'mute';
    const run = async (reason = '', durationMinutes: number | null = null) => {
      await apiRequest(`/owner/users/${userId}/${name}`, { method: 'POST', headers, ...(needsReason ? { body: JSON.stringify({ reason, durationMinutes }) } : {}) });
      setUsers((current) =>
        current.map((user) =>
          user.id === userId
            ? {
                ...user,
                ...(name === 'ban' ? { accountStatus: 'SUSPENDED' as const } : {}),
                ...(name === 'unban' ? { accountStatus: 'ACTIVE' as const } : {}),
                ...(name === 'mute' ? { muted: true, muteReason: reason ?? null } : {}),
                ...(name === 'unmute'
                  ? { muted: false, muteReason: null, muteExpiresAt: null }
                  : {}),
              }
            : user,
        ),
      );
    };
    if (!needsReason) {
      void run().catch((caught) => setError(errorMessage(caught, messages)));
      return;
    }
    openModal({ title: name === 'ban' ? 'Hesabı askıya al' : 'İletişimi kısıtla', description: 'İşlem kullanıcıya sistem kartı ile bildirilir ve denetim günlüğüne yazılır.', fields: [{ name: 'reason', label: 'İşlem gerekçesi', type: 'textarea', required: true }, ...(name === 'mute' ? [{ name: 'duration', label: 'Süre', type: 'select' as const, defaultValue: '0', options: [{ value: '0', label: 'Süresiz' }, { value: '60', label: '1 saat' }, { value: '1440', label: '24 saat' }, { value: '10080', label: '7 gün' }] }] : [])], submitLabel: name === 'ban' ? 'Hesabı askıya al' : 'Kısıtlamayı uygula', danger: true, onSubmit: async (values) => { const reason = (values.reason ?? '').trim(); if (reason.length < 3) throw new Error('Gerekçe en az 3 karakter olmalı.'); const duration = Number(values.duration ?? 0); await run(reason, name === 'mute' && duration > 0 ? duration : null); } });
  }

  function editUserIdentity(user: OwnerUser, field: 'username' | 'email') {
    const isUsername = field === 'username';
    openModal({ title: `${user.displayName} · ${isUsername ? 'kullanıcı adı' : 'e-posta'} düzenle`, description: 'Değişiklik anında profile uygulanır ve denetim günlüğüne yazılır.', fields: [{ name: 'value', label: isUsername ? 'Yeni kullanıcı adı' : 'Yeni e-posta', required: true, defaultValue: isUsername ? user.username : user.email }], submitLabel: 'Değişikliği kaydet', onSubmit: async (values) => { const value = (values.value ?? '').trim(); if (!value) throw new Error('Yeni değer zorunlu.'); await apiRequest(`/owner/users/${user.id}`, { method: 'PATCH', headers, body: JSON.stringify({ [field]: isUsername ? value.toLowerCase() : value }) }); setUsers((current) => current.map((item) => item.id === user.id ? { ...item, [field]: isUsername ? value.toLowerCase() : value } : item)); } });
  }

  function resetUserPassword(user: OwnerUser) {
    openModal({ title: `${user.displayName} · parola sıfırla`, description: 'Yeni parola uygulanır ve kullanıcının mevcut oturumları kapatılır.', fields: [{ name: 'password', label: 'Geçici parola', type: 'password', required: true }, { name: 'reason', label: 'Sıfırlama gerekçesi', type: 'textarea', required: true }], submitLabel: 'Parolayı sıfırla', danger: true, onSubmit: async (values) => { const newPassword = values.password ?? ''; const reason = (values.reason ?? '').trim(); if (!newPassword || reason.length < 3) throw new Error('Geçici parola ve gerekçe zorunlu.'); await apiRequest(`/owner/users/${user.id}/reset-password`, { method: 'POST', headers, body: JSON.stringify({ newPassword, reason }) }); setError('Parola sıfırlandı ve eski oturumlar kapatıldı.'); } });
  }

  function restoreUser(user: OwnerUser) {
    openModal({ title: `${user.displayName} · hesabı geri al`, description: 'Hesap yeniden etkinleştirilir; yaptırım geçmişi korunur.', fields: [{ name: 'reason', label: 'Geri alma gerekçesi', type: 'textarea', required: true }], submitLabel: 'Hesabı geri al', onSubmit: async (values) => { const reason = (values.reason ?? '').trim(); if (reason.length < 3) throw new Error('Gerekçe en az 3 karakter olmalı.'); await apiRequest(`/owner/users/${user.id}/restore`, { method: 'POST', headers, body: JSON.stringify({ reason }) }); setUsers((current) => current.map((item) => item.id === user.id ? { ...item, accountStatus: 'ACTIVE' as const } : item)); } });
  }

  function deleteUser(user: OwnerUser) {
    openModal({ title: `${user.displayName} · hesabı çöp kutusuna taşı`, description: 'Hesap geri alınabilir şekilde silinir; oturumları kapatılır ve içerik erişimi durdurulur.', fields: [{ name: 'reason', label: 'Silme gerekçesi', type: 'textarea', required: true }, { name: 'confirmation', label: 'Onay', required: true, placeholder: 'DELETE yaz' }], submitLabel: 'Çöp kutusuna taşı', danger: true, onSubmit: async (values) => { const reason = (values.reason ?? '').trim(); if ((values.confirmation ?? '').trim() !== 'DELETE' || reason.length < 3) throw new Error('Gerekçe ve DELETE onayı gerekli.'); await apiRequest(`/owner/users/${user.id}/delete`, { method: 'POST', headers, body: JSON.stringify({ reason, confirmation: 'DELETE' }) }); setUsers((current) => current.map((item) => item.id === user.id ? { ...item, accountStatus: 'DELETED' as const } : item)); } });
  }

  async function toggleAlphaBadge(user: OwnerUser) {
    try {
      await apiRequest(`/owner/users/${user.id}/alpha-badge`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ enabled: !user.alphaMember }),
      });
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, alphaMember: !user.alphaMember } : item));
      setError('Rozet işlemi kaydedildi. Profil verisi yenilendiğinde görünür.');
    } catch (caught) {
      setError(errorMessage(caught, messages));
    }
  }

  async function grantWapvePlus(user: OwnerUser, days: number) {
    try {
      const result = await apiRequest<{ active: boolean; expiresAt: string | null }>(`/owner/users/${user.id}/wapve-plus`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ days }),
      });
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, wapvePlusActive: result.active, wapvePlusUntil: result.expiresAt } : item));
      setError(days === 0 ? 'Wapve+ erişimi kaldırıldı.' : `${days} günlük Wapve+ tanımlandı.`);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    }
  }

  function editSupportSlots(user: OwnerUser) {
    openModal({
      title: `${user.displayName} · boost yuvaları`,
      description: 'Bu kota kullanıcının aynı anda kaç sunucuya destek verebileceğini belirler. Değişiklik audit günlüğüne yazılır.',
      fields: [
        {
          name: 'slots',
          label: 'Boost yuvası',
          type: 'select',
          defaultValue: String(user.supportSlots),
          options: [2, 3, 4, 5, 6, 8, 10].map((value) => ({ value: String(value), label: `${value} yuva` })),
        },
        {
          name: 'reason',
          label: 'Değişiklik gerekçesi',
          type: 'textarea',
          required: true,
          placeholder: 'Örn. test hesabı için ek boost yuvası',
        },
      ],
      submitLabel: 'Boost hakkını kaydet',
      onSubmit: async (values) => {
        const slots = Number(values.slots);
        const reason = (values.reason ?? '').trim();
        if (![2, 3, 4, 5, 6, 8, 10].includes(slots) || reason.length < 3) {
          throw new Error('Geçerli bir yuva sayısı ve en az 3 karakterlik gerekçe gerekli.');
        }
        const result = await apiRequest<{ id: string; supportSlots: number }>(`/owner/users/${user.id}/support-slots`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ slots, reason }),
        });
        setUsers((current) => current.map((item) => item.id === user.id ? { ...item, supportSlots: result.supportSlots } : item));
        setError(`${result.supportSlots} boost yuvası tanımlandı.`);
      },
    });
  }

  async function toggleBadge(user: OwnerUser, badge: PlatformBadge) {
    if (badge === 'PLATFORM_OWNER' || badge === 'ALPHA_MEMBER' || badge === 'SYSTEM') return;
    const enabled = !user.badges.includes(badge);
    try {
      await apiRequest(`/owner/users/${user.id}/badges`, { method: 'POST', headers, body: JSON.stringify({ badge, enabled }) });
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, badges: enabled ? [...new Set([...item.badges, badge])] : item.badges.filter((itemBadge) => itemBadge !== badge) } : item));
      setError(`${badgeCatalog.find((item) => item.code === badge)?.name ?? badge} işlemi kaydedildi.`);
    } catch (caught) {
      setError(errorMessage(caught, messages));
    }
  }

  function sendSystemDm(user: OwnerUser) {
    openModal({
      title: `@${user.username} · Wapve sistem DM’i`,
      description: 'Mesaj, Wapve sistem hesabının doğrulanmış kart tasarımıyla gönderilir. Kullanıcı yanıtlayamaz.',
      fields: [
        { name: 'title', label: 'Kart başlığı', required: true, placeholder: 'Örn. Güvenlik kontrolü tamamlandı' },
        { name: 'severity', label: 'Önem düzeyi', type: 'select', defaultValue: 'INFO', options: [{ value: 'INFO', label: 'Bilgi' }, { value: 'SUCCESS', label: 'Olumlu' }, { value: 'WARNING', label: 'Uyarı' }, { value: 'CRITICAL', label: 'Kritik' }] },
        { name: 'body', label: 'Mesaj', type: 'textarea', required: true, placeholder: 'Kullanıcıya gösterilecek açıklama…' },
      ],
      submitLabel: 'Sistem DM’ini gönder',
      onSubmit: async (values) => {
        const title = (values.title ?? '').trim();
        const body = (values.body ?? '').trim();
        if (title.length < 3 || !body) throw new Error('Başlık ve mesaj zorunlu.');
        await apiRequest(`/owner/users/${user.id}/system-message`, { method: 'POST', headers, body: JSON.stringify({ title, body, severity: values.severity }) });
        setError('Sistem mesajı gönderildi ve DM listesi güncellendi.');
      },
    });
  }

  function removeProfileAsset(user: OwnerUser, asset: 'AVATAR' | 'BANNER') {
    const label = asset === 'AVATAR' ? 'avatar' : 'profil afişi';
    openModal({
      title: `${user.displayName} · ${label} kaldır`,
      description: 'Bu işlem yalnızca seçilen görseli kaldırır; dosya bağlantısı ve profil metinleri korunur.',
      fields: [{ name: 'reason', label: 'İşlem gerekçesi', type: 'textarea', required: true, placeholder: 'Örn. topluluk kurallarına aykırı görsel' }],
      submitLabel: `${label[0]!.toUpperCase()}${label.slice(1)} kaldır`,
      danger: true,
      onSubmit: async (values) => {
        const reason = (values.reason ?? '').trim();
        if (reason.length < 3) throw new Error('Gerekçe en az 3 karakter olmalı.');
        await apiRequest(`/owner/users/${user.id}/profile-asset/remove`, { method: 'POST', headers, body: JSON.stringify({ asset, reason }) });
        setUsers((current) => current.map((item) => item.id === user.id ? { ...item, ...(asset === 'AVATAR' ? { avatarPresent: false } : { bannerPresent: false }) } : item));
        setError(`${label[0]!.toUpperCase()}${label.slice(1)} kaldırıldı.`);
      },
    });
  }

  function extractCaseEmail(c: OwnerAdminCase): string | null {
    for (const note of c.notes) {
      const match = note.body.match(/Gönderen E-posta:\s*([^\s\n]+)/i);
      if (match?.[1]) return match[1];
    }
    return null;
  }

  function openCaseInspector(item: OwnerAdminCase) {
    setInspectingCase(item);
    setCaseReplyText('');
    setCaseReplyStatus(item.status === 'RESOLVED' ? 'RESOLVED' : 'RESOLVED');
    setCaseReplySendEmail(Boolean(extractCaseEmail(item)));
    setCaseActionNotice(null);
  }

  async function submitCaseReply() {
    if (!inspectingCase || !caseReplyText.trim()) return;
    setCaseReplySubmitting(true);
    setCaseActionNotice(null);
    try {
      const updated = await apiRequest<OwnerAdminCase>(`/owner/cases/${inspectingCase.id}/reply`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          body: caseReplyText.trim(),
          sendEmail: caseReplySendEmail,
          status: caseReplyStatus,
        }),
      });
      setCases((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      setInspectingCase(updated);
      setCaseReplyText('');
      setCaseActionNotice(
        caseReplySendEmail
          ? 'Yanıt kaydedildi ve kullanıcıya support@wapve.com üzerinden e-posta iletildi.'
          : 'Yetkili notu vaka geçmişine kaydedildi.',
      );
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setCaseReplySubmitting(false);
    }
  }

  async function syncEmails() {
    setSyncingEmails(true);
    setCaseActionNotice(null);
    try {
      const res = await apiRequest<{ checked: number; imported: number; tickets: string[] }>(
        '/owner/cases/sync-emails',
        { method: 'POST', headers },
      );
      const updatedCases = await apiRequest<OwnerAdminCase[]>('/owner/cases', { headers });
      setCases(updatedCases);
      if (inspectingCase) {
        const found = updatedCases.find((c) => c.id === inspectingCase.id);
        if (found) setInspectingCase(found);
      }
      if (res.imported > 0) {
        setCaseActionNotice(
          `${res.imported} yeni e-posta yanıtı sisteme işlendi (${res.tickets.join(', ')}).`,
        );
      } else {
        setCaseActionNotice('Gelen kutusu kontrol edildi, işlenecek yeni yanıt bulunamadı.');
      }
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setSyncingEmails(false);
    }
  }

  function addCaseNote(item: OwnerAdminCase) {
    openModal({ title: `${item.caseNumber} · not ekle`, description: 'Notlar vaka dosyasındaki tüm yetkililer tarafından görülebilir ve değiştirilemez geçmişe eklenir.', fields: [{ name: 'body', label: 'Vaka notu', type: 'textarea', required: true, placeholder: 'İnceleme bulgusu, karar gerekçesi veya takip adımı…' }], submitLabel: 'Notu ekle', onSubmit: async (values) => {
      const body = (values.body ?? '').trim();
      if (!body) throw new Error('Not boş bırakılamaz.');
      const note = await apiRequest<{ id: string; body: string; authorId: string; createdAt: string }>(`/owner/cases/${item.id}/notes`, { method: 'POST', headers, body: JSON.stringify({ body }) });
      setCases((current) => current.map((row) => row.id === item.id ? { ...row, notes: [...row.notes, note] } : row));
    } });
  }

  function addCaseEvidence(item: OwnerAdminCase) {
    openModal({ title: `${item.caseNumber} · kanıt ekle`, description: 'Harici kanıt bağlantısı vaka erişim politikalarına göre kaydedilir.', fields: [{ name: 'originalName', label: 'Kanıt adı', required: true, defaultValue: 'kanıt-linki' }, { name: 'externalUrl', label: 'Kanıt URL’si', required: true, placeholder: 'https://…' }], submitLabel: 'Kanıtı kaydet', onSubmit: async (values) => {
      const originalName = (values.originalName ?? '').trim();
      const externalUrl = (values.externalUrl ?? '').trim();
      if (!originalName || !/^https?:\/\//iu.test(externalUrl)) throw new Error('Geçerli bir http(s) URL gir.');
      await apiRequest(`/owner/cases/${item.id}/evidence`, { method: 'POST', headers, body: JSON.stringify({ originalName, contentType: 'text/uri-list', size: 0, externalUrl }) });
      setCases((current) => current.map((row) => row.id === item.id ? { ...row, evidence: [...row.evidence, { id: crypto.randomUUID(), originalName, contentType: 'text/uri-list', size: 0, storageKey: null, externalUrl, description: null, createdAt: new Date().toISOString() }] } : row));
    } });
  }

  function decideAppeal(appeal: { id: string; status: string }, status: 'ACCEPTED' | 'REJECTED') {
    openModal({ title: status === 'ACCEPTED' ? 'İtirazı kabul et' : 'İtirazı reddet', description: 'Karar gerekçesi kullanıcıya gösterilir ve vaka geçmişine işlenir.', fields: [{ name: 'response', label: 'Karar gerekçesi', type: 'textarea', required: true, placeholder: 'Kararın dayanağını açıkla…' }], submitLabel: status === 'ACCEPTED' ? 'Kabul et' : 'Reddet', danger: status === 'REJECTED', onSubmit: async (values) => {
      const response = (values.response ?? '').trim();
      if (response.length < 3) throw new Error('Gerekçe en az 3 karakter olmalı.');
      await apiRequest(`/owner/appeals/${appeal.id}`, { method: 'PATCH', headers, body: JSON.stringify({ status, response }) });
      setAppeals((current) => current.map((row) => row.id === appeal.id ? { ...row, status, response } : row));
    } });
  }

  function refundBilling(item: OwnerBillingEntry) {
    openModal({ title: 'Ödeme iadesi oluştur', description: 'İade kaydı denetim günlüğüne eklenir; ödeme sağlayıcısındaki gerçek iade ayrıca doğrulanmalıdır.', fields: [{ name: 'reason', label: 'İade gerekçesi', type: 'textarea', required: true }, { name: 'confirmation', label: 'Onay', required: true, placeholder: 'REFUND yaz' }], submitLabel: 'İade kaydı oluştur', danger: true, onSubmit: async (values) => {
      const reason = (values.reason ?? '').trim();
      if ((values.confirmation ?? '').trim() !== 'REFUND' || reason.length < 3) throw new Error('Gerekçe ve REFUND onayı gerekli.');
      await apiRequest(`/owner/billing/${item.id}/refund`, { method: 'POST', headers, body: JSON.stringify({ reason, confirmation: 'REFUND' }) });
      setBillingEntries((current) => current.map((row) => row.id === item.id ? { ...row, status: 'REFUNDED' } : row));
    } });
  }

  async function toggleServerFlag(server: OwnerServer, key: 'discoveryEnabled' | 'platformFeatured' | 'platformVerified') {
    const value = !server[key];
    try {
      await apiRequest(`/owner/servers/${server.id}`, { method: 'PATCH', headers, body: JSON.stringify({ [key]: value }) });
      setServers((current) => current.map((item) => item.id === server.id ? { ...item, [key]: value } : item));
    } catch (caught) {
      setError(errorMessage(caught, messages));
    }
  }

  function toggleServerSuspension(server: OwnerServer) {
    const suspended = !server.platformSuspendedAt;
    const run = async (reason: string | null) => {
      const result = await apiRequest<{ suspendedAt: string | null; reason: string | null }>(`/owner/servers/${server.id}/suspension`, { method: 'POST', headers, body: JSON.stringify({ suspended, reason }) });
      setServers((current) => current.map((item) => item.id === server.id ? { ...item, platformSuspendedAt: result.suspendedAt, platformSuspensionReason: result.reason, ...(suspended ? { discoveryEnabled: false, platformFeatured: false } : {}) } : item));
    };
    if (!suspended) {
      void run(null).catch((caught) => setError(errorMessage(caught, messages)));
      return;
    }
    openModal({ title: `${server.name} · askıya al`, description: 'Sunucu keşiften çıkarılır ve yeni etkileşimlere kapatılır.', fields: [{ name: 'reason', label: 'Askıya alma gerekçesi', type: 'textarea', required: true }], submitLabel: 'Sunucuyu askıya al', danger: true, onSubmit: async (values) => { const reason = (values.reason ?? '').trim(); if (reason.length < 3) throw new Error('Gerekçe en az 3 karakter olmalı.'); await run(reason); } });
  }

  function transferServer(server: OwnerServer) {
    openModal({ title: `${server.name} · sahipliği devret`, description: 'Bu işlem sunucu sahibini kalıcı olarak değiştirir ve denetim günlüğüne yazılır.', fields: [{ name: 'newOwnerId', label: 'Yeni sahip UUID', required: true }, { name: 'reason', label: 'Devir gerekçesi', type: 'textarea', required: true }], submitLabel: 'Sahipliği devret', danger: true, onSubmit: async (values) => { const newOwnerId = (values.newOwnerId ?? '').trim(); const reason = (values.reason ?? '').trim(); if (!newOwnerId || reason.length < 3) throw new Error('Yeni sahip ve gerekçe zorunlu.'); await apiRequest(`/owner/servers/${server.id}/transfer`, { method: 'POST', headers, body: JSON.stringify({ newOwnerId, reason }) }); setServers(await apiRequest<OwnerServer[]>('/owner/servers', { headers })); setError('Sunucu sahipliği devredildi.'); } });
  }

  function updatePlatformSetting(setting: OwnerPlatformSetting) {
    openModal({ title: `${setting.key} · ayarı güncelle`, description: setting.description, fields: [...(typeof setting.value === 'number' ? [{ name: 'value', label: 'Yeni değer', required: true, defaultValue: String(setting.value) }] : []), { name: 'reason', label: 'Değişiklik gerekçesi', type: 'textarea' as const, required: true }], submitLabel: 'Ayarı kaydet', onSubmit: async (values) => { const next = typeof setting.value === 'boolean' ? !setting.value : Number(values.value); const reason = (values.reason ?? '').trim(); if (!Number.isFinite(typeof next === 'number' ? next : 0) || reason.length < 3) throw new Error('Geçerli değer ve gerekçe gir.'); await apiRequest(`/owner/settings/${encodeURIComponent(setting.key)}`, { method: 'PATCH', headers, body: JSON.stringify({ value: next, reason }) }); setPlatformSettings((current) => current.map((item) => item.key === setting.key ? { ...item, value: next, updatedAt: new Date().toISOString() } : item)); } });
  }

  async function sendAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const audience = formText(data, 'audience') as 'ALL' | 'ACTIVE' | 'ALPHA' | 'SELECTED';
    const title = formText(data, 'title').trim();
    const body = formText(data, 'body').trim();
    const severity = formText(data, 'severity') as 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
    const targetUserIds = audience === 'SELECTED' ? formText(data, 'targetUserIds').split(/[\s,]+/u).map((item) => item.trim()).filter(Boolean) : [];
    setBusy(true);
    try {
      await apiRequest('/owner/announcements', { method: 'POST', headers, body: JSON.stringify({ title, body, severity, audience, targetUserIds, confirmation: 'SEND' }) });
      setAnnouncements(await apiRequest<OwnerAnnouncement[]>('/owner/announcements', { headers }));
      form.reset();
      setError('Duyuru kampanyası tamamlandı. Teslim sayıları aşağıdaki geçmişte görünüyor.');
    } catch (caught) {
      setError(errorMessage(caught, messages));
    } finally {
      setBusy(false);
    }
  }

  async function refreshOperations() {
    try {
      setOperations(await apiRequest<OwnerOperations>('/owner/operations', { headers }));
    } catch (caught) {
      setError(errorMessage(caught, messages));
    }
  }

  function editServer(server: OwnerServer) {
    openModal({ title: `${server.name} · sunucuyu düzenle`, description: 'Platform yöneticisi olarak sunucunun görünen adını değiştirebilirsin.', fields: [{ name: 'name', label: 'Sunucu adı', required: true, defaultValue: server.name }], submitLabel: 'Sunucuyu kaydet', onSubmit: async (values) => { const name = (values.name ?? '').trim(); if (!name || name === server.name) return; await apiRequest(`/owner/servers/${server.id}`, { method: 'PATCH', headers, body: JSON.stringify({ name }) }); setServers((current) => current.map((item) => item.id === server.id ? { ...item, name } : item)); } });
  }

  function deleteServer(server: OwnerServer) {
    if (server.deletedAt) {
      void apiRequest(`/owner/servers/${server.id}/restore`, { method: 'POST', headers }).then(() => setServers((current) => current.map((item) => item.id === server.id ? { ...item, deletedAt: null, deletionScheduledFor: null } : item))).catch((caught) => setError(errorMessage(caught, messages)));
      return;
    }
    openModal({ title: `${server.name} · çöp kutusuna taşı`, description: 'Sunucu 30 gün boyunca geri alınabilir; bu sürede keşif ve öne çıkarma kapanır.', fields: [{ name: 'reason', label: 'Silme gerekçesi', type: 'textarea', required: true }, { name: 'confirmation', label: 'Onay', required: true, placeholder: 'DELETE yaz' }], submitLabel: 'Çöp kutusuna taşı', danger: true, onSubmit: async (values) => { const reason = (values.reason ?? '').trim(); if ((values.confirmation ?? '').trim() !== 'DELETE' || reason.length < 3) throw new Error('Gerekçe ve DELETE onayı gerekli.'); const result = await apiRequest<{ deletionScheduledFor: string }>(`/owner/servers/${server.id}`, { method: 'DELETE', headers, body: JSON.stringify({ reason, confirmation: 'DELETE' }) }); setServers((current) => current.map((item) => item.id === server.id ? { ...item, deletedAt: new Date().toISOString(), deletionScheduledFor: result.deletionScheduledFor, discoveryEnabled: false, platformFeatured: false } : item)); } });
  }

  async function updateContentReport(id: string, status: 'RESOLVED' | 'DISMISSED') {
    try {
      await apiRequest(`/owner/content-reports/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status }),
      });
      setContentReports((current) =>
        current.map((item) => (item.id === id ? { ...item, status } : item)),
      );
    } catch (caught) {
      setError(errorMessage(caught, messages));
    }
  }

  function removeContentReportTarget(report: ContentReport) {
    openModal({ title: 'Bildirilen içeriği kaldır', description: 'İçerik kullanıcı arayüzünden kaldırılır ve bildirim kaydı denetim geçmişinde tutulur.', fields: [{ name: 'reason', label: 'Kaldırma gerekçesi', type: 'textarea', required: true }], submitLabel: 'İçeriği kaldır', danger: true, onSubmit: async (values) => { if ((values.reason ?? '').trim().length < 3) throw new Error('Gerekçe en az 3 karakter olmalı.'); await apiRequest(`/owner/content-reports/${report.id}/remove-target`, { method: 'POST', headers }); setContentReports((current) => current.map((item) => item.id === report.id ? { ...item, targetRemoved: true } : item)); } });
  }

  async function resolveUserReport(id: string) {
    try {
      await apiRequest(`/owner/reports/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'RESOLVED' }),
      });
      setReports((current) =>
        current.map((item) => (item.id === id ? { ...item, status: 'RESOLVED' } : item)),
      );
    } catch (caught) {
      setError(errorMessage(caught, messages));
    }
  }

  const openReportCount = useMemo(
    () =>
      reports.filter((report) => report.status === 'OPEN' || report.status === 'IN_REVIEW').length +
      contentReports.filter((report) => report.status === 'OPEN' || report.status === 'IN_REVIEW')
        .length,
    [contentReports, reports],
  );

  if (identity === 'loading')
    return <div className="owner-console-loading">Güvenli sahip oturumu doğrulanıyor…</div>;

  if (identity === 'denied')
    return (
      <section className="owner-console-denied">
        <LockKeyhole size={28} />
        <div>
          <strong>Erişim reddedildi</strong>
          <p>Bu kontrol merkezi yalnızca doğrulanmış platform sahibi hesabına açıktır.</p>
        </div>
      </section>
    );

  if (!token)
    return (
      <form className="owner-console-unlock" onSubmit={(event) => void unlock(event)}>
        <div className="owner-console-kicker">
          <LockKeyhole size={17} /> SAHİP ERİŞİMİ
        </div>
        <h1>Güvenli kontrol merkezini aç</h1>
        <p>
          Yönetim işlemleri ayarlardan ayrıldı. Devam etmek için hesap şifreni ve güncel iki aşamalı
          doğrulama kodunu gir. Erişim yalnızca 10 dakika bellekte tutulur.
        </p>
        {error && <div className="form-error">{error}</div>}
        <div className="owner-console-unlock-fields">
          <label className="field">
            <span>Mevcut şifre</span>
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <label className="field">
            <span>2FA kodu</span>
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              minLength={6}
              required
            />
          </label>
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? 'Doğrulanıyor…' : 'Güvenli erişimi aç'}
        </Button>
      </form>
    );

  return (
    <div className="owner-console">
      <header className="owner-console-header">
        <button type="button" className="owner-menu-toggle" aria-label={menuOpen ? 'Menüyü kapat' : 'Menüyü aç'} aria-expanded={menuOpen} aria-controls="owner-navigation" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
        <div>
          <div className="owner-console-kicker">
            <LockKeyhole size={17} /> {staffRole ? `${staffRole} KONTROL MERKEZİ` : 'SAHİP KONTROL MERKEZİ'}
          </div>
          <h1>Wapve yönetim merkezi</h1>
          <p>Kullanıcıları, toplulukları, güvenlik vakalarını ve platform sağlığını tek bir akışta yönet.</p>
        </div>
        <div className="owner-console-header-actions">
          <Button type="button" variant="secondary" disabled={refreshing || busy} onClick={() => { void (async () => { setRefreshing(true); setError(''); try { await loadConsole(token); } catch (caught) { setError(errorMessage(caught, messages)); } finally { setRefreshing(false); } })(); }}><RefreshCw size={16} />{refreshing ? 'Yenileniyor…' : 'Yenile'}</Button>
          <span className="owner-console-session">
            <LockKeyhole size={15} /> Kilitlenme: {new Date(expiresAt).toLocaleTimeString('tr', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <Button type="button" variant="secondary" onClick={() => void lock()}>
            <LockKeyhole size={16} /> Kilitle
          </Button>
        </div>
      </header>
      <div className={`owner-workspace ${menuOpen ? 'menu-open' : 'menu-closed'}`}>
        {menuOpen && <OwnerNavigation section={section} onSelect={(next) => {
          setSection(next);
          if (window.matchMedia('(max-width: 900px)').matches) setMenuOpen(false);
        }} counts={{ reports: openReportCount, cases: cases.filter((item) => item.status === 'OPEN' || item.status === 'IN_REVIEW').length, security: riskEvents.filter((item) => item.status === 'OPEN').length, appeals: appeals.filter((item) => item.status === 'OPEN' || item.status === 'IN_REVIEW').length }} />}
        <div className="owner-workspace-content" id="owner-content">
          <div className="owner-page-heading"><div><span className="owner-console-kicker">YÖNETİM / {ownerSections.find((item) => item.id === section)?.group}</span><h2>{ownerSections.find((item) => item.id === section)?.label}</h2><p>{ownerSections.find((item) => item.id === section)?.description}</p></div><small>Son yenileme<br />{dashboard ? new Date(dashboard.generatedAt).toLocaleTimeString('tr') : '—'}</small></div>
      {error && <div className="form-error">{error}</div>}
      {section === 'overview' && (
        <section className="owner-console-overview">
          <div className="owner-console-stats">
            <article>
              <span>Toplam kullanıcı</span>
              <strong>{dashboard?.users.total ?? '—'}</strong>
              <small>{dashboard?.users.newLast24Hours ?? 0} son 24 saatte yeni</small>
            </article>
            <article>
              <span>Aktif oturum</span>
              <strong>{dashboard?.sessions.active ?? '—'}</strong>
              <small>Şu an geçerli oturumlar</small>
            </article>
            <article>
              <span>Topluluk sunucusu</span>
              <strong>{dashboard?.servers.total ?? '—'}</strong>
              <small>{dashboard?.servers.newLast24Hours ?? 0} son 24 saatte yeni</small>
            </article>
            <article className={openReportCount > 0 ? 'attention' : ''}>
              <span>Açık bildirim</span>
              <strong>{openReportCount}</strong>
              <small>
                {dashboard?.reports.openUser ?? 0} kullanıcı · {dashboard?.reports.openContent ?? 0}{' '}
                içerik
              </small>
            </article>
          </div>
          <OwnerOverviewInsights analytics={analytics} operations={operations} reports={openReportCount} cases={cases} risks={riskEvents} onSelect={setSection} />
          <div className="owner-console-overview-grid">
            <section className="owner-console-card">
              <h2>
                <Users size={18} /> Kullanıcı durumu
              </h2>
              <dl>
                <div>
                  <dt>Aktif</dt>
                  <dd>{dashboard?.users.active ?? '—'}</dd>
                </div>
                <div>
                  <dt>Askıya alınan</dt>
                  <dd>{dashboard?.users.suspended ?? '—'}</dd>
                </div>
                <div>
                  <dt>Platform mute</dt>
                  <dd>{dashboard?.users.muted ?? '—'}</dd>
                </div>
                <div>
                  <dt>Silinmiş</dt>
                  <dd>{dashboard?.users.deleted ?? '—'}</dd>
                </div>
              </dl>
            </section>
            <section className="owner-console-card">
              <h2>
                <ShieldAlert size={18} /> Güvenlik özeti
              </h2>
              <p>
                Her işlem sahip kimliği, mevcut oturum ve istek kimliğiyle denetlenir. Yönetim
                tokenı tarayıcı depolamasına yazılmaz ve kilitleme ile anında iptal edilir.
              </p>
              <small>
                Son veri yenileme:{' '}
                {dashboard ? new Date(dashboard.generatedAt).toLocaleString('tr') : 'yükleniyor'}
              </small>
            </section>
            <section className="owner-console-card">
              <h2><Activity size={18} /> Platform etkinliği</h2>
              <dl>
                <div><dt>Kanal mesajı</dt><dd>{dashboard?.activity.channelMessages ?? '—'}</dd></div>
                <div><dt>Özel mesaj</dt><dd>{dashboard?.activity.directMessages ?? '—'}</dd></div>
                <div><dt>Grup mesajı</dt><dd>{dashboard?.activity.groupMessages ?? '—'}</dd></div>
                <div><dt>Bildirim</dt><dd>{dashboard?.activity.notifications ?? '—'}</dd></div>
              </dl>
            </section>
            <section className="owner-console-card">
              <h2><Database size={18} /> Güvenlik kapsaması</h2>
              <dl>
                <div><dt>2FA kullanan</dt><dd>{dashboard?.security.twoFactorUsers ?? '—'}</dd></div>
                <div><dt>Şüpheli oturum</dt><dd>{dashboard?.security.suspiciousSessions ?? '—'}</dd></div>
                <div><dt>Redis</dt><dd>{operations ? operations.redis === 'HEALTHY' ? 'Erişilebilir' : 'Kontrol gerekli' : '—'}</dd></div>
                <div><dt>Denetim olayları</dt><dd>{auditEvents.length}</dd></div>
              </dl>
            </section>
          </div>
        </section>
      )}
      {section === 'users' && (
        <section className="settings-section">
          <h2 className="owner-console-section-title">
            <Search size={19} /> Kullanıcı yönetimi
          </h2>
          <form className="form-row" onSubmit={(event) => void search(event)}>
            <label className="field">
              <span>ID, Wapve ID, kullanıcı adı veya e-posta</span>
              <input name="query" minLength={2} required />
            </label>
            <Button type="submit">Ara</Button>
          </form>
          {users.length === 0 && <p className="field-hint">Arama sonucu burada görünecek.</p>}
          {users.map((user) => (
            <article className="owner-user-row" key={user.id}>
              <div>
                <strong>
                  {user.displayName} · @{user.username} {user.system ? '· RESMÎ SİSTEM' : ''}
                </strong>
                <small>
                  {user.publicId} · {user.id} · {user.email}
                </small>
                <small>
                  {user.accountStatus} ·{' '}
                  {user.muted ? `MUTED (${user.muteReason ?? 'gerekçe yok'})` : 'ACTIVE'} ·{' '}
                  {user.sessionCount} oturum · {user.serverCount} sunucu · {user.emailVerified ? 'E-posta doğrulandı' : 'E-posta doğrulanmadı'}
                </small>
                <small>Rozetler: {user.badges.length ? user.badges.join(' · ') : 'Yok'}</small>
                <small>Wapve+: {user.wapvePlusActive ? `Aktif${user.wapvePlusUntil ? ` · ${new Date(user.wapvePlusUntil).toLocaleDateString('tr')}` : ' · Süresiz'}` : 'Kapalı'}</small>
                <small>Boost yuvaları: {user.supportSlots}</small>
                <small className={user.platformStaffRole ? 'owner-staff-role' : ''}>Panel rolü: {user.platformStaffRole ?? 'Yok'}</small>
                {!user.system && <div className="owner-badge-picker" aria-label={`${user.displayName} rozetleri`}>
                  {badgeCatalog.filter((badge) => badge.assignable && badge.code !== 'ALPHA_MEMBER').map((badge) => <button key={badge.code} type="button" className={user.badges.includes(badge.code) ? 'active' : ''} title={badge.description} onClick={() => void toggleBadge(user, badge.code)}>{badge.name}</button>)}
                </div>}
              </div>
              <div className="avatar-actions">
                {!user.system && user.platformRole !== 'OWNER' && <><Button variant="danger" onClick={() => void action(user.id, 'ban')}>
                  Yasakla
                </Button>
                <Button variant="secondary" onClick={() => void action(user.id, 'unban')}>
                  Yasağı kaldır
                </Button>
                <Button variant="danger" onClick={() => void action(user.id, 'mute')}>
                  Mute
                </Button>
                <Button variant="secondary" onClick={() => void action(user.id, 'unmute')}>
                  Mute kaldır
                </Button>
                <Button variant="secondary" onClick={() => void action(user.id, 'revoke-sessions')}>
                  Oturumları kapat
                </Button>
                <Button variant="secondary" onClick={() => void assignStaffRole(user)}>Panel rolünü düzenle</Button>
                {user.avatarPresent && <Button variant="danger" onClick={() => removeProfileAsset(user, 'AVATAR')}>Avatarı kaldır</Button>}
                {user.bannerPresent && <Button variant="danger" onClick={() => removeProfileAsset(user, 'BANNER')}>Afişi kaldır</Button>}
                <Button variant="secondary" onClick={() => editUserIdentity(user, 'username')}>Kullanıcı adını düzenle</Button>
                <Button variant="secondary" onClick={() => editUserIdentity(user, 'email')}>E-postayı düzenle</Button>
                <Button variant="secondary" onClick={() => resetUserPassword(user)}>Parolayı sıfırla</Button>
                {user.accountStatus === 'DELETED' ? <Button variant="secondary" onClick={() => restoreUser(user)}>Geri al</Button> : <Button variant="danger" onClick={() => deleteUser(user)}>Çöp kutusuna taşı</Button>}
                <Button variant="secondary" onClick={() => void toggleAlphaBadge(user)}>
                  {user.alphaMember ? 'Öncü üye rozetini kaldır' : 'Öncü üye rozeti ver'}
                </Button>
                {!user.alphaMember && <>
                  <Button variant="secondary" onClick={() => void grantWapvePlus(user, 30)}>Wapve+ 30 gün</Button>
                  <Button variant="secondary" onClick={() => void grantWapvePlus(user, 365)}>Wapve+ 1 yıl</Button>
                  {user.wapvePlusUntil && <Button variant="danger" onClick={() => void grantWapvePlus(user, 0)}>Wapve+ kaldır</Button>}
                </>}
                </>}
                {!user.system && <Button variant="secondary" onClick={() => editSupportSlots(user)}>Boost yuvasını düzenle</Button>}
                {!user.system && <Button onClick={() => void sendSystemDm(user)}>Wapve DM gönder</Button>}
              </div>
            </article>
          ))}
        </section>
      )}
      {section === 'badges' && (
        <section className="settings-section">
          <h2 className="owner-console-section-title"><BadgeCheck size={19} /> Rozet kataloğu</h2>
          <p className="field-hint">Atanabilir rozetleri Kullanıcılar bölümünden verip kaldırabilirsin. Sahip ve Sistem rozetleri kimliğe bağlıdır; manuel değiştirilemez.</p>
          <div className="owner-badge-catalog">
            {badgeCatalog.map((badge) => <article key={badge.code} style={{ '--badge-color': badge.color } as CSSProperties}>
              <span className="owner-badge-preview">{BADGE_ART[badge.code] ? <Image src={BADGE_ART[badge.code]!} alt="" width={52} height={52} /> : (badge.code === 'SYSTEM' ? '✓' : badge.code === 'PLATFORM_OWNER' ? '♛' : badge.name.slice(0, 1))}</span>
              <div><strong>{badge.name}</strong><small>{badge.code}</small><p>{badge.description}</p></div>
              <span className={badge.assignable ? 'state-badge' : 'state-badge attention'}>{badge.assignable ? 'Atanabilir' : 'Korumalı'}</span>
            </article>)}
          </div>
        </section>
      )}
      {section === 'reports' && (
        <>
          <section className="settings-section">
            <h2 className="owner-console-section-title">
              <ShieldAlert size={19} /> Gelen bildirimler
            </h2>
            {reports.length === 0 && <p className="field-hint">Kullanıcı bildirimi yok.</p>}
            {reports.map((report) => {
              const pageUrl = safeReportPageUrl(report.pageUrl);
              return <article className={`owner-user-row owner-report-card ${report.status.toLowerCase()}`} key={report.id}>
                <div>
                  <div className="owner-report-title"><strong>{report.title}</strong><span className={`state-badge ${report.status === 'OPEN' || report.status === 'IN_REVIEW' ? 'attention' : ''}`}>{report.status === 'OPEN' ? 'İnceleme bekliyor' : report.status === 'IN_REVIEW' ? 'İncelemede' : report.status === 'RESOLVED' ? 'Çözüldü' : report.status}</span></div>
                  <div className="owner-report-meta"><span><b>Bildiren</b> @{report.reporter.username} · {report.reporter.publicId}</span><span><b>Kategori</b> {report.category}</span><span><b>Alındı</b> {new Date(report.createdAt).toLocaleString('tr')}</span><span><b>Güncellendi</b> {new Date(report.updatedAt).toLocaleString('tr')}</span></div>
                  <p className="owner-report-description">{report.description || 'Açıklama girilmemiş.'}</p>
                  <div className="owner-report-target"><b>Hedef</b> {report.reportedUserId ? `Kullanıcı · ${report.reportedUserId}` : 'Genel platform bildirimi'}{pageUrl && <a href={pageUrl} target="_blank" rel="noopener noreferrer">Kaynak sayfayı aç ↗</a>}</div>
                  {report.ownerNote && <div className="owner-report-note"><b>Son yönetici notu</b><span>{report.ownerNote}</span></div>}
                </div>
                <div className="avatar-actions"><Button variant="secondary" onClick={() => openModal({ title: 'Bildirim notu', description: 'Bu not vaka geçmişinde görünür.', fields: [{ name: 'note', label: 'Not', type: 'textarea', required: true }], submitLabel: 'Notu kaydet', onSubmit: async (values) => { const note = (values.note ?? '').trim(); if (!note) throw new Error('Not boş bırakılamaz.'); await apiRequest(`/owner/reports/${report.id}`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'IN_REVIEW', ownerNote: note }) }); setReports((current) => current.map((item) => item.id === report.id ? { ...item, status: 'IN_REVIEW', ownerNote: note, updatedAt: new Date().toISOString() } : item)); } })}>Not ekle</Button><Button onClick={() => void resolveUserReport(report.id)}>Çözüldü</Button></div>
              </article>;
            })}
          </section>
          <section className="settings-section">
            <h2 className="owner-console-section-title">
              <Flag size={19} /> İçerik bildirimleri
            </h2>
            {contentReports.length === 0 && <p className="field-hint">İçerik bildirimi yok.</p>}
            {contentReports.map((report) => {
              const isMessage =
                report.targetType === 'CHANNEL_MESSAGE' ||
                report.targetType === 'DIRECT_MESSAGE' ||
                report.targetType === 'GROUP_MESSAGE';
              return (
                <article className={`owner-user-row owner-report-card ${report.status.toLowerCase()}`} key={report.id}>
                  <div>
                    <div className="owner-report-title"><strong>{CONTENT_REPORT_TARGET_LABELS[report.targetType]} · {CONTENT_REPORT_REASON_LABELS[report.reason]}</strong><span className={`state-badge ${report.status === 'OPEN' || report.status === 'IN_REVIEW' ? 'attention' : ''}`}>{report.status === 'OPEN' ? 'İnceleme bekliyor' : report.status === 'IN_REVIEW' ? 'İncelemede' : report.status === 'RESOLVED' ? 'Çözüldü' : 'Reddedildi'}</span></div>
                    <div className="owner-report-meta"><span><b>Bildiren</b> @{report.reporter.username} · {report.reporter.publicId}</span><span><b>Alındı</b> {new Date(report.createdAt).toLocaleString('tr')}</span><span><b>Yoğunluk</b> {report.reporterCount > 1 ? `${report.reporterCount} bildirim` : 'Tek bildirim'}</span></div>
                    {report.target.contextLabel && <div className="owner-report-target"><b>Hedef</b> {report.target.contextLabel}</div>}
                    {report.target.user && <div className="owner-report-target"><b>İlgili kullanıcı</b> @{report.target.user.username} · {report.target.user.publicId}</div>}
                    {report.target.messageContent && <blockquote className="owner-report-quote">“{report.target.messageContent}”</blockquote>}
                    {report.targetRemoved && <div className="owner-report-note"><b>İçerik durumu</b><span>Kaldırıldı ve karantinaya alındı.</span></div>}
                    {report.description && <p className="owner-report-description">{report.description}</p>}
                  </div>
                  <div className="avatar-actions">
                    {isMessage && !report.targetRemoved && (
                      <Button
                        variant="danger"
                        onClick={() => void removeContentReportTarget(report)}
                      >
                        İçeriği sil
                      </Button>
                    )}
                    <Button onClick={() => void updateContentReport(report.id, 'RESOLVED')}>
                      Çözüldü
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => void updateContentReport(report.id, 'DISMISSED')}
                    >
                      Reddet
                    </Button>
                  </div>
                </article>
              );
            })}
          </section>
        </>
      )}
      {section === 'servers' && (
        <section className="settings-section">
          <h2 className="owner-console-section-title"><Server size={19} /> Sunucu yönetimi</h2>
          <p className="field-hint">Tüm sunucuların sahibi, üye/kanal/emoji sayıları ve merkezi işlemleri.</p>
          {servers.map((server) => (
            <article className="owner-user-row" key={server.id}>
              <div>
                <strong>{server.name} · {server.publicId}</strong>
                <small>Sahip: @{server.owner.username} · {server.owner.displayName}</small>
                <small>{server.memberCount} üye · {server.channelCount} kanal · {server.emojiCount} emoji</small>
                <small>{server.discoveryEnabled ? 'Keşfette' : 'Keşfet kapalı'} · {server.platformFeatured ? 'Öne çıkan' : 'Standart'} · {server.platformVerified ? 'Doğrulanmış' : 'Doğrulanmamış'}</small>
                {server.platformSuspendedAt && <small className="owner-danger-copy">ASKIDA · {server.platformSuspensionReason ?? 'Gerekçe belirtilmedi'}</small>}
                <small>Oluşturulma: {new Date(server.createdAt).toLocaleString('tr')}</small>
              </div>
              <div className="avatar-actions">
                <Button onClick={() => void inspectServerDetails(server.id)}>İçeriği incele</Button>
                <Button variant="secondary" onClick={() => void editServer(server)}>Adı düzenle</Button>
                <Button variant="secondary" onClick={() => void toggleServerFlag(server, 'discoveryEnabled')}>{server.discoveryEnabled ? 'Keşfetten çıkar' : 'Keşfete al'}</Button>
                <Button variant="secondary" onClick={() => void toggleServerFlag(server, 'platformFeatured')}>{server.platformFeatured ? 'Öne çıkarmayı kaldır' : 'Öne çıkar'}</Button>
                <Button variant="secondary" onClick={() => void toggleServerFlag(server, 'platformVerified')}>{server.platformVerified ? 'Doğrulamayı kaldır' : 'Doğrula'}</Button>
                <Button variant="secondary" onClick={() => void transferServer(server)}>Sahipliği devret</Button>
                <Button variant="danger" onClick={() => void toggleServerSuspension(server)}>{server.platformSuspendedAt ? 'Askıyı kaldır' : 'Askıya al'}</Button>
                {server.deletedAt && <small className="owner-danger-copy">Çöp kutusunda · {server.deletionScheduledFor ? new Date(server.deletionScheduledFor).toLocaleDateString('tr') : 'bekliyor'}</small>}
                <Button variant="danger" onClick={() => void deleteServer(server)}>{server.deletedAt ? 'Geri al' : 'Çöp kutusuna taşı'}</Button>
              </div>
            </article>
          ))}
          {serverInspect && (
            <article className="owner-server-inspector">
              <div className="owner-module-heading">
                <div>
                  <h3>{serverInspect.name} · denetimli inceleme</h3>
                  <p className="field-hint">
                    {serverInspect.members.length} son üye · {serverInspect.channels.length} kanal
                  </p>
                </div>
                <Button variant="secondary" onClick={() => setServerInspect(null)}>
                  Kapat
                </Button>
              </div>
              <div className="owner-inspector-grid">
                <div>
                  <strong>Kanallar</strong>
                  {serverInspect.channels.map((channel) => (
                    <small key={channel.id}>
                      {channel.type === 'VOICE' ? '🔊' : '#'} {channel.name}
                    </small>
                  ))}
                </div>
                <div>
                  <strong>Son üyeler</strong>
                  {serverInspect.members.slice(0, 12).map((member) => (
                    <small key={member.id}>
                      <b>{member.displayName}</b> · @{member.username}
                    </small>
                  ))}
                </div>
              </div>
            </article>
          )}
        </section>
      )}
      {section === 'cases' && (
        <section className="settings-section owner-console-module">
          <div className="owner-module-heading">
            <div>
              <h2 className="owner-console-section-title">
                <BriefcaseBusiness size={19} /> Vaka ve Destek Dosyaları
              </h2>
              <p className="field-hint">
                Vaka arşivini incele. Yeni destek talepleri, değerlendirmeler ve görevli raporları ayrı destek panelindedir.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <a href="/support/staff" className="button button-secondary">Destek panelini aç</a>
              <Button
                variant="secondary"
                onClick={() => void syncEmails()}
                disabled={syncingEmails}
              >
                <RefreshCw
                  size={14}
                  className={syncingEmails ? 'animate-spin' : ''}
                  style={{ marginRight: 6 }}
                />
                {syncingEmails ? 'Denetleniyor…' : 'E-postaları Denetle'}
              </Button>
              <Button onClick={() => void createCaseFromPrompt()}>Yeni vaka</Button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, margin: '12px 0 16px', flexWrap: 'wrap' }}>
            <Button
              variant={caseCategoryFilter === 'ALL' ? 'primary' : 'secondary'}
              onClick={() => setCaseCategoryFilter('ALL')}
            >
              Tüm Vakalar ({cases.length})
            </Button>
            <Button
              variant={caseCategoryFilter === 'SUPPORT' ? 'primary' : 'secondary'}
              onClick={() => setCaseCategoryFilter('SUPPORT')}
            >
              Destek Talepleri ({cases.filter((item) => item.category.startsWith('SUPPORT_')).length})
            </Button>
            <Button
              variant={caseCategoryFilter === 'PLATFORM' ? 'primary' : 'secondary'}
              onClick={() => setCaseCategoryFilter('PLATFORM')}
            >
              Açık / İnceleniyor ({cases.filter((item) => item.status === 'OPEN' || item.status === 'IN_REVIEW').length})
            </Button>
          </div>

          {cases.filter((item) => {
            if (caseCategoryFilter === 'SUPPORT') return item.category.startsWith('SUPPORT_');
            if (caseCategoryFilter === 'PLATFORM') return item.status === 'OPEN' || item.status === 'IN_REVIEW';
            return true;
          }).length === 0 && <p className="field-hint">Seçilen filtrede vaka bulunamadı.</p>}

          {cases
            .filter((item) => {
              if (caseCategoryFilter === 'SUPPORT') return item.category.startsWith('SUPPORT_');
              if (caseCategoryFilter === 'PLATFORM') return item.status === 'OPEN' || item.status === 'IN_REVIEW';
              return true;
            })
            .map((item) => {
              const email = extractCaseEmail(item);
              const isSupport = item.category.startsWith('SUPPORT_');
              return (
                <article className="owner-case-card" key={item.id}>
                  <div className="owner-case-head">
                    <span className={`owner-case-priority ${item.priority.toLowerCase()}`}>
                      {item.priority}
                    </span>
                    <strong>{item.caseNumber}</strong>
                    <span className="state-badge">{item.status}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 6,
                        background: isSupport ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                        color: isSupport ? '#38bdf8' : '#e2e8f0',
                      }}
                    >
                      {item.category}
                    </span>
                    {email && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: '#cbd5e1',
                        }}
                      >
                        ✉️ {email}
                      </span>
                    )}
                  </div>
                  <h3>{item.summary}</h3>
                  <small>
                    {item.category} · {new Date(item.createdAt).toLocaleString('tr')} · {item.notes.length} not / yanıt · {item.evidence.length} kanıt · {item.appeals.length} itiraz
                  </small>
                  {item.resolution && <p>{item.resolution}</p>}
                  <div className="avatar-actions">
                    <Button onClick={() => openCaseInspector(item)}>
                      <MessageSquare size={14} /> Talebi İncele & Yanıtla
                    </Button>
                    <Button variant="secondary" onClick={() => addCaseNote(item)}>
                      Not ekle
                    </Button>
                    <Button variant="secondary" onClick={() => addCaseEvidence(item)}>
                      Kanıt ekle
                    </Button>
                    <Button
                      onClick={() => {
                        void apiRequest<OwnerAdminCase>(`/owner/cases/${item.id}`, {
                          method: 'PATCH',
                          headers,
                          body: JSON.stringify({
                            status: item.status === 'RESOLVED' ? 'OPEN' : 'RESOLVED',
                            resolution: item.status === 'RESOLVED' ? null : 'İnceleme tamamlandı.',
                          }),
                        })
                          .then((next) =>
                            setCases((current) => current.map((row) => (row.id === item.id ? next : row))),
                          )
                          .catch((caught) => setError(errorMessage(caught, messages)));
                      }}
                    >
                      {item.status === 'RESOLVED' ? 'Yeniden aç' : 'Çözüldü'}
                    </Button>
                  </div>
                </article>
              );
            })}
        </section>
      )}
      {section === 'appeals' && (
        <section className="settings-section owner-console-module">
          <h2 className="owner-console-section-title"><Flag size={19} /> İtiraz kuyruğu</h2>
          <p className="field-hint">Kullanıcı itirazlarını vaka dosyasıyla birlikte inceleyin ve kararınızı gerekçelendirin.</p>
          {appeals.map((appeal) => <article className="owner-case-card" key={appeal.id}><div className="owner-case-head"><span className="state-badge">{appeal.status}</span><strong>{appeal.caseId}</strong></div><p>{appeal.reason}</p><small>{appeal.userId} · {new Date(appeal.createdAt).toLocaleString('tr')}</small>{appeal.status === 'OPEN' || appeal.status === 'IN_REVIEW' ? <div className="avatar-actions"><Button onClick={() => decideAppeal(appeal, 'ACCEPTED')}>Kabul et</Button><Button variant="danger" onClick={() => decideAppeal(appeal, 'REJECTED')}>Reddet</Button></div> : appeal.response && <p>{appeal.response}</p>}</article>)}
        </section>
      )}
      {section === 'security' && (
        <section className="settings-section owner-console-module">
          <h2 className="owner-console-section-title"><ShieldCheck size={19} /> Güvenlik olayları</h2>
          <p className="field-hint">Yeni cihaz, şüpheli oturum ve hesap ele geçirme sinyallerini incele.</p>
          {riskEvents.length === 0 && <p className="field-hint">Açık risk olayı yok.</p>}
          {riskEvents.map((item) => <article className={`owner-risk-card ${item.score >= 70 ? 'critical' : ''}`} key={item.id}><div><div className="owner-case-head"><span className="owner-risk-score">Risk {item.score}</span><strong>{item.type}</strong><span className="state-badge">{item.status}</span></div><p>{item.reason}</p><small>{new Date(item.createdAt).toLocaleString('tr')} · {item.userId ?? 'kullanıcı yok'}{item.userAgent ? ` · ${item.userAgent}` : ''}</small></div>{item.status === 'OPEN' && <div className="avatar-actions"><Button onClick={() => void updateRisk(item.id, 'REVIEWED')}>İncelendi</Button><Button variant="secondary" onClick={() => void updateRisk(item.id, 'FALSE_POSITIVE')}>Yanlış alarm</Button>{item.ipHash && <Button variant="danger" onClick={() => void blockRiskIp(item)}>IP’yi engelle</Button>}{item.userId && item.sessionId && <Button variant="danger" onClick={() => void quarantineRiskSession(item)}>Cihazı karantinaya al</Button>}</div>}</article>)}
          <div className="owner-ip-blocks"><div className="owner-module-heading"><div><h3><Network size={17} /> IP engel listesi</h3><p className="field-hint">Hashlenmiş kayıtlar; gerçek IP adresleri yönetim panelinde tutulmaz.</p></div></div>{ipBlocks.map((block) => <article className="owner-ip-block-row" key={block.id}><code>{block.ipHash.slice(0, 16)}…</code><span>{block.reason}</span><small>{block.revokedAt ? 'İptal edildi' : block.expiresAt ? `Bitiş: ${new Date(block.expiresAt).toLocaleString('tr')}` : 'Süresiz'}</small>{!block.revokedAt && <Button variant="secondary" onClick={() => void revokeIpBlock(block)}>Engeli kaldır</Button>}</article>)}</div>
        </section>
      )}
      {section === 'billing' && (
        <section className="settings-section owner-console-module">
          <h2 className="owner-console-section-title"><ReceiptText size={19} /> Ödeme ve Wapve+ kayıtları</h2>
          <p className="field-hint">Abonelik, hediye, manuel tanım ve iade kayıtlarının denetim görünümü.</p>
          {billingEntries.length === 0 && <p className="field-hint">Henüz faturalama kaydı yok. Ödeme sağlayıcısı bağlandığında kayıtlar burada görünecek.</p>}
          {billingEntries.map((item) => <article className="owner-billing-row" key={item.id}><div><strong>{item.type} · {item.status}</strong><small>{item.userId} · {new Date(item.createdAt).toLocaleString('tr')}</small><p>{item.description ?? 'Açıklama yok'}</p></div><strong>{(item.amountMinor / 100).toFixed(2)} {item.currency}</strong>{item.status !== 'REFUNDED' && item.amountMinor > 0 && <Button variant="danger" onClick={() => refundBilling(item)}>İade kaydı</Button>}</article>)}
        </section>
      )}
      {section === 'analytics' && (
        <section className="settings-section owner-console-module">
          <h2 className="owner-console-section-title"><BarChart3 size={19} /> Büyüme ve gelir analitiği</h2>
          <p className="field-hint">Son 30 günün kullanıcı, sunucu, mesaj, oturum ve Wapve+ kayıtlarından üretilen operasyon görünümü.</p>
          <div className="owner-console-stats">{[['Kullanıcı', analytics?.totals.users], ['Sunucu', analytics?.totals.servers], ['Mesaj', analytics?.totals.messages], ['Aktif oturum', analytics?.totals.activeSessions]].map(([label, value]) => <article key={String(label)}><span>{label}</span><strong>{value ?? '—'}</strong><small>Toplam</small></article>)}</div>
          <div className="owner-analytics-retention"><strong>Tutundurma</strong><span>D1 {analytics?.retention.d1 ?? 0}%</span><span>D7 {analytics?.retention.d7 ?? 0}%</span><span>D30 {analytics?.retention.d30 ?? 0}%</span></div>
          <div className="owner-analytics-table"><div className="owner-analytics-row owner-analytics-head"><span>Tarih</span><span>Yeni kullanıcı</span><span>Yeni sunucu</span><span>Mesaj</span><span>Gelir</span></div>{analytics?.daily.map((day) => <div className="owner-analytics-row" key={day.date}><span>{day.date}</span><span>{day.newUsers}</span><span>{day.newServers}</span><span>{day.messages}</span><span>{(day.revenueMinor / 100).toFixed(2)} TRY</span></div>)}</div>
        </section>
      )}
      {section === 'announcements' && (
        <section className="settings-section">
          <h2 className="owner-console-section-title"><Megaphone size={19} /> Sistem duyuruları</h2>
          <div className="owner-system-identity">
            <Image src="/brand/wapve-system-avatar.png" alt="Wapve sistem hesabı" width={56} height={56} />
            <div><strong>Wapve</strong><small>Doğrulanmış, yanıt ve arama kabul etmeyen resmî sistem hesabı</small></div>
            <Image className="badge" src="/brand/wapve-system-badge.png" alt="Resmî sistem rozeti" width={24} height={24} />
          </div>
          <form className="owner-announcement-form" onSubmit={(event) => void sendAnnouncement(event)}>
            <label className="field"><span>Başlık</span><input name="title" minLength={3} maxLength={120} required /></label>
            <label className="field"><span>Önem düzeyi</span><select name="severity" defaultValue="INFO"><option value="INFO">Bilgi</option><option value="SUCCESS">Başarılı / olumlu</option><option value="WARNING">Uyarı</option><option value="CRITICAL">Kritik</option></select></label>
            <label className="field"><span>Hedef kitle</span><select name="audience" defaultValue="ACTIVE"><option value="ACTIVE">Aktif hesaplar</option><option value="ALPHA">Öncü üyeler</option><option value="ALL">Silinmemiş tüm hesaplar</option><option value="SELECTED">Seçili kullanıcı UUID’leri</option></select></label>
            <label className="field"><span>Seçili kullanıcı UUID’leri (yalnızca Seçili kitlede)</span><input name="targetUserIds" placeholder="UUID değerlerini virgülle ayır" /></label>
            <label className="field owner-announcement-body"><span>Mesaj</span><textarea name="body" minLength={1} maxLength={4000} rows={7} required /></label>
            <Button type="submit" disabled={busy}>{busy ? 'Gönderiliyor…' : 'Wapve sistem DM’i olarak gönder'}</Button>
          </form>
          <h3>Kampanya geçmişi</h3>
          {announcements.map((item) => <article className="owner-user-row" key={item.id}><div><strong>{item.title} · {item.status}</strong><small>{item.audience} · {item.severity} · {new Date(item.createdAt).toLocaleString('tr')}</small><p>{item.body}</p></div><div><strong>{item.sentCount}</strong><small>teslim · {item.failedCount} hata</small></div></article>)}
        </section>
      )}
      {section === 'settings' && (
        <section className="settings-section">
          <h2 className="owner-console-section-title"><Settings2 size={19} /> Platform ayarları</h2>
          <p className="field-hint">Her değişiklik gerekçe, sahip kimliği, istek ve IP özetiyle denetim günlüğüne yazılır.</p>
          <div className="owner-setting-list">
            {platformSettings.map((setting) => <article key={setting.key}><div><strong>{setting.key}</strong><p>{setting.description}</p><small>{setting.updatedAt ? `Son değişiklik: ${new Date(setting.updatedAt).toLocaleString('tr')}` : 'Varsayılan değer kullanılıyor'}{setting.updatedBy ? ` · @${setting.updatedBy.username}` : ''}</small></div><button type="button" className={setting.value === true ? 'active' : ''} onClick={() => void updatePlatformSetting(setting)}>{typeof setting.value === 'boolean' ? (setting.value ? 'Açık' : 'Kapalı') : setting.value}</button></article>)}
          </div>
        </section>
      )}
      {section === 'operations' && (
        <section className="settings-section">
          <h2 className="owner-console-section-title"><Gauge size={19} /> Sistem ve operasyon</h2>
          <div className="owner-console-stats">
            <article className={operations?.database !== 'HEALTHY' ? 'attention' : ''}><span>PostgreSQL</span><strong>{operations?.database ?? '—'}</strong><small>Canlı sorgu denetimi</small></article>
            <article className={operations?.redis !== 'HEALTHY' ? 'attention' : ''}><span>Redis</span><strong>{operations?.redis ?? '—'}</strong><small>Gerçek zaman / güvenli oturum</small></article>
            <article><span>API çalışma süresi</span><strong>{operations ? `${Math.floor(operations.uptimeSeconds / 60)} dk` : '—'}</strong><small>{operations?.nodeVersion ?? 'Node sürümü bekleniyor'}</small></article>
            <article><span>Bellek</span><strong>{operations ? `${operations.memory.rssMb} MB` : '—'}</strong><small>{operations?.memory.usedMb ?? 0} MB heap</small></article>
          </div>
          <div className="owner-console-overview-grid">
            <section className="owner-console-card"><h2><Database size={18} /> Arka plan işleri</h2><dl><div><dt>Bekleyen zamanlanmış mesaj</dt><dd>{operations?.jobs.pendingScheduledMessages ?? '—'}</dd></div><div><dt>Başarısız zamanlanmış mesaj</dt><dd>{operations?.jobs.failedScheduledMessages ?? '—'}</dd></div></dl></section>
            <section className="owner-console-card"><h2><Activity size={18} /> Gerçek zaman</h2><dl><div><dt>Aktif oturum</dt><dd>{operations?.realtime.activeSessions ?? '—'}</dd></div><div><dt>Aktif ses bağlantısı</dt><dd>{operations?.realtime.activeVoiceConnections ?? '—'}</dd></div></dl><Button variant="secondary" onClick={() => void refreshOperations()}>Şimdi yenile</Button></section>
          </div>
        </section>
      )}
      {section === 'audit' && (
        <section className="settings-section">
          <h2 className="owner-console-section-title">
            <Activity size={19} /> Denetim günlüğü
          </h2>
          {audit.length === 0 && <p className="field-hint">Henüz yönetim işlemi kaydı yok.</p>}
          <p className="field-hint">Kimlik doğrulama, sunucu, ayar, rozet, rapor ve sistem mesajı olaylarının birleşik akışı.</p>
          {auditEvents.map((item) => (
            <article className="owner-console-audit-row" key={`event-${item.id}`}>
              <span className="owner-console-audit-type">{item.action}</span>
              <div><strong>{item.actorSnapshot ?? 'Platform işlemi'}</strong><small>{item.targetSnapshot ?? item.requestId ?? 'Hedef bilgisi yok'} · {new Date(item.createdAt).toLocaleString('tr')}</small>{item.reason && <p>{item.reason}</p>}{item.metadata && <small>{JSON.stringify(item.metadata)}</small>}</div>
            </article>
          ))}
          <h3>Yaptırım özeti</h3>
          {audit.map((item) => (
            <article className="owner-console-audit-row" key={item.id}>
              <span className="owner-console-audit-type">{item.type}</span>
              <div>
                <strong>
                  {item.target.displayName} · @{item.target.username}
                </strong>
                <small>
                  {item.target.publicId} · {new Date(item.createdAt).toLocaleString('tr')}
                </small>
                {item.reason && <p>{item.reason}</p>}
              </div>
              <small>
                {item.durationMinutes
                  ? `${item.durationMinutes} dk`
                  : item.expiresAt
                    ? new Date(item.expiresAt).toLocaleString('tr')
                    : 'Kalıcı'}
              </small>
            </article>
          ))}
        </section>
      )}
        </div>
      </div>
      {inspectingCase && (
        <div
          className="owner-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !caseReplySubmitting) setInspectingCase(null);
          }}
        >
          <div className="owner-case-detail-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="owner-case-detail-header">
              <div>
                <div className="owner-case-badges">
                  <span className={`owner-case-priority ${inspectingCase.priority.toLowerCase()}`}>
                    {inspectingCase.priority}
                  </span>
                  <span className="state-badge">{inspectingCase.status}</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'rgba(56, 189, 248, 0.15)',
                      color: '#38bdf8',
                    }}
                  >
                    {inspectingCase.category}
                  </span>
                  {extractCaseEmail(inspectingCase) && (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#f1f5f9',
                      }}
                    >
                      ✉️ {extractCaseEmail(inspectingCase)}
                    </span>
                  )}
                </div>
                <h2>#{inspectingCase.caseNumber} · {inspectingCase.summary}</h2>
                <small style={{ color: 'rgba(241, 245, 249, 0.55)' }}>
                  Oluşturulma: {new Date(inspectingCase.createdAt).toLocaleString('tr')}
                </small>
              </div>
              <button
                type="button"
                className="owner-modal-close"
                aria-label="Kapat"
                onClick={() => !caseReplySubmitting && setInspectingCase(null)}
              >
                ×
              </button>
            </div>

            <div className="owner-case-detail-body">
              {caseActionNotice && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#6ee7b7',
                    fontSize: 13,
                  }}
                >
                  ✓ {caseActionNotice}
                </div>
              )}

              <div>
                <h4
                  style={{
                    margin: '0 0 8px',
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'rgba(241, 245, 249, 0.6)',
                  }}
                >
                  Sohbet & Vaka Geçmişi ({inspectingCase.notes.length} kayıt)
                </h4>

                <div className="owner-case-thread">
                  {inspectingCase.notes.length === 0 ? (
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>
                      Henüz kayıt veya mesaj eklenmemiş.
                    </p>
                  ) : (
                    inspectingCase.notes.map((note, index) => {
                      const isStaffReply = note.body.startsWith('[Destek Yanıtı]');
                      const isUserEmailReply = note.body.startsWith('[Kullanıcı Yanıtı]');
                      const isUserTicket = index === 0 && note.body.includes('Gönderen E-posta:');
                      const bubbleClass = isStaffReply
                        ? 'owner-case-bubble-staff'
                        : isUserEmailReply || isUserTicket
                          ? 'owner-case-bubble-user'
                          : 'owner-case-bubble-note';

                      const title = isStaffReply
                        ? 'Destek Ekibi Yanıtı (support@wapve.com İletildi)'
                        : isUserEmailReply
                          ? 'Kullanıcı Yanıtı (E-posta ile İletildi)'
                          : isUserTicket
                            ? 'Kullanıcı Destek Talebi (Orijinal Başvuru)'
                            : 'Dahili Yetkili Notu';

                      const cleanBody = isStaffReply
                        ? note.body.replace(/^\[Destek Yanıtı\]\s*/i, '')
                        : isUserEmailReply
                          ? note.body.replace(/^\[Kullanıcı Yanıtı\]\s*(\([^)]+\):)?\s*/i, '')
                          : note.body;

                      return (
                        <div key={note.id} className={`owner-case-bubble ${bubbleClass}`}>
                          <div className="owner-case-bubble-header">
                            <span>{title}</span>
                            <span style={{ fontWeight: 400, opacity: 0.75 }}>
                              {new Date(note.createdAt).toLocaleString('tr')}
                            </span>
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {cleanBody}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {inspectingCase.evidence.length > 0 && (
                <div>
                  <h4
                    style={{
                      margin: '0 0 8px',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'rgba(241, 245, 249, 0.6)',
                    }}
                  >
                    Kanıtlar & Ekler ({inspectingCase.evidence.length})
                  </h4>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {inspectingCase.evidence.map((ev) => (
                      <a
                        key={ev.id}
                        href={ev.externalUrl ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          padding: '6px 12px',
                          borderRadius: 8,
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: '#38bdf8',
                          textDecoration: 'none',
                        }}
                      >
                        <span>{ev.originalName}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Yanıt Gönderme Alanı */}
            <form
              className="owner-case-reply-form"
              onSubmit={(e) => {
                e.preventDefault();
                void submitCaseReply();
              }}
            >
              <label style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
                Kullanıcıya Yanıt Gönder
              </label>
              <textarea
                required
                className="owner-case-reply-textarea"
                placeholder="Kullanıcıya iletilecek destek cevabını detaylıca yazın (support@wapve.com adresinden gönderilecektir)..."
                value={caseReplyText}
                onChange={(e) => setCaseReplyText(e.target.value)}
              />

              <div className="owner-case-reply-controls">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      fontSize: 12.5,
                      color: '#cbd5e1',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={caseReplySendEmail}
                      onChange={(e) => setCaseReplySendEmail(e.target.checked)}
                      disabled={!extractCaseEmail(inspectingCase)}
                    />
                    <span>
                      support@wapve.com ile e-posta gönder
                      {extractCaseEmail(inspectingCase)
                        ? ` (${extractCaseEmail(inspectingCase)})`
                        : ' (E-posta bulunamadı)'}
                    </span>
                  </label>

                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <span style={{ color: 'rgba(241, 245, 249, 0.6)' }}>Durum:</span>
                    <select
                      value={caseReplyStatus}
                      onChange={(e) => setCaseReplyStatus(e.target.value as typeof caseReplyStatus)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: '#090e1a',
                        color: '#fff',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        fontSize: 12,
                      }}
                    >
                      <option value="RESOLVED">Çözüldü (RESOLVED)</option>
                      <option value="IN_REVIEW">İnceleniyor (IN_REVIEW)</option>
                      <option value="OPEN">Açık Tut (OPEN)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setInspectingCase(null)}
                    disabled={caseReplySubmitting}
                  >
                    Kapat
                  </Button>
                  <Button
                    type="submit"
                    disabled={caseReplySubmitting || !caseReplyText.trim()}
                  >
                    <Send size={13} style={{ marginRight: 4 }} />
                    {caseReplySubmitting ? 'Gönderiliyor…' : 'Yanıtı Gönder'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {modal && (
        <div className="owner-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setModal(null); }}>
          <form className="owner-modal" onSubmit={(event) => void submitModal(event)} onMouseDown={(event) => event.stopPropagation()}>
            <div className="owner-modal-header"><div><span className="owner-console-kicker">WAPVE KONTROL MERKEZİ</span><h2>{modal.title}</h2></div><button type="button" className="owner-modal-close" aria-label="Kapat" onClick={() => !busy && setModal(null)}>×</button></div>
            {modal.description && <p className="owner-modal-description">{modal.description}</p>}
            <div className="owner-modal-fields">
              {modal.fields.map((field) => <label className="field" key={field.name}><span>{field.label}</span>{field.type === 'textarea' ? <textarea value={modalValues[field.name] ?? ''} required={field.required} placeholder={field.placeholder} rows={5} onChange={(event) => setModalValues((current) => ({ ...current, [field.name]: event.target.value }))} /> : field.type === 'select' ? <select value={modalValues[field.name] ?? ''} required={field.required} onChange={(event) => setModalValues((current) => ({ ...current, [field.name]: event.target.value }))}>{field.options?.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select> : <input type={field.type ?? 'text'} value={modalValues[field.name] ?? ''} required={field.required} placeholder={field.placeholder} onChange={(event) => setModalValues((current) => ({ ...current, [field.name]: event.target.value }))} />}</label>)}
            </div>
            <div className="owner-modal-actions"><Button type="button" variant="secondary" onClick={() => setModal(null)} disabled={busy}>Vazgeç</Button><Button type="submit" variant={modal.danger ? 'danger' : 'primary'} disabled={busy}>{busy ? 'Kaydediliyor…' : (modal.submitLabel ?? 'Kaydet')}</Button></div>
          </form>
        </div>
      )}
    </div>
  );
}
