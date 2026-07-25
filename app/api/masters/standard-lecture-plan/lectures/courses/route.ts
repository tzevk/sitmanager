/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'standard_lecture_plan.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim() || '';
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.max(1, Number(searchParams.get('limit')) || 20);
    const offset = (page - 1) * limit;

    const searchClause = search ? 'HAVING t.course_name LIKE ?' : '';
    const searchParam = search ? [`%${search}%`] : [];

    const [rows] = await pool.query<any[]>(
      `SELECT
         t.course_name AS courseName,
         c.Course_Code AS courseCode,
         c.Course_Id AS courseId,
         COUNT(*) AS lectureCount
       FROM standard_lecture_plan_template t
       LEFT JOIN course_mst c ON c.Course_Name = t.course_name
       GROUP BY t.course_name, c.Course_Code, c.Course_Id
       ${searchClause}
       ORDER BY t.course_name ASC
       LIMIT ? OFFSET ?`,
      [...searchParam, limit, offset]
    );

    const [countRows] = await pool.query<any[]>(
      `SELECT COUNT(*) AS total FROM (
         SELECT t.course_name
         FROM standard_lecture_plan_template t
         GROUP BY t.course_name
         ${search ? 'HAVING t.course_name LIKE ?' : ''}
       ) x`,
      searchParam
    );

    return NextResponse.json({ rows, total: countRows[0]?.total ?? rows.length, page, limit });
  } catch (err: unknown) {
    console.error('Standard Lecture Plan template courses API error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
