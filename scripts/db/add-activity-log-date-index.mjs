#!/usr/bin/env node
/**
 * Adds idx_activity_created to system_activity_log so the Activity Log page can
 * filter by date quickly. Safe to run twice: it skips if the index already exists.
 *
 *   node scripts/db/add-activity-log-date-index.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

const env = {};
for (const line of fs.readFileSync(path.resolve('.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}

const c = await mysql.createConnection({
  host: env.DB_HOST, port: Number(env.DB_PORT || 3306), user: env.DB_USER,
  password: env.DB_PASSWORD, database: env.DB_NAME,
});
try {
  const [existing] = await c.query(`SHOW INDEX FROM system_activity_log WHERE Key_name = 'idx_activity_created'`);
  if (existing.length) {
    console.log('Index already exists: nothing to do.');
  } else {
    await c.query(`ALTER TABLE system_activity_log ADD INDEX idx_activity_created (created_at)`);
    console.log('Added idx_activity_created.');
  }
} finally {
  await c.end();
}
