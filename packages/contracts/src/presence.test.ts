import { describe, expect, it } from 'vitest';
import { presenceUpdateSchema, presenceWatchSchema } from './presence.js';

describe('presence contracts', () => {
  const userId = '018f0d7a-91ab-7abc-8def-0123456789ab';

  it('accepts bounded UUID watch lists', () => {
    expect(presenceWatchSchema.safeParse({ userIds: [userId] }).success).toBe(true);
    expect(presenceWatchSchema.safeParse({ userIds: ['not-a-user'] }).success).toBe(false);
  });

  it('accepts effective offline updates', () => {
    expect(presenceUpdateSchema.safeParse({ userId, status: 'OFFLINE' }).success).toBe(true);
  });
});
