const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('relay', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  syncNow: () => ipcRenderer.send('sync-now'),
  onStatus: (callback) => ipcRenderer.on('sync-status', (_event, status) => callback(status)),
});
