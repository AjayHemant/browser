// preload.js

const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe, limited API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  navigateTo: (url) => ipcRenderer.send('navigate-to', url),
  newIncognitoWindow: () => ipcRenderer.send('new-incognito-window'),
  onDownloadCompleted: (callback) => ipcRenderer.on('download-completed', callback),
  showItemInFolder: (path) => ipcRenderer.send('show-item-in-folder', path),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  // Ad-blocker API
  adBlockerToggle: (enabled) => ipcRenderer.invoke('adblocker-toggle', enabled),
  adBlockerStats: () => ipcRenderer.invoke('adblocker-stats'),
  adBlockerResetCount: () => ipcRenderer.invoke('adblocker-reset-count')
});
