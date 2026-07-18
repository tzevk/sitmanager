/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { fetchSmartOfficeDeviceLogs, isSmartOfficeConfigured } from '@/lib/smartoffice';
import { ensureAttendanceTable } from '@/lib/student-attendance';

export const runtime = 'nodejs';
export const maxDuration = 300;

/*
 * GET /api/cron/sync-biometric-attendance
 * Runs periodically (see vercel.json). Pulls today's face-scan punch logs
 * from SmartOffice and fills in student_attendance for any student who
 * punched in but hasn't already been marked (manually or by an earlier
 * run) for that batch/date/session — it only fills gaps, never overwrites
 * an existing attendance row.
 *
 * EmployeeCode on the biometric device is the student's Student_Id directly
 * (no separate mapping table).
 *
 * Query params (all optional):
 *   date       — YYYY-MM-DD to sync (defaults to today)
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

function errorMessage(error: unknown, fallback = 'Unknown error') {
  return error instanceof Error ? error.message : fallback;
}

// Fixed session cutover matching the rest of the app's 09:00AM/02:00PM
// Lecture Taken session markers (see app/api/daily-activities/attendance).
const SESSION_CUTOVER_HOUR = 13;

type Session = 'first_half' | 'second_half';

interface PunchBucket {
  studentId: number;
  session: Session;
  inTime: string; // HH:MM:SS
  outTime: string;
}

function bucketPunches(
  logs: { EmployeeCode: string; LogDate: string }[]
): PunchBucket[] {
  // studentId -> session -> [times as "HH:MM:SS"]
  const grouped = new Map<number, Map<Session, string[]>>();

  for (const log of logs) {
    const studentId = Number(log.EmployeeCode);
    if (!Number.isFinite(studentId) || studentId <= 0) continue;

    const match = String(log.LogDate || '').match(/(\d{2}):(\d{2}):(\d{2})/);
    if (!match) continue;
    const hour = Number(match[1]);
    const session: Session = hour < SESSION_CUTOVER_HOUR ? 'first_half' : 'second_half';
    const timeStr = `${match[1]}:${match[2]}:${match[3]}`;

    if (!grouped.has(studentId)) grouped.set(studentId, new Map());
    const bySession = grouped.get(studentId)!;
    if (!bySession.has(session)) bySession.set(session, []);
    bySession.get(session)!.push(timeStr);
  }

  const buckets: PunchBucket[] = [];
  for (const [studentId, bySession] of grouped) {
    for (const [session, times] of bySession) {
      times.sort();
      buckets.push({
        studentId,
        session,
        inTime: times[0],
        outTime: times[times.length - 1],
      });
    }
  }
  return buckets;
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorizedCronRequest(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSmartOfficeConfigured()) {
      return NextResponse.json(
        { skipped: true, message: 'SmartOffice not configured yet — set SMARTOFFICE_BASE_URL and SMARTOFFICE_API_KEY.' },
        { status: 200 }
      );
    }

    const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);

    const logs = await fetchSmartOfficeDeviceLogs(date, date);
    const buckets = bucketPunches(logs);

    if (!buckets.length) {
      return NextResponse.json({ date, punchesFound: logs.length, studentsMatched: 0, attendanceInserted: 0 });
    }

    const pool = getPool();
    await ensureAttendanceTable(pool);
    const studentIds = [...new Set(buckets.map((b) => b.studentId))];

    // Resolve each student's current active admission (Batch_Id, Admission_Id) —
    // same "latest active admission" convention used across the app.
    const [admRows] = await pool.query<any[]>(
      `SELECT a.Student_Id, a.Admission_Id, a.Batch_Id
       FROM admission_master a
       JOIN (
         SELECT Student_Id, MAX(Admission_Id) AS Admission_Id
         FROM admission_master
         WHERE IsDelete = 0 AND IsActive = 1 AND Student_Id IN (?)
         GROUP BY Student_Id
       ) latest ON latest.Admission_Id = a.Admission_Id
       WHERE a.Student_Id IN (?)`,
      [studentIds, studentIds]
    );
    const admissionByStudent = new Map<number, { admissionId: number; batchId: number }>();
    for (const row of admRows) {
      admissionByStudent.set(Number(row.Student_Id), { admissionId: Number(row.Admission_Id), batchId: Number(row.Batch_Id) });
    }

    let matched = 0;
    let inserted = 0;
    for (const bucket of buckets) {
      const admission = admissionByStudent.get(bucket.studentId);
      if (!admission) continue; // no active enrollment — nothing to attach this punch to
      matched++;

      // Only fill the gap — never overwrite an existing attendance row
      // (manual entry, or an earlier sync run, always wins).
      const [existing] = await pool.query<any[]>(
        `SELECT Attendance_Id FROM student_attendance
         WHERE Batch_Id = ? AND Student_Id = ? AND Attendance_Date = ? AND Session = ?
           AND (IsDelete = 0 OR IsDelete IS NULL)
         LIMIT 1`,
        [admission.batchId, bucket.studentId, date, bucket.session]
      );
      if (existing.length) continue;

      await pool.query(
        `INSERT INTO student_attendance
           (Batch_Id, Student_Id, Admission_Id, Attendance_Date, Session, Status, In_Time, Out_Time, IsDelete)
         VALUES (?, ?, ?, ?, ?, 'P', ?, ?, 0)
         ON DUPLICATE KEY UPDATE Attendance_Id = Attendance_Id`,
        [admission.batchId, bucket.studentId, admission.admissionId, date, bucket.session, bucket.inTime, bucket.outTime]
      );
      inserted++;
    }

    return NextResponse.json({
      date,
      punchesFound: logs.length,
      studentsWithPunches: studentIds.length,
      studentsMatched: matched,
      attendanceInserted: inserted,
    });
  } catch (error: unknown) {
    console.error('Biometric attendance sync error:', error);
    return NextResponse.json({ error: errorMessage(error, 'Sync failed') }, { status: 500 });
  }
}
