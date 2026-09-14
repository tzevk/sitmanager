const { syncNow, config } = require('./sync');

const runOnce = process.argv.includes('--once');
const dryRun = process.argv.includes('--dry-run');

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

async function main() {
  await syncNow({ dryRun, onLog: log });
  if (runOnce || dryRun) return;

  log(`Polling every ${config.pollIntervalMinutes} minute(s). Press Ctrl+C to stop.`);
  setInterval(() => syncNow({ dryRun, onLog: log }), config.pollIntervalMinutes * 60_000);
}

main();
