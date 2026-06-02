/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

let _inquiryTableCache: string | null = null;
async function resolveInquiryTableName(pool: ReturnType<typeof getPool>): Promise<string> {
  if (_inquiryTableCache) return _inquiryTableCache;
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND LOWER(TABLE_NAME) = 'student_inquiry'
     ORDER BY CASE WHEN TABLE_NAME = 'Student_Inquiry' THEN 0 ELSE 1 END
     LIMIT 1`
  );
  _inquiryTableCache = String((rows as any[])[0]?.TABLE_NAME || '').trim() || 'Student_Inquiry';
  return _inquiryTableCache;
}

// GET - fetch all students with pagination and search
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'student.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const inquiryTable = await resolveInquiryTableName(pool);
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';
    const courseId = searchParams.get('courseId')?.trim() || '';
    const sex = searchParams.get('sex')?.trim() || '';

    // Admitted-student filter — resolved via LEFT JOINs on pre-aggregated derived
    // tables rather than per-row correlated EXISTS, which caused full table scans.
    const admissionJoin = `
      LEFT JOIN (
        SELECT DISTINCT Student_Id FROM admission_master
        WHERE (IsDelete = 0 OR IsDelete IS NULL)
          AND (Cancel IS NULL OR LOWER(TRIM(CAST(Cancel AS CHAR))) IN ('no','0','false'))
      ) am ON am.Student_Id = s.Student_Id
      LEFT JOIN (
        SELECT DISTINCT Student_Id FROM \`${inquiryTable}\`
        WHERE (IsDelete = 0 OR IsDelete IS NULL)
          AND (
            OnlineState = 8
            OR IFNULL(admission_done, 0) = 2
            OR LOWER(TRIM(CAST(COALESCE(Admission,'') AS CHAR))) IN ('yes','y','1','true')
          )
      ) si_adm ON si_adm.Student_Id = s.Student_Id`;

    const admittedCondition = `(
      s.Status_id = 8
      OR LOWER(TRIM(CAST(COALESCE(s.Admission,'') AS CHAR))) IN ('yes','y','1','true')
      OR am.Student_Id IS NOT NULL
      OR si_adm.Student_Id IS NOT NULL
    )`;

    // Build WHERE clause
    const conditions: string[] = ['(s.IsDelete = 0 OR s.IsDelete IS NULL)', admittedCondition];
    const params: (string | number)[] = [];

    if (search) {
      const like = `%${search}%`;
      conditions.push(`(
        s.Student_Name LIKE ?
        OR CONCAT_WS(' ', s.FName, s.MName, s.LName) LIKE ?
        OR s.Email LIKE ?
        OR s.Present_Mobile LIKE ?
        OR s.Present_City LIKE ?
        OR s.Batch_Code LIKE ?
        OR CAST(s.Student_Id AS CHAR) LIKE ?
        OR EXISTS (
          SELECT 1
          FROM course_mst c2
          WHERE c2.Course_Id = s.Course_Id
            AND c2.Course_Name LIKE ?
        )
      )`);
      params.push(like, like, like, like, like, like, like, like);
    }

    if (courseId) {
      conditions.push(`s.Course_Id = ?`);
      params.push(Number(courseId));
    }

    if (sex) {
      conditions.push(`s.Sex = ?`);
      params.push(sex);
    }

    const where = conditions.join(' AND ');

    // Count — includes the admission JOINs so the admitted filter applies
    const countSql = `
      SELECT COUNT(*) AS total
      FROM student_master s
      ${admissionJoin}
      WHERE ${where}`;
    const [countRows] = await pool.query<any[]>(countSql, params);
    const total = countRows[0]?.total ?? 0;

    // Data with course join
    const dataSql = `
      SELECT
        s.Student_Id, s.Student_Name, s.FName, s.LName, s.MName,
        s.Qualification, s.Course_Id, s.Batch_Code, s.DOB, s.Sex, s.Nationality,
        s.Present_Address, s.Present_City, s.Present_State, s.Present_Country, s.Present_Pin, s.Present_Mobile,
        s.Email, s.IsActive,
        c.Course_Name
      FROM student_master s
      ${admissionJoin}
      LEFT JOIN course_mst c ON s.Course_Id = c.Course_Id
      WHERE ${where}
      ORDER BY s.Student_Id DESC
      LIMIT ? OFFSET ?`;
    const [rows] = await pool.query<any[]>(dataSql, [...params, limit, offset]);

    // Get courses for filter dropdown
    const [courses] = await pool.query<any[]>(`
      SELECT Course_Id, Course_Name FROM course_mst 
      WHERE (IsDelete = 0 OR IsDelete IS NULL)
      ORDER BY Course_Name
    `);

    return NextResponse.json({
      rows,
      courses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: unknown) {
    console.error('Student API error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - soft delete student
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'student.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await pool.query(`UPDATE student_master SET IsDelete = 1 WHERE Student_Id = ?`, [id]);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Student DELETE error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}
