#!/usr/bin/env node
/**
 * Backfill student_master.Batch_Code from the student's active admission batch
 * (admission_master.Batch_Id -> batch_mst.Batch_code), but ONLY for students who
 * came through the online admission flow and were granted (OnlineState = 8).
 *
 * Why: the online-admission grant historically wrote the batch separately to
 * student_master and admission_master, so a few student_master rows drifted
 * (wrong batch, or leading-zero stripped e.g. "9066" vs "09066"). The admission
 * record holds the authoritative batch. This realigns student_master to it.
 *
 * Scope is intentionally narrow — online-admission-granted students only — so it
 * never touches the ~2k legacy students whose student_master.Batch_Code is the
 * correct (post-transfer) value while their admission points at an older batch.
 *
 * Usage:
 *   node scripts/db/backfill-online-admission-batch-code.mjs            # dry run (default)
 *   node scripts/db/backfill-online-admission-batch-code.mjs --apply    # actually write
 */

import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const APPLY = process.argv.slice(2).includes('--apply');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function main() {
  const pool = await mysql.createPool({
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
    // Candidates: online-admission-granted students whose stored Batch_Code differs
    // from their active admission's canonical batch code.
    const [rows] = await pool.query(
      `SELECT
         si.Inquiry_Id,
         sm.Student_Id,
         sm.Student_Name,
         sm.Batch_Code            AS current_batch,
         bm.Batch_code            AS admission_batch
       FROM online_admission_payload oap
       JOIN student_inquiry  si ON si.Inquiry_Id = oap.Inquiry_Id AND (si.IsDelete = 0 OR si.IsDelete IS NULL)
       JOIN student_master   sm ON sm.Student_Id = si.Student_Id  AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
       JOIN admission_master am ON am.Student_Id = sm.Student_Id  AND am.IsActive = 1 AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
                                AND (am.Cancel IS NULL OR LOWER(TRIM(am.Cancel)) NOT IN ('yes'))
       JOIN batch_mst        bm ON bm.Batch_Id = am.Batch_Id
       WHERE CAST(NULLIF(TRIM(si.OnlineState), '') AS UNSIGNED) = 8
         AND NULLIF(TRIM(bm.Batch_code), '') IS NOT NULL
         AND TRIM(COALESCE(sm.Batch_Code, '')) <> TRIM(bm.Batch_code)
       ORDER BY sm.Student_Id ASC`
    );

    console.log(`Mode: ${APPLY ? 'APPLY (will write)' : 'DRY RUN (no changes)'}`);
    console.log(`Candidates needing realignment: ${rows.length}\n`);

    if (rows.length) {
      console.table(
        rows.map((r) => ({
          Inquiry_Id: r.Inquiry_Id,
          Student_Id: r.Student_Id,
          Name: (r.Student_Name || '').slice(0, 28),
          'student_master (old)': r.current_batch ?? '(null)',
          'admission (new)': r.admission_batch,
        }))
      );
    }

    if (!APPLY) {
      console.log('\nDry run only — re-run with --apply to write these changes.');
      return;
    }

    let updated = 0;
    for (const r of rows) {
      const [res] = await pool.query(
        `UPDATE student_master SET Batch_Code = ?
         WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
        [r.admission_batch, r.Student_Id]
      );
      updated += res.affectedRows || 0;
    }
    console.log(`\nDone. Updated ${updated} student_master row(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
