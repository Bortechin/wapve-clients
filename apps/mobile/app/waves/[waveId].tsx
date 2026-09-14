import type { DirectConversation, GroupConversation } from '@wapve/contracts';
import { useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { DeepLinkState } from '@/components/deep-link-state';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/client';
import { decodeRouteSegment, deepLinkReturnPath, isUuid, messageIdFromUrl } from '@/lib/deep-links';
import { useI18n } from '@/lib/i18n';

export default function WaveLinkScreen() {
  const { waveId = '', messageId: messageParam } = useLocalSearchParams<{ waveId: string; messageId?: string }>();
  const currentUrl = Linking.useURL();
  const messageId = messageParam ?? messageIdFromUrl(currentUrl) ?? undefined;
  const decoded = decodeRouteSegment(waveId);
  const group = decoded.startsWith('group:');
  const conversationId = group ? decoded.slice('group:'.length) : decoded.startsWith('dm:') ? decoded.slice('dm:'.length) : decoded;
  const { user } = useAuth();
  const { locale } = useI18n();
  const conversations = useQuery<Array<DirectConversation | GroupConversation>>({
    queryKey: [group ? 'group-conversations' : 'dm-conversations'],
    enabled: Boolean(user && isUuid(conversationId)),
    queryFn: async () => group
      ? api.request<GroupConversation[]>('/dm/groups')
      : api.request<DirectConversation[]>('/dm/conversations'),
  });
  const target = conversations.data?.find((item) => item.id === conversationId);
  useEffect(() => {
    if (!target) return;
    router.replace({
      pathname: group ? '/group/[conversationId]' : '/dm/[conversationId]',
      params: { conversationId: target.id, name: group ? (target as GroupConversation).name : (target as DirectConversation).otherUser.displayName, ...(messageId ? { messageId } : {}) },
    });
  }, [group, messageId, target]);
  const returnPath = deepLinkReturnPath(`/waves/${encodeURIComponent(decoded)}`, messageId);
  if (!user) return <DeepLinkState icon="login-variant" title={locale === 'tr' ? 'Mesajı açmak için giriş yap' : 'Log in to open this message'} body={locale === 'tr' ? 'Girişten sonra aynı konuşmaya ve mesaja döneceksin.' : 'You will return to the same conversation and message after logging in.'} primary={{ label: locale === 'tr' ? 'Giriş yap' : 'Log in', action: () => router.push({ pathname: '/auth/login', params: { redirect: returnPath } }) }} />;
  if (conversations.isLoading || target) return <DeepLinkState loading title={locale === 'tr' ? 'Mesaj açılıyor' : 'Opening message'} body={locale === 'tr' ? 'Konuşmaya erişimin doğrulanıyor…' : 'Checking your access to the conversation…'} />;
  return <DeepLinkState icon="message-off-outline" title={locale === 'tr' ? 'Mesaj açılamadı' : 'Could not open message'} body={locale === 'tr' ? 'Mesaj veya konuşma silinmiş olabilir ya da artık bu konuşmaya erişimin olmayabilir.' : 'The message or conversation may have been deleted, or you may no longer have access.'} primary={{ label: locale === 'tr' ? 'Tekrar dene' : 'Try again', action: () => void conversations.refetch(), disabled: !isUuid(conversationId) }} secondary={{ label: locale === 'tr' ? 'Wapve’ye dön' : 'Back to Wapve', action: () => router.replace('/(tabs)') }} />;
}
