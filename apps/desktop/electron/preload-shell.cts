import { contextBridge, ipcRenderer } from 'electron';

type ConnectionState = 'checking' | 'online' | 'offline';
type ConnectionSnapshot = {
  state: ConnectionState;
  attempt: number;
  retryAt: number | null;
};

contextBridge.exposeInMainWorld('wapveShell', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  retryConnection: () => ipcRenderer.invoke('shell:retry-connection'),
  onConnectionState: (listener: (snapshot: ConnectionSnapshot) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: ConnectionSnapshot) =>
      listener(snapshot);
    ipcRenderer.on('shell:connection-state', handler);
    return () => ipcRenderer.removeListener('shell:connection-state', handler);
  },
});
