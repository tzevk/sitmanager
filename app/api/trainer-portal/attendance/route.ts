/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getTrainerSession } from '@/app/api/trainer-portal/auth/session/route';

function normalizeText(v: unknown) {
  const s = String(v ?? '').trim();
  return s || null;
}

function activityFlags(activityType: unknown) {
  const value = String(activityType ?? '').toLowerCase();
  if (value === 'assignment') return { assignGiven: 1, testGiven: 0 };
  if (value === 'test') return { assignGiven: 0, testGiven: 1 };
  return { assignGiven: 0, testGiven: 0 };
}

async function syncLectureForSession(
  pool: any,
  input: {
    facultyId: number;
    batchId: number;
    dateIso: string;
    session: 'first_half' | 'second_half';
    topic: string | null;
    subtopic: string | null;
    activityType: string | null;
  }
) {
  const lectureStart = input.session === 'second_half' ? '02:00PM' : '09:00AM';
  const displayTopic = [input.topic, input.subtopic ? `(${input.subtopic})` : ''].filter(Boolean).join(' ').trim() || null;
  const { assignGiven, testGiven } = activityFlags(input.activityType);

  const [batchRowsRaw] = await pool.query(
    `SELECT Course_Id FROM batch_mst WHERE Batch_Id = ? LIMIT 1`,
    [input.batchId]
  );
  const batchRows = batchRowsRaw as any[];
  const courseId = batchRows?.[0]?.Course_Id ?? null;

  const [existingRaw] = await pool.query(
    `SELECT MAX(Take_Id) AS Take_Id
     FROM lecture_taken_master
     WHERE Batch_Id = ? AND Take_Dt = ? AND Lecture_Start = ?
       AND (IsDelete = 0 OR IsDelete IS NULL)`,
    [input.batchId, input.dateIso, lectureStart]
  );
  const existing = existingRaw as any[];

  const takeId = Number(existing?.[0]?.Take_Id || 0);
  if (takeId > 0) {
    await pool.query(
      `UPDATE lecture_taken_master
       SET Faculty_Id = ?,
           Lecture_Name = COALESCE(?, Lecture_Name),
           Topic = COALESCE(?, Topic),
           Assign_Given = ?,
           Test_Given = ?
       WHERE Take_Id = ?`,
      [input.facultyId, input.topic, displayTopic, assignGiven, testGiven, takeId]
    );
    return;
  }

  await pool.query(
    `INSERT INTO lecture_taken_master
      (Course_Id, Batch_Id, Faculty_Id, Take_Dt, Lecture_Start, Lecture_Name, Topic, Assign_Given, Test_Given, IsActive, IsDelete)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
    [courseId, input.batchId, input.facultyId, input.dateIso, lectureStart, input.topic, displayTopic, assignGiven, testGiven]
  );
}

/* GET — Trainer's own attendance history */
/* POST — Mark today's attendance (check-in or check-out) */
export async function GET(req: NextRequest) {
  try {
    const session = await getTrainerSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month'); // YYYY-MM format
    const facultyId = session.facultyId;

    let dateFilter = '';
    const params: any[] = [facultyId];

    if (month) {
      dateFilter = `AND DATE_FORMAT(ta.Attend_Date, '%Y-%m') = ?`;
      params.push(month);
    }

    const [recordsRaw] = await pool.query(
      `SELECT ta.*, b.Batch_code
       FROM trainer_attendance ta
       LEFT JOIN batch_mst b ON ta.Batch_Id = b.Batch_Id
       WHERE ta.Faculty_Id = ? ${dateFilter}
       ORDER BY ta.Attend_Date DESC
       LIMIT 60`,
      params
    );
    const records = recordsRaw as any[];

    // Today's record
    const [todayRaw] = await pool.query(
      `SELECT * FROM trainer_attendance WHERE Faculty_Id = ? AND Attend_Date = CURDATE()`,
      [facultyId]
    );
    const today = todayRaw as any[];

    // Stats for current month
    const [statsRaw] = await pool.query(
      `SELECT
        COUNT(*) as total_days,
        SUM(CASE WHEN Status = 'Present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN Status = 'Absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN Status = 'Half Day' THEN 1 ELSE 0 END) as half_days
       FROM trainer_attendance
       WHERE Faculty_Id = ? AND DATE_FORMAT(Attend_Date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`,
      [facultyId]
    );
    const stats = statsRaw as any[];

    return NextResponse.json({
      records,
      today: today.length ? today[0] : null,
      stats: stats[0] || { total_days: 0, present_days: 0, absent_days: 0, half_days: 0 }
    });
  } catch (err: unknown) {
    console.error('Attendance GET error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTrainerSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const body = await req.json();
    const { action, remarks, batchId, sessions } = body; // action: 'check_in' | 'check_out'
    const facultyId = session.facultyId;

    if (!action || !['check_in', 'check_out'].includes(action)) {
      return NextResponse.json({ error: 'action must be check_in or check_out' }, { status: 400 });
    }

    // Check if today's record exists
    const [existingRaw] = await pool.query(
      `SELECT * FROM trainer_attendance WHERE Faculty_Id = ? AND Attend_Date = CURDATE()`,
      [facultyId]
    );
    const existing = existingRaw as any[];

    if (action === 'check_in') {
      if (existing.length) {
        return NextResponse.json({ error: 'Already checked in today' }, { status: 400 });
      }
      await pool.query(
        `INSERT INTO trainer_attendance (Faculty_Id, Attend_Date, Check_In, Status, Remarks)
         VALUES (?, CURDATE(), CURTIME(), 'Present', ?)`,
        [facultyId, remarks || null]
      );
      return NextResponse.json({ success: true, action: 'check_in' });
    }

    if (action === 'check_out') {
      if (!existing.length) {
        return NextResponse.json({ error: 'No check-in found for today' }, { status: 400 });
      }
      if (existing[0].Check_Out) {
        return NextResponse.json({ error: 'Already checked out today' }, { status: 400 });
      }
      await pool.query(
        `UPDATE trainer_attendance SET Check_Out = CURTIME(), Remarks = COALESCE(?, Remarks)
         WHERE Faculty_Id = ? AND Attend_Date = CURDATE()`,
        [remarks || null, facultyId]
      );

      const normalizedBatchId = Number(batchId);
      if (Number.isFinite(normalizedBatchId) && normalizedBatchId > 0 && sessions && typeof sessions === 'object') {
        const todayIso = new Date().toISOString().slice(0, 10);

        const fh = sessions.first_half || {};
        const sh = sessions.second_half || {};

        await syncLectureForSession(pool, {
          facultyId,
          batchId: normalizedBatchId,
          dateIso: todayIso,
          session: 'first_half',
          topic: normalizeText(fh.topic),
          subtopic: normalizeText(fh.subtopic),
          activityType: normalizeText(fh.activityType),
        });

        await syncLectureForSession(pool, {
          facultyId,
          batchId: normalizedBatchId,
          dateIso: todayIso,
          session: 'second_half',
          topic: normalizeText(sh.topic),
          subtopic: normalizeText(sh.subtopic),
          activityType: normalizeText(sh.activityType),
        });
      }

      return NextResponse.json({ success: true, action: 'check_out' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    console.error('Attendance POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
