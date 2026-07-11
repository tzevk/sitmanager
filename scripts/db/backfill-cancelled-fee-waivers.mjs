/**
 * One-time backfill: for every student whose admission is already marked
 * Cancelled, auto-waive any remaining fee balance the same way the
 * newly-added cancellation flow does going forward (see
 * app/api/admission-activity/student/[id]/route.ts + lib/fee-balance.ts).
 *
 * Skips students who already have a "Fee Waived - Admission Cancelled" credit
 * row, and students whose computed balance isn't positive.
 *
 * Usage:
 *   node scripts/db/backfill-cancelled-fee-waivers.mjs            # dry run (default)
 *   node scripts/db/backfill-cancelled-fee-waivers.mjs --apply     # actually insert
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const APPLY = process.argv.includes('--apply');
const MEMBERSHIP_FEE_AMOUNT = 899;
const FEE_WAIVER_LABEL = 'Fee Waived - Admission Cancelled';

const parseFee = (v) => Number(String(v ?? '').replace(/,/g, '')) || 0;

async function computeStudentFeeBalance(pool, studentId) {
  const [feeRows] = await pool.query(
    `SELECT
       am.Fees AS Admission_Fees,
       COALESCE(
         NULLIF(CAST(REPLACE(IFNULL(fs.actualfees, ''), ',', '') AS DECIMAL(15,2)), 0),
         NULLIF(CAST(REPLACE(IFNULL(fs.fullfees, ''), ',', '') AS DECIMAL(15,2)), 0),
         NULLIF(CAST(REPLACE(IFNULL(fs.total_inr, ''), ',', '') AS DECIMAL(15,2)), 0),
         NULLIF(CAST(REPLACE(IFNULL(bm.Actual_Fees_Payment, ''), ',', '') AS DECIMAL(15,2)), 0),
         NULLIF(CAST(REPLACE(IFNULL(bm.Fees_Full_Payment, ''), ',', '') AS DECIMAL(15,2)), 0),
         0
       ) AS Resolved_Batch_Fee
     FROM student_master sm
     LEFT JOIN admission_master am
       ON am.Student_Id = sm.Student_Id AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
     LEFT JOIN batch_mst bm
       ON bm.Batch_code = sm.Batch_Code AND (bm.IsDelete = 0 OR bm.IsDelete IS NULL)
     LEFT JOIN (
       SELECT batch_id, MAX(id) AS id FROM fees_structure
       WHERE deleted = 0 OR deleted IS NULL GROUP BY batch_id
     ) latest_fs ON latest_fs.batch_id = bm.Batch_Id
     LEFT JOIN fees_structure fs ON fs.id = latest_fs.id
     WHERE sm.Student_Id = ?
     ORDER BY am.Admission_Id DESC
     LIMIT 1`,
    [studentId]
  );
  const [ledgerRows] = await pool.query(
    `SELECT
       SUM(CASE WHEN TypeR = 'C' THEN COALESCE(Total_Amt, Amount, 0) ELSE 0 END) AS paid,
       SUM(CASE WHEN TypeR = 'D' THEN COALESCE(Total_Amt, Amount, 0) ELSE 0 END) AS posted_debit,
       MAX(CASE WHEN TypeR = 'D' AND LOWER(IFNULL(Notes, '')) LIKE '%one time membership fees%' THEN 1 ELSE 0 END) AS has_membership_debit
     FROM s_fees_mst
     WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
    [studentId]
  );
  const feeRow = feeRows[0] ?? {};
  const ledger = ledgerRows[0] ?? {};
  const tuition = parseFee(feeRow.Admission_Fees) || Number(feeRow.Resolved_Batch_Fee) || 0;
  const postedDebit = Number(ledger.posted_debit ?? 0);
  const paid = Number(ledger.paid ?? 0);
  const membership = tuition > 0 && !Number(ledger.has_membership_debit ?? 0) ? MEMBERSHIP_FEE_AMOUNT : 0;
  const totalFees = tuition + postedDebit + membership;
  return { totalFees, totalPaid: paid, balance: totalFees - paid };
}

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  });

  const [studentRows] = await pool.query(
    `SELECT DISTINCT sm.Student_Id, sm.Student_Name
     FROM admission_master am
     JOIN student_master sm ON sm.Student_Id = am.Student_Id
     WHERE LOWER(TRIM(CAST(am.Cancel AS CHAR))) IN ('yes','1','true')
       AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
       AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)`
  );

  console.log(`Cancelled students found: ${studentRows.length}`);

  let toWaive = 0, totalAmount = 0, alreadyWaived = 0, zeroBalance = 0, errors = 0;

  for (const s of studentRows) {
    try {
      const [existing] = await pool.query(
        `SELECT Fees_Id FROM s_fees_mst WHERE Student_Id = ? AND Notes = ? AND (IsDelete = 0 OR IsDelete IS NULL) LIMIT 1`,
        [s.Student_Id, FEE_WAIVER_LABEL]
      );
      if (existing.length) { alreadyWaived++; continue; }

      const { balance } = await computeStudentFeeBalance(pool, s.Student_Id);
      if (!(balance > 0)) { zeroBalance++; continue; }

      toWaive++;
      totalAmount += balance;

      if (APPLY) {
        await pool.query(
          `INSERT INTO s_fees_mst
            (Student_Id, Amount, Total_Amt, TypeR, Notes, RDate, Date_Added, FeesMonth, FeesYear, IsDelete)
           VALUES (?, ?, ?, 'C', ?, CURDATE(), NOW(), MONTH(CURDATE()), YEAR(CURDATE()), 0)`,
          [s.Student_Id, balance, balance, FEE_WAIVER_LABEL]
        );
      } else {
        console.log(`  [dry-run] Student ${s.Student_Id} (${s.Student_Name || ''}) -> waive ${balance}`);
      }
    } catch (err) {
      errors++;
      console.error(`  ERROR on student ${s.Student_Id}:`, err.message);
    }
  }

  console.log('---');
  console.log(`Already waived (skipped): ${alreadyWaived}`);
  console.log(`Zero/negative balance (skipped): ${zeroBalance}`);
  console.log(`${APPLY ? 'Waived' : 'Would waive'}: ${toWaive} students, total amount: ${totalAmount.toFixed(2)}`);
  console.log(`Errors: ${errors}`);
  if (!APPLY) console.log('\nDry run only — re-run with --apply to actually insert the waiver rows.');

  await pool.end();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
