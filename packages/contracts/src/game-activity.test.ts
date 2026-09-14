import { describe, expect, it } from 'vitest';
import { gameIdSchema, gameNames, gameIcons, gameActivityUpdateSchema } from './game-activity.js';
import { presenceUpdateSchema } from './presence.js';

describe('game activity contract', () => {
  it('defines labels and icons for all supported games', () => {
    for (const id of gameIdSchema.options) {
      expect(gameNames[id]).toBeTruthy();
      expect(gameIcons[id]).toMatch(/^\/games\/[a-z0-9-]+\.svg$/);
    }
  });
  it('accepts old clients, known activities with startedAt and clearing only', () => {
    const old = { userId: '019a0000-0000-7000-8000-000000000001', status: 'ONLINE' };
    expect(presenceUpdateSchema.safeParse(old).success).toBe(true);
    expect(gameActivityUpdateSchema.parse(null)).toBeNull();
    expect(gameActivityUpdateSchema.safeParse({ gameId: 'arbitrary.exe' }).success).toBe(false);
    expect(gameActivityUpdateSchema.safeParse({ gameId: 'minecraft', startedAt: Date.now() }).success).toBe(true);
  });
});
