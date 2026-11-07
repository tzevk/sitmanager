/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getStudentSession } from '@/app/api/student-portal/auth/session/route';
import { getStudentPortalContext } from '@/lib/student-portal/context';

export async function GET(req: NextRequest) {
  try {
    const session = await getStudentSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const ctx = await getStudentPortalContext(pool, Number(session.studentId));
    const batchId = ctx?.batchId ?? 0;
    const courseId = ctx?.courseId ?? 0;
    // Targeting: batch_ids set -> only those batches; else course_ids set ->
    // only those programmes; neither -> everyone. Columns may not exist yet on
    // a DB where no notice has been saved since targeting shipped.
    const [cols] = await pool.query<any[]>(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'awt_noticeboard' AND COLUMN_NAME IN ('course_ids','batch_ids')`
    );
    const targeted = Number(cols?.[0]?.cnt ?? 0) === 2;
    const targetSql = targeted
      ? `AND (
           (batch_ids IS NOT NULL AND batch_ids <> '' AND FIND_IN_SET(?, batch_ids))
           OR ((batch_ids IS NULL OR batch_ids = '') AND course_ids IS NOT NULL AND course_ids <> '' AND FIND_IN_SET(?, course_ids))
           OR ((batch_ids IS NULL OR batch_ids = '') AND (course_ids IS NULL OR course_ids = ''))
         )`
      : '';
    // Active window: no start date means "always started", no end date means
    // "never expires" — a notice only drops off once an end date has passed.
    const [rows] = await pool.query(
      `SELECT id, title, specification, startdate, enddate, created_date
       FROM awt_noticeboard
       WHERE deleted = 0
         AND (startdate IS NULL OR startdate = '' OR startdate <= CURDATE())
         AND (enddate IS NULL OR enddate = '' OR enddate >= CURDATE())
         AND specification IS NOT NULL AND specification <> ''
         ${targetSql}
       ORDER BY COALESCE(startdate, created_date) DESC, id DESC
       LIMIT 50`,
      targeted ? [String(batchId), String(courseId)] : []
    );

    return NextResponse.json({ notices: rows });
  } catch (err: unknown) {
    console.error('Student portal notices GET error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
