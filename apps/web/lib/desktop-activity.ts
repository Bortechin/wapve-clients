import { gameIdSchema } from '@wapve/contracts';
import type { Socket } from 'socket.io-client';
import { gameSharingEnabled, gameSharingKey } from './appearance';

export function connectDesktopActivity(socket: Socket): () => void {
  const bridge = window.wapveDesktop;
  if (!bridge?.currentGame) return () => undefined;
  let disposed = false;
  let enabled = gameSharingEnabled();
  let last: string | null | undefined;
  let startedAt: number | undefined;
  let revision = 0;
  const sync = async () => {
    const currentRevision = ++revision;
    let game: string | null = null;
    if (enabled) {
      try { const parsed = gameIdSchema.safeParse(await bridge.currentGame!()); if (parsed.success) game = parsed.data; }
      catch { game = null; }
    }
    if (disposed || revision !== currentRevision || !socket.connected) return;
    if (game !== last) {
      if (game) {
        if (!startedAt || last !== game) startedAt = Date.now();
        socket.emit('presence:activity', { gameId: game, startedAt });
      } else {
        startedAt = undefined;
        socket.emit('presence:activity', null);
      }
      last = game;
    }
  };
  const ready = () => { last = undefined; void sync(); };
  const preference = (event: Event) => { enabled = (event as CustomEvent<boolean>).detail; void sync(); };
  const storage = (event: StorageEvent) => { if (event.key === gameSharingKey) { enabled = gameSharingEnabled(); void sync(); } };
  socket.on('presence:ready', ready);
  window.addEventListener('wapve:game-sharing', preference);
  window.addEventListener('storage', storage);
  const timer = window.setInterval(() => void sync(), 15_000);
  void sync();
  return () => { disposed = true; clearInterval(timer); socket.off('presence:ready', ready); window.removeEventListener('wapve:game-sharing', preference); window.removeEventListener('storage', storage); };
}
