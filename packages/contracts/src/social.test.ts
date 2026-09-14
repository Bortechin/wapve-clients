import { describe, expect, it } from 'vitest';
import { blockUserSchema, sendFriendRequestSchema } from './social.js';

describe('social contracts', () => {
  it('normalizes friend usernames', () => {
    expect(sendFriendRequestSchema.parse({ username: '  Deniz  ' })).toEqual({
      username: 'deniz',
    });
  });

  it('rejects malformed usernames and block identifiers', () => {
    expect(() => sendFriendRequestSchema.parse({ username: '@bad' })).toThrow();
    expect(() => blockUserSchema.parse({ userId: 'not-a-uuid' })).toThrow();
  });
});
