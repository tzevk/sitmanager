import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getStudentSession } from '@/app/api/student-portal/auth/session/route';
import { IssueError, ISSUE_TYPES, listStudentIssues, raiseIssue } from '@/lib/academic-issues';
import { checkRateLimitKey } from '@/lib/rate-limit';

/** The student's own academic issues (staff-internal notes are never returned). */
export async function GET(req: NextRequest) {
  try {
    const session = await getStudentSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const issues = await listStudentIssues(getPool(), Number(session.studentId));
    return NextResponse.json({ issues, issueTypes: ISSUE_TYPES });
  } catch (err: unknown) {
    console.error('Student issues GET error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * Raise an issue against one of the student's own records. The body only names
 * the record (sourceModule + parentId); ownership and the record snapshot are
 * resolved on the server from CRM data.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getStudentSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const studentId = Number(session.studentId);

    const limit = checkRateLimitKey('student-issue', String(studentId), 10, 60 * 60);
    if (!limit.allowed) return NextResponse.json({ error: 'Too many issues raised. Please try again later.' }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const result = await raiseIssue(getPool(), studentId, body ?? {});
    return NextResponse.json({ success: true, id: result.id });
  } catch (err: unknown) {
    if (err instanceof IssueError) return NextResponse.json({ error: err.message, ...err.extra }, { status: err.status });
    console.error('Student issues POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
