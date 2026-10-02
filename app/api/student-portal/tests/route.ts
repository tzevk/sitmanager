import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getStudentSession } from '@/app/api/student-portal/auth/session/route';
import { getStudentPortalContext } from '@/lib/student-portal/context';
import { getStudentAcademicRecords, toStudentView } from '@/lib/student-portal/academic-records';

/**
 * The student's tests: assignment tests (Assignments module), unit tests (Unit
 * Test module) and final exam sittings, via the shared academic-records contract.
 * Re-exam sittings the student didn't take (NOT_APPLICABLE) are left out.
 * Read-only. Marks stay hidden until results are published (toStudentView).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getStudentSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const ctx = await getStudentPortalContext(pool, Number(session.studentId));
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const records = (await getStudentAcademicRecords(pool, ctx, ['ASSIGNMENT', 'UNIT_TEST', 'FINAL_EXAM']))
      .filter((r) => r.status !== 'NOT_APPLICABLE')
      .map(toStudentView);
    return NextResponse.json({ records });
  } catch (err: unknown) {
    console.error('Student tests API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
