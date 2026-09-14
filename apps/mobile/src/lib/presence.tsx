import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from '@/components/themed-native';
import { useAuth } from './auth';
import { realtime } from './client';
import { presenceUpdateSchema, presenceSnapshotSchema } from '@wapve/contracts';
import { updatePresenceData } from './presence-data';

const presenceQueryRoots = [
  'friends',
  'dm-conversations',
  'group-conversations',
  'server-members',
  'social-profile',
  'profile',
  'me-profile',
] as const;

/** Keeps mobile presence live and synchronizes profile/status changes across every signed-in client. */
export function PresenceBridge() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    let disposed = false;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let watchTimer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribeCache: (() => void) | undefined;

    const stop = () => {
      if (heartbeat) clearInterval(heartbeat);
      if (watchTimer) clearTimeout(watchTimer);
      unsubscribeCache?.();
      heartbeat = undefined;
      watchTimer = undefined;
      unsubscribeCache = undefined;
      realtime.disconnect('/presence');
    };
    const start = async () => {
      stop();
      if (disposed || AppState.currentState !== 'active') return;
      const socket = await realtime.connect('/presence');
      if (disposed) return;
      const beat = () => socket.emit('presence:heartbeat');
      let watchedUserIds = '';
      const emitWatch = (force = false) => {
        const userIds = collectPresenceUserIds(queryClient, user.id).sort();
        const signature = userIds.join(',');
        if (!force && signature === watchedUserIds) return;
        watchedUserIds = signature;
        socket.emit('presence:watch', {
          userIds,
        });
      };
      const scheduleWatch = () => {
        if (watchTimer) clearTimeout(watchTimer);
        watchTimer = setTimeout(emitWatch, 80);
      };
      const applyPresence = (value: unknown) => {
        const parsed = presenceUpdateSchema.safeParse(value);
        if (!parsed.success) return;
        const update = parsed.data;
        for (const root of presenceQueryRoots) {
          queryClient.setQueriesData({ queryKey: [root] }, (current) =>
            updatePresenceData(current, update),
          );
        }
      };
      const syncProfile = ({ userId }: { userId: string }) => {
        const invalidations = [
          ...presenceQueryRoots.map((root) => queryClient.invalidateQueries({ queryKey: [root] })),
          queryClient.invalidateQueries({ queryKey: ['social-profile', userId] }),
        ];
        if (userId === user.id) {
          void refreshUser().then(() =>
            Promise.all([
              ...invalidations,
              queryClient.invalidateQueries({ queryKey: ['profile', 'me'] }),
              queryClient.invalidateQueries({ queryKey: ['me-profile'] }),
            ]),
          );
        } else {
          void Promise.all(invalidations);
        }
      };
      socket.on('connect', () => {
        beat();
        emitWatch(true);
      });
      socket.on('presence:changed', applyPresence);
      socket.on('presence:snapshot', (value: unknown) => {
        const parsed = presenceSnapshotSchema.safeParse(value);
        if (parsed.success) parsed.data.forEach(applyPresence);
      });
      socket.on('profile:changed', syncProfile);
      unsubscribeCache = queryClient.getQueryCache().subscribe(scheduleWatch);
      beat();
      emitWatch();
      heartbeat = setInterval(beat, 25_000);
    };
    const onState = (state: AppStateStatus) => {
      if (state === 'active') void start();
      else stop();
    };

    void start();
    const subscription = AppState.addEventListener('change', onState);
    return () => {
      disposed = true;
      subscription.remove();
      stop();
    };
  }, [queryClient, refreshUser, user?.id]);

  return null;
}

function collectPresenceUserIds(queryClient: QueryClient, ownUserId: string) {
  const ids = new Set([ownUserId]);
  for (const root of presenceQueryRoots) {
    for (const query of queryClient.getQueryCache().findAll({ queryKey: [root] })) {
      collectUserIds(query.state.data, ids);
    }
  }
  return [...ids].slice(0, 500);
}

function collectUserIds(value: unknown, ids: Set<string>) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectUserIds(item, ids));
    return;
  }
  if (!isRecord(value)) return;
  if (typeof value.id === 'string' && typeof value.status === 'string') ids.add(value.id);
  Object.values(value).forEach((item) => collectUserIds(item, ids));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
