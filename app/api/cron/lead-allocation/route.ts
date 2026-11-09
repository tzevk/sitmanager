import { NextRequest, NextResponse } from 'next/server';
import { autoAssignPending, escalateUncontactedLeads } from '@/lib/services/lead-allocation.service';
import { reconcileAdmissionStatuses } from '@/lib/services/lead-status-sync.service';

export const runtime = 'nodejs';
export const maxDuration = 300;

/*
 * GET /api/cron/lead-allocation — every minute (vercel.json).
 *   1. auto-assigns new, unassigned inquiries (lib/services/lead-allocation.service.ts)
 *   2. alerts owner + managers about assigned leads with no first call in time
 *   3. once an hour at :07 (or ?statusSync=1): reconciles OnlineState / Status_id for admitted students;
 *      skipped while an earlier run is still executing (see lead-status-sync.service.ts)
 */

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const headerSecret = req.headers.get('x-cron-secret')?.trim() || '';
  const querySecret = req.nextUrl.searchParams.get('secret')?.trim() || '';
  return bearer === secret || headerSecret === secret || querySecret === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const out: Record<string, unknown> = {};
  // Each step is independent: one failing must not stop the others.
  try { out.assign = await autoAssignPending({ limit: 300 }); } catch (e) { console.error('lead-allocation assign', e); out.assignError = String(e); }
  try { out.uncontacted = await escalateUncontactedLeads(); } catch (e) { console.error('lead-allocation watchdog', e); out.uncontactedError = String(e); }
  const minute = new Date().getUTCMinutes();
  if (minute === 7 || req.nextUrl.searchParams.get('statusSync') === '1') {
    try { out.statusSync = await reconcileAdmissionStatuses({ dryRun: req.nextUrl.searchParams.get('dryRun') === '1' }); }
    catch (e) { console.error('lead-allocation status sync', e); out.statusSyncError = String(e); }
  }
  const failed = Object.keys(out).some((k) => k.endsWith('Error'));
  return NextResponse.json({ success: !failed, ...out }, { status: failed ? 500 : 200 });
}
