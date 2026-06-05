/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { cached, getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

let _supportsStatementTimeout: boolean | null = null;
const STUDENT_COUNT_CACHE_TTL_MS = 30_000;
const COURSE_CACHE_TTL_MS = 10 * 60_000;

function withStatementTimeout(sql: string, seconds: number): string {
  const safeSeconds = Math.max(1, Math.min(30, Math.trunc(seconds)));
  return `SET STATEMENT max_statement_time=${safeSeconds} FOR ${sql}`;
}

async function runQuery(
  pool: ReturnType<typeof getPool>,
  sql: string,
  queryParams: (string | number)[] = [],
  timeoutSeconds?: number
) {
  const timeoutSql =
    timeoutSeconds && _supportsStatementTimeout !== false
      ? withStatementTimeout(sql, timeoutSeconds)
      : sql;
  try {
    return await pool.query<any[]>(timeoutSql, queryParams);
  } catch (error: any) {
    if (error?.code === 'PROTOCOL_CONNECTION_LOST') {
      return await getPool().query<any[]>(timeoutSql, queryParams);
    }
    if (timeoutSql !== sql && (error?.errno === 1969 || error?.sqlState === '70100')) {
      _supportsStatementTimeout = true;
      return await pool.query<any[]>(sql, queryParams);
    }
    if (timeoutSql !== sql && _supportsStatementTimeout !== false) {
      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('max_statement_time') || msg.includes('syntax')) {
        _supportsStatementTimeout = false;
        return await pool.query<any[]>(sql, queryParams);
      }
    }
    if (timeoutSql !== sql) _supportsStatementTimeout = true;
    throw error;
  }
}

// GET - fetch admitted students with pagination
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'student.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    const page   = Math.max(1, Number(searchParams.get('page'))  || 1);
    const limit  = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search    = searchParams.get('search')?.trim()    || '';
    const courseId  = searchParams.get('courseId')?.trim()  || '';
    const batchCode = searchParams.get('batchCode')?.trim() || '';
    const sex       = searchParams.get('sex')?.trim()       || '';
    const admittedOnlyRaw = (searchParams.get('admittedOnly') || '1').trim().toLowerCase();
    const admittedOnly = !['0', 'false', 'no', 'all'].includes(admittedOnlyRaw);

    const latestAdmissionSql = `
      SELECT MAX(Admission_Id) AS Admission_Id
      FROM admission_master
      WHERE (IsDelete = 0 OR IsDelete IS NULL)
        AND (Cancel = 0 OR Cancel IS NULL)
      GROUP BY Student_Id
    `;

    const allStudentFrom = `
      FROM student_master s
      LEFT JOIN (
        ${latestAdmissionSql}
      ) am_top ON am_top.Admission_Id IS NOT NULL
      LEFT JOIN admission_master am ON am.Admission_Id = am_top.Admission_Id AND am.Student_Id = s.Student_Id
      LEFT JOIN batch_mst b ON b.Batch_Id = am.Batch_Id
      LEFT JOIN course_mst c ON c.Course_Id = s.Course_Id
    `;

    const admittedStudentFrom = `
      FROM (
        ${latestAdmissionSql}
      ) am_top
      INNER JOIN admission_master am ON am.Admission_Id = am_top.Admission_Id
      INNER JOIN student_master s ON s.Student_Id = am.Student_Id
      LEFT JOIN batch_mst b ON b.Batch_Id = am.Batch_Id
      LEFT JOIN course_mst c ON c.Course_Id = COALESCE(am.Course_Id, s.Course_Id)
    `;

    const baseFrom = admittedOnly ? admittedStudentFrom : allStudentFrom;

    // ── WHERE ────────────────────────────────────────────────────────────────
    const conditions: string[] = ['(s.IsDelete = 0 OR s.IsDelete IS NULL)'];
    const params: (string | number)[] = [];

    if (admittedOnly) {
      conditions.push('(s.Status_id = 8 OR s.Status_id IS NULL)');
    }

    if (search) {
      const like = `%${search}%`;
      conditions.push(`(
        s.Student_Name LIKE ?
        OR s.FName LIKE ?
        OR s.Email LIKE ?
        OR s.Present_Mobile LIKE ?
        OR s.Batch_Code LIKE ?
        OR b.Batch_code LIKE ?
        OR CAST(am.Student_Code AS CHAR) LIKE ?
      )`);
      params.push(like, like, like, like, like, like, like);
    }

    if (courseId) {
      conditions.push('COALESCE(am.Course_Id, s.Course_Id) = ?');
      params.push(Number(courseId));
    }

    if (batchCode) {
      conditions.push('(s.Batch_Code = ? OR b.Batch_code = ?)');
      params.push(batchCode, batchCode);
    }

    if (sex) {
      conditions.push('s.Sex = ?');
      params.push(sex);
    }

    const where = conditions.join(' AND ');

    // ── Queries ──────────────────────────────────────────────────────────────
    const countCacheKey = `student:count:${where}:${JSON.stringify(params)}:${admittedOnly}`;
    const countPromise = cached(
      countCacheKey,
      STUDENT_COUNT_CACHE_TTL_MS,
      async () => {
        const [rows] = await runQuery(
          pool,
          `SELECT COUNT(*) AS total
           ${baseFrom}
           WHERE ${where}`,
          params,
          5
        );
        return Number((rows as any[])[0]?.total ?? 0);
      }
    );

    const rowsPromise = runQuery(
      pool,
      `SELECT
         s.Student_Id,
         am.Student_Code,
         COALESCE(NULLIF(TRIM(s.Student_Name), ''), CONCAT_WS(' ', s.FName, s.MName, s.LName)) AS Student_Name,
         s.DOB,
         s.Present_Address,
         s.Present_City,
         s.Email,
         s.Present_Mobile,
         s.Qualification,
         COALESCE(am.Course_Id, s.Course_Id) AS Course_Id,
         s.Sex,
         am.IsActive,
         am.Admission_Date,
         am.Payment_Type,
         am.Amount,
         COALESCE(NULLIF(TRIM(s.Batch_Code), ''), NULLIF(TRIM(b.Batch_code), '')) AS Batch_Code,
         COALESCE(NULLIF(TRIM(s.Batch_Code), ''), NULLIF(TRIM(b.Batch_code), '')) AS Batch_code_resolved,
         b.SDate        AS Batch_SDate,
         b.EDate        AS Batch_EDate,
         c.Course_Name
       ${baseFrom}
       WHERE ${where}
       ORDER BY COALESCE(am.Admission_Id, s.Student_Id) DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
      6
    );

    const coursesPromise = cached(
      'student:courses',
      COURSE_CACHE_TTL_MS,
      async () => {
        const [rows] = await runQuery(
          pool,
          `SELECT Course_Id, Course_Name FROM course_mst
           WHERE (IsDelete = 0 OR IsDelete IS NULL)
           ORDER BY Course_Name`
        );
        return rows as any[];
      }
    );

    const [[rows], courses] = await Promise.all([rowsPromise, coursesPromise]);

    // Count with 1.5 s timeout — fall back to estimate if slow
    let total: number;
    let totalIsEstimate = false;
    const counted = await Promise.race<number | null>([
      countPromise,
      new Promise<null>((r) => setTimeout(() => r(null), 1500)),
    ]);
    if (counted == null) {
      total = offset + (rows as any[]).length + ((rows as any[]).length === limit ? 1 : 0);
      totalIsEstimate = true;
    } else {
      total = counted;
    }

    return NextResponse.json({
      rows,
      courses,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), totalIsEstimate },
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
    console.error('Student DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
