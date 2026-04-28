/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

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
    await ensureAttendanceTable(pool);

    const { searchParams } = new URL(req.url);
    const options  = searchParams.get('options');
    const batchId  = searchParams.get('batchId');
    const date     = searchParams.get('date');
    const sessionRaw = (searchParams.get('session') || 'first_half').toLowerCase();
    const session = sessionRaw === 'second_half' ? 'second_half' : 'first_half';

    /* --- courses dropdown --- */
    if (options === 'courses') {
      const [courses] = await pool.query<any[]>(`
        SELECT Course_Id, Course_Name
        FROM course_mst
        WHERE (IsDelete = 0 OR IsDelete IS NULL) AND IsActive = 1
        ORDER BY Course_Name
      `);
      return NextResponse.json({ courses });
    }

    /* --- batches dropdown --- */
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
      return NextResponse.json({ batches });
    }

    /* --- students + today's attendance for batch+date --- */
    if (batchId && date) {
      const [students] = await pool.query<any[]>(
        `SELECT
           a.Admission_Id,
           s.Student_Id,
           a.Student_Code,
           s.Student_Name AS studentName,
           COALESCE(a.Roll_No, '') AS rollNo,
           s.Present_Mobile AS mobile,
           COALESCE(att.Status, '') AS attendanceStatus,
           att.Attendance_Id,
           att.In_Time,
           att.Out_Time
         FROM admission_master a
         JOIN student_master s ON a.Student_Id = s.Student_Id
         LEFT JOIN student_attendance att
           ON att.Student_Id = s.Student_Id
           AND att.Batch_Id  = a.Batch_Id
           AND att.Attendance_Date = ?
           AND att.Session = ?
           AND (att.IsDelete = 0 OR att.IsDelete IS NULL)
         WHERE a.Batch_Id = ?
           AND (a.IsDelete = 0 OR a.IsDelete IS NULL)
           AND (a.Cancel   = 0 OR a.Cancel   IS NULL)
         ORDER BY
           CASE WHEN a.Roll_No IS NULL OR a.Roll_No = '' THEN 1 ELSE 0 END,
           a.Roll_No + 0, s.Student_Name`,
        [date, session, Number(batchId)]
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
    const { batchId, date, session: sessionRaw, records } = body as {
      batchId: number;
      date: string;
      session?: 'first_half' | 'second_half';
      records: { studentId: number; admissionId: number; status: 'P' | 'A' | 'L'; In_Time?: string; Out_Time?: string }[];
    };
    const session = sessionRaw === 'second_half' ? 'second_half' : 'first_half';

    if (!batchId || !date || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'batchId, date and records are required' }, { status: 400 });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

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
