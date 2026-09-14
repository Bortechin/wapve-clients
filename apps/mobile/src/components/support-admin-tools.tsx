import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupportCannedReply } from '@wapve/contracts';
import { supportRequest } from '@/lib/support-client';
import { useI18n } from '@/lib/i18n';
import { Button, Field } from './ui';
import { Text, Switch } from './localized-native';
import { View, ScrollView } from './themed-native';
import { colors } from '@wapve/design-tokens';

type Section = 'canned-replies' | 'agents' | 'analytics' | 'quarantine' | 'audit';
type Agent = { id: string; email: string; supportAgentProfile: { displayName: string } | null };
type Analytics = { overdue: number; failedEmails: number; ratingCount: number; averageRating: number | null; averageFirstResponseHours: number | null; performance: Array<{ agentName: string | null; assigned: number; resolved: number; averageRating: number | null }> };
type Quarantine = { id: string; sender: string; subject: string | null; reason: string; body?: string };
export function SupportAdminTools({ accountId }: { accountId: string }) {
  const { locale } = useI18n(); const tr = locale === 'tr'; const cache = useQueryClient();
  const [section, setSection] = useState<Section | null>(null); const [id, setId] = useState<string | null>(null);
  const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [active, setActive] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const canned = useQuery({ queryKey: ['mobile-support', accountId, 'canned'], enabled: section === 'canned-replies', queryFn: () => supportRequest<SupportCannedReply[]>(accountId, 'staff', '/support/staff/canned-replies') });
  const agents = useQuery({ queryKey: ['mobile-support', accountId, 'agents'], enabled: section === 'agents', queryFn: () => supportRequest<Agent[]>(accountId, 'staff', '/support/staff/agents') });
  const analytics = useQuery({ queryKey: ['mobile-support', accountId, 'analytics'], enabled: section === 'analytics', queryFn: () => supportRequest<Analytics>(accountId, 'staff', '/support/staff/analytics') });
  const quarantine = useQuery({ queryKey: ['mobile-support', accountId, 'quarantine'], enabled: section === 'quarantine', queryFn: () => supportRequest<Quarantine[]>(accountId, 'staff', '/support/staff/quarantine') });
  const quarantined = useQuery({ queryKey: ['mobile-support', accountId, 'quarantine', id], enabled: section === 'quarantine' && Boolean(id), queryFn: () => supportRequest<Quarantine>(accountId, 'staff', `/support/staff/quarantine/${id}`) });
  const audit = useQuery({ queryKey: ['mobile-support', accountId, 'audit'], enabled: section === 'audit', queryFn: () => supportRequest<Array<{ id: string; action: string; createdAt: string }>>(accountId, 'staff', '/support/staff/audit') });
  const sections: Array<[Section, string]> = [['canned-replies', tr ? 'Hazır yanıtlar' : 'Saved replies'], ['agents', tr ? 'Destek ekibi' : 'Support team'], ['analytics', tr ? 'İstatistikler' : 'Analytics'], ['quarantine', tr ? 'Karantina' : 'Quarantine'], ['audit', tr ? 'İşlem geçmişi' : 'Audit history']];
  async function save() {
    if (busy) return; setBusy(true); setError('');
    try {
      if (section === 'agents' && id) await supportRequest(accountId, 'staff', `/support/staff/agents/${id}/name`, 'PATCH', { displayName: title });
      else if (section === 'canned-replies') {
        const current = canned.data?.find(item => item.id === id);
        await supportRequest(accountId, 'staff', `/support/staff/canned-replies${id ? `/${id}` : ''}`, id ? 'PATCH' : 'POST', { category: current?.category ?? null, locale: current?.locale ?? locale, title, body, active, sortOrder: current?.sortOrder ?? 0 });
      }
      setId(null); setTitle(''); setBody(''); await cache.invalidateQueries({ queryKey: ['mobile-support', accountId] });
    } catch { setError(tr ? 'Kaydedilemedi. Tekrar dene.' : 'Could not save. Try again.'); } finally { setBusy(false); }
  }
  const currentQuery = section === 'canned-replies' ? canned : section === 'agents' ? agents : section === 'analytics' ? analytics : section === 'quarantine' ? quarantine : audit;
  return <View style={{ gap: 12 }}>
    <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{sections.map(([value, label]) => <Button key={value} label={label} variant={section === value ? 'primary' : 'secondary'} onPress={() => { setSection(section === value ? null : value); setId(null); setTitle(''); setBody(''); }} />)}</ScrollView>
    {section && currentQuery.isError && <Button label={tr ? 'Tekrar dene' : 'Retry'} onPress={() => { void currentQuery.refetch(); }} />}
    {section === 'canned-replies' && <>{canned.data?.map(item => <Button key={item.id} variant="secondary" label={`${item.title} · ${item.locale}`} onPress={() => { setId(item.id); setTitle(item.title); setBody(item.body); setActive(item.active); }} />)}<Button label={tr ? 'Yeni hazır yanıt' : 'New saved reply'} onPress={() => { setId(null); setTitle(''); setBody(''); setActive(true); }} /><Field label={tr ? 'Başlık' : 'Title'} value={title} onChangeText={setTitle} /><Field label={tr ? 'Yanıt' : 'Reply'} value={body} onChangeText={setBody} multiline /><Switch accessibilityLabel={tr ? 'Etkin' : 'Enabled'} value={active} onValueChange={setActive} /><Button label={tr ? 'Kaydet' : 'Save'} onPress={() => { void save(); }} loading={busy} /></>}
    {section === 'agents' && <>{agents.data?.map(agent => <Button key={agent.id} label={agent.supportAgentProfile?.displayName ?? agent.email} variant="secondary" onPress={() => { setId(agent.id); setTitle(agent.supportAgentProfile?.displayName ?? ''); }} />)}{id && <><Field label={tr ? 'Görünen ad' : 'Display name'} value={title} onChangeText={setTitle} /><Button label={tr ? 'Kaydet' : 'Save'} onPress={() => { void save(); }} loading={busy} /></>}</>}
    {section === 'analytics' && analytics.data && <View style={{ gap: 12 }}>{[
      [tr ? 'Geciken talepler' : 'Overdue tickets', analytics.data.overdue], [tr ? 'Başarısız e-postalar' : 'Failed emails', analytics.data.failedEmails], [tr ? 'Değerlendirme sayısı' : 'Ratings', analytics.data.ratingCount], [tr ? 'Ortalama puan' : 'Average rating', analytics.data.averageRating?.toFixed(1) ?? '—'], [tr ? 'İlk yanıt (saat)' : 'First response (hours)', analytics.data.averageFirstResponseHours?.toFixed(1) ?? '—'],
    ].map(([label, value]) => <Text key={label} style={{ color: colors.text }}>{label}: {value}</Text>)}{analytics.data.performance.map((agent, index) => <Text key={index} style={{ color: colors.textMuted }}>{agent.agentName ?? '—'} · {agent.resolved}/{agent.assigned}</Text>)}</View>}
    {section === 'quarantine' && <>{quarantine.data?.map(item => <Button key={item.id} label={item.subject ?? item.sender} variant="secondary" onPress={() => setId(item.id)} />)}{quarantined.data && <View style={{ padding: 16, gap: 12, backgroundColor: colors.surface }}><Text style={{ color: colors.textMuted }}>{quarantined.data.sender} · {quarantined.data.reason}</Text><Text selectable style={{ color: colors.text }}>{quarantined.data.body}</Text></View>}</>}
    {section === 'audit' && audit.data?.map(item => <View key={item.id} style={{ padding: 12, backgroundColor: colors.surface }}><Text style={{ color: colors.text }}>{item.action}</Text><Text style={{ color: colors.textMuted }}>{new Date(item.createdAt).toLocaleString(locale)}</Text></View>)}
    {error !== '' && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}
  </View>;
}
