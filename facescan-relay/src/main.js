const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { syncNow, config } = require('./sync');

let mainWindow = null;
let pollTimer = null;
let nextSyncAt = null;

function sendStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sync-status', status);
  }
}

async function runSync() {
  sendStatus({ syncing: true, message: 'Syncing…' });
  const result = await syncNow({ onLog: (line) => sendStatus({ syncing: true, message: line }) });
  nextSyncAt = Date.now() + config.pollIntervalMinutes * 60_000;
  sendStatus({ syncing: false, ok: result.ok, message: result.message, nextSyncAt });
}

function startPolling() {
  runSync();
  pollTimer = setInterval(runSync, config.pollIntervalMinutes * 60_000);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 300,
    title: 'SIT Facescan Relay',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  startPolling();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (pollTimer) clearInterval(pollTimer);
});

ipcMain.handle('get-config', () => ({
  source: `SQL Server (${config.dbServer}${config.dbInstance ? `\\${config.dbInstance}` : ''} / ${config.dbName})`,
  pollIntervalMinutes: config.pollIntervalMinutes,
  nextSyncAt,
}));

ipcMain.on('sync-now', () => runSync());
