import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { insertPunchLogs, isAuthorizedFacescanIngest, type PunchLog } from '@/lib/facescan-attendance';

export const runtime = 'nodejs';

/*
 * POST /api/daily-activities/attendance/facescan-ingest
 *
 * Receives raw punch logs pushed from the local facescan relay app (see
 * facescan-relay/ — a small Electron app that polls the biometric device
 * over the institute's LAN, since this server cannot reach it directly).
 *
 * Auth: shared secret via `Authorization: Bearer <FACESCAN_INGEST_SECRET>`
 * or `x-facescan-secret` header — this is a machine-to-machine endpoint,
 * not a user session.
 *
 * Body: { logs: [{ EmployeeCode, LogDate, SerialNumber?, PunchDirection? }] }
 */
export async function POST(req: NextRequest) {
  try {
    if (!isAuthorizedFacescanIngest(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const logs = body?.logs;
    if (!Array.isArray(logs)) {
      return NextResponse.json({ error: '"logs" array is required' }, { status: 400 });
    }

    const cleaned: PunchLog[] = logs
      .filter((l) => l && l.EmployeeCode && l.LogDate)
      .map((l) => ({
        EmployeeCode: String(l.EmployeeCode),
        LogDate: String(l.LogDate),
        SerialNumber: l.SerialNumber != null ? String(l.SerialNumber) : undefined,
        PunchDirection: l.PunchDirection != null ? String(l.PunchDirection) : undefined,
      }));

    const inserted = await insertPunchLogs(getPool(), cleaned);

    return NextResponse.json({ received: logs.length, inserted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ingest failed';
    console.error('Facescan ingest error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
