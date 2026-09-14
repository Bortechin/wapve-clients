import { useLocalSearchParams } from 'expo-router';
import { MessageThread } from '@/components/message-thread';
export default function GroupMessageScreen() { const { conversationId, name, messageId } = useLocalSearchParams<{ conversationId: string; name?: string; messageId?: string }>(); return <MessageThread kind="group" conversationId={conversationId} initialMessageId={messageId} title={name ?? 'Grup'} />; }
