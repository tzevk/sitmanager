/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

// GET - fetch students by batch for CV shortlisted form
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'cv_shortlisted.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    const batchCode = searchParams.get('batchCode');
    const courseId = searchParams.get('courseId');

    if (!batchCode && !courseId) {
      return NextResponse.json({ error: 'batchCode or courseId is required' }, { status: 400 });
    }

    // Get batches by course
    if (courseId && !batchCode) {
      const [batches] = await pool.query<any[]>(
        `SELECT Batch_Id, Batch_Code FROM batch_mst
         WHERE Course_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
         ORDER BY Batch_Code DESC`,
        [courseId]
      );
      return NextResponse.json({ batches });
    }

    // Get students by batch
    if (batchCode) {
      // student_master.Batch_Code is also set on inquiry-stage duplicates that
      // were never admitted, and the CV forms dedupe by name keeping the first
      // row — so within the same name, list the student actually admitted to
      // this batch first. Otherwise shortlist rows get saved against the stale
      // duplicate and never show on the real student's profile.
      const [students] = await pool.query<any[]>(
        `SELECT
           s.Student_Id,
           TRIM(s.Student_Name) AS Student_Name,
           s.Batch_Code
         FROM student_master s
         WHERE s.Batch_Code = ?
           AND (s.IsDelete = 0 OR s.IsDelete IS NULL)
           AND s.Student_Name IS NOT NULL
           AND TRIM(s.Student_Name) <> ''
         GROUP BY s.Student_Id, s.Batch_Code
         ORDER BY
           TRIM(s.Student_Name),
           EXISTS (
             SELECT 1
             FROM admission_master am
             JOIN batch_mst b ON b.Batch_Id = am.Batch_Id
             WHERE am.Student_Id = s.Student_Id
               AND b.Batch_code = s.Batch_Code
               AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
               AND (am.Cancel = 0 OR am.Cancel IS NULL)
           ) DESC,
           s.Student_Id DESC`,
        [batchCode]
      );
      return NextResponse.json({ students });
    }

    return NextResponse.json({ batches: [], students: [] });
  } catch (err: unknown) {
    console.error('CV Shortlisted Students GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
