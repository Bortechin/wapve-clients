type WapveConnectionState = 'checking' | 'online' | 'offline';
type WapveConnectionSnapshot = {
  state: WapveConnectionState;
  attempt: number;
  retryAt: number | null;
};

interface Window {
  wapveShell: {
    minimize(): Promise<void>;
    toggleMaximize(): Promise<void>;
    close(): Promise<void>;
    retryConnection(): Promise<void>;
    onConnectionState(listener: (snapshot: WapveConnectionSnapshot) => void): () => void;
  };
  wapveCapturePicker: {
    listSources(forceRefresh?: boolean): Promise<
      Array<{
        id: string;
        name: string;
        kind: 'window' | 'screen';
        thumbnail: string | null;
        appIcon: string | null;
      }>
    >;
    select(input: { sourceId: string; quality: 'balanced' | 'high' }): Promise<void>;
    cancel(): Promise<void>;
    onOpen(listener: () => void): () => void;
  };
}
