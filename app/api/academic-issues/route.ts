import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { ISSUE_TYPES, listIssuesForStaff } from '@/lib/academic-issues';

/** Staff monitor: academic issues with status counts and filters. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'academic_issue.view');
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const data = await listIssuesForStaff(getPool(), {
      status: searchParams.get('status') || 'ACTIVE',
      batchId: Number(searchParams.get('batchId')) || undefined,
      module: searchParams.get('module') || undefined,
      type: searchParams.get('type') || undefined,
      search: searchParams.get('search')?.trim() || undefined,
    });
    return NextResponse.json({
      ...data,
      issueTypes: ISSUE_TYPES,
      canManage: auth.permissions.includes('academic_issue.manage'),
      canPostNotice: auth.permissions.includes('notice_board.create'),
    });
  } catch (err: unknown) {
    console.error('Academic issues GET error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
