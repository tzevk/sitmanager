#!/usr/bin/env node
/**
 * Backfill Present_Mobile in the new DB from the legacy DB, matched by Inquiry_Id.
 *
 * Only fills rows where Present_Mobile is NULL or empty in the new DB,
 * so it never overwrites a phone that was already set.
 *
 * Usage:
 *   node scripts/db/backfill-phones-from-legacy.mjs
 *   node scripts/db/backfill-phones-from-legacy.mjs --dry-run
 *   node scripts/db/backfill-phones-from-legacy.mjs --since 2026-05-27  # by Inquiry_Dt
 *   node scripts/db/backfill-phones-from-legacy.mjs --overwrite         # also replace wrong/short numbers
 */

import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const args      = process.argv.slice(2);
const DRY_RUN   = args.includes('--dry-run');
const OVERWRITE = args.includes('--overwrite');
const sinceIdx  = args.indexOf('--since');
const SINCE     = sinceIdx !== -1 ? args[sinceIdx + 1] : null;
const BATCH     = 500;

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function normalizePhone(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const digits = text.replace(/\D/g, '');
  if (!digits || digits === '2147483647') return null;
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

async function main() {
  console.log('=== Backfill phones from legacy DB ===');
  console.log(`  Dry run   : ${DRY_RUN}`);
  console.log(`  Overwrite : ${OVERWRITE}`);
  console.log(`  Since     : ${SINCE ?? 'all records'}`);
  console.log('');

  const oldPool = await mysql.createPool({
    host:             requireEnv('OLD_DB_HOST'),
    port:             Number(process.env.OLD_DB_PORT ?? 3306),
    user:             requireEnv('OLD_DB_USER'),
    password:         requireEnv('OLD_DB_PASSWORD'),
    database:         requireEnv('OLD_DB_NAME'),
    waitForConnections: true,
    connectionLimit:  3,
    dateStrings:      true,
  });

  const newPool = await mysql.createPool({
    host:             requireEnv('DB_HOST'),
    port:             Number(process.env.DB_PORT ?? 3306),
    user:             requireEnv('DB_USER'),
    password:         requireEnv('DB_PASSWORD'),
    database:         requireEnv('DB_NAME'),
    waitForConnections: true,
    connectionLimit:  3,
    dateStrings:      true,
  });

  try {
    // Resolve new DB inquiry table name
    const [tableRows] = await newPool.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND LOWER(TABLE_NAME) IN ('student_inquiry','studentinquiry')
       ORDER BY CASE WHEN TABLE_NAME = 'student_inquiry' THEN 0 ELSE 1 END LIMIT 1`
    );
    const newTable = tableRows[0]?.TABLE_NAME;
    if (!newTable) throw new Error('Cannot find student_inquiry in new DB');
    console.log(`New DB table : ${newTable}`);

    // Query both DBs in parallel to avoid connection idle-drop on either side
    const sinceClause = SINCE ? `AND STR_TO_DATE(LEFT(Inquiry_Dt,10),'%Y-%m-%d') >= '${SINCE}'` : '';
    const mobileCondition = OVERWRITE
      ? '1=1'
      : `(Present_Mobile IS NULL OR TRIM(Present_Mobile) = '' OR LENGTH(TRIM(REPLACE(Present_Mobile,'+',''))) < 10)`;

    const [[legacyRows], [newRows]] = await Promise.all([
      oldPool.query(
        `SELECT Inquiry_Id,
                NULLIF(TRIM(Present_Mobile), '')  AS m1,
                NULLIF(TRIM(Present_Mobile2), '') AS m2
         FROM Student_Inquiry
         WHERE (IsDelete = 0 OR IsDelete IS NULL)
           AND (NULLIF(TRIM(Present_Mobile),'') IS NOT NULL OR NULLIF(TRIM(Present_Mobile2),'') IS NOT NULL)
           ${sinceClause}
         ORDER BY Inquiry_Id`
      ),
      newPool.query(
        `SELECT Inquiry_Id, Present_Mobile
         FROM \`${newTable}\`
         WHERE (IsDelete = 0 OR IsDelete IS NULL)
           AND ${mobileCondition}
           ${SINCE ? `AND STR_TO_DATE(LEFT(Inquiry_Dt,10),'%Y-%m-%d') >= '${SINCE}'` : ''}
         ORDER BY Inquiry_Id`
      ),
    ]);

    console.log(`Legacy rows with phone : ${legacyRows.length}`);

    // Build a map: Inquiry_Id → best phone from legacy
    const phoneMap = new Map();
    for (const row of legacyRows) {
      const phone = normalizePhone(row.m1) ?? normalizePhone(row.m2);
      if (phone) phoneMap.set(Number(row.Inquiry_Id), phone);
    }
    console.log(`Valid phones extracted : ${phoneMap.size}`);

    // Build set of new DB IDs that need updating
    const newNeedsPhone = new Map(newRows.map(r => [Number(r.Inquiry_Id), (r.Present_Mobile ?? '').toString().trim()]));
    const ids = [...newNeedsPhone.keys()].filter(id => phoneMap.has(id));
    let updated = 0, skipped = 0;

    for (const id of ids) {
      const phone   = phoneMap.get(id);
      const current = newNeedsPhone.get(id) ?? '';
      if (!phone) { skipped++; continue; }

      console.log(`  [${OVERWRITE && current ? 'OVERWRITE' : 'FILL'}] Inquiry_Id=${id}  "${current || '(empty)'}" → "${phone}"`);

      if (!DRY_RUN) {
        await newPool.query(
          `UPDATE \`${newTable}\` SET Present_Mobile = ? WHERE Inquiry_Id = ?`,
          [phone, id]
        );
      }
      updated++;
    }

    console.log('\n=== Summary ===');
    console.log(`  Updated (would update) : ${updated}`);
    if (skipped) console.log(`  No legacy phone found  : ${skipped}`);
    if (DRY_RUN && updated > 0) {
      console.log('\n[dry-run] Re-run without --dry-run to apply changes.');
    }
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

main().catch(err => {
  console.error('\nFATAL:', err?.message ?? err);
  process.exit(1);
});
