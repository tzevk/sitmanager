import type { Pool } from 'mysql2/promise';

// The company dropdown on the Add Cash Voucher form.
export const CASH_VOUCHER_COMPANIES = ['SUVIDYA', 'ACCENT'] as const;

let columnsReady = false;

// awt_cashvoucher already exists (6,000+ real historical rows) but has no column
// for the opening cash balance the voucher was drawn against — add it lazily,
// same pattern used elsewhere in this codebase for evolving an existing table.
export async function ensureCashVoucherColumns(pool: Pool): Promise<void> {
  if (columnsReady) return;

  const [existingCols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'awt_cashvoucher'`
  ) as [Array<{ COLUMN_NAME: string }>, unknown];

  const existing = new Set(existingCols.map((row) => row.COLUMN_NAME));
  if (!existing.has('opening_balance')) {
    await pool.query(`ALTER TABLE awt_cashvoucher ADD COLUMN opening_balance DECIMAL(12,2) NULL`);
  }

  columnsReady = true;
}

// Reproduces the real, live numbering scheme found in the existing 6,450 rows of
// awt_cashvoucher: "C-{MM}/{seq}" where seq is a 3-digit, 1-based counter that
// resets every calendar month (scoped to year+month of the voucher's own date,
// not the whole table) — e.g. the 11th voucher dated in July 2025 is C-07/011,
// and the 11th one dated in July 2026 is also C-07/011 (a different, later row).
export async function generateVoucherNo(pool: Pool, dateStr: string): Promise<string> {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const mm = String(month).padStart(2, '0');

  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM awt_cashvoucher
     WHERE deleted = 0 AND YEAR(STR_TO_DATE(date, '%Y-%m-%d')) = ? AND MONTH(STR_TO_DATE(date, '%Y-%m-%d')) = ?`,
    [year, month]
  ) as [Array<{ c: number }>, unknown];

  const seq = (rows[0]?.c ?? 0) + 1;
  return `C-${mm}/${String(seq).padStart(3, '0')}`;
}
