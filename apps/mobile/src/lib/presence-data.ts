import type { PresenceUpdate } from '@wapve/contracts';

export function updatePresenceData(value: unknown, update: PresenceUpdate): unknown {
  if (Array.isArray(value)) return value.map((item) => updatePresenceData(item, update));
  if (typeof value !== 'object' || value === null) return value;
  const record = value as Record<string, unknown>;
  const nested = Object.fromEntries(
    Object.entries(record).map(([key, item]) => [key, updatePresenceData(item, update)]),
  );
  if (record.id !== update.userId || typeof record.status !== 'string') return nested;
  return {
    ...nested,
    status: update.status,
    gameActivity:
      update.status === 'OFFLINE' || update.status === 'INVISIBLE'
        ? null
        : (update.gameActivity ?? null),
    ...(update.customStatusText !== undefined ? { customStatusText: update.customStatusText } : {}),
    ...(update.customStatusEmoji !== undefined
      ? { customStatusEmoji: update.customStatusEmoji }
      : {}),
  };
}
