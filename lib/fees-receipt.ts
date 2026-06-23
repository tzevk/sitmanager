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
  // Index-range scan over this month's receipts only (idx_sfees_code). We pull the
  // matching codes and compute the max sequence in JS rather than ORDER BY Fees_Id —
  // that ordering forced a full backward primary-key scan of the whole table.
  const [rows] = await pool.query<any[]>(
    `SELECT Fees_Code
     FROM s_fees_mst
     WHERE Fees_Code LIKE ?
       AND (IsDelete = 0 OR IsDelete IS NULL)`,
    [`${prefix}%`]
  );
  let lastSeq = 0;
  let seqWidth = 3;
  for (const r of rows) {
    const seqText = String(r.Fees_Code ?? '').split('/').pop() ?? '';
    const seq = Number(seqText);
    if (Number.isFinite(seq) && seq > lastSeq) {
      lastSeq = seq;
      seqWidth = Math.max(seqText.length, 3);
    }
  }
  const nextSeq = lastSeq + 1;
  return `R-${month}/${String(nextSeq).padStart(seqWidth, '0')}`;
}
