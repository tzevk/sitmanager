/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { randomBytes } from 'crypto';

const FEEDBACK_SESSIONS = ['first_half', 'second_half'] as const;
type FeedbackSession = (typeof FEEDBACK_SESSIONS)[number];

function buildBaseUrl(req: NextRequest) {
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host  = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  return process.env.NEXT_PUBLIC_BASE_URL
    || (host ? `${proto}://${host}` : null)
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || 'https://suvidya.app';
}

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
      feedback_session VARCHAR(20) NULL,
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
  if (!colNames.has('feedback_session')) {
    await pool.query(`ALTER TABLE attendance_feedback_token ADD COLUMN feedback_session VARCHAR(20) NULL AFTER trainer_time_to`);
  }
}

/* POST /api/daily-activities/attendance/feedback-token
  Body: { batchId, date, batchName?, trainerId?, trainerName?, trainerTimeFrom?, trainerTimeTo? }
  Returns: { links, expiresAt }
*/
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'attendance.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureTokenTable(pool);

    const sp = req.nextUrl.searchParams;
    const batchId = sp.get('batchId');
    const date = sp.get('date');
    if (!batchId || !date) {
      return NextResponse.json({ error: 'batchId and date are required' }, { status: 400 });
    }

    const [rows] = await pool.query(
      `SELECT token, Batch_Id, date, batch_name, trainer_id, trainer_name, trainer_time_from, trainer_time_to, feedback_session, expires_at
       FROM attendance_feedback_token
       WHERE Batch_Id = ?
         AND date = ?
         AND expires_at > NOW()
       ORDER BY created_at DESC, id DESC`,
      [Number(batchId), date]
    );

    const tokenRows = rows as any[];
    if (!tokenRows.length) {
      return NextResponse.json({ links: [], expiresAt: null, trainerId: null, trainerName: null, trainerTimeFrom: null, trainerTimeTo: null });
    }

    const linksBySession = new Map<FeedbackSession, { session: FeedbackSession; token: string; url: string }>();
    for (const row of tokenRows) {
      const session = row.feedback_session as FeedbackSession | null;
      if (!session || !FEEDBACK_SESSIONS.includes(session)) continue;
      if (!linksBySession.has(session)) {
        linksBySession.set(session, {
          session,
          token: row.token,
          url: `${buildBaseUrl(req)}/public/feedback/${row.token}`,
        });
      }
    }

    const latestRow = tokenRows[0];

    return NextResponse.json({
      links: FEEDBACK_SESSIONS.map((session) => linksBySession.get(session)).filter(Boolean),
      expiresAt: latestRow.expires_at instanceof Date ? latestRow.expires_at.toISOString() : new Date(latestRow.expires_at).toISOString(),
      trainerId: latestRow.trainer_id ?? null,
      trainerName: latestRow.trainer_name ?? null,
      trainerTimeFrom: latestRow.trainer_time_from ?? null,
      trainerTimeTo: latestRow.trainer_time_to ?? null,
    });
  } catch (err: any) {
    console.error('Feedback token GET error:', err);
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}

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

    // Valid for 48 hours — generous enough that a link shared once in the morning still
    // works for evening submissions, and for late/next-day makeup feedback.
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const normalizedTrainerId = Number.isFinite(Number(trainerId)) && Number(trainerId) > 0 ? Number(trainerId) : null;

    const links = await Promise.all(FEEDBACK_SESSIONS.map(async (session) => {
      // Attendance gets saved/re-saved multiple times a day (corrections, late marks) and
      // each save used to mint a brand-new token — so several different links ended up
      // being shared across the day for the same session, and whichever one a student
      // held onto could look broken once a newer save superseded it in the UI. Reuse the
      // existing still-valid token for this batch+date+session instead of minting a new
      // one every time, so exactly one link is ever in circulation per session.
      const [existingRows] = await pool.query<any[]>(
        `SELECT token, expires_at FROM attendance_feedback_token
         WHERE Batch_Id = ? AND date = ? AND feedback_session = ? AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [batchId, date, session]
      );

      if (existingRows.length) {
        const existing = existingRows[0];
        // Refresh trainer/batch display info and extend expiry so the same link keeps
        // working through the rest of the (possibly re-saved) session.
        await pool.query(
          `UPDATE attendance_feedback_token
           SET batch_name = ?, trainer_id = ?, trainer_name = ?, trainer_time_from = ?, trainer_time_to = ?, expires_at = ?
           WHERE token = ?`,
          [
            batchName || null,
            normalizedTrainerId,
            trainerName?.trim() || null,
            trainerTimeFrom || null,
            trainerTimeTo || null,
            expiresAt,
            existing.token,
          ]
        );
        return {
          session,
          token: existing.token,
          url: `${buildBaseUrl(req)}/public/feedback/${existing.token}`,
        };
      }

      const token = randomBytes(24).toString('hex');
      await pool.query(
        `INSERT INTO attendance_feedback_token (
           token, Batch_Id, date, batch_name, trainer_id, trainer_name, trainer_time_from, trainer_time_to, feedback_session, expires_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          token,
          batchId,
          date,
          batchName || null,
          normalizedTrainerId,
          trainerName?.trim() || null,
          trainerTimeFrom || null,
          trainerTimeTo || null,
          session,
          expiresAt,
        ]
      );

      return {
        session,
        token,
        url: `${buildBaseUrl(req)}/public/feedback/${token}`,
      };
    }));

    return NextResponse.json({ links, expiresAt: expiresAt.toISOString() });
  } catch (err: any) {
    console.error('Feedback token POST error:', err);
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
