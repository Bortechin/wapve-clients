import { useLocalSearchParams } from 'expo-router';
import { MessageThread } from '@/components/message-thread';
export default function ChannelScreen() { const { serverId, channelId, name, messageId, voiceChat } = useLocalSearchParams<{ serverId: string; channelId: string; name?: string; messageId?: string; voiceChat?: string }>(); return <MessageThread kind="channel" serverId={serverId} channelId={channelId} initialMessageId={messageId} rememberAsText={voiceChat !== '1'} title={`${voiceChat === '1' ? '🔊' : '#'} ${name ?? 'kanal'}`} />; }
