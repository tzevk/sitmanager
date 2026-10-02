/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { PortalAccountError, saveStudentPortalAccount } from '@/lib/student-portal-accounts';
import { decryptPassword } from '@/lib/student-password-crypto';

export const runtime = 'nodejs';

async function ensureStudentAuthTable(pool: any) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_portal_auth (
      Id INT NOT NULL AUTO_INCREMENT,
      Student_Id INT NOT NULL,
      Username VARCHAR(100) NOT NULL,
      Password_Hash CHAR(32) NOT NULL,
      Password_Enc VARBINARY(512) NULL,
      Must_Change_Password TINYINT(1) NOT NULL DEFAULT 0,
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
         spa.IsActive   AS account_active,
         spa.Password_Enc AS password_enc,
         spa.Must_Change_Password AS must_change_password
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

    // Staff can see each account's current password (by decision of the
    // institute). Note this includes a password the student chose themselves
    // after the forced change at first sign-in.
    const resultRows = rows.map((r) => {
      const { password_enc, must_change_password, ...rest } = r;
      let current_password: string | null = null;
      if (password_enc) {
        try {
          current_password = decryptPassword(Buffer.from(password_enc));
        } catch (err) {
          console.error(`Failed to decrypt password for Student_Id=${r.Student_Id}:`, err);
        }
      }
      return { ...rest, current_password, must_change_password: Boolean(must_change_password) };
    });

    return NextResponse.json({ success: true, rows: resultRows });
  } catch (err: unknown) {
    console.error('Admin list student accounts error:', err);
    return NextResponse.json({ success: false, message: 'Unable to load student accounts.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'user.create');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json().catch(() => ({} as any));
    const pool = getPool();
    await ensureStudentAuthTable(pool);

    const result = await saveStudentPortalAccount(pool, {
      studentId: Number(body?.studentId),
      username: String(body?.username ?? ''),
      password: typeof body?.password === 'string' ? body.password : undefined,
      resetPassword: body?.resetPassword === true,
      isActive: body?.isActive !== false,
    });

    return NextResponse.json({
      success: true,
      action: result.action,
      username: result.username,
      passwordReset: result.passwordReset,
      studentId: Number(body?.studentId),
      isActive: body?.isActive !== false,
    });
  } catch (err: unknown) {
    if (err instanceof PortalAccountError) {
      return NextResponse.json({ success: false, message: err.message }, { status: err.status });
    }
    console.error('Admin create student account error:', err);
    return NextResponse.json({ success: false, message: 'Unable to save the student account.' }, { status: 500 });
  }
}
