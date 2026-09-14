import { describe, expect, it } from '@jest/globals';
import { ICE_RECOVERY_MAX_ATTEMPTS, iceRecoveryVerificationDelay, shouldRetryIceRecovery } from './ice-recovery';

describe('ICE recovery policy', () => {
  it('uses bounded increasing verification windows', () => {
    expect([0, 1, 2].map(iceRecoveryVerificationDelay)).toEqual([4_000, 7_000, 12_000]);
  });

  it('retries failed recovery without looping forever', () => {
    expect(ICE_RECOVERY_MAX_ATTEMPTS).toBe(3);
    expect(shouldRetryIceRecovery(0, 'failed')).toBe(true);
    expect(shouldRetryIceRecovery(2, 'failed')).toBe(false);
    expect(shouldRetryIceRecovery(0, 'connected')).toBe(false);
    expect(shouldRetryIceRecovery(0, 'closed')).toBe(false);
  });
});
