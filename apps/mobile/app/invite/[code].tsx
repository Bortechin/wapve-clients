import type { AcceptedServerInvite, ChannelTree, ServerInvitePreview } from '@wapve/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { DeepLinkState } from '@/components/deep-link-state';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/client';
import { decodeRouteSegment } from '@/lib/deep-links';
import { useI18n } from '@/lib/i18n';

export default function InviteLinkScreen() {
  const { code = '' } = useLocalSearchParams<{ code: string }>();
  const inviteCode = decodeRouteSegment(code).trim();
  const { user } = useAuth();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(false);
  const preview = useQuery({
    queryKey: ['invite-preview', inviteCode],
    enabled: Boolean(user?.emailVerified && inviteCode),
    retry: false,
    queryFn: () => api.request<ServerInvitePreview>('/servers/invites/preview', { method: 'POST', body: { code: inviteCode } }),
  });
  async function openAccepted(result: AcceptedServerInvite | ServerInvitePreview) {
    const server = result.server;
    if (result.channel) {
      router.replace({ pathname: result.channel.type === 'VOICE' ? '/voice/[serverId]/[channelId]' : '/channel/[serverId]/[channelId]', params: { serverId: server.id, channelId: result.channel.id, name: result.channel.name } });
      return;
    }
    try {
      const tree = await api.request<ChannelTree>(`/servers/${server.id}/channels`);
      const channel = tree.channels.find((item) => item.type === 'TEXT') ?? tree.channels[0];
      if (channel) {
        router.replace({ pathname: channel.type === 'VOICE' ? '/voice/[serverId]/[channelId]' : '/channel/[serverId]/[channelId]', params: { serverId: server.id, channelId: channel.id, name: channel.name } });
        return;
      }
    } catch { /* The fallback below remains available when the server has no visible channel. */ }
    router.replace('/(tabs)');
  }
  async function accept() {
    setJoining(true); setJoinError(false);
    try {
      const result = await api.request<AcceptedServerInvite>('/servers/actions/accept-invite', { method: 'POST', body: { code: inviteCode } });
      await queryClient.invalidateQueries({ queryKey: ['servers'] });
      await openAccepted(result);
    } catch { setJoinError(true); }
    finally { setJoining(false); }
  }
  if (!user) return <DeepLinkState icon="account-plus-outline" title={locale === 'tr' ? 'Sunucu daveti' : 'Server invitation'} body={locale === 'tr' ? 'Daveti görüntülemek ve kabul etmek için giriş yap.' : 'Log in to view and accept this invitation.'} primary={{ label: locale === 'tr' ? 'Giriş yap' : 'Log in', action: () => router.push({ pathname: '/auth/login', params: { redirect: `/invite/${encodeURIComponent(inviteCode)}` } }) }} />;
  if (!user.emailVerified) return <DeepLinkState icon="email-alert-outline" title={locale === 'tr' ? 'E-postanı doğrula' : 'Verify your email'} body={locale === 'tr' ? 'Sunucu davetlerini kabul etmeden önce e-posta adresini doğrulaman gerekiyor.' : 'You need to verify your email address before accepting server invitations.'} primary={{ label: locale === 'tr' ? 'Doğrulama ekranını aç' : 'Open verification', action: () => router.push('/verify-email') }} secondary={{ label: locale === 'tr' ? 'Wapve’ye dön' : 'Back to Wapve', action: () => router.replace('/(tabs)') }} />;
  if (preview.isLoading) return <DeepLinkState loading title={locale === 'tr' ? 'Davet doğrulanıyor' : 'Checking invitation'} body={locale === 'tr' ? 'Sunucu ve davet bilgileri güvenli biçimde yükleniyor…' : 'Loading the server and invitation details…'} />;
  if (!preview.data || preview.isError) return <DeepLinkState icon="link-off" title={locale === 'tr' ? 'Davet kullanılamıyor' : 'Invitation unavailable'} body={locale === 'tr' ? 'Davet silinmiş, süresi dolmuş veya kullanım sınırına ulaşmış olabilir.' : 'The invitation may have been revoked, expired, or reached its use limit.'} primary={{ label: locale === 'tr' ? 'Tekrar dene' : 'Try again', action: () => void preview.refetch() }} secondary={{ label: locale === 'tr' ? 'Wapve’ye dön' : 'Back to Wapve', action: () => router.replace('/(tabs)') }} />;
  const data = preview.data;
  return <DeepLinkState imageUrl={data.server.iconUrl} icon="account-group-outline" title={data.server.name} body={`${data.server.description ? `${data.server.description}\n\n` : ''}${data.server.memberCount} ${locale === 'tr' ? 'üye' : 'members'} · ${data.server.onlineCount} ${locale === 'tr' ? 'çevrimiçi' : 'online'}${data.channel ? `\n# ${data.channel.name}` : ''}${joinError ? `\n\n${locale === 'tr' ? 'Davet kabul edilemedi. Lütfen yeniden dene.' : 'The invitation could not be accepted. Please try again.'}` : ''}`} primary={{ label: data.alreadyMember ? (locale === 'tr' ? 'Sunucuyu aç' : 'Open server') : (locale === 'tr' ? 'Daveti kabul et' : 'Accept invitation'), action: () => data.alreadyMember ? void openAccepted(data) : void accept(), loading: joining }} secondary={{ label: locale === 'tr' ? 'Şimdi değil' : 'Not now', action: () => router.replace('/(tabs)') }} />;
}
