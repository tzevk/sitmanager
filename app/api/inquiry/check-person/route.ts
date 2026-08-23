import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { checkExistingPerson } from '@/lib/services/person.service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'inquiry.view');
    if (auth instanceof NextResponse) return auth;

    const mobile = req.nextUrl.searchParams.get('mobile') || '';
    const email = req.nextUrl.searchParams.get('email') || '';

    const result = await checkExistingPerson(mobile, email);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Check-person error:', error);
    return NextResponse.json({ error: 'Failed to check existing person', details: message }, { status: 500 });
  }
}
