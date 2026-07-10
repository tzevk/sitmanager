import type { Pool } from 'mysql2/promise';

// The company dropdown on the Add Cash Voucher form.
export const CASH_VOUCHER_COMPANIES = ['SUVIDYA', 'ACCENT'] as const;

let columnsReady = false;

export async function ensureCashVoucherColumns(pool: Pool): Promise<void> {
  if (columnsReady) return;

  // awt_cashvoucherchild (21,000+ rows) has no index on voucherid — every list-page
  // load was doing an unindexed join/lookup against the whole child table to total
  // up each voucher's line items, taking ~9.5s. Index it once.
  const [existingIdx] = await pool.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'awt_cashvoucherchild' AND COLUMN_NAME = 'voucherid'`
  ) as [Array<{ INDEX_NAME: string }>, unknown];
  if (!existingIdx.length) {
    await pool.query(`ALTER TABLE awt_cashvoucherchild ADD INDEX idx_cashvoucherchild_voucherid (voucherid, deleted)`);
  }

  columnsReady = true;
}

// Reproduces the real legacy numbering scheme exactly (Routes/account/GenerateVoucherNo.js:
// "C-{MM}/{seq}", a 3-digit 1-based counter scoped by YEAR/MONTH(created_date) — i.e. the
// row's insert timestamp, not the voucher's own displayed date field.
export async function generateVoucherNo(pool: Pool): Promise<string> {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');

  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM awt_cashvoucher
     WHERE deleted = 0 AND MONTH(created_date) = ? AND YEAR(created_date) = ?`,
    [now.getMonth() + 1, now.getFullYear()]
  ) as [Array<{ c: number }>, unknown];

  const seq = (rows[0]?.c ?? 0) + 1;
  return `C-${mm}/${String(seq).padStart(3, '0')}`;
}
