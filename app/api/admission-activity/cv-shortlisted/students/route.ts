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
         WHERE Course_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL) AND (Cancel = 0 OR Cancel IS NULL)
         ORDER BY Batch_Code DESC`,
        [courseId]
      );
      return NextResponse.json({ batches });
    }

    // Get students by batch
    if (batchCode) {
      const [students] = await pool.query<any[]>(
        `SELECT Student_Id, Student_Name, Batch_Code
         FROM student_master
         WHERE Batch_Code = ? AND (IsDelete = 0 OR IsDelete IS NULL)
         ORDER BY Student_Name`,
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
