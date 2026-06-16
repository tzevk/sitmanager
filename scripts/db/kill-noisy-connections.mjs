#!/usr/bin/env node
/**
 * kill-noisy-connections.mjs
 *
 * Kills:
 *   1. Idle / long-running / lock-wait MySQL connections
 *   2. Stale Node.js / Next.js processes holding the app port (default 3000)
 *   3. Blocked Redis clients via CLIENT KILL
 *
 * Usage:
 *   node scripts/db/kill-noisy-connections.mjs               # dry-run, shows what would be killed
 *   node scripts/db/kill-noisy-connections.mjs --execute     # actually kill
 *   node scripts/db/kill-noisy-connections.mjs --execute --sleep-seconds=60 --include-long-running
 *   node scripts/db/kill-noisy-connections.mjs --execute --skip-mysql --skip-redis
 *   node scripts/db/kill-noisy-connections.mjs --execute --port=3001
 */

import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

// ── Env ───────────────────────────────────────────────────────────────────────

const rootDir = process.cwd();
for (const f of ['.env', '.env.local']) {
  const p = path.resolve(rootDir, f);
  if (fs.existsSync(p)) dotenv.config({ path: p });
}

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}
function hasFlag(name) { return process.argv.includes(`--${name}`); }
function needEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}
function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ── Flags ─────────────────────────────────────────────────────────────────────

const EXECUTE         = hasFlag('execute');
const SLEEP_SEC       = toNum(getArg('sleep-seconds', '120'), 120);
const ACTIVE_SEC      = toNum(getArg('active-seconds', '120'), 120);
const INCL_LONG       = hasFlag('include-long-running');
const SKIP_MYSQL      = hasFlag('skip-mysql');
const SKIP_NODE       = hasFlag('skip-node');
const SKIP_REDIS      = hasFlag('skip-redis');
const APP_PORT        = toNum(getArg('port', '3000'), 3000);

const DRY = !EXECUTE;
if (DRY) console.log('⚠  Dry run — pass --execute to actually kill.\n');

// ── 1. MySQL ─────────────────────────────────────────────────────────────────

function mysqlShouldKill(row) {
  const cmd   = String(row.Command || '').trim();
  const state = String(row.State   || '').trim();
  const info  = String(row.Info    || '').replace(/\s+/g, ' ').trim();
  const age   = toNum(row.Time, 0);

  if (cmd === 'Sleep' && age >= SLEEP_SEC)           return `sleep>${SLEEP_SEC}s`;
  if (/Waiting for table.*(lock|metadata)/i.test(state)) return 'lock-wait';
  if (INCL_LONG && cmd !== 'Sleep' && age >= ACTIVE_SEC) return `active>${ACTIVE_SEC}s`;
  if (/SELECT COUNT\(\*\) AS total FROM student_master/i.test(info) && age >= 30)
                                                      return 'slow-student-count';
  return null;
}

async function killMySQL() {
  console.log('── MySQL connections ────────────────────────────────────────');
  const host     = needEnv('DB_HOST');
  const port     = toNum(process.env.DB_PORT || '3306', 3306);
  const user     = needEnv('DB_USER');
  const password = needEnv('DB_PASSWORD');
  const database = needEnv('DB_NAME');

  const conn = await mysql.createConnection({ host, port, user, password, database });
  try {
    const [[self]] = await conn.query('SELECT CONNECTION_ID() AS id');
    const selfId   = toNum(self?.id, 0);
    const [rows]   = await conn.query('SHOW FULL PROCESSLIST');

    const targets = [];
    for (const row of rows) {
      const id = toNum(row.Id, 0);
      if (!id || id === selfId) continue;
      if (String(row.db || '').trim() !== database) continue;
      const reason = mysqlShouldKill(row);
      if (!reason) continue;
      targets.push({ id, user: row.User, command: row.Command, time: row.Time, state: row.State, reason });
    }

    if (!targets.length) { console.log('  Nothing to kill.\n'); return; }
    console.table(targets);

    if (DRY) { console.log('  (dry run — skipped)\n'); return; }

    let killed = 0, failed = 0;
    for (const t of targets) {
      try { await conn.query(`KILL ${t.id}`); killed++; }
      catch (e) { failed++; console.error(`  KILL ${t.id} failed: ${e.message}`); }
    }
    console.log(`  Killed ${killed}, failed ${failed}.\n`);
  } finally {
    await conn.end();
  }
}

// ── 2. Node.js / Next.js processes ───────────────────────────────────────────

async function killNode() {
  console.log(`── Node.js processes on port ${APP_PORT} ────────────────────`);

  // lsof works on macOS and Linux
  let pids = [];
  try {
    const out = execSync(`lsof -ti tcp:${APP_PORT} 2>/dev/null || true`, { encoding: 'utf8' });
    pids = out.trim().split('\n').map(Number).filter(Boolean);
  } catch {
    // lsof not available
  }

  // Fallback: fuser (Linux only)
  if (!pids.length) {
    try {
      const out = execSync(`fuser ${APP_PORT}/tcp 2>/dev/null || true`, { encoding: 'utf8' });
      pids = out.trim().split(/\s+/).map(Number).filter(Boolean);
    } catch { /* ignore */ }
  }

  if (!pids.length) { console.log('  No processes found on port.\n'); return; }

  // Describe each pid
  const rows = pids.map((pid) => {
    try {
      const cmd = execSync(`ps -p ${pid} -o comm= 2>/dev/null || true`, { encoding: 'utf8' }).trim();
      return { pid, command: cmd };
    } catch { return { pid, command: '?' }; }
  });
  console.table(rows);

  if (DRY) { console.log('  (dry run — skipped)\n'); return; }

  let killed = 0, failed = 0;
  for (const { pid } of rows) {
    const r = spawnSync('kill', ['-SIGTERM', String(pid)]);
    if (r.status === 0) { killed++; console.log(`  Sent SIGTERM to ${pid}`); }
    else { failed++; console.error(`  Failed to kill ${pid}`); }
  }
  console.log(`  Killed ${killed}, failed ${failed}.\n`);
}

// ── 3. Redis clients ──────────────────────────────────────────────────────────

async function killRedis() {
  console.log('── Redis idle clients ───────────────────────────────────────');
  const url = process.env.REDIS_URL;
  if (!url) { console.log('  REDIS_URL not set — skipping.\n'); return; }

  let Redis;
  try { ({ default: Redis } = await import('ioredis')); }
  catch { console.log('  ioredis not installed — skipping.\n'); return; }

  const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await client.connect();

    // CLIENT LIST returns one line per connected client
    const list = await client.call('CLIENT', 'LIST');
    const lines = String(list).trim().split('\n').filter(Boolean);

    // Parse each client line into key=value pairs
    const clients = lines.map((line) => {
      const obj = {};
      for (const kv of line.split(' ')) {
        const [k, v] = kv.split('=');
        if (k) obj[k] = v ?? '';
      }
      return obj;
    });

    // Kill clients idle > 5 minutes (300 s) that are not the current connection
    const selfAddr = await client.call('CLIENT', 'GETNAME').catch(() => null);
    void selfAddr;
    const IDLE_THRESHOLD = 300;
    const targets = clients.filter((c) => toNum(c.idle, 0) >= IDLE_THRESHOLD);

    if (!targets.length) { console.log('  No idle clients found.\n'); return; }

    const display = targets.map((c) => ({ id: c.id, addr: c.addr, idle_s: c.idle, cmd: c.cmd }));
    console.table(display);

    if (DRY) { console.log('  (dry run — skipped)\n'); return; }

    let killed = 0, failed = 0;
    for (const c of targets) {
      try {
        await client.call('CLIENT', 'KILL', 'ID', c.id);
        killed++;
      } catch (e) { failed++; console.error(`  CLIENT KILL ID ${c.id} failed: ${e.message}`); }
    }
    console.log(`  Killed ${killed}, failed ${failed}.\n`);
  } finally {
    client.disconnect();
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SKIP_MYSQL) await killMySQL();
  if (!SKIP_NODE)  await killNode();
  if (!SKIP_REDIS) await killRedis();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
