import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getUnreadLeadAlerts, markLeadAlertsRead } from '@/lib/services/lead-allocation.service';

export const runtime = 'nodejs';

/** GET — the signed-in user's unread lead alerts (new lead assigned, not contacted, unassignable). */
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'inquiry.view');
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json({ alerts: await getUnreadLeadAlerts(auth.session.userId) });
  } catch (error) {
    console.error('Lead alerts GET error:', error);
    return NextResponse.json({ error: 'Failed to load alerts' }, { status: 500 });
  }
}

/** POST — { ids: number[] } or { all: true } marks alerts read. */
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'inquiry.view');
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json().catch(() => ({}));
    await markLeadAlertsRead(auth.session.userId, body.all ? 'all' : Array.isArray(body.ids) ? body.ids : []);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Lead alerts POST error:', error);
    return NextResponse.json({ error: 'Failed to update alerts' }, { status: 500 });
  }
}
