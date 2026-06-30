import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

/* eslint-disable @typescript-eslint/no-explicit-any */

function fmtDMY(value: unknown): string {
  const raw = String(value ?? '').trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

/**
 * GET /api/id-cards/students?batchId=123
 * Returns the batch's course/code/validity plus its students (name + contact),
 * ready to pre-fill ID cards. A student belongs to the batch if their active
 * admission points at it, or their student_master.Batch_Code matches.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'student.view');
    if (auth instanceof NextResponse) return auth;

    const batchId = parseInt(new URL(req.url).searchParams.get('batchId') || '', 10);
    if (!Number.isInteger(batchId) || batchId <= 0) {
      return NextResponse.json({ error: 'Invalid batchId' }, { status: 400 });
    }

    const pool = getPool();

    const [batchRows] = await pool.query(
      `SELECT b.Batch_Id, b.Batch_code, b.EDate, c.Course_Name
       FROM batch_mst b
       LEFT JOIN course_mst c ON c.Course_Id = b.Course_Id
       WHERE b.Batch_Id = ? LIMIT 1`,
      [batchId]
    );
    const batch = (batchRows as any[])[0];
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });

    const batchCode = String(batch.Batch_code || '').trim();

    const [studentRows] = await pool.query(
      `SELECT DISTINCT sm.Student_Id, sm.Student_Name, sm.Present_Mobile
       FROM student_master sm
       LEFT JOIN admission_master am
         ON am.Student_Id = sm.Student_Id
        AND am.IsActive = 1 AND am.IsDelete = 0
        AND (am.Cancel IS NULL OR LOWER(TRIM(am.Cancel)) NOT IN ('yes'))
       WHERE (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
         AND (am.Batch_Id = ? OR (TRIM(sm.Batch_Code) <> '' AND sm.Batch_Code = ?))
       ORDER BY sm.Student_Name ASC`,
      [batchId, batchCode]
    );

    const students = (studentRows as any[]).map((r) => ({
      name: String(r.Student_Name || '').trim(),
      contactNo: String(r.Present_Mobile || '').trim(),
    }));

    return NextResponse.json({
      course: String(batch.Course_Name || '').trim(),
      batchCode,
      validUpto: fmtDMY(batch.EDate),
      students,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load batch students';
    console.error('ID card batch import error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
