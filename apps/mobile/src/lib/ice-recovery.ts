export const ICE_RECOVERY_MAX_ATTEMPTS = 3;

export function iceRecoveryVerificationDelay(attempt: number) {
  return [4_000, 7_000, 12_000][Math.max(0, Math.min(2, attempt))] ?? 12_000;
}

export function shouldRetryIceRecovery(attempt: number, state: string) {
  return state !== 'connected' && state !== 'closed' && attempt + 1 < ICE_RECOVERY_MAX_ATTEMPTS;
}
