/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import crypto from 'crypto';

export const runtime = 'nodejs';

function md5Hex(value: string): string {
  return crypto.createHash('md5').update(value).digest('hex');
}

async function ensureStudentAuthTable(pool: any) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_portal_auth (
      Id INT NOT NULL AUTO_INCREMENT,
      Student_Id INT NOT NULL,
      Username VARCHAR(100) NOT NULL,
      Password_Hash CHAR(32) NOT NULL,
      IsActive TINYINT NOT NULL DEFAULT 1,
      Created_Date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      Last_Login DATETIME DEFAULT NULL,
      PRIMARY KEY (Id),
      UNIQUE KEY uniq_username (Username),
      INDEX idx_student_id (Student_Id),
      INDEX idx_isactive (IsActive)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'user.create');
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const batchId = Number(searchParams.get('batchId'));
    if (!batchId) return NextResponse.json({ success: false, message: 'batchId is required' }, { status: 400 });

    const pool = getPool();
    await ensureStudentAuthTable(pool);

    const [rows] = await pool.query<any[]>(
      `SELECT
         a.Student_Id,
         a.Roll_No,
         s.Student_Name,
         s.Email,
         s.Present_Mobile,
         spa.Id         AS auth_id,
         spa.Username   AS existing_username,
         spa.IsActive   AS account_active
       FROM admission_master a
       JOIN student_master s ON s.Student_Id = a.Student_Id
       LEFT JOIN student_portal_auth spa ON spa.Student_Id = a.Student_Id
       WHERE a.Batch_Id = ?
         AND (a.IsDelete = 0 OR a.IsDelete IS NULL)
         AND (a.Cancel   = 0 OR a.Cancel   IS NULL)
         AND (s.IsDelete = 0 OR s.IsDelete IS NULL)
       ORDER BY
         CASE WHEN a.Roll_No IS NULL OR a.Roll_No = '' THEN 1 ELSE 0 END,
         a.Roll_No + 0, s.Student_Name`,
      [batchId]
    );

    return NextResponse.json({ success: true, rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    console.error('Admin list student accounts error:', err);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'user.create');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json().catch(() => ({} as any));
    const studentId = Number(body?.studentId);
    const username = String(body?.username ?? '').trim();
    const password = String(body?.password ?? '');
    const isActive = body?.isActive === false ? 0 : 1;

    if (!Number.isFinite(studentId) || studentId <= 0) {
      return NextResponse.json({ success: false, message: 'studentId is required' }, { status: 400 });
    }
    if (!username) {
      return NextResponse.json({ success: false, message: 'username is required' }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ success: false, message: 'password is required' }, { status: 400 });
    }

    const pool = getPool();
    await ensureStudentAuthTable(pool);

    const [studentRows] = await pool.query<any[]>(
      `SELECT Student_Id
       FROM student_master
       WHERE Student_Id = ?
         AND (IsDelete = 0 OR IsDelete IS NULL)
       LIMIT 1`,
      [studentId]
    );

    if (!studentRows.length) {
      return NextResponse.json(
        { success: false, message: 'Student not found or deleted. Create/select a valid student record first.' },
        { status: 400 }
      );
    }

    const passwordHash = md5Hex(password);

    // Upsert by username; usernames are unique across student_portal_auth.
    await pool.query(
      `INSERT INTO student_portal_auth (Student_Id, Username, Password_Hash, IsActive)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         Student_Id = VALUES(Student_Id),
         Password_Hash = VALUES(Password_Hash),
         IsActive = VALUES(IsActive)`,
      [studentId, username, passwordHash, isActive]
    );

    return NextResponse.json({ success: true, username, studentId, isActive: Boolean(isActive) });
  } catch (err: unknown) {
    console.error('Admin create student account error:', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
