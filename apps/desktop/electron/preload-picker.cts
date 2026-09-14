import { contextBridge, ipcRenderer } from 'electron';

type CapturePickerSelection = {
  sourceId: string;
  quality: 'balanced' | 'high';
};

contextBridge.exposeInMainWorld('wapveCapturePicker', {
  listSources: (forceRefresh = false) =>
    ipcRenderer.invoke('capture-picker:list-sources', forceRefresh),
  select: (selection: CapturePickerSelection) =>
    ipcRenderer.invoke('capture-picker:select', selection),
  cancel: () => ipcRenderer.invoke('capture-picker:cancel'),
  onOpen: (listener: () => void) => {
    const handler = () => listener();
    ipcRenderer.on('capture-picker:open', handler);
    return () => ipcRenderer.removeListener('capture-picker:open', handler);
  },
});
