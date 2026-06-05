#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const rootDir = process.cwd();
const envPath = path.resolve(rootDir, '.env');
const envLocalPath = path.resolve(rootDir, '.env.local');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (!found) return fallback;
  return found.slice(prefix.length);
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function needEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function shouldKill(row, opts) {
  const command = String(row.Command || '').trim();
  const state = String(row.State || '').trim();
  const info = String(row.Info || '').replace(/\s+/g, ' ').trim();
  const ageSec = toNum(row.Time, 0);

  if (command === 'Sleep' && ageSec >= opts.sleepSeconds) {
    return `sleep>${opts.sleepSeconds}s`;
  }

  if (/Waiting for table level lock|Waiting for table metadata lock|Locked/i.test(state)) {
    return 'lock-wait';
  }

  if (opts.includeLongRunning && command !== 'Sleep' && ageSec >= opts.activeSeconds) {
    return `active>${opts.activeSeconds}s`;
  }

  if (/SELECT COUNT\(\*\) AS total FROM student_master s WHERE/i.test(info) && ageSec >= 30) {
    return 'slow-student-count';
  }

  return null;
}

async function main() {
  const execute = hasFlag('execute');
  const sleepSeconds = toNum(getArg('sleep-seconds', '120'), 120);
  const activeSeconds = toNum(getArg('active-seconds', '120'), 120);
  const includeLongRunning = hasFlag('include-long-running');

  const host = needEnv('DB_HOST');
  const port = toNum(process.env.DB_PORT || '3306', 3306);
  const user = needEnv('DB_USER');
  const password = needEnv('DB_PASSWORD');
  const database = needEnv('DB_NAME');

  const conn = await mysql.createConnection({ host, port, user, password, database });

  try {
    const [[self]] = await conn.query('SELECT CONNECTION_ID() AS id');
    const selfId = toNum(self?.id, 0);

    const [rows] = await conn.query('SHOW FULL PROCESSLIST');
    const candidates = [];

    for (const row of rows) {
      const id = toNum(row.Id, 0);
      const db = String(row.db || '').trim();
      if (!id || id === selfId) continue;
      if (db !== database) continue;

      const reason = shouldKill(row, { sleepSeconds, activeSeconds, includeLongRunning });
      if (!reason) continue;

      candidates.push({
        id,
        user: String(row.User || ''),
        command: String(row.Command || ''),
        time: toNum(row.Time, 0),
        state: String(row.State || ''),
        reason,
      });
    }

    if (candidates.length === 0) {
      console.log('No unnecessary connections found.');
      return;
    }

    console.table(candidates);

    if (!execute) {
      console.log('\nDry run only. Re-run with --execute to kill listed connections.');
      return;
    }

    let killed = 0;
    let failed = 0;
    for (const victim of candidates) {
      try {
        await conn.query(`KILL ${victim.id}`);
        killed += 1;
      } catch (error) {
        failed += 1;
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`Failed to kill ${victim.id}: ${msg}`);
      }
    }

    console.log(`Killed ${killed} connection(s). Failed: ${failed}.`);
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
