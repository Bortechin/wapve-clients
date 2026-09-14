import { expect, it } from '@jest/globals';
import { updatePresenceData } from './presence-data';
const user = { id: 'alice', status: 'ONLINE', gameActivity: { gameId: 'valorant' } };
it('updates a nested peer without mutating cached objects', () => {
  const cache = [{ peer: user }];
  expect(
    updatePresenceData(cache, {
      userId: 'alice',
      status: 'ONLINE',
      gameActivity: { gameId: 'minecraft' },
    }),
  ).toEqual([{ peer: { ...user, gameActivity: { gameId: 'minecraft' } } }]);
  expect(cache[0]?.peer).toBe(user);
  expect(user.gameActivity.gameId).toBe('valorant');
});
it('clears activity for invisible, offline, explicit clears and legacy snapshots', () => {
  for (const status of ['OFFLINE', 'INVISIBLE'] as const)
    expect(
      updatePresenceData(user, { userId: 'alice', status, gameActivity: { gameId: 'minecraft' } }),
    ).toEqual({ ...user, status, gameActivity: null });
  expect(updatePresenceData(user, { userId: 'alice', status: 'ONLINE' })).toEqual({
    ...user,
    gameActivity: null,
  });
  expect(
    updatePresenceData(user, { userId: 'alice', status: 'ONLINE', gameActivity: null }),
  ).toEqual({ ...user, gameActivity: null });
});
