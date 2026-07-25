/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getTrainerSession } from '@/app/api/trainer-portal/auth/session/route';
import { splitFirstSecondHalf } from '@/lib/time-format';

function normalizeText(v: unknown) {
  const s = String(v ?? '').trim();
  return s || null;
}

async function ensureAttendanceColumns(pool: any) {
  const [cRows] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'batch_slecture_master'
       AND COLUMN_NAME IN ('trainer_in_time', 'trainer_out_time', 'first_half_status', 'break_minutes', 'second_half_status')`
  );
  const existingCols = new Set((cRows as any[]).map((r) => r.COLUMN_NAME));

  if (!existingCols.has('trainer_in_time')) {
    await pool.query(
      `ALTER TABLE batch_slecture_master ADD COLUMN trainer_in_time VARCHAR(20) NULL AFTER lecture_status`
    );
  }
  if (!existingCols.has('trainer_out_time')) {
    await pool.query(
      `ALTER TABLE batch_slecture_master ADD COLUMN trainer_out_time VARCHAR(20) NULL AFTER trainer_in_time`
    );
  }
  if (!existingCols.has('first_half_status')) {
    await pool.query(
      `ALTER TABLE batch_slecture_master ADD COLUMN first_half_status VARCHAR(30) NULL AFTER trainer_out_time`
    );
  }
  if (!existingCols.has('break_minutes')) {
    await pool.query(
      `ALTER TABLE batch_slecture_master ADD COLUMN break_minutes INT NULL AFTER first_half_status`
    );
  }
  if (!existingCols.has('second_half_status')) {
    await pool.query(
      `ALTER TABLE batch_slecture_master ADD COLUMN second_half_status VARCHAR(30) NULL AFTER break_minutes`
    );
  }
}

/**
 * Writes trainer in/out + half-status onto the matching batch_slecture_master
 * row(s) for today, per the Lecture Plan matching rule:
 *  - 0 rows match -> no-op (trainer_attendance is still written as normal).
 *  - 1 row matches -> everything relevant lands on that single row.
 *  - 2+ rows match -> split by starttime into first-half/second-half rows,
 *    same logic the client uses to compute firstHalfPlan/secondHalfPlan.
 */
async function writeToLecturePlan(
  pool: any,
  params: {
    facultyId: number;
    batchId: number;
    dateIso: string;
    phase: 'check_in' | 'check_out';
    firstHalfStatus: string | null;
    secondHalfStatus: string | null;
    breakMinutes: number | null;
  }
) {
  const [rowsRaw] = await pool.query(
    `SELECT id, starttime
     FROM batch_slecture_master
     WHERE batch_id = ? AND faculty_id = ? AND date = ?
       AND (deleted IS NULL OR deleted = '0' OR deleted = 0)`,
    [String(params.batchId), params.facultyId, params.dateIso]
  );
  const rows = rowsRaw as any[];

  if (!rows.length) {
    // No plan row for this batch/trainer/date — skip the plan-table write.
    return;
  }

  if (rows.length === 1) {
    const id = rows[0].id;
    if (params.phase === 'check_in') {
      await pool.query(
        `UPDATE batch_slecture_master
         SET trainer_in_time = CURTIME(), first_half_status = COALESCE(?, first_half_status)
         WHERE id = ?`,
        [params.firstHalfStatus, id]
      );
    } else {
      await pool.query(
        `UPDATE batch_slecture_master
         SET trainer_out_time = CURTIME(),
             second_half_status = COALESCE(?, second_half_status),
             break_minutes = COALESCE(?, break_minutes),
             first_half_status = COALESCE(first_half_status, ?)
         WHERE id = ?`,
        [params.secondHalfStatus, params.breakMinutes, params.firstHalfStatus, id]
      );
    }
    return;
  }

  // 2+ rows for the day — split first-half vs second-half using the same
  // logic the client uses to compute firstHalfPlan/secondHalfPlan.
  const { firstHalf, secondHalf } = splitFirstSecondHalf(rows);

  if (params.phase === 'check_in') {
    if (firstHalf) {
      await pool.query(
        `UPDATE batch_slecture_master
         SET trainer_in_time = CURTIME(), first_half_status = COALESCE(?, first_half_status)
         WHERE id = ?`,
        [params.firstHalfStatus, firstHalf.id]
      );
    }
  } else {
    if (secondHalf) {
      const isSameRowAsFirst = !firstHalf || firstHalf.id === secondHalf.id;
      await pool.query(
        `UPDATE batch_slecture_master
         SET trainer_out_time = CURTIME(),
             second_half_status = COALESCE(?, second_half_status),
             break_minutes = COALESCE(?, break_minutes)
             ${isSameRowAsFirst ? ', first_half_status = COALESCE(first_half_status, ?)' : ''}
         WHERE id = ?`,
        isSameRowAsFirst
          ? [params.secondHalfStatus, params.breakMinutes, params.firstHalfStatus, secondHalf.id]
          : [params.secondHalfStatus, params.breakMinutes, secondHalf.id]
      );
    }
  }
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
    await ensureAttendanceColumns(pool);
    const body = await req.json();
    const { action, batchId, sessions, breakMinutes } = body; // action: 'check_in' | 'check_out'
    const facultyId = session.facultyId;
    const normalizedBreakMinutes = Number.isFinite(Number(breakMinutes)) && breakMinutes !== null && breakMinutes !== undefined
      ? Number(breakMinutes)
      : null;

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

      const normalizedBatchId = Number(batchId);
      const hasBatch = Number.isFinite(normalizedBatchId) && normalizedBatchId > 0;

      await pool.query(
        `INSERT INTO trainer_attendance (Faculty_Id, Attend_Date, Check_In, Status, Batch_Id)
         VALUES (?, CURDATE(), CURTIME(), 'Present', ?)`,
        [facultyId, hasBatch ? normalizedBatchId : null]
      );

      // Record the check-in on today's matching Lecture Plan row(s).
      if (hasBatch) {
        const todayIso = new Date().toISOString().slice(0, 10);
        const fh = (sessions && typeof sessions === 'object' && sessions.first_half) || {};

        await writeToLecturePlan(pool, {
          facultyId,
          batchId: normalizedBatchId,
          dateIso: todayIso,
          phase: 'check_in',
          firstHalfStatus: normalizeText(fh.activityType),
          secondHalfStatus: null,
          breakMinutes: null,
        });
      }

      return NextResponse.json({ success: true, action: 'check_in' });
    }

    if (action === 'check_out') {
      if (!existing.length) {
        return NextResponse.json({ error: 'No check-in found for today' }, { status: 400 });
      }
      if (existing[0].Check_Out) {
        return NextResponse.json({ error: 'Already checked out today' }, { status: 400 });
      }
      const fh = (sessions && typeof sessions === 'object' && sessions.first_half) || {};
      const sh = (sessions && typeof sessions === 'object' && sessions.second_half) || {};
      const combinedRemarks = [normalizeText(fh.topic), normalizeText(sh.topic)].filter(Boolean).join(' / ') || null;

      await pool.query(
        `UPDATE trainer_attendance SET Check_Out = CURTIME(), Remarks = COALESCE(?, Remarks)
         WHERE Faculty_Id = ? AND Attend_Date = CURDATE()`,
        [combinedRemarks, facultyId]
      );

      const normalizedBatchId = Number(batchId);
      if (Number.isFinite(normalizedBatchId) && normalizedBatchId > 0) {
        const todayIso = new Date().toISOString().slice(0, 10);

        await writeToLecturePlan(pool, {
          facultyId,
          batchId: normalizedBatchId,
          dateIso: todayIso,
          phase: 'check_out',
          firstHalfStatus: normalizeText(fh.activityType),
          secondHalfStatus: normalizeText(sh.activityType),
          breakMinutes: normalizedBreakMinutes,
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
