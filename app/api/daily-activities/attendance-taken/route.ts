import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { logTableActivity } from '@/lib/activity-log';
import {
  AttendanceTakenError, deleteSession, getSessionRoster, isDate, listSessions, parseRecords, saveSessionEdits, toSession,
} from '@/lib/attendance-taken';

/**
 * Attendance Taken — review, correct and delete attendance recorded on the
 * Attendance page. GET ?batchId&from&to → half-days in the range (calendar /
 * list); GET ?batchId&date&session → that half-day's roster with marks.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'attendance.view');
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const batchId = Number(searchParams.get('batchId'));
    if (!Number.isInteger(batchId) || batchId <= 0) return NextResponse.json({ error: 'Choose a batch.' }, { status: 400 });

    const pool = getPool();
    const date = searchParams.get('date');
    if (date) {
      const session = toSession(searchParams.get('session'));
      if (!isDate(date) || !session) return NextResponse.json({ error: 'Invalid date or session.' }, { status: 400 });
      const students = await getSessionRoster(pool, batchId, date, session);
      return NextResponse.json({ students });
    }

    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (!isDate(from) || !isDate(to) || from > to) return NextResponse.json({ error: 'Invalid date range.' }, { status: 400 });
    if (Date.parse(to) - Date.parse(from) > 400 * 86400000) return NextResponse.json({ error: 'Date range too large (max ~13 months).' }, { status: 400 });
    const sessions = await listSessions(pool, batchId, from, to);
    return NextResponse.json({
      sessions,
      canEdit: auth.permissions.includes('attendance.update'),
      canDelete: auth.permissions.includes('attendance.delete'),
    });
  } catch (err: unknown) {
    console.error('Attendance taken GET error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/** Correct some students' marks for one half-day. */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'attendance.update');
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => ({}));
    const batchId = Number(body?.batchId);
    const session = toSession(body?.session);
    if (!Number.isInteger(batchId) || batchId <= 0 || !isDate(body?.date) || !session) {
      return NextResponse.json({ error: 'Invalid batch, date or session.' }, { status: 400 });
    }
    const records = parseRecords(body?.records);
    const result = await saveSessionEdits(getPool(), batchId, body.date, session, records);
    await logTableActivity(req, {
      tableName: 'student_attendance', action: 'UPDATE', recordId: `${batchId}:${body.date}:${session}`,
      details: { source: 'attendance-taken', changes: records.map((r) => ({ studentId: r.studentId, status: r.status })), ...result },
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    if (err instanceof AttendanceTakenError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('Attendance taken PATCH error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/** Delete a whole half-day (soft delete, attendance + its synced lecture). */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'attendance.delete');
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const batchId = Number(searchParams.get('batchId'));
    const date = searchParams.get('date');
    const session = toSession(searchParams.get('session'));
    if (!Number.isInteger(batchId) || batchId <= 0 || !isDate(date) || !session) {
      return NextResponse.json({ error: 'Invalid batch, date or session.' }, { status: 400 });
    }
    const result = await deleteSession(getPool(), batchId, date, session);
    await logTableActivity(req, {
      tableName: 'student_attendance', action: 'DELETE', recordId: `${batchId}:${date}:${session}`,
      details: { source: 'attendance-taken', ...result },
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    if (err instanceof AttendanceTakenError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('Attendance taken DELETE error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
