import { TextInput, Modal, Text, Pressable } from '@/components/localized-native';
import type { ChannelTree,
  DirectConversation,
  Friend,
  GlobalMessageSearchItem,
  GlobalMessageSearchPage,
  GroupConversation,
  ServerChannel,
  ServerSummary } from '@wapve/contracts';
import {
  colors,
  radius,
  spacing,
  touch,
  typography } from '@wapve/design-tokens';
import { useInfiniteQuery,
  useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect,
  useMemo,
  useState,
  type ReactNode } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { Icon, type IconName } from '@/components/icon';
import { Avatar, Button } from '@/components/ui';
import { SwipeableSheetSurface } from '@/components/swipeable-sheet';
import { api } from '@/lib/client';
import { useI18n } from '@/lib/i18n';
import { messagePreview } from '@/lib/message-presentation';

type SearchScope = 'all' | 'people' | 'conversations' | 'servers' | 'channels' | 'messages';
type TreeResult = { server: ServerSummary; tree: ChannelTree };
const scopeDefinitions: Array<{ id: SearchScope; labelKey: string; icon: IconName; descriptionKey: string }> = [
  { id: 'all', labelKey: 'all', icon: 'magnify', descriptionKey: 'searchAllDescription' },
  { id: 'people', labelKey: 'people', icon: 'account-outline', descriptionKey: 'searchPeopleDescription' },
  { id: 'conversations', labelKey: 'conversations', icon: 'message-outline', descriptionKey: 'searchConversationsDescription' },
  { id: 'servers', labelKey: 'servers', icon: 'server-outline', descriptionKey: 'searchServersDescription' },
  { id: 'channels', labelKey: 'channels', icon: 'pound', descriptionKey: 'searchChannelsDescription' },
  { id: 'messages', labelKey: 'messages', icon: 'text-box-search-outline', descriptionKey: 'searchMessagesDescription' },
];

export default function SearchScreen() {
  const { t } = useI18n();
  const [term, setTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const normalized = term.trim().toLocaleLowerCase('tr');
  const localizedScopes = useMemo(() => scopeDefinitions.map((item) => ({ ...item, label: t(item.labelKey), description: t(item.descriptionKey) })), [t]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term.trim()), 350);
    return () => clearTimeout(timer);
  }, [term]);

  const friends = useQuery({ queryKey: ['friends'], queryFn: () => api.request<Friend[]>('/social/friends') });
  const direct = useQuery({ queryKey: ['dm-conversations'], queryFn: () => api.request<DirectConversation[]>('/dm/conversations') });
  const groups = useQuery({ queryKey: ['group-conversations'], queryFn: () => api.request<GroupConversation[]>('/dm/groups') });
  const servers = useQuery({ queryKey: ['servers'], queryFn: () => api.request<ServerSummary[]>('/servers') });
  const serverIds = servers.data?.map((server) => server.id) ?? [];
  const trees = useQuery({
    queryKey: ['global-search-channel-trees', serverIds],
    enabled: serverIds.length > 0,
    queryFn: async () => Promise.all((servers.data ?? []).map(async (server): Promise<TreeResult> => ({ server, tree: await api.request<ChannelTree>(`/servers/${server.id}/channels`) }))),
  });

  const results = useMemo(() => {
    const includes = (value: string) => value.toLocaleLowerCase('tr').includes(normalized);
    return {
      friends: friends.data?.filter((item) => includes(`${item.user.displayName} ${item.user.username}`)) ?? [],
      direct: direct.data?.filter((item) => includes(`${item.otherUser.displayName} ${item.otherUser.username}`)) ?? [],
      groups: groups.data?.filter((item) => includes(item.name)) ?? [],
      servers: servers.data?.filter((item) => includes(item.name)) ?? [],
      channels: trees.data?.flatMap(({ server, tree }) => tree.channels.filter((channel) => includes(`${channel.name} ${channel.topic ?? ''}`)).map((channel) => ({ server, channel }))) ?? [],
    };
  }, [direct.data, friends.data, groups.data, normalized, servers.data, trees.data]);

  const messageSearch = useInfiniteQuery({
    queryKey: ['global-message-search', debouncedTerm],
    enabled: debouncedTerm.length >= 2,
    staleTime: 20_000,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ q: debouncedTerm, limit: '30' });
      if (pageParam) params.set('cursor', pageParam);
      return api.request<GlobalMessageSearchPage>(`/search/messages?${params.toString()}`);
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const messageResults = messageSearch.data?.pages.flatMap((page) => page.items) ?? [];

  const visible = {
    people: scope === 'all' || scope === 'people',
    conversations: scope === 'all' || scope === 'conversations' || scope === 'people',
    servers: scope === 'all' || scope === 'servers',
    channels: scope === 'all' || scope === 'channels',
    messages: scope === 'all' || scope === 'messages',
  };
  const hasLocalResults = (visible.people && results.friends.length > 0) || (visible.conversations && (results.direct.length > 0 || results.groups.length > 0)) || (visible.servers && results.servers.length > 0) || (visible.channels && results.channels.length > 0);
  const hasResults = hasLocalResults || (visible.messages && messageResults.length > 0);

  async function openServer(server: ServerSummary) {
    const existing = trees.data?.find((item) => item.server.id === server.id)?.tree;
    const tree = existing ?? await api.request<ChannelTree>(`/servers/${server.id}/channels`);
    const channel = sortedChannels(tree)[0];
    if (!channel) {
      router.push({ pathname: '/servers/[serverId]/settings', params: { serverId: server.id } });
      return;
    }
    openChannel(server, channel);
  }

  function openChannel(server: ServerSummary, channel: ServerChannel) {
    if (channel.type === 'VOICE') router.push({ pathname: '/voice/[serverId]/[channelId]', params: { serverId: server.id, channelId: channel.id, name: channel.name } });
    else router.push({ pathname: '/channel/[serverId]/[channelId]', params: { serverId: server.id, channelId: channel.id, name: channel.name } });
  }

  function openMessage(result: GlobalMessageSearchItem) {
    if (result.kind === 'channel') router.push({ pathname: '/channel/[serverId]/[channelId]', params: { serverId: result.serverId!, channelId: result.channelId!, name: result.title.replace(/^#\s*/u, ''), messageId: result.messageId } });
    else if (result.kind === 'direct') router.push({ pathname: '/dm/[conversationId]', params: { conversationId: result.conversationId!, name: result.title, messageId: result.messageId } });
    else router.push({ pathname: '/group/[conversationId]', params: { conversationId: result.conversationId!, name: result.title, messageId: result.messageId } });
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Geri"><Icon name="arrow-left" color={colors.text} size={27} /></Pressable>
        <View style={styles.searchShell}><Icon name="magnify" color={colors.textDim} size={23} /><TextInput testID="search.input" autoFocus returnKeyType="search" style={styles.input} value={term} onChangeText={setTerm} placeholder={t('searchEverywhere')} placeholderTextColor={colors.textDim} accessibilityLabel={t('search')} />{term ? <Pressable style={styles.clear} onPress={() => setTerm('')} accessibilityRole="button" accessibilityLabel={t('clearSearch')}><Icon name="close-circle" color={colors.textDim} size={21} /></Pressable> : null}</View>
        <Pressable style={[styles.iconButton, styles.filter, scope !== 'all' && styles.filterActive]} onPress={() => setFilterOpen(true)} accessibilityRole="button" accessibilityLabel={`${t('searchFilter')}: ${scopeLabel(localizedScopes, scope)}`}><Icon name="tune-variant" color={scope === 'all' ? colors.textMuted : colors.waveBright} size={23} /></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs} accessibilityRole="tablist">{localizedScopes.map((item) => <SearchTab key={item.id} label={item.label} active={scope === item.id} onPress={() => setScope(item.id)} />)}</ScrollView>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {!normalized ? <SearchEmpty /> : null}
        {normalized && visible.people ? <Section label={t('people')}>{results.friends.map((friend) => <Result key={friend.friendshipId} name={friend.user.displayName} uri={friend.user.avatarUrl} meta={`@${friend.user.username}`} onPress={() => router.push({ pathname: '/dm/[conversationId]', params: { conversationId: friend.conversationId, name: friend.user.displayName } })} />)}</Section> : null}
        {normalized && visible.conversations ? <><Section label={t('directMessages')}>{results.direct.map((conversation) => <Result key={conversation.id} name={conversation.otherUser.displayName} uri={conversation.otherUser.avatarUrl} meta={conversation.lastMessage ? messagePreview(conversation.lastMessage) : `@${conversation.otherUser.username}`} onPress={() => router.push({ pathname: '/dm/[conversationId]', params: { conversationId: conversation.id, name: conversation.otherUser.displayName } })} />)}</Section><Section label={t('groups')}>{results.groups.map((group) => <Result key={group.id} name={group.name} uri={group.avatarUrl} meta={`${group.members.length} ${t('members').toLocaleLowerCase()}`} onPress={() => router.push({ pathname: '/group/[conversationId]', params: { conversationId: group.id, name: group.name } })} />)}</Section></> : null}
        {normalized && visible.servers ? <Section label={t('servers')}>{results.servers.map((server) => <Result key={server.id} name={server.name} uri={server.iconUrl} meta={`${server.memberCount} ${t('members').toLocaleLowerCase()}`} onPress={() => void openServer(server)} />)}</Section> : null}
        {normalized && visible.channels ? <Section label={t('channels')}>{results.channels.map(({ server, channel }) => <Result key={channel.id} name={channel.name} uri={server.iconUrl} meta={`${channel.type === 'VOICE' ? t('voice') : t('textChannel')} · ${server.name}${channel.topic ? ` · ${channel.topic}` : ''}`} icon={channel.type === 'VOICE' ? 'volume-high' : 'pound'} onPress={() => openChannel(server, channel)} />)}</Section> : null}
        {normalized && visible.messages ? <Section label={t('messages')}>{messageSearch.isFetching && !messageSearch.isFetchingNextPage ? <View style={styles.loading}><ActivityIndicator color={colors.waveBright} /><Text style={styles.meta}>{t('searchingEverywhere')}</Text></View> : null}{messageResults.map((result) => <Result key={`${result.kind}:${result.messageId}`} name={result.title} uri={result.avatarUrl} meta={`${result.context} · ${result.author ? `${result.author.displayName}: ` : ''}${result.content}`} icon="text-box-outline" onPress={() => openMessage(result)} />)}{messageSearch.hasNextPage ? <Button label={messageSearch.isFetchingNextPage ? 'Daha fazla aranıyor…' : 'Daha fazla sonuç'} loading={messageSearch.isFetchingNextPage} variant="secondary" onPress={() => void messageSearch.fetchNextPage()} /> : null}{debouncedTerm.length < 2 ? <Text style={styles.helper}>{t('searchMinimum')}</Text> : null}</Section> : null}
        {normalized && !hasResults && !messageSearch.isFetching ? <View style={styles.noResults}><Icon name="magnify-close" color={colors.textDim} size={42} /><Text style={styles.emptyTitle}>{t('noSearchResults')}</Text><Text style={styles.emptyBody}>{t('noSearchResultsBody')}</Text></View> : null}
      </ScrollView>
      <FilterSheet visible={filterOpen} value={scope} scopes={localizedScopes} title={t('searchFilter')} select={(next) => { setScope(next); setFilterOpen(false); }} close={() => setFilterOpen(false)} />
    </SafeAreaView>
  );
}

function sortedChannels(tree: ChannelTree) {
  const positions = new Map(tree.categories.map((category) => [category.id, category.position]));
  return tree.channels.slice().sort((a, b) => (positions.get(a.categoryId ?? '') ?? Number.MAX_SAFE_INTEGER) - (positions.get(b.categoryId ?? '') ?? Number.MAX_SAFE_INTEGER) || a.position - b.position);
}

function scopeLabel(scopes: Array<{ id: SearchScope; label: string }>, scope: SearchScope) { return scopes.find((item) => item.id === scope)?.label ?? ''; }
function SearchEmpty() { const { t } = useI18n(); return <View style={styles.empty}><View style={styles.emptyMark}><Icon name="magnify" color={colors.waveBright} size={50} /></View><Text style={styles.emptyTitle}>{t('findOnWapve')}</Text><Text style={styles.emptyBody}>{t('findOnWapveBody')}</Text></View>; }
function FilterSheet({ visible, value, scopes, title, select, close }: { visible: boolean; value: SearchScope; scopes: Array<{ id: SearchScope; label: string; icon: IconName; description: string }>; title: string; select(value: SearchScope): void; close(): void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <SwipeableSheetSurface onClose={close} style={styles.sheet}>
          <Text accessibilityRole="header" style={styles.sheetTitle}>{title}</Text>
          {scopes.map((scope) => (
            <Pressable key={scope.id} style={[styles.filterChoice, value === scope.id && styles.filterChoiceActive]} onPress={() => select(scope.id)} accessibilityRole="radio" accessibilityState={{ checked: value === scope.id }}>
              <Icon name={scope.icon} color={value === scope.id ? colors.waveBright : colors.textDim} size={23} />
              <View style={styles.copy}>
                <Text style={styles.name}>{scope.label}</Text>
                <Text style={styles.meta}>{scope.description}</Text>
              </View>
              <Icon name={value === scope.id ? 'radiobox-marked' : 'radiobox-blank'} color={value === scope.id ? colors.waveBright : colors.textDim} size={23} />
            </Pressable>
          ))}
        </SwipeableSheetSurface>
      </View>
    </Modal>
  );
}
function Section({ label, children }: { label: string; children: ReactNode }) { return <View style={styles.section}><Text accessibilityRole="header" style={styles.label}>{label}</Text>{children}</View>; }
function SearchTab({ label, active, onPress }: { label: string; active: boolean; onPress(): void }) { return <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }}><Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text></Pressable>; }
function Result({ name, uri, meta, icon, onPress }: { name: string; uri?: string | null; meta: string; icon?: IconName; onPress(): void }) { return <Pressable style={styles.result} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name}, ${meta}`}><View style={styles.avatarWrap}><Avatar name={name} uri={uri} size={42} />{icon ? <View style={styles.resultIcon}><Icon name={icon} color={colors.text} size={14} /></View> : null}</View><View style={styles.copy}><Text style={styles.name}>{name}</Text><Text style={styles.meta} numberOfLines={2}>{meta}</Text></View></Pressable>; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas }, header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', padding: spacing.sm, gap: spacing.xs }, iconButton: { width: touch.minimum, height: touch.minimum, alignItems: 'center', justifyContent: 'center' },
  searchShell: { flex: 1, minHeight: touch.minimum, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.lg, backgroundColor: colors.surface, paddingHorizontal: spacing.sm }, input: { flex: 1, minHeight: touch.minimum, color: colors.text, ...typography.body }, clear: { width: 34, height: touch.minimum, alignItems: 'center', justifyContent: 'center' }, filter: { borderRadius: radius.pill, backgroundColor: colors.surface }, filterActive: { borderWidth: 1, borderColor: colors.waveBright, backgroundColor: colors.surfaceRaised },
  tabsScroll: { flexGrow: 0, maxHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, tabs: { height: 52, alignItems: 'flex-end', paddingHorizontal: spacing.md, gap: spacing.lg }, tab: { height: 48, justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' }, tabActive: { borderBottomColor: colors.waveBright }, tabText: { color: colors.textDim, ...typography.label }, tabTextActive: { color: colors.waveBright },
  content: { padding: spacing.md, gap: spacing.lg, flexGrow: 1, paddingBottom: spacing.xxl }, section: { gap: spacing.xs }, label: { color: colors.textDim, ...typography.caption, fontWeight: '800', letterSpacing: 1, marginBottom: spacing.xs }, result: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.surface }, avatarWrap: { width: 42, height: 42 }, resultIcon: { position: 'absolute', right: -3, bottom: -3, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.wave, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1 }, name: { color: colors.text, ...typography.heading }, meta: { color: colors.textDim, ...typography.caption }, helper: { color: colors.textMuted, ...typography.body, padding: spacing.sm }, loading: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  empty: { flex: 1, minHeight: 480, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }, emptyMark: { width: 82, height: 82, borderRadius: 41, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised }, emptyTitle: { color: colors.text, ...typography.title }, emptyBody: { color: colors.textMuted, ...typography.body, textAlign: 'center', maxWidth: 330 }, noResults: { minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }, sheet: { width: '100%', maxHeight: '88%', padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xs, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.canvas }, handle: { width: 44, height: 5, alignSelf: 'center', marginBottom: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.lineStrong }, sheetTitle: { color: colors.text, ...typography.title, marginBottom: spacing.sm }, filterChoice: { minHeight: 62, paddingHorizontal: spacing.sm, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surface }, filterChoiceActive: { borderColor: colors.waveBright, backgroundColor: colors.surfaceRaised },
});
