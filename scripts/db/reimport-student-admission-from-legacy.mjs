#!/usr/bin/env node
/**
 * Backfill missing fields for student/admission records from legacy DB.
 *
 * - Only updates rows that ALREADY EXIST in the new DB (matched by primary key).
 * - Never inserts new rows from legacy.
 * - Only fills columns that are currently NULL or empty-string — existing values
 *   are NEVER overwritten.
 *
 * Usage:
 *   node scripts/db/reimport-student-admission-from-legacy.mjs --dry-run
 *   node scripts/db/reimport-student-admission-from-legacy.mjs
 */
import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const BATCH_SIZE = 200; // rows per multi-row UPDATE

function requireEnv(n) {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env var: ${n}`);
  return v;
}

async function resolveTable(pool, target, exact) {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)=?
     ORDER BY CASE WHEN TABLE_NAME=? THEN 0 ELSE 1 END LIMIT 1`,
    [target.toLowerCase(), exact]
  );
  const t = String(rows[0]?.TABLE_NAME || '').trim();
  if (!t) throw new Error(`Table not found: ${target}`);
  return t;
}

async function getCols(pool, table) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME c, EXTRA e FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION`,
    [table]
  );
  return rows.filter(r => !(r.e || '').toLowerCase().includes('generated')).map(r => String(r.c));
}

async function sharedCols(oldPool, newPool, oldT, newT) {
  const [oldC, newC] = await Promise.all([getCols(oldPool, oldT), getCols(newPool, newT)]);
  const set = new Set(newC.map(c => c.toLowerCase()));
  return oldC.filter(c => set.has(c.toLowerCase()));
}

/**
 * Build batched multi-row CASE/WHEN UPDATE for a chunk of rows.
 * Only updates cells that are currently NULL or blank in the target table.
 */
async function updateChunk(newPool, newTable, pkCol, fillCols, chunk) {
  if (!chunk.length) return 0;

  const pkVals = chunk.map(r => r[pkCol]);
  const pkPholder = pkVals.map(() => '?').join(',');

  // Fetch current values from new DB for only these rows
  const colSql = [pkCol, ...fillCols].map(c => `\`${c}\``).join(', ');
  const [currentRows] = await newPool.query(
    `SELECT ${colSql} FROM \`${newTable}\` WHERE \`${pkCol}\` IN (${pkPholder})`,
    pkVals
  );
  const currentByPk = new Map(currentRows.map(r => [String(r[pkCol]), r]));

  // Build individual UPDATE statements only for rows that need changes
  let count = 0;
  for (const legacyRow of chunk) {
    const pk = legacyRow[pkCol];
    const current = currentByPk.get(String(pk));
    if (!current) continue;

    const setClauses = [];
    const params = [];
    for (const col of fillCols) {
      const cur = current[col];
      const isBlank = cur === null || cur === undefined || String(cur).trim() === '';
      if (!isBlank) continue; // already has data — skip
      const legacyVal = legacyRow[col];
      if (legacyVal === null || legacyVal === undefined || String(legacyVal).trim() === '') continue; // legacy also blank
      setClauses.push(`\`${col}\` = ?`);
      params.push(legacyVal);
    }
    if (!setClauses.length) continue; // nothing to update for this row

    params.push(pk);
    await newPool.query(
      `UPDATE \`${newTable}\` SET ${setClauses.join(', ')} WHERE \`${pkCol}\` = ?`,
      params
    );
    count++;
  }
  return count;
}

async function backfill({ oldPool, newPool, oldTable, newTable, pkCol }) {
  const cols = await sharedCols(oldPool, newPool, oldTable, newTable);
  const fillCols = cols.filter(c => c.toLowerCase() !== pkCol.toLowerCase());
  if (!fillCols.length) {
    console.log(`  Nothing to fill.`);
    return { sourceRows: 0, actualUpdated: 0, skipped: 0 };
  }

  console.log(`  Reading legacy ${oldTable}...`);
  const selectCols = cols.map(c => `\`${c}\``).join(', ');
  const [legacy] = await oldPool.query(`SELECT ${selectCols} FROM \`${oldTable}\``);
  console.log(`  Legacy rows: ${legacy.length}`);

  const [pkRows] = await newPool.query(`SELECT \`${pkCol}\` FROM \`${newTable}\``);
  const pks = new Set(pkRows.map(r => String(r[pkCol])));
  console.log(`  Existing in new DB: ${pks.size}`);

  const toUpdate = legacy.filter(r => pks.has(String(r[pkCol])));
  const skipped = legacy.length - toUpdate.length;
  console.log(`  Matching: ${toUpdate.length} | Skipped (not in new DB): ${skipped}`);

  if (!toUpdate.length || DRY_RUN) {
    return { sourceRows: legacy.length, actualUpdated: DRY_RUN ? toUpdate.length : 0, skipped };
  }

  let processed = 0;
  let actualUpdated = 0;
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const chunk = toUpdate.slice(i, i + BATCH_SIZE);
    actualUpdated += await updateChunk(newPool, newTable, pkCol, fillCols, chunk);
    processed += chunk.length;
    if (processed % 5000 === 0 || processed === toUpdate.length) {
      console.log(`  ${newTable}: processed ${processed}/${toUpdate.length}, rows actually updated: ${actualUpdated}`);
    }
  }

  return { sourceRows: legacy.length, actualUpdated, skipped };
}

async function main() {
  console.log(`=== Backfill student/admission from legacy (existing IDs only, fill nulls) ===`);
  console.log(`Dry run: ${DRY_RUN}`);

  const oldPool = await mysql.createPool({
    host: requireEnv('OLD_DB_HOST'), port: Number(process.env.OLD_DB_PORT || 3306),
    user: requireEnv('OLD_DB_USER'), password: requireEnv('OLD_DB_PASSWORD'),
    database: requireEnv('OLD_DB_NAME'), waitForConnections: true, connectionLimit: 4, dateStrings: true,
  });
  const newPool = await mysql.createPool({
    host: requireEnv('DB_HOST'), port: Number(process.env.DB_PORT || 3306),
    user: requireEnv('DB_USER'), password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'), waitForConnections: true, connectionLimit: 4, dateStrings: true,
  });

  try {
    const [oldS, oldA, newS, newA] = await Promise.all([
      resolveTable(oldPool, 'student_master',   'Student_Master'),
      resolveTable(oldPool, 'admission_master',  'Admission_master'),
      resolveTable(newPool, 'student_master',   'student_master'),
      resolveTable(newPool, 'admission_master',  'admission_master'),
    ]);

    console.log(`\n[1/2] student_master (${oldS} -> ${newS})`);
    const s = await backfill({ oldPool, newPool, oldTable: oldS, newTable: newS, pkCol: 'Student_Id' });

    console.log(`\n[2/2] admission_master (${oldA} -> ${newA})`);
    const a = await backfill({ oldPool, newPool, oldTable: oldA, newTable: newA, pkCol: 'Admission_Id' });

    console.log('\n=== Done ===');
    console.log(JSON.stringify({ dryRun: DRY_RUN, student_master: s, admission_master: a }, null, 2));
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

main().catch(e => { console.error('FATAL:', e?.message || e); process.exit(1); });
