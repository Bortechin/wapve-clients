export type SocialCallIdentity = {
  conversationId: string;
  kind: 'direct' | 'group';
};

export type SocialCallEnded = SocialCallIdentity & {
  callId: string;
};

export function isSameSocialCall(
  left: SocialCallIdentity | null | undefined,
  right: SocialCallIdentity | null | undefined,
): boolean {
  return Boolean(
    left && right && left.conversationId === right.conversationId && left.kind === right.kind,
  );
}

export function shouldAcceptSocialCallSession({
  session,
  selectedCallId,
  activeCallId,
  activeCall,
}: {
  session: SocialCallIdentity & { id: string };
  selectedCallId: string | null;
  activeCallId: string | null;
  activeCall: SocialCallIdentity | null;
}): boolean {
  if (activeCallId) return session.id === activeCallId;
  if (activeCall) return isSameSocialCall(session, activeCall);
  if (selectedCallId) return session.id === selectedCallId;
  return true;
}

export function shouldRingForSocialCallSession({
  session,
  currentUserId,
  activeCallId,
  activeCall,
}: {
  session: SocialCallIdentity & {
    id: string;
    caller: { userId: string };
    invited: readonly { userId: string }[];
    joinedUserIds: readonly string[];
    declinedUserIds: readonly string[];
  };
  currentUserId: string;
  activeCallId: string | null;
  activeCall: SocialCallIdentity | null;
}): boolean {
  if (session.caller.userId === currentUserId) return false;
  if (!session.invited.some((person) => person.userId === currentUserId)) return false;
  if (session.joinedUserIds.includes(currentUserId)) return false;
  if (session.declinedUserIds.includes(currentUserId)) return false;
  if (activeCallId === session.id) return false;
  if (activeCall && isSameSocialCall(activeCall, session)) return false;
  return true;
}

export function shouldEndActiveSocialCall({
  ended,
  activeCallId,
  activeCall,
}: {
  ended: SocialCallEnded;
  activeCallId: string | null;
  activeCall: SocialCallIdentity | null;
}): boolean {
  if (activeCallId) return ended.callId === activeCallId;
  return isSameSocialCall(ended, activeCall);
}

export function isPoliteSocialCallPeer(
  selfConnectionId: string | null,
  remoteConnectionId: string,
): boolean {
  return !selfConnectionId || selfConnectionId > remoteConnectionId;
}

export function hasRemoteSocialCallParticipant(
  joinedUserIds: readonly string[],
  currentUserId: string,
): boolean {
  return joinedUserIds.some((userId) => userId !== currentUserId);
}

export function socialCallParticipantCount(
  joinedUserIds: readonly string[],
  currentUserId: string,
  locallyJoined: boolean,
): number {
  const userIds = new Set(joinedUserIds);
  if (locallyJoined) userIds.add(currentUserId);
  return userIds.size;
}
