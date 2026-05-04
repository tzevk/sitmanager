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
      `SELECT Batch_Id, date, batch_name, expires_at
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

    /* ?students=1 — return full student list for dropdown */
    if (req.nextUrl.searchParams.get('students') === '1') {
      const [students] = await pool.query<any[]>(
        `SELECT COALESCE(a.Roll_No, '') AS rollNo, s.Student_Name AS studentName
         FROM admission_master a
         JOIN student_master s ON s.Student_Id = a.Student_Id
         WHERE a.Batch_Id = ? AND (a.IsDelete IS NULL OR a.IsDelete = 0)
           AND a.Roll_No IS NOT NULL AND a.Roll_No != ''
         ORDER BY CAST(a.Roll_No AS UNSIGNED), s.Student_Name`,
        [batchId]
      );
      return NextResponse.json({ students });
    }

    return NextResponse.json({
      batchId,
      date: String(row.date).slice(0, 10),
      batchName: row.batch_name,
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
    const { studentName, rollNo, rating, comments, deviceId } = body as {
      studentName?: string;
      rollNo?: string;
      rating?: number;
      comments?: string;
      deviceId?: string;
    };

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating (1-5) is required' }, { status: 400 });
    }
    if (!rollNo?.trim()) {
      return NextResponse.json({ error: 'Roll number is required' }, { status: 400 });
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
      `INSERT INTO attendance_feedback (token, Batch_Id, date, roll_no, student_name, device_id, rating, comments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [token, rows[0].Batch_Id, rows[0].date, rollNo?.trim() || null, studentName?.trim() || null, deviceId?.trim() || null, rating, comments?.trim() || null]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
