import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// native Windows WASAPI loopback and system features safely.
contextBridge.exposeInMainWorld('__STREAMNOTE_ELECTRON__', {
  isDesktop: true,
  platform: process.platform,
  wasapiSupported: process.platform === 'win32',

  // Audio capture commands to main process
  startWasapiLoopback: (deviceId?: string) => ipcRenderer.invoke('audio:start-loopback', deviceId),
  stopWasapiLoopback: () => ipcRenderer.invoke('audio:stop-loopback'),
  getAudioDevices: () => ipcRenderer.invoke('audio:get-devices'),

  // Audio stream callbacks
  onWasapiChunk: (callback: (data: { chunk: number[]; sampleRate: number; channels: number }) => void) => {
    const subscription = (_event: any, value: any) => callback(value);
    ipcRenderer.on('audio:loopback-chunk', subscription);
    return () => ipcRenderer.removeListener('audio:loopback-chunk', subscription);
  },
});
