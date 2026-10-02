import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getStudentSession } from '@/app/api/student-portal/auth/session/route';
import { IssueError, studentReply } from '@/lib/academic-issues';

/** Student answers staff's "information required" request. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getStudentSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const issueId = Number(id);
    if (!Number.isInteger(issueId) || issueId <= 0) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    await studentReply(getPool(), Number(session.studentId), issueId, body?.message);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof IssueError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('Student issue reply error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
