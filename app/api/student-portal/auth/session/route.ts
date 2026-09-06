/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getPool } from '@/lib/db';

const STUDENT_COOKIE = 'sit_student_session';

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET not configured');
  return new TextEncoder().encode(secret);
}

export interface StudentSession {
  studentId: number;
  name: string;
  email: string;
  type: 'student';
  mustChangePassword?: boolean;
}

export async function getStudentSession(req: NextRequest): Promise<StudentSession | null> {
  const token = req.cookies.get(STUDENT_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if ((payload as any).type !== 'student') return null;
    return payload as unknown as StudentSession;
  } catch {
    return null;
  }
}

// GET — check student session
export async function GET(req: NextRequest) {
  const session = await getStudentSession(req);
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  // mustChangePassword is baked into the JWT at login and never reissued, so a
  // successful password change (which resets the DB flag immediately) would
  // otherwise keep showing the force-change modal on every subsequent
  // navigation for the rest of that session's 12-hour lifetime. Re-check the
  // live DB value instead of trusting the token's stale copy.
  let mustChangePassword = session.mustChangePassword;
  try {
    const pool = getPool();
    const [rows] = await pool.query<any[]>(
      `SELECT Must_Change_Password FROM student_portal_auth WHERE Student_Id = ? AND IsActive = 1 LIMIT 1`,
      [session.studentId]
    );
    if (rows.length) mustChangePassword = Boolean(rows[0].Must_Change_Password);
  } catch {
    // Fall back to the token's value if the DB check fails — never block
    // the session check entirely over this.
  }

  return NextResponse.json({ authenticated: true, user: { ...session, mustChangePassword } });
}
