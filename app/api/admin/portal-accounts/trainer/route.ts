/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import crypto from 'crypto';

export const runtime = 'nodejs';
const DEFAULT_TRAINER_PASSWORD = 'Suvidya@2026';

function md5Hex(value: string): string {
  return crypto.createHash('md5').update(value).digest('hex');
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
  const auth = await requirePermission(req, 'user.create');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json().catch(() => ({} as any));
    const facultyId = Number(body?.facultyId);
    const providedUsername = String(body?.username ?? '').trim();
    const providedPassword = String(body?.password ?? '').trim();
    const isActive = body?.isActive === false ? 0 : 1;

    if (!Number.isFinite(facultyId) || facultyId <= 0) {
      return NextResponse.json({ success: false, message: 'facultyId is required' }, { status: 400 });
    }
    const pool = getPool();
    await ensureTrainerAuthTable(pool);

    const [facultyRows] = await pool.query<any[]>(
      `SELECT Faculty_Id, Faculty_Name
       FROM faculty_master
       WHERE Faculty_Id = ?
         AND (IsDelete = 0 OR IsDelete IS NULL)
       LIMIT 1`,
      [facultyId]
    );

    if (!facultyRows.length) {
      return NextResponse.json(
        { success: false, message: 'Trainer not found or deleted. Create/select a valid trainer record first.' },
        { status: 400 }
      );
    }

    const facultyName = String(facultyRows[0]?.Faculty_Name ?? '').trim();
    const username = providedUsername || facultyName;
    const password = providedPassword || DEFAULT_TRAINER_PASSWORD;

    if (!username) {
      return NextResponse.json({ success: false, message: 'Unable to derive username from trainer name' }, { status: 400 });
    }

    const passwordHash = md5Hex(password);

    await pool.query(
      `INSERT INTO trainer_portal_auth (Faculty_Id, Username, Password_Hash, IsActive)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         Faculty_Id = VALUES(Faculty_Id),
         Password_Hash = VALUES(Password_Hash),
         IsActive = VALUES(IsActive)`,
      [facultyId, username, passwordHash, isActive]
    );

    return NextResponse.json({
      success: true,
      username,
      facultyId,
      isActive: Boolean(isActive),
      defaultPasswordApplied: !providedPassword,
    });
  } catch (err: unknown) {
    console.error('Admin create trainer account error:', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
