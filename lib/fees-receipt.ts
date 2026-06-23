import type { getPool } from '@/lib/db';

/**
 * Generate the next fee receipt number for the current month in the canonical
 * `R-MM/NNN` format (sequence zero-padded to at least 3 digits).
 *
 * This is the single source of truth for receipt codes. Both the manual
 * "Add Fee Receipt" flow and the online-admission (Razorpay / UPI / NEFT) flow
 * use it so every receipt shares the same monthly running sequence instead of
 * each path inventing its own code (e.g. the raw Fees_Id).
 *
 * Note: this reads-then-increments, so two receipts created at the exact same
 * instant could theoretically race — acceptable for the current volume and
 * matches the pre-existing manual behaviour.
 */
export async function generateFeesReceiptNo(pool: ReturnType<typeof getPool>): Promise<string> {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `R-${month}/`;
  const [rows] = await pool.query<any[]>(
    `SELECT Fees_Code
     FROM s_fees_mst
     WHERE Fees_Code LIKE ?
       AND CAST(SUBSTRING_INDEX(Fees_Code, '/', -1) AS UNSIGNED) > 0
       AND (IsDelete = 0 OR IsDelete IS NULL)
     ORDER BY Fees_Id DESC
     LIMIT 1`,
    [`${prefix}%`]
  );
  const previousSeqText = String(rows[0]?.Fees_Code ?? '').split('/').pop() ?? '';
  const lastSeq = Number(previousSeqText || 0);
  const nextSeq = lastSeq + 1;
  const width = Math.max(previousSeqText.length, 3);
  return `R-${month}/${String(nextSeq).padStart(width, '0')}`;
}
