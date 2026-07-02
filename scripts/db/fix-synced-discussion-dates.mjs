#!/usr/bin/env node
// Backfill for discussion rows created by the Suvidya inquiry sync.
//
// The sync used to insert the initial discussion with `date = CURDATE()` (the
// day the sync ran) instead of the inquiry's real date, so historical rows show
// the sync/current date. This resets each such discussion's `date` to the linked
// inquiry's Inquiry_Dt. Idempotent — only touches rows whose date is wrong.
//
// Usage:
//   node scripts/db/fix-synced-discussion-dates.mjs --dry-run
//   node scripts/db/fix-synced-discussion-dates.mjs
import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

// Sync-created discussions are created_by=1 and their text starts with this
// fixed prefix (see buildDiscussion in lib/services/suvidya-inquiry.service.ts).
const DISCUSSION_PREFIX = 'Imported from Suvidya';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
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
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM awt_inquirydiscussion d
     JOIN \`${inquiryTable}\` si ON si.Inquiry_Id = d.Inquiry_id
     WHERE d.created_by = 1
       AND d.discussion LIKE ?
       AND (d.deleted = 0 OR d.deleted IS NULL)
       AND si.Inquiry_Dt IS NOT NULL
       AND DATE(d.date) <> DATE(si.Inquiry_Dt)`,
    [`${DISCUSSION_PREFIX}%`]
  );
  return Number(rows[0]?.total || 0);
}

async function fixDates(pool, inquiryTable) {
  const [result] = await pool.query(
    `UPDATE awt_inquirydiscussion d
     JOIN \`${inquiryTable}\` si ON si.Inquiry_Id = d.Inquiry_id
     SET d.date = DATE(si.Inquiry_Dt)
     WHERE d.created_by = 1
       AND d.discussion LIKE ?
       AND (d.deleted = 0 OR d.deleted IS NULL)
       AND si.Inquiry_Dt IS NOT NULL
       AND DATE(d.date) <> DATE(si.Inquiry_Dt)`,
    [`${DISCUSSION_PREFIX}%`]
  );
  return Number(result.affectedRows || 0);
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

    console.log('=== Fix synced discussion dates ===');
    console.log(`Inquiry table : ${inquiryTable}`);
    console.log(`Dry run       : ${DRY_RUN}`);

    const before = await countCandidates(pool, inquiryTable);
    console.log(`Candidates    : ${before}`);

    if (DRY_RUN) {
      console.log(`Would update  : ${before}`);
    } else {
      const updated = await fixDates(pool, inquiryTable);
      const after = await countCandidates(pool, inquiryTable);
      console.log(`Updated       : ${updated}`);
      console.log(`Remaining     : ${after}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('FATAL:', error?.message || error);
  process.exit(1);
});
