import { TextInput, Modal, Text, Pressable } from '@/components/localized-native';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
} from '@/components/themed-native';
import { colors, radius, spacing, touch, typography } from '@wapve/design-tokens';
import { emojiCategories, searchEmoji, type EmojiCategoryId } from '@/lib/emoji-data';
import { SwipeableSheetSurface } from './swipeable-sheet';
import type { ServerEmoji, ServerSummary } from '@wapve/contracts';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/client';
import { Avatar, SecureImage } from './ui';

export function EmojiPicker({ onSelect, serverId }: { onSelect(emoji: string): void; serverId?: string | undefined }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<EmojiCategoryId>('smileys_people');
  const [emojiServerId, setEmojiServerId] = useState<string | undefined>(serverId);
  const items = useMemo(() => searchEmoji(query, category), [category, query]);
  useEffect(() => setEmojiServerId(serverId), [serverId]);
  const servers = useQuery({
    queryKey: ['servers'],
    enabled: Boolean(serverId),
    queryFn: () => api.request<ServerSummary[]>('/servers'),
    staleTime: 60_000,
  });
  const emojiServers = useMemo(() => (servers.data ?? []).filter((server) => server.id === serverId || server.permissions.includes('USE_EXTERNAL_EMOJIS')), [serverId, servers.data]);
  const serverEmojis = useQuery({
    queryKey: ['server-emojis', emojiServerId],
    enabled: Boolean(emojiServerId),
    queryFn: () => api.request<ServerEmoji[]>(`/servers/${emojiServerId}/emojis`),
    staleTime: 60_000,
  });

  return (
    <View style={styles.picker}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Emoji ara (örn. gülümse, kalp, kedi)"
        placeholderTextColor={colors.textMuted}
        style={styles.search}
        autoCorrect={false}
        returnKeyType="search"
      />
      <FlatList
        horizontal
        data={emojiCategories}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categories}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={() => {
              setQuery('');
              setCategory(item.id);
            }}
            style={[styles.category, category === item.id && !query ? styles.categoryActive : null]}
          >
            <Text style={styles.categoryEmoji}>{item.icon}</Text>
          </Pressable>
        )}
      />
      <Text style={styles.sectionTitle}>
        {query
          ? `Arama sonuçları (${items.length})`
          : emojiCategories.find((item) => item.id === category)?.label}
      </Text>
      {serverId && emojiServers.length ? (
        <View style={styles.serverSection}>
          <Text style={styles.sectionTitle}>Sunucu emojileri</Text>
          <FlatList
            horizontal
            data={emojiServers}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.serverList}
            renderItem={({ item }) => (
              <Pressable accessibilityLabel={`${item.name} emojileri`} onPress={() => setEmojiServerId(item.id)} style={[styles.serverTab, item.id === emojiServerId && styles.serverTabActive]}>
                <Avatar name={item.name} uri={item.iconUrl} size={34} />
              </Pressable>
            )}
          />
          <FlatList
            horizontal
            data={serverEmojis.data}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.serverList}
            renderItem={({ item }) => (
              <Pressable accessibilityLabel={`:${item.name}:`} onPress={() => onSelect(`<:${item.name}:${item.id}>`)} style={styles.serverEmojiButton}>
                <SecureImage uri={item.url} style={styles.serverEmojiImage} contentFit="contain" />
              </Pressable>
            )}
          />
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item, index) => `${item.category}:${item.emoji}:${index}`}
        numColumns={8}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        initialNumToRender={64}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.names[0] ?? 'Emoji'}
            onPress={() => onSelect(item.emoji)}
            style={styles.emojiButton}
          >
            <Text style={styles.emoji}>{item.emoji}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Bu aramayla eşleşen emoji bulunamadı.</Text>}
      />
    </View>
  );
}

export function EmojiPickerSheet({
  visible,
  onClose,
  onSelect,
  serverId,
}: {
  visible: boolean;
  onClose(): void;
  onSelect(emoji: string): void;
  serverId?: string | undefined;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <SwipeableSheetSurface onClose={onClose} style={styles.sheet}>
          <EmojiPicker onSelect={onSelect} serverId={serverId} />
        </SwipeableSheetSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000099' },
  sheet: { height: '72%', borderWidth: 1, borderColor: colors.line },
  picker: { flex: 1, minHeight: 260 },
  search: {
    minHeight: touch.minimum,
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.canvas,
    color: colors.text,
  },
  categories: { gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  category: {
    width: touch.minimum,
    height: touch.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  categoryActive: { backgroundColor: colors.surfaceSoft },
  categoryEmoji: { fontSize: 22 },
  sectionTitle: {
    color: colors.textMuted,
    ...typography.caption,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  grid: { paddingHorizontal: spacing.sm, paddingBottom: spacing.xl },
  emojiButton: {
    flex: 1,
    minWidth: '12.5%',
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  emoji: { fontSize: 27 },
  empty: { color: colors.textMuted, padding: spacing.lg, textAlign: 'center' },
  serverSection: { gap: spacing.xs },
  serverList: { gap: spacing.xs, paddingHorizontal: spacing.md },
  serverTab: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  serverTabActive: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.waveBright },
  serverEmojiButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  serverEmojiImage: { width: 34, height: 34 },
});
