/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Pool } from 'mysql2/promise';

let transferColumnsReady = false;

export async function ensureStudentTransferColumns(pool: Pool): Promise<void> {
  if (transferColumnsReady) return;

  const [existingCols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_master'`
  ) as [any[], any];

  const existing = new Set((existingCols as any[]).map((row) => String(row.COLUMN_NAME)));
  const required: Array<[string, string]> = [
    ['Transfered', 'VARCHAR(20) NULL'],
    ['Moved_To_Course_Id', 'INT NULL'],
    ['Moved_To_Batch_Code', 'VARCHAR(100) NULL'],
  ];

  const missing = required.filter(([column]) => !existing.has(column));
  if (missing.length > 0) {
    const clauses = missing.map(([column, definition]) => `ADD COLUMN \`${column}\` ${definition}`).join(', ');
    await pool.query(`ALTER TABLE student_master ${clauses}`);
  }

  transferColumnsReady = true;
}
