const statusEl = document.getElementById('status');
const sourceEl = document.getElementById('source');
const metaEl = document.getElementById('meta');
const syncBtn = document.getElementById('sync-btn');

let nextSyncAt = null;

function render(status) {
  if (!status) return;
  if (status.nextSyncAt) nextSyncAt = status.nextSyncAt;

  statusEl.textContent = status.syncing ? 'Syncing…' : status.message;
  statusEl.className = 'status ' + (status.syncing ? '' : status.ok ? 'ok' : 'err');
  syncBtn.disabled = Boolean(status.syncing);
}

function updateCountdown() {
  if (!nextSyncAt) return;
  const secsLeft = Math.max(0, Math.round((nextSyncAt - Date.now()) / 1000));
  const m = Math.floor(secsLeft / 60);
  const s = secsLeft % 60;
  metaEl.textContent = `Next automatic sync in ${m}:${String(s).padStart(2, '0')}`;
}

window.relay.getConfig().then((cfg) => {
  sourceEl.textContent = cfg.source;
  if (cfg.nextSyncAt) nextSyncAt = cfg.nextSyncAt;
});

window.relay.onStatus(render);
syncBtn.addEventListener('click', () => window.relay.syncNow());

setInterval(updateCountdown, 1000);
