/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// List of admitted students for one batch — same Status_id = 8 definition the
// CBD dashboard's "Confirmed Admissions" count uses (see app/api/dashboard/route.ts),
// so the downloadable report always matches the number shown on the dashboard.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const batchCode = (searchParams.get('batchCode') || '').trim();
    if (!batchCode) {
      return NextResponse.json({ error: 'batchCode is required' }, { status: 400 });
    }

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT
         sm.Student_Id,
         sm.Student_Name,
         sm.Present_Mobile,
         sm.Email,
         sm.Batch_Code,
         COALESCE(c.Course_Name, '') AS Course_Name,
         sm.Admission_Dt,
         sm.Status_date
       FROM student_master sm
       LEFT JOIN course_mst c ON c.Course_Id = sm.Course_Id
       WHERE sm.Batch_Code = ?
         AND sm.Status_id = 8
         AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
       ORDER BY sm.Student_Name ASC`,
      [batchCode]
    ) as [any[], any];

    return NextResponse.json({ rows });
  } catch (error: unknown) {
    console.error('Batch admissions fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch admitted students' }, { status: 500 });
  }
}
