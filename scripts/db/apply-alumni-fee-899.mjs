/**
 * For each given batch code, find every student in that batch whose current
 * outstanding fee balance (same exact formula as lib/fee-balance.ts / Fee
 * Details / the Fee Report) is exactly 899, and record the one-time alumni
 * membership fee for them (Credit, no receipt number — same treatment as the
 * Fee Details "One Time Membership Fees - Sitians Alumni Association"
 * particular). Skips anyone who already has that fee recorded, and anyone
 * whose remaining balance isn't exactly 899.
 *
 * Runs directly — no dry run, no confirmation prompt (per explicit instruction).
 *
 * Usage: node scripts/db/apply-alumni-fee-899.mjs <batchCode> [batchCode...]
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const MEMBERSHIP_FEE_AMOUNT = 899;
const MEMBERSHIP_FEE_LABEL = 'One Time Membership Fees - Sitians Alumni Association';

const batchCodes = process.argv.slice(2);
if (!batchCodes.length) {
  console.error('Usage: node scripts/db/apply-alumni-fee-899.mjs <batchCode> [batchCode...]');
  process.exit(1);
}

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
       MAX(CASE WHEN TypeR = 'D' AND LOWER(IFNULL(Notes, '')) LIKE '%one time membership fees%' THEN 1 ELSE 0 END) AS has_membership_debit,
       MAX(CASE WHEN TypeR = 'C' AND LOWER(IFNULL(Notes, '')) LIKE '%one time membership fees%' THEN 1 ELSE 0 END) AS has_membership_credit
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
  return { balance: totalFees - paid, alreadyHasMembershipCredit: Boolean(Number(ledger.has_membership_credit ?? 0)) };
}

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  });

  let totalApplied = 0;

  for (const batchCode of batchCodes) {
    const [students] = await pool.query(
      `SELECT Student_Id, Student_Name FROM student_master
       WHERE Batch_Code = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
      [batchCode]
    );
    console.log(`\nBatch ${batchCode}: ${students.length} student(s)`);

    let applied = 0, skippedBalance = 0, skippedAlready = 0;

    for (const s of students) {
      const { balance, alreadyHasMembershipCredit } = await computeStudentFeeBalance(pool, s.Student_Id);
      if (alreadyHasMembershipCredit) { skippedAlready++; continue; }
      if (balance !== MEMBERSHIP_FEE_AMOUNT) { skippedBalance++; continue; }

      await pool.query(
        `INSERT INTO s_fees_mst
          (Student_Id, Amount, Total_Amt, TypeR, Notes, RDate, Date_Added, FeesMonth, FeesYear, IsDelete)
         VALUES (?, ?, ?, 'C', ?, CURDATE(), NOW(), MONTH(CURDATE()), YEAR(CURDATE()), 0)`,
        [s.Student_Id, MEMBERSHIP_FEE_AMOUNT, MEMBERSHIP_FEE_AMOUNT, MEMBERSHIP_FEE_LABEL]
      );
      console.log(`  Applied: Student ${s.Student_Id} (${s.Student_Name || ''})`);
      applied++;
    }

    console.log(`  -> applied: ${applied}, skipped (balance != 899): ${skippedBalance}, skipped (already recorded): ${skippedAlready}`);
    totalApplied += applied;
  }

  console.log(`\nTotal alumni fee entries applied: ${totalApplied}`);
  await pool.end();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
