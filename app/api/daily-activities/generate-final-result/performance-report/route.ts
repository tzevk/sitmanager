/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { buildPerformanceReport } from '@/lib/performance-report';

/**
 * Performance Report (F/TD/08/02) for one generated final result (genId).
 * Header details — result date and signatories — come from generate_final_result,
 * resolved against faculty_master exactly like the report-card route. All marks,
 * attendance and grades are calculated live (lib/performance-report.ts), so they
 * match the Final Exam report rather than the legacy generate_final_child snapshot.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'final_result.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const genId = parseInt(new URL(req.url).searchParams.get('genId') || '', 10);
    if (!genId) {
      return NextResponse.json({ error: 'genId is required' }, { status: 400 });
    }

    const [headerRows] = await pool.query(
      `SELECT gfr.Batch_Id,
              DATE_FORMAT(gfr.Result_date, '%Y-%m-%d') AS Result_date,
              gfr.Label1, gfr.Label2,
              fm1.Faculty_Name AS faculty1,
              fm2.Faculty_Name AS faculty2,
              ap.Faculty_Name  AS approve_by,
              cm.Course_Name, bm.Course_Description, bm.Batch_code
       FROM generate_final_result gfr
       LEFT JOIN course_mst cm  ON cm.Course_Id = gfr.Course_Id
       LEFT JOIN batch_mst bm   ON bm.Batch_Id = gfr.Batch_Id
       LEFT JOIN faculty_master fm1 ON fm1.Faculty_Id = gfr.Faculty1
       LEFT JOIN faculty_master fm2 ON fm2.Faculty_Id = gfr.Faculty2
       LEFT JOIN faculty_master ap  ON ap.Faculty_Id = gfr.Approve
       WHERE gfr.Id = ? AND (gfr.IsDelete = 0 OR gfr.IsDelete IS NULL)`,
      [genId]
    );
    const header = (headerRows as any[])[0];
    if (!header) {
      return NextResponse.json({ error: 'Final result not found' }, { status: 404 });
    }

    const report = await buildPerformanceReport(pool, Number(header.Batch_Id));
    if (!report || report.students.length === 0) {
      return NextResponse.json({ error: 'No students found for this batch' }, { status: 404 });
    }

    return NextResponse.json({ header, ...report });
  } catch (error: any) {
    console.error('Performance report GET error:', error);
    return NextResponse.json(
      { error: 'Failed to build performance report', details: error.message },
      { status: 500 }
    );
  }
}
