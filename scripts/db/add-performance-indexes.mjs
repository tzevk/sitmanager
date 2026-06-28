#!/usr/bin/env node
/**
 * Migration: Add performance indexes on large legacy tables.
 *
 * These indexes were originally applied directly to the DB with no migration
 * file, so a schema rebuilt from scripts would silently lose them and regress
 * to full-table scans (which previously stampeded MariaDB and timed out the
 * fee-details Add/save flow — see project_fee_details_perf).
 *
 * Idempotent: each index is created only if it does not already exist
 * (MariaDB/MySQL has no portable `ADD INDEX IF NOT EXISTS`).
 *
 * Run: node scripts/db/add-performance-indexes.mjs
 */
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: '.env.local' });

const INDEXES = [
  {
    table: 'batch_mst',
    name: 'idx_batch_code',
    column: 'Batch_code',
    sql: 'ALTER TABLE batch_mst ADD INDEX idx_batch_code (Batch_code)',
    why: 'fee-details queries join batch_mst ON Batch_code (was type: ALL full scan)',
  },
  {
    table: 's_fees_mst',
    name: 'idx_sfees_student',
    column: 'Student_Id',
    sql: 'ALTER TABLE s_fees_mst ADD INDEX idx_sfees_student (Student_Id)',
    why: 'ledger query filters s_fees_mst WHERE Student_Id = ? (was full scan over ~50k rows)',
  },
  {
    table: 's_fees_mst',
    name: 'idx_sfees_code',
    column: 'Fees_Code',
    sql: 'ALTER TABLE s_fees_mst ADD INDEX idx_sfees_code (Fees_Code)',
    why: 'receipt-number generation range-scans s_fees_mst WHERE Fees_Code LIKE \'R-MM/%\'',
  },
];

async function indexExists(conn, dbName, table, name) {
  const [rows] = await conn.query(
    `SELECT 1
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?
      LIMIT 1`,
    [dbName, table, name]
  );
  return rows.length > 0;
}

async function main() {
  const dbName = process.env.DB_NAME;
  const pool = await mysql.createPool({
    host:               process.env.DB_HOST,
    port:               Number(process.env.DB_PORT || 3306),
    user:               process.env.DB_USER,
    password:           process.env.DB_PASSWORD,
    database:           dbName,
    waitForConnections: true,
    connectionLimit:    2,
    multipleStatements: false,
  });

  const conn = await pool.getConnection();
  try {
    for (const { table, name, sql, why } of INDEXES) {
      if (await indexExists(conn, dbName, table, name)) {
        console.log(`•  ${table}.${name} already exists — skipped`);
        continue;
      }
      await conn.query(sql);
      console.log(`✓  ${table}.${name} added (${why})`);
    }
    console.log('\nAll performance indexes present.');
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
