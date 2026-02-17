/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

// GET - fetch all students with pagination and search
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'student.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';
    const courseId = searchParams.get('courseId')?.trim() || '';
    const sex = searchParams.get('sex')?.trim() || '';

    // Build WHERE clause
    const conditions: string[] = ['(s.IsDelete = 0 OR s.IsDelete IS NULL)'];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(`(s.Student_Name LIKE ? OR s.Email LIKE ? OR s.Present_Mobile LIKE ? OR s.Present_City LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
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

    // Count
    const countSql = `SELECT COUNT(*) AS total FROM student_master s WHERE ${where}`;
    const [countRows] = await pool.query<any[]>(countSql, params);
    const total = countRows[0]?.total ?? 0;

    // Data with course join
    const dataSql = `
      SELECT 
        s.Student_Id, s.Student_Name, s.FName, s.LName, s.MName,
        s.Qualification, s.Course_Id, s.DOB, s.Sex, s.Nationality,
        s.Present_Address, s.Present_City, s.Present_State, s.Present_Country, s.Present_Pin, s.Present_Mobile,
        s.Email, s.IsActive,
        c.Course_Name
      FROM student_master s
      LEFT JOIN course_mst c ON s.Course_Id = c.Course_Id
      WHERE ${where}
      ORDER BY s.Student_Id DESC
      LIMIT ? OFFSET ?
    `;
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
