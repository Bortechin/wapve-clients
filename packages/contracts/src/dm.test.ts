import { describe, expect, it } from 'vitest';
import {
  createGroupConversationSchema,
  createDirectMessageSchema,
  directMessageInputSchema,
  directMessageListQuerySchema,
  groupMemberInputSchema,
  socialCallJoinSchema,
  updateGroupNotificationPreferenceSchema,
  updateGroupConversationSchema,
} from './dm.js';

describe('direct message contracts', () => {
  it('uses the same safe content rules as channel messages', () => {
    expect(directMessageInputSchema.parse({ content: '  özel mesaj  ' })).toEqual({
      content: 'özel mesaj',
    });
    expect(() => directMessageInputSchema.parse({ content: '\u202Eunsafe' })).toThrow();
  });

  it('bounds pagination', () => {
    expect(directMessageListQuerySchema.parse({ limit: '25' }).limit).toBe(25);
    expect(() => directMessageListQuerySchema.parse({ limit: 101 })).toThrow();
  });

  it('accepts a signed GIF without text and rejects an empty message', () => {
    expect(createDirectMessageSchema.parse({ gifToken: 'x'.repeat(32) })).toEqual({
      gifToken: 'x'.repeat(32),
    });
    expect(() => createDirectMessageSchema.parse({})).toThrow();
  });

  it('limits group creation to nine invited members', () => {
    const ids = Array.from(
      { length: 9 },
      (_, index) => `018f0d7a-91ab-7abc-8def-${String(index).padStart(12, '0')}`,
    );
    expect(
      createGroupConversationSchema.parse({ name: 'Ekip', memberIds: ids }).memberIds,
    ).toHaveLength(9);
    expect(() =>
      createGroupConversationSchema.parse({
        name: 'Kalabalık',
        memberIds: [...ids, '018f0d7a-91ab-7abc-8def-999999999999'],
      }),
    ).toThrow();
  });

  it('distinguishes voice calls from video calls while keeping old clients compatible', () => {
    const base = { conversationId: '018f0d7a-91ab-7abc-8def-0123456789ab', kind: 'direct' };
    expect(socialCallJoinSchema.parse(base).mode).toBe('video');
    expect(socialCallJoinSchema.parse({ ...base, mode: 'audio' }).mode).toBe('audio');
  });

  it('validates group renames and member management targets', () => {
    expect(updateGroupConversationSchema.parse({ name: '  Gece ekibi  ' }).name).toBe(
      'Gece ekibi',
    );
    expect(
      groupMemberInputSchema.parse({ userId: '018f0d7a-91ab-7abc-8def-0123456789ab' }).userId,
    ).toBe('018f0d7a-91ab-7abc-8def-0123456789ab');
  });

  it('accepts bounded group notification mute choices', () => {
    expect(updateGroupNotificationPreferenceSchema.parse({ mute: 'HOURS_8' })).toEqual({
      mute: 'HOURS_8',
    });
    expect(() => updateGroupNotificationPreferenceSchema.parse({ mute: 'TOMORROW' })).toThrow();
  });
});
