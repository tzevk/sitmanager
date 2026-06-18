#!/usr/bin/env node
/**
 * Backfill batch convocation dates from the legacy DB into the current DB.
 *
 * Source: legacy Batch_Mst.ConvocationDate
 * Target: current batch_mst.ConvocationDate
 * Match : Batch_code
 *
 * Dry-run by default. Use --execute to write.
 *
 * Usage:
 *   node scripts/db/backfill-convocation-dates-from-legacy.mjs
 *   node scripts/db/backfill-convocation-dates-from-legacy.mjs --execute
 *   node scripts/db/backfill-convocation-dates-from-legacy.mjs --execute --newer
 *   node scripts/db/backfill-convocation-dates-from-legacy.mjs --execute --overwrite
 *   node scripts/db/backfill-convocation-dates-from-legacy.mjs --since 2025-01-01
 */

import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const OVERWRITE = args.includes('--overwrite');
const NEWER = args.includes('--newer');
const sinceIndex = args.indexOf('--since');
const SINCE = sinceIndex !== -1 ? args[sinceIndex + 1] : null;
const BATCH_SIZE = 200;

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function toISODate(value) {
  if (!value) return null;
  const text = String(value).slice(0, 10).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  if (text === '0000-00-00' || text === '1900-01-01') return null;
  return text;
}

function isNewer(legacyDate, currentDate) {
  if (!legacyDate) return false;
  if (!currentDate) return true;
  return legacyDate > currentDate;
}

async function resolveTable(pool, lowerName, preferredName) {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND LOWER(TABLE_NAME) = ?
     ORDER BY CASE WHEN TABLE_NAME = ? THEN 0 ELSE 1 END
     LIMIT 1`,
    [lowerName, preferredName],
  );
  const table = rows[0]?.TABLE_NAME;
  if (!table) throw new Error(`Table not found: ${preferredName}`);
  return table;
}

async function main() {
  console.log('=== Backfill convocation dates from legacy ===');
  console.log(`Execute   : ${EXECUTE}`);
  console.log(`Mode      : ${OVERWRITE ? 'overwrite all matching dates' : NEWER ? 'update when legacy date is newer' : 'fill missing target dates only'}`);
  console.log(`Since     : ${SINCE ?? 'all valid legacy dates'}`);
  console.log('');

  const oldPool = mysql.createPool({
    host: requireEnv('OLD_DB_HOST'),
    port: Number(process.env.OLD_DB_PORT || 3306),
    user: requireEnv('OLD_DB_USER'),
    password: requireEnv('OLD_DB_PASSWORD'),
    database: requireEnv('OLD_DB_NAME'),
    waitForConnections: true,
    connectionLimit: 1,
    maxIdle: 1,
    idleTimeout: 10_000,
    dateStrings: true,
  });

  const newPool = mysql.createPool({
    host: requireEnv('DB_HOST'),
    port: Number(process.env.DB_PORT || 3306),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
    waitForConnections: true,
    connectionLimit: 1,
    maxIdle: 1,
    idleTimeout: 10_000,
    dateStrings: true,
  });

  try {
    const [legacyBatchTable, currentBatchTable] = await Promise.all([
      resolveTable(oldPool, 'batch_mst', 'Batch_Mst'),
      resolveTable(newPool, 'batch_mst', 'batch_mst'),
    ]);

    console.log(`Legacy table : ${legacyBatchTable}`);
    console.log(`Current table: ${currentBatchTable}`);

    const sinceClause = SINCE ? 'AND ConvocationDate >= ?' : '';
    const legacyParams = SINCE ? [SINCE] : [];
    const [legacyRows] = await oldPool.query(
      `SELECT Batch_code, MAX(ConvocationDate) AS ConvocationDate
       FROM \`${legacyBatchTable}\`
       WHERE ConvocationDate IS NOT NULL
         AND ConvocationDate <> ''
         AND ConvocationDate <> '0000-00-00'
         AND ConvocationDate <> '1900-01-01'
         ${sinceClause}
       GROUP BY Batch_code
       ORDER BY MAX(ConvocationDate) DESC`,
      legacyParams,
    );

    const legacyByBatch = new Map();
    for (const row of legacyRows) {
      const batchCode = String(row.Batch_code ?? '').trim();
      const convocationDate = toISODate(row.ConvocationDate);
      if (batchCode && convocationDate) legacyByBatch.set(batchCode, convocationDate);
    }

    console.log(`Valid legacy batch dates: ${legacyByBatch.size}`);
    if (!legacyByBatch.size) return;

    const batchCodes = [...legacyByBatch.keys()];
    const currentByBatch = new Map();
    for (let i = 0; i < batchCodes.length; i += BATCH_SIZE) {
      const chunk = batchCodes.slice(i, i + BATCH_SIZE);
      const [rows] = await newPool.query(
        `SELECT Batch_Id, Batch_code, ConvocationDate
         FROM \`${currentBatchTable}\`
         WHERE Batch_code IN (?)`,
        [chunk],
      );
      for (const row of rows) {
        const batchCode = String(row.Batch_code ?? '').trim();
        if (!batchCode) continue;
        currentByBatch.set(batchCode, {
          batchId: Number(row.Batch_Id),
          currentDate: toISODate(row.ConvocationDate),
        });
      }
    }

    const updates = [];
    const missingInCurrent = [];
    const unchanged = [];

    for (const [batchCode, legacyDate] of legacyByBatch) {
      const current = currentByBatch.get(batchCode);
      if (!current) {
        missingInCurrent.push({ batchCode, legacyDate });
        continue;
      }

      const shouldUpdate = OVERWRITE
        ? current.currentDate !== legacyDate
        : NEWER
          ? isNewer(legacyDate, current.currentDate)
          : !current.currentDate;

      if (shouldUpdate) {
        updates.push({
          batchCode,
          batchId: current.batchId,
          from: current.currentDate,
          to: legacyDate,
        });
      } else {
        unchanged.push({ batchCode, currentDate: current.currentDate, legacyDate });
      }
    }

    console.log(`Matched current batches : ${currentByBatch.size}`);
    console.log(`Updates ${EXECUTE ? 'to apply' : 'that would apply'}: ${updates.length}`);
    console.log(`Missing in current DB   : ${missingInCurrent.length}`);
    console.log(`Unchanged/skipped       : ${unchanged.length}`);

    console.log('\nTop update candidates:');
    console.table(updates.slice(0, 20));

    if (!EXECUTE || !updates.length) {
      console.log(`\n${EXECUTE ? 'No updates needed.' : 'Dry run only. Re-run with --execute to update current DB.'}`);
      return;
    }

    let updated = 0;
    for (const row of updates) {
      const [result] = await newPool.query(
        `UPDATE \`${currentBatchTable}\`
         SET ConvocationDate = ?
         WHERE Batch_Id = ?`,
        [row.to, row.batchId],
      );
      updated += Number(result.affectedRows || 0);
    }

    console.log(`\nUpdated rows: ${updated}`);
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

main().catch((error) => {
  console.error('FATAL:', error?.message || error);
  process.exit(1);
});