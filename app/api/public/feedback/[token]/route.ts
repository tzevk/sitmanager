/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

/* GET /api/public/feedback/[token]
   - No query params: validate token, return session info
   - ?rollNo=xxx : look up student name in batch, return { studentName }
*/
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || token.length > 64) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const pool = getPool();
    const [rows] = await pool.query<any[]>(
      `SELECT Batch_Id, date, batch_name, trainer_name, trainer_time_from, trainer_time_to, expires_at
       FROM attendance_feedback_token
       WHERE token = ? LIMIT 1`,
      [token]
    );

    if (!rows.length) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }
    const row = rows[0];
    if (new Date(row.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This feedback link has expired' }, { status: 410 });
    }

    const batchId = row.Batch_Id;

    /* ?verify=1&rollNo=X&phone=Y — verify roll number + phone, must be marked present or late */
    if (req.nextUrl.searchParams.get('verify') === '1') {
      const rollNo = req.nextUrl.searchParams.get('rollNo')?.trim() ?? '';
      const phone  = req.nextUrl.searchParams.get('phone')?.trim().replace(/\D/g, '') ?? '';
      if (!rollNo || !phone) {
        return NextResponse.json({ error: 'Roll number and phone are required' }, { status: 400 });
      }
      const [students] = await pool.query<any[]>(
        `SELECT s.Student_Name AS studentName, a.Roll_No AS rollNo
         FROM student_attendance sa
         JOIN admission_master a ON a.Student_Id = sa.Student_Id AND a.Batch_Id = sa.Batch_Id
         JOIN student_master s ON s.Student_Id = sa.Student_Id
         WHERE sa.Batch_Id = ? AND sa.Attendance_Date = ? AND sa.Status IN ('P', 'L')
           AND (sa.IsDelete IS NULL OR sa.IsDelete = 0)
           AND a.Roll_No = ?
           AND REGEXP_REPLACE(COALESCE(s.Present_Mobile,''), '[^0-9]', '') LIKE ?
         LIMIT 1`,
        [batchId, String(row.date).slice(0, 10), rollNo, `%${phone.slice(-10)}`]
      );
      if (!students.length) {
        return NextResponse.json({ error: 'Roll number and phone number do not match, or you are not marked present/late.' }, { status: 403 });
      }
      return NextResponse.json({ studentName: students[0].studentName, rollNo: students[0].rollNo });
    }

    return NextResponse.json({
      batchId,
      date: String(row.date).slice(0, 10),
      batchName: row.batch_name,
      trainerName: row.trainer_name ?? null,
      trainerTimeFrom: row.trainer_time_from ?? null,
      trainerTimeTo: row.trainer_time_to ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}

/* POST /api/public/feedback/[token] — submit feedback */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const pool = getPool();

    const [rows] = await pool.query<any[]>(
      `SELECT Batch_Id, date, expires_at FROM attendance_feedback_token WHERE token = ? LIMIT 1`,
      [token]
    );
    if (!rows.length) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }
    if (new Date(rows[0].expires_at) < new Date()) {
      return NextResponse.json({ error: 'Feedback link has expired' }, { status: 410 });
    }

    const body = await req.json();
    const { studentName, rollNo, rating, comments, firstHalfRating, firstHalfComments, secondHalfRating, secondHalfComments, deviceId } = body as {
      studentName?: string;
      rollNo?: string;
      rating?: number;
      comments?: string;
      firstHalfRating?: number;
      firstHalfComments?: string;
      secondHalfRating?: number;
      secondHalfComments?: string;
      deviceId?: string;
    };

    const normalizedFirstHalfRating = firstHalfRating ?? rating;
    const normalizedSecondHalfRating = secondHalfRating ?? rating;
    const normalizedFirstHalfComments = firstHalfComments ?? comments;
    const normalizedSecondHalfComments = secondHalfComments ?? null;

    if (!normalizedFirstHalfRating || normalizedFirstHalfRating < 1 || normalizedFirstHalfRating > 5) {
      return NextResponse.json({ error: 'First half rating (1-5) is required' }, { status: 400 });
    }
    if (!normalizedSecondHalfRating || normalizedSecondHalfRating < 1 || normalizedSecondHalfRating > 5) {
      return NextResponse.json({ error: 'Second half rating (1-5) is required' }, { status: 400 });
    }
    if (!rollNo?.trim()) {
      return NextResponse.json({ error: 'Roll number is required' }, { status: 400 });
    }

    /* Verify the student was marked present or late for this session */
    const [attendanceCheck] = await pool.query<any[]>(
      `SELECT sa.Attendance_Id
       FROM student_attendance sa
       JOIN admission_master a ON a.Student_Id = sa.Student_Id AND a.Batch_Id = sa.Batch_Id
       WHERE sa.Batch_Id = ? AND sa.Attendance_Date = ? AND sa.Status IN ('P', 'L')
         AND (sa.IsDelete IS NULL OR sa.IsDelete = 0)
         AND a.Roll_No = ?
       LIMIT 1`,
      [rows[0].Batch_Id, rows[0].date, rollNo.trim()]
    );
    if (!attendanceCheck.length) {
      return NextResponse.json(
        { error: 'Your roll number was not marked present or late for this session.' },
        { status: 403 }
      );
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance_feedback (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        token        VARCHAR(64) NOT NULL,
        Batch_Id     INT NOT NULL,
        date         DATE NOT NULL,
        roll_no      VARCHAR(50) NULL,
        student_name VARCHAR(150) NULL,
        device_id    VARCHAR(64) NULL,
        rating       TINYINT NOT NULL,
        comments     TEXT NULL,
        first_half_rating TINYINT NULL,
        first_half_comments TEXT NULL,
        second_half_rating TINYINT NULL,
        second_half_comments TEXT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_batch_date (Batch_Id, date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    /* add missing columns — compatible with MySQL 5.7 and 8.0 */
    const dbName = process.env.DB_NAME;
    const [cols] = await pool.query<any[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_feedback'`,
      [dbName]
    );
    const colNames = (cols as any[]).map((c: any) => c.COLUMN_NAME);
    if (!colNames.includes('roll_no')) {
      await pool.query(`ALTER TABLE attendance_feedback ADD COLUMN roll_no VARCHAR(50) NULL AFTER date`);
    }
    if (!colNames.includes('device_id')) {
      await pool.query(`ALTER TABLE attendance_feedback ADD COLUMN device_id VARCHAR(64) NULL AFTER roll_no`);
    }
    if (!colNames.includes('first_half_rating')) {
      await pool.query(`ALTER TABLE attendance_feedback ADD COLUMN first_half_rating TINYINT NULL AFTER comments`);
    }
    if (!colNames.includes('first_half_comments')) {
      await pool.query(`ALTER TABLE attendance_feedback ADD COLUMN first_half_comments TEXT NULL AFTER first_half_rating`);
    }
    if (!colNames.includes('second_half_rating')) {
      await pool.query(`ALTER TABLE attendance_feedback ADD COLUMN second_half_rating TINYINT NULL AFTER first_half_comments`);
    }
    if (!colNames.includes('second_half_comments')) {
      await pool.query(`ALTER TABLE attendance_feedback ADD COLUMN second_half_comments TEXT NULL AFTER second_half_rating`);
    }

    /* duplicate check — one submission per roll number per session */
    const [existing] = await pool.query<any[]>(
      `SELECT id FROM attendance_feedback WHERE Batch_Id = ? AND date = ? AND roll_no = ? LIMIT 1`,
      [rows[0].Batch_Id, rows[0].date, rollNo!.trim()]
    );
    if (existing.length) {
      return NextResponse.json(
        { error: 'You have already submitted feedback for this session.' },
        { status: 409 }
      );
    }

    /* duplicate check — one submission per device per token */
    if (deviceId?.trim()) {
      const [devExisting] = await pool.query<any[]>(
        `SELECT id FROM attendance_feedback WHERE token = ? AND device_id = ? LIMIT 1`,
        [token, deviceId.trim()]
      );
      if (devExisting.length) {
        return NextResponse.json(
          { error: 'Feedback has already been submitted from this device.' },
          { status: 409 }
        );
      }
    }

    await pool.query(
      `INSERT INTO attendance_feedback (
         token, Batch_Id, date, roll_no, student_name, device_id,
         rating, comments, first_half_rating, first_half_comments, second_half_rating, second_half_comments
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        token,
        rows[0].Batch_Id,
        rows[0].date,
        rollNo?.trim() || null,
        studentName?.trim() || null,
        deviceId?.trim() || null,
        normalizedFirstHalfRating,
        normalizedFirstHalfComments?.trim() || null,
        normalizedFirstHalfRating,
        normalizedFirstHalfComments?.trim() || null,
        normalizedSecondHalfRating,
        normalizedSecondHalfComments?.trim() || null,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
