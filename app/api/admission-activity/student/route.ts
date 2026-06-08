/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { cached, getPool, getLegacyPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

const COURSE_CACHE_TTL_MS = 10 * 60_000;

const STUDENT_SQL = (where: string) => `
  SELECT
    s.Student_Id,
    COALESCE(NULLIF(TRIM(s.Student_Name), ''), CONCAT_WS(' ', s.FName, s.MName, s.LName)) AS Student_Name,
    s.DOB,
    s.Email,
    s.Present_Mobile,
    s.Present_City,
    s.Qualification,
    COALESCE(NULLIF(s.Course_Id, 0), am.Course_Id) AS Course_Id,
    s.Sex,
    s.Batch_Code                  AS Batch_Code,
    COALESCE(NULLIF(TRIM(s.Batch_Code), ''), b.Batch_code) AS Batch_code_resolved,
    COALESCE(s.Admission_Dt, am.Admission_Date) AS Admission_Date,
    c.Course_Name,
    am.Student_Code,
    am.Payment_Type,
    am.Amount,
    am.IsActive,
    b.SDate                       AS Batch_SDate,
    b.EDate                       AS Batch_EDate
  FROM student_master s
  LEFT JOIN admission_master am
    ON am.Admission_Id = (
      SELECT MAX(am2.Admission_Id)
      FROM admission_master am2
      WHERE am2.Student_Id = s.Student_Id
        AND (am2.IsDelete = 0 OR am2.IsDelete IS NULL)
        AND (am2.Cancel   = 0 OR am2.Cancel   IS NULL)
    )
  LEFT JOIN course_mst c ON c.Course_Id = COALESCE(NULLIF(s.Course_Id, 0), am.Course_Id)
  LEFT JOIN batch_mst b ON b.Batch_Id = am.Batch_Id
  WHERE ${where}
  ORDER BY s.Student_Id DESC`;

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

    // ── Fetch new DB rows + legacy rows in parallel ───────────────────────
    const legacyPool = getLegacyPool();

    const [newRowsRaw, legacyRowsRaw] = await Promise.all([
      pool.query<any[]>(`${STUDENT_SQL(where)} LIMIT 5000`, params).then(([r]) => r),
      legacyPool
        ? legacyPool.query<any[]>(`${STUDENT_SQL(where)} LIMIT 5000`, params).then(([r]) => r).catch(() => [] as any[])
        : Promise.resolve([] as any[]),
    ]);

    // ── Deduplicate: legacy rows whose mobile already exists in new DB ─────
    const newMobiles = new Set(
      (newRowsRaw as any[]).map((r: any) => r.Present_Mobile).filter(Boolean)
    );
    const legacyOnly = (legacyRowsRaw as any[])
      .filter((r: any) => !r.Present_Mobile || !newMobiles.has(r.Present_Mobile))
      .map((r: any) => ({ ...r, _legacy: true }));

    // ── Merge: new DB first (already sorted DESC), then legacy-only ───────
    const allRows: any[] = [...(newRowsRaw as any[]), ...legacyOnly];
    const total = allRows.length;
    const rows  = allRows.slice(offset, offset + limit);

    // ── COURSES dropdown (cached) ─────────────────────────────────────────
    const courses = await cached(
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
    );

    return NextResponse.json({
      rows,
      courses,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), totalIsEstimate: false },
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
