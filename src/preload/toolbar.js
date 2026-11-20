'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('rulerAPI', {
  init: () => ipcRenderer.invoke('toolbar:init'),
  update: (patch) => ipcRenderer.send('state:update', patch),
  onState: (callback) => subscribe('state', callback),
  onEnv: (callback) => subscribe('toolbar:env', callback),
  resize: (size) => ipcRenderer.send('toolbar:resize', size),
  getPlacement: () => ipcRenderer.invoke('toolbar:placement'),
  minimizeToTray: () => ipcRenderer.send('app:minimize-to-tray'),
  quit: () => ipcRenderer.send('app:quit'),
});
