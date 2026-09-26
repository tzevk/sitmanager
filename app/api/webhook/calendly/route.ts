import { NextRequest, NextResponse } from 'next/server';
import { syncInviteeByUri, verifyCalendlySignature } from '@/lib/appointments/calendly';

export const runtime = 'nodejs';

/**
 * Calendly webhook (public — under the /api/webhook prefix in proxy.ts).
 * Signature-verified; the body is only used to find the invitee URI, which is
 * then re-fetched from the Calendly API before anything is written.
 * Non-2xx makes Calendly retry, and the cron pull-sync backstops any miss.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!(await verifyCalendlySignature(req.headers.get('calendly-webhook-signature'), raw))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: { event?: string; payload?: { uri?: string; invitee?: string } };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const event = String(body.event || '');
  // invitee.* payloads are the invitee itself; invitee_no_show.* payloads reference it.
  const inviteeUri = event.startsWith('invitee_no_show') ? body.payload?.invitee : body.payload?.uri;
  if (!inviteeUri || !event.startsWith('invitee')) {
    return NextResponse.json({ ok: true, ignored: event || 'unknown' });
  }

  try {
    const action = await syncInviteeByUri(inviteeUri);
    return NextResponse.json({ ok: true, event, action });
  } catch (err) {
    console.error('[calendly] webhook processing failed', event, inviteeUri, err);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
