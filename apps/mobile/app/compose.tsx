import { TextInput, Text, Pressable } from '@/components/localized-native';
import type { Friend,
  GroupConversation } from '@wapve/contracts';
import {
  useQuery,
  useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo,
  useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
} from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { colors, radius, spacing, touch, typography } from '@wapve/design-tokens';
import { Avatar, Button, Field, ScreenHeader } from '@/components/ui';
import { Icon } from '@/components/icon';
import { api } from '@/lib/client';

export default function ComposeScreen() {
  const params = useLocalSearchParams<{ memberId?: string; mode?: string }>();
  const queryClient = useQueryClient();
  const [groupMode, setGroupMode] = useState(params.mode === 'group');
  const [term, setTerm] = useState('');
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>(params.memberId ? [params.memberId] : []);
  const [busy, setBusy] = useState(false);
  const friends = useQuery({ queryKey: ['friends'], queryFn: () => api.request<Friend[]>('/social/friends') });
  useEffect(() => { if (friends.data) setSelected((current) => current.filter((id) => friends.data.some((friend) => friend.user.id === id))); }, [friends.data]);
  const visible = useMemo(() => (friends.data ?? []).filter((friend) => `${friend.user.displayName} ${friend.user.username}`.toLocaleLowerCase('tr').includes(term.trim().toLocaleLowerCase('tr'))), [friends.data, term]);
  function select(friend: Friend) {
    if (!groupMode) { router.replace({ pathname: '/dm/[conversationId]', params: { conversationId: friend.conversationId, name: friend.user.displayName } }); return; }
    setSelected((current) => current.includes(friend.user.id) ? current.filter((id) => id !== friend.user.id) : current.length < 9 ? [...current, friend.user.id] : current);
  }
  async function createGroup() {
    if (selected.length < 1 || name.trim().length < 2) return;
    setBusy(true);
    try {
      const group = await api.request<GroupConversation>('/dm/groups', { method: 'POST', body: { name: name.trim(), memberIds: selected } });
      await queryClient.invalidateQueries({ queryKey: ['group-conversations'] });
      router.replace({ pathname: '/group/[conversationId]', params: { conversationId: group.id, name: group.name } });
    } finally { setBusy(false); }
  }
  return <SafeAreaView style={styles.root}><ScreenHeader title={groupMode ? 'Yeni Grup' : 'Yeni Mesaj'} left={<Pressable style={styles.back} onPress={() => router.back()}><Icon name="arrow-left" color={colors.text} size={27} /></Pressable>} />
    <View style={styles.search}><Icon name="magnify" color={colors.textDim} size={23} /><TextInput autoFocus value={term} onChangeText={setTerm} style={styles.searchInput} placeholder="Alıcı: Arkadaşlarını ara" placeholderTextColor={colors.textDim} /></View>
    <Pressable style={styles.modeCard} onPress={() => { setGroupMode((value) => !value); setSelected([]); }}><View style={styles.modeIcon}><Icon name={groupMode ? 'message-text-outline' : 'account-multiple-plus-outline'} color={colors.waveBright} size={27} /></View><View style={styles.modeCopy}><Text style={styles.modeTitle}>{groupMode ? 'Tek kişiye mesaj' : 'Yeni grup'}</Text><Text style={styles.modeMeta}>{groupMode ? 'Bir arkadaşla doğrudan konuş' : 'En fazla 10 kişilik bir Waves grubu oluştur'}</Text></View><Icon name="chevron-right" color={colors.textDim} size={25} /></Pressable>
    {groupMode ? <View style={styles.groupName}><Field label="Grup adı" value={name} onChangeText={setName} maxLength={50} placeholder="Ekibimin dalgası" /></View> : null}
    <Text style={styles.section}>{term ? 'SONUÇLAR' : 'ÖNERİLEN'}</Text>
    <ScrollView contentContainerStyle={styles.list}>{visible.map((friend) => { const chosen = selected.includes(friend.user.id); return <Pressable key={friend.friendshipId} style={[styles.row, chosen && styles.rowChosen]} onPress={() => select(friend)}><Avatar name={friend.user.displayName} uri={friend.user.avatarUrl} size={48} online={friend.user.status === 'ONLINE'} /><View style={styles.copy}><Text style={styles.name}>{friend.user.displayName}</Text><Text style={styles.meta}>@{friend.user.username}</Text></View>{groupMode ? <Icon name={chosen ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} color={chosen ? colors.waveBright : colors.textDim} size={25} /> : <Icon name="chevron-right" color={colors.textDim} size={25} />}</Pressable>; })}</ScrollView>
    {groupMode ? <View style={styles.footer}><Text style={styles.selected}>{selected.length} kişi seçildi</Text><Button label="Grubu oluştur" loading={busy} disabled={selected.length < 1 || name.trim().length < 2} onPress={() => void createGroup()} /></View> : null}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.canvas }, back: { width: touch.minimum, height: touch.minimum, alignItems: 'center', justifyContent: 'center' }, search: { minHeight: 54, margin: spacing.md, marginBottom: spacing.sm, borderRadius: radius.lg, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface }, searchInput: { flex: 1, color: colors.text, ...typography.body }, modeCard: { minHeight: 76, marginHorizontal: spacing.md, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface }, modeIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.surfaceRaised }, modeCopy: { flex: 1 }, modeTitle: { color: colors.text, ...typography.heading }, modeMeta: { color: colors.textDim, ...typography.caption }, groupName: { paddingHorizontal: spacing.md, paddingTop: spacing.md }, section: { color: colors.textDim, ...typography.caption, fontWeight: '800', letterSpacing: 1, marginHorizontal: spacing.lg, marginTop: spacing.lg }, list: { padding: spacing.md, gap: spacing.xs, paddingBottom: 120 }, row: { minHeight: 68, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md }, rowChosen: { backgroundColor: colors.surface }, copy: { flex: 1 }, name: { color: colors.text, ...typography.heading }, meta: { color: colors.textDim, ...typography.caption }, footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.md, gap: spacing.xs, backgroundColor: colors.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, selected: { color: colors.textMuted, ...typography.caption, textAlign: 'center' } });
