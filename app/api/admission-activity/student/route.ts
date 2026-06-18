/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { ensureStudentTransferColumns } from '@/lib/student-transfer';

// Columns the "Select Search" dropdown can target → safe column mapping
const SEARCH_FIELDS: Record<string, string> = {
  studentId: 'sm.Student_Id',
  batchCode: "COALESCE(NULLIF(TRIM(sm.Batch_Code),''), bm.Batch_code)",
  name:      'sm.Student_Name',
  email:     'sm.Email',
  mobile:    'sm.Present_Mobile',
};

// Granted admissions only: active, admitted (Status_id=8) and NOT cancelled.
const BASE_WHERE = `am.IsDelete = 0 AND am.IsActive = 1 AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL) AND sm.Status_id = 8 AND (am.Cancel IS NULL OR LOWER(TRIM(am.Cancel)) NOT IN ('yes'))`;

// Paid fees per student = sum of credit (TypeR='C') entries in the fees ledger.
const FEES_JOIN = `LEFT JOIN (
  SELECT Student_Id, SUM(Amount) AS Paid
  FROM s_fees_mst
  WHERE TypeR = 'C' AND IsDelete = 0
  GROUP BY Student_Id
) fp ON fp.Student_Id = sm.Student_Id`;

function buildSearch(field: string, value: string) {
  if (!value) return { clause: '', params: [] as (string | number)[] };
  const like = `%${value}%`;
  const col = SEARCH_FIELDS[field];
  if (col) {
    // Numeric exact-ish for id, LIKE for the rest
    if (field === 'studentId') return { clause: `AND CAST(sm.Student_Id AS CHAR) LIKE ?`, params: [like] };
    return { clause: `AND ${col} LIKE ?`, params: [like] };
  }
  // No field selected → search across all of them
  return {
    clause: `AND (
      CAST(sm.Student_Id AS CHAR) LIKE ?
      OR COALESCE(NULLIF(TRIM(sm.Batch_Code),''), bm.Batch_code) LIKE ?
      OR sm.Student_Name LIKE ?
      OR sm.Email LIKE ?
      OR sm.Present_Mobile LIKE ?
    )`,
    params: [like, like, like, like, like],
  };
}

// GET - Student Master: students with an active admission (mirrors legacy getAllStudent)
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'student.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    await ensureStudentTransferColumns(pool);
    const { searchParams } = new URL(req.url);

    const page   = Math.max(1, Number(searchParams.get('page'))  || 1);
    const limit  = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const field  = searchParams.get('field')?.trim()  || '';
    const search = searchParams.get('search')?.trim() || '';

    const { clause, params } = buildSearch(field, search);

    const [rows, [countRows]] = await Promise.all([
      pool.query<any[]>(
        `SELECT
            am.Admission_Id,
           sm.Student_Id,
           COALESCE(NULLIF(TRIM(sm.Batch_Code), ''), bm.Batch_code) AS Batch_Code,
           sm.Student_Name,
           sm.Present_Address,
           sm.Email,
           sm.Present_Mobile,
           sm.Transfered,
           sm.Moved_To_Batch_Code,
           COALESCE(mtc.Course_Name, '') AS Moved_To_Course_Name,
           sm.IsActive,
           am.Payment_Type,
           COALESCE(bm.Fees_Full_Payment, bm2.Fees_Full_Payment) AS Total_Fees,
           COALESCE(fp.Paid, 0) AS Paid_Fees,
           (COALESCE(bm.Fees_Full_Payment, bm2.Fees_Full_Payment, 0) - COALESCE(fp.Paid, 0)) AS Balance_Fees
         FROM admission_master am
         JOIN student_master sm ON sm.Student_Id = am.Student_Id
         LEFT JOIN batch_mst bm ON bm.Batch_Id = am.Batch_Id
         LEFT JOIN batch_mst bm2 ON bm2.Batch_code = sm.Batch_Code AND (bm2.IsDelete = 0 OR bm2.IsDelete IS NULL)
         LEFT JOIN course_mst mtc ON mtc.Course_Id = sm.Moved_To_Course_Id
         ${FEES_JOIN}
         WHERE ${BASE_WHERE} ${clause}
         ORDER BY am.Admission_Id DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ).then(([r]) => r),
      pool.query<any[]>(
        `SELECT COUNT(*) AS total
         FROM admission_master am
         JOIN student_master sm ON sm.Student_Id = am.Student_Id
         LEFT JOIN batch_mst bm ON bm.Batch_Id = am.Batch_Id
         WHERE ${BASE_WHERE} ${clause}`,
        params
      ),
    ]);

    const total = (countRows as any[])[0]?.total || 0;

    return NextResponse.json({
      rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: unknown) {
    console.error('Student API error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH - toggle a student's Active status
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'student.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const id = Number(body?.id);
    const isActive = body?.isActive ? 1 : 0;
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    await pool.query('UPDATE student_master SET IsActive = ? WHERE Student_Id = ?', [isActive, id]);
    return NextResponse.json({ success: true, isActive });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - soft delete student
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'student.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    await pool.query('UPDATE student_master SET IsDelete = 1 WHERE Student_Id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
