import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { applyAlumniMatches } from '@/lib/services/alumni-import.service';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'alumni.update');
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => ({}));
    const studentIds = Array.isArray(body?.studentIds)
      ? body.studentIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)
      : [];

    if (studentIds.length === 0) {
      return NextResponse.json({ error: 'No students selected' }, { status: 400 });
    }

    const result = await applyAlumniMatches({
      studentIds,
      fileName: typeof body?.fileName === 'string' ? body.fileName : null,
      totalRows: Number(body?.totalRows) || studentIds.length,
      matchedCount: Number(body?.matchedCount) || studentIds.length,
      importedBy: auth.session.userId,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Alumni apply error:', error);
    return NextResponse.json({ error: 'Failed to apply alumni import', details: message }, { status: 500 });
  }
}
