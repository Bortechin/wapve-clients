import { describe, expect, it } from '@jest/globals';
import { evaluateComposerPolicy } from './composer-policy';

const now = Date.parse('2026-08-26T10:00:00.000Z');

describe('message composer policy', () => {
  it('blocks unverified accounts before an API request can be made', () => {
    expect(evaluateComposerPolicy({ kind: 'channel', emailVerified: false, now, channelCanSend: true }).reason)
      .toBe('EMAIL_UNVERIFIED');
  });

  it('blocks a timed-out member but never applies a member timeout to the server owner', () => {
    const timeoutUntil = '2026-08-26T11:00:00.000Z';
    expect(evaluateComposerPolicy({ kind: 'channel', emailVerified: true, now, channelCanSend: true, timeoutUntil }).reason)
      .toBe('TIMEOUT');
    expect(evaluateComposerPolicy({ kind: 'channel', emailVerified: true, now, channelCanSend: true, timeoutUntil, isServerOwner: true }).canCompose)
      .toBe(true);
  });

  it('requires SEND_MESSAGES and an available DM or group destination', () => {
    expect(evaluateComposerPolicy({ kind: 'channel', emailVerified: true, now, channelCanSend: false }).reason)
      .toBe('MISSING_SEND_PERMISSION');
    expect(evaluateComposerPolicy({ kind: 'direct', emailVerified: true, now, directCanMessage: false }).reason)
      .toBe('DIRECT_UNAVAILABLE');
    expect(evaluateComposerPolicy({ kind: 'group', emailVerified: true, now, groupExists: false }).reason)
      .toBe('GROUP_UNAVAILABLE');
  });
});
