/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Pool } from 'mysql2/promise';

let familyContactColumnReady = false;

/**
 * Ensure the student_master.Family_Contact column exists.
 * Captured on the online-admission form ("Emergency contact") but never had a
 * matching column on student_master, so it silently dropped out at conversion.
 */
export async function ensureFamilyContactColumn(pool: Pool): Promise<void> {
  if (familyContactColumnReady) return;

  const [existingCols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_master'
       AND COLUMN_NAME = 'Family_Contact'`
  ) as [any[], any];

  if ((existingCols as any[]).length === 0) {
    await pool.query(`ALTER TABLE student_master ADD COLUMN \`Family_Contact\` VARCHAR(100) NULL`);
  }

  familyContactColumnReady = true;
}
