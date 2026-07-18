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
      `SELECT id, assignment_no, assignment_name, description, input_documents,
              deliverable_produced, trainer, department
       FROM standard_assignment_list
       WHERE course_name = ?
       ORDER BY assignment_no ASC`,
      [course]
    );

    return NextResponse.json({ rows });
  } catch (err: unknown) {
    console.error('Standard Assignment List API error:', err);
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
    if (!String(body?.assignment_name ?? '').trim()) {
      return NextResponse.json({ error: 'assignment_name is required' }, { status: 400 });
    }

    const [result] = await pool.query<any>(
      `INSERT INTO standard_assignment_list
       (course_name, assignment_no, assignment_name, description, input_documents, deliverable_produced, trainer, department)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        courseName,
        body.assignment_no ? Number(body.assignment_no) : null,
        body.assignment_name?.trim() || null,
        body.description?.trim() || null,
        body.input_documents?.trim() || null,
        body.deliverable_produced?.trim() || null,
        body.trainer?.trim() || null,
        body.department?.trim() || null,
      ]
    );

    return NextResponse.json({ success: true, insertId: result.insertId });
  } catch (err: unknown) {
    console.error('Standard Assignment List POST error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
