import { describe, expect, it } from 'vitest';
import { updateProfileSchema } from './user.js';

describe('user profile contracts', () => {
  it('accepts a 190 character biography with emoji', () => {
    const bio = `${'a'.repeat(188)}🙂`;
    expect(updateProfileSchema.safeParse({ bio }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ bio: `${bio}x` }).success).toBe(false);
  });

  it('accepts a timed presence expiration or a permanent null value', () => {
    expect(
      updateProfileSchema.safeParse({
        status: 'IDLE',
        statusExpiresAt: '2026-08-23T20:00:00.000Z',
      }).success,
    ).toBe(true);
    expect(updateProfileSchema.safeParse({ status: 'DND', statusExpiresAt: null }).success).toBe(
      true,
    );
  });

  it('validates conversation pins and server folder colors', () => {
    const conversationId = '018f0d7a-91ab-7abc-8def-0123456789ab';
    expect(
      updateProfileSchema.safeParse({ pinnedSocialConversations: [`direct:${conversationId}`] })
        .success,
    ).toBe(true);
    expect(
      updateProfileSchema.safeParse({
        pinnedSocialConversations: [`group:${conversationId}`, `group:${conversationId}`],
      }).success,
    ).toBe(false);
    expect(
      updateProfileSchema.safeParse({
        serverLayout: [
          { type: 'folder', id: 'folder-1', color: 'url(javascript:bad)', serverIds: [] },
        ],
      }).success,
    ).toBe(false);
  });

  it('accepts native and canonical static status emojis but rejects forged tokens', () => {
    expect(updateProfileSchema.safeParse({ customStatusEmoji: '🌊' }).success).toBe(true);
    expect(
      updateProfileSchema.safeParse({
        customStatusEmoji: '<:wave:018f0d7a-91ab-7abc-8def-0123456789ab>',
      }).success,
    ).toBe(true);
    expect(
      updateProfileSchema.safeParse({ customStatusEmoji: '<img src=x onerror=alert(1)>' }).success,
    ).toBe(false);
    expect(
      updateProfileSchema.safeParse({ customStatusEmoji: '<:wave:not-a-real-id>' }).success,
    ).toBe(false);
  });
});
