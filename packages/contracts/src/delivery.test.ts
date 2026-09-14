import { describe, expect, it } from 'vitest';
import {
  forwardMessageInputSchema,
  messageTargetSchema,
  scheduledMessageInputSchema,
} from './delivery.js';

const serverId = '018f0d7a-91ab-7abc-8def-0123456789ab';
const channelId = '018f0d7a-91ab-7abc-8def-0123456789ac';
const messageId = '018f0d7a-91ab-7abc-8def-0123456789ad';

describe('message delivery contracts', () => {
  it('accepts each strict destination shape and rejects mixed targets', () => {
    expect(
      messageTargetSchema.safeParse({ kind: 'CHANNEL', serverId, channelId }).success,
    ).toBe(true);
    expect(
      messageTargetSchema.safeParse({ kind: 'DIRECT', conversationId: channelId }).success,
    ).toBe(true);
    expect(
      messageTargetSchema.safeParse({ kind: 'CHANNEL', serverId, channelId, conversationId: channelId })
        .success,
    ).toBe(false);
  });

  it('rejects empty scheduled messages and duplicate forward destinations', () => {
    expect(
      scheduledMessageInputSchema.safeParse({
        target: { kind: 'DIRECT', conversationId: channelId },
        content: '   ',
        scheduledFor: '2026-08-25T12:00:00.000Z',
      }).success,
    ).toBe(false);
    const target = { kind: 'DIRECT' as const, conversationId: channelId };
    expect(
      forwardMessageInputSchema.safeParse({
        source: { kind: 'DIRECT', conversationId: channelId, messageId },
        targets: [target, target],
      }).success,
    ).toBe(false);
  });
});
