/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Attendance Taken: review / correct / delete attendance already recorded on
 * the Daily Activities > Attendance page.
 *
 * That page saves each half-day to student_attendance AND mirrors it into the
 * lecture record for the slot (lecture_taken_master at 09:00AM / 02:00PM +
 * lecture_taken_child), which is what attendance % in reports and the Student
 * Portal reads. Every edit/delete here keeps both in step, the same way.
 *
 * Production student_attendance has no unique key (the CREATE's uq_attendance
 * can't be added because duplicates exist), so one student/date/session can
 * have several rows. The newest row (highest Attendance_Id) is the effective
 * one; an edit rewrites ALL rows of that key so the duplicates agree again.
 */

export type Session = 'first_half' | 'second_half';
export type AttStatus = 'P' | 'A' | 'L';

export const SLOT_START: Record<Session, string> = { first_half: '09:00AM', second_half: '02:00PM' };
export const SESSIONS: Session[] = ['first_half', 'second_half'];

export class AttendanceTakenError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isDate = (v: unknown): v is string => typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(Date.parse(v));
export const toSession = (v: unknown): Session | null => (v === 'first_half' || v === 'second_half' ? v : null);

/** Effective rows only: newest Attendance_Id per student/date/session, not deleted. */
const EFFECTIVE_IDS = `
  SELECT MAX(Attendance_Id) AS id, COUNT(*) AS copies, COUNT(DISTINCT Status) AS statuses
  FROM student_attendance
  WHERE Batch_Id = ? AND Attendance_Date BETWEEN ? AND ? AND (IsDelete = 0 OR IsDelete IS NULL)
  GROUP BY Student_Id, Attendance_Date, Session`;

/** One row per recorded half-day in the range, with counts and the lecture topic. */
export async function listSessions(pool: any, batchId: number, from: string, to: string) {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(sa.Attendance_Date, '%Y-%m-%d') AS date, sa.Session AS session,
            SUM(sa.Status = 'P') AS present, SUM(sa.Status = 'L') AS late, SUM(sa.Status = 'A') AS absent,
            SUM(x.copies > 1) AS duplicated, SUM(x.statuses > 1) AS conflicting,
            MAX(sa.Updated_At) AS updated_at
     FROM (${EFFECTIVE_IDS}) x
     JOIN student_attendance sa ON sa.Attendance_Id = x.id
     WHERE sa.Status IN ('P', 'A', 'L')
     GROUP BY sa.Attendance_Date, sa.Session
     ORDER BY sa.Attendance_Date DESC, sa.Session`,
    [batchId, from, to]
  );
  const [lectures] = await pool.query(
    `SELECT Take_Dt, Lecture_Start, MAX(Take_Id) AS Take_Id,
            MAX(COALESCE(NULLIF(TRIM(Lecture_Name), ''), NULLIF(TRIM(Topic), ''))) AS topic
     FROM lecture_taken_master
     WHERE Batch_Id = ? AND Take_Dt BETWEEN ? AND ? AND Lecture_Start IN ('09:00AM', '02:00PM')
       AND (IsDelete = 0 OR IsDelete IS NULL)
     GROUP BY Take_Dt, Lecture_Start`,
    [batchId, from, to]
  );
  const topicBy = new Map<string, { takeId: number; topic: string | null }>();
  for (const l of lectures as any[]) {
    const s: Session = l.Lecture_Start === '02:00PM' ? 'second_half' : 'first_half';
    topicBy.set(`${l.Take_Dt}|${s}`, { takeId: Number(l.Take_Id), topic: l.topic ?? null });
  }
  return (rows as any[]).map((r) => {
    const lec = topicBy.get(`${r.date}|${r.session}`);
    const present = Number(r.present), late = Number(r.late), absent = Number(r.absent);
    return {
      date: r.date as string,
      session: r.session as Session,
      present, late, absent,
      marked: present + late + absent,
      duplicated: Number(r.duplicated),
      conflicting: Number(r.conflicting),
      updatedAt: r.updated_at,
      takeId: lec?.takeId ?? null,
      topic: lec?.topic ?? null,
    };
  });
}

/** The batch roster for one half-day with each student's effective mark. */
export async function getSessionRoster(pool: any, batchId: number, date: string, session: Session) {
  const [roster] = await pool.query(
    `SELECT a.Admission_Id, s.Student_Id, s.Student_Name AS studentName, COALESCE(a.Roll_No, '') AS rollNo, a.Cancel
     FROM (
       SELECT MIN(Admission_Id) AS Admission_Id, Student_Id, MAX(Roll_No) AS Roll_No, MAX(Cancel) AS Cancel
       FROM admission_master
       WHERE Batch_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
       GROUP BY Student_Id
     ) a
     JOIN student_master s ON s.Student_Id = a.Student_Id
     WHERE a.Roll_No IS NOT NULL AND a.Roll_No <> ''`,
    [batchId]
  );
  const [marks] = await pool.query(
    `SELECT sa.Student_Id, sa.Admission_Id, sa.Status, TIME_FORMAT(sa.In_Time, '%H:%i') AS In_Time,
            TIME_FORMAT(sa.Out_Time, '%H:%i') AS Out_Time, sa.Remarks, sa.Updated_At, x.copies, x.statuses, s.Student_Name
     FROM (
       SELECT MAX(Attendance_Id) AS id, COUNT(*) AS copies, COUNT(DISTINCT Status) AS statuses
       FROM student_attendance
       WHERE Batch_Id = ? AND Attendance_Date = ? AND Session = ? AND (IsDelete = 0 OR IsDelete IS NULL)
       GROUP BY Student_Id
     ) x
     JOIN student_attendance sa ON sa.Attendance_Id = x.id
     LEFT JOIN student_master s ON s.Student_Id = sa.Student_Id`,
    [batchId, date, session]
  );
  const byStudent = new Map<number, any>();
  for (const m of marks as any[]) byStudent.set(Number(m.Student_Id), m);

  const rows = (roster as any[]).map((r) => {
    const m = byStudent.get(Number(r.Student_Id));
    byStudent.delete(Number(r.Student_Id));
    return row(r.Student_Id, r.Admission_Id, r.studentName, r.rollNo, r.Cancel, m);
  });
  // Marked students no longer on the roster (moved/removed) still show, so nothing recorded is hidden.
  for (const m of byStudent.values()) rows.push(row(m.Student_Id, m.Admission_Id, m.Student_Name, '', null, m, true));

  rows.sort((a, b) => (Number(a.rollNo) || 1e9) - (Number(b.rollNo) || 1e9) || String(a.studentName).localeCompare(String(b.studentName)));
  return rows;
}

function row(studentId: any, admissionId: any, name: any, rollNo: any, cancel: any, m: any, offRoster = false) {
  const status = m && ['P', 'A', 'L'].includes(String(m.Status)) ? (m.Status as AttStatus) : null;
  return {
    studentId: Number(studentId),
    admissionId: admissionId ? Number(admissionId) : null,
    studentName: name ?? `Student ${studentId}`,
    rollNo: String(rollNo ?? ''),
    cancelled: ['YES', '1'].includes(String(cancel ?? '').trim().toUpperCase()),
    offRoster,
    status,
    inTime: m?.In_Time ?? null,
    outTime: m?.Out_Time ?? null,
    remarks: m?.Remarks ?? null,
    copies: m ? Number(m.copies) : 0,
    conflicting: m ? Number(m.statuses) > 1 : false,
    updatedAt: m?.Updated_At ?? null,
  };
}

export interface EditRecord {
  studentId: number;
  admissionId: number | null;
  /** null = clear this student's mark for the session. */
  status: AttStatus | null;
  inTime?: string | null;
  outTime?: string | null;
  remarks?: string | null;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const cleanTime = (v: unknown) => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (!TIME_RE.test(s)) throw new AttendanceTakenError(`Invalid time "${s}" — use HH:MM.`);
  return s;
};

export function parseRecords(input: unknown): EditRecord[] {
  if (!Array.isArray(input) || input.length === 0) throw new AttendanceTakenError('No changes to save.');
  if (input.length > 500) throw new AttendanceTakenError('Too many records in one save.');
  return input.map((r: any) => {
    const studentId = Number(r?.studentId);
    if (!Number.isInteger(studentId) || studentId <= 0) throw new AttendanceTakenError('Invalid student.');
    const status = r?.status === null || r?.status === '' ? null : String(r?.status);
    if (status !== null && !['P', 'A', 'L'].includes(status)) throw new AttendanceTakenError('Status must be P, A or L.');
    const remarks = r?.remarks == null ? null : String(r.remarks).trim().slice(0, 255) || null;
    return {
      studentId,
      admissionId: Number(r?.admissionId) || null,
      status: status as AttStatus | null,
      inTime: cleanTime(r?.inTime),
      outTime: cleanTime(r?.outTime),
      remarks,
    };
  });
}

/** Lock key for one batch/date/session so two editors can't interleave. */
const lockName = (batchId: number, date: string, session: Session) => `sit:att:${batchId}:${date}:${session}`;

async function withSessionLock<T>(pool: any, batchId: number, date: string, session: Session, fn: (conn: any) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  const lock = lockName(batchId, date, session);
  try {
    const [[got]] = await conn.query('SELECT GET_LOCK(?, 10) AS ok', [lock]);
    if (Number(got?.ok) !== 1) throw new AttendanceTakenError('Someone else is saving this attendance — try again in a moment.', 409);
    try {
      await conn.beginTransaction();
      const out = await fn(conn);
      await conn.commit();
      return out;
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      await conn.query('SELECT RELEASE_LOCK(?)', [lock]).catch(() => {});
    }
  } finally {
    conn.release();
  }
}

/** The synced lecture for the slot, created if missing (same as the Attendance page). */
async function slotLecture(conn: any, batchId: number, date: string, session: Session, create: boolean): Promise<number | null> {
  const [[r]] = await conn.query(
    `SELECT MAX(Take_Id) AS Take_Id FROM lecture_taken_master
     WHERE Batch_Id = ? AND Take_Dt = ? AND Lecture_Start = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
    [batchId, date, SLOT_START[session]]
  );
  if (r?.Take_Id) return Number(r.Take_Id);
  if (!create) return null;
  const [[b]] = await conn.query('SELECT Course_Id FROM batch_mst WHERE Batch_Id = ? LIMIT 1', [batchId]);
  const [ins] = await conn.query(
    `INSERT INTO lecture_taken_master (Course_Id, Batch_Id, Take_Dt, Lecture_Start, IsActive, IsDelete)
     VALUES (?, ?, ?, ?, 1, 0)`,
    [b?.Course_Id ?? null, batchId, date, SLOT_START[session]]
  );
  return Number(ins.insertId);
}

/** Save corrected marks for some students in one half-day. */
export async function saveSessionEdits(pool: any, batchId: number, date: string, session: Session, records: EditRecord[]) {
  return withSessionLock(pool, batchId, date, session, async (conn) => {
    let updated = 0, inserted = 0, cleared = 0;
    const needsLecture = records.some((r) => r.status !== null);
    const takeId = await slotLecture(conn, batchId, date, session, needsLecture);

    const ids = records.map((r) => r.studentId);
    const [nameRows] = await conn.query('SELECT Student_Id, Student_Name FROM student_master WHERE Student_Id IN (?)', [ids]);
    const names = new Map<number, string>((nameRows as any[]).map((n) => [Number(n.Student_Id), n.Student_Name]));

    for (const r of records) {
      if (r.status === null) {
        const [res] = await conn.query(
          `UPDATE student_attendance SET IsDelete = 1
           WHERE Batch_Id = ? AND Student_Id = ? AND Attendance_Date = ? AND Session = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
          [batchId, r.studentId, date, session]
        );
        if (res.affectedRows) cleared++;
        if (takeId) {
          await conn.query(
            `UPDATE lecture_taken_child SET IsActive = 0, IsDelete = 1 WHERE Take_Id = ? AND Student_Id = ?`,
            [takeId, r.studentId]
          );
        }
        continue;
      }

      // Rewrite every copy of this key so duplicates agree.
      const [res] = await conn.query(
        `UPDATE student_attendance
         SET Status = ?, In_Time = ?, Out_Time = ?, Remarks = ?, IsDelete = 0,
             Admission_Id = COALESCE(?, Admission_Id), Updated_At = CURRENT_TIMESTAMP
         WHERE Batch_Id = ? AND Student_Id = ? AND Attendance_Date = ? AND Session = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
        [r.status, r.inTime ?? null, r.outTime ?? null, r.remarks ?? null, r.admissionId, batchId, r.studentId, date, session]
      );
      if (res.affectedRows) updated++;
      else {
        await conn.query(
          `INSERT INTO student_attendance
             (Batch_Id, Student_Id, Admission_Id, Attendance_Date, Session, Status, In_Time, Out_Time, Remarks, IsDelete)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [batchId, r.studentId, r.admissionId ?? 0, date, session, r.status, r.inTime ?? null, r.outTime ?? null, r.remarks ?? null]
        );
        inserted++;
      }

      const atten = r.status === 'A' ? 'Absent' : 'Present';
      const late = r.status === 'L' ? 'Yes' : 'No';
      const [c] = await conn.query(
        `UPDATE lecture_taken_child SET Student_Atten = ?, Late = ?, IsActive = 1, IsDelete = 0
         WHERE Take_Id = ? AND Student_Id = ?`,
        [atten, late, takeId, r.studentId]
      );
      if (!c.affectedRows) {
        await conn.query(
          `INSERT INTO lecture_taken_child (Take_Id, Student_Id, Student_Name, Student_Atten, Late, IsActive, IsDelete)
           VALUES (?, ?, ?, ?, ?, 1, 0)`,
          [takeId, r.studentId, names.get(r.studentId) ?? '', atten, late]
        );
      }
    }
    return { updated, inserted, cleared, takeId };
  });
}

/**
 * Delete a whole half-day: soft-deletes its student_attendance rows and the
 * synced slot lecture with its marks (IsDelete = 1 — recoverable), so it stops
 * counting in attendance %. Lectures at other times (entered via Lecture
 * Taken) are not touched.
 */
export async function deleteSession(pool: any, batchId: number, date: string, session: Session) {
  return withSessionLock(pool, batchId, date, session, async (conn) => {
    const [res] = await conn.query(
      `UPDATE student_attendance SET IsDelete = 1
       WHERE Batch_Id = ? AND Attendance_Date = ? AND Session = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
      [batchId, date, session]
    );
    const [lectures] = await conn.query(
      `SELECT Take_Id FROM lecture_taken_master
       WHERE Batch_Id = ? AND Take_Dt = ? AND Lecture_Start = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
      [batchId, date, SLOT_START[session]]
    );
    const takeIds = (lectures as any[]).map((l) => Number(l.Take_Id));
    if (takeIds.length) {
      await conn.query('UPDATE lecture_taken_child SET IsActive = 0, IsDelete = 1 WHERE Take_Id IN (?)', [takeIds]);
      await conn.query('UPDATE lecture_taken_master SET IsActive = 0, IsDelete = 1 WHERE Take_Id IN (?)', [takeIds]);
    }
    return { attendanceRows: Number(res.affectedRows), lecturesRemoved: takeIds };
  });
}
