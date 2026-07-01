import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getPool } from '@/lib/db';
import { ensureStudentPhotoBlobColumns, getStudentPhotoDataUrl } from '@/lib/student-documents.server';

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
    await ensureStudentPhotoBlobColumns(pool);

    // Admission-first: start from admission_master (Batch_Id is indexed) and join
    // student_master by primary key. Avoids a full student_master scan.
    const [studentRows] = await pool.query(
      `SELECT sm.Student_Id, sm.Student_Name, sm.Present_Mobile
       FROM admission_master am
       JOIN student_master sm ON sm.Student_Id = am.Student_Id
       WHERE am.Batch_Id = ?
         AND am.IsActive = 1 AND am.IsDelete = 0
         AND (am.Cancel IS NULL OR LOWER(TRIM(am.Cancel)) NOT IN ('yes'))
         AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
         AND (sm.IsActive = 1 OR sm.IsActive IS NULL)
       ORDER BY sm.Student_Name ASC`,
      [batchId]
    );

    const students = await Promise.all((studentRows as any[]).map(async (r) => ({
      name: String(r.Student_Name || '').trim(),
      contactNo: String(r.Present_Mobile || '').trim(),
      photo: await getStudentPhotoDataUrl(Number(r.Student_Id)),
    })));

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
