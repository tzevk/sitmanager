/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { cached, getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

const COURSE_CACHE_TTL_MS = 10 * 60_000;

const ADMISSION_JOIN = `
  INNER JOIN admission_master am ON am.Admission_Id = (
    SELECT MAX(am2.Admission_Id)
    FROM admission_master am2
    WHERE am2.Student_Id = s.Student_Id
      AND (am2.IsDelete = 0 OR am2.IsDelete IS NULL)
      AND (am2.Cancel   = 0 OR am2.Cancel   IS NULL)
  )
  LEFT JOIN course_mst c ON c.Course_Id = COALESCE(NULLIF(s.Course_Id, 0), am.Course_Id)
  LEFT JOIN batch_mst b ON b.Batch_Id = am.Batch_Id
`;

function buildConditions(search: string, courseId: string, batchCode: string, sex: string) {
  const conditions: string[] = [
    '(s.IsDelete = 0 OR s.IsDelete IS NULL)',
    '(s.Status_id = 8 OR s.Status_id IS NULL)',
  ];
  const params: (string | number)[] = [];

  if (search) {
    const like = `%${search}%`;
    conditions.push(`(
      s.Student_Name LIKE ?
      OR s.FName LIKE ?
      OR s.Email LIKE ?
      OR s.Present_Mobile LIKE ?
      OR s.Batch_Code LIKE ?
      OR CAST(s.Student_Id AS CHAR) LIKE ?
    )`);
    params.push(like, like, like, like, like, like);
  }
  if (courseId) { conditions.push('s.Course_Id = ?'); params.push(Number(courseId)); }
  if (batchCode) { conditions.push('s.Batch_Code = ?'); params.push(batchCode); }
  if (sex) { conditions.push('s.Sex = ?'); params.push(sex); }

  return { where: conditions.join(' AND '), params };
}

// GET - fetch admitted students with pagination
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'student.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    const page      = Math.max(1, Number(searchParams.get('page'))  || 1);
    const limit     = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset    = (page - 1) * limit;
    const search    = searchParams.get('search')?.trim()    || '';
    const courseId  = searchParams.get('courseId')?.trim()  || '';
    const batchCode = searchParams.get('batchCode')?.trim() || '';
    const sex       = searchParams.get('sex')?.trim()       || '';

    const { where, params } = buildConditions(search, courseId, batchCode, sex);

    const [rows, [countRows], courses] = await Promise.all([
      pool.query<any[]>(
        `SELECT
           s.Student_Id,
           COALESCE(NULLIF(TRIM(s.Student_Name), ''), CONCAT_WS(' ', s.FName, s.MName, s.LName)) AS Student_Name,
           s.Present_Mobile,
           am.Student_Code,
           c.Course_Name,
           COALESCE(s.Admission_Dt, am.Admission_Date) AS Admission_Date,
           COALESCE(NULLIF(TRIM(s.Batch_Code), ''), b.Batch_code) AS Batch_Code,
           am.Payment_Type,
           am.Amount,
           am.IsActive
         FROM student_master s
         ${ADMISSION_JOIN}
         WHERE ${where}
         ORDER BY s.Student_Id DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ).then(([r]) => r),
      pool.query<any[]>(
        `SELECT COUNT(*) AS total
         FROM student_master s
         ${ADMISSION_JOIN}
         WHERE ${where}`,
        params
      ),
      cached(
        'student:courses',
        COURSE_CACHE_TTL_MS,
        async () => {
          const [r] = await pool.query<any[]>(
            `SELECT Course_Id, Course_Name FROM course_mst
             WHERE (IsDelete = 0 OR IsDelete IS NULL)
             ORDER BY Course_Name`
          );
          return r as any[];
        }
      ),
    ]);

    const total = (countRows as any[])[0]?.total || 0;

    return NextResponse.json({
      rows,
      courses,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: unknown) {
    console.error('Student API error:', err);
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
