import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { cache } from '@/lib/cache';
import {
  createPlacementCompanyVisit,
  deletePlacementCompanyVisit,
} from '@/lib/services/placement-dashboard.service';

async function invalidatePlacementDashboard(): Promise<void> {
  await cache.delete('dashboard:data:placement');
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json().catch(() => ({}));
    const row = await createPlacementCompanyVisit({
      visitDate: String(body?.visitDate || ''),
      companyName: String(body?.companyName || ''),
      personToMeet: String(body?.personToMeet || ''),
      place: String(body?.place || ''),
      userId: auth.session.userId,
    });

    await invalidatePlacementDashboard();
    return NextResponse.json({ success: true, row });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save company visit';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const id = Number(request.nextUrl.searchParams.get('id') || 0);
    if (!id) return NextResponse.json({ error: 'Visit id is required' }, { status: 400 });

    await deletePlacementCompanyVisit({ id, userId: auth.session.userId });
    await invalidatePlacementDashboard();
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete company visit';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}