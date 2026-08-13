/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { ensureNsdcColumns } from '@/lib/student-nsdc';

// GET — list students in NSDC candidate-format columns, paginated + searchable.
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'nsdc_format.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureNsdcColumns(pool);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';

    const where = ['(sm.IsDelete = 0 OR sm.IsDelete IS NULL)'];
    const params: (string | number)[] = [];
    if (search) {
      where.push('(sm.Student_Name LIKE ? OR sm.Present_Mobile LIKE ? OR sm.Email LIKE ? OR sm.Aadhar_Number LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    const whereClause = where.join(' AND ');

    const [rows, [countRows]] = await Promise.all([
      pool.query<any[]>(
        `SELECT
           sm.Student_Id,
           sm.Student_Name,
           sm.Father_Name,
           sm.Mother_Name,
           sm.Sex,
           sm.DOB,
           sm.Aadhar_Number,
           sm.Social_Category,
           sm.Present_Mobile,
           sm.Email,
           sm.Present_Address,
           sm.Present_City,
           sm.Present_State,
           sm.Present_Pin,
           sm.Qualification,
           sm.Batch_Code,
           sm.Admission_Dt,
           c.Course_Name
         FROM student_master sm
         LEFT JOIN course_mst c ON c.Course_Id = sm.Course_Id
         WHERE ${whereClause}
         ORDER BY sm.Student_Id DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ).then(([r]) => r),
      pool.query<any[]>(
        `SELECT COUNT(*) AS total FROM student_master sm WHERE ${whereClause}`,
        params
      ),
    ]);

    const total = (countRows as any[])[0]?.total || 0;

    return NextResponse.json({
      rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch NSDC format list';
    console.error('NSDC format GET error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
