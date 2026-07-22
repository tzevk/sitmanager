/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { isSmartOfficeConfigured, fetchSmartOfficeDeviceLogs } from '@/lib/smartoffice';
import { getStoredPunchLogs, bucketPunches, type PunchLog } from '@/lib/facescan-attendance';

export const runtime = 'nodejs';

/*
 * GET /api/daily-activities/attendance/facescan-sync?batchId=X&date=YYYY-MM-DD
 *
 * Returns punch data (with in/out times) filtered to students in the given
 * batch. Caller uses this to pre-populate attendance before saving — nothing
 * is written to DB by this route.
 *
 * Punch logs come from one of two places:
 *   1. facescan_device_logs — pushed by the local relay app (facescan-relay/)
 *      for institutes whose device is only reachable over the LAN. Checked
 *      first since it's the source that actually works for those sites.
 *   2. SmartOffice API, fetched live — used when configured and no relay
 *      data exists yet for this date.
 *
 * Response shapes:
 *   { configured: false }                                — neither source available
 *   { configured: true, error: "..." }                  — API reachable but failed
 *   { configured: true, firstHalf: [...], secondHalf: [...], rawCount: N, ... }
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'attendance.view');
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId')?.trim() || '';
    const date    = searchParams.get('date')?.trim()    || '';

    if (!batchId || !date) {
      return NextResponse.json({ error: 'batchId and date are required' }, { status: 400 });
    }

    const pool = getPool();

    let logs: PunchLog[] = await getStoredPunchLogs(pool, date);
    if (!logs.length) {
      if (!isSmartOfficeConfigured()) {
        return NextResponse.json({ configured: false });
      }
      logs = await fetchSmartOfficeDeviceLogs(date, date);
    }

    const [batchStudents] = await pool.query<any[]>(
      `SELECT a.Student_Id FROM admission_master a
       WHERE a.Batch_Id = ?
         AND (a.IsDelete = 0 OR a.IsDelete IS NULL)
         AND (a.Cancel   = 0 OR a.Cancel   IS NULL)`,
      [Number(batchId)]
    );
    const batchStudentSet = new Set(batchStudents.map((s: any) => Number(s.Student_Id)));

    const buckets = bucketPunches(logs).filter((b) => batchStudentSet.has(b.studentId));
    const firstHalf  = buckets.filter((b) => b.session === 'first_half').map((b) => ({ studentId: b.studentId, inTime: b.inTime, outTime: b.outTime }));
    const secondHalf = buckets.filter((b) => b.session === 'second_half').map((b) => ({ studentId: b.studentId, inTime: b.inTime, outTime: b.outTime }));

    return NextResponse.json({
      configured: true,
      date,
      rawCount: logs.length,
      firstHalf,
      secondHalf,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Sync failed';
    return NextResponse.json({ configured: true, error: msg }, { status: 500 });
  }
}
