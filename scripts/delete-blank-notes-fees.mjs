import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
function loadEnv(p) {
  const env = {};
  for (const l of readFileSync(p, 'utf8').split('\n')) {
    const t = l.trim(); if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('='); if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[t.slice(0, i).trim()] = v;
  }
  return env;
}
const env = loadEnv(resolve(__dir, '../.env.local'));

const conn = await mysql.createConnection({
  host: env.DB_HOST, port: parseInt(env.DB_PORT || '3306', 10),
  database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD,
  dateStrings: true, connectTimeout: 30_000,
});

const WHERE = `Notes IS NULL OR TRIM(Notes) = ''`;

const [rows] = await conn.query(`SELECT COUNT(*) AS n FROM s_fees_mst WHERE ${WHERE}`);
console.log('Rows matching blank Notes:', rows[0].n);

if (process.argv.includes('--delete')) {
  const [matched] = await conn.query(`SELECT * FROM s_fees_mst WHERE ${WHERE}`);
  const backupPath = resolve(__dir, `../scratch-blank-notes-fees-backup-${Date.now()}.json`);
  const { writeFileSync } = await import('fs');
  writeFileSync(backupPath, JSON.stringify(matched, null, 2));
  console.log('Backed up', matched.length, 'rows to', backupPath);

  const [result] = await conn.query(`DELETE FROM s_fees_mst WHERE ${WHERE}`);
  console.log('Deleted rows:', result.affectedRows);
} else {
  console.log('Dry run only. Re-run with --delete to actually delete these rows.');
}

await conn.end();
