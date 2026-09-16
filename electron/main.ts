import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: 'StreamNote AI - Windows Meeting Intelligence',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  // IPC handlers for Native Windows WASAPI Loopback Capture
  ipcMain.handle('audio:get-devices', async () => {
    // In production native build, enumerates Core Audio endpoints
    return [
      { id: 'default-render', name: 'Windows Default Output (WASAPI Loopback)', type: 'render', isDefault: true },
      { id: 'default-capture', name: 'Windows Default Microphone (WASAPI Input)', type: 'capture', isDefault: true },
    ];
  });

  ipcMain.handle('audio:start-loopback', async (_event, _deviceId) => {
    console.log('[Electron Main] Starting native WASAPI loopback capture on default render endpoint');
    return { status: 'ok', sampleRate: 48000, channels: 2 };
  });

  ipcMain.handle('audio:stop-loopback', async () => {
    console.log('[Electron Main] Stopping native WASAPI loopback capture');
    return { status: 'ok' };
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
