import { TextInput, Text, Modal, Pressable, Switch, Alert } from '@/components/localized-native';
import { serverInviteUrl } from '@wapve/contracts';
import type {
  AutoModConfig,
  AutoModAction,
  ChannelPermissionSettings,
  ChannelPermissionTargetState,
  ChannelPermissionValue,
  ChannelTree,
  ServerAuditPage,
  ServerAuditEvent,
  ServerBan,
  ServerChannel,
  ServerInvite,
  ServerInsights,
  ServerMember,
  ServerPermission,
  ServerRole,
  ServerSummary,
  ServerEmoji,
  ServerNotificationPreference,
  ChannelNotificationPreference,
  NotificationLevel,
  NotificationMute,
  } from '@wapve/contracts';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { router,
  useFocusEffect,
  useLocalSearchParams } from 'expo-router';
import { useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode } from 'react';
import {
  BackHandler,
  ScrollView,
  StyleSheet,
  View,
} from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { colors, radius, spacing, touch, typography } from '@wapve/design-tokens';
import { Avatar, Button, ScreenHeader, SecureImage } from '@/components/ui';
import { Icon, type IconName } from '@/components/icon';
import { api, mobileUpload } from '@/lib/client';
import { useDeveloperMode } from '@/lib/developer-mode';
import { SwipeableSheetSurface } from '@/components/swipeable-sheet';
import { NestableDraggableFlatList, NestableScrollContainer, type RenderItemParams } from 'react-native-draggable-flatlist';
import { ImageCropEditor, type CropResult, type CropSource } from '@/components/image-crop-editor';
import { categoryOrderFromRows, channelOrderFromRows, type ChannelLayoutRow as LayoutRow } from '@/lib/channel-layout';
import { MobileServerSupportPanel } from '@/components/server-support-panel';
import { Soundboard } from '@/components/soundboard';
import { ServerTagSettings } from '@/components/server-tag';

type Tab = 'overview' | 'supports' | 'channels' | 'roles' | 'members' | 'notifications' | 'invites' | 'automod' | 'audit' | 'bans' | 'insights' | 'emojis' | 'soundboard' | 'tag';
const tabs: Array<{ id: Tab; label: string; icon: IconName }> = [
  { id: 'tag', label: 'Sunucu etiketi', icon: 'tag-outline' },
  { id: 'soundboard', label: 'Ses tahtası', icon: 'music-note' },
  { id: 'overview', label: 'Genel', icon: 'server-outline' },
  { id: 'supports', label: 'Woost', icon: 'diamond-stone' },
  { id: 'channels', label: 'Kanallar', icon: 'pound' },
  { id: 'roles', label: 'Roller', icon: 'shield-account-outline' },
  { id: 'members', label: 'Üyeler', icon: 'account-multiple-outline' },
  { id: 'notifications', label: 'Bildirimler', icon: 'bell-outline' },
  { id: 'invites', label: 'Davetler', icon: 'account-plus-outline' },
  { id: 'automod', label: 'AutoMod', icon: 'robot-outline' },
  { id: 'audit', label: 'Denetim', icon: 'clipboard-text-clock-outline' },
  { id: 'bans', label: 'Yasaklar', icon: 'account-cancel-outline' },
  { id: 'insights', label: 'İstatistikler', icon: 'chart-bar' },
  { id: 'emojis', label: 'Emojiler', icon: 'emoticon-outline' },
];
function isSettingsTab(value: string | undefined): value is Tab {
  return tabs.some((item) => item.id === value);
}
const permissions: Array<{
  id: ServerPermission;
  label: string;
  description: string;
  group: string;
}> = [
  { id: 'MANAGE_EXPRESSIONS', label: 'Emoji ve sesleri yönet', description: 'Özel emoji ve ses tahtası içeriklerini yönetebilir.', group: 'Yönetim' },
  { id: 'USE_EXTERNAL_EMOJIS', label: 'Harici emojileri kullan', description: 'Başka sunucuların emojilerini kullanabilir.', group: 'Metin' },
  { id: 'USE_SOUNDBOARD', label: 'Ses tahtasını kullan', description: 'Sesli kanalda ses tahtasından ses çalabilir.', group: 'Ses' },
  { id: 'USE_EXTERNAL_SOUNDS', label: 'Harici sesleri kullan', description: 'Başka sunucuların seslerini çalabilir.', group: 'Ses' },
  {
    id: 'MANAGE_SERVER',
    label: 'Sunucuyu yönet',
    description: 'Sunucu adını, profilini ve genel ayarlarını değiştirebilir.',
    group: 'Yönetim',
  },
  {
    id: 'MANAGE_ROLES',
    label: 'Rolleri yönet',
    description: 'Kendi rolünün altındaki rolleri oluşturabilir ve düzenleyebilir.',
    group: 'Yönetim',
  },
  {
    id: 'MANAGE_CHANNELS',
    label: 'Kanalları yönet',
    description: 'Kanal ve kategorileri oluşturabilir, düzenleyebilir ve silebilir.',
    group: 'Yönetim',
  },
  {
    id: 'MANAGE_AUTOMOD',
    label: 'AutoMod yönet',
    description: 'Otomatik moderasyon kurallarını ve istisnalarını değiştirebilir.',
    group: 'Yönetim',
  },
  {
    id: 'VIEW_AUDIT_LOG',
    label: 'Denetim kaydını gör',
    description: 'Yönetim ve moderasyon işlemlerinin geçmişini görebilir.',
    group: 'Yönetim',
  },
  {
    id: 'CREATE_INVITES',
    label: 'Davet oluştur',
    description: 'Sunucuya yeni üyeler çağıran bağlantılar oluşturabilir.',
    group: 'Üyelik',
  },
  {
    id: 'MENTION_EVERYONE',
    label: '@weryone etiketle',
    description: 'Sunucudaki herkese bildirim gönderen etiketleri kullanabilir.',
    group: 'Üyelik',
  },
  {
    id: 'KICK_MEMBERS',
    label: 'Üyeleri at',
    description: 'Üyeleri sunucudan çıkarabilir; yeniden davetle dönebilirler.',
    group: 'Üyelik',
  },
  {
    id: 'BAN_MEMBERS',
    label: 'Üyeleri yasakla',
    description: 'Üyelerin sunucuya tekrar katılmasını engelleyebilir.',
    group: 'Üyelik',
  },
  {
    id: 'TIMEOUT_MEMBERS',
    label: 'Üyelere mola ver',
    description: 'Belirli süreyle mesaj ve ses etkileşimini kısıtlayabilir.',
    group: 'Üyelik',
  },
  {
    id: 'VIEW_CHANNEL',
    label: 'Kanalları gör',
    description: 'İzin verilen metin ve ses kanallarını görüntüleyebilir.',
    group: 'Metin',
  },
  {
    id: 'SEND_MESSAGES',
    label: 'Mesaj gönder',
    description: 'Metin kanallarında yeni mesaj gönderebilir.',
    group: 'Metin',
  },
  {
    id: 'MANAGE_MESSAGES',
    label: 'Mesajları yönet',
    description: 'Diğer üyelerin mesajlarını silebilir ve sabitleyebilir.',
    group: 'Metin',
  },
  {
    id: 'ATTACH_FILES',
    label: 'Dosya ekle',
    description: 'Mesajlara fotoğraf, video ve dosya ekleyebilir.',
    group: 'Metin',
  },
  {
    id: 'USE_GIFS',
    label: 'GIF kullan',
    description: 'GIF araması yapabilir ve GIF gönderebilir.',
    group: 'Metin',
  },
  {
    id: 'ADD_REACTIONS',
    label: 'Tepki ekle',
    description: 'Mesajlara emoji tepkileri ekleyebilir.',
    group: 'Metin',
  },
  {
    id: 'CREATE_POLLS',
    label: 'Anket oluştur',
    description: 'Kanallarda oy kullanılabilen anketler yayınlayabilir.',
    group: 'Metin',
  },
  {
    id: 'CONNECT',
    label: 'Ses kanalına bağlan',
    description: 'Ses kanallarına katılabilir ve diğer üyeleri dinleyebilir.',
    group: 'Ses',
  },
  {
    id: 'SPEAK',
    label: 'Konuş',
    description: 'Ses kanallarında mikrofonunu kullanabilir.',
    group: 'Ses',
  },
  {
    id: 'USE_CAMERA',
    label: 'Kamera kullan',
    description: 'Ses kanallarında kamerasını açabilir.',
    group: 'Ses',
  },
  {
    id: 'SHARE_SCREEN',
    label: 'Ekran paylaş',
    description: 'Ses kanallarında ekran yayını başlatabilir.',
    group: 'Ses',
  },
];

export default function ServerSettingsScreen() {
  const {
    serverId = '',
    tab: requestedTab,
    channelId: requestedChannelId,
  } = useLocalSearchParams<{ serverId: string; tab?: string; channelId?: string }>();
  const { enabled: developerMode } = useDeveloperMode();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab | null>(() => isSettingsTab(requestedTab) ? requestedTab : null);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!tab) return false;
      setTab(null);
      return true;
    });
    return () => subscription.remove();
  }, [tab]));
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [afkChannelId, setAfkChannelId] = useState<string | null>(null);
  const [afkTimeout, setAfkTimeout] = useState(300);
  const [discoveryEnabled, setDiscoveryEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createChannel, setCreateChannel] = useState(false);
  const [createCategory, setCreateCategory] = useState(false);
  const [createRole, setCreateRole] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<ServerChannel | null>(null);
  const openedChannelParam = useRef<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ChannelTree['categories'][number] | null>(null);
  const [selectedRole, setSelectedRole] = useState<ServerRole | null>(null);
  const [selectedMember, setSelectedMember] = useState<ServerMember | null>(null);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditActorFilter, setAuditActorFilter] = useState('');
  const [auditTargetFilter, setAuditTargetFilter] = useState('');
  const [selectedAuditEvent, setSelectedAuditEvent] = useState<ServerAuditEvent | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [brandingPicker, setBrandingPicker] = useState<'icon' | 'banner' | null>(null);
  const [brandingCrop, setBrandingCrop] = useState<{ kind: 'icon' | 'banner'; source: CropSource } | null>(null);
  const servers = useQuery({
    queryKey: ['servers'],
    queryFn: () => api.request<ServerSummary[]>('/servers'),
  });
  const channels = useQuery({
    queryKey: ['channels', serverId],
    enabled: Boolean(serverId),
    queryFn: () => api.request<ChannelTree>(`/servers/${serverId}/channels`),
  });
  const roles = useQuery({
    queryKey: ['server-roles', serverId],
    enabled: Boolean(serverId),
    queryFn: () => api.request<ServerRole[]>(`/servers/${serverId}/roles`),
  });
  const members = useQuery({
    queryKey: ['server-members', serverId],
    enabled:
      tab === 'members' || tab === 'audit' || Boolean(selectedRole) || Boolean(selectedChannel),
    queryFn: () => api.request<ServerMember[]>(`/servers/${serverId}/members`),
  });
  const invites = useQuery({
    queryKey: ['server-invites', serverId],
    enabled: tab === 'invites',
    queryFn: () => api.request<ServerInvite[]>(`/servers/${serverId}/invites`),
  });
  const automod = useQuery({
    queryKey: ['server-automod', serverId],
    enabled: tab === 'automod',
    queryFn: () => api.request<AutoModConfig>(`/servers/${serverId}/automod`),
  });
  const audit = useInfiniteQuery({
    queryKey: ['server-audit', serverId, auditActionFilter, auditActorFilter, auditTargetFilter],
    enabled: tab === 'audit',
    queryFn: ({ pageParam }) => {
      const filters = [
        'limit=50',
        auditActionFilter ? `action=${encodeURIComponent(auditActionFilter)}` : '',
        auditActorFilter ? `actorId=${encodeURIComponent(auditActorFilter)}` : '',
        auditTargetFilter ? `targetId=${encodeURIComponent(auditTargetFilter)}` : '',
        pageParam ? `before=${encodeURIComponent(pageParam)}` : '',
      ]
        .filter(Boolean)
        .join('&');
      return api.request<ServerAuditPage>(`/servers/${serverId}/audit-logs?${filters}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const bans = useQuery({
    queryKey: ['server-bans', serverId],
    enabled: tab === 'bans',
    queryFn: () => api.request<ServerBan[]>(`/servers/${serverId}/bans`),
  });
  const insights = useQuery({
    queryKey: ['server-insights', serverId],
    enabled: tab === 'insights',
    queryFn: () => api.request<ServerInsights>(`/servers/${serverId}/insights?days=7`),
  });
  const server = servers.data?.find((item) => item.id === serverId);
  const canManage = server?.role === 'OWNER' || Boolean(server?.permissions.includes('MANAGE_SERVER'));
  useEffect(() => {
    if (isSettingsTab(requestedTab)) setTab(requestedTab);
  }, [requestedTab]);
  useEffect(() => {
    if (!requestedChannelId || openedChannelParam.current === requestedChannelId) return;
    const channel = channels.data?.channels.find((item) => item.id === requestedChannelId);
    if (!channel) return;
    openedChannelParam.current = requestedChannelId;
    setTab('channels');
    setSelectedChannel(channel);
  }, [channels.data?.channels, requestedChannelId]);
  useEffect(() => {
    if (!server) return;
    setName(server.name);
    setDescription(server.description ?? '');
    setAfkChannelId(server.afkChannelId);
    setAfkTimeout(server.afkTimeoutSeconds);
    setDiscoveryEnabled(server.discoveryEnabled);
  }, [server]);

  async function saveOverview() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.request(`/servers/${serverId}`, {
        method: 'PATCH',
        body: {
          name: name.trim(),
          description: description.trim() || null,
          afkChannelId,
          afkTimeoutSeconds: afkTimeout,
          discoveryEnabled,
        },
      });
      await servers.refetch();
      await queryClient.invalidateQueries({ queryKey: ['servers'] });
    } finally {
      setSaving(false);
    }
  }
  async function uploadBranding(kind: 'icon' | 'banner', source: 'library' | 'camera') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.assets?.[0];
    if (!asset) return;
    setBrandingPicker(null);
    setBrandingCrop({ kind, source: { uri: asset.uri, width: asset.width, height: asset.height, fileName: asset.fileName ?? `${kind}.jpg` } });
  }
  async function applyBrandingCrop(result: CropResult) { if (!brandingCrop) return; const kind = brandingCrop.kind; await mobileUpload(`/servers/${serverId}/${kind}`, result.uri, result.fileName); setBrandingCrop(null); await servers.refetch(); await queryClient.invalidateQueries({ queryKey: ['servers'] }); }

  return (
    <SafeAreaView style={styles.root}>
      <ScreenHeader
        title={tabs.find(item => item.id === tab)?.label ?? 'Sunucu ayarları'}
        left={
          <Pressable
            style={styles.iconButton}
            onPress={() => tab ? setTab(null) : router.back()}
            accessibilityLabel="Geri"
          >
            <Icon name="arrow-left" color={colors.text} size={27} />
          </Pressable>
        }
      />
      <View style={styles.serverHead}>
        {server?.iconUrl ? (
          <SecureImage uri={server.iconUrl} revision={servers.dataUpdatedAt} style={styles.serverMark} contentFit="cover" />
        ) : (
          <View style={styles.serverMark}>
            <Text style={styles.serverMarkText}>
              {server?.name.slice(0, 2).toUpperCase() ?? 'WA'}
            </Text>
          </View>
        )}
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.serverName}>
            {server?.name ?? 'Sunucu'}
          </Text>
          <Text style={styles.serverMeta}>
            {developerMode && server?.publicId ? `${server.publicId} · ` : ''}{server?.memberCount ?? 0} üye
          </Text>
        </View>
      </View>
      <NestableScrollContainer
        style={styles.mainScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {!tab && tabs.filter(item => (item.id !== 'insights' || canManage) && (item.id !== 'soundboard' || server?.role === 'OWNER' || server?.permissions.includes('MANAGE_EXPRESSIONS'))).map(item => <Pressable key={item.id} onPress={() => setTab(item.id)} accessibilityRole="button" style={{ minHeight: 64, borderRadius: 16, backgroundColor: colors.surface, paddingHorizontal: 16, flexDirection: 'row', gap: 16, alignItems: 'center' }}><Icon name={item.icon} color={colors.waveBright} /><Text style={{ flex: 1, color: colors.text, fontSize: 16 }}>{item.label}</Text><Icon name="chevron-right" color={colors.textMuted} /></Pressable>)}
        {tab === 'overview' ? (
          <OverviewPanel
            server={server}
            mediaRevision={servers.dataUpdatedAt}
            name={name}
            description={description}
            afkChannelId={afkChannelId}
            afkTimeout={afkTimeout}
            discoveryEnabled={discoveryEnabled}
            channels={channels.data?.channels ?? []}
            saving={saving}
            setName={setName}
            setDescription={setDescription}
            setAfkChannelId={setAfkChannelId}
            setAfkTimeout={setAfkTimeout}
            setDiscoveryEnabled={setDiscoveryEnabled}
            save={saveOverview}
            upload={setBrandingPicker}
            deleteServer={() => setDeleteOpen(true)}
          />
        ) : null}
        {tab === 'supports' && server ? <MobileServerSupportPanel server={server} /> : null}
        {tab === 'channels' ? (
          <ChannelsPanel
            serverId={serverId}
            tree={channels.data}
            createChannel={() => setCreateChannel(true)}
            createCategory={() => setCreateCategory(true)}
            edit={setSelectedChannel}
            editCategory={setSelectedCategory}
            refresh={() => channels.refetch()}
          />
        ) : null}
        {tab === 'roles' ? (
          <RolesPanel
            serverId={serverId}
            roles={roles.data ?? []}
            create={() => setCreateRole(true)}
            edit={setSelectedRole}
            refresh={() => roles.refetch()}
          />
        ) : null}
        {tab === 'members' ? (
          <MembersPanel members={members.data ?? []} select={setSelectedMember} />
        ) : null}
        {tab === 'notifications' ? <NotificationPreferencesPanel serverId={serverId} channels={channels.data?.channels ?? []} /> : null}
        {tab === 'invites' ? (
          <InvitesPanel
            serverId={serverId}
            invites={invites.data ?? []}
            channels={channels.data?.channels ?? []}
            refresh={() => invites.refetch()}
          />
        ) : null}
        {tab === 'automod' ? (
          <AutoModPanel
            serverId={serverId}
            config={automod.data}
            roles={roles.data ?? []}
            channels={channels.data?.channels ?? []}
            refresh={() => automod.refetch()}
          />
        ) : null}
        {tab === 'audit' ? (
          <AuditPanel
            events={audit.data?.pages.flatMap((page) => page.items) ?? []}
            hasMore={Boolean(audit.hasNextPage)}
            loadingMore={audit.isFetchingNextPage}
            loadMore={() => audit.fetchNextPage()}
            select={setSelectedAuditEvent}
            members={members.data ?? []}
            action={auditActionFilter}
            actor={auditActorFilter}
            target={auditTargetFilter}
            setAction={setAuditActionFilter}
            setActor={setAuditActorFilter}
            setTarget={setAuditTargetFilter}
          />
        ) : null}
        {tab === 'bans' ? (
          <BansPanel serverId={serverId} bans={bans.data ?? []} refresh={() => bans.refetch()} />
        ) : null}
        {tab === 'insights' && canManage ? (
          <InsightsPanel insights={insights.data} loading={insights.isLoading} />
        ) : null}
        {tab === 'tag' && server ? <ServerTagSettings server={server} /> : null}
        {tab === 'soundboard' && (server?.role === 'OWNER' || server?.permissions.includes('MANAGE_EXPRESSIONS')) ? <Soundboard serverId={serverId} manage /> : null}
        {tab === 'emojis' ? <ServerEmojisPanel serverId={serverId} canManage={server?.role === 'OWNER' || Boolean(server?.permissions.includes('MANAGE_EXPRESSIONS'))} limit={server?.supportLevel === 3 ? 200 : server?.supportLevel === 2 ? 100 : server?.supportLevel === 1 ? 50 : 25} /> : null}
      </NestableScrollContainer>
      <CreateChannelSheet
        visible={createChannel}
        close={() => setCreateChannel(false)}
        submit={async (channelName, type) => {
          await api.request(`/servers/${serverId}/channels`, {
            method: 'POST',
            body: { name: channelName, type, nsfw: false },
          });
          setCreateChannel(false);
          await channels.refetch();
        }}
      />
      <NameSheet
        visible={createCategory}
        title="Kategori oluştur"
        placeholder="Kategori adı"
        close={() => setCreateCategory(false)}
        submit={async (categoryName) => {
          await api.request(`/servers/${serverId}/categories`, {
            method: 'POST',
            body: { name: categoryName },
          });
          setCreateCategory(false);
          await channels.refetch();
        }}
      />
      <CreateRoleSheet
        visible={createRole}
        close={() => setCreateRole(false)}
        submit={async (roleName, color, hoist) => {
          await api.request(`/servers/${serverId}/roles`, {
            method: 'POST',
            body: { name: roleName, color, hoist, mentionable: false, permissions: [] },
          });
          setCreateRole(false);
          await roles.refetch();
        }}
      />
      <ChannelEditor
        serverId={serverId}
        bitrateCap={server?.supportLevel === 3 ? 384 : server?.supportLevel === 2 ? 256 : server?.supportLevel === 1 ? 128 : 96}
        channel={selectedChannel}
        categories={channels.data?.categories ?? []}
        roles={roles.data ?? []}
        members={members.data ?? []}
        close={() => setSelectedChannel(null)}
        refresh={() => channels.refetch()}
      />
      <CategoryEditor serverId={serverId} category={selectedCategory} close={() => setSelectedCategory(null)} refresh={() => channels.refetch()} />
      <RoleEditor
        serverId={serverId}
        role={selectedRole}
        members={members.data ?? []}
        close={() => setSelectedRole(null)}
        refresh={() => roles.refetch()}
        refreshMembers={() => members.refetch()}
      />
      <MemberManager
        serverId={serverId}
        member={selectedMember}
        roles={roles.data ?? []}
        close={() => setSelectedMember(null)}
        refresh={() => members.refetch()}
      />
      <AuditDetailSheet event={selectedAuditEvent} close={() => setSelectedAuditEvent(null)} />
      <DeleteServerSheet
        serverId={serverId}
        visible={deleteOpen}
        close={() => setDeleteOpen(false)}
      />
      <BrandingActionSheet
        kind={brandingPicker}
        hasImage={brandingPicker === 'icon' ? Boolean(server?.iconUrl) : Boolean(server?.bannerUrl)}
        close={() => setBrandingPicker(null)}
        choose={(source) => {
          if (brandingPicker) return uploadBranding(brandingPicker, source);
        }}
        remove={async () => {
          if (!brandingPicker) return;
          await api.request(`/servers/${serverId}/${brandingPicker}`, { method: 'DELETE' });
          await servers.refetch();
          setBrandingPicker(null);
        }}
      />
      <ImageCropEditor source={brandingCrop?.source ?? null} aspect={brandingCrop?.kind === 'icon' ? [1, 1] : [16, 6]} round={brandingCrop?.kind === 'icon'} title={brandingCrop?.kind === 'icon' ? 'Sunucu simgesini kırp' : 'Sunucu afişini kırp'} close={() => setBrandingCrop(null)} confirm={applyBrandingCrop} />
    </SafeAreaView>
  );
}

function InsightsPanel({
  insights,
  loading,
}: {
  insights: ServerInsights | undefined;
  loading: boolean;
}) {
  if (loading) return <Text style={insightsStyles.loading}>İstatistikler yükleniyor…</Text>;
  if (!insights) return <Text style={insightsStyles.loading}>İstatistik yüklenemedi.</Text>;
  const maxDaily = Math.max(...insights.daily.map((point) => point.messages), 1);
  const maxChannel = Math.max(...insights.topChannels.map((channel) => channel.messageCount), 1);
  const cards: Array<[string, number]> = [
    ['Üye', insights.totals.memberCount],
    ['Yeni üye (7 gün)', insights.totals.joinsLast7Days],
    ['Mesaj (bugün)', insights.totals.messagesToday],
    ['Mesaj (7 gün)', insights.totals.messagesLast7Days],
    ['Mesaj (30 gün)', insights.totals.messagesLast30Days],
    ['Aktif üye (7 gün)', insights.totals.activeMembersLast7Days],
    ['Çevrimiçi', insights.totals.onlineCount],
    ['Kanal', insights.totals.textChannelCount + insights.totals.voiceChannelCount],
  ];
  return (
    <View style={insightsStyles.root}>
      <View style={insightsStyles.cards}>
        {cards.map(([label, value]) => (
          <View key={label} style={insightsStyles.card}>
            <Text style={insightsStyles.cardLabel}>{label}</Text>
            <Text style={insightsStyles.cardValue}>{value}</Text>
          </View>
        ))}
      </View>
      <Text style={insightsStyles.section}>GÜNLÜK MESAJLAR (7 GÜN)</Text>
      {insights.daily.some((point) => point.messages > 0) ? (
        <View style={insightsStyles.chart}>
          {insights.daily.map((point) => (
            <View
              key={point.date}
              style={insightsStyles.chartColumn}
              accessibilityLabel={`${point.date}: ${point.messages} mesaj`}
            >
              <View
                style={[
                  insightsStyles.chartBar,
                  { height: `${Math.max(4, (point.messages / maxDaily) * 100)}%` },
                ]}
              />
            </View>
          ))}
        </View>
      ) : (
        <Text style={insightsStyles.empty}>Bu aralıkta gösterilecek veri yok.</Text>
      )}
      <Text style={insightsStyles.section}>EN AKTİF KANALLAR (7 GÜN)</Text>
      {insights.topChannels.length ? (
        <View style={insightsStyles.channels}>
          {insights.topChannels.map((channel) => (
            <View key={channel.channelId} style={insightsStyles.channelRow}>
              <Text numberOfLines={1} style={insightsStyles.channelName}>
                #{channel.channelName}
              </Text>
              <View style={insightsStyles.channelTrack}>
                <View
                  style={[
                    insightsStyles.channelFill,
                    { width: `${(channel.messageCount / maxChannel) * 100}%` },
                  ]}
                />
              </View>
              <Text style={insightsStyles.channelCount}>{channel.messageCount}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={insightsStyles.empty}>Bu aralıkta gösterilecek veri yok.</Text>
      )}
    </View>
  );
}

const insightsStyles = StyleSheet.create({
  root: { gap: spacing.md },
  loading: { color: colors.textMuted, ...typography.body, padding: spacing.lg, textAlign: 'center' },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { width: '47%', flexGrow: 1, gap: 4, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  cardLabel: { color: colors.textMuted, ...typography.caption },
  cardValue: { color: colors.text, ...typography.heading },
  section: { color: colors.textDim, ...typography.caption, fontWeight: '800', letterSpacing: 1 },
  chart: { height: 120, flexDirection: 'row', alignItems: 'flex-end', gap: 4, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  chartColumn: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  chartBar: { borderRadius: 3, backgroundColor: colors.waveBright },
  empty: { color: colors.textMuted, ...typography.body, padding: spacing.sm },
  channels: { gap: spacing.sm },
  channelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  channelName: { width: 110, color: colors.text, ...typography.label },
  channelTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  channelFill: { height: '100%', borderRadius: 4, backgroundColor: colors.waveBright },
  channelCount: { color: colors.textMuted, ...typography.caption, minWidth: 30, textAlign: 'right' },
});

function OverviewPanel({
  server,
  mediaRevision,
  name,
  description,
  afkChannelId,
  afkTimeout,
  discoveryEnabled,
  channels,
  saving,
  setName,
  setDescription,
  setAfkChannelId,
  setAfkTimeout,
  setDiscoveryEnabled,
  save,
  upload,
  deleteServer,
}: {
  server?: ServerSummary | undefined;
  mediaRevision: number;
  name: string;
  description: string;
  afkChannelId: string | null;
  afkTimeout: number;
  discoveryEnabled: boolean;
  channels: ServerChannel[];
  saving: boolean;
  setName(value: string): void;
  setDescription(value: string): void;
  setAfkChannelId(value: string | null): void;
  setAfkTimeout(value: number): void;
  setDiscoveryEnabled(value: boolean): void;
  save(): Promise<void>;
  upload(kind: 'icon' | 'banner'): void;
  deleteServer(): void;
}) {
  const voiceChannels = channels.filter((channel) => channel.type === 'VOICE');
  return (
    <>
      <SectionTitle title="Sunucu profili" subtitle="Simge, afiş ve temel bilgiler" />
      <View style={styles.brandingCard}>
        <Pressable
          style={styles.brandIcon}
          onPress={() => upload('icon')}
          accessibilityLabel={server?.iconUrl ? 'Sunucu simgesini değiştir' : 'Sunucu simgesi ekle'}
        >
          {server?.iconUrl ? (
            <SecureImage uri={server.iconUrl} revision={mediaRevision} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <Text style={styles.brandInitial}>
              {server?.name.slice(0, 2).toUpperCase() ?? 'WA'}
            </Text>
          )}
          <View style={styles.brandEdit}>
            <Icon name="camera-outline" color={colors.text} size={21} />
          </View>
        </Pressable>
        <Pressable
          style={styles.brandBanner}
          onPress={() => upload('banner')}
          accessibilityLabel={server?.bannerUrl ? 'Sunucu afişini değiştir' : 'Sunucu afişi ekle'}
        >
          {server?.bannerUrl ? (
            <SecureImage
              uri={server.bannerUrl}
              revision={mediaRevision}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <View style={styles.emptyBanner}>
              <Icon name="image-plus" color={colors.waveBright} size={30} />
            </View>
          )}
          <View style={styles.brandEdit}>
            <Icon name="camera-outline" color={colors.text} size={21} />
          </View>
        </Pressable>
      </View>
      <Text style={styles.label}>SUNUCU ADI</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        maxLength={100}
        style={styles.input}
        placeholderTextColor={colors.textDim}
      />
      <Text style={styles.label}>AÇIKLAMA</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        maxLength={300}
        multiline
        style={[styles.input, styles.textarea]}
        placeholder="Sunucunu kısaca anlat"
        placeholderTextColor={colors.textDim}
      />
      <Text style={styles.label}>AFK LİMANI</Text>
      <SelectField
        value={afkChannelId ?? ''}
        placeholder="Kapalı"
        options={[
          { value: '', label: 'Kapalı' },
          ...voiceChannels.map((channel) => ({ value: channel.id, label: channel.name })),
        ]}
        onSelect={(value) => setAfkChannelId(value || null)}
      />
      <Text style={styles.label}>LİMANA ÇEKİLME SÜRESİ</Text>
      <View style={styles.choiceRow}>
        {[60, 300, 900, 3600].map((seconds) => (
          <Choice
            key={seconds}
            active={afkTimeout === seconds}
            label={seconds < 3600 ? `${seconds / 60} dk` : '1 sa'}
            onPress={() => setAfkTimeout(seconds)}
          />
        ))}
      </View>
      {server?.role === 'OWNER' ? (
        <ToggleRow
          title="Sunucu keşfette görünsün"
          subtitle="Sunucunu keşfet ekranında yayınla; istediğinde kapatabilirsin."
          value={discoveryEnabled}
          onChange={setDiscoveryEnabled}
        />
      ) : null}
      <Button
        label="Değişiklikleri kaydet"
        loading={saving}
        disabled={!name.trim()}
        onPress={() => void save()}
      />
      {server?.role === 'OWNER' ? (
        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>Tehlikeli bölge</Text>
          <Text style={styles.settingMeta}>Sunucuyu silmek geri alınamaz.</Text>
          <Button label="Sunucuyu sil" variant="danger" onPress={deleteServer} />
        </View>
      ) : null}
    </>
  );
}

function ServerEmojisPanel({ serverId, canManage, limit }: { serverId: string; canManage: boolean; limit: number }) {
  const queryClient = useQueryClient();
  const emojis = useQuery({
    queryKey: ['server-emojis', serverId],
    queryFn: () => api.request<ServerEmoji[]>(`/servers/${serverId}/emojis`),
  });
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ServerEmoji | null>(null);
  async function upload() {
    if (!canManage || !name.trim() || (emojis.data?.length ?? 0) >= limit) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 1 });
    const asset = result.assets?.[0];
    if (!asset) return;
    setBusy(true);
    try {
      const created = await mobileUpload<ServerEmoji>(`/servers/${serverId}/emojis?name=${encodeURIComponent(name.trim())}`, asset.uri, asset.fileName ?? `${name.trim()}.png`);
      queryClient.setQueryData<ServerEmoji[]>(['server-emojis', serverId], [...(emojis.data ?? []), created].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
    } catch { Alert.alert('Emoji eklenemedi', 'Dosya biçimi veya emoji adı geçersiz olabilir.'); } finally { setBusy(false); }
  }
  async function rename() {
    if (!editing || !editing.name.trim()) return;
    setBusy(true);
    try {
      const updated = await api.request<ServerEmoji>(`/servers/${serverId}/emojis/${editing.id}`, { method: 'PATCH', body: { name: editing.name.trim() } });
      queryClient.setQueryData<ServerEmoji[]>(['server-emojis', serverId], (items) => (items ?? []).map((item) => item.id === updated.id ? updated : item));
      setEditing(null);
    } catch { Alert.alert('Emoji adı değiştirilemedi', 'Ad 2-32 karakter ve yalnızca harf, sayı, alt çizgi içermeli.'); } finally { setBusy(false); }
  }
  function remove(emoji: ServerEmoji) {
    Alert.alert('Emojiyi sil', `:${emoji.name}: silinsin mi?`, [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Sil', style: 'destructive', onPress: () => void (async () => { setBusy(true); try { await api.request(`/servers/${serverId}/emojis/${emoji.id}`, { method: 'DELETE' }); queryClient.setQueryData<ServerEmoji[]>(['server-emojis', serverId], (items) => (items ?? []).filter((item) => item.id !== emoji.id)); } finally { setBusy(false); } })() }]);
  }
  return <>
    <SectionTitle title="Sunucu emojileri" subtitle={`Takviye seviyene göre en fazla ${limit} emoji.`} />
    {canManage ? <View style={styles.emojiUploadCard}><TextInput value={name} onChangeText={(value) => setName(value.replace(/[^A-Za-z0-9_]/gu, '').slice(0, 32))} placeholder="Emoji adı (örn. wave_hello)" placeholderTextColor={colors.textDim} autoCapitalize="none" style={styles.input} /><Button label="Galeriden emoji ekle" icon={<Icon name="image-plus" color={colors.text} size={19} />} loading={busy} disabled={name.trim().length < 2 || (emojis.data?.length ?? 0) >= limit} onPress={() => void upload()} /></View> : null}
    <View style={styles.emojiList}>{(emojis.data ?? []).map((emoji) => <View key={emoji.id} style={styles.emojiRow}><SecureImage uri={emoji.url} style={styles.emojiImage} contentFit="contain" /><View style={styles.copy}><Text style={styles.settingTitle}>:{emoji.name}:</Text><Text style={styles.settingMeta}>{emoji.createdBy.displayName}</Text></View>{canManage ? <><RoundButton icon="pencil-outline" onPress={() => setEditing(emoji)} /><RoundButton icon="delete-outline" danger onPress={() => remove(emoji)} /></> : null}</View>)}{!emojis.isLoading && !(emojis.data?.length) ? <Text style={styles.settingMeta}>Henüz özel emoji eklenmemiş.</Text> : null}</View>
    <Modal visible={Boolean(editing)} transparent animationType="slide" onRequestClose={() => setEditing(null)}><View style={styles.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setEditing(null)} /><Sheet close={() => setEditing(null)}><Text style={styles.sheetTitle}>Emoji adını değiştir</Text><TextInput value={editing?.name ?? ''} onChangeText={(value) => setEditing((item) => item ? { ...item, name: value.replace(/[^A-Za-z0-9_]/gu, '').slice(0, 32) } : item)} autoCapitalize="none" style={styles.input} /><Button label="Kaydet" loading={busy} disabled={!editing?.name || editing.name.length < 2} onPress={() => void rename()} /></Sheet></View></Modal>
  </>;
}

function NotificationPreferencesPanel({ serverId, channels }: { serverId: string; channels: ServerChannel[] }) {
  const preference = useQuery({ queryKey: ['server-notification-preference', serverId], queryFn: () => api.request<ServerNotificationPreference>(`/servers/${serverId}/notification-preference`) });
  async function update(body: { level?: NotificationLevel; mute?: NotificationMute }) { await api.request(`/servers/${serverId}/notification-preference`, { method: 'PATCH', body }); await preference.refetch(); }
  return <><SectionTitle title="Bildirim tercihleri" subtitle="Sunucu ve kanal bazında bildirim akışını yönet" /><View style={styles.preferenceCard}><Text style={styles.label}>SUNUCU VARSAYILANI</Text><PreferenceChoices value={preference.data?.level ?? 'MENTIONS_ONLY'} update={(level) => { if (level) void update({ level }); }} /><Text style={styles.label}>SUNUCUYU SUSTUR</Text><MuteChoices muted={preference.data?.isMuted ?? false} indefinite={preference.data?.mutedIndefinitely ?? false} preset={preference.data?.mutePreset ?? null} mutedUntil={preference.data?.mutedUntil ?? null} update={(mute) => void update({ mute })} /></View><Text style={styles.groupLabel}>KANAL İSTİSNALARI</Text>{channels.slice().sort((a, b) => a.position - b.position).map((channel) => <ChannelNotificationRow key={channel.id} serverId={serverId} channel={channel} />)}</>;
}

function ChannelNotificationRow({ serverId, channel }: { serverId: string; channel: ServerChannel }) {
  const preference = useQuery({ queryKey: ['channel-notification-preference', channel.id], queryFn: () => api.request<ChannelNotificationPreference>(`/servers/${serverId}/channels/${channel.id}/notification-preference`) });
  const [open, setOpen] = useState(false);
  async function update(body: { level?: NotificationLevel | null; mute?: NotificationMute }) { await api.request(`/servers/${serverId}/channels/${channel.id}/notification-preference`, { method: 'PATCH', body }); await preference.refetch(); }
  return <View style={styles.preferenceCard}><Pressable style={styles.preferenceHeader} onPress={() => setOpen((value) => !value)}><Icon name={channel.type === 'VOICE' ? 'volume-high' : 'pound'} color={colors.waveBright} size={20} /><View style={styles.copy}><Text style={styles.settingTitle}>{channel.name}</Text><Text style={styles.settingMeta}>{preference.data?.level ? notificationLevelLabel(preference.data.level) : `Sunucudan devralır · ${notificationLevelLabel(preference.data?.effectiveLevel ?? 'MENTIONS_ONLY')}`}{preference.data?.isMuted ? ` · ${muteSummary(preference.data.mutedUntil, preference.data.mutedIndefinitely)}` : ''}</Text></View><Icon name={open ? 'chevron-up' : 'chevron-down'} color={colors.textDim} size={21} /></Pressable>{open ? <><PreferenceChoices value={preference.data?.level ?? null} inherit update={(level) => void update({ level })} /><MuteChoices muted={preference.data?.isMuted ?? false} indefinite={preference.data?.mutedIndefinitely ?? false} preset={preference.data?.mutePreset ?? null} mutedUntil={preference.data?.mutedUntil ?? null} update={(mute) => void update({ mute })} /></> : null}</View>;
}

function PreferenceChoices({ value, inherit = false, update }: { value: NotificationLevel | null; inherit?: boolean; update(value: NotificationLevel | null): void }) {
  const choices: Array<[NotificationLevel | null, string]> = [...(inherit ? [[null, 'Sunucudan devral'] as [null, string]] : []), ['ALL_MESSAGES', 'Tüm mesajlar'], ['MENTIONS_ONLY', 'Yalnız bahsetmeler'], ['NOTHING', 'Hiçbir şey']];
  return <View style={styles.preferenceChoices}>{choices.map(([id, label]) => <Pressable key={id ?? 'inherit'} style={styles.preferenceChoice} onPress={() => update(id)}><Icon name={value === id ? 'radiobox-marked' : 'radiobox-blank'} color={value === id ? colors.waveBright : colors.textDim} size={21} /><Text style={styles.settingMeta}>{label}</Text></Pressable>)}</View>;
}

function MuteChoices({ muted, indefinite, preset, mutedUntil, update }: { muted: boolean; indefinite: boolean; preset: NotificationMute | null; mutedUntil: string | null; update(value: NotificationMute): void }) {
  const choices: Array<[NotificationMute, string]> = [['UNMUTED', 'Açık'], ['MINUTES_15', '15 dk'], ['HOUR_1', '1 saat'], ['HOURS_3', '3 saat'], ['HOURS_8', '8 saat'], ['HOURS_24', '24 saat'], ['FOREVER', 'Süresiz']];
  return <><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>{choices.map(([id, label]) => <Choice key={id} active={id === 'UNMUTED' ? !muted : muted && (preset === id || (id === 'FOREVER' && indefinite))} label={label} onPress={() => update(id)} />)}</ScrollView>{muted ? <Text style={styles.settingMeta}>{muteSummary(mutedUntil, indefinite)}</Text> : null}</>;
}

function muteSummary(mutedUntil: string | null, indefinite: boolean) {
  if (indefinite) return 'Süresiz susturuldu';
  if (!mutedUntil) return 'Susturuldu';
  const remaining = Math.max(0, new Date(mutedUntil).getTime() - Date.now());
  const minutes = Math.max(1, Math.ceil(remaining / 60_000));
  const label = minutes < 60 ? `${minutes} dk` : `${Math.ceil(minutes / 60)} saat`;
  return `Susturuldu · ${label} kaldı`;
}

function notificationLevelLabel(value: NotificationLevel) { return value === 'ALL_MESSAGES' ? 'Tüm mesajlar' : value === 'MENTIONS_ONLY' ? 'Yalnız bahsetmeler' : 'Hiçbir şey'; }

type ChannelLayoutRow = LayoutRow<ServerChannel, ChannelTree['categories'][number]>;

function ChannelsPanel({
  serverId,
  tree,
  createChannel,
  createCategory,
  edit,
  editCategory,
  refresh,
}: {
  serverId: string;
  tree?: ChannelTree | undefined;
  createChannel(): void;
  createCategory(): void;
  edit(channel: ServerChannel): void;
  editCategory(category: ChannelTree['categories'][number]): void;
  refresh(): Promise<unknown>;
}) {
  const { enabled: developerMode } = useDeveloperMode();
  const layoutRows = useMemo<ChannelLayoutRow[]>(() => {
    if (!tree) return [];
    const rows: ChannelLayoutRow[] = [];
    for (const category of tree.categories.slice().sort((a, b) => a.position - b.position)) {
      rows.push({ kind: 'category', id: `category:${category.id}`, category });
      rows.push(...tree.channels.filter((channel) => channel.categoryId === category.id).sort((a, b) => a.position - b.position).map((channel) => ({ kind: 'channel' as const, id: `channel:${channel.id}`, channel })));
    }
    rows.push({ kind: 'category', id: 'category:uncategorized', category: null });
    rows.push(...tree.channels.filter((channel) => channel.categoryId === null).sort((a, b) => a.position - b.position).map((channel) => ({ kind: 'channel' as const, id: `channel:${channel.id}`, channel })));
    return rows;
  }, [tree]);
  async function applyLayout(data: ChannelLayoutRow[], from: number) {
    const dragged = layoutRows[from];
    if (!dragged) return;
    if (dragged.kind === 'category') {
      const categoryIds = categoryOrderFromRows(data);
      await api.request(`/servers/${serverId}/categories/reorder`, { method: 'PATCH', body: { categoryIds } });
    } else {
      const items = channelOrderFromRows(data);
      await api.request(`/servers/${serverId}/channels/reorder`, { method: 'PATCH', body: { items } });
    }
    await refresh();
  }
  return (
    <>
      <View style={styles.sectionHead}>
        <SectionTitle
          title="Kanallar ve kategoriler"
          subtitle={`${tree?.channels.length ?? 0} kanal · ${tree?.categories.length ?? 0} kategori`}
        />
        <View style={styles.headActions}>
          <RoundButton icon="folder-plus-outline" onPress={createCategory} />
          <RoundButton icon="plus" onPress={createChannel} />
        </View>
      </View>
      <Text style={styles.settingMeta}>Bir kanalı başka kategori başlığının altına sürükleyerek kategorisini değiştirebilirsin.</Text>
      <NestableDraggableFlatList
        data={layoutRows}
        keyExtractor={(row) => row.id}
        scrollEnabled={false}
        activationDistance={8}
        onDragEnd={({ data, from }) => void applyLayout(data, from)}
        renderItem={({ item, drag, isActive }: RenderItemParams<ChannelLayoutRow>) => item.kind === 'category' ? (
          <View style={[styles.categoryHeader, isActive && styles.dragRowActive]}>
            <Pressable style={styles.dragHandle} onLongPress={item.category ? drag : undefined} delayLongPress={120} accessibilityLabel={item.category ? `${item.category.name} kategorisini sürükle` : 'Kategorisiz kanallar'}><Icon name="drag" color={item.category ? colors.textDim : colors.lineStrong} size={23} /></Pressable>
            <Pressable style={styles.categoryNameButton} disabled={!item.category} onPress={() => { if (item.category) editCategory(item.category); }}><Text style={styles.groupLabel}>{item.category?.name.toLocaleUpperCase('tr') ?? 'KATEGORİSİZ'}</Text>{item.category ? <Icon name="pencil-outline" color={colors.textDim} size={18} /> : null}</Pressable>
          </View>
        ) : (
          <Pressable style={[styles.dragRow, isActive && styles.dragRowActive]} onPress={() => edit(item.channel)}><Pressable style={styles.dragHandle} onLongPress={drag} delayLongPress={120} accessibilityLabel={`${item.channel.name} kanalını sürükle`}><Icon name="drag" color={colors.textDim} size={23} /></Pressable><Icon name={item.channel.type === 'VOICE' ? 'volume-high' : 'pound'} color={colors.waveBright} size={21} /><View style={styles.copy}><Text style={styles.settingTitle}>{item.channel.name}</Text><Text style={styles.settingMeta}>{item.channel.type === 'VOICE' ? 'Ses' : 'Metin'}{developerMode ? ` · ${item.channel.publicId}` : ''}{item.channel.nsfw ? ' · +18' : ''}</Text></View></Pressable>
        )}
      />
    </>
  );
}

function RolesPanel({
  serverId,
  roles,
  create,
  edit,
  refresh,
}: {
  serverId: string;
  roles: ServerRole[];
  create(): void;
  edit(role: ServerRole): void;
  refresh(): Promise<unknown>;
}) {
  const ordered = roles.filter((role) => !role.isEveryone).slice().sort((a, b) => b.position - a.position);
  async function reorder(data: ServerRole[]) {
    await api.request(`/servers/${serverId}/roles/reorder`, { method: 'PATCH', body: { items: data.map((role, index) => ({ id: role.id, position: data.length - index })) } });
    await refresh();
  }
  return (
    <>
      <View style={styles.sectionHead}>
        <SectionTitle title="Roller ve izinler" subtitle={`${roles.length} rol`} />
        <RoundButton icon="plus" onPress={create} />
      </View>
      <NestableDraggableFlatList data={ordered} keyExtractor={(role) => role.id} scrollEnabled={false} activationDistance={8} onDragEnd={({ data }) => void reorder(data)} renderItem={({ item: role, drag, isActive }: RenderItemParams<ServerRole>) => <Pressable style={[styles.roleRow, isActive && styles.dragRowActive]} onPress={() => edit(role)}><Pressable style={styles.dragHandle} onLongPress={drag} delayLongPress={120} accessibilityLabel={`${role.name} rolünü sürükle`}><Icon name="drag" color={colors.textDim} size={23} /></Pressable><View style={[styles.roleDot, { backgroundColor: role.color }]} /><View style={styles.copy}><Text style={styles.settingTitle}>{role.name}</Text><Text style={styles.settingMeta}>{role.memberCount} üye · {role.permissions.length} izin{role.hoist ? ' · ayrı gösterilir' : ''}</Text></View></Pressable>} />
      {roles.filter((role) => role.isEveryone).map((role) => <Pressable key={role.id} style={styles.roleRow} onPress={() => edit(role)}><View style={styles.dragHandle} /><View style={[styles.roleDot, { backgroundColor: role.color }]} /><View style={styles.copy}><Text style={styles.settingTitle}>{role.name}</Text><Text style={styles.settingMeta}>Varsayılan rol · taşınamaz</Text></View></Pressable>)}
    </>
  );
}

function MembersPanel({
  members,
  select,
}: {
  members: ServerMember[];
  select(member: ServerMember): void;
}) {
  const { enabled: developerMode } = useDeveloperMode();
  const sections = useMemo(() => {
    const online = members.filter((member) => member.status !== 'OFFLINE');
    const offline = members.filter((member) => member.status === 'OFFLINE');
    return [
      { title: 'Çevrimiçi', items: online },
      { title: 'Çevrimdışı', items: offline },
    ].filter((item) => item.items.length);
  }, [members]);
  return (
    <>
      <SectionTitle title="Üye yönetimi" subtitle={`${members.length} üye`} />
      {sections.map((section) => (
        <View key={section.title} style={styles.memberSection}>
          <Text style={styles.groupLabel}>
            {section.title.toLocaleUpperCase('tr')} — {section.items.length}
          </Text>
          {section.items.map((member) => (
            <Pressable key={member.id} style={styles.memberRow} onPress={() => select(member)}>
              <Avatar
                name={member.displayName}
                uri={member.avatarUrl}
                size={42}
                online={member.status !== 'OFFLINE'}
              />
              <View style={styles.copy}>
                <Text style={styles.settingTitle}>
                  {member.displayName}
                  {member.role === 'OWNER' ? ' ♛' : ''}
                </Text>
                <Text style={styles.settingMeta}>
                  @{member.username}{developerMode ? ` · ${member.publicId}` : ''}
                  {member.customStatusText
                    ? ` · ${member.customStatusEmoji ?? ''} ${member.customStatusText}`
                    : ''}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ))}
    </>
  );
}

function InvitesPanel({
  serverId,
  invites,
  channels,
  refresh,
}: {
  serverId: string;
  invites: ServerInvite[];
  channels: ServerChannel[];
  refresh(): Promise<unknown>;
}) {
  const [maxUses, setMaxUses] = useState('25');
  const [hours, setHours] = useState('24');
  const [channelId, setChannelId] = useState('');
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    try {
      await api.request(`/servers/${serverId}/invites`, {
        method: 'POST',
        body: {
          maxUses: Math.max(1, Number(maxUses) || 1),
          expiresInHours: Math.max(1, Number(hours) || 24),
          ...(channelId ? { channelId } : {}),
        },
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SectionTitle title="Davet bağlantıları" subtitle="Süre ve kullanım sınırlarını yönet" />
      <View style={styles.inlineInputs}>
        <TextInput
          value={maxUses}
          onChangeText={setMaxUses}
          keyboardType="number-pad"
          style={[styles.input, styles.smallInput]}
          placeholder="Kullanım"
          placeholderTextColor={colors.textDim}
        />
        <TextInput
          value={hours}
          onChangeText={setHours}
          keyboardType="number-pad"
          style={[styles.input, styles.smallInput]}
          placeholder="Saat"
          placeholderTextColor={colors.textDim}
        />
      </View>
      <SelectField
        value={channelId}
        placeholder="Davet kanalı"
        options={[
          { value: '', label: 'Varsayılan kanal' },
          ...channels
            .filter((channel) => channel.type === 'TEXT')
            .map((channel) => ({ value: channel.id, label: `#${channel.name}` })),
        ]}
        onSelect={setChannelId}
      />
      <Button label="Yeni davet oluştur" loading={busy} onPress={() => void create()} />
      {invites.map((invite) => (
        <View key={invite.id} style={styles.inviteRow}>
          <View style={styles.copy}>
            <Text style={styles.settingTitle}>{serverInviteUrl(invite.code)}</Text>
            <Text style={styles.settingMeta}>
              {invite.usedCount}/{invite.maxUses} kullanım ·{' '}
              {new Date(invite.expiresAt).toLocaleString('tr-TR')}
            </Text>
          </View>
          <RoundButton
            icon="content-copy"
            onPress={() => void Clipboard.setStringAsync(serverInviteUrl(invite.code))}
          />
          <RoundButton
            icon="delete-outline"
            danger
            onPress={() =>
              void api
                .request(`/servers/${serverId}/invites/${invite.id}`, { method: 'DELETE' })
                .then(refresh)
            }
          />
        </View>
      ))}
    </>
  );
}

const autoModActions: Array<{ value: AutoModAction; label: string }> = [
  { value: 'DELETE_MESSAGE', label: 'Mesajı sil' },
  { value: 'WARN_USER', label: 'Kullanıcıyı uyar' },
  { value: 'TIMEOUT_5M', label: '5 dakika mola' },
  { value: 'TIMEOUT_30M', label: '30 dakika mola' },
  { value: 'TIMEOUT_1H', label: '1 saat mola' },
];
const turkishProfanityPreset = [
  'amk',
  'amina koyayim',
  'amına koyayım',
  'aq',
  'avradını',
  'bok',
  'boktan',
  'dangalak',
  'dallama',
  'dalyarak',
  'dingil',
  'dürzü',
  'embesil',
  'gerizekalı',
  'gerzek',
  'göt',
  'götveren',
  'hıyar',
  'it',
  'kahpe',
  'kaltak',
  'kavat',
  'lavuk',
  'mal',
  'manyak',
  'moron',
  'oç',
  'orospu',
  'orospu çocuğu',
  'pezevenk',
  'piç',
  'puşt',
  'salak',
  'sik',
  'siktir',
  'sikik',
  'sikko',
  'sürtük',
  'şerefsiz',
  'şerefsizlik',
  'taşak',
  'yarak',
  'yarrak',
  'yavşak',
  'zibidi',
  'aptal herif',
  'beyinsiz',
  'haysiyetsiz',
  'karaktersiz',
  'namussuz',
  'soysuz',
  'terbiyesiz',
  'ulan',
  'defol',
  'geber',
  'cehenneme git',
];

function AutoModPanel({
  serverId,
  config,
  roles,
  channels,
  refresh,
}: {
  serverId: string;
  config?: AutoModConfig | undefined;
  roles: ServerRole[];
  channels: ServerChannel[];
  refresh(): Promise<unknown>;
}) {
  const [draft, setDraft] = useState<AutoModConfig | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (config)
      setDraft({
        ...config,
        bannedWords: [...config.bannedWords],
        regexPatterns: [...config.regexPatterns],
        allowedDomains: [...config.allowedDomains],
        exemptRoles: [...config.exemptRoles],
        exemptChannels: [...config.exemptChannels],
      });
  }, [config]);
  function change<K extends keyof AutoModConfig>(key: K, value: AutoModConfig[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }
  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await api.request(`/servers/${serverId}/automod`, { method: 'PATCH', body: draft });
      await refresh();
    } finally {
      setSaving(false);
    }
  }
  if (!draft) return <Text style={styles.settingMeta}>AutoMod yükleniyor…</Text>;
  return (
    <>
      <SectionTitle title="AutoMod" subtitle="Web ile aynı kurallar, eylemler ve istisnalar" />
      <ToggleRow
        title="AutoMod etkin"
        subtitle="Tüm otomatik denetim kurallarının ana anahtarı"
        value={draft.enabled}
        onChange={(value) => change('enabled', value)}
      />
      <Text style={styles.groupLabel}>HAZIR KURALLAR</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.choiceRow}
      >
        <Choice
          active={false}
          label="Önerilen koruma"
          onPress={() =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    enabled: true,
                    linkProtection: true,
                    spamProtection: true,
                    repeatedMessageProtection: true,
                    mentionSpamProtection: true,
                    capsProtection: true,
                    emojiSpamProtection: true,
                  }
                : current,
            )
          }
        />
        <Choice
          active={false}
          label="Türkçe dil filtresi"
          onPress={() =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    enabled: true,
                    bannedWordsEnabled: true,
                    bannedWords: [...turkishProfanityPreset],
                  }
                : current,
            )
          }
        />
        <Choice
          active={false}
          label="Baskın koruması"
          onPress={() =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    enabled: true,
                    spamProtection: true,
                    spamMaxMessages: 4,
                    spamInterval: 5,
                    spamAction: 'TIMEOUT_30M',
                    mentionSpamProtection: true,
                    mentionMaxCount: 5,
                    mentionAction: 'TIMEOUT_30M',
                  }
                : current,
            )
          }
        />
      </ScrollView>
      <AutoModRule
        title="Yasaklı sözcükler"
        subtitle="Türkçe hazır listeyi kullanabilir veya virgülle özel sözcükler ekleyebilirsin."
        enabled={draft.bannedWordsEnabled}
        setEnabled={(value) => change('bannedWordsEnabled', value)}
      >
        <TextInput
          value={draft.bannedWords.join(', ')}
          onChangeText={(value) =>
            change(
              'bannedWords',
              value
                .split(',')
                .map((word) => word.trim())
                .filter(Boolean),
            )
          }
          multiline
          style={[styles.input, styles.textarea]}
          placeholder="sözcük, başka sözcük"
          placeholderTextColor={colors.textDim}
        />
        <AutoModActionField
          value={draft.bannedWordsAction}
          onSelect={(value) => change('bannedWordsAction', value)}
        />
      </AutoModRule>
      <AutoModRule
        title="Regex kuralları"
        subtitle="Her satıra bir güvenli düzenli ifade yaz. En fazla 25 desen."
        enabled={draft.regexEnabled}
        setEnabled={(value) => change('regexEnabled', value)}
      >
        <TextInput
          value={draft.regexPatterns.join('\n')}
          onChangeText={(value) =>
            change(
              'regexPatterns',
              value
                .split('\n')
                .map((pattern) => pattern.trim())
                .filter(Boolean),
            )
          }
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, styles.textarea]}
          placeholder={'\\bistenmeyen\\b\nhttps?:\\/\\/[^\\s]+'}
          placeholderTextColor={colors.textDim}
        />
        <AutoModActionField
          value={draft.regexAction}
          onSelect={(value) => change('regexAction', value)}
        />
      </AutoModRule>
      <AutoModRule
        title="Bağlantı koruması"
        subtitle="İzin verilen alan adları dışındaki bağlantılara işlem uygular."
        enabled={draft.linkProtection}
        setEnabled={(value) => change('linkProtection', value)}
      >
        <TextInput
          value={draft.allowedDomains.join(', ')}
          onChangeText={(value) =>
            change(
              'allowedDomains',
              value
                .split(',')
                .map((domain) => domain.trim())
                .filter(Boolean),
            )
          }
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          placeholder="wapve.com, example.org"
          placeholderTextColor={colors.textDim}
        />
        <AutoModActionField
          value={draft.linkProtectionAction}
          onSelect={(value) => change('linkProtectionAction', value)}
        />
      </AutoModRule>
      <AutoModRule
        title="Mesaj spamı"
        subtitle="Belirlenen zaman aralığında çok fazla mesajı engeller."
        enabled={draft.spamProtection}
        setEnabled={(value) => change('spamProtection', value)}
      >
        <View style={styles.inlineInputs}>
          <NumberSetting
            label="MESAJ"
            value={draft.spamMaxMessages}
            min={2}
            max={20}
            onChange={(value) => change('spamMaxMessages', value)}
          />
          <NumberSetting
            label="SANİYE"
            value={draft.spamInterval}
            min={2}
            max={30}
            onChange={(value) => change('spamInterval', value)}
          />
        </View>
        <AutoModActionField
          value={draft.spamAction}
          onSelect={(value) => change('spamAction', value)}
        />
      </AutoModRule>
      <AutoModRule
        title="Tekrarlanan mesaj"
        subtitle="Aynı içeriğin kısa aralıklarla yinelenmesini engeller."
        enabled={draft.repeatedMessageProtection}
        setEnabled={(value) => change('repeatedMessageProtection', value)}
      >
        <View style={styles.inlineInputs}>
          <NumberSetting
            label="TEKRAR"
            value={draft.repeatedMessageMax}
            min={2}
            max={10}
            onChange={(value) => change('repeatedMessageMax', value)}
          />
          <NumberSetting
            label="SANİYE"
            value={draft.repeatedMessageInterval}
            min={5}
            max={120}
            onChange={(value) => change('repeatedMessageInterval', value)}
          />
        </View>
        <AutoModActionField
          value={draft.repeatedMessageAction}
          onSelect={(value) => change('repeatedMessageAction', value)}
        />
      </AutoModRule>
      <AutoModRule
        title="Etiket spamı"
        subtitle="Tek mesajdaki kullanıcı ve rol etiketi sayısını sınırlar."
        enabled={draft.mentionSpamProtection}
        setEnabled={(value) => change('mentionSpamProtection', value)}
      >
        <NumberSetting
          label="MAKSİMUM ETİKET"
          value={draft.mentionMaxCount}
          min={2}
          max={50}
          onChange={(value) => change('mentionMaxCount', value)}
        />
        <AutoModActionField
          value={draft.mentionAction}
          onSelect={(value) => change('mentionAction', value)}
        />
      </AutoModRule>
      <AutoModRule
        title="Büyük harf koruması"
        subtitle="Yeterince uzun ve çoğunluğu büyük harf olan mesajları denetler."
        enabled={draft.capsProtection}
        setEnabled={(value) => change('capsProtection', value)}
      >
        <View style={styles.inlineInputs}>
          <NumberSetting
            label="MİN. UZUNLUK"
            value={draft.capsMinLength}
            min={5}
            max={50}
            onChange={(value) => change('capsMinLength', value)}
          />
          <NumberSetting
            label="YÜZDE"
            value={draft.capsPercentage}
            min={50}
            max={100}
            onChange={(value) => change('capsPercentage', value)}
          />
        </View>
        <AutoModActionField
          value={draft.capsAction}
          onSelect={(value) => change('capsAction', value)}
        />
      </AutoModRule>
      <AutoModRule
        title="Emoji spamı"
        subtitle="Tek mesajdaki emoji sayısını sınırlar."
        enabled={draft.emojiSpamProtection}
        setEnabled={(value) => change('emojiSpamProtection', value)}
      >
        <NumberSetting
          label="MAKSİMUM EMOJİ"
          value={draft.emojiMaxCount}
          min={3}
          max={50}
          onChange={(value) => change('emojiMaxCount', value)}
        />
        <AutoModActionField
          value={draft.emojiAction}
          onSelect={(value) => change('emojiAction', value)}
        />
      </AutoModRule>
      <View style={styles.autoModCard}>
        <Text style={styles.autoModTitle}>İstisnalar ve kayıt</Text>
        <Text style={styles.settingMeta}>Seçilen rol ve kanallarda AutoMod çalışmaz.</Text>
        <Text style={styles.label}>MUAF ROLLER</Text>
        <MultiSelectField
          placeholder="Rol ara ve seç"
          selected={draft.exemptRoles}
          options={roles.filter((role) => !role.isEveryone).map((role) => ({ value: role.id, label: role.name }))}
          onChange={(next) => change('exemptRoles', next)}
        />
        <Text style={styles.label}>MUAF KANALLAR</Text>
        <MultiSelectField
          placeholder="Kanal ara ve seç"
          selected={draft.exemptChannels}
          options={channels.map((channel) => ({ value: channel.id, label: `${channel.type === 'VOICE' ? '🔊' : '#'} ${channel.name}` }))}
          onChange={(next) => change('exemptChannels', next)}
        />
        <Text style={styles.label}>KAYIT KANALI</Text>
        <SelectField
          value={draft.logChannelId ?? ''}
          placeholder="Kayıt kapalı"
          options={[
            { value: '', label: 'Kayıt kapalı' },
            ...channels
              .filter((channel) => channel.type === 'TEXT')
              .map((channel) => ({ value: channel.id, label: `#${channel.name}` })),
          ]}
          onSelect={(value) => change('logChannelId', value || null)}
        />
      </View>
      <Button label="AutoMod ayarlarını kaydet" loading={saving} onPress={() => void save()} />
    </>
  );
}

function AutoModRule({
  title,
  subtitle,
  enabled,
  setEnabled,
  children,
}: {
  title: string;
  subtitle: string;
  enabled: boolean;
  setEnabled(value: boolean): void;
  children: ReactNode;
}) {
  return (
    <View style={styles.autoModCard}>
      <ToggleRow title={title} subtitle={subtitle} value={enabled} onChange={setEnabled} />
      {enabled ? <View style={styles.autoModFields}>{children}</View> : null}
    </View>
  );
}
function AutoModActionField({
  value,
  onSelect,
}: {
  value: AutoModAction;
  onSelect(value: AutoModAction): void;
}) {
  return (
    <View>
      <Text style={styles.label}>İHLAL EYLEMİ</Text>
      <SelectField
        value={value}
        placeholder="Eylem seç"
        options={autoModActions}
        onSelect={(next) => onSelect(next as AutoModAction)}
      />
    </View>
  );
}
function NumberSetting({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange(value: number): void;
}) {
  return (
    <View style={styles.numberSetting}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={String(value)}
        onChangeText={(text) => {
          const parsed = Number(text);
          if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
        }}
        keyboardType="number-pad"
        style={styles.input}
        placeholderTextColor={colors.textDim}
      />
    </View>
  );
}

const auditActionValues = [
  'SERVER_CREATED',
  'SERVER_UPDATED',
  'SERVER_ICON_UPDATED',
  'SERVER_ICON_REMOVED',
  'SERVER_INVITE_CREATED',
  'SERVER_JOINED',
  'SERVER_LEFT',
  'SERVER_ROLES_REORDERED',
  'CHANNEL_CREATED',
  'CHANNEL_UPDATED',
  'CHANNEL_DELETED',
  'CHANNEL_PERMISSIONS_UPDATED',
  'CHANNELS_REORDERED',
  'CATEGORY_CREATED',
  'CATEGORY_UPDATED',
  'CATEGORY_DELETED',
  'CATEGORIES_REORDERED',
  'SERVER_MEMBER_WARNED',
  'SERVER_MEMBER_TIMED_OUT',
  'SERVER_MEMBER_KICKED',
  'SERVER_MEMBER_BANNED',
  'SERVER_MEMBER_UNBANNED',
  'AUTOMOD_WARNED',
  'AUTOMOD_TIMED_OUT',
  'AUTOMOD_MESSAGE_BLOCKED',
  'SERVER_ROLE_CREATED',
  'SERVER_ROLE_UPDATED',
  'SERVER_ROLE_DELETED',
  'SERVER_ROLE_ASSIGNED',
  'SERVER_ROLE_UNASSIGNED',
];

function AuditPanel({
  events,
  hasMore,
  loadingMore,
  loadMore,
  select,
  members,
  action,
  actor,
  target,
  setAction,
  setActor,
  setTarget,
}: {
  events: ServerAuditEvent[];
  hasMore: boolean;
  loadingMore: boolean;
  loadMore(): Promise<unknown>;
  select(event: ServerAuditEvent): void;
  members: ServerMember[];
  action: string;
  actor: string;
  target: string;
  setAction(value: string): void;
  setActor(value: string): void;
  setTarget(value: string): void;
}) {
  return (
    <>
      <SectionTitle title="Denetim kaydı" subtitle="Sunucudaki yönetim işlemleri" />
      <View style={styles.auditFilters}>
        <SelectField
          value={action}
          placeholder="İşlem türü"
          options={[
            { value: '', label: 'Tüm işlemler' },
            ...auditActionValues.map((value) => ({ value, label: auditAction(value) })),
          ]}
          onSelect={setAction}
        />
        <SelectField
          value={actor}
          placeholder="İşlemi yapan"
          options={[
            { value: '', label: 'Tüm yetkililer' },
            ...members.map((member) => ({ value: member.id, label: member.displayName })),
          ]}
          onSelect={setActor}
        />
        <SelectField
          value={target}
          placeholder="Hedef üye"
          options={[
            { value: '', label: 'Tüm hedefler' },
            ...members.map((member) => ({ value: member.id, label: member.displayName })),
          ]}
          onSelect={setTarget}
        />
      </View>
      {events.map((event) => (
        <Pressable key={event.id} style={styles.auditRow} onPress={() => select(event)}>
          <Icon name="history" color={colors.waveBright} size={22} />
          <View style={styles.copy}>
            <Text style={styles.settingTitle}>{auditAction(event.action)}</Text>
            <Text style={styles.settingMeta}>
              {event.actor?.displayName ?? 'Wapve'} ·{' '}
              {new Date(event.createdAt).toLocaleString('tr-TR')}
              {event.target ? ` · ${event.target.displayName}` : ''}
            </Text>
            {event.reason ? <Text style={styles.auditReason}>{event.reason}</Text> : null}
          </View>
        </Pressable>
      ))}
      {hasMore ? <Button label="Daha eski kayıtları yükle" variant="secondary" loading={loadingMore} onPress={() => void loadMore()} /> : null}
      {!events.length ? (
        <Text style={styles.settingMeta}>Bu filtrelerle eşleşen denetim kaydı yok.</Text>
      ) : null}
    </>
  );
}

function AuditDetailSheet({ event, close }: { event: ServerAuditEvent | null; close(): void }) {
  return <Modal visible={Boolean(event)} transparent animationType="slide" onRequestClose={close}><Sheet close={close}>{event ? <><Text style={styles.sheetTitle}>{auditAction(event.action)}</Text><Text style={styles.settingMeta}>{new Date(event.createdAt).toLocaleString('tr-TR')}</Text><AuditDetail label="İşlemi yapan" value={event.actor ? `${event.actor.displayName}${event.actor.username ? ` (@${event.actor.username})` : ''}` : 'Wapve sistemi'} /><AuditDetail label="Hedef" value={event.target?.displayName ?? '—'} /><AuditDetail label="Kanal" value={event.channel ? `#${event.channel.name}` : '—'} /><AuditDetail label="Rol" value={event.role?.name ?? '—'} /><AuditDetail label="Süre" value={event.durationMinutes ? `${event.durationMinutes} dakika` : '—'} /><AuditDetail label="Sebep" value={event.reason ?? 'Belirtilmedi'} /><AuditDetail label="Kayıt kimliği" value={event.id} /></> : null}</Sheet></Modal>;
}

function AuditDetail({ label, value }: { label: string; value: string }) { return <View style={styles.auditDetail}><Text style={styles.label}>{label.toLocaleUpperCase('tr')}</Text><Text selectable style={styles.settingTitle}>{value}</Text></View>; }
function auditAction(action: string) {
  return action
    .replaceAll('_', ' ')
    .toLocaleLowerCase('tr')
    .replace(/^./u, (value) => value.toLocaleUpperCase('tr'));
}
function BansPanel({
  serverId,
  bans,
  refresh,
}: {
  serverId: string;
  bans: ServerBan[];
  refresh(): Promise<unknown>;
}) {
  return (
    <>
      <SectionTitle title="Yasaklı kullanıcılar" subtitle={`${bans.length} kullanıcı`} />
      {bans.length ? (
        bans.map((ban) => (
          <View key={ban.user.id} style={styles.memberRow}>
            <Avatar name={ban.user.displayName} uri={ban.user.avatarUrl} size={42} />
            <View style={styles.copy}>
              <Text style={styles.settingTitle}>{ban.user.displayName}</Text>
              <Text style={styles.settingMeta}>{ban.reason ?? 'Sebep belirtilmedi'}</Text>
            </View>
            <Button
              label="Kaldır"
              variant="secondary"
              onPress={() =>
                void api
                  .request(`/servers/${serverId}/bans/${ban.user.id}`, { method: 'DELETE' })
                  .then(refresh)
              }
            />
          </View>
        ))
      ) : (
        <Text style={styles.settingMeta}>Yasaklı kullanıcı yok.</Text>
      )}
    </>
  );
}

function CategoryEditor({ serverId, category, close, refresh }: { serverId: string; category: ChannelTree['categories'][number] | null; close(): void; refresh(): Promise<unknown> }) {
  const [name, setName] = useState('');
  useEffect(() => { if (category) setName(category.name); }, [category]);
  async function save() { if (!category || name.trim().length < 1) return; await api.request(`/servers/${serverId}/categories/${category.id}`, { method: 'PATCH', body: { name: name.trim() } }); await refresh(); close(); }
  async function remove() { if (!category) return; await api.request(`/servers/${serverId}/categories/${category.id}`, { method: 'DELETE' }); await refresh(); close(); }
  return <Modal visible={Boolean(category)} transparent animationType="slide" onRequestClose={close}><Sheet close={close}><Text style={styles.sheetTitle}>Kategoriyi düzenle</Text><Text style={styles.settingMeta}>Kategori silinirse içindeki kanallar silinmez; kategorisiz bölüme taşınır.</Text><TextInput value={name} onChangeText={setName} style={styles.input} maxLength={100} placeholder="Kategori adı" placeholderTextColor={colors.textDim} /><Button label="Değişiklikleri kaydet" disabled={!name.trim()} onPress={() => void save()} /><Button label="Kategoriyi sil" variant="danger" onPress={() => void remove()} /></Sheet></Modal>;
}

function ChannelEditor({
  serverId,
  bitrateCap,
  channel,
  categories,
  roles,
  members,
  close,
  refresh,
}: {
  serverId: string;
  bitrateCap: number;
  channel: ServerChannel | null;
  categories: ChannelTree['categories'];
  roles: ServerRole[];
  members: ServerMember[];
  close(): void;
  refresh(): Promise<unknown>;
}) {
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [slow, setSlow] = useState('0');
  const [nsfw, setNsfw] = useState(false);
  const [userLimit, setUserLimit] = useState(0);
  const [bitrateKbps, setBitrateKbps] = useState(64);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  useEffect(() => {
    if (channel) {
      setName(channel.name);
      setTopic(channel.topic ?? '');
      setSlow(String(channel.slowModeSeconds));
      setNsfw(channel.nsfw);
      setUserLimit(channel.userLimit ?? 0);
      setBitrateKbps(channel.bitrateKbps ?? 64);
      setCategoryId(channel.categoryId);
    }
  }, [channel]);
  async function save() {
    if (!channel || !name.trim()) return;
    await api.request(`/servers/${serverId}/channels/${channel.id}`, {
      method: 'PATCH',
      body: {
        name: name.trim(),
        topic: topic.trim() || null,
        slowModeSeconds: Math.max(0, Number(slow) || 0),
        nsfw,
        ...(channel.type === 'VOICE'
          ? {
              userLimit: Math.max(0, Math.min(50, userLimit)),
              bitrateKbps: Math.max(8, Math.min(bitrateCap, bitrateKbps)),
            }
          : {}),
        categoryId,
      },
    });
    await refresh();
    close();
  }
  return (
    <>
      <Modal visible={Boolean(channel)} transparent animationType="slide" onRequestClose={close}>
        <Sheet close={close}>
          <Text style={styles.sheetTitle}>
            {channel?.type === 'VOICE' ? 'Ses kanalını düzenle' : 'Metin kanalını düzenle'}
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholder="Kanal adı"
            placeholderTextColor={colors.textDim}
          />
          {channel?.type === 'TEXT' ? (
            <>
              <TextInput
                value={topic}
                onChangeText={setTopic}
                multiline
                style={[styles.input, styles.textarea]}
                placeholder="Kanal konusu"
                placeholderTextColor={colors.textDim}
              />
              <TextInput
                value={slow}
                onChangeText={setSlow}
                keyboardType="number-pad"
                style={styles.input}
                placeholder="Yavaş mod (saniye)"
                placeholderTextColor={colors.textDim}
              />
            </>
          ) : null}
          {channel?.type === 'VOICE' ? (
            <>
              <Text style={styles.label}>KULLANICI LİMİTİ</Text>
              <Text style={styles.settingMeta}>
                Aynı anda kanala katılabilecek kişi sayısı. Limitsiz seçiminde teknik üst sınır 50'dir.
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.choiceRow}
              >
                {[0, 5, 10, 20, 30, 40, 50].map((limit) => (
                  <Choice
                    key={limit}
                    active={userLimit === limit}
                    label={limit === 0 ? 'Limitsiz' : String(limit)}
                    onPress={() => setUserLimit(limit)}
                  />
                ))}
              </ScrollView>
              <Text style={styles.label}>SES BİT HIZI</Text>
              <Text style={styles.settingMeta}>
                Yüksek değer daha net ses sunar ve daha fazla veri kullanır.
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.choiceRow}
              >
                {[32, 48, 64, 96, 128, 256, 384].filter((bitrate) => bitrate <= bitrateCap).map((bitrate) => (
                  <Choice
                    key={bitrate}
                    active={bitrateKbps === bitrate}
                    label={`${bitrate} kbps`}
                    onPress={() => setBitrateKbps(bitrate)}
                  />
                ))}
              </ScrollView>
              <Text style={styles.settingMeta}>Takviye seviyene göre en fazla {bitrateCap} kbps.</Text>
            </>
          ) : null}
          <ToggleRow title="+18 kanal" value={nsfw} onChange={setNsfw} />
          <Text style={styles.label}>KATEGORİ</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.choiceRow}
          >
            <Choice active={!categoryId} label="Kategorisiz" onPress={() => setCategoryId(null)} />
            {categories.map((category) => (
              <Choice
                key={category.id}
                active={categoryId === category.id}
                label={category.name}
                onPress={() => setCategoryId(category.id)}
              />
            ))}
          </ScrollView>
          <Button
            label="Kanal izinleri"
            variant="secondary"
            onPress={() => setPermissionsOpen(true)}
          />
          <Button label="Kaydet" disabled={!name.trim()} onPress={() => void save()} />
          {channel ? (
            <Button
              label="Kanalı sil"
              variant="danger"
              onPress={() =>
                void api
                  .request(`/servers/${serverId}/channels/${channel.id}`, { method: 'DELETE' })
                  .then(refresh)
                  .then(close)
              }
            />
          ) : null}
        </Sheet>
      </Modal>
      <ChannelPermissionSheet
        serverId={serverId}
        channel={permissionsOpen ? channel : null}
        roles={roles}
        members={members}
        close={() => setPermissionsOpen(false)}
      />
    </>
  );
}

function ChannelPermissionSheet({
  serverId,
  channel,
  roles,
  members,
  close,
}: {
  serverId: string;
  channel: ServerChannel | null;
  roles: ServerRole[];
  members: ServerMember[];
  close(): void;
}) {
  const settings = useQuery({
    queryKey: ['channel-permissions', channel?.id],
    enabled: Boolean(channel),
    queryFn: () =>
      api.request<ChannelPermissionSettings>(
        `/servers/${serverId}/channels/${channel?.id}/permissions`,
      ),
  });
  const [targets, setTargets] = useState<ChannelPermissionTargetState[]>([]);
  const [selected, setSelected] = useState('EVERYONE');
  useEffect(() => {
    setTargets([]);
    setSelected('EVERYONE');
  }, [channel?.id]);
  useEffect(() => {
    if (settings.data) setTargets(settings.data.targets);
  }, [settings.data]);
  const current = targets.find((target) => targetKey(target) === selected);
  function selectTarget(key: string) {
    setSelected(key);
    if (key !== 'EVERYONE' && !targets.some((item) => targetKey(item) === key)) {
      setTargets((items) => [
        ...items,
        {
          target: key.startsWith('USER:')
            ? { type: 'USER', userId: key.replace('USER:', '') }
            : { type: 'ROLE', roleId: key.replace('ROLE:', '') },
          permissions: blankOverrides(),
        },
      ]);
    }
  }
  function cycle(permission: keyof ReturnType<typeof blankOverrides>) {
    setTargets((items) =>
      items.map((item) =>
        targetKey(item) !== selected
          ? item
          : {
              ...item,
              permissions: {
                ...item.permissions,
                [permission]: nextPermission(item.permissions[permission]),
              },
            },
      ),
    );
  }
  return (
    <Modal visible={Boolean(channel)} transparent animationType="slide" onRequestClose={close}>
      <Sheet close={close}>
        <Text style={styles.sheetTitle}>#{channel?.name} izinleri</Text>
        <Text style={styles.sheetHint}>
          İzin değerine dokunarak Devral → İzin ver → Reddet arasında geç.
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.choiceRow}
        >
          <Choice
            active={selected === 'EVERYONE'}
            label="@weryone"
            onPress={() => selectTarget('EVERYONE')}
          />
          {roles
            .filter((role) => !role.isEveryone)
            .map((role) => (
              <Choice
                key={role.id}
                active={selected === `ROLE:${role.id}`}
                label={`@${role.name}`}
                onPress={() => selectTarget(`ROLE:${role.id}`)}
              />
            ))}
          {members.map((member) => (
            <Choice
              key={member.id}
              active={selected === `USER:${member.id}`}
              label={member.displayName}
              onPress={() => selectTarget(`USER:${member.id}`)}
            />
          ))}
        </ScrollView>
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator
          contentContainerStyle={styles.permissionList}
          style={styles.permissionScroll}
        >
          {current ? (
            Object.entries(current.permissions).map(([permission, value]) => {
              const info = permissions.find((item) => item.id === permission);
              return (
                <Pressable
                  key={permission}
                  style={styles.permissionRow}
                  onPress={() => cycle(permission as keyof ReturnType<typeof blankOverrides>)}
                >
                  <View style={styles.copy}>
                    <Text style={styles.settingTitle}>
                      {info?.label ?? permissionLabel(permission)}
                    </Text>
                    <Text style={styles.settingMeta}>
                      {info?.description ?? 'Bu kanal için rol iznini belirler.'}
                    </Text>
                  </View>
                  <PermissionPill value={value ?? 'INHERIT'} />
                </Pressable>
              );
            })
          ) : (
            <Text style={styles.settingMeta}>Bir rol seç.</Text>
          )}
        </ScrollView>
        <Button
          label="İzinleri kaydet"
          disabled={!targets.length}
          onPress={() =>
            void api
              .request(`/servers/${serverId}/channels/${channel?.id}/permissions`, {
                method: 'PATCH',
                body: { targets },
              })
              .then(close)
          }
        />
      </Sheet>
    </Modal>
  );
}

function RoleEditor({
  serverId,
  role,
  members,
  close,
  refresh,
  refreshMembers,
}: {
  serverId: string;
  role: ServerRole | null;
  members: ServerMember[];
  close(): void;
  refresh(): Promise<unknown>;
  refreshMembers(): Promise<unknown>;
}) {
  const [section, setSection] = useState<'appearance' | 'permissions' | 'members'>('appearance');
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [hoist, setHoist] = useState(false);
  const [mentionable, setMentionable] = useState(false);
  const [enabled, setEnabled] = useState<ServerPermission[]>([]);
  useEffect(() => {
    if (role) {
      setName(role.name);
      setColor(role.color);
      setHoist(role.hoist);
      setMentionable(role.mentionable);
      setEnabled(role.permissions);
      setSection('appearance');
    }
  }, [role]);
  async function save() {
    if (!role || !name.trim() || !isHexColor(color)) return;
    await api.request(`/servers/${serverId}/roles/${role.id}`, {
      method: 'PATCH',
      body: {
        name: name.trim(),
        color: color.toUpperCase(),
        hoist,
        mentionable,
        permissions: enabled,
      },
    });
    await refresh();
    close();
  }
  return (
    <Modal visible={Boolean(role)} transparent animationType="slide" onRequestClose={close}>
      <Sheet close={close}>
        <Text style={styles.sheetTitle}>{role?.name} rolü</Text>
        <Text style={styles.sheetHint}>
          Görünüm, açıklamalı izinler ve rol üyeleri ayrı bölümlerdedir.
        </Text>
        <View style={styles.editorTabs}>
          <EditorTab
            label="Görünüm"
            active={section === 'appearance'}
            onPress={() => setSection('appearance')}
          />
          <EditorTab
            label="İzinler"
            active={section === 'permissions'}
            onPress={() => setSection('permissions')}
          />
          <EditorTab
            label="Üyeler"
            active={section === 'members'}
            disabled={Boolean(role?.isEveryone)}
            onPress={() => setSection('members')}
          />
        </View>
        {section === 'appearance' ? (
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            contentContainerStyle={styles.editorBody}
          >
            <View style={styles.rolePreview}>
              <View style={[styles.rolePreviewDot, { backgroundColor: color }]} />
              <View style={styles.copy}>
                <Text style={styles.settingMeta}>ROL ÖNİZLEMESİ</Text>
                <Text style={[styles.rolePreviewName, { color }]}>{name || 'Yeni rol'}</Text>
              </View>
            </View>
            <TextInput
              value={name}
              onChangeText={setName}
              editable={!role?.isEveryone}
              style={styles.input}
              placeholder="Rol adı"
              placeholderTextColor={colors.textDim}
            />
            <ColorEditor value={color} onChange={setColor} />
            <View style={styles.palette}>
              {['#3B82F6', '#22C55E', '#A855F7', '#F59E0B', '#EF4444'].map((item) => (
                <Pressable
                  key={item}
                  style={[
                    styles.paletteColor,
                    { backgroundColor: item },
                    item === color && styles.paletteActive,
                  ]}
                  onPress={() => setColor(item)}
                />
              ))}
            </View>
            <ToggleRow
              title="Ayrı göster"
              subtitle="Rol üyelerini çevrimiçi listesinde ayrı bir başlıkta gösterir."
              value={hoist}
              onChange={setHoist}
            />
            <ToggleRow
              title="Etiketlenebilir"
              subtitle="Diğer üyeler bu rolü mesajlarda etiketleyebilir."
              value={mentionable}
              onChange={setMentionable}
            />
          </ScrollView>
        ) : null}
        {section === 'permissions' ? (
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            contentContainerStyle={styles.permissionList}
            style={styles.roleEditorScroll}
          >
            {permissions.map((permission, index) => (
              <View key={permission.id}>
                {index === 0 || permissions[index - 1]?.group !== permission.group ? (
                  <Text style={styles.groupLabel}>{permission.group.toLocaleUpperCase('tr')}</Text>
                ) : null}
                <ToggleRow
                  title={permission.label}
                  subtitle={permission.description}
                  value={enabled.includes(permission.id)}
                  onChange={(value) =>
                    setEnabled((items) =>
                      value
                        ? [...items, permission.id]
                        : items.filter((item) => item !== permission.id),
                    )
                  }
                />
              </View>
            ))}
          </ScrollView>
        ) : null}
        {section === 'members' ? (
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            contentContainerStyle={styles.permissionList}
            style={styles.roleEditorScroll}
          >
            {members
              .filter((member) => member.role !== 'OWNER')
              .map((member) => {
                const assigned = Boolean(role && member.roles.some((item) => item.id === role.id));
                return (
                  <Pressable
                    key={member.id}
                    style={styles.roleMemberRow}
                    disabled={!role || role.isEveryone}
                    onPress={() => {
                      if (!role) return;
                      void api
                        .request(`/servers/${serverId}/members/${member.id}/roles/${role.id}`, {
                          method: assigned ? 'DELETE' : 'POST',
                        })
                        .then(() => Promise.all([refresh(), refreshMembers()]));
                    }}
                  >
                    <Avatar
                      name={member.displayName}
                      uri={member.avatarUrl}
                      size={40}
                      online={member.status !== 'OFFLINE'}
                    />
                    <View style={styles.copy}>
                      <Text style={styles.settingTitle}>{member.displayName}</Text>
                      <Text style={styles.settingMeta}>@{member.username}</Text>
                    </View>
                    <Icon
                      name={assigned ? 'check-circle' : 'plus-circle-outline'}
                      color={assigned ? colors.success : colors.textMuted}
                      size={24}
                    />
                  </Pressable>
                );
              })}
          </ScrollView>
        ) : null}
        {section !== 'members' ? (
          <Button
            label="Rolü kaydet"
            disabled={!name.trim() || !isHexColor(color)}
            onPress={() => void save()}
          />
        ) : null}
        {role && !role.isEveryone && section === 'appearance' ? (
          <Button
            label="Rolü sil"
            variant="danger"
            onPress={() =>
              void api
                .request(`/servers/${serverId}/roles/${role.id}`, { method: 'DELETE' })
                .then(refresh)
                .then(close)
            }
          />
        ) : null}
      </Sheet>
    </Modal>
  );
}

function EditorTab({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      disabled={disabled}
      style={[
        styles.editorTab,
        active && styles.editorTabActive,
        disabled && styles.editorTabDisabled,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.editorTabText, active && styles.editorTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function MemberManager({
  serverId,
  member,
  roles,
  close,
  refresh,
}: {
  serverId: string;
  member: ServerMember | null;
  roles: ServerRole[];
  close(): void;
  refresh(): Promise<unknown>;
}) {
  const { enabled: developerMode } = useDeveloperMode();
  const [reason, setReason] = useState('');
  const [timeoutMinutes, setTimeoutMinutes] = useState('60');
  const history = useQuery({ queryKey: ['member-moderation-history', serverId, member?.id], enabled: Boolean(member), queryFn: () => api.request<ServerAuditEvent[]>(`/servers/${serverId}/members/${member!.id}/moderation-history`) });
  async function timeout(durationMinutes: number | null) {
    if (!member) return;
    await api.request(`/servers/${serverId}/members/${member.id}/timeout`, { method: 'PATCH', body: { durationMinutes, reason: reason.trim() || undefined } });
    await Promise.all([refresh(), history.refetch()]);
  }
  return (
    <Modal visible={Boolean(member)} transparent animationType="slide" onRequestClose={close}>
      <Sheet close={close}>
        {member ? (
          <>
            <View style={styles.memberHero}>
              {member.bannerUrl ? (
                <SecureImage
                  uri={member.bannerUrl}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              ) : null}
              <Avatar
                name={member.displayName}
                uri={member.avatarUrl}
                size={64}
                online={member.status !== 'OFFLINE'}
              />
              <View style={styles.copy}>
                <Text style={styles.sheetTitle}>{member.displayName}</Text>
                <Text style={styles.settingMeta}>
                  @{member.username}{developerMode ? ` · ${member.publicId}` : ''}
                </Text>
              </View>
            </View>
            {member.customStatusText ? (
              <Text style={styles.statusText}>
                {member.customStatusEmoji} {member.customStatusText}
              </Text>
            ) : null}
            {member.bio ? <Text style={styles.bioText}>{member.bio}</Text> : null}
            <Text style={styles.label}>ROLLER</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.choiceRow}
            >
              {roles
                .filter((role) => !role.isEveryone)
                .map((role) => {
                  const assigned = member.roles.some((item) => item.id === role.id);
                  return (
                    <Choice
                      key={role.id}
                      active={assigned}
                      label={role.name}
                      onPress={() =>
                        void api
                          .request(`/servers/${serverId}/members/${member.id}/roles/${role.id}`, {
                            method: assigned ? 'DELETE' : 'POST',
                          })
                          .then(refresh)
                      }
                    />
                  );
                })}
            </ScrollView>
            {member.role !== 'OWNER' ? (
              <>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  style={styles.input}
                  placeholder="Moderasyon sebebi (isteğe bağlı)"
                  placeholderTextColor={colors.textDim}
                />
                <View style={styles.moderationGrid}>
                  <Button
                    label="Uyar"
                    variant="secondary"
                    onPress={() =>
                      void api.request(`/servers/${serverId}/members/${member.id}/actions/warn`, {
                        method: 'POST',
                        body: { reason: reason.trim() || undefined },
                      })
                    }
                  />
                  <Button
                    label="Mola uygula"
                    variant="secondary"
                    disabled={!Number.isInteger(Number(timeoutMinutes)) || Number(timeoutMinutes) < 1 || Number(timeoutMinutes) > 40_320}
                    onPress={() => void timeout(Number(timeoutMinutes))}
                  />
                  <Button label="Molayı kaldır" variant="secondary" onPress={() => void timeout(null)} />
                  <Button
                    label="Sunucudan at"
                    variant="danger"
                    onPress={() =>
                      void api
                        .request(`/servers/${serverId}/members/${member.id}/actions/kick`, {
                          method: 'POST',
                          body: { reason: reason.trim() || undefined },
                        })
                        .then(refresh)
                        .then(close)
                    }
                  />
                  <Button
                    label="Yasakla"
                    variant="danger"
                    onPress={() =>
                      void api
                        .request(`/servers/${serverId}/members/${member.id}/actions/ban`, {
                          method: 'POST',
                          body: { reason: reason.trim() || undefined, deleteMessageSeconds: '0' },
                        })
                        .then(refresh)
                        .then(close)
                    }
                  />
                </View>
                <Text style={styles.label}>ÖZEL MOLA SÜRESİ (DAKİKA)</Text>
                <TextInput value={timeoutMinutes} onChangeText={(value) => setTimeoutMinutes(value.replace(/\D/gu, ''))} keyboardType="number-pad" style={styles.input} placeholder="1–40320 dakika" placeholderTextColor={colors.textDim} />
                <View style={styles.durationGrid}>{[[5, '5 dk'], [30, '30 dk'], [60, '1 saat'], [1440, '1 gün'], [10080, '1 hafta']].map(([value, label]) => <Choice key={value} active={timeoutMinutes === String(value)} label={String(label)} onPress={() => setTimeoutMinutes(String(value))} />)}</View>
                <Text style={styles.label}>MODERASYON GEÇMİŞİ · {history.data?.length ?? 0}</Text>
                {history.data?.map((event) => <View key={event.id} style={styles.historyRow}><Icon name="history" color={colors.textDim} size={18} /><View style={styles.copy}><Text style={styles.settingTitle}>{auditAction(event.action)}</Text><Text style={styles.settingMeta}>{new Date(event.createdAt).toLocaleString('tr-TR')}{event.durationMinutes ? ` · ${event.durationMinutes} dk` : ''}</Text>{event.reason ? <Text style={styles.auditReason}>{event.reason}</Text> : null}</View></View>)}
                {!history.isLoading && !history.data?.length ? <Text style={styles.settingMeta}>Bu üye için kayıtlı moderasyon işlemi yok.</Text> : null}
              </>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </Modal>
  );
}

function DeleteServerSheet({
  serverId,
  visible,
  close,
}: {
  serverId: string;
  visible: boolean;
  close(): void;
}) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Sheet close={close}>
        <Text style={styles.sheetTitle}>Sunucuyu kalıcı olarak sil</Text>
        <Text style={styles.settingMeta}>
          Bu işlem kanalları, mesajları ve rolleri siler; geri alınamaz.
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          placeholder="Mevcut parola"
          placeholderTextColor={colors.textDim}
        />
        <TextInput
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          style={styles.input}
          placeholder="2FA kodu (varsa)"
          placeholderTextColor={colors.textDim}
        />
        <Button
          label="Kalıcı olarak sil"
          variant="danger"
          disabled={!password}
          onPress={() =>
            void api
              .request(`/servers/${serverId}`, {
                method: 'DELETE',
                body: { currentPassword: password, ...(code ? { code } : {}) },
              })
              .then(() => router.replace('/(tabs)'))
          }
        />
      </Sheet>
    </Modal>
  );
}
function CreateChannelSheet({
  visible,
  close,
  submit,
}: {
  visible: boolean;
  close(): void;
  submit(name: string, type: 'TEXT' | 'VOICE'): Promise<void>;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'TEXT' | 'VOICE'>('TEXT');
  const [busy, setBusy] = useState(false);
  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await submit(name.trim(), type);
      setName('');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Sheet close={close}>
        <Text style={styles.sheetTitle}>Kanal oluştur</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          style={styles.input}
          placeholder="kanal-adı"
          placeholderTextColor={colors.textDim}
        />
        <View style={styles.typeChoices}>
          <Choice active={type === 'TEXT'} label="Metin" onPress={() => setType('TEXT')} />
          <Choice active={type === 'VOICE'} label="Ses" onPress={() => setType('VOICE')} />
        </View>
        <Button
          label="Kanalı oluştur"
          loading={busy}
          disabled={!name.trim()}
          onPress={() => void create()}
        />
      </Sheet>
    </Modal>
  );
}
function CreateRoleSheet({
  visible,
  close,
  submit,
}: {
  visible: boolean;
  close(): void;
  submit(name: string, color: string, hoist: boolean): Promise<void>;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [hoist, setHoist] = useState(true);
  const [busy, setBusy] = useState(false);
  async function create() {
    if (!name.trim() || !isHexColor(color)) return;
    setBusy(true);
    try {
      await submit(name.trim(), color.toUpperCase(), hoist);
      setName('');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Sheet close={close}>
        <Text style={styles.sheetTitle}>Rol oluştur</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          style={styles.input}
          placeholder="Rol adı"
          placeholderTextColor={colors.textDim}
        />
        <ColorEditor value={color} onChange={setColor} />
        <View style={styles.palette}>
          {['#3B82F6', '#22C55E', '#A855F7', '#F59E0B', '#EF4444'].map((item) => (
            <Pressable
              key={item}
              style={[
                styles.paletteColor,
                { backgroundColor: item },
                item === color && styles.paletteActive,
              ]}
              onPress={() => setColor(item)}
            />
          ))}
        </View>
        <ToggleRow title="Ayrı göster" value={hoist} onChange={setHoist} />
        <Button
          label="Rolü oluştur"
          loading={busy}
          disabled={!name.trim() || !isHexColor(color)}
          onPress={() => void create()}
        />
      </Sheet>
    </Modal>
  );
}
function BrandingActionSheet({
  kind,
  hasImage,
  close,
  choose,
  remove,
}: {
  kind: 'icon' | 'banner' | null;
  hasImage: boolean;
  close(): void;
  choose(source: 'library' | 'camera'): void | Promise<void>;
  remove(): void | Promise<void>;
}) {
  return (
    <Modal visible={Boolean(kind)} transparent animationType="fade" onRequestClose={close}>
      <Sheet close={close}>
        <Text style={styles.sheetTitle}>{kind === 'icon' ? 'Sunucu simgesi' : 'Sunucu afişi'}</Text>
        <Text style={styles.settingMeta}>
          Görseli seçtikten sonra kırpma ve boyutlandırma ekranında çerçeveyi ayarlayabilirsin.
        </Text>
        <Pressable style={styles.mediaAction} onPress={() => void choose('library')}>
          <Icon name="image-multiple-outline" color={colors.waveBright} size={23} />
          <Text style={styles.mediaActionText}>Galeriden seç</Text>
        </Pressable>
        <Pressable style={styles.mediaAction} onPress={() => void choose('camera')}>
          <Icon name="camera-outline" color={colors.waveBright} size={23} />
          <Text style={styles.mediaActionText}>Fotoğraf çek</Text>
        </Pressable>
        {hasImage ? (
          <Pressable style={styles.mediaAction} onPress={() => void remove()}>
            <Icon name="trash-can-outline" color={colors.danger} size={23} />
            <Text style={[styles.mediaActionText, { color: colors.danger }]}>Görseli sil</Text>
          </Pressable>
        ) : null}
      </Sheet>
    </Modal>
  );
}

function ColorEditor({ value, onChange }: { value: string; onChange(value: string): void }) {
  return (
    <View style={styles.colorEditor}>
      <View
        style={[
          styles.colorPreview,
          { backgroundColor: isHexColor(value) ? value : colors.wave },
        ]}
      />
      <View style={styles.copy}>
        <Text style={styles.label}>ÖZEL RENK</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          maxLength={7}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.colorInput}
          placeholder="#3B82F6"
          placeholderTextColor={colors.textDim}
        />
      </View>
    </View>
  );
}

function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/iu.test(value.trim());
}

function NameSheet({
  visible,
  title,
  placeholder,
  close,
  submit,
}: {
  visible: boolean;
  title: string;
  placeholder: string;
  close(): void;
  submit(name: string): Promise<void>;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Sheet close={close}>
        <Text style={styles.sheetTitle}>{title}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textDim}
        />
        <Button
          label="Oluştur"
          loading={busy}
          disabled={!name.trim()}
          onPress={() => {
            setBusy(true);
            void submit(name.trim()).finally(() => {
              setBusy(false);
              setName('');
            });
          }}
        />
      </Sheet>
    </Modal>
  );
}

function Sheet({ children, close }: { children: ReactNode; close(): void }) {
  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      <SwipeableSheetSurface onClose={close} style={styles.sheet}>
        <ScrollView
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          contentContainerStyle={styles.sheetContent}
        >
          {children}
        </ScrollView>
      </SwipeableSheetSurface>
    </View>
  );
}
function SelectField({
  value,
  placeholder,
  options,
  onSelect,
}: {
  value: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  onSelect(value: string): void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <>
      <Pressable style={styles.selectField} onPress={() => setOpen(true)}>
        <Text style={styles.selectValue}>{selected?.label ?? placeholder}</Text>
        <Icon name="chevron-down" color={colors.textMuted} size={23} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Sheet close={() => setOpen(false)}>
          <Text style={styles.sheetTitle}>{placeholder}</Text>
          <ScrollView
            style={styles.selectScroll}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            contentContainerStyle={styles.selectOptions}
          >
            {options.map((option) => (
              <Pressable
                key={option.value || '__empty'}
                style={[styles.selectOption, option.value === value && styles.selectOptionActive]}
                onPress={() => {
                  onSelect(option.value);
                  setOpen(false);
                }}
              >
                <Text style={styles.settingTitle}>{option.label}</Text>
                {option.value === value ? (
                  <Icon name="check-circle" color={colors.success} size={23} />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </Sheet>
      </Modal>
    </>
  );
}
function MultiSelectField({
  placeholder,
  selected,
  options,
  onChange,
}: {
  placeholder: string;
  selected: string[];
  options: Array<{ value: string; label: string }>;
  onChange(value: string[]): void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const visible = options.filter((option) => option.label.toLocaleLowerCase('tr').includes(search.trim().toLocaleLowerCase('tr')));
  return <>
    <Pressable style={styles.multiSelect} onPress={() => setOpen(true)} accessibilityLabel={placeholder}>
      <View style={styles.multiPills}>{selected.length ? selected.map((id) => { const option = options.find((item) => item.value === id); return option ? <View key={id} style={styles.multiPill}><Text style={styles.multiPillText}>{option.label}</Text><Pressable onPress={() => onChange(selected.filter((value) => value !== id))} accessibilityLabel={`${option.label} seçimini kaldır`}><Icon name="close" color={colors.textDim} size={15} /></Pressable></View> : null; }) : <Text style={styles.selectValue}>{placeholder}</Text>}</View>
      <Icon name="chevron-down" color={colors.textMuted} size={23} />
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}><View style={styles.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} /><Sheet close={() => setOpen(false)}><Text style={styles.sheetTitle}>{placeholder}</Text><TextInput value={search} onChangeText={setSearch} placeholder={placeholder} placeholderTextColor={colors.textDim} style={styles.input} autoCapitalize="none" /><ScrollView style={styles.selectScroll} nestedScrollEnabled showsVerticalScrollIndicator contentContainerStyle={styles.selectOptions}>{visible.map((option) => { const active = selected.includes(option.value); return <Pressable key={option.value} style={[styles.selectOption, active && styles.selectOptionActive]} onPress={() => onChange(active ? selected.filter((value) => value !== option.value) : [...selected, option.value])}><Text style={styles.settingTitle}>{option.label}</Text><Icon name={active ? 'checkbox-marked' : 'checkbox-blank-outline'} color={active ? colors.waveBright : colors.textDim} size={23} /></Pressable>; })}{!visible.length ? <Text style={styles.settingMeta}>Sonuç bulunamadı.</Text> : null}</ScrollView><Button label="Tamam" onPress={() => { setOpen(false); setSearch(''); }} /></Sheet></View></Modal>
  </>;
}
function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.copy}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionMeta}>{subtitle}</Text>
    </View>
  );
}
function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange(value: boolean): void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.copy}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle ? <Text style={styles.settingMeta}>{subtitle}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.lineStrong, true: colors.wave }}
      />
    </View>
  );
}
function Choice({ active, label, onPress }: { active: boolean; label: string; onPress(): void }) {
  return (
    <Pressable style={[styles.choice, active && styles.choiceActive]} onPress={onPress}>
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}
function RoundButton({
  icon,
  danger,
  onPress,
}: {
  icon: IconName;
  danger?: boolean;
  onPress(): void;
}) {
  return (
    <Pressable style={styles.roundButton} onPress={onPress}>
      <Icon name={icon} color={danger ? colors.danger : colors.waveBright} size={22} />
    </Pressable>
  );
}
function PermissionPill({ value }: { value: ChannelPermissionValue }) {
  return (
    <View
      style={[
        styles.permissionPill,
        value === 'ALLOW'
          ? styles.permissionAllow
          : value === 'DENY'
            ? styles.permissionDeny
            : null,
      ]}
    >
      <Text style={styles.permissionPillText}>
        {value === 'ALLOW' ? 'İzin ver' : value === 'DENY' ? 'Reddet' : 'Devral'}
      </Text>
    </View>
  );
}
function permissionLabel(value: string) {
  return value
    .replaceAll('_', ' ')
    .toLocaleLowerCase('tr')
    .replace(/^./u, (letter) => letter.toLocaleUpperCase('tr'));
}
function targetKey(target: ChannelPermissionTargetState) {
  return target.target.type === 'EVERYONE'
    ? 'EVERYONE'
    : target.target.type === 'ROLE'
      ? `ROLE:${target.target.roleId}`
      : `USER:${target.target.userId}`;
}
function blankOverrides() {
  return {
    VIEW_CHANNEL: 'INHERIT',
    MANAGE_CHANNELS: 'INHERIT',
    SEND_MESSAGES: 'INHERIT',
    ATTACH_FILES: 'INHERIT',
    USE_GIFS: 'INHERIT',
    ADD_REACTIONS: 'INHERIT',
    CREATE_POLLS: 'INHERIT',
    CONNECT: 'INHERIT',
    SPEAK: 'INHERIT',
    USE_CAMERA: 'INHERIT',
    SHARE_SCREEN: 'INHERIT',
  } as const satisfies Record<string, ChannelPermissionValue>;
}
function nextPermission(value: ChannelPermissionValue): ChannelPermissionValue {
  return value === 'INHERIT' ? 'ALLOW' : value === 'ALLOW' ? 'DENY' : 'INHERIT';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  iconButton: {
    width: touch.minimum,
    height: touch.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  serverHead: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  serverMark: {
    width: 52,
    height: 52,
    borderRadius: 17,
    overflow: 'hidden',
    backgroundColor: colors.wave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serverMarkText: { color: colors.text, ...typography.label },
  serverName: { color: colors.text, ...typography.heading },
  serverMeta: { color: colors.textDim, ...typography.caption },
  tabsScroll: { flexGrow: 0, height: 58, maxHeight: 58 },
  tabs: {
    height: 58,
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  tab: {
    minWidth: 92,
    height: 42,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.surfaceRaised, borderColor: colors.waveBright },
  tabText: { color: colors.textDim, ...typography.caption, fontWeight: '700' },
  tabTextActive: { color: colors.text },
  mainScroll: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
  label: {
    color: colors.textDim,
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: spacing.sm,
  },
  input: {
    minHeight: touch.minimum,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  textarea: { minHeight: 98, paddingVertical: spacing.sm, textAlignVertical: 'top' },
  emojiUploadCard: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  emojiList: { gap: spacing.xs },
  emojiRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface },
  emojiImage: { width: 42, height: 42 },
  sectionHead: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitle: { color: colors.text, ...typography.title },
  sectionMeta: { color: colors.textDim, ...typography.caption },
  headActions: { flexDirection: 'row', gap: spacing.xs },
  roundButton: {
    width: touch.minimum,
    height: touch.minimum,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandingCard: {
    minHeight: 146,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  brandIcon: {
    width: 84,
    height: 84,
    borderRadius: 26,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.wave,
  },
  brandInitial: { color: colors.text, ...typography.title },
  brandBanner: {
    flex: 1,
    height: 112,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  emptyBanner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
  },
  brandEdit: {
    position: 'absolute',
    right: spacing.xs,
    bottom: spacing.xs,
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  brandRemoveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  choiceRow: { flexDirection: 'row', gap: spacing.xs, paddingRight: spacing.md },
  choice: {
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceActive: { borderColor: colors.waveBright, backgroundColor: colors.surfaceRaised },
  choiceText: { color: colors.textDim, ...typography.caption, fontWeight: '700' },
  choiceTextActive: { color: colors.text },
  preferenceCard: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  preferenceHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  preferenceChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  preferenceChoice: {
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupLabel: {
    color: colors.textDim,
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  settingRow: {
    minHeight: 62,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  settingIcon: { width: 34, alignItems: 'center' },
  settingTitle: { color: colors.text, ...typography.label },
  settingMeta: { color: colors.textDim, ...typography.caption },
  roleRow: {
    minHeight: 62,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dragRow: {
    minHeight: 62,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  dragRowActive: {
    opacity: 0.9,
    borderWidth: 1,
    borderColor: colors.waveBright,
    backgroundColor: colors.surfaceRaised,
  },
  dragHandle: {
    width: touch.minimum,
    minHeight: touch.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBlock: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
    padding: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.canvas,
  },
  categoryHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryNameButton: {
    flex: 1,
    minHeight: touch.minimum,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleDot: { width: 16, height: 16, borderRadius: radius.pill },
  memberRow: {
    minHeight: 64,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  memberSection: { gap: spacing.xs, marginBottom: spacing.sm },
  inviteRow: {
    minHeight: 72,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  inlineInputs: { flexDirection: 'row', gap: spacing.sm },
  smallInput: { flex: 1 },
  toggleRow: {
    minHeight: 68,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  auditRow: {
    minHeight: 70,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  auditFilters: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
  },
  auditReason: { color: colors.textMuted, ...typography.caption, marginTop: 3 },
  auditDetail: {
    gap: spacing.xxs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  historyRow: {
    minHeight: 62,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  dangerZone: {
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  dangerTitle: { color: colors.danger, ...typography.heading },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    width: '100%',
    maxHeight: '94%',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.canvas,
  },
  sheetContent: { gap: spacing.sm, paddingBottom: spacing.md },
  handle: {
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.lineStrong,
    alignSelf: 'center',
  },
  sheetTitle: { color: colors.text, ...typography.title },
  sheetHint: { color: colors.textMuted, ...typography.caption },
  typeChoices: { flexDirection: 'row', gap: spacing.sm },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  paletteColor: { width: 42, height: 42, borderRadius: radius.pill },
  paletteActive: { borderWidth: 3, borderColor: colors.text },
  colorEditor: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  colorPreview: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.lineStrong,
  },
  colorInput: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    ...typography.body,
  },
  mediaAction: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  mediaActionText: { color: colors.text, ...typography.body },
  editorTabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  editorTab: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorTabActive: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.waveBright,
  },
  editorTabDisabled: { opacity: 0.4 },
  editorTabText: { color: colors.textDim, ...typography.caption, fontWeight: '700' },
  editorTabTextActive: { color: colors.text },
  editorBody: { gap: spacing.sm, paddingBottom: spacing.md },
  rolePreview: {
    minHeight: 74,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rolePreviewDot: { width: 22, height: 22, borderRadius: radius.pill },
  rolePreviewName: { ...typography.heading },
  roleEditorScroll: { maxHeight: 480 },
  roleMemberRow: {
    minHeight: 64,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  permissionScroll: { maxHeight: 430 },
  permissionList: { gap: spacing.xs, paddingBottom: spacing.md },
  permissionRow: {
    minHeight: 74,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  permissionPill: {
    minWidth: 78,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  permissionAllow: { backgroundColor: 'rgba(34,197,94,.22)' },
  permissionDeny: { backgroundColor: 'rgba(239,68,68,.22)' },
  permissionPillText: { color: colors.textMuted, ...typography.caption, textAlign: 'center' },
  selectField: {
    minHeight: 54,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectValue: { flex: 1, color: colors.text, ...typography.body },
  multiSelect: { minHeight: 54, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  multiPills: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingVertical: spacing.xs },
  multiPill: { maxWidth: '100%', minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised },
  multiPillText: { maxWidth: 190, color: colors.text, ...typography.caption },
  selectScroll: { maxHeight: 600 },
  selectOptions: { gap: spacing.xs, paddingBottom: spacing.xxl },
  selectOption: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectOptionActive: {
    borderWidth: 1,
    borderColor: colors.waveBright,
    backgroundColor: colors.surfaceRaised,
  },
  autoModCard: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
  },
  autoModTitle: { color: colors.text, ...typography.heading },
  autoModFields: { gap: spacing.sm },
  numberSetting: { flex: 1, gap: spacing.xxs },
  memberHero: {
    minHeight: 92,
    borderRadius: radius.lg,
    overflow: 'hidden',
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: colors.surfaceRaised,
  },
  statusText: {
    color: colors.text,
    ...typography.body,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  bioText: { color: colors.textMuted, ...typography.body },
  moderationGrid: { gap: spacing.xs },
  durationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
