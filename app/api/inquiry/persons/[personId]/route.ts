import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { findPersonEnquiries } from '@/lib/services/person.service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, context: { params: Promise<{ personId: string }> }) {
  try {
    const auth = await requirePermission(req, 'inquiry.view');
    if (auth instanceof NextResponse) return auth;

    const { personId: personIdParam } = await context.params;
    const personId = parseInt(personIdParam, 10);
    if (!Number.isInteger(personId) || personId <= 0) {
      return NextResponse.json({ error: 'Invalid personId' }, { status: 400 });
    }

    const enquiries = await findPersonEnquiries(personId);
    return NextResponse.json({ enquiries });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Person enquiries GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch person enquiries', details: message }, { status: 500 });
  }
}
