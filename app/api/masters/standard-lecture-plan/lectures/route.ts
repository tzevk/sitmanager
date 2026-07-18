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
