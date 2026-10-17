import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission } from '@/lib/api-auth';
import { getAlumniBatchStudents, getAlumniBatchSummary } from '@/lib/services/alumni-batch-summary.service';

export const runtime = 'nodejs';

/**
 * Batch-wise alumni registration from the last uploaded report.
 * GET → all batches (latest end date first) + when the report was uploaded (any signed-in user).
 * GET ?batchId=N → that batch's students with registered yes/no (download; alumni.view).
 */
export async function GET(req: NextRequest) {
  try {
    const batchId = Number(new URL(req.url).searchParams.get('batchId'));
    if (batchId) {
      // Student names / phone numbers — Alumni view access only.
      const auth = await requirePermission(req, 'alumni.view');
      if (auth instanceof NextResponse) return auth;
      if (!Number.isInteger(batchId) || batchId <= 0) return NextResponse.json({ error: 'Invalid batch' }, { status: 400 });
      return NextResponse.json({ students: await getAlumniBatchStudents(batchId) });
    }
    // Batch-level counts only — shown on the CBD dashboard to any signed-in user,
    // like the dashboard's other batch summaries.
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    return NextResponse.json({
      ...(await getAlumniBatchSummary()),
      canDownloadStudents: auth.permissions.includes('alumni.view'),
    });
  } catch (error: unknown) {
    console.error('Alumni batch summary error:', error);
    return NextResponse.json({ error: 'Failed to load batch-wise alumni summary' }, { status: 500 });
  }
}
