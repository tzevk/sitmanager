/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

/** Lightweight student search for the "link CSV entry to a student manually" modal —
 * used when an alumni-portal row didn't auto-match anyone. Not the full Student Master
 * list query (no fees/admission joins), just enough to pick the right person. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'alumni.view');
    if (auth instanceof NextResponse) return auth;

    const q = req.nextUrl.searchParams.get('q')?.trim() || '';
    if (q.length < 2) {
      return NextResponse.json({ students: [] });
    }

    const pool = getPool();
    const like = `%${q}%`;
    const [rows] = await pool.query(
      `SELECT Student_Id, Student_Name, Batch_Code, Present_Mobile, Email
       FROM student_master
       WHERE (IsDelete = 0 OR IsDelete IS NULL)
         AND (Student_Name LIKE ? OR Present_Mobile LIKE ? OR Email LIKE ?)
       ORDER BY Student_Name
       LIMIT 20`,
      [like, like, like]
    );

    const students = (rows as any[]).map((r) => ({
      studentId: r.Student_Id,
      studentName: r.Student_Name,
      batchCode: r.Batch_Code,
      mobile: r.Present_Mobile,
      email: r.Email,
    }));

    return NextResponse.json({ students });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Alumni search-students error:', error);
    return NextResponse.json({ error: 'Failed to search students', details: message }, { status: 500 });
  }
}
