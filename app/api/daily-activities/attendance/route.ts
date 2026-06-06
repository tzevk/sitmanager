/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

type DisciplineGroup = { name: string; subtopics: string[] };

function uniqNonEmpty(values: Array<string | null | undefined>) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const s = String(value ?? '').trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function toActivityFlags(activityType: string | null | undefined) {
  if (activityType === 'assignment') return { assignGiven: 1, testGiven: 0 };
  if (activityType === 'test') return { assignGiven: 0, testGiven: 1 };
  return { assignGiven: null, testGiven: null };
}

function buildTopicSummary(topics: string[], subtopics: string[]) {
  const topicText = topics.join(', ');
  const subtopicText = subtopics.join(', ');
  return [
    topicText ? `Topic: ${topicText}` : '',
    subtopicText ? `Subtopic: ${subtopicText}` : '',
  ].filter(Boolean).join(' | ') || null;
}

// Auto-create attendance table on first use
let tableReady = false;
async function ensureAttendanceTable(pool: any) {
  if (tableReady) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_attendance (
        Attendance_Id INT AUTO_INCREMENT PRIMARY KEY,
        Batch_Id      INT      NOT NULL,
        Student_Id    INT      NOT NULL,
        Admission_Id  INT      NOT NULL,
        Attendance_Date DATE   NOT NULL,
        Session       ENUM('first_half','second_half') NOT NULL DEFAULT 'first_half',
        In_Time       TIME     NULL,
        Out_Time      TIME     NULL,
        Status        CHAR(1)  NOT NULL DEFAULT 'P' COMMENT 'P=Present, A=Absent, L=Late',
        Remarks       VARCHAR(255) NULL,
        Created_At    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        Updated_At    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        IsDelete      TINYINT(1) DEFAULT 0,
        UNIQUE KEY uq_attendance (Batch_Id, Student_Id, Attendance_Date, Session)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const [sessionCol] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'student_attendance'
         AND COLUMN_NAME = 'Session'`
    );
    if (!sessionCol?.[0]?.cnt) {
      await pool.query(
        `ALTER TABLE student_attendance
         ADD COLUMN Session ENUM('first_half','second_half') NOT NULL DEFAULT 'first_half' AFTER Attendance_Date`
      );
    }

    // ensure In_Time and Out_Time columns exist
    const [inTimeCol] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'student_attendance'
         AND COLUMN_NAME = 'In_Time'`
    );
    if (!inTimeCol?.[0]?.cnt) {
      await pool.query(`ALTER TABLE student_attendance ADD COLUMN In_Time TIME NULL AFTER Session`);
    }
    const [outTimeCol] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'student_attendance'
         AND COLUMN_NAME = 'Out_Time'`
    );
    if (!outTimeCol?.[0]?.cnt) {
      await pool.query(`ALTER TABLE student_attendance ADD COLUMN Out_Time TIME NULL AFTER In_Time`);
    }

    const [uniqIdx] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'student_attendance'
         AND INDEX_NAME = 'uq_attendance'`
    );
    if (uniqIdx?.[0]?.cnt) {
      await pool.query(`ALTER TABLE student_attendance DROP INDEX uq_attendance`);
    }
    await pool.query(
      `ALTER TABLE student_attendance
       ADD UNIQUE KEY uq_attendance (Batch_Id, Student_Id, Attendance_Date, Session)`
    );

    tableReady = true;
  } catch {
    tableReady = true;
  }
}

/* ─── GET ─────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'attendance.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();

    const { searchParams } = new URL(req.url);
    const options  = searchParams.get('options');
    const batchId  = searchParams.get('batchId');
    const date     = searchParams.get('date');
    const sessionRaw = (searchParams.get('session') || 'first_half').toLowerCase();
    const session = sessionRaw === 'second_half' ? 'second_half' : 'first_half';

    /* --- courses dropdown — no schema check needed, fast path --- */
    if (options === 'courses') {
      const [courses] = await pool.query<any[]>(`
        SELECT Course_Id, Course_Name
        FROM course_mst
        WHERE (IsDelete = 0 OR IsDelete IS NULL)
          AND (IsActive = 1 OR IsActive IS NULL)
        ORDER BY Course_Name
      `);
      return NextResponse.json({ courses }, {
        headers: { 'Cache-Control': 'private, max-age=60' },
      });
    }

    /* --- batches dropdown — no schema check needed, fast path --- */
    if (options === 'batches') {
      const courseId = searchParams.get('courseId');
      if (!courseId) return NextResponse.json({ batches: [] });
      const [batches] = await pool.query<any[]>(
        `SELECT Batch_Id, Batch_code, Category, Timings
         FROM batch_mst
         WHERE Course_Id = ? AND IsActive = 1
           AND (IsDelete = 0 OR IsDelete IS NULL)
           AND (Cancel = 0 OR Cancel IS NULL)
         ORDER BY Batch_Id DESC`,
        [Number(courseId)]
      );
      return NextResponse.json({ batches }, {
        headers: { 'Cache-Control': 'private, max-age=60' },
      });
    }

    if (options === 'faculties') {
      const [faculties] = await pool.query<any[]>(
        `SELECT Faculty_Id, Faculty_Name
         FROM faculty_master
         WHERE (IsDelete = 0 OR IsDelete IS NULL)
         ORDER BY Faculty_Name`
      );
      return NextResponse.json({ faculties }, {
        headers: { 'Cache-Control': 'private, max-age=60' },
      });
    }

    if (options === 'lecture-topics') {
      if (!batchId) return NextResponse.json({ disciplines: [] });

      const [stdRows] = await pool.query<any[]>(
        `SELECT lecturecontent, subject, subject_topic
         FROM batch_slecture_master
         WHERE batch_id = ? AND (deleted IS NULL OR deleted = '0' OR deleted = 0)
         ORDER BY lecture_no ASC, date ASC, id ASC`,
        [Number(batchId)]
      );

      let rows = Array.isArray(stdRows) ? stdRows : [];
      const hasAnySubjects = rows.some((r) => ((r?.lecturecontent ?? r?.subject) ?? '').trim());

      if (!hasAnySubjects) {
        const [fallbackRows] = await pool.query<any[]>(
          `SELECT lecturecontent, subject, subject_topic
           FROM batch_lecture_master
           WHERE batch_id = ? AND (deleted IS NULL OR deleted = '0' OR deleted = 0)
           ORDER BY lecture_no ASC, date ASC, id ASC`,
          [Number(batchId)]
        );
        rows = Array.isArray(fallbackRows) ? fallbackRows : [];
      }

      const groups = new Map<string, { display: string; subtopics: string[] }>();

      for (const row of rows) {
        const discipline = uniqNonEmpty([row?.lecturecontent, row?.subject])[0];
        if (!discipline) continue;
        const key = discipline.toLowerCase();
        if (!groups.has(key)) groups.set(key, { display: discipline, subtopics: [] });

        const subtopic = String(row?.subject_topic ?? '').trim();
        if (subtopic) groups.get(key)!.subtopics.push(subtopic);
      }

      const disciplines: DisciplineGroup[] = Array.from(groups.values()).map((group) => ({
        name: group.display,
        subtopics: uniqNonEmpty(group.subtopics),
      }));

      return NextResponse.json({ disciplines }, {
        headers: { 'Cache-Control': 'private, max-age=60' },
      });
    }

    // Schema check only runs for the student+attendance query, not for dropdowns
    await ensureAttendanceTable(pool);

    /* --- students + today's attendance for batch+date --- */
    if (batchId && date) {
      // Use derived tables to eliminate duplicates from two sources:
      // 1. admission_master: a student may have multiple records for the same batch
      //    (e.g. cancelled + re-admitted). GROUP BY Student_Id picks MIN(Admission_Id).
      // 2. student_attendance: stale duplicate rows before the unique key existed.
      //    GROUP BY Student_Id picks the latest (MAX) attendance record.
      const [students] = await pool.query<any[]>(
        `SELECT
           a.Admission_Id,
           s.Student_Id,
           a.Student_Code,
           s.Student_Name AS studentName,
           COALESCE(a.Roll_No, '') AS rollNo,
           COALESCE(NULLIF(TRIM(s.Present_Mobile), ''), NULLIF(TRIM(s.Present_Mobile2), '')) AS mobile,
           COALESCE(att.Status, '') AS attendanceStatus,
           att.Attendance_Id,
           att.In_Time,
           att.Out_Time
         FROM (
           SELECT
             MIN(Admission_Id) AS Admission_Id,
             Student_Id,
             MAX(Student_Code) AS Student_Code,
             MAX(Roll_No)      AS Roll_No
           FROM admission_master
           WHERE Batch_Id = ?
             AND (IsDelete = 0 OR IsDelete IS NULL)
             AND (Cancel   = 0 OR Cancel   IS NULL)
           GROUP BY Student_Id
         ) a
         JOIN student_master s ON a.Student_Id = s.Student_Id
         LEFT JOIN (
           SELECT
             Student_Id,
             MAX(Attendance_Id) AS Attendance_Id,
             MAX(Status)        AS Status,
             MAX(In_Time)       AS In_Time,
             MAX(Out_Time)      AS Out_Time
           FROM student_attendance
           WHERE Batch_Id = ?
             AND Attendance_Date = ?
             AND Session = ?
             AND (IsDelete = 0 OR IsDelete IS NULL)
           GROUP BY Student_Id
         ) att ON att.Student_Id = a.Student_Id
         ORDER BY
           CASE WHEN a.Roll_No IS NULL OR a.Roll_No = '' THEN 1 ELSE 0 END,
           a.Roll_No + 0, s.Student_Name`,
        [Number(batchId), Number(batchId), date, session]
      );

      /* summary counts */
      const present = students.filter((s) => s.attendanceStatus === 'P').length;
      const absent  = students.filter((s) => s.attendanceStatus === 'A').length;

      return NextResponse.json({ students, summary: { present, absent, total: students.length }, session });
    }

    return NextResponse.json({ error: 'Missing required params' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Attendance GET error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ─── POST — save / overwrite attendance for a batch+date ─────────── */
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'attendance.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    await ensureAttendanceTable(pool);

    const body = await req.json();
    const { batchId, date, session: sessionRaw, records, trainerId, trainerTimeFrom, trainerTimeTo, topics, subtopics, activityType } = body as {
      batchId: number;
      date: string;
      session?: 'first_half' | 'second_half';
      records: { studentId: number; admissionId: number; status: 'P' | 'A' | 'L'; In_Time?: string; Out_Time?: string }[];
      trainerId?: number | string | null;
      trainerTimeFrom?: string | null;
      trainerTimeTo?: string | null;
      topics?: string[];
      subtopics?: string[];
      activityType?: 'lecture' | 'assignment' | 'test';
    };
    const session = sessionRaw === 'second_half' ? 'second_half' : 'first_half';
    const normalizedTrainerId = Number.isFinite(Number(trainerId)) && Number(trainerId) > 0 ? Number(trainerId) : null;
    const normalizedTrainerTimeFrom = trainerTimeFrom || null;
    const normalizedTrainerTimeTo = trainerTimeTo || null;
    const normalizedTopics = uniqNonEmpty(Array.isArray(topics) ? topics : []);
    const normalizedSubtopics = uniqNonEmpty(Array.isArray(subtopics) ? subtopics : []);
    const normalizedActivityType = activityType === 'assignment' || activityType === 'test' || activityType === 'lecture'
      ? activityType
      : null;
    const { assignGiven, testGiven } = toActivityFlags(normalizedActivityType);
    const topicSummary = buildTopicSummary(normalizedTopics, normalizedSubtopics);
    const lectureName = normalizedTopics.join(', ') || null;

    if (!batchId || !date || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'batchId, date and records are required' }, { status: 400 });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Save to student_attendance
      for (const rec of records) {
        await conn.query(
          `INSERT INTO student_attendance
             (Batch_Id, Student_Id, Admission_Id, Attendance_Date, Session, Status, In_Time, Out_Time, IsDelete)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
           ON DUPLICATE KEY UPDATE
             Status     = VALUES(Status),
             Admission_Id = VALUES(Admission_Id),
             Session    = VALUES(Session),
             In_Time    = VALUES(In_Time),
             Out_Time   = VALUES(Out_Time),
             IsDelete   = 0,
             Updated_At = CURRENT_TIMESTAMP`,
          [batchId, rec.studentId, rec.admissionId, date, session, rec.status, rec.In_Time || null, rec.Out_Time || null]
        );
      }

      // 2. Sync to lecture_taken_master + lecture_taken_child for final report
      const lectureStart = session === 'second_half' ? '02:00PM' : '09:00AM';

      // Get Course_Id for this batch
      const [batchRows] = await conn.query<any[]>(
        `SELECT Course_Id FROM batch_mst WHERE Batch_Id = ? LIMIT 1`,
        [batchId]
      );
      const courseId = batchRows[0]?.Course_Id ?? null;

      // Find or create the lecture_taken_master record for (Batch_Id, date, session)
      const [existingLecture] = await conn.query<any[]>(
        `SELECT MAX(Take_Id) AS Take_Id
         FROM lecture_taken_master
         WHERE Batch_Id = ? AND Take_Dt = ? AND Lecture_Start = ?
           AND (IsDelete = 0 OR IsDelete IS NULL)`,
        [batchId, date, lectureStart]
      );
      let takeId: number = existingLecture[0]?.Take_Id ?? null;

      if (!takeId) {
        const [ins] = await conn.query<any>(
          `INSERT INTO lecture_taken_master
             (Course_Id, Batch_Id, Faculty_Id, Take_Dt, Lecture_Start, Faculty_Start, Faculty_End, Lecture_Name, Topic, Assign_Given, Test_Given, IsActive, IsDelete)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
          [courseId, batchId, normalizedTrainerId, date, lectureStart, normalizedTrainerTimeFrom, normalizedTrainerTimeTo, lectureName, topicSummary, assignGiven, testGiven]
        );
        takeId = ins.insertId;
      } else {
        await conn.query(
          `UPDATE lecture_taken_master
           SET Faculty_Id = ?,
               Faculty_Start = ?,
               Faculty_End = ?,
               Lecture_Name = COALESCE(?, Lecture_Name),
               Topic = COALESCE(?, Topic),
               Assign_Given = COALESCE(?, Assign_Given),
               Test_Given = COALESCE(?, Test_Given)
           WHERE Take_Id = ?`,
          [normalizedTrainerId, normalizedTrainerTimeFrom, normalizedTrainerTimeTo, lectureName, topicSummary, assignGiven, testGiven, takeId]
        );
      }

      // Get student names in bulk
      const studentIds = records.map((r) => r.studentId);
      const [nameRows] = await conn.query<any[]>(
        `SELECT Student_Id, Student_Name FROM student_master WHERE Student_Id IN (?)`,
        [studentIds]
      );
      const nameMap: Record<number, string> = {};
      for (const row of nameRows) nameMap[row.Student_Id] = row.Student_Name;

      // Upsert lecture_taken_child for each student
      for (const rec of records) {
        const studentName = nameMap[rec.studentId] || '';
        const studentAtten = rec.status === 'A' ? 'Absent' : 'Present';
        const late = rec.status === 'L' ? 'Yes' : 'No';

        const [existing] = await conn.query<any[]>(
          `SELECT ID FROM lecture_taken_child WHERE Take_Id = ? AND Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL) LIMIT 1`,
          [takeId, rec.studentId]
        );

        if (existing.length > 0) {
          await conn.query(
            `UPDATE lecture_taken_child
             SET Student_Atten = ?, Late = ?, IsActive = 1, IsDelete = 0
             WHERE Take_Id = ? AND Student_Id = ?`,
            [studentAtten, late, takeId, rec.studentId]
          );
        } else {
          await conn.query(
            `INSERT INTO lecture_taken_child
               (Take_Id, Student_Id, Student_Name, Student_Atten, Late, IsActive, IsDelete)
             VALUES (?, ?, ?, ?, ?, 1, 0)`,
            [takeId, rec.studentId, studentName, studentAtten, late]
          );
        }
      }

      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    return NextResponse.json({ success: true, saved: records.length, session });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Attendance POST error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
