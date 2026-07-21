/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { isSmartOfficeConfigured, fetchSmartOfficeDeviceLogs } from '@/lib/smartoffice';

export const runtime = 'nodejs';

const SESSION_CUTOVER_HOUR = 13; // punches before 13:00 → first_half

/*
 * GET /api/daily-activities/attendance/facescan-sync?batchId=X&date=YYYY-MM-DD
 *
 * Returns punch data from SmartOffice biometric device filtered to students
 * in the specified batch. Caller uses this to pre-populate attendance status
 * before saving — nothing is written to DB by this route.
 *
 * Response shapes:
 *   { configured: false }                                — SmartOffice env vars not set
 *   { configured: true, error: "..." }                  — API reachable but failed
 *   { configured: true, firstHalfIds: [...], secondHalfIds: [...], rawCount: N, ... }
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

    if (!isSmartOfficeConfigured()) {
      return NextResponse.json({ configured: false });
    }

    const logs = await fetchSmartOfficeDeviceLogs(date, date);

    const pool = getPool();
    const [batchStudents] = await pool.query<any[]>(
      `SELECT a.Student_Id FROM admission_master a
       WHERE a.Batch_Id = ?
         AND (a.IsDelete = 0 OR a.IsDelete IS NULL)
         AND (a.Cancel   = 0 OR a.Cancel   IS NULL)`,
      [Number(batchId)]
    );
    const batchStudentSet = new Set(batchStudents.map((s: any) => Number(s.Student_Id)));

    const firstHalfSet  = new Set<number>();
    const secondHalfSet = new Set<number>();

    for (const log of logs) {
      const studentId = Number(log.EmployeeCode);
      if (!Number.isFinite(studentId) || studentId <= 0) continue;
      if (!batchStudentSet.has(studentId)) continue;

      const match = String(log.LogDate || '').match(/(\d{2}):\d{2}:\d{2}/);
      if (!match) continue;
      const hour = Number(match[1]);

      if (hour < SESSION_CUTOVER_HOUR) {
        firstHalfSet.add(studentId);
      } else {
        secondHalfSet.add(studentId);
      }
    }

    return NextResponse.json({
      configured: true,
      date,
      rawCount: logs.length,
      firstHalfIds:  [...firstHalfSet],
      secondHalfIds: [...secondHalfSet],
      allIds: [...new Set([...firstHalfSet, ...secondHalfSet])],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Sync failed';
    return NextResponse.json({ configured: true, error: msg }, { status: 500 });
  }
}
