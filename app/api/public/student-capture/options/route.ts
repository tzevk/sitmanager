/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

function toInt(value: string | null): number | null {
  const parsed = Number(value || '');
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

const VISIBLE_BATCH_SQL = `
  (b.IsDelete = 0 OR b.IsDelete IS NULL)
  AND (b.Cancel IS NULL OR b.Cancel = 0)
`;

export async function GET(req: NextRequest) {
  try {
    const pool = getPool();
    const searchParams = new URL(req.url).searchParams;
    const batchId = toInt(searchParams.get('batchId'));
    const courseId = toInt(searchParams.get('courseId'));

    if (batchId) {
      // Collect unique Student_Ids from both sources via UNION (deduplicates by ID),
      // then join to student_master once. This avoids both the duplicate rows the
      // old UNION-of-full-rows caused and the per-row correlated scan EXISTS needs.
      const [rows] = await pool.query(
        `SELECT
           sm.Student_Id,
           sm.Student_Name,
           COALESCE(sm.Present_Mobile, '') AS Present_Mobile,
           COALESCE(sm.Email, '') AS Email
         FROM student_master sm
         JOIN (
           SELECT am.Student_Id
           FROM admission_master am
           JOIN batch_mst b ON b.Batch_Id = am.Batch_Id
           WHERE am.Batch_Id = ?
             AND am.IsActive = 1
             AND am.IsDelete = 0
             AND (am.Cancel IS NULL OR LOWER(TRIM(am.Cancel)) NOT IN ('yes'))
             AND ${VISIBLE_BATCH_SQL}
           UNION
           SELECT sm2.Student_Id
           FROM student_master sm2
           JOIN batch_mst b ON b.Batch_code = sm2.Batch_Code
           WHERE b.Batch_Id = ?
             AND ${VISIBLE_BATCH_SQL}
             AND (sm2.IsDelete = 0 OR sm2.IsDelete IS NULL)
         ) ids ON ids.Student_Id = sm.Student_Id
         WHERE (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
         ORDER BY sm.Student_Name ASC`,
        [batchId, batchId]
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

    if (courseId) {
      const [rows] = await pool.query(
        `SELECT
           b.Batch_Id,
           b.Batch_code,
           COALESCE(c.Course_Name, '') AS Course_Name,
           0 AS StudentCount
         FROM batch_mst b
         LEFT JOIN course_mst c ON c.Course_Id = b.Course_Id
         WHERE b.Course_Id = ?
           AND (b.IsDelete = 0 OR b.IsDelete IS NULL)
           AND (b.Cancel IS NULL OR b.Cancel = 0)
           AND ${VISIBLE_BATCH_SQL}
         ORDER BY COALESCE(b.IsActive, 0) DESC,
                  COALESCE(b.Admission_Date, b.SDate, b.Date_Added) DESC,
                  b.Batch_Id DESC
         LIMIT 250`,
        [courseId]
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
    }

    const [rows] = await pool.query(
      `SELECT
         c.Course_Id,
         COALESCE(c.Course_Name, '') AS Course_Name,
         COUNT(DISTINCT b.Batch_Id) AS BatchCount,
         0 AS StudentCount
       FROM batch_mst b
       JOIN course_mst c ON c.Course_Id = b.Course_Id
       WHERE (c.IsDelete = 0 OR c.IsDelete IS NULL)
         AND (b.IsDelete = 0 OR b.IsDelete IS NULL)
         AND (b.Cancel IS NULL OR b.Cancel = 0)
         AND ${VISIBLE_BATCH_SQL}
       GROUP BY c.Course_Id, c.Course_Name
       HAVING BatchCount > 0
       ORDER BY c.Course_Name ASC
       LIMIT 250`
    );

    return NextResponse.json({
      success: true,
      programs: (rows as any[]).map((row) => ({
        id: Number(row.Course_Id),
        name: String(row.Course_Name || '').trim(),
        batchCount: Number(row.BatchCount || 0),
        studentCount: Number(row.StudentCount || 0),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load student capture options';
    console.error('Student capture options error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
