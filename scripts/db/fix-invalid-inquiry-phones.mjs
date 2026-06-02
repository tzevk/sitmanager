#!/usr/bin/env node
import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const batchSizeIdx = args.indexOf('--batch-size');
const batchSizeArg = batchSizeIdx !== -1 ? args[batchSizeIdx + 1] : null;
const BATCH_SIZE = Math.min(1000, Math.max(1, Number(batchSizeArg || 200)));

const maxRowsIdx = args.indexOf('--max-rows');
const maxRowsArg = maxRowsIdx !== -1 ? args[maxRowsIdx + 1] : null;
const MAX_ROWS = maxRowsArg ? Math.max(1, Number(maxRowsArg)) : null;

const INVALID_PHONE_SENTINELS = new Set(['2147483647']);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function formatLimit(value) {
  return value == null ? 'all' : String(value);
}

async function resolveInquiryTableName(pool) {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND LOWER(TABLE_NAME) = 'student_inquiry'
     ORDER BY CASE WHEN TABLE_NAME = 'Student_Inquiry' THEN 0 ELSE 1 END
     LIMIT 1`
  );

  return String(rows[0]?.TABLE_NAME || '').trim() || 'student_inquiry';
}

async function countCandidates(pool, inquiryTable) {
  const sentinelValues = [...INVALID_PHONE_SENTINELS];
  const [inquiryRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM \`${inquiryTable}\`
     WHERE Present_Mobile IN (?)`,
    [sentinelValues]
  );
  const [syncRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM suvidya_inquiry_sync
     WHERE mobile IN (?)`,
    [sentinelValues]
  );

  return {
    inquiry: Number(inquiryRows[0]?.total || 0),
    sync: Number(syncRows[0]?.total || 0),
  };
}

async function loadCandidateIds(pool, tableName, idColumn, valueColumn, batchSize, remaining) {
  const limit = remaining == null ? batchSize : Math.min(batchSize, remaining);
  if (!isPositiveNumber(limit)) return [];

  const [rows] = await pool.query(
    `SELECT ${idColumn} AS id
     FROM \`${tableName}\`
     WHERE ${valueColumn} IN (?)
     ORDER BY ${idColumn}
     LIMIT ?`,
    [[...INVALID_PHONE_SENTINELS], limit]
  );

  return rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0);
}

async function clearBatch(pool, tableName, idColumn, valueColumn, ids) {
  if (ids.length === 0) return 0;

  const [result] = await pool.query(
    `UPDATE \`${tableName}\`
     SET ${valueColumn} = NULL
     WHERE ${idColumn} IN (?)
       AND ${valueColumn} IN (?)`,
    [ids, [...INVALID_PHONE_SENTINELS]]
  );

  return Number(result.affectedRows || 0);
}

async function repairTable(pool, tableName, idColumn, valueColumn, batchSize, maxRows, dryRun) {
  let processed = 0;
  let updated = 0;
  let batchCount = 0;

  while (maxRows == null || processed < maxRows) {
    const remaining = maxRows == null ? null : maxRows - processed;
    const ids = await loadCandidateIds(pool, tableName, idColumn, valueColumn, batchSize, remaining);
    if (ids.length === 0) break;

    batchCount += 1;
    processed += ids.length;

    if (!dryRun) {
      const changed = await clearBatch(pool, tableName, idColumn, valueColumn, ids);
      updated += changed;
    }

    console.log(
      `${dryRun ? 'Scanned' : 'Processed'} ${tableName} batch ${batchCount}: ${ids.length} rows`
    );

    if (ids.length < batchSize) break;
  }

  return { processed, updated, batchCount };
}

async function main() {
  const pool = await mysql.createPool({
    host: requireEnv('DB_HOST'),
    port: Number(process.env.DB_PORT ?? 3306),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
    waitForConnections: true,
    connectionLimit: 2,
    dateStrings: true,
  });

  try {
    const inquiryTable = await resolveInquiryTableName(pool);

    await pool.query('SET SESSION innodb_lock_wait_timeout = 5');

    console.log('=== Fix invalid inquiry phones ===');
    console.log(`Inquiry table : ${inquiryTable}`);
    console.log(`Dry run       : ${DRY_RUN}`);
    console.log(`Batch size    : ${BATCH_SIZE}`);
    console.log(`Max rows      : ${formatLimit(MAX_ROWS)}`);
    console.log(`Sentinels     : ${[...INVALID_PHONE_SENTINELS].join(', ')}`);

    const before = await countCandidates(pool, inquiryTable);
    console.log(`Before        : inquiry=${before.inquiry}, sync=${before.sync}`);

    const inquiryResult = await repairTable(
      pool,
      inquiryTable,
      'Inquiry_Id',
      'Present_Mobile',
      BATCH_SIZE,
      MAX_ROWS,
      DRY_RUN,
    );

    const syncRemainingBudget = MAX_ROWS == null
      ? null
      : Math.max(0, MAX_ROWS - inquiryResult.processed);

    const syncResult = await repairTable(
      pool,
      'suvidya_inquiry_sync',
      'id',
      'mobile',
      BATCH_SIZE,
      syncRemainingBudget,
      DRY_RUN,
    );

    const after = DRY_RUN ? before : await countCandidates(pool, inquiryTable);

    console.log(`Inquiry ${DRY_RUN ? 'scanned' : 'updated'} : ${DRY_RUN ? inquiryResult.processed : inquiryResult.updated}`);
    console.log(`Sync ${DRY_RUN ? 'scanned' : 'updated'}    : ${DRY_RUN ? syncResult.processed : syncResult.updated}`);
    console.log(`After          : inquiry=${after.inquiry}, sync=${after.sync}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('FATAL:', error?.message || error);
  process.exit(1);
});