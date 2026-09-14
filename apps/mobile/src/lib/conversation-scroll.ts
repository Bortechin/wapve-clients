// Session-only, account-scoped positions. Message history itself stays in QueryClient.
const offsets = new Map<string, number>();
export function rememberConversationScroll(key: string, offset: number) {
  if (!Number.isFinite(offset)) return;
  offsets.delete(key);
  offsets.set(key, Math.max(0, offset));
  if (offsets.size > 100) offsets.delete(offsets.keys().next().value!);
}
export function conversationScroll(key: string) {
  return offsets.get(key) ?? 0;
}
export function clearConversationScroll() {
  offsets.clear();
}
