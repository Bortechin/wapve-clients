import type { ChannelTree, ServerSummary } from '@wapve/contracts';
import { useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { DeepLinkState } from '@/components/deep-link-state';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/client';
import { decodeRouteSegment, deepLinkReturnPath, messageIdFromUrl } from '@/lib/deep-links';
import { useI18n } from '@/lib/i18n';

export default function PublicChannelLinkScreen() {
  const { serverPublicId = '', channelPublicId = '', messageId: messageParam } = useLocalSearchParams<{ serverPublicId: string; channelPublicId: string; messageId?: string }>();
  const currentUrl = Linking.useURL();
  const messageId = messageParam ?? messageIdFromUrl(currentUrl) ?? undefined;
  const serverKey = decodeRouteSegment(serverPublicId);
  const channelKey = decodeRouteSegment(channelPublicId);
  const { user } = useAuth();
  const { locale } = useI18n();
  const servers = useQuery({
    queryKey: ['servers'],
    enabled: Boolean(user),
    queryFn: () => api.request<ServerSummary[]>('/servers'),
  });
  const server = servers.data?.find((item) => item.publicId === serverKey || item.id === serverKey);
  const channels = useQuery({
    queryKey: ['channels', server?.id],
    enabled: Boolean(server),
    queryFn: () => api.request<ChannelTree>(`/servers/${server!.id}/channels`),
  });
  const channel = channels.data?.channels.find((item) => item.publicId === channelKey || item.id === channelKey);

  useEffect(() => {
    if (!server || !channel) return;
    router.replace({
      pathname: channel.type === 'VOICE' ? '/voice/[serverId]/[channelId]' : '/channel/[serverId]/[channelId]',
      params: { serverId: server.id, channelId: channel.id, name: channel.name, ...(messageId ? { messageId } : {}) },
    });
  }, [channel, messageId, server]);

  const returnPath = deepLinkReturnPath(`/channels/${encodeURIComponent(serverKey)}/${encodeURIComponent(channelKey)}`, messageId);
  if (!user) return <DeepLinkState icon="login-variant" title={locale === 'tr' ? 'Bağlantıyı açmak için giriş yap' : 'Log in to open this link'} body={locale === 'tr' ? 'Girişten sonra doğrudan aynı kanal veya mesaja döneceksin.' : 'You will return to the same channel or message after logging in.'} primary={{ label: locale === 'tr' ? 'Giriş yap' : 'Log in', action: () => router.push({ pathname: '/auth/login', params: { redirect: returnPath } }) }} secondary={{ label: locale === 'tr' ? 'Ana sayfaya dön' : 'Back to home', action: () => router.replace('/') }} />;
  if (servers.isLoading || (server && channels.isLoading) || channel) return <DeepLinkState loading title={locale === 'tr' ? 'Kanal açılıyor' : 'Opening channel'} body={locale === 'tr' ? 'Sunucu ve mesaj erişimin doğrulanıyor…' : 'Checking your access to the server and message…'} />;
  const inaccessible = servers.isError || channels.isError || (servers.isSuccess && !server) || (channels.isSuccess && !channel);
  return <DeepLinkState icon="link-off" title={locale === 'tr' ? 'Kanal açılamadı' : 'Could not open channel'} body={locale === 'tr' ? 'Kanal silinmiş olabilir, sunucudan ayrılmış olabilirsin veya bu kanalı görme yetkin olmayabilir.' : 'The channel may have been deleted, you may have left the server, or you may not have permission to view it.'} primary={{ label: locale === 'tr' ? 'Tekrar dene' : 'Try again', action: () => { void servers.refetch(); if (server) void channels.refetch(); }, disabled: !inaccessible }} secondary={{ label: locale === 'tr' ? 'Wapve’ye dön' : 'Back to Wapve', action: () => router.replace('/(tabs)') }} />;
}
