/**
 * Clean up genuine duplicate admission_master rows: same Student_Id + Batch_Id with
 * more than one active (IsDelete=0, IsActive=1) row. Found by reproducing the legacy
 * app's own "Total Student" count query (appp.js /nodeapp/getAllStudent countQuery:
 * COUNT(*) FROM Admission_master WHERE IsDelete=0 AND IsActive=1) against both DBs —
 * legacy = 17,649, ours (same logic) = 17,842. The gap is mostly legitimate new
 * admissions added since the last legacy sync, but 20 rows are real duplicates:
 *   - 17 groups where a student has 2-3 active admission rows for the SAME batch
 *     (one has a Roll_No allotted, the other(s) don't — leftover from a roll-number
 *     allotment / double-submit, not a real second enrollment).
 *   - 2 rows with Student_Id/Batch_Id both NULL (orphan junk, no student at all).
 *
 * Some "duplicate" rows have their OWN linked s_fees_mst / student_attendance rows
 * (payments/attendance recorded against that specific Admission_Id), so a bare
 * soft-delete would silently hide that history. Instead this script re-points those
 * child rows onto the row being kept, THEN soft-deletes (IsDelete=1) the duplicate —
 * no data is destroyed, nothing is orphaned.
 *
 * Usage:
 *   node scripts/db/dedupe-duplicate-admissions.mjs           (dry run)
 *   node scripts/db/dedupe-duplicate-admissions.mjs --apply   (writes)
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const apply = process.argv.includes('--apply');

// keepId -> [duplicate Admission_Ids to merge in and soft-delete]
const GROUPS = [
  [17695, [17749]],
  [17393, [17656]],
  [17397, [17655]],
  [17697, [17744]],
  [17696, [17743]],
  [17978, [17979]],
  [18040, [18041]],
  [1803,  [1805]],
  [1804,  [1806]],
  [13681, [15113, 15813]],
  [15057, [15800]],
  [15060, [15801]],
  [15334, [15448]],
  [15421, [15696]],
  [622,   [625]],
  [823,   [824]],
];

// Orphan rows with no Student_Id/Batch_Id at all — nothing to merge, just retire them.
const JUNK_IDS = [17762, 17763];

const CHILD_TABLES = ['s_fees_mst', 'student_attendance', 'fees_details', 'viva_moc_child'];

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  });

  console.log(`Mode: ${apply ? 'APPLY (writing)' : 'DRY-RUN (no writes)'}`);

  let totalReassigned = 0;
  let totalSoftDeleted = 0;

  for (const [keepId, dupIds] of GROUPS) {
    for (const dupId of dupIds) {
      for (const table of CHILD_TABLES) {
        const [rows] = await pool.query(`SELECT COUNT(*) c FROM \`${table}\` WHERE Admission_Id = ?`, [dupId]);
        const count = rows[0].c;
        if (count > 0) {
          console.log(`  ${table}: reassign ${count} row(s) from Admission_Id ${dupId} -> ${keepId}`);
          totalReassigned += count;
          if (apply) {
            await pool.query(`UPDATE \`${table}\` SET Admission_Id = ? WHERE Admission_Id = ?`, [keepId, dupId]);
          }
        }
      }
      console.log(`Soft-delete duplicate Admission_Id ${dupId} (kept ${keepId})`);
      totalSoftDeleted++;
      if (apply) {
        await pool.query(`UPDATE admission_master SET IsDelete = 1 WHERE Admission_Id = ?`, [dupId]);
      }
    }
  }

  for (const junkId of JUNK_IDS) {
    console.log(`Soft-delete orphan (no Student_Id/Batch_Id) Admission_Id ${junkId}`);
    totalSoftDeleted++;
    if (apply) {
      await pool.query(`UPDATE admission_master SET IsDelete = 1 WHERE Admission_Id = ?`, [junkId]);
    }
  }

  console.log(`\nTotal child rows reassigned: ${totalReassigned}`);
  console.log(`Total duplicate admission rows soft-deleted: ${totalSoftDeleted}`);

  const [[{ c: currentTotal }]] = await pool.query(
    `SELECT COUNT(*) c FROM admission_master WHERE IsDelete = 0 AND IsActive = 1`
  );
  const projected = apply ? currentTotal : currentTotal - totalSoftDeleted;
  console.log(`'Total Student' count (legacy formula) ${apply ? 'is now' : 'would become'}: ${projected}`);

  await pool.end();
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
