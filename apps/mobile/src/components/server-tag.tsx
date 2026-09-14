import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  configureServerTagSchema,
  serverTagBadgeSchema,
  type ServerSummary,
  type ServerTag,
  type ServerTagBadge,
  type ServerTagPreview,
} from '@wapve/contracts';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from './themed-native';
import { Text } from './localized-native';
import { colors, radius, spacing, typography } from '@wapve/design-tokens';
import { absoluteMedia, Button, Field, SecureImage } from './ui';
import { Icon, type IconName } from './icon';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/client';

const badgeAtlas = require('../../../web/public/server-tags/wapve-tag-badge-atlas.png') as number;

const spritePositions: Partial<Record<ServerTagBadge, [number, number]>> = {
  OCEAN_WAVE: [0, 0],
  OCEAN_SHELL: [1, 0],
  OCEAN_COMPASS: [2, 0],
  OCEAN_CORAL: [3, 0],
  NIGHT_MOON: [0, 1],
  NIGHT_STAR: [1, 1],
  NIGHT_COMET: [2, 1],
  NIGHT_AURORA: [3, 1],
  WILD_FOX: [0, 2],
  WILD_OWL: [1, 2],
  WILD_MOUNTAIN: [2, 2],
  WILD_SPROUT: [3, 2],
  PRESTIGE_GEM: [0, 3],
  PRESTIGE_CROWN: [1, 3],
  PRESTIGE_FLAME: [2, 3],
  PRESTIGE_INFINITY: [3, 3],
};

const baseIcons: Partial<Record<ServerTagBadge, IconName>> = {
  WAVE: 'waves',
  COMPASS: 'compass-outline',
  STAR: 'star',
  SHIELD: 'shield-outline',
};

export function ServerTagBadgeIcon({ badge, size = 18 }: { badge: ServerTagBadge; size?: number }) {
  const position = spritePositions[badge];
  if (position) {
    return (
      <View style={[styles.atlasCrop, { width: size, height: size }]} pointerEvents="none">
        <ImageAtlas size={size} left={-position[0] * size} top={-position[1] * size} />
      </View>
    );
  }
  return (
    <View style={[styles.baseIcon, { width: size, height: size }]} pointerEvents="none">
      <Icon name={baseIcons[badge] ?? 'tag-outline'} color={colors.text} size={size} />
    </View>
  );
}

function ImageAtlas({ size, left, top }: { size: number; left: number; top: number }) {
  return (
    <Image
      source={badgeAtlas}
      resizeMode="stretch"
      style={{ position: 'absolute', width: size * 4, height: size * 4, left, top }}
    />
  );
}

export function ServerTagChip({
  tag,
  interactive = true,
}: {
  tag?: ServerTag | null | undefined;
  interactive?: boolean;
}) {
  const { locale } = useI18n();
  const tr = locale === 'tr';
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const preview = useQuery({
    queryKey: ['server-tag-preview', tag?.serverId],
    queryFn: () => api.request<ServerTagPreview>(`/servers/tags/${tag!.serverId}/preview`),
    enabled: Boolean(tag && interactive && open),
    retry: false,
  });

  if (!tag) return null;
  const serverId = tag.serverId;

  async function joinOrOpen() {
    if (!preview.data) return;
    setBusy(true);
    setError('');
    try {
      let publicId = preview.data.publicId;
      if (!preview.data.alreadyMember) {
        const server = await api.request<{ publicId: string }>(`/servers/tags/${serverId}/join`, {
          method: 'POST',
          body: {},
        });
        publicId = server.publicId;
        await queryClient.invalidateQueries({ queryKey: ['servers'] });
      }
      setOpen(false);
      router.push({ pathname: '/channels/[serverPublicId]', params: { serverPublicId: publicId } });
    } catch {
      setError(tr ? 'Sunucuya katılınamadı.' : 'Could not join the server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable
        hitSlop={{ top: 12, bottom: 12, left: 4, right: 4 }}
        accessibilityRole={interactive ? 'button' : undefined}
        accessibilityLabel={`${tag.serverName}: ${tag.code}`}
        disabled={!interactive}
        onPress={() => {
          setError('');
          setOpen(true);
        }}
        style={[styles.chip, { borderColor: tag.color }, !interactive && styles.staticChip]}
      >
        <ServerTagBadgeIcon badge={tag.badge} size={16} />
        <Text style={[styles.chipText, { color: tag.color }]}>{tag.code}</Text>
      </Pressable>
      {interactive ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
            <View style={[styles.sheet, { borderColor: tag.color }]}>
              <View style={styles.sheetHeader}>
                <View style={styles.sheetTitleWrap}>
                  <ServerTagBadgeIcon badge={tag.badge} size={34} />
                  <View style={styles.sheetTitleCopy}>
                    <Text style={styles.sheetTitle}>{tag.code}</Text>
                    <Text style={styles.sheetSubtitle}>{tag.serverName}</Text>
                  </View>
                </View>
                <Pressable
                  style={styles.close}
                  onPress={() => setOpen(false)}
                  accessibilityLabel={tr ? 'Kapat' : 'Close'}
                >
                  <Icon name="close" color={colors.text} size={24} />
                </Pressable>
              </View>
              {preview.isPending ? <Text style={styles.body}>{tr ? 'Sunucu hazırlanıyor…' : 'Loading server…'}</Text> : null}
              {preview.isError ? <Text style={styles.error}>{tr ? 'Sunucu bilgisi alınamadı.' : 'Server details unavailable.'}</Text> : null}
              {preview.data ? (
                <ScrollView contentContainerStyle={styles.preview} showsVerticalScrollIndicator={false}>
                  <View style={styles.serverBanner}>
                    {preview.data.bannerUrl ? (
                      <SecureImage uri={absoluteMedia(preview.data.bannerUrl)} style={StyleSheet.absoluteFill} contentFit="cover" />
                    ) : null}
                  </View>
                  <View style={styles.serverTitle}>
                    <View style={styles.serverIcon}>
                      {preview.data.iconUrl ? (
                        <SecureImage uri={absoluteMedia(preview.data.iconUrl)} style={StyleSheet.absoluteFill} contentFit="cover" />
                      ) : (
                        <Text style={styles.serverInitial}>{preview.data.name.slice(0, 1).toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={styles.sheetTitleCopy}>
                      <Text style={styles.serverName}>{preview.data.name}</Text>
                      <Text style={styles.body}>{tr ? 'Sunucu etiketi' : 'Server tag'} · {tag.code}</Text>
                    </View>
                  </View>
                  <View style={styles.stats}>
                    <Text style={styles.body}>{preview.data.onlineCount} {tr ? 'çevrimiçi' : 'online'}</Text>
                    <Text style={styles.body}>{preview.data.memberCount} {tr ? 'üye' : 'members'}</Text>
                  </View>
                  {preview.data.description ? <Text style={styles.body}>{preview.data.description}</Text> : null}
                  {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
                  <Button
                    label={preview.data.alreadyMember ? (tr ? 'Sunucuya git' : 'Go to server') : (tr ? 'Sunucuya katıl' : 'Join server')}
                    loading={busy}
                    onPress={() => void joinOrOpen()}
                  />
                </ScrollView>
              ) : null}
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

export function ServerTagSettings({ server }: { server: ServerSummary }) {
  const { locale } = useI18n();
  const tr = locale === 'tr';
  const cache = useQueryClient();
  const [code, setCode] = useState(server.tag?.code ?? '');
  const [color, setColor] = useState(server.tag?.color ?? '#38bdf8');
  const [badge, setBadge] = useState<ServerTagBadge>(server.tag?.badge ?? 'WAVE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setCode(server.tag?.code ?? '');
    setColor(server.tag?.color ?? '#38bdf8');
    setBadge(server.tag?.badge ?? 'WAVE');
  }, [server.id, server.tag]);

  async function save(select?: boolean) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const body = select === undefined ? configureServerTagSchema.parse({ code, color, badge }) : { enabled: select };
      await api.request(`/servers/${server.id}/tag${select === undefined ? '' : '/me'}`, {
        method: 'PATCH',
        body,
      });
      await Promise.all(
        ['server', 'servers', 'profile', 'server-members', 'friends', 'social-profile'].map((root) =>
          cache.invalidateQueries({ queryKey: [root] }),
        ),
      );
    } catch {
      setError(tr ? 'Etiket güncellenemedi.' : 'Could not update tag.');
    } finally {
      setBusy(false);
    }
  }

  if (!server.tagUnlocked) {
    return <Text style={styles.body}>{tr ? 'Sunucu etiketi Woost ile açılır.' : 'Unlock the server tag with Woost.'}</Text>;
  }
  const canManage = server.role === 'OWNER' || server.permissions.includes('MANAGE_SERVER');
  return (
    <View style={styles.settingsCard}>
      <ServerTagChip tag={server.tag} interactive={false} />
      {canManage ? (
        <>
          <Field label={tr ? 'Etiket' : 'Tag'} value={code} onChangeText={setCode} maxLength={4} />
          <Field label={tr ? 'Renk' : 'Color'} value={color} onChangeText={setColor} maxLength={7} />
          <ScrollView horizontal contentContainerStyle={styles.badgeOptions} showsHorizontalScrollIndicator={false}>
            {serverTagBadgeSchema.options.map((value) => {
              const pack = value.startsWith('OCEAN_')
                ? 'OCEAN_PULSE'
                : value.startsWith('NIGHT_')
                  ? 'NIGHT_SKY'
                  : value.startsWith('WILD_')
                    ? 'WILD_TRAIL'
                    : value.startsWith('PRESTIGE_')
                      ? 'PRESTIGE'
                      : null;
              return (
                <Button
                  key={value}
                  label={value.replaceAll('_', ' ')}
                  icon={<ServerTagBadgeIcon badge={value} size={20} />}
                  variant={value === badge ? 'primary' : 'secondary'}
                  disabled={pack !== null && !server.tagBadgePacks.includes(pack)}
                  onPress={() => setBadge(value)}
                />
              );
            })}
          </ScrollView>
          <Button label={tr ? 'Kaydet' : 'Save'} loading={busy} onPress={() => void save()} />
        </>
      ) : null}
      {server.tag ? (
        <Button
          label={server.tagSelectedByMe ? (tr ? 'Etiketi kaldır' : 'Remove tag') : (tr ? 'Etiketi kullan' : 'Use tag')}
          loading={busy}
          onPress={() => void save(!server.tagSelectedByMe)}
        />
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  atlasCrop: { overflow: 'hidden', position: 'relative', alignItems: 'center', justifyContent: 'center' },
  baseIcon: { alignItems: 'center', justifyContent: 'center' },
  chip: {
    minHeight: 24,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    backgroundColor: colors.surfaceSoft,
  },
  staticChip: { minHeight: 26 },
  chipText: { fontSize: 12, fontWeight: '800' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    maxHeight: '84%',
    padding: spacing.lg,
    gap: spacing.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    backgroundColor: colors.canvas,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  sheetTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sheetTitleCopy: { flex: 1, gap: 2 },
  sheetTitle: { color: colors.text, ...typography.title },
  sheetSubtitle: { color: colors.textMuted, ...typography.body },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.surfaceRaised },
  body: { color: colors.textMuted, ...typography.body },
  error: { color: colors.danger, ...typography.caption },
  preview: { gap: spacing.md, paddingBottom: spacing.xl },
  serverBanner: { height: 112, overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.surfaceRaised },
  serverTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  serverIcon: { width: 58, height: 58, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.surfaceRaised },
  serverInitial: { color: colors.text, ...typography.title },
  serverName: { color: colors.text, ...typography.heading },
  stats: { flexDirection: 'row', gap: spacing.lg },
  settingsCard: { gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  badgeOptions: { gap: spacing.sm, paddingVertical: spacing.xs },
});
