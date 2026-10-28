/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getTrainerSession } from '@/app/api/trainer-portal/auth/session/route';
import { parseTimeToMinutes } from '@/lib/time-format';
import { trainerCanAccessBatch } from '@/lib/batch-trainers';
import { ensureTrainerPlanColumns as ensureAttendanceColumns } from '@/lib/trainer-plan-columns';

function normalizeText(v: unknown) {
  const s = String(v ?? '').trim();
  return s || null;
}

type LectureSelection = { id: number; subtopics?: number[]; activityType?: string | null };

function parseSelections(raw: unknown): LectureSelection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l: any) => ({
      id: Number(l?.id),
      subtopics: Array.isArray(l?.subtopics) ? l.subtopics.map(Number).filter((n: number) => Number.isInteger(n) && n >= 0) : undefined,
      activityType: normalizeText(l?.activityType),
    }))
    .filter((l) => Number.isInteger(l.id) && l.id > 0);
}

/** Lecture Plan rows of this batch among the selected ids (ignores anything else sent). */
async function loadBatchRows(pool: any, batchId: number, ids: number[]) {
  if (!ids.length) return [];
  const [rows] = await pool.query(
    `SELECT id, starttime, subject, subject_topic, covered_subtopics
     FROM batch_slecture_master
     WHERE batch_id = ? AND id IN (?)
       AND (deleted IS NULL OR deleted = '0' OR deleted = 0)`,
    [String(batchId), ids]
  );
  return rows as any[];
}

/**
 * Records the day on the exact Lecture Plan rows the trainer picked:
 *  - check_in:  trainer_in_time, and the ticked sub-topics merged into
 *               covered_subtopics (comma-separated sub-topic positions, the same
 *               field Lecture Taken ticks).
 *  - check_out: trainer_out_time and what each session turned out to be
 *               (lecture / assignment / test) — first_half_status for a
 *               session starting before 1 pm, else second_half_status;
 *               break minutes on the first picked row.
 */
async function writeToLecturePlan(
  pool: any,
  params: { batchId: number; phase: 'check_in' | 'check_out'; selections: LectureSelection[]; breakMinutes: number | null }
) {
  const rows = await loadBatchRows(pool, params.batchId, params.selections.map((l) => l.id));
  const byId = new Map(rows.map((r) => [Number(r.id), r]));

  let first = true;
  for (const sel of params.selections) {
    const row = byId.get(sel.id);
    if (!row) continue;

    if (params.phase === 'check_in') {
      const covered = new Set(
        String(row.covered_subtopics || '').split(',').map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n))
      );
      for (const idx of sel.subtopics ?? []) covered.add(idx);
      await pool.query(
        `UPDATE batch_slecture_master SET trainer_in_time = CURTIME(), covered_subtopics = ? WHERE id = ?`,
        [covered.size ? Array.from(covered).sort((x, y) => x - y).join(',') : row.covered_subtopics ?? null, row.id]
      );
    } else {
      const startMin = parseTimeToMinutes(row.starttime || null);
      const statusCol = startMin != null && startMin >= 13 * 60 ? 'second_half_status' : 'first_half_status';
      await pool.query(
        `UPDATE batch_slecture_master
         SET trainer_out_time = CURTIME(), ${statusCol} = COALESCE(?, ${statusCol})
             ${first ? ', break_minutes = COALESCE(?, break_minutes)' : ''}
         WHERE id = ?`,
        first ? [sel.activityType ?? null, params.breakMinutes, row.id] : [sel.activityType ?? null, row.id]
      );
      first = false;
    }
  }
  return rows;
}

/** Short summary of what was taught, for trainer_attendance.Remarks. */
function topicSummary(rows: any[]) {
  return rows
    .map((r) => String(r.subject || '').trim() || String(r.subject_topic || '').split('\n')[0].trim())
    .filter(Boolean)
    .join(' / ')
    .slice(0, 250) || null;
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
    // lectures: [{ id, subtopics?: number[], activityType? }] — the Lecture Plan
    // rows the trainer picked for today.
    const { action, batchId, lectures, breakMinutes } = body; // action: 'check_in' | 'check_out'
    const facultyId = session.facultyId;
    const selections = parseSelections(lectures);
    const normalizedBreakMinutes = Number.isFinite(Number(breakMinutes)) && breakMinutes !== null && breakMinutes !== undefined
      ? Number(breakMinutes)
      : null;

    if (!action || !['check_in', 'check_out'].includes(action)) {
      return NextResponse.json({ error: 'action must be check_in or check_out' }, { status: 400 });
    }

    const normalizedBatchId = Number(batchId);
    const hasBatch = Number.isFinite(normalizedBatchId) && normalizedBatchId > 0;
    if (hasBatch && !(await trainerCanAccessBatch(pool, facultyId, normalizedBatchId))) {
      return NextResponse.json({ error: 'This batch is not linked to you.' }, { status: 403 });
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

      // Attendance row first: its unique (Faculty_Id, Attend_Date) key stops a
      // double submit before anything is written to the Lecture Plan.
      await pool.query(
        `INSERT INTO trainer_attendance (Faculty_Id, Attend_Date, Check_In, Status, Batch_Id)
         VALUES (?, CURDATE(), CURTIME(), 'Present', ?)`,
        [facultyId, hasBatch ? normalizedBatchId : null]
      );

      if (hasBatch) {
        const rows = await writeToLecturePlan(pool, { batchId: normalizedBatchId, phase: 'check_in', selections, breakMinutes: null });
        const remarks = topicSummary(rows);
        if (remarks) {
          await pool.query(
            `UPDATE trainer_attendance SET Remarks = ? WHERE Faculty_Id = ? AND Attend_Date = CURDATE()`,
            [remarks, facultyId]
          );
        }
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

      const rows = hasBatch
        ? await writeToLecturePlan(pool, { batchId: normalizedBatchId, phase: 'check_out', selections, breakMinutes: normalizedBreakMinutes })
        : [];

      await pool.query(
        `UPDATE trainer_attendance SET Check_Out = CURTIME(), Remarks = COALESCE(?, Remarks)
         WHERE Faculty_Id = ? AND Attend_Date = CURDATE()`,
        [topicSummary(rows), facultyId]
      );

      return NextResponse.json({ success: true, action: 'check_out' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    console.error('Attendance POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
