#!/usr/bin/env node
/**
 * Reimport student/admission records from legacy DB into current DB.
 *
 * This script is intentionally scoped to tables that power the Student page:
 * - student_master
 * - admission_master
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

function buildUpsert(table, columns) {
  const colSql = columns.map((c) => `\`${c}\``).join(', ');
  const updateSql = columns.map((c) => `\`${c}\`=VALUES(\`${c}\`)`).join(', ');
  return `INSERT INTO \`${table}\` (${colSql}) VALUES ? ON DUPLICATE KEY UPDATE ${updateSql}`;
}

async function upsertAllRows({ oldPool, newPool, oldTable, newTable }) {
  const sharedColumns = await getSharedColumns(oldPool, newPool, oldTable, newTable);
  if (!sharedColumns.length) {
    console.log(`No shared columns for ${oldTable} -> ${newTable}, skipping.`);
    return { sourceRows: 0, written: 0, sharedColumns: 0 };
  }

  const selectCols = sharedColumns.map((c) => `\`${c}\``).join(', ');
  const [sourceRows] = await oldPool.query(`SELECT ${selectCols} FROM \`${oldTable}\``);

  if (DRY_RUN) {
    return { sourceRows: sourceRows.length, written: sourceRows.length, sharedColumns: sharedColumns.length };
  }

  const upsertSql = buildUpsert(newTable, sharedColumns);
  let written = 0;
  for (let i = 0; i < sourceRows.length; i += BATCH_SIZE) {
    const chunk = sourceRows.slice(i, i + BATCH_SIZE);
    const values = chunk.map((row) => sharedColumns.map((col) => row[col] ?? null));
    await newPool.query(upsertSql, [values]);
    written += chunk.length;
    if (written % 5000 === 0 || written === sourceRows.length) {
      console.log(`  ${newTable}: ${written}/${sourceRows.length}`);
    }
  }

  return { sourceRows: sourceRows.length, written, sharedColumns: sharedColumns.length };
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

    console.log('\n[1/2] Reimport student_master ...');
    const studentStats = await upsertAllRows({
      oldPool,
      newPool,
      oldTable: oldStudent,
      newTable: newStudent,
    });

    console.log('\n[2/2] Reimport admission_master ...');
    const admissionStats = await upsertAllRows({
      oldPool,
      newPool,
      oldTable: oldAdmission,
      newTable: newAdmission,
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
