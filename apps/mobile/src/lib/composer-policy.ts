export type ComposerKind = 'channel' | 'direct' | 'group';

export type ComposerBlockReason =
  | 'EMAIL_UNVERIFIED'
  | 'TIMEOUT'
  | 'MISSING_SEND_PERMISSION'
  | 'DIRECT_UNAVAILABLE'
  | 'GROUP_UNAVAILABLE';

export type ComposerPolicyInput = {
  kind: ComposerKind;
  emailVerified: boolean;
  now: number;
  isServerOwner?: boolean | undefined;
  timeoutUntil?: string | null | undefined;
  channelCanSend?: boolean | undefined;
  directCanMessage?: boolean | undefined;
  groupExists?: boolean | undefined;
};

export type ComposerPolicy = {
  canCompose: boolean;
  timeoutActive: boolean;
  timeoutUntil: Date | null;
  reason: ComposerBlockReason | null;
};

export function evaluateComposerPolicy(input: ComposerPolicyInput): ComposerPolicy {
  const timeoutUntil = input.timeoutUntil ? new Date(input.timeoutUntil) : null;
  const timeoutActive = Boolean(
    input.kind === 'channel'
      && !input.isServerOwner
      && timeoutUntil
      && Number.isFinite(timeoutUntil.getTime())
      && timeoutUntil.getTime() > input.now,
  );

  let reason: ComposerBlockReason | null = null;
  if (!input.emailVerified) reason = 'EMAIL_UNVERIFIED';
  else if (timeoutActive) reason = 'TIMEOUT';
  else if (input.kind === 'channel' && input.channelCanSend === false) reason = 'MISSING_SEND_PERMISSION';
  else if (input.kind === 'direct' && input.directCanMessage === false) reason = 'DIRECT_UNAVAILABLE';
  else if (input.kind === 'group' && input.groupExists === false) reason = 'GROUP_UNAVAILABLE';

  const destinationReady = input.kind === 'channel'
    ? input.channelCanSend === true
    : input.kind === 'direct'
      ? input.directCanMessage === true
      : input.groupExists === true;

  return {
    canCompose: reason === null && destinationReady,
    timeoutActive,
    timeoutUntil,
    reason,
  };
}
