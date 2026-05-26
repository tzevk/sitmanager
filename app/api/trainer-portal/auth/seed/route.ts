/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import crypto from 'crypto';

export const runtime = 'nodejs';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.SEED_SECRET;

  // Convenience for local/dev testing.
  if (process.env.NODE_ENV !== 'production' && !secret) return true;

  if (!secret) return false;

  const auth = req.headers.get('authorization');
  if (auth && auth.trim() === `Bearer ${secret}`) return true;

  const headerSecret = req.headers.get('x-seed-secret');
  if (headerSecret && headerSecret === secret) return true;

  return false;
}

function md5Hex(value: string): string {
  return crypto.createHash('md5').update(value).digest('hex');
}

function randomUsername(): string {
  const suffix = crypto.randomBytes(2).toString('hex');
  return `trainer_test_${suffix}`;
}

function randomPassword(): string {
  // 16 chars, URL-safe-ish, good enough for testing
  return crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
}

async function ensureTrainerAuthTable(pool: any) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trainer_portal_auth (
      Id INT NOT NULL AUTO_INCREMENT,
      Faculty_Id INT NOT NULL,
      Username VARCHAR(100) NOT NULL,
      Password_Hash CHAR(32) NOT NULL,
      IsActive TINYINT NOT NULL DEFAULT 1,
      Created_Date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      Last_Login DATETIME DEFAULT NULL,
      PRIMARY KEY (Id),
      UNIQUE KEY uniq_username (Username),
      INDEX idx_faculty_id (Faculty_Id),
      INDEX idx_isactive (IsActive)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message:
            'Seed endpoint is disabled. Set SEED_SECRET and call with Authorization: Bearer <secret>.',
        },
        { status: 401 }
      );
    }

    const pool = getPool();
    await ensureTrainerAuthTable(pool);

    const body = await req.json().catch(() => ({} as any));
    const requestedUsername = typeof body.username === 'string' && body.username.trim() ? body.username.trim() : null;
    const requestedPassword = typeof body.password === 'string' && body.password ? body.password : null;

    const username = requestedUsername || randomUsername();
    const password = requestedPassword || randomPassword();

    // Prefer attaching the trainer auth to an existing faculty to avoid guessing faculty_master schema.
    const [facultyRows] = await pool.query<any[]>(
      `SELECT Faculty_Id, Faculty_Name
       FROM faculty_master
       WHERE (IsDelete = 0 OR IsDelete IS NULL)
       ORDER BY Faculty_Id DESC
       LIMIT 1`
    );

    let facultyId: number | null = facultyRows?.[0]?.Faculty_Id ?? null;

    if (!facultyId) {
      // Fallback: attempt minimal insert. If schema requires more fields, user must create a faculty record first.
      try {
        const [result] = await pool.query<any>(
          `INSERT INTO faculty_master (Faculty_Name, IsActive, IsDelete) VALUES (?, 1, 0)`,
          ['Test Trainer']
        );
        facultyId = Number(result?.insertId || 0) || null;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json(
          {
            success: false,
            error: 'No trainer records found',
            message:
              'Could not create a trainer record automatically. Create one in Masters → Trainer (or insert into faculty_master), then retry seed.\n' +
              `DB error: ${message}`,
          },
          { status: 400 }
        );
      }
    }

    const passwordHash = md5Hex(password);

    await pool.query(
      `INSERT INTO trainer_portal_auth (Faculty_Id, Username, Password_Hash, IsActive)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE Faculty_Id = VALUES(Faculty_Id), Password_Hash = VALUES(Password_Hash), IsActive = 1`,
      [facultyId, username, passwordHash]
    );

    return NextResponse.json({
      success: true,
      username,
      password,
      facultyId,
      note: 'Testing-only credentials. Disable/rotate in production.',
    });
  } catch (err: unknown) {
    console.error('Trainer seed error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
