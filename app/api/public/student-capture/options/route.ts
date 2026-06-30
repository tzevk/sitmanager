/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

function toInt(value: string | null): number | null {
  const parsed = Number(value || '');
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(req: NextRequest) {
  try {
    const pool = getPool();
    const batchId = toInt(new URL(req.url).searchParams.get('batchId'));

    if (batchId) {
      const [rows] = await pool.query(
        `SELECT DISTINCT
           sm.Student_Id,
           sm.Student_Name,
           COALESCE(sm.Present_Mobile, '') AS Present_Mobile,
           COALESCE(sm.Email, '') AS Email
         FROM admission_master am
         JOIN student_master sm ON sm.Student_Id = am.Student_Id
         WHERE am.Batch_Id = ?
           AND am.IsActive = 1
           AND am.IsDelete = 0
           AND (am.Cancel IS NULL OR LOWER(TRIM(am.Cancel)) NOT IN ('yes'))
           AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
         ORDER BY sm.Student_Name ASC`,
        [batchId]
      );

      return NextResponse.json({
        success: true,
        students: (rows as any[]).map((row) => ({
          id: Number(row.Student_Id),
          name: String(row.Student_Name || '').trim(),
          mobile: String(row.Present_Mobile || '').trim(),
          email: String(row.Email || '').trim(),
        })),
      });
    }

    const [rows] = await pool.query(
      `SELECT
         b.Batch_Id,
         b.Batch_code,
         COALESCE(c.Course_Name, '') AS Course_Name,
         COUNT(DISTINCT am.Student_Id) AS StudentCount
       FROM batch_mst b
       LEFT JOIN course_mst c ON c.Course_Id = b.Course_Id
       JOIN admission_master am
         ON am.Batch_Id = b.Batch_Id
        AND am.IsActive = 1
        AND am.IsDelete = 0
        AND (am.Cancel IS NULL OR LOWER(TRIM(am.Cancel)) NOT IN ('yes'))
       JOIN student_master sm
         ON sm.Student_Id = am.Student_Id
        AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
       WHERE (b.IsDelete = 0 OR b.IsDelete IS NULL)
         AND (b.Cancel IS NULL OR b.Cancel = 0)
       GROUP BY b.Batch_Id, b.Batch_code, c.Course_Name, b.Admission_Date, b.SDate, b.Date_Added
       ORDER BY COALESCE(b.IsActive, 0) DESC,
                COALESCE(b.Admission_Date, b.SDate, b.Date_Added) DESC,
                b.Batch_Id DESC
       LIMIT 250`
    );

    return NextResponse.json({
      success: true,
      batches: (rows as any[]).map((row) => ({
        id: Number(row.Batch_Id),
        code: String(row.Batch_code || '').trim(),
        course: String(row.Course_Name || '').trim(),
        studentCount: Number(row.StudentCount || 0),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load student capture options';
    console.error('Student capture options error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
