/**
 * Kill stale MySQL connections for the primary DB_USER.
 *
 * If the primary user is already at max_user_connections, the script
 * automatically falls back to the next DB_USER (or DB_ADMIN_USER) found
 * in the env file and uses that connection to do the killing instead.
 *
 * Usage:
 *   node scripts/db/kill-stale-connections.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import mysql from 'mysql2/promise';

// ── Env parsing ───────────────────────────────────────────────────────────────

/**
 * Parse an env file line-by-line and collect every value assigned to `key`.
 * Returns them in file order (first → last).
 */
function parseAllValues(filePath, key) {
  if (!fs.existsSync(filePath)) return [];
  const re = new RegExp(`^${key}\\s*=\\s*["']?([^"'\\r\\n]+)["']?`, 'm');
  const results = [];
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const m = line.trim().match(re);
    if (m) results.push(m[1].trim());
  }
  return results;
}

function parseValue(filePath, key) {
  return parseAllValues(filePath, key).at(-1) ?? null;
}

// Collect credentials from both env files in priority order
const envFiles = ['.env.local', '.env'].map(f => path.resolve(process.cwd(), f));

const DB_HOST     = envFiles.map(f => parseValue(f, 'DB_HOST')).find(Boolean);
const DB_PORT     = envFiles.map(f => parseValue(f, 'DB_PORT')).find(Boolean) ?? '3306';
const DB_NAME     = envFiles.map(f => parseValue(f, 'DB_NAME')).find(Boolean);
const DB_PASSWORD = envFiles.map(f => parseValue(f, 'DB_PASSWORD')).find(Boolean);

// All DB_USER values across env files, in file order (first is primary/target)
const allDbUsers = envFiles.flatMap(f => parseAllValues(f, 'DB_USER'));

// Optional explicit admin override
const DB_ADMIN_USER     = envFiles.map(f => parseValue(f, 'DB_ADMIN_USER')).find(Boolean);
const DB_ADMIN_PASSWORD = envFiles.map(f => parseValue(f, 'DB_ADMIN_PASSWORD')).find(Boolean);
const DB_ROOT_USER      = envFiles.map(f => parseValue(f, 'DB_ROOT_USER')).find(Boolean);
const DB_ROOT_PASSWORD  = envFiles.map(f => parseValue(f, 'DB_ROOT_PASSWORD')).find(Boolean);

if (!DB_HOST || !DB_PASSWORD || allDbUsers.length === 0) {
  console.error('Missing DB_HOST, DB_PASSWORD, or DB_USER in env files.');
  process.exit(1);
}

// ── Build candidate list ──────────────────────────────────────────────────────

// Deduplicate while preserving order
const seen = new Set();
const candidates = [];

for (const user of allDbUsers) {
  if (!seen.has(user)) { seen.add(user); candidates.push({ user, password: DB_PASSWORD }); }
}
if (DB_ADMIN_USER && !seen.has(DB_ADMIN_USER)) {
  seen.add(DB_ADMIN_USER);
  candidates.push({ user: DB_ADMIN_USER, password: DB_ADMIN_PASSWORD ?? DB_PASSWORD });
}
if (DB_ROOT_USER && !seen.has(DB_ROOT_USER)) {
  candidates.push({ user: DB_ROOT_USER, password: DB_ROOT_PASSWORD ?? DB_PASSWORD });
}

const targetUser = candidates[0].user;

console.log(`Target user (connections to kill): "${targetUser}"`);
console.log(`Fallback order: ${candidates.map(c => c.user).join(' → ')}\n`);

// ── Try connecting in fallback order ─────────────────────────────────────────

async function tryConnect(user, password) {
  try {
    const conn = await mysql.createConnection({
      host: DB_HOST,
      port: Number(DB_PORT),
      user,
      password,
      database: DB_NAME,
    });
    return conn;
  } catch (err) {
    if (err.code === 'ER_TOO_MANY_USER_CONNECTIONS') return null;
    throw err; // unexpected error — surface it
  }
}

let conn = null;
let connectedAs = null;

for (const { user, password } of candidates) {
  process.stdout.write(`  Trying "${user}"... `);
  conn = await tryConnect(user, password);
  if (conn) {
    connectedAs = user;
    console.log('connected.');
    break;
  }
  console.log('too many connections, skipping.');
}

if (!conn) {
  console.error('\nAll candidate users are at max_user_connections. Cannot proceed.');
  console.error('Add DB_ADMIN_USER / DB_ADMIN_PASSWORD (or DB_ROOT_USER / DB_ROOT_PASSWORD) to .env.local.');
  process.exit(1);
}

if (connectedAs !== targetUser) {
  console.log(`\nUsing "${connectedAs}" to kill "${targetUser}" connections.\n`);
} else {
  console.log('');
}

// ── List and kill ─────────────────────────────────────────────────────────────

const [[{ currentId }]] = await conn.query('SELECT CONNECTION_ID() AS currentId');

const [rows] = await conn.query(
  `SELECT id, user, host, db, command, time, state
   FROM information_schema.processlist
   WHERE user = ?
   ORDER BY time DESC`,
  [targetUser],
);

const toKill = rows.filter(r => r.id !== currentId);

if (!toKill.length) {
  console.log(`No stale connections found for "${targetUser}".`);
  await conn.end();
  process.exit(0);
}

console.log(`Found ${toKill.length} connection(s) for "${targetUser}":\n`);
console.log(['ID', 'Host', 'Command', 'Time(s)', 'State'].map(h => h.padEnd(18)).join(''));
console.log('-'.repeat(90));
for (const r of toKill) {
  console.log([r.id, r.host, r.command, r.time, r.state ?? ''].map(v => String(v).padEnd(18)).join(''));
}

console.log(`\nKilling ${toKill.length} connection(s)...\n`);
let killed = 0;
for (const r of toKill) {
  try {
    await conn.query('KILL CONNECTION ?', [r.id]);
    console.log(`  killed ${r.id} (host: ${r.host}, idle: ${r.time}s)`);
    killed++;
  } catch (err) {
    console.warn(`  could not kill ${r.id}: ${err.message}`);
  }
}

await conn.end();
console.log(`\nDone — killed ${killed}/${toKill.length} connection(s). Retry your login now.`);
