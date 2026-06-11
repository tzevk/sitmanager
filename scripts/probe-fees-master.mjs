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

const oldConn = await mysql.createConnection({
  host: env.OLD_DB_HOST, port: parseInt(env.OLD_DB_PORT || '3306', 10),
  database: env.OLD_DB_NAME, user: env.OLD_DB_USER, password: env.OLD_DB_PASSWORD,
  dateStrings: true, connectTimeout: 30_000,
});
const newConn = await mysql.createConnection({
  host: env.DB_HOST, port: parseInt(env.DB_PORT || '3306', 10),
  database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD,
  dateStrings: true, connectTimeout: 30_000,
});

async function describe(conn, dbName, name) {
  console.log('\n==== ' + name + ' ====');
  const [tbl] = await conn.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=? AND LOWER(TABLE_NAME)=?`,
    [dbName, name.toLowerCase()]
  );
  if (!tbl.length) { console.log('  (not found)'); return null; }
  const real = tbl[0].TABLE_NAME;
  console.log('  resolved table:', real);

  const [cols] = await conn.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_KEY FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION`,
    [dbName, real]
  );
  console.log('  columns:', cols.map(c => `${c.COLUMN_NAME}${c.COLUMN_KEY ? '['+c.COLUMN_KEY+']' : ''}`).join(', '));

  const pk = cols.find(c => c.COLUMN_KEY === 'PRI')?.COLUMN_NAME;
  const [cnt] = await conn.query(`SELECT COUNT(*) AS n FROM \`${real}\``);
  console.log('  row count:', cnt[0].n);
  if (pk) {
    const [range] = await conn.query(`SELECT MIN(\`${pk}\`) AS mn, MAX(\`${pk}\`) AS mx FROM \`${real}\``);
    console.log(`  ${pk} range:`, range[0].mn, '-', range[0].mx);
  }
  return { real, cols, pk };
}

await describe(oldConn, env.OLD_DB_NAME, 's_fees_mst');
await describe(newConn, env.DB_NAME, 's_fees_mst');

await oldConn.end();
await newConn.end();
