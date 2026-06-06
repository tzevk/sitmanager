#!/usr/bin/env node
/**
 * Backfill missing fields for student/admission records from legacy DB.
 *
 * Only updates rows that ALREADY EXIST in the new DB (matched by primary key).
 * Never inserts new rows from legacy. Only fills columns that are currently
 * NULL or empty-string — existing values are NEVER overwritten.
 *
 * Tables:
 *   - student_master  (PK: Student_Id)
 *   - admission_master (PK: Admission_Id)
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
const BATCH_SIZE = 500;

// Tables and their primary key column names
const TABLE_PK = {
  student_master:   'Student_Id',
  admission_master: 'Admission_Id',
};

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function resolveTableName(pool, target, preferredExact) {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = ?
     ORDER BY CASE WHEN TABLE_NAME = ? THEN 0 ELSE 1 END
     LIMIT 1`,
    [target.toLowerCase(), preferredExact]
  );
  const tableName = String(rows[0]?.TABLE_NAME || '').trim();
  if (!tableName) throw new Error(`Table not found: ${target}`);
  return tableName;
}

async function getColumns(pool, table) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME AS c, EXTRA AS extra
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [table]
  );
  return rows
    .filter((r) => !(r.extra ?? '').toLowerCase().includes('generated'))
    .map((r) => String(r.c));
}

async function getSharedColumns(oldPool, newPool, oldTable, newTable) {
  const [oldCols, newCols] = await Promise.all([
    getColumns(oldPool, oldTable),
    getColumns(newPool, newTable),
  ]);
  const newLower = new Set(newCols.map((c) => c.toLowerCase()));
  return oldCols.filter((c) => newLower.has(c.toLowerCase()));
}

/**
 * For each legacy row whose PK exists in the new DB, UPDATE only the columns
 * that are currently NULL (or empty string for text columns) in the new DB.
 * Rows whose PK does not exist in the new DB are silently skipped.
 */
async function backfillExistingRows({ oldPool, newPool, oldTable, newTable, pkCol }) {
  const sharedColumns = await getSharedColumns(oldPool, newPool, oldTable, newTable);
  if (!sharedColumns.length) {
    console.log(`No shared columns for ${oldTable} -> ${newTable}, skipping.`);
    return { sourceRows: 0, updated: 0, skipped: 0, sharedColumns: 0 };
  }

  // Non-PK columns to potentially fill
  const fillColumns = sharedColumns.filter((c) => c.toLowerCase() !== pkCol.toLowerCase());
  if (!fillColumns.length) {
    console.log(`Only PK shared — nothing to fill.`);
    return { sourceRows: 0, updated: 0, skipped: 0, sharedColumns: sharedColumns.length };
  }

  const selectCols = sharedColumns.map((c) => `\`${c}\``).join(', ');
  const [legacyRows] = await oldPool.query(
    `SELECT ${selectCols} FROM \`${oldTable}\` ORDER BY \`${pkCol}\``
  );

  console.log(`  ${oldTable}: ${legacyRows.length} legacy rows — fetching existing PKs from new DB...`);

  // Load all PKs that exist in the new DB
  const [newPkRows] = await newPool.query(
    `SELECT \`${pkCol}\` FROM \`${newTable}\``
  );
  const existingPks = new Set(newPkRows.map((r) => String(r[pkCol])));
  console.log(`  ${newTable}: ${existingPks.size} existing rows in new DB`);

  // Filter to only legacy rows whose PK already exists
  const toUpdate = legacyRows.filter((r) => existingPks.has(String(r[pkCol])));
  const skipped = legacyRows.length - toUpdate.length;
  console.log(`  Matching: ${toUpdate.length} | Not in new DB (skipped): ${skipped}`);

  if (!toUpdate.length || DRY_RUN) {
    return { sourceRows: legacyRows.length, updated: DRY_RUN ? toUpdate.length : 0, skipped, sharedColumns: sharedColumns.length };
  }

  // Build a single UPDATE per row using COALESCE so existing values are preserved
  let updated = 0;
  const SET_PARTS = fillColumns
    .map((c) => `\`${c}\` = CASE WHEN (\`${c}\` IS NULL OR TRIM(CAST(\`${c}\` AS CHAR)) = '') THEN ? ELSE \`${c}\` END`)
    .join(', ');

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const chunk = toUpdate.slice(i, i + BATCH_SIZE);
    for (const row of chunk) {
      const params = fillColumns.map((c) => row[c] ?? null);
      params.push(row[pkCol]); // WHERE clause
      await newPool.query(
        `UPDATE \`${newTable}\` SET ${SET_PARTS} WHERE \`${pkCol}\` = ?`,
        params
      );
      updated++;
    }
    if (updated % 5000 === 0 || updated === toUpdate.length) {
      console.log(`  ${newTable}: updated ${updated}/${toUpdate.length}`);
    }
  }

  return { sourceRows: legacyRows.length, updated, skipped, sharedColumns: sharedColumns.length };
}

async function main() {
  console.log('=== Reimport student/admission from legacy ===');
  console.log(`Dry run: ${DRY_RUN}`);

  const oldPool = await mysql.createPool({
    host: requireEnv('OLD_DB_HOST'),
    port: Number(process.env.OLD_DB_PORT ?? 3306),
    user: requireEnv('OLD_DB_USER'),
    password: requireEnv('OLD_DB_PASSWORD'),
    database: requireEnv('OLD_DB_NAME'),
    waitForConnections: true,
    connectionLimit: 4,
    dateStrings: true,
  });

  const newPool = await mysql.createPool({
    host: requireEnv('DB_HOST'),
    port: Number(process.env.DB_PORT ?? 3306),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
    waitForConnections: true,
    connectionLimit: 4,
    dateStrings: true,
  });

  try {
    const oldStudent = await resolveTableName(oldPool, 'student_master', 'Student_Master');
    const oldAdmission = await resolveTableName(oldPool, 'admission_master', 'Admission_master');
    const newStudent = await resolveTableName(newPool, 'student_master', 'student_master');
    const newAdmission = await resolveTableName(newPool, 'admission_master', 'admission_master');

    console.log(`Source student table   : ${oldStudent}`);
    console.log(`Source admission table : ${oldAdmission}`);
    console.log(`Target student table   : ${newStudent}`);
    console.log(`Target admission table : ${newAdmission}`);

    console.log('\n[1/2] Backfill student_master (existing IDs only, fill nulls) ...');
    const studentStats = await backfillExistingRows({
      oldPool,
      newPool,
      oldTable: oldStudent,
      newTable: newStudent,
      pkCol: TABLE_PK.student_master,
    });

    console.log('\n[2/2] Backfill admission_master (existing IDs only, fill nulls) ...');
    const admissionStats = await backfillExistingRows({
      oldPool,
      newPool,
      oldTable: oldAdmission,
      newTable: newAdmission,
      pkCol: TABLE_PK.admission_master,
    });

    console.log('\n=== Done ===');
    console.log(JSON.stringify({
      dryRun: DRY_RUN,
      student_master: studentStats,
      admission_master: admissionStats,
    }, null, 2));
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

main().catch((error) => {
  console.error('FATAL:', error?.message || error);
  process.exit(1);
});
