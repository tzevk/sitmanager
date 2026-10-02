/* eslint-disable @typescript-eslint/no-explicit-any */
import { cached } from '@/lib/db';

/** Read-only: whether final_exam_master.Attempt_No exists. For read paths (the
 * Student Portal) that must not alter schema — they fall back to the subject-name
 * rule when it's missing. Cached for an hour. */
export async function hasFinalExamAttemptColumn(pool: any): Promise<boolean> {
  return cached('schema:final_exam_master:has_attempt_no', 60 * 60 * 1000, async () => {
    const [rows] = await pool.query(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'final_exam_master' AND COLUMN_NAME = 'Attempt_No'
       LIMIT 1`
    );
    return (rows as any[]).length > 0;
  });
}

/** Adds final_exam_master.Attempt_No (nullable) once, same pattern as the other
 * runtime schema checks. Existing rows stay NULL and fall back to the subject name. */
export async function ensureFinalExamAttemptColumn(pool: any): Promise<void> {
  await cached('schema:final_exam_master:attempt_no', 60 * 60 * 1000, async () => {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'final_exam_master' AND COLUMN_NAME = 'Attempt_No'`
    );
    if ((rows as any[]).length === 0) {
      await pool.query('ALTER TABLE final_exam_master ADD COLUMN Attempt_No TINYINT NULL');
    }
    return true;
  });
}
