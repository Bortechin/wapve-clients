import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';

const historySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('channel'), serverId: z.string().uuid(), channelId: z.string().uuid() }),
  z.object({ kind: z.literal('direct'), conversationId: z.string().uuid() }),
  z.object({ kind: z.literal('group'), conversationId: z.string().uuid() }),
]);
export type ConversationHistory = z.infer<typeof historySchema>;
const key = (userId: string) => `wapve.conversation.v1.${userId}`;
export async function rememberConversation(userId: string, value: unknown) {
  const parsed = historySchema.safeParse(value);
  if (parsed.success) await SecureStore.setItemAsync(key(userId), JSON.stringify(parsed.data));
}
export async function readConversation(userId: string): Promise<ConversationHistory | null> {
  try {
    const parsed = historySchema.safeParse(JSON.parse(await SecureStore.getItemAsync(key(userId)) ?? 'null'));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}
export async function forgetConversation(userId: string) { await SecureStore.deleteItemAsync(key(userId)); }
