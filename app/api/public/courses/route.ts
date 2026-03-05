import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

// Public endpoint — no auth required (used by online admission form)
export async function GET() {
  try {
    const pool = getPool();
    const [rows] = await pool.query<{ Course_Id: number; Course_Name: string }[]>(
      `SELECT Course_Id, Course_Name
       FROM course_mst
       WHERE IsActive = 1 AND (IsDelete IS NULL OR IsDelete = 0)
       ORDER BY Course_Name ASC`
    );
    return NextResponse.json({ success: true, courses: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
