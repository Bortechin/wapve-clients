import { describe, expect, it } from 'vitest';
import {
  hasRemoteSocialCallParticipant,
  isPoliteSocialCallPeer,
  shouldAcceptSocialCallSession,
  shouldEndActiveSocialCall,
  shouldRingForSocialCallSession,
  socialCallParticipantCount,
} from './social-call-lifecycle';

const directCall = { conversationId: 'conversation-a', kind: 'direct' as const };
const groupCall = { conversationId: 'conversation-b', kind: 'group' as const };
const userId = '018f0d7a-91ab-7abc-8def-0123456789ab';
const otherId = '018f0d7a-91ab-7abc-8def-0123456789ac';

describe('social call lifecycle guards', () => {
  it('prefers the pending call identity over an unrelated selected session', () => {
    expect(
      shouldAcceptSocialCallSession({
        session: { id: 'new-call', ...directCall },
        selectedCallId: 'old-call',
        activeCallId: null,
        activeCall: directCall,
      }),
    ).toBe(true);
    expect(
      shouldAcceptSocialCallSession({
        session: { id: 'other-call', ...groupCall },
        selectedCallId: 'old-call',
        activeCallId: null,
        activeCall: directCall,
      }),
    ).toBe(false);
  });

  it('locks session updates to the acknowledged active call id', () => {
    expect(
      shouldAcceptSocialCallSession({
        session: { id: 'stale-call', ...directCall },
        selectedCallId: 'active-call',
        activeCallId: 'active-call',
        activeCall: directCall,
      }),
    ).toBe(false);
  });

  it('does not tear down an active call for a stale ended event', () => {
    expect(
      shouldEndActiveSocialCall({
        ended: { callId: 'old-call', ...directCall },
        activeCallId: 'new-call',
        activeCall: directCall,
      }),
    ).toBe(false);
    expect(
      shouldEndActiveSocialCall({
        ended: { callId: 'new-call', ...directCall },
        activeCallId: 'new-call',
        activeCall: directCall,
      }),
    ).toBe(true);
  });

  it('matches an ended event by identity before the session id arrives', () => {
    expect(
      shouldEndActiveSocialCall({
        ended: { callId: 'server-call', ...directCall },
        activeCallId: null,
        activeCall: directCall,
      }),
    ).toBe(true);
    expect(
      shouldEndActiveSocialCall({
        ended: { callId: 'unrelated-call', ...groupCall },
        activeCallId: null,
        activeCall: directCall,
      }),
    ).toBe(false);
  });

  it('elects exactly one polite peer from two known connection ids', () => {
    expect(isPoliteSocialCallPeer('connection-b', 'connection-a')).toBe(true);
    expect(isPoliteSocialCallPeer('connection-a', 'connection-b')).toBe(false);
    expect(isPoliteSocialCallPeer('Z', 'a')).toBe(false);
    expect(isPoliteSocialCallPeer('a', 'Z')).toBe(true);
  });

  it('detects only a remote participant as an answered call', () => {
    const currentUserId = '018f0d7a-91ab-7abc-8def-0123456789ab';
    const remoteUserId = '018f0d7a-91ab-7abc-8def-0123456789ac';
    expect(hasRemoteSocialCallParticipant([], currentUserId)).toBe(false);
    expect(hasRemoteSocialCallParticipant([currentUserId], currentUserId)).toBe(false);
    expect(hasRemoteSocialCallParticipant([currentUserId, remoteUserId], currentUserId)).toBe(true);
  });

  it('counts unique server-confirmed users without adding a phantom participant', () => {
    expect(socialCallParticipantCount([userId], userId, true)).toBe(1);
    expect(socialCallParticipantCount([userId, otherId], userId, true)).toBe(2);
    expect(socialCallParticipantCount([userId, otherId, otherId], userId, true)).toBe(2);
    expect(socialCallParticipantCount([otherId], userId, true)).toBe(2);
  });

  it('recovers an unanswered invitation from a session event', () => {
    const session = {
      id: 'call-a',
      ...directCall,
      caller: { userId },
      invited: [{ userId: otherId }],
      joinedUserIds: [userId],
      declinedUserIds: [],
    };

    expect(
      shouldRingForSocialCallSession({
        session,
        currentUserId: otherId,
        activeCallId: null,
        activeCall: null,
      }),
    ).toBe(true);
  });

  it('does not ring once the invitation is joined, declined, or already being answered', () => {
    const session = {
      id: 'call-a',
      ...directCall,
      caller: { userId },
      invited: [{ userId: otherId }],
      joinedUserIds: [userId],
      declinedUserIds: [] as string[],
    };
    const decision = (
      overrides: Partial<typeof session>,
      activeCall: typeof directCall | null = null,
    ) =>
      shouldRingForSocialCallSession({
        session: { ...session, ...overrides },
        currentUserId: otherId,
        activeCallId: null,
        activeCall,
      });

    expect(decision({ joinedUserIds: [userId, otherId] })).toBe(false);
    expect(decision({ declinedUserIds: [otherId] })).toBe(false);
    expect(decision({}, directCall)).toBe(false);
    expect(
      shouldRingForSocialCallSession({
        session,
        currentUserId: otherId,
        activeCallId: session.id,
        activeCall: null,
      }),
    ).toBe(false);
  });
});
