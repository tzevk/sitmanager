import { NextRequest, NextResponse } from 'next/server';
import { calendlyStatus, connectCalendlyWebhook, syncCalendly } from '@/lib/appointments/calendly';
import { requireCalendlyAccess } from '@/lib/appointments/http';

export const maxDuration = 300;

const callbackUrl = (req: NextRequest) => `${req.nextUrl.origin}/api/webhook/calendly`;

/** GET — connection + webhook + last-sync status for the Scheduling Settings page. */
export async function GET(req: NextRequest) {
  const auth = await requireCalendlyAccess(req, false);
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json({ success: true, canManage: auth.canManage, callbackUrl: callbackUrl(req), ...(await calendlyStatus(callbackUrl(req))) });
  } catch (err) {
    console.error('[calendly] status', err);
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Unable to reach Calendly' }, { status: 502 });
  }
}

/** POST { action: 'connect' | 'sync' } */
export async function POST(req: NextRequest) {
  const auth = await requireCalendlyAccess(req, true);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === 'connect') {
      const sub = await connectCalendlyWebhook(callbackUrl(req));
      return NextResponse.json({ success: true, webhook: { state: sub.state, callback_url: sub.callback_url } });
    }
    if (body.action === 'sync') {
      return NextResponse.json({ success: true, summary: await syncCalendly() });
    }
    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[calendly] action failed', err);
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Calendly request failed' }, { status: 502 });
  }
}
