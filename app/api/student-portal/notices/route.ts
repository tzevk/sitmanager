import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getStudentSession } from '@/app/api/student-portal/auth/session/route';

export async function GET(req: NextRequest) {
  try {
    const session = await getStudentSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    // Active window: no start date means "always started", no end date means
    // "never expires" — a notice only drops off once an end date has passed.
    const [rows] = await pool.query(
      `SELECT id, title, specification, startdate, enddate, created_date
       FROM awt_noticeboard
       WHERE deleted = 0
         AND (startdate IS NULL OR startdate = '' OR startdate <= CURDATE())
         AND (enddate IS NULL OR enddate = '' OR enddate >= CURDATE())
         AND specification IS NOT NULL AND specification <> ''
       ORDER BY COALESCE(startdate, created_date) DESC, id DESC
       LIMIT 50`
    );

    return NextResponse.json({ notices: rows });
  } catch (err: unknown) {
    console.error('Student portal notices GET error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
