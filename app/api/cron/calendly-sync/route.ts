import { NextRequest, NextResponse } from 'next/server';
import { calendlyConfigured, syncCalendly } from '@/lib/appointments/calendly';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Same auth convention as the other cron routes (e.g. suvidya-inquiry-sync).
function isAuthorizedCronRequest(req: NextRequest): boolean {
  if (req.headers.get('x-vercel-cron')) return true;
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';
  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  return bearer === secret || req.headers.get('x-cron-secret')?.trim() === secret;
}

/** Pull backstop for the Calendly webhook — idempotent, safe to run any time. */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
  if (!calendlyConfigured()) return NextResponse.json({ ok: true, skipped: 'CALENDLY_API_TOKEN not set' });
  try {
    const summary = await syncCalendly();
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error('[calendly] cron sync failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Calendly sync failed' }, { status: 500 });
  }
}
