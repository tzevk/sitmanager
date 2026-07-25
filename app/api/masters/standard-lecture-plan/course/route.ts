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
      return NextResponse.json({ error: 'course is required' }, { status: 400 });
    }

    const [rows] = await pool.query<any[]>(
      `SELECT
        Course_Id,
        Course_Name,
        Course_Code,
        Eligibility,
        Introduction,
        Basic_Subject,
        Objective,
        course_Preparation,
        IsActive
      FROM course_mst
      WHERE Course_Name = ? AND (IsDelete IS NULL OR IsDelete = 0)
      LIMIT 1`,
      [course]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (err: unknown) {
    console.error('Standard Lecture Plan course lookup error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
