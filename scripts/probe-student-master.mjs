import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

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

const env = loadEnv('/Users/tanvikadam/Desktop/SIT/sitmanager/.env.local');

const oldCfg = {
  host: env.OLD_DB_HOST, port: parseInt(env.OLD_DB_PORT || '3306', 10),
  database: env.OLD_DB_NAME, user: env.OLD_DB_USER, password: env.OLD_DB_PASSWORD,
  dateStrings: true, connectTimeout: 30_000,
};
const newCfg = {
  host: env.DB_HOST, port: parseInt(env.DB_PORT || '3306', 10),
  database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD,
  dateStrings: true, connectTimeout: 30_000,
};

async function describe(conn, dbName, name) {
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(`  ${name}`);
  console.log('══════════════════════════════════════════════════════════════════');
  try {
    const [cols] = await conn.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [dbName, name]);
    if (!cols.length) { console.log('  (table not found)'); return null; }

    console.log('  Columns:');
    for (const col of cols) {
      const k = col.COLUMN_KEY ? `[${col.COLUMN_KEY}]` : '';
      const nn = col.IS_NULLABLE === 'NO' ? 'NN' : '  ';
      console.log(`    ${col.COLUMN_NAME.padEnd(28)} ${col.COLUMN_TYPE.padEnd(28)} ${nn} ${k}`);
    }

    const [n] = await conn.query(`SELECT COUNT(*) AS n FROM \`${name}\``);
    console.log(`  Row count: ${n[0].n}`);

    const [sample] = await conn.query(`SELECT * FROM \`${name}\` LIMIT 2`);
    console.log('  Sample (first 2):');
    for (const row of sample) {
      const compact = {};
      for (const [k, v] of Object.entries(row)) {
        const s = v == null ? 'null' : String(v);
        compact[k] = s.length > 40 ? s.slice(0, 37) + '...' : s;
      }
      console.log('    ' + JSON.stringify(compact));
    }

    return new Set(cols.map(c => c.COLUMN_NAME));
  } catch (e) {
    console.log(`  (failed: ${e.message})`);
    return null;
  }
}

const oldConn = await mysql.createConnection(oldCfg);
const newConn = await mysql.createConnection(newCfg);

const tables = [
  ['Student_Master', 'student_master'],
  ['Admission_Master', 'admission_master'],
];

for (const [oldName, newName] of tables) {
  const oldCols = await describe(oldConn, oldCfg.database, oldName);
  const newCols = await describe(newConn, newCfg.database, newName);

  if (oldCols && newCols) {
    const shared = [...oldCols].filter((c) => newCols.has(c));
    console.log(`\n  Shared columns (${shared.length}):`);
    console.log('    ' + shared.join(', '));
  }
}

await oldConn.end();
await newConn.end();
