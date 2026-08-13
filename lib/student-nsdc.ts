/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Pool } from 'mysql2/promise';

let nsdcColumnsReady = false;

export const NSDC_SOCIAL_CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS', 'Other'] as const;

/**
 * Ensure student_master.Aadhar_Number / Social_Category exist — standard NSDC
 * candidate-upload columns that had no home in the existing schema. Added lazily
 * (same convention as ensureAlumniColumn) rather than via a standalone migration.
 */
export async function ensureNsdcColumns(pool: Pool): Promise<void> {
  if (nsdcColumnsReady) return;

  const [existingCols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_master'
       AND COLUMN_NAME IN ('Aadhar_Number', 'Social_Category')`
  ) as [any[], any];

  const present = new Set((existingCols as any[]).map((c) => c.COLUMN_NAME));

  if (!present.has('Aadhar_Number')) {
    await pool.query(`ALTER TABLE student_master ADD COLUMN \`Aadhar_Number\` VARCHAR(20) NULL`);
  }
  if (!present.has('Social_Category')) {
    await pool.query(`ALTER TABLE student_master ADD COLUMN \`Social_Category\` VARCHAR(20) NULL`);
  }

  nsdcColumnsReady = true;
}
