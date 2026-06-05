#!/usr/bin/env node
/**
 * Migrate batch data from legacy DB to new DB.
 *
 * Tables migrated:
 *   1) Batch_Mst         -> batch_mst
 *   2) MST_BatchCategory -> mst_batchcategory
 *
 * Usage:
 *   node scripts/db/migrate-batch-from-legacy.mjs
 *   node scripts/db/migrate-batch-from-legacy.mjs --dry-run
 */

import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const BATCH_SIZE = 500;

const TABLES = [
  { oldPreferred: 'Batch_Mst', oldLower: 'batch_mst', newPreferred: 'batch_mst', newLower: 'batch_mst' },
  { oldPreferred: 'MST_BatchCategory', oldLower: 'mst_batchcategory', newPreferred: 'mst_batchcategory', newLower: 'mst_batchcategory' },
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function resolveTableName(pool, lowerName, preferredName) {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = ?
     ORDER BY CASE WHEN TABLE_NAME = ? THEN 0 ELSE 1 END
     LIMIT 1`,
    [lowerName, preferredName],
  );
  return String(rows[0]?.TABLE_NAME || '').trim() || null;
}

async function getColumns(pool, table) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME AS c, EXTRA AS extra
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [table],
  );
  return rows
    .filter((r) => !(r.extra ?? '').toLowerCase().includes('generated'))
    .map((r) => String(r.c));
}

async function getSharedColumns(oldPool, newPool, oldTable, newTable) {
  const oldCols = await getColumns(oldPool, oldTable);
  const newCols = await getColumns(newPool, newTable);
  const newLower = new Set(newCols.map((c) => c.toLowerCase()));
  return oldCols.filter((c) => newLower.has(c.toLowerCase()));
}

function buildUpsert(table, columns) {
  const cols = columns.map((c) => `\`${c}\``).join(', ');
  const updates = columns.map((c) => `\`${c}\`=VALUES(\`${c}\`)`).join(', ');
  return `INSERT INTO \`${table}\` (${cols}) VALUES ? ON DUPLICATE KEY UPDATE ${updates}`;
}

async function upsertRows(pool, table, columns, rows) {
  if (!rows.length) return 0;
  if (DRY_RUN) return rows.length;

  const sql = buildUpsert(table, columns);
  let written = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const values = chunk.map((row) => columns.map((c) => row[c] ?? null));
    await pool.query(sql, [values]);
    written += chunk.length;
  }

  return written;
}

async function migrateTable(oldPool, newPool, tableConfig) {
  const oldTable = await resolveTableName(oldPool, tableConfig.oldLower, tableConfig.oldPreferred);
  if (!oldTable) {
    console.log(`   Legacy table not found: ${tableConfig.oldPreferred} (or ${tableConfig.oldLower})`);
    return { table: tableConfig.oldPreferred, found: false, read: 0, written: 0 };
  }

  const newTable = await resolveTableName(newPool, tableConfig.newLower, tableConfig.newPreferred);
  if (!newTable) {
    throw new Error(`Target table not found: ${tableConfig.newPreferred}`);
  }

  const columns = await getSharedColumns(oldPool, newPool, oldTable, newTable);
  if (!columns.length) {
    console.log(`   No shared columns for ${oldTable} -> ${newTable}, skipping.`);
    return { table: `${oldTable} -> ${newTable}`, found: true, read: 0, written: 0 };
  }

  const colsSql = columns.map((c) => `\`${c}\``).join(', ');
  const [rows] = await oldPool.query(`SELECT ${colsSql} FROM \`${oldTable}\``);
  console.log(`   Read ${rows.length} row(s) from legacy ${oldTable}`);

  const written = await upsertRows(newPool, newTable, columns, rows);
  console.log(`   ${DRY_RUN ? '[dry-run] would upsert' : 'Upserted'} ${written} row(s) into ${newTable}`);

  return { table: `${oldTable} -> ${newTable}`, found: true, read: rows.length, written };
}

async function main() {
  console.log('=== Legacy -> New batch migration ===');
  console.log(`Dry run: ${DRY_RUN}`);

  const oldPool = await mysql.createPool({
    host: requireEnv('OLD_DB_HOST'),
    port: Number(process.env.OLD_DB_PORT || 3306),
    user: requireEnv('OLD_DB_USER'),
    password: requireEnv('OLD_DB_PASSWORD'),
    database: requireEnv('OLD_DB_NAME'),
    waitForConnections: true,
    connectionLimit: 5,
    dateStrings: true,
  });

  const newPool = await mysql.createPool({
    host: requireEnv('DB_HOST'),
    port: Number(process.env.DB_PORT || 3306),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
    waitForConnections: true,
    connectionLimit: 5,
    dateStrings: true,
  });

  try {
    const results = [];

    for (let i = 0; i < TABLES.length; i += 1) {
      const table = TABLES[i];
      console.log(`\n[${i + 1}/${TABLES.length}] Migrating ${table.oldPreferred}...`);
      const result = await migrateTable(oldPool, newPool, table);
      results.push(result);
    }

    const readTotal = results.reduce((acc, item) => acc + item.read, 0);
    const writeTotal = results.reduce((acc, item) => acc + item.written, 0);

    console.log('\n=== Batch migration complete ===');
    console.log(`Tables processed: ${results.length}`);
    console.log(`Rows read: ${readTotal}`);
    console.log(`${DRY_RUN ? 'Rows that would be written' : 'Rows written'}: ${writeTotal}`);
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

main().catch((err) => {
  console.error('\nFATAL:', err?.message || err);
  process.exit(1);
});
