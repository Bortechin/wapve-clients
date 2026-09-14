import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MessageThread } from '@/components/message-thread';
import { api } from '@/lib/client';
export default function DirectMessageScreen() { const { conversationId, name, messageId } = useLocalSearchParams<{ conversationId: string; name?: string; messageId?: string }>(); const queryClient = useQueryClient(); useEffect(() => { if (!conversationId) return; void api.request(`/dm/conversations/${conversationId}/unhide`, { method: 'POST', body: {} }).then(() => queryClient.invalidateQueries({ queryKey: ['dm-conversations'] })).catch(() => undefined); }, [conversationId, queryClient]); return <MessageThread kind="direct" conversationId={conversationId} initialMessageId={messageId} title={name ?? 'Özel mesaj'} />; }
