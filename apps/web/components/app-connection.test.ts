import { describe, expect, it } from 'vitest';
import { connectionRetryDelay, connectionRetrySeconds } from './app-connection';

describe('app connection retry policy', () => {
  it('retries quickly before settling on a thirty-second ceiling', () => {
    expect(connectionRetryDelay(0)).toBe(3_000);
    expect(connectionRetryDelay(1)).toBe(8_000);
    expect(connectionRetryDelay(2)).toBe(15_000);
    expect(connectionRetryDelay(3)).toBe(30_000);
    expect(connectionRetryDelay(99)).toBe(30_000);
  });

  it('reports a stable non-negative countdown', () => {
    expect(connectionRetrySeconds(15_500, 10_000)).toBe(6);
    expect(connectionRetrySeconds(9_000, 10_000)).toBe(0);
    expect(connectionRetrySeconds(null, 10_000)).toBe(0);
  });
});
