import { Redirect, type Href } from 'expo-router';
import { ApiError } from '@wapve/api-client';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from '@/components/themed-native';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/client';
import { readConversation, forgetConversation } from '@/lib/conversation-history';
import type { ChannelTree, DirectConversation, GroupConversation } from '@wapve/contracts';

export default function Index() {
  const { user } = useAuth();
  const [target, setTarget] = useState<{ userId: string; href: Href } | null>(null);
  useEffect(() => {
    if (!user) return;
    let disposed = false;
    const userId = user.id;
    void (async () => {
      let href: Href = '/(tabs)';
      const last = await readConversation(userId);
      try {
        if (last?.kind === 'channel') {
          const tree = await api.request<ChannelTree>(`/servers/${last.serverId}/channels`);
          if (
            tree.channels.some(
              (channel) => channel.id === last.channelId && channel.permissions.VIEW_CHANNEL,
            )
          )
            href = { pathname: '/channel/[serverId]/[channelId]', params: last };
          else await forgetConversation(userId);
        } else if (last) {
          const conversations = await api.request<Array<DirectConversation | GroupConversation>>(
            last.kind === 'direct' ? '/dm/conversations' : '/dm/groups',
          );
          if (conversations.some((item) => item.id === last.conversationId))
            href = {
              pathname: last.kind === 'direct' ? '/dm/[conversationId]' : '/group/[conversationId]',
              params: { conversationId: last.conversationId },
            };
          else await forgetConversation(userId);
        }
      } catch (failure) {
        if (failure instanceof ApiError && (failure.status === 403 || failure.status === 404))
          await forgetConversation(userId);
        /* Retain history for transient network failures; show the inbox. */
      }
      if (!disposed) setTarget({ userId, href });
    })();
    return () => {
      disposed = true;
    };
  }, [user?.id]);
  if (!user) return <Redirect href="/auth/login" />;
  if (target?.userId !== user.id)
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  return <Redirect href={target.href} />;
}
