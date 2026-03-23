#!/usr/bin/env node

import path from 'node:path';
import dotenv from 'dotenv';
import { createConnection } from 'mysql2/promise';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required (set it in .env.local or env).`);
  return value;
}

const DB_HOST = requireEnv('DB_HOST');
const DB_PORT = Number(requireEnv('DB_PORT'));
const DB_USER = requireEnv('DB_USER');
const DB_PASSWORD = requireEnv('DB_PASSWORD');
const DB_NAME = requireEnv('DB_NAME');

const DROP_ALL_CONFIRM = process.env.DROP_ALL_CONFIRM || '';
if (DROP_ALL_CONFIRM !== 'YES') {
  console.error(
    `Refusing to run without DROP_ALL_CONFIRM=YES. This will DROP ALL tables/views/routines/events in '${DB_NAME}'.`
  );
  process.exit(2);
}

const connection = await createConnection({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  multipleStatements: true,
});

try {
  const [[dbRow]] = await connection.query('SELECT DATABASE() AS db');
  if (!dbRow?.db) throw new Error('No database selected; check DB_NAME.');

  console.error(`Connected. Dropping all objects in '${dbRow.db}'...`);

  await connection.query('SET FOREIGN_KEY_CHECKS=0');

  // Views
  const [views] = await connection.query(
    `SELECT table_name AS name FROM information_schema.views WHERE table_schema = DATABASE()`
  );
  for (const row of views) {
    await connection.query(`DROP VIEW IF EXISTS \`${row.name}\``);
  }

  // Tables
  const [tables] = await connection.query(
    `SELECT table_name AS name FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`
  );
  for (const row of tables) {
    await connection.query(`DROP TABLE IF EXISTS \`${row.name}\``);
  }

  // Routines (procedures/functions)
  const [routines] = await connection.query(
    `SELECT routine_name AS name, routine_type AS type
     FROM information_schema.routines
     WHERE routine_schema = DATABASE()`
  );
  for (const r of routines) {
    const type = String(r.type || '').toUpperCase();
    if (type === 'PROCEDURE') {
      await connection.query(`DROP PROCEDURE IF EXISTS \`${r.name}\``);
    } else if (type === 'FUNCTION') {
      await connection.query(`DROP FUNCTION IF EXISTS \`${r.name}\``);
    }
  }

  // Events
  const [events] = await connection.query(
    `SELECT event_name AS name FROM information_schema.events WHERE event_schema = DATABASE()`
  );
  for (const e of events) {
    await connection.query(`DROP EVENT IF EXISTS \`${e.name}\``);
  }

  await connection.query('SET FOREIGN_KEY_CHECKS=1');

  console.error(
    `Dropped: views=${views.length}, tables=${tables.length}, routines=${routines.length}, events=${events.length}.`
  );
  console.error('Done.');
} finally {
  await connection.end();
}
