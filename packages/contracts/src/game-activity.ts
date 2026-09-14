import { z } from 'zod';

export const gameIdSchema = z.enum(['valorant', 'league-of-legends', 'counter-strike-2', 'dota-2', 'fortnite', 'pubg', 'apex-legends', 'rocket-league', 'overwatch-2', 'minecraft']);
export const gameNames: Record<z.infer<typeof gameIdSchema>, string> = {
  valorant: 'Valorant',
  'league-of-legends': 'League of Legends',
  'counter-strike-2': 'Counter-Strike 2',
  'dota-2': 'Dota 2',
  fortnite: 'Fortnite',
  pubg: 'PUBG',
  'apex-legends': 'Apex Legends',
  'rocket-league': 'Rocket League',
  'overwatch-2': 'Overwatch 2',
  minecraft: 'Minecraft',
};
export const gameIcons: Record<z.infer<typeof gameIdSchema>, string> = {
  valorant: '/games/valorant.svg',
  'league-of-legends': '/games/league-of-legends.svg',
  'counter-strike-2': '/games/counter-strike-2.svg',
  'dota-2': '/games/dota-2.svg',
  fortnite: '/games/fortnite.svg',
  pubg: '/games/pubg.svg',
  'apex-legends': '/games/apex-legends.svg',
  'rocket-league': '/games/rocket-league.svg',
  'overwatch-2': '/games/overwatch-2.svg',
  minecraft: '/games/minecraft.svg',
};
export const gameActivitySchema = z.object({
  gameId: gameIdSchema,
  startedAt: z.number().int().optional(),
});
export const gameActivityUpdateSchema = gameActivitySchema.nullable();
export type GameActivity = z.infer<typeof gameActivitySchema>;

