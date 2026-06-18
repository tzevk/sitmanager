import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { cache } from '@/lib/cache';
import {
  createPlacementDeputationOpening,
  deletePlacementDeputationOpening,
} from '@/lib/services/placement-dashboard.service';

async function invalidatePlacementDashboard(): Promise<void> {
  await cache.delete('dashboard:data:placement');
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json().catch(() => ({}));
    const row = await createPlacementDeputationOpening({
      companyName: String(body?.companyName || ''),
      role: String(body?.role || ''),
      noOfPositions: Number(body?.noOfPositions || 1),
      deadline: body?.deadline == null ? null : String(body.deadline),
      status: body?.status == null ? 'Open' : String(body.status),
      userId: auth.session.userId,
    });

    await invalidatePlacementDashboard();
    return NextResponse.json({ success: true, row });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save deputation opening';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const id = Number(request.nextUrl.searchParams.get('id') || 0);
    if (!id) return NextResponse.json({ error: 'Opening id is required' }, { status: 400 });

    await deletePlacementDeputationOpening({ id, userId: auth.session.userId });
    await invalidatePlacementDashboard();
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete deputation opening';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}