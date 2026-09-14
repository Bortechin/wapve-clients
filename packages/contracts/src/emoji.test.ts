import { describe, expect, it } from 'vitest';
import { serverEmojiNameSchema, switcherAccountsSchema } from './index.js';

describe('custom server emoji contracts', () => {
  it('normalizes safe names and rejects unsafe names', () => {
    expect(serverEmojiNameSchema.parse(' Wave_HELLO ')).toBe('wave_hello');
    expect(serverEmojiNameSchema.safeParse('a').success).toBe(false);
    expect(serverEmojiNameSchema.safeParse('../wave').success).toBe(false);
    expect(serverEmojiNameSchema.safeParse('dalga🌊').success).toBe(false);
  });

  it('keeps the account switcher capped at two accounts', () => {
    const account = {
      id: '018f0d7a-91ab-7abc-8def-0123456789ab',
      publicId: '12345678901',
      username: 'wave',
      displayName: 'Wave',
      avatarUrl: null,
      current: true,
    };
    expect(
      switcherAccountsSchema.safeParse({ accounts: [account, account], maxAccounts: 2 }).success,
    ).toBe(true);
    expect(
      switcherAccountsSchema.safeParse({ accounts: [account, account, account], maxAccounts: 2 })
        .success,
    ).toBe(false);
  });
});
