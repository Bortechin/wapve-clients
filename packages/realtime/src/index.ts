import type { TokenStorage } from '@wapve/api-client';
import { io, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client';

export const wapveNamespaces = [
  '/chat', '/unread', '/notifications', '/presence', '/dm', '/servers', '/voice', '/calls',
] as const;
export type WapveNamespace = (typeof wapveNamespaces)[number];

export class WapveRealtimeClient {
  private readonly sockets = new Map<WapveNamespace, Socket>();

  constructor(
    private readonly socketUrl: string,
    private readonly tokens: TokenStorage,
  ) {}

  async connect(
    namespace: WapveNamespace,
    options: Partial<ManagerOptions & SocketOptions> = {},
  ): Promise<Socket> {
    const current = this.sockets.get(namespace);
    if (current) return current;
    const session = await this.tokens.load();
    const socket = io(`${this.socketUrl}${namespace}`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 30_000,
      randomizationFactor: 0.3,
      timeout: 15_000,
      auth: { accessToken: session?.accessToken },
      ...options,
    });
    socket.on('reconnect_attempt', async () => {
      const latest = await this.tokens.load();
      socket.auth = { accessToken: latest?.accessToken };
    });
    this.sockets.set(namespace, socket);
    return socket;
  }

  disconnect(namespace?: WapveNamespace): void {
    if (namespace) {
      this.sockets.get(namespace)?.disconnect();
      this.sockets.delete(namespace);
      return;
    }
    for (const socket of this.sockets.values()) socket.disconnect();
    this.sockets.clear();
  }
}
