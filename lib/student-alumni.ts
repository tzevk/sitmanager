/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Pool } from 'mysql2/promise';

let alumniColumnReady = false;

/**
 * Ensure the student_master.Alumni_Registered column exists.
 * Stores the Sitians Alumni Association registration flag ('Yes' / 'No'),
 * set from the student-master "Alumni Registration" tab and aggregated by the
 * CBD dashboard "Alumni Registration Progress" widget.
 */
export async function ensureAlumniColumn(pool: Pool): Promise<void> {
  if (alumniColumnReady) return;

  const [existingCols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_master'
       AND COLUMN_NAME = 'Alumni_Registered'`
  ) as [any[], any];

  if ((existingCols as any[]).length === 0) {
    await pool.query(`ALTER TABLE student_master ADD COLUMN \`Alumni_Registered\` VARCHAR(3) NULL`);
  }

  alumniColumnReady = true;
}
