import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('wapveDesktop', {
  runtime: 'electron',
  currentGame: (): Promise<string | null> => ipcRenderer.invoke('activity:current-game'),
  // Open our native picker before asking Chromium for the display stream. The
  // renderer starts this and getDisplayMedia together, so the picker is
  // visible immediately while Electron keeps the capture request trusted.
  chooseCaptureSource: () => ipcRenderer.invoke('capture:choose-source'),
  takeCaptureSettings: () => ipcRenderer.invoke('capture:take-settings'),
  reportConnectivity: (online: boolean) => {
    if (typeof online === 'boolean') {
      ipcRenderer.send('content:connectivity-change', online);
    }
  },
});

window.addEventListener('offline', () => ipcRenderer.send('content:connectivity-change', false));
window.addEventListener('online', () => ipcRenderer.send('content:connectivity-change', true));

function checkForServerErrorDocument(): void {
  const title = (document.title ?? '').toLowerCase();
  const text = (document.body?.innerText ?? '').slice(0, 600).toLowerCase();
  if (
    title.includes('521') ||
    title.includes('web server is down') ||
    title.includes('cloudflare') ||
    title.includes('502 bad gateway') ||
    text.includes('error code 521') ||
    text.includes('web server is down') ||
    text.includes('host error')
  ) {
    ipcRenderer.send('content:connectivity-change', false);
  }
}

window.addEventListener('DOMContentLoaded', checkForServerErrorDocument);
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  checkForServerErrorDocument();
}
