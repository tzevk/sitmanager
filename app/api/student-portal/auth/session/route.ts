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

async function verifyToken(req: NextRequest): Promise<StudentSession | null> {
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

/**
 * The student's portal account state, checked on every request: a valid token
 * alone isn't enough, so deactivating the account (or deleting the student)
 * takes effect on the very next request instead of when the 12-hour token
 * expires. Returns null when there's no active account.
 */
async function loadActiveAccount(studentId: number): Promise<{ mustChangePassword: boolean } | null> {
  const [rows] = await getPool().query<any[]>(
    `SELECT spa.Must_Change_Password
     FROM student_portal_auth spa
     JOIN student_master s ON s.Student_Id = spa.Student_Id
     WHERE spa.Student_Id = ? AND spa.IsActive = 1
       AND (s.IsDelete = 0 OR s.IsDelete IS NULL)
     ORDER BY spa.Id
     LIMIT 1`,
    [studentId]
  );
  return rows.length ? { mustChangePassword: Boolean(rows[0].Must_Change_Password) } : null;
}

/**
 * Authenticated student for a portal API request, or null. Fails closed: if the
 * account check can't be completed the request is treated as signed out.
 */
export async function getStudentSession(req: NextRequest): Promise<StudentSession | null> {
  const session = await verifyToken(req);
  if (!session) return null;
  try {
    const account = await loadActiveAccount(Number(session.studentId));
    if (!account) return null;
    return { ...session, mustChangePassword: account.mustChangePassword };
  } catch (err) {
    console.error('[student-portal] session account check failed:', err);
    return null;
  }
}

// GET — check student session
export async function GET(req: NextRequest) {
  // getStudentSession re-reads the account on every call, so mustChangePassword
  // is the live DB value (the token's copy goes stale after a password change)
  // and a deactivated account comes back as signed out.
  const session = await getStudentSession(req);
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  return NextResponse.json({ authenticated: true, user: session });
}
