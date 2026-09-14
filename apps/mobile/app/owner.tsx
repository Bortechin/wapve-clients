import { TextInput, Modal, Text, Alert, Pressable } from '@/components/localized-native';
import type {
  ContentReport,
  OwnerAnnouncement,
  OwnerAuditAction,
  OwnerAuditEntry,
  OwnerBadgeCatalogEntry,
  OwnerDashboard,
  OwnerOperations,
  OwnerPlatformSetting,
  OwnerServer,
  OwnerUser,
  PlatformBadge,
  UserReport,
} from '@wapve/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, radius, spacing, touch, typography } from '@wapve/design-tokens';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { Button, Field, ScreenHeader } from '@/components/ui';
import { Icon } from '@/components/icon';
import { SwipeableSheetSurface } from '@/components/swipeable-sheet';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/client';
import { OwnerExtended, OwnerActionForm, type OwnerAction } from '@/components/owner-extended';
import { ownerServerDeletionSchema } from '@wapve/contracts';

type OwnerAccess = { token: string; expiresAt: string };
type Tab =
  | 'overview'
  | 'users'
  | 'badges'
  | 'servers'
  | 'reports'
  | 'announcements'
  | 'settings'
  | 'operations'
  | 'audit'
  | 'extended';

export default function OwnerScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const owner = user?.badges.includes('PLATFORM_OWNER') ?? false;
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [access, setAccess] = useState<OwnerAccess | null>(null);
  const [pendingAction, setPendingAction] = useState<OwnerAction | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const dashboard = useQuery({
    queryKey: ['owner-dashboard', access?.token],
    enabled: Boolean(access),
    queryFn: () =>
      access
        ? api.request<OwnerDashboard>('/owner/dashboard', { headers: ownerHeaders(access.token) })
        : Promise.reject(new Error('locked')),
  });
  const servers = useQuery({
    queryKey: ['owner-servers', access?.token],
    enabled: Boolean(access),
    queryFn: () =>
      access
        ? api.request<OwnerServer[]>('/owner/servers', { headers: ownerHeaders(access.token) })
        : Promise.reject(new Error('locked')),
  });
  const audit = useQuery({
    queryKey: ['owner-audit', access?.token],
    enabled: Boolean(access),
    queryFn: () =>
      access
        ? api.request<OwnerAuditAction[]>('/owner/audit', { headers: ownerHeaders(access.token) })
        : Promise.reject(new Error('locked')),
  });
  const auditEvents = useQuery({
    queryKey: ['owner-audit-events', access?.token],
    enabled: Boolean(access),
    queryFn: () =>
      access
        ? api.request<OwnerAuditEntry[]>('/owner/audit/events?limit=200', {
            headers: ownerHeaders(access.token),
          })
        : Promise.reject(new Error('locked')),
  });
  const badgeCatalog = useQuery({
    queryKey: ['owner-badges', access?.token],
    enabled: Boolean(access),
    queryFn: () =>
      access
        ? api.request<OwnerBadgeCatalogEntry[]>('/owner/badges', {
            headers: ownerHeaders(access.token),
          })
        : Promise.reject(new Error('locked')),
  });
  const settings = useQuery({
    queryKey: ['owner-settings', access?.token],
    enabled: Boolean(access),
    queryFn: () =>
      access
        ? api.request<OwnerPlatformSetting[]>('/owner/settings', {
            headers: ownerHeaders(access.token),
          })
        : Promise.reject(new Error('locked')),
  });
  const operations = useQuery({
    queryKey: ['owner-operations', access?.token],
    enabled: Boolean(access),
    refetchInterval: 30_000,
    queryFn: () =>
      access
        ? api.request<OwnerOperations>('/owner/operations', { headers: ownerHeaders(access.token) })
        : Promise.reject(new Error('locked')),
  });
  const announcements = useQuery({
    queryKey: ['owner-announcements', access?.token],
    enabled: Boolean(access),
    queryFn: () =>
      access
        ? api.request<OwnerAnnouncement[]>('/owner/announcements', {
            headers: ownerHeaders(access.token),
          })
        : Promise.reject(new Error('locked')),
  });
  const directoryUsers = useQuery({
    queryKey: ['owner-users', access?.token],
    enabled: Boolean(access),
    queryFn: () =>
      access
        ? api.request<OwnerUser[]>('/owner/users?limit=50', { headers: ownerHeaders(access.token) })
        : Promise.reject(new Error('locked')),
  });
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [users, setUsers] = useState<OwnerUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<OwnerUser | null>(null);
  const [selectedReport, setSelectedReport] = useState<UserReport | null>(null);
  const [selectedContentReport, setSelectedContentReport] = useState<ContentReport | null>(null);
  const [editingServer, setEditingServer] = useState<OwnerServer | null>(null);
  const reports = useQuery({
    queryKey: ['owner-reports', access?.token],
    enabled: Boolean(access),
    queryFn: () => {
      if (!access) return Promise.resolve([]);
      return api.request<UserReport[]>('/owner/reports', { headers: ownerHeaders(access.token) });
    },
  });
  const contentReports = useQuery({
    queryKey: ['owner-content-reports', access?.token],
    enabled: Boolean(access),
    queryFn: () => {
      if (!access) return Promise.resolve([]);
      return api.request<ContentReport[]>('/owner/content-reports', {
        headers: ownerHeaders(access.token),
      });
    },
  });
  useEffect(() => {
    if (user && !owner) router.replace('/(tabs)/me');
  }, [owner, user]);
  useEffect(() => {
    if (!access) return;
    const delay = Math.max(0, new Date(access.expiresAt).getTime() - Date.now());
    const timer = setTimeout(() => setAccess(null), delay);
    return () => clearTimeout(timer);
  }, [access]);
  useEffect(() => {
    if (!query.trim()) setUsers(directoryUsers.data ?? []);
  }, [directoryUsers.data, query]);
  if (!owner) return null;

  async function unlock() {
    if (!password || !/^\d{6}$/u.test(code) || unlocking) return;
    setUnlocking(true);
    try {
      const value = await api.request<OwnerAccess>('/owner/unlock', {
        method: 'POST',
        body: { currentPassword: password, code },
      });
      setAccess(value);
      setPassword('');
      setCode('');
    } catch {
      Alert.alert(
        'Doğrulama başarısız',
        'Parolanı ve 2FA kodunu kontrol et. Yönetim erişimi için 2FA açık olmalıdır.',
      );
    } finally {
      setUnlocking(false);
    }
  }
  async function search() {
    if (!access || searching) return;
    setSearching(true);
    try {
      const params = new URLSearchParams({ q: query.trim(), limit: '100' });
      setUsers(
        await api.request<OwnerUser[]>(`/owner/users?${params.toString()}`, {
          headers: ownerHeaders(access.token),
        }),
      );
    } catch {
      setAccess(null);
    } finally {
      setSearching(false);
    }
  }
  async function refreshSearch() {
    await queryClient.invalidateQueries({ queryKey: ['owner-users'] });
    await search();
  }
  function editServer(server: OwnerServer) {
    setEditingServer(server);
  }
  function deleteServer(server: OwnerServer) {
    setPendingAction({ title: `Sunucuyu sil: ${server.name}`, path: `/owner/servers/${server.id}`, method: 'DELETE', schema: ownerServerDeletionSchema, fields: [{ key: 'reason', tr: 'Sebep', en: 'Reason' }, { key: 'confirmation', tr: 'Onay (DELETE)', en: 'Confirmation (DELETE)' }], confirm: true });
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScreenHeader title="Platform yönetimi" left={<Back />} />
      {!access ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.lockCard}>
            <View style={styles.crown}>
              <Icon name="shield-crown-outline" color={colors.warning} size={34} />
            </View>
            <Text style={styles.title}>Sahip doğrulaması</Text>
            <Text style={styles.body}>
              Yüksek riskli işlemler için parola ve 2FA koduyla yeniden doğrula. Erişim 10 dakika
              sonra otomatik kapanır.
            </Text>
            <Field
              label="Mevcut parola"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <Field
              label="6 haneli 2FA kodu"
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/gu, '').slice(0, 6))}
              keyboardType="number-pad"
            />
            <Button
              label="Yönetim panelini aç"
              loading={unlocking}
              disabled={!password || code.length !== 6}
              onPress={() => void unlock()}
            />
          </View>
        </ScrollView>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabs}
          >
            <TabButton
              label="Genel"
              active={tab === 'overview'}
              onPress={() => setTab('overview')}
            />
            <TabButton
              label="Vaka ve güvenlik"
              active={tab === 'extended'}
              onPress={() => setTab('extended')}
            />
            <TabButton
              label="Kullanıcılar"
              active={tab === 'users'}
              onPress={() => setTab('users')}
            />
            <TabButton
              label="Rozetler"
              active={tab === 'badges'}
              onPress={() => setTab('badges')}
            />
            <TabButton
              label={`Sunucular${servers.data?.length ? ` · ${servers.data.length}` : ''}`}
              active={tab === 'servers'}
              onPress={() => setTab('servers')}
            />
            <TabButton
              label={`Moderasyon · ${(reports.data?.length ?? 0) + (contentReports.data?.length ?? 0)}`}
              active={tab === 'reports'}
              onPress={() => setTab('reports')}
            />
            <TabButton
              label="Duyurular"
              active={tab === 'announcements'}
              onPress={() => setTab('announcements')}
            />
            <TabButton
              label="Ayarlar"
              active={tab === 'settings'}
              onPress={() => setTab('settings')}
            />
            <TabButton
              label="Sistem"
              active={tab === 'operations'}
              onPress={() => setTab('operations')}
            />
            <TabButton label="Denetim" active={tab === 'audit'} onPress={() => setTab('audit')} />
          </ScrollView>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {pendingAction && <OwnerActionForm key={pendingAction.path} action={pendingAction} access={access.token} close={() => setPendingAction(null)} saved={async () => { setPendingAction(null); await queryClient.invalidateQueries({ queryKey: ['owner-servers'] }); }} />}
            <View style={styles.accessBanner}>
              <Icon name="lock-open-check-outline" color={colors.success} size={22} />
              <View style={styles.copy}>
                <Text style={styles.name}>Yönetim erişimi açık</Text>
                <Text style={styles.meta}>
                  {new Date(access.expiresAt).toLocaleTimeString('tr-TR')} saatinde otomatik
                  kilitlenir.
                </Text>
              </View>
              <Pressable
                style={styles.iconButton}
                onPress={() => { const token = access.token; setAccess(null); setPendingAction(null); void api.request('/owner/lock', { method: 'POST', headers: ownerHeaders(token) }).catch(() => Alert.alert('Hata', 'Bağlantı kurulamadı.')); queryClient.removeQueries({ predicate: query => String(query.queryKey[0]).startsWith('owner-') }); }}
                accessibilityLabel="Paneli kilitle"
              >
                <Icon name="lock-outline" color={colors.textMuted} size={23} />
              </Pressable>
            </View>
            {tab === 'overview' ? (
              <OwnerOverview
                dashboard={dashboard.data}
                reports={reports.data?.length ?? 0}
                contentReports={contentReports.data?.length ?? 0}
              />
            ) : null}
            {tab === 'extended' ? <OwnerExtended access={access.token} /> : null}
            {tab === 'users' ? (
              <OwnerUsers
                users={users}
                query={query}
                setQuery={setQuery}
                searching={searching}
                search={search}
                select={setSelectedUser}
              />
            ) : null}
            {tab === 'badges' ? <OwnerBadges items={badgeCatalog.data ?? []} /> : null}
            {tab === 'servers' ? (
              <OwnerServers servers={servers.data ?? []} edit={editServer} remove={deleteServer} />
            ) : null}
            {tab === 'reports' ? (
              <OwnerReports
                reports={reports.data ?? []}
                contentReports={contentReports.data ?? []}
                selectReport={setSelectedReport}
                selectContent={setSelectedContentReport}
              />
            ) : null}
            {tab === 'announcements' ? (
              <OwnerAnnouncements
                items={announcements.data ?? []}
                access={access.token}
                refresh={async () => {
                  await queryClient.invalidateQueries({ queryKey: ['owner-announcements'] });
                }}
              />
            ) : null}
            {tab === 'settings' ? (
              <OwnerSettings
                items={settings.data ?? []}
                access={access.token}
                refresh={async () => {
                  await queryClient.invalidateQueries({ queryKey: ['owner-settings'] });
                }}
              />
            ) : null}
            {tab === 'operations' ? <OwnerOperationsView value={operations.data} /> : null}
            {tab === 'audit' ? (
              <OwnerAudit events={auditEvents.data ?? []} sanctions={audit.data ?? []} />
            ) : null}
          </ScrollView>
          <OwnerUserSheet
            user={selectedUser}
            badges={badgeCatalog.data ?? []}
            access={access.token}
            close={() => setSelectedUser(null)}
            refresh={refreshSearch}
          />
          <OwnerReportSheet
            report={selectedReport}
            access={access.token}
            close={() => setSelectedReport(null)}
            refresh={async () => {
              await queryClient.invalidateQueries({ queryKey: ['owner-reports'] });
            }}
          />
          <OwnerContentReportSheet
            report={selectedContentReport}
            access={access.token}
            close={() => setSelectedContentReport(null)}
            refresh={async () => {
              await queryClient.invalidateQueries({ queryKey: ['owner-content-reports'] });
            }}
          />
          <OwnerServerEditSheet
            server={editingServer}
            access={access.token}
            close={() => setEditingServer(null)}
            refresh={async () => {
              await queryClient.invalidateQueries({ queryKey: ['owner-servers'] });
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
}

function OwnerOverview({
  dashboard,
  reports,
  contentReports,
}: {
  dashboard: OwnerDashboard | undefined;
  reports: number;
  contentReports: number;
}) {
  const cards = [
    ['Toplam kullanıcı', dashboard?.users.total ?? '—'],
    ['Aktif oturum', dashboard?.sessions.active ?? '—'],
    ['Toplam sunucu', dashboard?.servers.total ?? '—'],
    ['Açık bildirim', reports + contentReports],
    ['24 saatte yeni üye', dashboard?.users.newLast24Hours ?? '—'],
    ['Şüpheli oturum', dashboard?.security.suspiciousSessions ?? '—'],
    ['2FA kullanan', dashboard?.security.twoFactorUsers ?? '—'],
    [
      'Toplam mesaj',
      dashboard
        ? dashboard.activity.channelMessages +
          dashboard.activity.directMessages +
          dashboard.activity.groupMessages
        : '—',
    ],
  ];
  return (
    <>
      <View style={styles.stats}>
        {cards.map(([label, value]) => (
          <View key={label} style={styles.stat}>
            <Text style={styles.meta}>{label}</Text>
            <Text style={styles.statValue}>{value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <Text style={styles.section}>GÜVENLİK ÖZETİ</Text>
        <Text style={styles.body}>
          Her işlem parola + 2FA ile açılan, 10 dakika ömürlü sahip erişim anahtarıyla korunur ve
          denetim kaydına yazılır.
        </Text>
        <Text style={styles.meta}>
          Son veri yenileme:{' '}
          {dashboard ? new Date(dashboard.generatedAt).toLocaleString('tr-TR') : 'yükleniyor'}
        </Text>
      </View>
    </>
  );
}

function OwnerUsers({
  users,
  query,
  setQuery,
  searching,
  search,
  select,
}: {
  users: OwnerUser[];
  query: string;
  setQuery(value: string): void;
  searching: boolean;
  search(): Promise<void>;
  select(user: OwnerUser): void;
}) {
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.section}>GELİŞMİŞ KULLANICI YÖNETİMİ</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void search()}
          placeholder="Ad, kullanıcı adı, e-posta veya kimlik"
          placeholderTextColor={colors.textDim}
          style={styles.input}
          autoCapitalize="none"
        />
        <Button
          label={query.trim() ? 'Filtrele' : 'İlk 50 hesabı göster'}
          loading={searching}
          onPress={() => void search()}
        />
      </View>
      {users.map((item) => (
        <Pressable key={item.id} style={styles.userCard} onPress={() => select(item)}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  item.accountStatus === 'SUSPENDED'
                    ? colors.danger
                    : item.muted
                      ? colors.warning
                      : colors.success,
              },
            ]}
          />
          <View style={styles.copy}>
            <Text style={styles.name}>
              {item.displayName} {item.platformRole === 'OWNER' ? '♛' : item.system ? '◆' : ''}
            </Text>
            <Text style={styles.meta}>
              @{item.username} · {item.email}
            </Text>
            <Text style={styles.meta}>
              {item.accountStatus === 'SUSPENDED'
                ? 'Yasaklı'
                : item.muted
                  ? 'Global susturulmuş'
                  : 'Aktif'}{' '}
              · {item.sessionCount} oturum · {item.serverCount} sunucu
            </Text>
            {item.badges.length ? (
              <Text numberOfLines={1} style={styles.badgeLine}>
                {item.badges.join(' · ')}
              </Text>
            ) : null}
          </View>
          <Icon name="dots-vertical" color={colors.textMuted} size={23} />
        </Pressable>
      ))}
      {!searching && !users.length ? (
        <Text style={styles.empty}>Eşleşen kullanıcı yok.</Text>
      ) : null}
    </>
  );
}

function OwnerBadges({ items }: { items: OwnerBadgeCatalogEntry[] }) {
  if (!items.length) return <Text style={styles.empty}>Rozet kataloğu yükleniyor…</Text>;
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.section}>ROZET KATALOĞU</Text>
        <Text style={styles.body}>
          Korunan rozetler sistem tarafından yönetilir. Atanabilir rozetleri kullanıcı ayrıntısından
          verebilir veya kaldırabilirsin.
        </Text>
      </View>
      {items.map((item) => (
        <View
          key={item.code}
          style={[styles.reportCard, { borderLeftColor: item.color, borderLeftWidth: 4 }]}
        >
          <View style={styles.reportHead}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.reportStatus}>
              {item.protected ? 'Korunan' : item.assignable ? 'Atanabilir' : 'Otomatik'}
            </Text>
          </View>
          <Text style={styles.body}>{item.description}</Text>
          <Text style={styles.meta}>{item.code}</Text>
        </View>
      ))}
    </>
  );
}

function OwnerReports({
  reports,
  contentReports,
  selectReport,
  selectContent,
}: {
  reports: UserReport[];
  contentReports: ContentReport[];
  selectReport(value: UserReport): void;
  selectContent(value: ContentReport): void;
}) {
  if (!reports.length && !contentReports.length)
    return <Text style={styles.empty}>Açık veya geçmiş bildirim yok.</Text>;
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.section}>MODERASYON MERKEZİ</Text>
        <Text style={styles.body}>
          {reports.length} ürün raporu ve {contentReports.length} içerik bildirimi tek sırada.
        </Text>
      </View>
      {reports.map((report) => (
        <Pressable key={report.id} style={styles.reportCard} onPress={() => selectReport(report)}>
          <View style={styles.reportHead}>
            <Text style={styles.category}>{categoryLabel(report.category)}</Text>
            <Text style={[styles.reportStatus, report.status === 'OPEN' && styles.open]}>
              {statusLabel(report.status)}
            </Text>
          </View>
          <Text style={styles.name}>{report.title}</Text>
          <Text numberOfLines={2} style={styles.body}>
            {report.description}
          </Text>
          <Text style={styles.meta}>
            @{report.reporter.username} · {new Date(report.createdAt).toLocaleString('tr-TR')}
          </Text>
        </Pressable>
      ))}
      {contentReports.map((report) => (
        <Pressable key={report.id} style={styles.reportCard} onPress={() => selectContent(report)}>
          <View style={styles.reportHead}>
            <Text style={styles.category}>
              {contentTargetLabel(report.targetType)} · {contentReasonLabel(report.reason)}
            </Text>
            <Text style={[styles.reportStatus, report.status === 'OPEN' && styles.open]}>
              {statusLabel(report.status)}
            </Text>
          </View>
          {report.target.contextLabel ? (
            <Text style={styles.name}>{report.target.contextLabel}</Text>
          ) : null}
          {report.target.messageContent ? (
            <Text numberOfLines={2} style={styles.body}>
              {report.target.messageContent}
            </Text>
          ) : null}
          <Text style={styles.meta}>
            @{report.reporter.username} · {new Date(report.createdAt).toLocaleString('tr-TR')}
            {report.reporterCount > 1 ? ` · ${report.reporterCount} bildirim` : ''}
          </Text>
        </Pressable>
      ))}
    </>
  );
}

function OwnerAnnouncements({
  items,
  access,
  refresh,
}: {
  items: OwnerAnnouncement[];
  access: string;
  refresh(): Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<OwnerAnnouncement['severity']>('INFO');
  const [audience, setAudience] = useState<OwnerAnnouncement['audience']>('ALL');
  const [targetIds, setTargetIds] = useState('');
  const [busy, setBusy] = useState(false);
  const recipients = targetIds
    .split(/[\s,]+/u)
    .map((value) => value.trim())
    .filter(Boolean);
  function send() {
    if (
      busy ||
      title.trim().length < 3 ||
      !body.trim() ||
      (audience === 'SELECTED' && recipients.length === 0)
    )
      return;
    Alert.alert(
      'Sistem duyurusunu gönder',
      'Bu mesaj Wapve sistem hesabından seçilen hedeflere DM olarak gönderilecek.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Gönder',
          onPress: () =>
            void (async () => {
              setBusy(true);
              try {
                await api.request('/owner/announcements', {
                  method: 'POST',
                  headers: ownerHeaders(access),
                  body: {
                    title: title.trim(),
                    body: body.trim(),
                    severity,
                    audience,
                    targetUserIds: audience === 'SELECTED' ? recipients : [],
                    confirmation: 'SEND',
                  },
                });
                setTitle('');
                setBody('');
                setTargetIds('');
                await refresh();
              } finally {
                setBusy(false);
              }
            })(),
        },
      ],
    );
  }
  return (
    <>
      <View style={styles.systemIdentity}>
        <Image
          source={require('../../web/public/brand/wapve-system-avatar.png') as number}
          style={styles.systemAvatar}
          contentFit="cover"
        />
        <View style={styles.copy}>
          <View style={styles.identityTitle}>
            <Text style={styles.title}>Wapve</Text>
            <Image
              source={require('../../web/public/brand/wapve-system-badge.png') as number}
              style={styles.systemBadge}
              contentFit="contain"
            />
          </View>
          <Text style={styles.meta}>Doğrulanmış, tek yönlü sistem mesajı profili</Text>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.section}>YENİ DUYURU</Text>
        <Field label="Başlık" value={title} onChangeText={setTitle} maxLength={120} />
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={4000}
          placeholder="Mesaj içeriği"
          placeholderTextColor={colors.textDim}
          style={[styles.input, styles.reason]}
        />
        <Text style={styles.section}>ÖNEM</Text>
        <ChoiceRow
          values={['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'] as const}
          current={severity}
          setCurrent={(value: OwnerAnnouncement['severity']) => setSeverity(value)}
        />
        <Text style={styles.section}>HEDEF</Text>
        <ChoiceRow
          values={['ALL', 'ACTIVE', 'ALPHA', 'SELECTED'] as const}
          current={audience}
          setCurrent={(value: OwnerAnnouncement['audience']) => setAudience(value)}
        />
        {audience === 'SELECTED' ? (
          <TextInput
            value={targetIds}
            onChangeText={setTargetIds}
            multiline
            placeholder="Kullanıcı UUID'leri; virgül veya boşlukla ayır"
            placeholderTextColor={colors.textDim}
            style={[styles.input, styles.reason]}
          />
        ) : null}
        <Button
          label="Wapve olarak gönder"
          loading={busy}
          disabled={title.trim().length < 3 || !body.trim()}
          onPress={send}
        />
      </View>
      {items.map((item) => (
        <View key={item.id} style={styles.reportCard}>
          <View style={styles.reportHead}>
            <Text style={styles.category}>
              {item.severity} · {item.audience}
            </Text>
            <Text style={styles.reportStatus}>{item.status}</Text>
          </View>
          <Text style={styles.name}>{item.title}</Text>
          <Text numberOfLines={3} style={styles.body}>
            {item.body}
          </Text>
          <Text style={styles.meta}>
            {item.sentCount} ulaştı · {item.failedCount} başarısız ·{' '}
            {new Date(item.createdAt).toLocaleString('tr-TR')}
          </Text>
        </View>
      ))}
    </>
  );
}

function OwnerSettings({
  items,
  access,
  refresh,
}: {
  items: OwnerPlatformSetting[];
  access: string;
  refresh(): Promise<void>;
}) {
  async function update(item: OwnerPlatformSetting, value: boolean | number) {
    await api.request(`/owner/settings/${encodeURIComponent(item.key)}`, {
      method: 'PATCH',
      headers: ownerHeaders(access),
      body: { value, reason: 'Mobil sahip panelinden değiştirildi' },
    });
    await refresh();
  }
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.section}>PLATFORM AYARLARI</Text>
        <Text style={styles.body}>
          Kayıt, bakım, keşfet, medya limitleri, moderasyon ve otomatik sistem DM davranışlarını
          canlı olarak yönet.
        </Text>
      </View>
      {items.map((item) => (
        <View key={item.key} style={styles.reportCard}>
          <Text style={styles.name}>{settingLabel(item.key)}</Text>
          <Text style={styles.body}>{item.description}</Text>
          <Text style={styles.meta}>
            {item.key} · Son değer: {String(item.value)}
          </Text>
          {typeof item.value === 'boolean' ? (
            <Button
              label={item.value ? 'Devre dışı bırak' : 'Etkinleştir'}
              variant={item.value ? 'danger' : 'secondary'}
              onPress={() => void update(item, !item.value)}
            />
          ) : (
            <View style={styles.numberControl}>
              <Pressable
                style={styles.numberButton}
                onPress={() => void update(item, Math.max(1, Number(item.value) - 1))}
              >
                <Text style={styles.name}>−</Text>
              </Pressable>
              <Text style={styles.statValue}>{String(item.value)}</Text>
              <Pressable
                style={styles.numberButton}
                onPress={() => void update(item, Number(item.value) + 1)}
              >
                <Text style={styles.name}>+</Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}
    </>
  );
}

function OwnerOperationsView({ value }: { value: OwnerOperations | undefined }) {
  if (!value) return <Text style={styles.empty}>Sistem durumu yükleniyor…</Text>;
  const cards = [
    ['Veritabanı', value.database],
    ['Redis', value.redis],
    ['Çalışma süresi', durationLabel(value.uptimeSeconds)],
    ['Node', value.nodeVersion],
    ['Bellek', `${value.memory.usedMb} MB`],
    ['RSS', `${value.memory.rssMb} MB`],
    ['Aktif oturum', value.realtime.activeSessions],
    ['Ses bağlantısı', value.realtime.activeVoiceConnections],
    ['Bekleyen görev', value.jobs.pendingScheduledMessages],
    ['Hatalı görev', value.jobs.failedScheduledMessages],
  ];
  return (
    <>
      <View style={styles.stats}>
        {cards.map(([label, current]) => (
          <View key={label} style={styles.stat}>
            <Text style={styles.meta}>{label}</Text>
            <Text
              style={[
                styles.statValue,
                (current === 'DEGRADED' || (label === 'Hatalı görev' && Number(current) > 0)) &&
                  styles.dangerText,
              ]}
            >
              {current}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.meta}>
        30 saniyede bir yenilenir · {new Date(value.generatedAt).toLocaleString('tr-TR')}
      </Text>
    </>
  );
}

function OwnerServers({
  servers,
  edit,
  remove,
}: {
  servers: OwnerServer[];
  edit(server: OwnerServer): void;
  remove(server: OwnerServer): void;
}) {
  if (!servers.length) return <Text style={styles.empty}>Sunucu bulunamadı.</Text>;
  return (
    <>
      {servers.map((server) => (
        <View key={server.id} style={styles.reportCard}>
          <View style={styles.reportHead}>
            <Text style={styles.name}>
              {server.name} · {server.publicId}
            </Text>
            <Text style={[styles.reportStatus, server.platformSuspendedAt && styles.dangerText]}>
              {server.platformSuspendedAt ? 'Askıda' : 'Aktif'}
            </Text>
          </View>
          <Text style={styles.meta}>
            Sahip: @{server.owner.username} · {server.owner.displayName}
          </Text>
          <Text style={styles.meta}>
            {server.memberCount} üye · {server.channelCount} kanal · {server.emojiCount} emoji
          </Text>
          <View style={styles.flagRow}>
            {server.discoveryEnabled ? <Text style={styles.flag}>Keşfet</Text> : null}
            {server.platformFeatured ? <Text style={styles.flag}>Öne çıkan</Text> : null}
            {server.platformVerified ? <Text style={styles.flag}>Doğrulanmış</Text> : null}
          </View>
          <View style={styles.actionRow}>
            <Button label="Yönet" variant="secondary" onPress={() => edit(server)} />
            <Button label="Sunucuyu sil" variant="danger" onPress={() => remove(server)} />
          </View>
        </View>
      ))}
    </>
  );
}

function OwnerAudit({
  events,
  sanctions,
}: {
  events: OwnerAuditEntry[];
  sanctions: OwnerAuditAction[];
}) {
  if (!events.length && !sanctions.length)
    return <Text style={styles.empty}>Henüz yönetim işlemi kaydı yok.</Text>;
  return (
    <>
      {events.map((item) => (
        <View key={item.id} style={styles.reportCard}>
          <Text style={styles.category}>{item.action}</Text>
          {item.targetSnapshot ? <Text style={styles.name}>{item.targetSnapshot}</Text> : null}
          <Text style={styles.meta}>
            {item.actorSnapshot ?? 'Sistem'} · {new Date(item.createdAt).toLocaleString('tr-TR')}
          </Text>
          {item.reason ? <Text style={styles.body}>{item.reason}</Text> : null}
          {item.requestId ? (
            <Text selectable style={styles.meta}>
              İstek: {item.requestId}
            </Text>
          ) : null}
        </View>
      ))}
      {sanctions.length ? (
        <View style={styles.card}>
          <Text style={styles.section}>YAPTIRIM ÖZETİ</Text>
          <Text style={styles.body}>{sanctions.length} geçmiş yaptırım kaydı</Text>
        </View>
      ) : null}
      {sanctions.slice(0, 25).map((item) => (
        <View key={`sanction-${item.id}`} style={styles.reportCard}>
          <Text style={styles.category}>{item.type}</Text>
          <Text style={styles.name}>
            {item.target.displayName} · @{item.target.username}
          </Text>
          <Text style={styles.meta}>
            {item.target.publicId} · {new Date(item.createdAt).toLocaleString('tr-TR')}
          </Text>
          {item.reason ? <Text style={styles.body}>{item.reason}</Text> : null}
        </View>
      ))}
    </>
  );
}

function OwnerServerEditSheet({
  server,
  access,
  close,
  refresh,
}: {
  server: OwnerServer | null;
  access: string;
  close(): void;
  refresh(): Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [suspensionReason, setSuspensionReason] = useState('');
  const [transferUserId, setTransferUserId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setName(server?.name ?? '');
    setDescription(server?.description ?? '');
    setSuspensionReason(server?.platformSuspensionReason ?? '');
    setTransferUserId('');
    setTransferReason('');
  }, [server?.id, server?.name, server?.description, server?.platformSuspensionReason]);
  if (!server) return null;
  const current = server;
  async function request(
    path: string,
    body: Record<string, unknown>,
    method: 'PATCH' | 'POST' = 'POST',
  ) {
    setBusy(true);
    try {
      await api.request(path, { method, headers: ownerHeaders(access), body });
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!name.trim()) return;
    await request(
      `/owner/servers/${current.id}`,
      { name: name.trim(), description: description.trim() || null },
      'PATCH',
    );
    close();
  }
  async function toggleFlag(
    key: 'discoveryEnabled' | 'platformFeatured' | 'platformVerified',
    value: boolean,
  ) {
    await request(`/owner/servers/${current.id}`, { [key]: value }, 'PATCH');
  }
  function suspension() {
    const suspended = !current.platformSuspendedAt;
    if (suspended && suspensionReason.trim().length < 3) return;
    Alert.alert(
      suspended ? 'Sunucuyu askıya al' : 'Askıyı kaldır',
      `${current.name} için işlemi onaylıyor musun?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Onayla',
          style: suspended ? 'destructive' : 'default',
          onPress: () =>
            void request(`/owner/servers/${current.id}/suspension`, {
              suspended,
              reason: suspended ? suspensionReason.trim() : null,
            }),
        },
      ],
    );
  }
  function transfer() {
    if (!/^[0-9a-f-]{36}$/iu.test(transferUserId.trim()) || transferReason.trim().length < 3)
      return;
    Alert.alert('Sahipliği aktar', 'Bu işlem sunucunun sahibini kalıcı olarak değiştirecek.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Aktar',
        style: 'destructive',
        onPress: () =>
          void request(`/owner/servers/${current.id}/transfer`, {
            newOwnerId: transferUserId.trim(),
            reason: transferReason.trim(),
          }),
      },
    ]);
  }
  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <SwipeableSheetSurface onClose={close} style={styles.sheet}>
          <ScrollView
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>Sunucu yönetimi</Text>
            <Text style={styles.meta}>
              {current.publicId} · @{current.owner.username}
            </Text>
            <Field label="Sunucu adı" value={name} onChangeText={setName} maxLength={100} />
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={1000}
              placeholder="Sunucu açıklaması"
              placeholderTextColor={colors.textDim}
              style={[styles.input, styles.reason]}
            />
            <Button
              label="Bilgileri kaydet"
              loading={busy}
              disabled={!name.trim()}
              onPress={() => void save()}
            />
            <Text style={styles.section}>PLATFORM BAYRAKLARI</Text>
            <Button
              label={current.discoveryEnabled ? 'Keşfetten kaldır' : 'Keşfette göster'}
              variant="secondary"
              onPress={() => void toggleFlag('discoveryEnabled', !current.discoveryEnabled)}
            />
            <Button
              label={current.platformFeatured ? 'Öne çıkarmayı kaldır' : 'Öne çıkar'}
              variant="secondary"
              onPress={() => void toggleFlag('platformFeatured', !current.platformFeatured)}
            />
            <Button
              label={current.platformVerified ? 'Doğrulamayı kaldır' : 'Sunucuyu doğrula'}
              variant="secondary"
              onPress={() => void toggleFlag('platformVerified', !current.platformVerified)}
            />
            <Text style={styles.section}>GÜVENLİK</Text>
            {!current.platformSuspendedAt ? (
              <TextInput
                value={suspensionReason}
                onChangeText={setSuspensionReason}
                maxLength={512}
                placeholder="Askıya alma gerekçesi"
                placeholderTextColor={colors.textDim}
                style={styles.input}
              />
            ) : (
              <Text style={styles.body}>{current.platformSuspensionReason}</Text>
            )}
            <Button
              label={
                current.platformSuspendedAt ? 'Sunucunun askısını kaldır' : 'Sunucuyu askıya al'
              }
              variant={current.platformSuspendedAt ? 'secondary' : 'danger'}
              disabled={!current.platformSuspendedAt && suspensionReason.trim().length < 3}
              onPress={suspension}
            />
            <Text style={styles.section}>SAHİPLİK AKTARIMI</Text>
            <Field
              label="Yeni sahip UUID"
              value={transferUserId}
              onChangeText={setTransferUserId}
              autoCapitalize="none"
            />
            <Field
              label="Aktarım gerekçesi"
              value={transferReason}
              onChangeText={setTransferReason}
              maxLength={512}
            />
            <Button
              label="Sahipliği aktar"
              variant="danger"
              disabled={!transferUserId.trim() || transferReason.trim().length < 3}
              onPress={transfer}
            />
          </ScrollView>
        </SwipeableSheetSurface>
      </View>
    </Modal>
  );
}

function OwnerUserSheet({
  user,
  badges,
  access,
  close,
  refresh,
}: {
  user: OwnerUser | null;
  badges: OwnerBadgeCatalogEntry[];
  access: string;
  close(): void;
  refresh(): Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('60');
  const [displayName, setDisplayName] = useState('');
  const [messageTitle, setMessageTitle] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (user) {
      setReason('');
      setDuration('60');
      setDisplayName(user.displayName);
      setMessageTitle('');
      setMessageBody('');
    }
  }, [user?.id, user?.displayName]);
  if (!user) return null;
  const target = user;
  async function action(kind: 'ban' | 'unban' | 'mute' | 'unmute' | 'revoke-sessions') {
    if (busy || ((kind === 'ban' || kind === 'mute') && reason.trim().length < 3)) return;
    setBusy(true);
    try {
      await api.request(`/owner/users/${target.id}/${kind}`, {
        method: 'POST',
        headers: ownerHeaders(access),
        ...(kind === 'ban' || kind === 'mute'
          ? {
              body: {
                reason: reason.trim(),
                ...(kind === 'mute'
                  ? { durationMinutes: duration === '0' ? null : Number(duration) }
                  : {}),
              },
            }
          : {}),
      });
      await refresh();
      close();
    } finally {
      setBusy(false);
    }
  }
  function confirm(kind: 'ban' | 'unban' | 'mute' | 'unmute' | 'revoke-sessions', label: string) {
    Alert.alert(label, `${target.displayName} için bu işlemi onaylıyor musun?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Onayla',
        style: kind === 'ban' || kind === 'revoke-sessions' ? 'destructive' : 'default',
        onPress: () => void action(kind),
      },
    ]);
  }
  async function toggleAlphaBadge() {
    if (busy) return;
    setBusy(true);
    try {
      await api.request(`/owner/users/${target.id}/alpha-badge`, {
        method: 'POST',
        headers: ownerHeaders(access),
        body: { enabled: !target.alphaMember },
      });
      await refresh();
      close();
    } finally {
      setBusy(false);
    }
  }
  async function grantWapvePlus(days: number) {
    if (busy) return;
    setBusy(true);
    try {
      await api.request(`/owner/users/${target.id}/wapve-plus`, {
        method: 'POST',
        headers: ownerHeaders(access),
        body: { days },
      });
      await refresh();
      close();
    } finally {
      setBusy(false);
    }
  }
  async function toggleBadge(badge: PlatformBadge) {
    setBusy(true);
    try {
      await api.request(`/owner/users/${target.id}/badges`, {
        method: 'POST',
        headers: ownerHeaders(access),
        body: { badge, enabled: !target.badges.includes(badge) },
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  async function updateIdentity() {
    if (!displayName.trim()) return;
    setBusy(true);
    try {
      await api.request(`/owner/users/${target.id}`, {
        method: 'PATCH',
        headers: ownerHeaders(access),
        body: { displayName: displayName.trim() },
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  async function verifyEmail() {
    setBusy(true);
    try {
      await api.request(`/owner/users/${target.id}`, {
        method: 'PATCH',
        headers: ownerHeaders(access),
        body: { emailVerified: !target.emailVerified },
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  async function sendSystemMessage() {
    if (messageTitle.trim().length < 3 || !messageBody.trim()) return;
    setBusy(true);
    try {
      await api.request(`/owner/users/${target.id}/system-message`, {
        method: 'POST',
        headers: ownerHeaders(access),
        body: { title: messageTitle.trim(), body: messageBody.trim(), severity: 'INFO' },
      });
      setMessageTitle('');
      setMessageBody('');
      Alert.alert('Gönderildi', 'Wapve sistem mesajı kullanıcının özel mesajlarına eklendi.');
    } finally {
      setBusy(false);
    }
  }
  const protectedTarget = target.platformRole === 'OWNER' || target.system;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <SwipeableSheetSurface onClose={close} style={styles.sheet}>
          <ScrollView
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>{target.displayName}</Text>
            <Text style={styles.meta}>
              @{target.username} · {target.email}
            </Text>
            <Text style={styles.meta}>
              Hesap {target.accountStatus} · {target.sessionCount} oturum · {target.serverCount}{' '}
              sunucu · {target.reportCount} bildirim
            </Text>
            {protectedTarget ? (
              <Text style={styles.warningText}>
                {target.system
                  ? 'Bu resmî Wapve sistem hesabıdır; yaptırım ve kullanıcı etkileşimleri kapalıdır.'
                  : 'Platform sahibi hesabı yaptırımlara karşı korunur.'}
              </Text>
            ) : null}
            <Text style={styles.section}>KİMLİK</Text>
            <Field
              label="Görünen ad"
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={64}
            />
            <Button
              label="Görünen adı güncelle"
              variant="secondary"
              loading={busy}
              onPress={() => void updateIdentity()}
            />
            <Button
              label={
                target.emailVerified
                  ? 'E-posta doğrulamasını kaldır'
                  : 'E-postayı doğrulanmış işaretle'
              }
              variant="secondary"
              loading={busy}
              onPress={() => void verifyEmail()}
            />
            <Text style={styles.section}>ROZETLER</Text>
            <Button
              label={target.alphaMember ? 'Alpha rozetini kaldır' : 'Alpha rozeti ver'}
              variant="secondary"
              loading={busy}
              disabled={target.system}
              onPress={() => void toggleAlphaBadge()}
            />
            <View style={styles.badgePicker}>
              {badges
                .filter((badge) => badge.assignable)
                .map((badge) => (
                  <Pressable
                    key={badge.code}
                    style={[
                      styles.badgeChoice,
                      target.badges.includes(badge.code) && styles.badgeChoiceActive,
                    ]}
                    disabled={busy || target.system}
                    onPress={() => void toggleBadge(badge.code)}
                  >
                    <Text style={styles.meta}>
                      {target.badges.includes(badge.code) ? '✓ ' : ''}
                      {badge.name}
                    </Text>
                  </Pressable>
                ))}
            </View>
            <Text style={styles.section}>WAPVE+</Text>
            <Text style={styles.meta}>
              {target.wapvePlusActive
                ? `Aktif${target.wapvePlusUntil ? ` · ${new Date(target.wapvePlusUntil).toLocaleDateString('tr-TR')}` : ' · Süresiz'}`
                : 'Kapalı'}
            </Text>
            <View style={styles.actionRow}>
              <Button
                label="30 gün ver"
                variant="secondary"
                loading={busy}
                disabled={target.system || target.alphaMember}
                onPress={() => void grantWapvePlus(30)}
              />
              <Button
                label="1 yıl ver"
                variant="secondary"
                loading={busy}
                disabled={target.system || target.alphaMember}
                onPress={() => void grantWapvePlus(365)}
              />
              {target.wapvePlusUntil ? (
                <Button
                  label="Erişimi kaldır"
                  variant="danger"
                  loading={busy}
                  disabled={target.system || target.alphaMember}
                  onPress={() => void grantWapvePlus(0)}
                />
              ) : null}
            </View>
            <Text style={styles.section}>WAPVE SİSTEM MESAJI</Text>
            <Field
              label="Başlık"
              value={messageTitle}
              onChangeText={setMessageTitle}
              maxLength={120}
            />
            <TextInput
              value={messageBody}
              onChangeText={setMessageBody}
              multiline
              maxLength={4000}
              placeholder="Tek yönlü sistem mesajı"
              placeholderTextColor={colors.textDim}
              style={[styles.input, styles.reason]}
            />
            <Button
              label="Wapve olarak DM gönder"
              loading={busy}
              disabled={protectedTarget || messageTitle.trim().length < 3 || !messageBody.trim()}
              onPress={() => void sendSystemMessage()}
            />
            <Text style={styles.section}>YAPTIRIM NEDENİ</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={512}
              placeholder="Yaptırım nedenini yaz"
              placeholderTextColor={colors.textDim}
              style={[styles.input, styles.reason]}
            />
            <Text style={styles.section}>SUSTURMA SÜRESİ</Text>
            <View style={styles.durationRow}>
              {(
                [
                  ['60', '1 saat'],
                  ['1440', '1 gün'],
                  ['10080', '7 gün'],
                  ['0', 'Süresiz'],
                ] as const
              ).map(([value, label]) => (
                <Pressable
                  key={value}
                  style={[styles.duration, duration === value && styles.durationActive]}
                  onPress={() => setDuration(value)}
                >
                  <Text style={styles.meta}>{label}</Text>
                </Pressable>
              ))}
            </View>
            {target.accountStatus === 'SUSPENDED' ? (
              <Button
                label="Yasağı kaldır"
                loading={busy}
                disabled={protectedTarget}
                onPress={() => confirm('unban', 'Yasağı kaldır')}
              />
            ) : (
              <Button
                label="Kullanıcıyı yasakla"
                variant="danger"
                loading={busy}
                disabled={protectedTarget || reason.trim().length < 3}
                onPress={() => confirm('ban', 'Kullanıcıyı yasakla')}
              />
            )}
            {target.muted ? (
              <Button
                label="Global susturmayı kaldır"
                variant="secondary"
                loading={busy}
                disabled={protectedTarget}
                onPress={() => confirm('unmute', 'Susturmayı kaldır')}
              />
            ) : (
              <Button
                label="Global sustur"
                variant="secondary"
                loading={busy}
                disabled={protectedTarget || reason.trim().length < 3}
                onPress={() => confirm('mute', 'Kullanıcıyı sustur')}
              />
            )}
            <Button
              label="Tüm oturumları kapat"
              variant="danger"
              loading={busy}
              disabled={protectedTarget}
              onPress={() => confirm('revoke-sessions', 'Tüm oturumları kapat')}
            />
          </ScrollView>
        </SwipeableSheetSurface>
      </View>
    </Modal>
  );
}

function OwnerReportSheet({
  report,
  access,
  close,
  refresh,
}: {
  report: UserReport | null;
  access: string;
  close(): void;
  refresh(): Promise<void>;
}) {
  const [status, setStatus] = useState<UserReport['status']>('IN_REVIEW');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (report) {
      setStatus(report.status);
      setNote(report.ownerNote ?? '');
    }
  }, [report]);
  if (!report) return null;
  const current = report;
  async function save() {
    setBusy(true);
    try {
      await api.request(`/owner/reports/${current.id}`, {
        method: 'PATCH',
        headers: ownerHeaders(access),
        body: { status, ownerNote: note.trim() || null },
      });
      await refresh();
      close();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <SwipeableSheetSurface onClose={close} style={styles.sheet}>
          <ScrollView
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>{report.title}</Text>
            <Text style={styles.meta}>
              {categoryLabel(report.category)} · @{report.reporter.username}
            </Text>
            <Text style={styles.body}>{report.description}</Text>
            {report.reportedUserId ? (
              <Text style={styles.meta}>Bildirilen kullanıcı kimliği: {report.reportedUserId}</Text>
            ) : null}
            {report.pageUrl ? (
              <Text selectable style={styles.meta}>
                {report.pageUrl}
              </Text>
            ) : null}
            <Text style={styles.section}>DURUM</Text>
            <View style={styles.durationRow}>
              {(['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'] as const).map((value) => (
                <Pressable
                  key={value}
                  style={[styles.duration, status === value && styles.durationActive]}
                  onPress={() => setStatus(value)}
                >
                  <Text style={styles.meta}>{statusLabel(value)}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.section}>SAHİP NOTU</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={2000}
              placeholder="İnceleme notu"
              placeholderTextColor={colors.textDim}
              style={[styles.input, styles.reason]}
            />
            <Button label="Raporu güncelle" loading={busy} onPress={() => void save()} />
          </ScrollView>
        </SwipeableSheetSurface>
      </View>
    </Modal>
  );
}

function OwnerContentReportSheet({
  report,
  access,
  close,
  refresh,
}: {
  report: ContentReport | null;
  access: string;
  close(): void;
  refresh(): Promise<void>;
}) {
  const [status, setStatus] = useState<ContentReport['status']>('IN_REVIEW');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (report) {
      setStatus(report.status);
      setNote(report.ownerNote ?? '');
    }
  }, [report]);
  if (!report) return null;
  const current = report;
  const isMessage =
    current.targetType === 'CHANNEL_MESSAGE' ||
    current.targetType === 'DIRECT_MESSAGE' ||
    current.targetType === 'GROUP_MESSAGE';
  async function save() {
    setBusy(true);
    try {
      await api.request(`/owner/content-reports/${current.id}`, {
        method: 'PATCH',
        headers: ownerHeaders(access),
        body: { status, ownerNote: note.trim() || null },
      });
      await refresh();
      close();
    } finally {
      setBusy(false);
    }
  }
  async function removeTarget() {
    setBusy(true);
    try {
      await api.request(`/owner/content-reports/${current.id}/remove-target`, {
        method: 'POST',
        headers: ownerHeaders(access),
      });
      await refresh();
      close();
    } finally {
      setBusy(false);
    }
  }
  function confirmRemove() {
    Alert.alert('İçeriği sil', 'Bildirilen içerik kalıcı olarak silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => void removeTarget() },
    ]);
  }
  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <SwipeableSheetSurface onClose={close} style={styles.sheet}>
          <ScrollView
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>
              {contentTargetLabel(current.targetType)} · {contentReasonLabel(current.reason)}
            </Text>
            <Text style={styles.meta}>
              Bildiren: @{current.reporter.username} ·{' '}
              {new Date(current.createdAt).toLocaleString('tr-TR')}
              {current.reporterCount > 1 ? ` · ${current.reporterCount} bildirim` : ''}
            </Text>
            {current.target.contextLabel ? (
              <Text style={styles.name}>Hedef: {current.target.contextLabel}</Text>
            ) : null}
            {current.target.messageContent ? (
              <Text style={styles.body}>{current.target.messageContent}</Text>
            ) : null}
            {current.targetRemoved ? <Text style={styles.meta}>İçerik kaldırıldı.</Text> : null}
            {current.target.user ? (
              <Text style={styles.meta}>
                @{current.target.user.username} · {current.target.user.publicId}
              </Text>
            ) : null}
            {current.description ? <Text style={styles.body}>{current.description}</Text> : null}
            <Text style={styles.section}>DURUM</Text>
            <View style={styles.durationRow}>
              {(['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'] as const).map((value) => (
                <Pressable
                  key={value}
                  style={[styles.duration, status === value && styles.durationActive]}
                  onPress={() => setStatus(value)}
                >
                  <Text style={styles.meta}>{statusLabel(value)}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.section}>SAHİP NOTU</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={2000}
              placeholder="İnceleme notu"
              placeholderTextColor={colors.textDim}
              style={[styles.input, styles.reason]}
            />
            {isMessage && !current.targetRemoved ? (
              <Button label="İçeriği sil" variant="danger" loading={busy} onPress={confirmRemove} />
            ) : null}
            <Button label="Bildirimi güncelle" loading={busy} onPress={() => void save()} />
          </ScrollView>
        </SwipeableSheetSurface>
      </View>
    </Modal>
  );
}

function categoryLabel(value: UserReport['category']) {
  return value === 'BUG'
    ? 'Hata'
    : value === 'FEEDBACK'
      ? 'Öneri'
      : value === 'SAFETY'
        ? 'Güvenlik'
        : 'Diğer';
}
function contentTargetLabel(value: ContentReport['targetType']) {
  return value === 'CHANNEL_MESSAGE'
    ? 'Kanal mesajı'
    : value === 'DIRECT_MESSAGE'
      ? 'Özel mesaj'
      : value === 'GROUP_MESSAGE'
        ? 'Grup mesajı'
        : value === 'USER'
          ? 'Kullanıcı'
          : 'Sunucu';
}
function contentReasonLabel(value: ContentReport['reason']) {
  return value === 'SPAM'
    ? 'Spam'
    : value === 'HARASSMENT'
      ? 'Taciz'
      : value === 'HATE_SPEECH'
        ? 'Nefret söylemi'
        : value === 'SEXUAL_CONTENT'
          ? 'Cinsel içerik'
          : value === 'VIOLENCE'
            ? 'Şiddet'
            : value === 'SCAM_FRAUD'
              ? 'Dolandırıcılık'
              : value === 'ILLEGAL_CONTENT'
                ? 'Yasa dışı içerik'
                : value === 'SELF_HARM'
                  ? 'Kendine zarar'
                  : value === 'IMPERSONATION'
                    ? 'Kimliğe bürünme'
                    : 'Diğer';
}
function statusLabel(value: UserReport['status']) {
  return value === 'OPEN'
    ? 'Açık'
    : value === 'IN_REVIEW'
      ? 'İnceleniyor'
      : value === 'RESOLVED'
        ? 'Çözüldü'
        : 'Kapatıldı';
}
function settingLabel(value: OwnerPlatformSetting['key']) {
  const labels: Record<OwnerPlatformSetting['key'], string> = {
    'registration.enabled': 'Yeni hesap kaydı',
    'maintenance.enabled': 'Bakım modu',
    'discovery.enabled': 'Sunucu keşfet',
    'media.uploadMaxMb': 'Dosya yükleme limiti (MB)',
    'media.textPreviewMaxKb': 'Metin önizleme limiti (KB)',
    'moderation.defaultSpamThreshold': 'Varsayılan spam eşiği',
    'systemMessages.moderation': 'Moderasyon sistem DM’leri',
    'systemMessages.reports': 'Rapor sistem DM’leri',
    'systemMessages.security': 'Güvenlik sistem DM’leri',
    'systemMessages.badges': 'Rozet sistem DM’leri',
  };
  return labels[value];
}
function durationLabel(seconds: number) {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  return days ? `${days}g ${hours}s` : `${hours}s ${Math.floor((seconds % 3_600) / 60)}dk`;
}
function ChoiceRow<T extends string>({
  values,
  current,
  setCurrent,
}: {
  values: readonly T[];
  current: T;
  setCurrent(value: T): void;
}) {
  return (
    <View style={styles.durationRow}>
      {values.map((value) => (
        <Pressable
          key={value}
          style={[styles.duration, current === value && styles.durationActive]}
          onPress={() => setCurrent(value)}
        >
          <Text style={styles.meta}>{value}</Text>
        </Pressable>
      ))}
    </View>
  );
}
function ownerHeaders(token: string) {
  return { 'X-Wapve-Owner-Access': token };
}
function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress(): void;
}) {
  return (
    <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}
function Back() {
  return (
    <Pressable style={styles.iconButton} onPress={() => router.back()} accessibilityLabel="Geri">
      <Icon name="arrow-left" color={colors.text} size={27} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  copy: { flex: 1 },
  iconButton: {
    width: touch.minimum,
    height: touch.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  crown: {
    width: 62,
    height: 62,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  title: { color: colors.text, ...typography.title },
  name: { color: colors.text, ...typography.heading },
  body: { color: colors.textMuted, ...typography.body },
  meta: { color: colors.textDim, ...typography.caption },
  section: { color: colors.textDim, ...typography.caption, fontWeight: '800', letterSpacing: 1 },
  tabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  tab: {
    minWidth: 112,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
  },
  tabActive: { backgroundColor: colors.wave },
  tabText: { color: colors.textMuted, ...typography.label },
  tabTextActive: { color: colors.text },
  accessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  input: {
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    ...typography.body,
  },
  userCard: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  empty: { color: colors.textMuted, ...typography.body, padding: spacing.lg, textAlign: 'center' },
  reportCard: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  reportHead: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  category: { color: colors.waveBright, ...typography.label },
  reportStatus: { color: colors.textMuted, ...typography.caption },
  open: { color: colors.warning },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    flexGrow: 1,
    width: '47%',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  statValue: { color: colors.text, ...typography.title },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    maxHeight: '92%',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sheetContent: { gap: spacing.md, paddingBottom: spacing.xxl },
  reason: { minHeight: 110, paddingTop: spacing.sm, textAlignVertical: 'top' },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  duration: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  durationActive: { borderColor: colors.waveBright, backgroundColor: colors.surfaceRaised },
  badgeLine: { color: colors.waveBright, ...typography.caption, marginTop: spacing.xs },
  badgePicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  badgeChoice: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  badgeChoiceActive: { borderColor: colors.waveBright, backgroundColor: colors.surfaceRaised },
  flagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  flag: {
    color: colors.waveBright,
    ...typography.caption,
    borderWidth: 1,
    borderColor: colors.waveBright,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  systemIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.waveBright,
    backgroundColor: colors.surface,
  },
  systemAvatar: { width: 58, height: 58, borderRadius: 29 },
  identityTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  systemBadge: { width: 24, height: 24 },
  numberControl: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  numberButton: {
    width: touch.minimum,
    height: touch.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceRaised,
  },
  dangerText: { color: colors.danger },
  warningText: { color: colors.warning, ...typography.body },
});
