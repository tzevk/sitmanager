/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getStudentSession } from '../session/route';
import { encryptPassword } from '@/lib/student-password-crypto';

export async function POST(req: NextRequest) {
  try {
    const session = await getStudentSession(req);
    if (!session) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));
    const newPassword = String(body?.newPassword ?? '');
    const confirmPassword = String(body?.confirmPassword ?? '');

    if (!newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, message: 'New password and confirmation are required' },
        { status: 400 }
      );
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ success: false, message: 'Passwords do not match' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    const encrypted = encryptPassword(newPassword);

    const pool = getPool();
    await pool.query(
      `UPDATE student_portal_auth SET Password_Enc = ?, Must_Change_Password = 0 WHERE Student_Id = ?`,
      [encrypted, session.studentId]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Student change-password error:', err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
