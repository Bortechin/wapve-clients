const CONNECTION_RETRY_DELAYS_MS = [3_000, 8_000, 15_000, 30_000] as const;

export function connectionRetryDelay(failedAttempts: number): number {
  const index = Math.max(0, Math.min(CONNECTION_RETRY_DELAYS_MS.length - 1, failedAttempts));
  return CONNECTION_RETRY_DELAYS_MS[index] ?? CONNECTION_RETRY_DELAYS_MS.at(-1) ?? 30_000;
}

export function connectionRetrySeconds(nextRetryAt: number | null, now: number): number {
  if (nextRetryAt === null) return 0;
  return Math.max(0, Math.ceil((nextRetryAt - now) / 1_000));
}
