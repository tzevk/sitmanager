/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { SignJWT } from 'jose';
import { loginRateLimiter } from '@/lib/rate-limit';

const STUDENT_COOKIE = 'sit_student_session';
const SESSION_DURATION = 60 * 60 * 12; // 12 hours

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET not configured');
  return new TextEncoder().encode(secret);
}

export async function POST(req: NextRequest) {
  const blocked = loginRateLimiter(req);
  if (blocked) return blocked;

  try {
    const body = await req.json();
    const rollNo = String(body?.rollNo ?? '').trim();

    if (!rollNo) {
      return NextResponse.json({ success: false, message: 'Roll number is required' }, { status: 400 });
    }

    const pool = getPool();

    const [rows] = await pool.query<any[]>(
      `SELECT s.Student_Id, s.Student_Name, s.Email,
              spa.Id AS Auth_Id
       FROM admission_master a
       JOIN student_master s ON a.Student_Id = s.Student_Id
       LEFT JOIN student_portal_auth spa ON spa.Student_Id = s.Student_Id AND spa.IsActive = 1
       WHERE a.Roll_No = ?
         AND (s.IsDelete = 0 OR s.IsDelete IS NULL)
       LIMIT 1`,
      [rollNo]
    );

    if (!rows.length) {
      return NextResponse.json({ success: false, message: 'Student not found for this roll number' }, { status: 401 });
    }

    const user = rows[0];

    if (user.Auth_Id) {
      await pool.query(`UPDATE student_portal_auth SET Last_Login = NOW() WHERE Id = ?`, [user.Auth_Id]);
    }

    const sessionToken = await new SignJWT({
      studentId: user.Student_Id,
      name: user.Student_Name,
      email: user.Email,
      type: 'student',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${SESSION_DURATION}s`)
      .sign(getSecretKey());

    const response = NextResponse.json({
      success: true,
      user: {
        studentId: user.Student_Id,
        name: user.Student_Name,
        email: user.Email,
      },
    });

    response.cookies.set(STUDENT_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION,
    });

    return response;
  } catch (err: unknown) {
    console.error('Student OTP verify error:', err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
