import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { getIssueForStaff, IssueError, staffAction } from '@/lib/academic-issues';
import { logTableActivity } from '@/lib/activity-log';

/** One issue: details, full timeline (including internal notes) and the CRM record as it stands now. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(req, 'academic_issue.view');
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const data = await getIssueForStaff(getPool(), Number(id));
    if (!data) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error('Academic issue GET error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * Staff action: review / request_info / note / resolve / reject / reopen.
 * Resolve can also post an update on the Notice Board (needs notice_board.create).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(req, 'academic_issue.manage');
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const issueId = Number(id);
    if (!Number.isInteger(issueId) || issueId <= 0) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const notice = body?.notice && typeof body.notice === 'object' ? body.notice : null;
    if (notice && !auth.permissions.includes('notice_board.create')) {
      return NextResponse.json({ error: 'You do not have permission to post notices.' }, { status: 403 });
    }

    const actor = {
      userId: auth.session.userId,
      name: `${auth.session.firstName ?? ''} ${auth.session.lastName ?? ''}`.trim() || auth.session.email,
    };
    const result = await staffAction(getPool(), issueId, actor, { action: body?.action, message: body?.message, notice });

    if (body?.action !== 'note') {
      await logTableActivity(req, {
        tableName: 'academic_issue',
        action: 'UPDATE',
        recordId: issueId,
        details: { action: body?.action, status: result.status, noticeId: result.noticeId ?? null },
      });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    if (err instanceof IssueError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('Academic issue PATCH error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
