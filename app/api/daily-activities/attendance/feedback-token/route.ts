/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { randomBytes } from 'crypto';

async function ensureTokenTable(pool: any) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance_feedback_token (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      token      VARCHAR(64) NOT NULL UNIQUE,
      Batch_Id   INT NOT NULL,
      date       DATE NOT NULL,
      batch_name VARCHAR(100) NULL,
      trainer_id INT NULL,
      trainer_name VARCHAR(150) NULL,
      trainer_time_from TIME NULL,
      trainer_time_to TIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      INDEX idx_token (token)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [cols] = await pool.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'attendance_feedback_token'`
  );
  const colNames = new Set((cols as any[]).map((row) => String(row.COLUMN_NAME)));
  if (!colNames.has('trainer_id')) {
    await pool.query(`ALTER TABLE attendance_feedback_token ADD COLUMN trainer_id INT NULL AFTER batch_name`);
  }
  if (!colNames.has('trainer_name')) {
    await pool.query(`ALTER TABLE attendance_feedback_token ADD COLUMN trainer_name VARCHAR(150) NULL AFTER trainer_id`);
  }
  if (!colNames.has('trainer_time_from')) {
    await pool.query(`ALTER TABLE attendance_feedback_token ADD COLUMN trainer_time_from TIME NULL AFTER trainer_name`);
  }
  if (!colNames.has('trainer_time_to')) {
    await pool.query(`ALTER TABLE attendance_feedback_token ADD COLUMN trainer_time_to TIME NULL AFTER trainer_time_from`);
  }
}

/* POST /api/daily-activities/attendance/feedback-token
  Body: { batchId, date, batchName?, trainerId?, trainerName?, trainerTimeFrom?, trainerTimeTo? }
   Returns: { token, url, expiresAt }
*/
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'attendance.create');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureTokenTable(pool);

    const { batchId, date, batchName, trainerId, trainerName, trainerTimeFrom, trainerTimeTo } = await req.json();
    if (!batchId || !date) {
      return NextResponse.json({ error: 'batchId and date are required' }, { status: 400 });
    }

    const token = randomBytes(24).toString('hex');
    // valid for 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO attendance_feedback_token (
         token, Batch_Id, date, batch_name, trainer_id, trainer_name, trainer_time_from, trainer_time_to, expires_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE token = token`,
      [
        token,
        batchId,
        date,
        batchName || null,
        Number.isFinite(Number(trainerId)) && Number(trainerId) > 0 ? Number(trainerId) : null,
        trainerName?.trim() || null,
        trainerTimeFrom || null,
        trainerTimeTo || null,
        expiresAt,
      ]
    );

    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const host  = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
      || (host ? `${proto}://${host}` : null)
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'https://suvidya.app';
    const url = `${baseUrl}/public/feedback/${token}`;

    return NextResponse.json({ token, url, expiresAt: expiresAt.toISOString() });
  } catch (err: any) {
    console.error('Feedback token POST error:', err);
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
