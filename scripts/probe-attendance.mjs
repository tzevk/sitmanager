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
const cfg = {
  host: env.OLD_DB_HOST, port: parseInt(env.OLD_DB_PORT || '3306', 10),
  database: env.OLD_DB_NAME, user: env.OLD_DB_USER, password: env.OLD_DB_PASSWORD,
  dateStrings: true, connectTimeout: 30_000,
};

const c = await mysql.createConnection(cfg);

const candidates = ['Lecture_taken_child', 'Batch_Lecture_Master', 'Batch_SLecture_Master', 's_batch_lec'];

for (const name of candidates) {
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(`  ${name}`);
  console.log('══════════════════════════════════════════════════════════════════');
  try {
    const [cols] = await c.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [cfg.database, name]);
    if (!cols.length) { console.log('  (table not found)'); continue; }

    console.log('  Columns:');
    for (const col of cols) {
      const k = col.COLUMN_KEY ? `[${col.COLUMN_KEY}]` : '';
      const nn = col.IS_NULLABLE === 'NO' ? 'NN' : '  ';
      console.log(`    ${col.COLUMN_NAME.padEnd(28)} ${col.COLUMN_TYPE.padEnd(28)} ${nn} ${k}`);
    }

    const [n] = await c.query(`SELECT COUNT(*) AS n FROM \`${name}\``);
    console.log(`  Row count: ${n[0].n}`);

    const [sample] = await c.query(`SELECT * FROM \`${name}\` LIMIT 3`);
    console.log('  Sample (first 3):');
    for (const row of sample) {
      const compact = {};
      for (const [k, v] of Object.entries(row)) {
        const s = v == null ? 'null' : String(v);
        compact[k] = s.length > 50 ? s.slice(0, 47) + '...' : s;
      }
      console.log('    ' + JSON.stringify(compact));
    }

    const colSet = new Set(cols.map(c => c.COLUMN_NAME));
    const dateCol = ['Date', 'date', 'Lecture_Date', 'lecture_date', 'Attend_Date', 'Attendance_Date'].find(c => colSet.has(c));
    if (dateCol) {
      const [r] = await c.query(`SELECT MIN(\`${dateCol}\`) AS mn, MAX(\`${dateCol}\`) AS mx FROM \`${name}\``);
      console.log(`  ${dateCol} range: ${r[0].mn} → ${r[0].mx}`);
    }
    const stCol = ['Status', 'status', 'Attend_Status'].find(c => colSet.has(c));
    if (stCol) {
      const [d] = await c.query(`SELECT \`${stCol}\` AS v, COUNT(*) AS n FROM \`${name}\` GROUP BY \`${stCol}\` ORDER BY n DESC LIMIT 10`);
      console.log(`  ${stCol} distribution:`);
      for (const r of d) console.log(`    ${String(r.v ?? 'NULL').padEnd(20)} → ${r.n}`);
    }
  } catch (e) {
    console.log(`  (failed: ${e.message})`);
  }
}

await c.end();
