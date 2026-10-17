import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getAlumniBatchStudents, getAlumniBatchSummary } from '@/lib/services/alumni-batch-summary.service';

export const runtime = 'nodejs';

/**
 * Batch-wise alumni registration from the last uploaded report.
 * GET → all batches (latest end date first) + when the report was uploaded.
 * GET ?batchId=N → that batch's students with registered yes/no (download).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'alumni.view');
    if (auth instanceof NextResponse) return auth;

    const batchId = Number(new URL(req.url).searchParams.get('batchId'));
    if (batchId) {
      if (!Number.isInteger(batchId) || batchId <= 0) return NextResponse.json({ error: 'Invalid batch' }, { status: 400 });
      return NextResponse.json({ students: await getAlumniBatchStudents(batchId) });
    }
    return NextResponse.json(await getAlumniBatchSummary());
  } catch (error: unknown) {
    console.error('Alumni batch summary error:', error);
    return NextResponse.json({ error: 'Failed to load batch-wise alumni summary' }, { status: 500 });
  }
}
