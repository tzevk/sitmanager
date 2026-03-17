/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { SignJWT } from 'jose';
import crypto from 'crypto';

const STUDENT_COOKIE = 'sit_student_session';
const SESSION_DURATION = 60 * 60 * 12; // 12 hours

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET not configured');
  return new TextEncoder().encode(secret);
}

export async function POST(req: NextRequest) {
  try {
    const pool = getPool();
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ success: false, message: 'Username and password are required' }, { status: 400 });
    }

    const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

    const [rows] = await pool.query<any[]>(
      `SELECT spa.*, s.Student_Name, s.Email, s.Present_Mobile, s.Course_Id
       FROM student_portal_auth spa
       JOIN student_master s ON spa.Student_Id = s.Student_Id
       WHERE spa.Username = ? AND spa.Password_Hash = ? AND spa.IsActive = 1
         AND (s.IsDelete = 0 OR s.IsDelete IS NULL)`,
      [username, hashedPassword]
    );

    if (!rows.length) {
      return NextResponse.json({ success: false, message: 'Invalid username or password' }, { status: 401 });
    }

    const user = rows[0];

    // Update last login
    await pool.query(`UPDATE student_portal_auth SET Last_Login = NOW() WHERE Id = ?`, [user.Id]);

    // Create JWT
    const token = await new SignJWT({
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

    response.cookies.set(STUDENT_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION,
    });

    return response;
  } catch (err: unknown) {
    console.error('Student login error:', err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
