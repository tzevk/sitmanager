/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Pool } from 'mysql2/promise';

export const MEMBERSHIP_FEE_LABEL = 'One Time Membership Fees - Sitians Alumni Association';
export const MEMBERSHIP_FEE_AMOUNT = 899;
export const DISCOUNT_LABEL = 'Discount';
export const FEE_WAIVER_LABEL = 'Fee Waived - Admission Cancelled';

const parseFee = (v: unknown): number => Number(String(v ?? '').replace(/,/g, '')) || 0;

/**
 * Batch tuition as a SQL expression. The batch's "Total Fees (INR)" (INR_Total)
 * is the only source of a batch's fee and already includes the ₹899 membership
 * fee, so tuition = INR_Total − 899. Every caller then adds the membership fee
 * back (or the posted membership debit), so the student's total equals
 * INR_Total + any other posted debits — never the membership fee twice.
 * Pass several aliases to fall back across batch joins (e.g. 'bm', 'bm2').
 */
export function batchTuitionSql(...aliases: string[]): string {
  const inr = aliases.map((a) => `NULLIF(CAST(REPLACE(IFNULL(${a}.INR_Total, ''), ',', '') AS DECIMAL(15,2)), 0)`);
  return `GREATEST(COALESCE(${inr.join(', ')}, 0) - ${MEMBERSHIP_FEE_AMOUNT}, 0)`;
}

/** JS twin of batchTuitionSql for rows that already carry INR_Total. */
export function batchTuitionFromInr(inrTotal: unknown): number {
  return Math.max(parseFee(inrTotal) - MEMBERSHIP_FEE_AMOUNT, 0);
}

/**
 * Same Total Fees / Total Paid formula used by /api/fee-details, the Fee
 * Report, and its Excel/PDF exports: admission fee (or batch Total Fees (INR)
 * tuition) + posted debits + the one-time membership fee, minus the full
 * payment ledger. Kept as a single source of truth so a new caller (e.g. the
 * admission-cancellation auto-waiver) can't silently drift from those.
 */
export async function computeStudentFeeBalance(
  pool: Pool,
  studentId: number
): Promise<{ totalFees: number; totalPaid: number; balance: number }> {
  const [feeRows] = await pool.query(
    `SELECT
       am.Fees AS Admission_Fees,
       ${batchTuitionSql('bm')} AS Resolved_Batch_Fee
     FROM student_master sm
     LEFT JOIN admission_master am
       ON am.Student_Id = sm.Student_Id AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
     LEFT JOIN batch_mst bm
       ON bm.Batch_code = sm.Batch_Code AND (bm.IsDelete = 0 OR bm.IsDelete IS NULL)
     WHERE sm.Student_Id = ?
     ORDER BY am.Admission_Id DESC
     LIMIT 1`,
    [studentId]
  ) as [any[], any];

  const [ledgerRows] = await pool.query(
    `SELECT
       SUM(CASE WHEN TypeR = 'C' THEN COALESCE(Total_Amt, Amount, 0) ELSE 0 END) AS paid,
       SUM(CASE WHEN TypeR = 'D' THEN COALESCE(Total_Amt, Amount, 0) ELSE 0 END) AS posted_debit,
       MAX(CASE WHEN TypeR = 'D' AND LOWER(IFNULL(Notes, '')) LIKE '%one time membership fees%' THEN 1 ELSE 0 END) AS has_membership_debit
     FROM s_fees_mst
     WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
    [studentId]
  ) as [any[], any];

  const feeRow = feeRows[0] ?? {};
  const ledger = ledgerRows[0] ?? {};
  const tuition = parseFee(feeRow.Admission_Fees) || Number(feeRow.Resolved_Batch_Fee) || 0;
  const postedDebit = Number(ledger.posted_debit ?? 0);
  const paid = Number(ledger.paid ?? 0);
  const membership = tuition > 0 && !Number(ledger.has_membership_debit ?? 0) ? MEMBERSHIP_FEE_AMOUNT : 0;

  const totalFees = tuition + postedDebit + membership;
  return { totalFees, totalPaid: paid, balance: totalFees - paid };
}
