/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'export_contacts.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'courses';

    if (mode === 'courses') {
      const [courses] = await pool.query<any[]>(`
        SELECT Course_Id, Course_Name
        FROM course_mst
        WHERE (IsDelete = 0 OR IsDelete IS NULL)
          AND (IsActive = 1 OR IsActive IS NULL)
        ORDER BY Course_Name
      `);
      return NextResponse.json({ success: true, courses }, {
        headers: { 'Cache-Control': 'private, max-age=60' },
      });
    }

    if (mode === 'batches') {
      const courseId = Number(searchParams.get('courseId') || 0);
      if (!courseId) return NextResponse.json({ success: true, batches: [] });

      const [batches] = await pool.query<any[]>(
        `SELECT Batch_Id, Batch_code, Category, Timings
         FROM batch_mst
         WHERE Course_Id = ?
           AND (IsDelete = 0 OR IsDelete IS NULL)
           AND (Cancel = 0 OR Cancel IS NULL)
         ORDER BY Batch_Id DESC`,
        [courseId]
      );
      return NextResponse.json({ success: true, batches }, {
        headers: { 'Cache-Control': 'private, max-age=60' },
      });
    }

    if (mode === 'contacts') {
      const batchId = Number(searchParams.get('batchId') || 0);
      if (!batchId) {
        return NextResponse.json({ success: false, error: 'Batch is required.' }, { status: 400 });
      }

      const [rows] = await pool.query<any[]>(
        `SELECT
           s.Student_Id,
           COALESCE(NULLIF(TRIM(s.Student_Name), ''), TRIM(CONCAT_WS(' ', s.FName, s.LName)), CONCAT('Student #', s.Student_Id)) AS Student_Name,
           COALESCE(NULLIF(TRIM(s.Present_Mobile), ''), NULLIF(TRIM(s.Present_Mobile2), '')) AS Mobile,
           COALESCE(NULLIF(TRIM(s.Email), ''), '') AS Email
         FROM (
           SELECT Student_Id, MIN(Admission_Id) AS Admission_Id
           FROM admission_master
           WHERE Batch_Id = ?
             AND (IsDelete = 0 OR IsDelete IS NULL)
             AND (Cancel = 0 OR Cancel IS NULL)
           GROUP BY Student_Id
         ) a
         JOIN student_master s ON s.Student_Id = a.Student_Id
         WHERE (s.IsDelete = 0 OR s.IsDelete IS NULL)
         ORDER BY Student_Name ASC, s.Student_Id ASC`,
        [batchId]
      );

      return NextResponse.json({ success: true, rows });
    }

    return NextResponse.json({ success: false, error: 'Invalid mode.' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
