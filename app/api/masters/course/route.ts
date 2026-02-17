/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'course.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;

    const search = searchParams.get('search')?.trim() || '';
    const isActive = searchParams.get('isActive') || '';

    /* ---- Build WHERE ---- */
    const conditions: string[] = ['(IsDelete IS NULL OR IsDelete = 0)'];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(
        `(Course_Name LIKE ? OR Course_Code LIKE ? OR Introduction LIKE ?)`
      );
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    if (isActive !== '') {
      conditions.push('IsActive = ?');
      params.push(Number(isActive));
    }

    const where = conditions.join(' AND ');

    /* ---- Count ---- */
    const countSql = `
      SELECT COUNT(*) AS total
      FROM course_mst
      WHERE ${where}
    `;
    const [countRows] = await pool.query<any[]>(countSql, params);
    const total = countRows[0]?.total ?? 0;

    /* ---- Data ---- */
    const dataSql = `
      SELECT
        Course_Id,
        Course_Name,
        Course_Code,
        Introduction,
        IsActive
      FROM course_mst
      WHERE ${where}
      ORDER BY Course_Id DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query<any[]>(dataSql, [...params, limit, offset]);

    return NextResponse.json({
      rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: unknown) {
    console.error('Course API error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'course.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { Course_Name, Course_Code, Introduction, Eligibility, Basic_Subject, Objective, course_Preparation } = body;

    if (!Course_Name?.trim()) {
      return NextResponse.json({ error: 'Course Name is required' }, { status: 400 });
    }

    const sql = `
      INSERT INTO course_mst (Course_Name, Course_Code, Introduction, Eligibility, Basic_Subject, Objective, course_Preparation, IsActive)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `;
    const [result] = await pool.query<any>(sql, [
      Course_Name.trim(),
      Course_Code?.trim() || null,
      Introduction?.trim() || null,
      Eligibility?.trim() || null,
      Basic_Subject?.trim() || null,
      Objective?.trim() || null,
      course_Preparation?.trim() || null,
    ]);

    return NextResponse.json({ 
      success: true, 
      Course_Id: result.insertId,
      message: 'Course created successfully' 
    });
  } catch (err: unknown) {
    console.error('Course POST error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'course.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { Course_Id, Course_Name, Course_Code, Introduction, Eligibility, Basic_Subject, Objective, course_Preparation, IsActive } = body;

    if (!Course_Id) {
      return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
    }

    if (!Course_Name?.trim()) {
      return NextResponse.json({ error: 'Course Name is required' }, { status: 400 });
    }

    const sql = `
      UPDATE course_mst
      SET Course_Name = ?, Course_Code = ?, Introduction = ?, Eligibility = ?, Basic_Subject = ?, Objective = ?, course_Preparation = ?, IsActive = ?
      WHERE Course_Id = ?
    `;
    await pool.query(sql, [
      Course_Name.trim(),
      Course_Code?.trim() || null,
      Introduction?.trim() || null,
      Eligibility?.trim() || null,
      Basic_Subject?.trim() || null,
      Objective?.trim() || null,
      course_Preparation?.trim() || null,
      IsActive ?? 1,
      Course_Id,
    ]);

    return NextResponse.json({ 
      success: true, 
      message: 'Course updated successfully' 
    });
  } catch (err: unknown) {
    console.error('Course PUT error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'course.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
    }

    // Soft delete
    const sql = `
      UPDATE course_mst
      SET IsDelete = 1
      WHERE Course_Id = ?
    `;
    await pool.query(sql, [Number(id)]);

    return NextResponse.json({ 
      success: true, 
      message: 'Course deleted successfully' 
    });
  } catch (err: unknown) {
    console.error('Course DELETE error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}
