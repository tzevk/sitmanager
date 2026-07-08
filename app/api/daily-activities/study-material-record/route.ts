/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'study_material.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'courses';

    if (mode === 'courses') {
      const [courses] = await pool.query<any[]>(`
        SELECT Course_Id, Course_Name
        FROM course_mst
        WHERE (IsDelete = 0 OR IsDelete IS NULL)
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
           AND Batch_code IS NOT NULL
           AND TRIM(Batch_code) <> ''
         ORDER BY Batch_Id DESC`,
        [courseId]
      );
      return NextResponse.json({ success: true, batches }, {
        headers: { 'Cache-Control': 'private, max-age=60' },
      });
    }

    if (mode === 'students') {
      const batchId = Number(searchParams.get('batchId') || 0);
      if (!batchId) {
        return NextResponse.json({ success: false, error: 'Batch is required.' }, { status: 400 });
      }

      // One row per student (picks the most recent admission_master row when a
      // student has more than one for this batch), with the course fee total
      // taken from batch_mst and paid-so-far summed from s_fees_mst credit rows —
      // the same bulk, set-based pattern used by the batch-wise fees report
      // (avoids N+1 per-student fee lookups).
      const [rows] = await pool.query<any[]>(
        `SELECT
           a.Student_Id,
           COALESCE(NULLIF(TRIM(s.Student_Name), ''), TRIM(CONCAT_WS(' ', s.FName, s.LName)), CONCAT('Student #', s.Student_Id)) AS Student_Name,
           COALESCE(a.Admission_Date, s.Admission_Dt) AS Admission_Date,
           COALESCE(b.Fees_Full_Payment, b.Actual_Fees_Payment, 0) AS Total_Fee,
           COALESCE(paid.Paid_Amt, 0) AS Paid_Amt
         FROM (
           SELECT MAX(a2.Admission_Id) AS Admission_Id
           FROM admission_master a2
           WHERE a2.Batch_Id = ?
             AND (a2.IsDelete = 0 OR a2.IsDelete IS NULL)
             AND (a2.Cancel   = 0 OR a2.Cancel   IS NULL)
           GROUP BY a2.Student_Id
         ) picked
         JOIN admission_master a ON a.Admission_Id = picked.Admission_Id
         JOIN student_master s ON s.Student_Id = a.Student_Id
         JOIN batch_mst b ON b.Batch_Id = a.Batch_Id
         LEFT JOIN (
           SELECT Student_Id, SUM(COALESCE(Total_Amt, Amount, 0)) AS Paid_Amt
           FROM s_fees_mst
           WHERE Batch_Id = ?
             AND TypeR = 'C'
             AND (IsDelete = 0 OR IsDelete IS NULL)
           GROUP BY Student_Id
         ) paid ON paid.Student_Id = a.Student_Id
         WHERE (s.IsDelete = 0 OR s.IsDelete IS NULL)
         ORDER BY Student_Name ASC`,
        [batchId, batchId]
      );

      const students = rows.map((r) => ({
        studentId: r.Student_Id,
        studentName: r.Student_Name,
        admissionDate: r.Admission_Date,
        feesCompleted: Number(r.Total_Fee) <= 0 || Number(r.Paid_Amt) >= Number(r.Total_Fee),
      }));

      return NextResponse.json({ success: true, students });
    }

    return NextResponse.json({ success: false, error: 'Invalid mode.' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
