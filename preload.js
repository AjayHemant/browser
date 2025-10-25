// preload.js

const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe, limited API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  navigateTo: (url) => ipcRenderer.send('navigate-to', url),
});
