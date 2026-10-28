import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { getBatchTrainerIds, setBatchTrainerIds } from '@/lib/batch-trainers';

/**
 * Trainers linked to a batch (Batch Master "Trainers"). These trainers see the
 * batch — with its full lecture plan — in the Trainer Portal.
 * GET → { trainerIds, facultyList }   PUT { facultyIds } → { trainerIds }
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(req, 'batch.view');
    if (auth instanceof NextResponse) return auth;

    const batchId = Number((await params).id);
    if (!batchId) return NextResponse.json({ error: 'Invalid batch' }, { status: 400 });

    const pool = getPool();
    const [trainerIds, [facultyRows]] = await Promise.all([
      getBatchTrainerIds(pool, batchId),
      pool.query(
        `SELECT Faculty_Id, Faculty_Name FROM faculty_master
         WHERE IsActive = 1 AND IsDelete = 0
         ORDER BY Faculty_Name ASC`
      ),
    ]);
    return NextResponse.json({ trainerIds, facultyList: facultyRows });
  } catch (err: unknown) {
    console.error('Batch trainers GET error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(req, 'batch.update');
    if (auth instanceof NextResponse) return auth;

    const batchId = Number((await params).id);
    const body = await req.json().catch(() => ({}));
    if (!batchId || !Array.isArray(body?.facultyIds)) {
      return NextResponse.json({ error: 'facultyIds is required' }, { status: 400 });
    }

    const pool = getPool();
    await setBatchTrainerIds(pool, batchId, body.facultyIds.map(Number));
    return NextResponse.json({ trainerIds: await getBatchTrainerIds(pool, batchId) });
  } catch (err: unknown) {
    console.error('Batch trainers PUT error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
