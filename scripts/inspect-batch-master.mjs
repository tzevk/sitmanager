/**
 * Compare batch_master between OLD and NEW DBs.
 *
 *   node scripts/inspect-batch-master.mjs
 *
 * Read-only on both DBs. Prints schema for each, row counts, ID-overlap,
 * column-by-column data drift on the overlap, and lists rows present only
 * in one side.
 *
 * Pipe to a file:
 *   node scripts/inspect-batch-master.mjs > batch-inspection.txt
 */

import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir   = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env.local');

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

const env = loadEnv(envPath);

const OLD_CFG = {
  host: env.OLD_DB_HOST, port: parseInt(env.OLD_DB_PORT || '3306', 10),
  database: env.OLD_DB_NAME, user: env.OLD_DB_USER, password: env.OLD_DB_PASSWORD,
  dateStrings: true, connectTimeout: 30_000,
};
const NEW_CFG = {
  host: env.DB_HOST, port: parseInt(env.DB_PORT || '3306', 10),
  database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD,
  dateStrings: true, connectTimeout: 30_000,
};

const READ_ONLY_RE = /^(with|select|show|describe|desc|explain)\b/i;
function assertReadOnly(sql) {
  const s = String(sql).replace(/^(\s|\/\*[\s\S]*?\*\/|--[^\n]*\n|#[^\n]*\n)*/, '').trim();
  if (!READ_ONLY_RE.test(s)) throw new Error(`[SAFETY] non-read query blocked: ${s.slice(0, 80)}`);
}
async function ro(conn, sql, params = []) {
  assertReadOnly(sql);
  const [rows] = await conn.query(sql, params);
  return rows;
}

function hr(c = '─', w = 78) { return c.repeat(w); }
function header(s) { console.log('\n' + hr('═')); console.log('  ' + s); console.log(hr('═')); }
function sub(s)    { console.log('\n' + hr());     console.log('  ' + s); console.log(hr()); }
function pad(n, w = 8) { return String(n).padStart(w); }

const OLD_TABLE = 'Batch_Mst';
const NEW_TABLE = 'batch_mst';

async function tableSchema(conn, dbName, tableName) {
  const cols = await ro(conn, `
    SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, EXTRA
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    ORDER BY ORDINAL_POSITION
  `, [dbName, tableName]);
  return cols;
}

function printSchema(label, cols) {
  console.log(`  ${label} (${cols.length} columns):`);
  for (const c of cols) {
    const k  = c.COLUMN_KEY ? `[${c.COLUMN_KEY}]` : '';
    const nn = c.IS_NULLABLE === 'NO' ? 'NN' : '  ';
    console.log(`    ${c.COLUMN_NAME.padEnd(28)} ${c.COLUMN_TYPE.padEnd(28)} ${nn} ${k}`);
  }
}

async function main() {
  console.log(hr('═'));
  console.log('  BATCH_MASTER — OLD vs NEW COMPARISON');
  console.log(`  OLD : ${OLD_CFG.user}@${OLD_CFG.host}/${OLD_CFG.database}  (${OLD_TABLE})`);
  console.log(`  NEW : ${NEW_CFG.user}@${NEW_CFG.host}/${NEW_CFG.database}  (${NEW_TABLE})`);
  console.log(hr('═'));

  process.stdout.write('  Connecting OLD ... '); const oldConn = await mysql.createConnection(OLD_CFG); console.log('OK');
  process.stdout.write('  Connecting NEW ... '); const newConn = await mysql.createConnection(NEW_CFG); console.log('OK');

  try {
    /* ─── 1. SCHEMAS ────────────────────────────────────────────────── */
    header('1. SCHEMAS');
    const oldCols = await tableSchema(oldConn, OLD_CFG.database, OLD_TABLE);
    const newCols = await tableSchema(newConn, NEW_CFG.database, NEW_TABLE);
    if (!oldCols.length) { console.log(`  OLD ${OLD_TABLE} not found.`); return; }
    if (!newCols.length) { console.log(`  NEW ${NEW_TABLE} not found.`); return; }

    sub(`OLD ${OLD_TABLE}`); printSchema(OLD_TABLE, oldCols);
    sub(`NEW ${NEW_TABLE}`); printSchema(NEW_TABLE, newCols);

    /* ─── 2. SCHEMA DIFF ────────────────────────────────────────────── */
    header('2. SCHEMA DIFF');
    const oldNames = new Set(oldCols.map(c => c.COLUMN_NAME));
    const newNames = new Set(newCols.map(c => c.COLUMN_NAME));
    // case-insensitive map for matching
    const ciNew = new Map(newCols.map(c => [c.COLUMN_NAME.toLowerCase(), c]));
    const ciOld = new Map(oldCols.map(c => [c.COLUMN_NAME.toLowerCase(), c]));

    const onlyInOld = [...oldNames].filter(n => !ciNew.has(n.toLowerCase()));
    const onlyInNew = [...newNames].filter(n => !ciOld.has(n.toLowerCase()));
    console.log(`  Columns ONLY in OLD : ${onlyInOld.length ? onlyInOld.join(', ') : '(none)'}`);
    console.log(`  Columns ONLY in NEW : ${onlyInNew.length ? onlyInNew.join(', ') : '(none)'}`);

    const typeDrift = [];
    for (const o of oldCols) {
      const n = ciNew.get(o.COLUMN_NAME.toLowerCase());
      if (n && n.COLUMN_TYPE !== o.COLUMN_TYPE) {
        typeDrift.push({ col: o.COLUMN_NAME, old: o.COLUMN_TYPE, new: n.COLUMN_TYPE });
      }
    }
    if (typeDrift.length) {
      console.log('  Type drift:');
      for (const d of typeDrift) console.log(`    ${d.col.padEnd(28)} OLD=${d.old.padEnd(20)}  NEW=${d.new}`);
    } else {
      console.log('  Type drift: (none)');
    }

    /* ─── 3. ROW COUNTS ─────────────────────────────────────────────── */
    header('3. ROW COUNTS');
    const [{ n: oldTotal }]  = await ro(oldConn, `SELECT COUNT(*) AS n FROM \`${OLD_TABLE}\``);
    const [{ n: oldLive }]   = await ro(oldConn, `SELECT COUNT(*) AS n FROM \`${OLD_TABLE}\` WHERE (IsDelete = 0 OR IsDelete IS NULL)`);
    const [{ n: newTotal }]  = await ro(newConn, `SELECT COUNT(*) AS n FROM \`${NEW_TABLE}\``);
    const [{ n: newLive }]   = await ro(newConn, `SELECT COUNT(*) AS n FROM \`${NEW_TABLE}\` WHERE (IsDelete = 0 OR IsDelete IS NULL)`);
    console.log(`  OLD ${OLD_TABLE} total : ${pad(oldTotal)}`);
    console.log(`  OLD ${OLD_TABLE} live  : ${pad(oldLive)}`);
    console.log(`  NEW ${NEW_TABLE} total : ${pad(newTotal)}`);
    console.log(`  NEW ${NEW_TABLE} live  : ${pad(newLive)}`);

    /* ─── 4. ID OVERLAP ─────────────────────────────────────────────── */
    header('4. ID OVERLAP (by Batch_Id)');
    const [oldIds] = await oldConn.query(`SELECT Batch_Id FROM \`${OLD_TABLE}\``);
    const [newIds] = await newConn.query(`SELECT Batch_Id FROM \`${NEW_TABLE}\``);
    const oldSet = new Set(oldIds.map(r => Number(r.Batch_Id)));
    const newSet = new Set(newIds.map(r => Number(r.Batch_Id)));
    let inBoth = 0, onlyOld = 0, onlyNew = 0;
    for (const id of oldSet) if (newSet.has(id)) inBoth++; else onlyOld++;
    for (const id of newSet) if (!oldSet.has(id)) onlyNew++;
    console.log(`  In both (by Batch_Id) : ${pad(inBoth)}`);
    console.log(`  Only in OLD           : ${pad(onlyOld)}`);
    console.log(`  Only in NEW           : ${pad(onlyNew)} (likely batches created after the migration cutoff)`);

    if (onlyOld > 0) {
      const missing = [...oldSet].filter(id => !newSet.has(id)).slice(0, 25);
      console.log(`  First ${missing.length} Batch_Ids missing from NEW: ${missing.join(', ')}`);
    }
    if (onlyNew > 0) {
      const newer = [...newSet].filter(id => !oldSet.has(id)).slice(0, 25);
      console.log(`  First ${newer.length} Batch_Ids only in NEW: ${newer.join(', ')}`);
    }

    /* ─── 5. FIELD-BY-FIELD DRIFT ON OVERLAP ────────────────────────── */
    header('5. FIELD DRIFT ON OVERLAP (sample 200 batches present in both)');
    const sharedSample = [...oldSet].filter(id => newSet.has(id)).slice(0, 200);
    if (!sharedSample.length) {
      console.log('  (no overlap to compare)');
    } else {
      const placeholders = sharedSample.map(() => '?').join(',');
      const compareCols = oldCols
        .map(c => c.COLUMN_NAME)
        .filter(n => ciNew.has(n.toLowerCase()))
        .filter(n => !/^(IsDelete|IsActive|Cancel|created_by|updated_by|created_date|updated_date)$/i.test(n));
      const oldSelect = compareCols.map(c => `\`${c}\``).join(', ');
      const [oldRows] = await oldConn.query(
        `SELECT Batch_Id, ${oldSelect} FROM \`${OLD_TABLE}\` WHERE Batch_Id IN (${placeholders})`,
        sharedSample
      );
      const newColMap = new Map(newCols.map(c => [c.COLUMN_NAME.toLowerCase(), c.COLUMN_NAME]));
      const newSelect = compareCols.map(c => `\`${newColMap.get(c.toLowerCase())}\``).join(', ');
      const [newRows] = await newConn.query(
        `SELECT Batch_Id, ${newSelect} FROM \`${NEW_TABLE}\` WHERE Batch_Id IN (${placeholders})`,
        sharedSample
      );

      const newById = new Map(newRows.map(r => [Number(r.Batch_Id), r]));
      const drift = {};
      for (const c of compareCols) drift[c] = 0;
      let totalRowsCompared = 0;

      for (const o of oldRows) {
        const id = Number(o.Batch_Id);
        const n = newById.get(id);
        if (!n) continue;
        totalRowsCompared++;
        for (const c of compareCols) {
          const oldName = c;
          const newName = newColMap.get(c.toLowerCase());
          const ov = o[oldName];
          const nv = n[newName];
          const ovs = ov == null ? '' : String(ov).trim();
          const nvs = nv == null ? '' : String(nv).trim();
          if (ovs !== nvs) drift[c]++;
        }
      }

      console.log(`  Compared ${totalRowsCompared} batches across ${compareCols.length} columns.`);
      const rows = Object.entries(drift)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1]);
      if (!rows.length) {
        console.log('  No differences in any compared column. ✓');
      } else {
        console.log('  Columns with differing values (count of differing batches in sample):');
        for (const [col, n] of rows) {
          const pct = Math.round((n / totalRowsCompared) * 100);
          console.log(`    ${col.padEnd(28)} ${pad(n,4)} / ${totalRowsCompared}  (${pct}%)`);
        }
      }
    }

    /* ─── 6. SAMPLES OF DIFFERING ROWS ──────────────────────────────── */
    if (sharedSample.length) {
      header('6. SAMPLE — first 5 batches present in both, side-by-side');
      const sample5 = sharedSample.slice(0, 5);
      for (const id of sample5) {
        const [[o]] = [await oldConn.query(`SELECT * FROM \`${OLD_TABLE}\` WHERE Batch_Id = ? LIMIT 1`, [id])];
        const [[n]] = [await newConn.query(`SELECT * FROM \`${NEW_TABLE}\` WHERE Batch_Id = ? LIMIT 1`, [id])];
        sub(`Batch_Id = ${id}`);
        const ks = new Set([
          ...Object.keys(o[0] || {}),
          ...Object.keys(n[0] || {}),
        ]);
        for (const k of ks) {
          const ov = o[0]?.[k] ?? null;
          const nv = n[0]?.[k] ?? null;
          const same = String(ov ?? '') === String(nv ?? '') ? '   ' : ' ≠ ';
          console.log(`  ${same} ${k.padEnd(24)} OLD: ${String(ov ?? '').padEnd(30).slice(0,30)}  NEW: ${String(nv ?? '').slice(0,40)}`);
        }
      }
    }

    console.log('\n' + hr('═'));
    console.log('  Inspection complete.');
    console.log(hr('═') + '\n');
  } finally {
    await oldConn.end();
    await newConn.end();
  }
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
