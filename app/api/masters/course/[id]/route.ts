import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pool = getPool();
    const { id } = await params;

    const sql = `
      SELECT
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
      WHERE Course_Id = ? AND (IsDelete IS NULL OR IsDelete = 0)
    `;
    const [rows] = await pool.query<any[]>(sql, [Number(id)]);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Course GET by ID error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
