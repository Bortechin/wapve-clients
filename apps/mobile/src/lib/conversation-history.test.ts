import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import * as SecureStore from 'expo-secure-store';
import { readConversation, rememberConversation } from './conversation-history';

describe('conversation restoration', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  it('stores only valid destinations under the current account', async () => {
    await rememberConversation('account-one', { kind: 'direct', conversationId: '019c0000-0000-7000-8000-000000000001' });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('wapve.conversation.v1.account-one', expect.any(String));
    await rememberConversation('account-two', { kind: 'direct', conversationId: 'https://untrusted.example' });
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });
  it('falls back safely for corrupt stored history', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('{invalid');
    expect(await readConversation('account-one')).toBeNull();
  });
});
