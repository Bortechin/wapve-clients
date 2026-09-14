import type { ChannelTree, ServerSummary } from '@wapve/contracts';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { DeepLinkState } from '@/components/deep-link-state';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/client';
import { decodeRouteSegment } from '@/lib/deep-links';
import { useI18n } from '@/lib/i18n';

export default function PublicServerLinkScreen() {
  const { serverPublicId = '' } = useLocalSearchParams<{ serverPublicId: string }>();
  const key = decodeRouteSegment(serverPublicId);
  const { user } = useAuth();
  const { locale } = useI18n();
  const servers = useQuery({ queryKey: ['servers'], enabled: Boolean(user), queryFn: () => api.request<ServerSummary[]>('/servers') });
  const server = servers.data?.find((item) => item.publicId === key || item.id === key);
  const tree = useQuery({ queryKey: ['channels', server?.id], enabled: Boolean(server), queryFn: () => api.request<ChannelTree>(`/servers/${server!.id}/channels`) });
  const target = tree.data?.channels.find((item) => item.type === 'TEXT') ?? tree.data?.channels[0];
  useEffect(() => {
    if (!server || !target) return;
    router.replace({ pathname: target.type === 'VOICE' ? '/voice/[serverId]/[channelId]' : '/channel/[serverId]/[channelId]', params: { serverId: server.id, channelId: target.id, name: target.name } });
  }, [server, target]);
  if (!user) return <DeepLinkState icon="login-variant" title={locale === 'tr' ? 'Sunucuyu açmak için giriş yap' : 'Log in to open this server'} body={locale === 'tr' ? 'Girişten sonra doğrudan bu sunucuya döneceksin.' : 'You will return to this server after logging in.'} primary={{ label: locale === 'tr' ? 'Giriş yap' : 'Log in', action: () => router.push({ pathname: '/auth/login', params: { redirect: `/channels/${encodeURIComponent(key)}` } }) }} />;
  if (servers.isLoading || (server && tree.isLoading) || target) return <DeepLinkState loading title={locale === 'tr' ? 'Sunucu açılıyor' : 'Opening server'} body={locale === 'tr' ? 'Sunucu erişimin doğrulanıyor…' : 'Checking your server access…'} />;
  return <DeepLinkState icon="link-off" title={locale === 'tr' ? 'Sunucu açılamadı' : 'Could not open server'} body={locale === 'tr' ? 'Sunucudan ayrılmış olabilirsin veya sunucuda erişebileceğin bir kanal bulunmuyor.' : 'You may have left the server or there may be no channel you can access.'} primary={{ label: locale === 'tr' ? 'Tekrar dene' : 'Try again', action: () => { void servers.refetch(); if (server) void tree.refetch(); } }} secondary={{ label: locale === 'tr' ? 'Wapve’ye dön' : 'Back to Wapve', action: () => router.replace('/(tabs)') }} />;
}
