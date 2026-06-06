/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getTrainerSession } from '@/app/api/trainer-portal/auth/session/route';

async function ensureBreakTimeColumn(pool: any) {
  const [cRows] = await pool.query(
    `SELECT COUNT(*) as cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'faculty_master'
       AND COLUMN_NAME = 'BreakTimeMinutes'`
  );
  const cnt = Number((cRows as any)?.[0]?.cnt ?? 0);
  if (cnt > 0) return;

  await pool.query(
    `ALTER TABLE faculty_master
     ADD COLUMN BreakTimeMinutes INT NULL DEFAULT 60`
  );
}

async function ensureHourlyRateColumn(pool: any) {
  const [cRows] = await pool.query(
    `SELECT COUNT(*) as cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'faculty_master'
       AND COLUMN_NAME = 'HourlyRate'`
  );
  const cnt = Number((cRows as any)?.[0]?.cnt ?? 0);
  if (cnt > 0) return;

  await pool.query(
    `ALTER TABLE faculty_master
     ADD COLUMN HourlyRate DECIMAL(10,2) NULL`
  );
}

function parseTimeToMinutes(t?: string | null): number | null {
  if (!t) return null;
  const raw = String(t).trim();
  if (!raw) return null;
  const m = raw
    .replace(/\./g, '')
    .trim()
    .match(/^\s*(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*(\d{2}))?\s*([aApP])?\s*([mM])?\s*$/);
  if (!m) return null;
  let hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || mm < 0 || mm > 59) return null;
  const hasMeridiem = Boolean(m[4]);
  if (hasMeridiem) {
    const ap = String(m[4]).toLowerCase();
    if (hh < 1 || hh > 12) return null;
    if (ap === 'a') {
      if (hh === 12) hh = 0;
    } else if (ap === 'p') {
      if (hh !== 12) hh += 12;
    }
  }
  if (hh < 0 || hh > 23) return null;
  return hh * 60 + mm;
}

function computeMinutesMinusBreak(startMin: number, endMin: number, breakMinutes: number) {
  if (endMin <= startMin) return 0;
  const total = endMin - startMin;
  const breakStart = 13 * 60;
  const breakEnd = breakStart + Math.max(0, Math.round(breakMinutes));
  const overlap = Math.max(0, Math.min(endMin, breakEnd) - Math.max(startMin, breakStart));
  return Math.max(0, total - overlap);
}

/* GET — Dashboard overview for the trainer */
export async function GET(req: NextRequest) {
  try {
    const session = await getTrainerSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const facultyId = session.facultyId;

    await ensureBreakTimeColumn(pool);
    await ensureHourlyRateColumn(pool);

    // Faculty info
    const [fRows] = await pool.query<any[]>(
      `SELECT Faculty_Id, Faculty_Name, EMail, Mobile, Specialization, Faculty_Type, BreakTimeMinutes, HourlyRate
       FROM faculty_master WHERE Faculty_Id = ?`,
      [facultyId]
    );
    const faculty = fRows[0] || null;
    const breakTimeMinutes = Math.max(0, Math.round(Number(faculty?.BreakTimeMinutes ?? 60)));
    const hourlyRate = Number(faculty?.HourlyRate ?? 0);

    // Assigned batches for this trainer with configured batch timings.
    // Includes both planned (standard lecture plan) and already taken lectures,
    // then auto-classifies by end date.
    const [batchRows] = await pool.query<any[]>(
      `SELECT DISTINCT b.Batch_Id, b.Batch_code, c.Course_Name, b.Category,
              b.SDate, b.EDate, b.No_of_Lectures, b.Timings,
              CASE
                WHEN b.SDate IS NOT NULL AND b.EDate IS NOT NULL AND CURDATE() BETWEEN DATE(b.SDate) AND DATE(b.EDate)
                  THEN 1
                ELSE 0
              END AS Is_Current,
              CASE
                WHEN b.EDate IS NOT NULL AND DATE(b.EDate) < CURDATE()
                  THEN 1
                ELSE 0
              END AS Is_Closed
       FROM batch_mst b
       LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
       LEFT JOIN batch_slecture_master bsl
         ON bsl.batch_id = b.Batch_Id
        AND (bsl.deleted IS NULL OR bsl.deleted = '0')
        AND bsl.faculty_id = ?
       LEFT JOIN lecture_taken_master ltm
         ON ltm.Batch_Id = b.Batch_Id
        AND (ltm.IsDelete = 0 OR ltm.IsDelete IS NULL)
        AND ltm.Faculty_Id = ?
       WHERE (bsl.id IS NOT NULL OR ltm.Take_Id IS NOT NULL)
         AND (b.Cancel = 0 OR b.Cancel IS NULL)
       ORDER BY Is_Current DESC, b.EDate DESC, b.Batch_Id DESC
       LIMIT 20`,
      [facultyId, facultyId]
    );
    const currentBatches = (batchRows || []).filter((b) => Number(b.Is_Closed || 0) === 0);
    const closedBatches = (batchRows || []).filter((b) => Number(b.Is_Closed || 0) === 1);

    // Total lectures taken this month
    const [lectureCountRows] = await pool.query<any[]>(
      `SELECT COUNT(*) as total FROM lecture_taken_master
       WHERE Faculty_Id = ?
         AND (IsDelete = 0 OR IsDelete IS NULL)
         AND MONTH(Take_Dt) = MONTH(CURDATE())
         AND YEAR(Take_Dt) = YEAR(CURDATE())`,
      [facultyId]
    );
    const totalLectures = lectureCountRows[0]?.total ?? 0;

    // Working hours this month (derived from in/out timings with lunch-break overlap deduction)
    const [monthLectureRows] = await pool.query<any[]>(
      `SELECT Faculty_Start, Faculty_End
       FROM lecture_taken_master
       WHERE Faculty_Id = ?
         AND (IsDelete = 0 OR IsDelete IS NULL)
         AND MONTH(Take_Dt) = MONTH(CURDATE())
         AND YEAR(Take_Dt) = YEAR(CURDATE())`,
      [facultyId]
    );

    let monthWorkMinutes = 0;
    for (const row of monthLectureRows || []) {
      const startMin = parseTimeToMinutes(row?.Faculty_Start ?? null);
      const endMin = parseTimeToMinutes(row?.Faculty_End ?? null);
      if (startMin == null || endMin == null) continue;
      monthWorkMinutes += computeMinutesMinusBreak(startMin, endMin, breakTimeMinutes);
    }
    const monthWorkHours = monthWorkMinutes / 60;
    const estimatedPayThisMonth = hourlyRate > 0 ? monthWorkHours * hourlyRate : 0;

    // Recent 5 lectures
    const [recentLectures] = await pool.query<any[]>(
      `SELECT ltm.Take_Id, ltm.Take_Dt, ltm.Topic, ltm.Lecture_Name, ltm.Duration,
              ltm.ClassRoom, ltm.Faculty_Start, ltm.Faculty_End,
              b.Batch_code, c.Course_Name,
              (SELECT COUNT(*) FROM lecture_taken_child ltc
               WHERE ltc.Take_Id = ltm.Take_Id AND ltc.Student_Atten = 1
               AND (ltc.IsDelete = 0 OR ltc.IsDelete IS NULL)) as students_present
       FROM lecture_taken_master ltm
       LEFT JOIN batch_mst b ON ltm.Batch_Id = b.Batch_Id
       LEFT JOIN course_mst c ON ltm.Course_Id = c.Course_Id
       WHERE ltm.Faculty_Id = ? AND (ltm.IsDelete = 0 OR ltm.IsDelete IS NULL)
       ORDER BY ltm.Take_Dt DESC, ltm.Take_Id DESC
       LIMIT 5`,
      [facultyId]
    );

    // Attendance this month
    const [attendanceRows] = await pool.query<any[]>(
      `SELECT COUNT(*) as total FROM trainer_attendance
       WHERE Faculty_Id = ? AND MONTH(Attend_Date) = MONTH(CURDATE()) AND YEAR(Attend_Date) = YEAR(CURDATE())`,
      [facultyId]
    );
    const thisMonthAttendance = attendanceRows[0]?.total ?? 0;

    // Today's attendance status
    const [todayAtt] = await pool.query<any[]>(
      `SELECT * FROM trainer_attendance WHERE Faculty_Id = ? AND Attend_Date = CURDATE()`,
      [facultyId]
    );

    return NextResponse.json({
      faculty: {
        id: faculty?.Faculty_Id,
        name: faculty?.Faculty_Name,
        email: faculty?.EMail,
        mobile: faculty?.Mobile,
        specialization: faculty?.Specialization,
        type: faculty?.Faculty_Type,
        breakTimeMinutes: faculty?.BreakTimeMinutes ?? null,
        hourlyRate: Number.isFinite(hourlyRate) ? hourlyRate : null,
      },
      batches: currentBatches,
      closed_batches: closedBatches,
      total_lectures: totalLectures,
      recent_lectures: recentLectures,
      this_month_attendance: thisMonthAttendance,
      this_month_work_minutes: monthWorkMinutes,
      this_month_work_hours: Number(monthWorkHours.toFixed(2)),
      this_month_estimated_pay: Number(estimatedPayThisMonth.toFixed(2)),
      today_attendance: todayAtt.length > 0 ? todayAtt[0] : null,
    });
  } catch (err: unknown) {
    console.error('Trainer dashboard error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
