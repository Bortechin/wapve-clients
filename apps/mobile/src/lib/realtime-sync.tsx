import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from './auth';
import { realtime } from './client';

export function RealtimeQuerySync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    let disposed = false;
    const cleanups: Array<() => void> = [];

    void realtime.connect('/unread').then((socket) => {
      if (disposed) return;
      const changed = () => void queryClient.invalidateQueries({ queryKey: ['channel-unread'] });
      socket.on('unread:changed', changed);
      cleanups.push(() => socket.off('unread:changed', changed));
    });

    void realtime.connect('/notifications').then((socket) => {
      if (disposed) return;
      const changed = () => void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      socket.on('notifications:changed', changed);
      cleanups.push(() => socket.off('notifications:changed', changed));
    });

    void realtime.connect('/dm').then((socket) => {
      if (disposed) return;
      const changed = () => {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ['dm-conversations'] }),
          queryClient.invalidateQueries({ queryKey: ['group-conversations'] }),
        ]);
      };
      const events = [
        'social:changed',
        'dm:created',
        'dm:updated',
        'dm:deleted',
        'group:created',
        'group:updated',
        'group:deleted',
      ];
      events.forEach((event) => socket.on(event, changed));
      cleanups.push(() => events.forEach((event) => socket.off(event, changed)));
    });

    return () => {
      disposed = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [queryClient, user?.id]);

  return null;
}
