#!/usr/bin/env node
/**
 * Backfill missing phone numbers for Suvidya inquiry sync records.
 *
 * Targets records where:
 *   - suvidya_inquiry_sync.created_at >= --since date (default: 2026-05-27)
 *   - The linked inquiry has no Present_Mobile  OR  payload_json has a phone
 *     field the original sync missed (wrong field name)
 *
 * Usage:
 *   node scripts/db/backfill-suvidya-phone.mjs
 *   node scripts/db/backfill-suvidya-phone.mjs --since 2026-05-01
 *   node scripts/db/backfill-suvidya-phone.mjs --dry-run
 *   node scripts/db/backfill-suvidya-phone.mjs --all        # ignore date filter
 */

import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const args = process.argv.slice(2);
const DRY_RUN  = args.includes('--dry-run');
const ALL      = args.includes('--all');
const sinceIdx = args.indexOf('--since');
const SINCE    = sinceIdx !== -1 ? args[sinceIdx + 1] : '2026-05-27';

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

// Mirror the same multi-field phone extraction used in the live sync
function extractPhone(payload) {
  const raw =
    payload.phone        ??
    payload.mobile       ??
    payload.phone_number ??
    payload.contact      ??
    payload.contact_number ??
    payload.whatsapp     ??
    payload.whatsapp_number ??
    null;

  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;

  const digits = text.replace(/\D/g, '');
  if (!digits) return null;
  if (digits === '2147483647') return null;  // int32 overflow sentinel
  if (digits.length < 10 || digits.length > 15) return null;

  return /^\+?[0-9]+$/.test(text) ? text : digits;
}

async function main() {
  console.log('=== Suvidya Phone Number Backfill ===');
  console.log(`  Since   : ${ALL ? 'all records' : SINCE}`);
  console.log(`  Dry run : ${DRY_RUN}`);
  console.log('');

  const pool = await mysql.createPool({
    host:             requireEnv('DB_HOST'),
    port:             Number(process.env.DB_PORT ?? 3306),
    user:             requireEnv('DB_USER'),
    password:         requireEnv('DB_PASSWORD'),
    database:         requireEnv('DB_NAME'),
    waitForConnections: true,
    connectionLimit:  3,
  });

  try {
    // Resolve inquiry table name
    const [tableRows] = await pool.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND LOWER(TABLE_NAME) IN ('student_inquiry','studentinquiry')
       ORDER BY CASE WHEN TABLE_NAME = 'student_inquiry' THEN 0 ELSE 1 END
       LIMIT 1`
    );
    const inquiryTable = tableRows[0]?.TABLE_NAME;
    if (!inquiryTable) throw new Error('Could not find student_inquiry table');
    console.log(`Using inquiry table: ${inquiryTable}\n`);

    // Fetch sync records with their payload and current inquiry mobile
    const dateFilter = ALL ? '' : `AND s.created_at >= ?`;
    const dateParams = ALL ? [] : [SINCE];

    const [rows] = await pool.query(
      `SELECT
         s.id,
         s.inquiry_id,
         s.mobile         AS sync_mobile,
         s.payload_json,
         si.Present_Mobile AS current_mobile
       FROM suvidya_inquiry_sync s
       LEFT JOIN \`${inquiryTable}\` si ON si.Inquiry_Id = s.inquiry_id
       WHERE s.inquiry_id IS NOT NULL
         ${dateFilter}
       ORDER BY s.created_at DESC`,
      dateParams
    );

    console.log(`Found ${rows.length} sync record(s) to check\n`);

    let updated = 0;
    let skipped = 0;
    let noPhone = 0;
    let alreadyHad = 0;

    for (const row of rows) {
      const currentMobile = (row.current_mobile ?? '').toString().trim();

      // Parse payload to extract phone using all known field names
      let payload = {};
      try {
        payload = row.payload_json ? JSON.parse(row.payload_json) : {};
      } catch { /* corrupt JSON — skip */ }

      const extractedPhone = extractPhone(payload);

      // If inquiry already has a phone and it matches what we'd set, skip
      if (currentMobile && currentMobile === extractedPhone) {
        alreadyHad++;
        continue;
      }

      // If inquiry has a phone but payload has nothing better, skip
      if (currentMobile && !extractedPhone) {
        alreadyHad++;
        continue;
      }

      if (!extractedPhone) {
        noPhone++;
        console.log(`  [NO PHONE] sync_id=${row.id} inquiry_id=${row.inquiry_id} — no phone in payload`);
        continue;
      }

      if (currentMobile) {
        console.log(`  [UPDATE]  inquiry_id=${row.inquiry_id}  "${currentMobile}" → "${extractedPhone}"`);
      } else {
        console.log(`  [FILL]    inquiry_id=${row.inquiry_id}  (empty) → "${extractedPhone}"`);
      }

      if (!DRY_RUN) {
        await pool.query(
          `UPDATE \`${inquiryTable}\` SET Present_Mobile = ? WHERE Inquiry_Id = ? AND (Present_Mobile IS NULL OR Present_Mobile = '')`,
          [extractedPhone, row.inquiry_id]
        );
        // Also update the sync table's mobile column for future reference
        await pool.query(
          `UPDATE suvidya_inquiry_sync SET mobile = ? WHERE id = ?`,
          [extractedPhone, row.id]
        );
      }
      updated++;
    }

    console.log('\n=== Summary ===');
    console.log(`  Updated     : ${updated}`);
    console.log(`  Already OK  : ${alreadyHad}`);
    console.log(`  No phone    : ${noPhone}`);
    if (skipped) console.log(`  Skipped     : ${skipped}`);
    if (DRY_RUN && updated > 0) {
      console.log('\n[dry-run] No changes written. Re-run without --dry-run to apply.');
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('\nFATAL:', err?.message ?? err);
  process.exit(1);
});
