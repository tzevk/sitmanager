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
    const course = searchParams.get('course')?.trim() || '';

    if (!course) {
      return NextResponse.json({ rows: [] });
    }

    const [rows] = await pool.query<any[]>(
      `SELECT id, lecture_no, department, module, sub_topics, faculty, project_assignment
       FROM standard_lecture_plan_template
       WHERE course_name = ?
       ORDER BY lecture_no ASC`,
      [course]
    );

    return NextResponse.json({ rows });
  } catch (err: unknown) {
    console.error('Standard Lecture Plan template API error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'standard_lecture_plan.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const courseName = String(body?.course_name ?? '').trim();
    if (!courseName) {
      return NextResponse.json({ error: 'course_name is required' }, { status: 400 });
    }

    const [result] = await pool.query<any>(
      `INSERT INTO standard_lecture_plan_template
       (course_name, lecture_no, department, module, sub_topics, faculty, project_assignment, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        courseName,
        body.lecture_no ? Number(body.lecture_no) : null,
        body.department?.trim() || null,
        body.module?.trim() || null,
        body.sub_topics?.trim() || null,
        body.faculty?.trim() || null,
        body.project_assignment?.trim() || null,
      ]
    );

    return NextResponse.json({ success: true, insertId: result.insertId });
  } catch (err: unknown) {
    console.error('Standard Lecture Plan template POST error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'standard_lecture_plan.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await pool.query(
      `UPDATE standard_lecture_plan_template SET
         lecture_no = ?,
         department = ?,
         module = ?,
         sub_topics = ?,
         faculty = ?,
         project_assignment = ?
       WHERE id = ?`,
      [
        data.lecture_no ? Number(data.lecture_no) : null,
        data.department?.trim() || null,
        data.module?.trim() || null,
        data.sub_topics?.trim() || null,
        data.faculty?.trim() || null,
        data.project_assignment?.trim() || null,
        id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Standard Lecture Plan template PUT error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'standard_lecture_plan.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await pool.query(`DELETE FROM standard_lecture_plan_template WHERE id = ?`, [id]);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Standard Lecture Plan template DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
