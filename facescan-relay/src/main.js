const { app, BrowserWindow, screen, Tray, Menu, ipcMain, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const started = require('electron-squirrel-startup');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const config = {
  deviceBaseUrl: (process.env.DEVICE_BASE_URL || '').replace(/\/+$/, ''),
  deviceApiKey: process.env.DEVICE_API_KEY || '',
  ingestUrl: process.env.INGEST_URL || '',
  ingestSecret: process.env.INGEST_SECRET || '',
  pollIntervalMinutes: Number(process.env.POLL_INTERVAL_MINUTES || 10),
};

let tray = null;
let mainWindow = null;
let pollTimer = null;
let nextSyncAt = null;

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function sendStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sync-status', status);
  }
}

/** Node's fetch wraps network errors as "fetch failed" with the real reason in .cause (possibly nested). */
function describeError(err) {
  if (!(err instanceof Error)) return String(err);
  let cause = err.cause;
  let detail = '';
  while (cause) {
    detail = cause.code ? `${cause.code}: ${cause.message ?? cause}` : String(cause.message ?? cause);
    cause = cause.cause;
  }
  return detail ? `${err.message} (${detail})` : err.message;
}

/** Pulls today's punch logs from the device and pushes them to SIT Manager. */
async function syncNow() {
  if (!config.deviceBaseUrl || !config.deviceApiKey) {
    sendStatus({ ok: false, message: 'DEVICE_BASE_URL / DEVICE_API_KEY not set in .env', at: new Date().toISOString() });
    return;
  }
  if (!config.ingestUrl || !config.ingestSecret) {
    sendStatus({ ok: false, message: 'INGEST_URL / INGEST_SECRET not set in .env', at: new Date().toISOString() });
    return;
  }

  sendStatus({ ok: true, syncing: true, message: 'Fetching punches from device…', at: new Date().toISOString() });

  try {
    const date = todayISO();
    const deviceUrl = `${config.deviceBaseUrl}/api/v2/WebAPI/GetDeviceLogs?APIKey=${encodeURIComponent(config.deviceApiKey)}&FromDate=${date}&ToDate=${date}`;

    let deviceRes;
    try {
      deviceRes = await fetch(deviceUrl);
    } catch (err) {
      throw new Error(`Device fetch failed: ${describeError(err)}`);
    }
    if (!deviceRes.ok) throw new Error(`Device request failed (${deviceRes.status})`);
    const logs = await deviceRes.json();
    if (!Array.isArray(logs)) throw new Error('Unexpected device response shape');

    let ingestRes;
    try {
      ingestRes = await fetch(config.ingestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-facescan-secret': config.ingestSecret,
        },
        body: JSON.stringify({ logs }),
      });
    } catch (err) {
      throw new Error(`Ingest fetch failed: ${describeError(err)}`);
    }
    const ingestData = await ingestRes.json().catch(() => ({}));
    if (!ingestRes.ok) throw new Error(ingestData.error || `Ingest failed (${ingestRes.status})`);

    nextSyncAt = Date.now() + config.pollIntervalMinutes * 60_000;
    sendStatus({
      ok: true,
      syncing: false,
      message: `Synced ${ingestData.inserted ?? 0} new punch(es) of ${logs.length} found`,
      at: new Date().toISOString(),
      nextSyncAt,
    });
  } catch (err) {
    console.error('Facescan relay sync failed:', err);
    nextSyncAt = Date.now() + config.pollIntervalMinutes * 60_000;
    sendStatus({ ok: false, syncing: false, message: describeError(err), at: new Date().toISOString(), nextSyncAt });
  }
}

function startPolling() {
  syncNow();
  nextSyncAt = Date.now() + config.pollIntervalMinutes * 60_000;
  pollTimer = setInterval(syncNow, config.pollIntervalMinutes * 60_000);
}

const createWindow = () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(width, 480),
    height: Math.min(height, 360),
    title: 'SIT Facescan Relay',
    show: false, // starts minimized to tray
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.minimize();
};

const createTray = () => {
  // tray-icon.png is optional — falls back to a blank icon if not provided.
  const trayIconPath = path.join(__dirname, 'tray-icon.png');
  const icon = fs.existsSync(trayIconPath) ? nativeImage.createFromPath(trayIconPath) : nativeImage.createEmpty();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => mainWindow.show() },
    { label: 'Sync Now', click: () => syncNow() },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setToolTip('SIT Facescan Relay');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow.show());
};

app.whenReady().then(() => {
  createWindow();
  createTray();
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
  deviceBaseUrl: config.deviceBaseUrl,
  ingestUrl: config.ingestUrl,
  pollIntervalMinutes: config.pollIntervalMinutes,
  nextSyncAt,
}));

ipcMain.on('sync-now', () => syncNow());
