import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getStudentSession } from '@/app/api/student-portal/auth/session/route';
import { getStudentPortalContext } from '@/lib/student-portal/context';
import { getStudentAcademicRecords, toStudentView } from '@/lib/student-portal/academic-records';

/**
 * The student's tests for the dashboard: assignment tests (Assignments module)
 * and unit tests (Unit Test module), via the shared academic-records contract.
 * Read-only. Marks stay hidden until results are published (toStudentView).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getStudentSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const ctx = await getStudentPortalContext(pool, Number(session.studentId));
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const records = (await getStudentAcademicRecords(pool, ctx, ['ASSIGNMENT', 'UNIT_TEST'])).map(toStudentView);
    return NextResponse.json({ records });
  } catch (err: unknown) {
    console.error('Student tests API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
