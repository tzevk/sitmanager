/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { jwtVerify, SignJWT } from 'jose';
import crypto from 'crypto';
import { loginRateLimiter } from '@/lib/rate-limit';

const STUDENT_COOKIE = 'sit_student_session';
const SESSION_DURATION = 60 * 60 * 12; // 12 hours

const OTP_COOKIE = 'sit_student_otp';

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET not configured');
  return new TextEncoder().encode(secret);
}

function normalizeMobile(input: string): string | null {
  const digits = String(input ?? '').replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length > 10) return digits.slice(-10);
  return null;
}

function hashOtp(mobile: string, otp: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET not configured');
  return crypto.createHash('sha256').update(`${mobile}:${otp}:${secret}`).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

type OtpTokenPayload = {
  type: 'student_otp';
  studentId: number;
  mobile: string;
  otpHash: string;
};

export async function POST(req: NextRequest) {
  const blocked = loginRateLimiter(req);
  if (blocked) return blocked;

  try {
    const body = await req.json();
    const mobile = normalizeMobile(body?.mobile);
    const otp = String(body?.otp ?? '').trim();

    if (!mobile || !otp) {
      return NextResponse.json({ success: false, message: 'Mobile number and OTP are required' }, { status: 400 });
    }

    const otpToken = req.cookies.get(OTP_COOKIE)?.value;
    if (!otpToken) {
      return NextResponse.json({ success: false, message: 'OTP expired. Please request a new OTP.' }, { status: 401 });
    }

    let payload: OtpTokenPayload;
    try {
      const verified = await jwtVerify(otpToken, getSecretKey());
      payload = verified.payload as unknown as OtpTokenPayload;
      if (payload?.type !== 'student_otp') throw new Error('Invalid OTP token');
    } catch {
      return NextResponse.json({ success: false, message: 'OTP expired. Please request a new OTP.' }, { status: 401 });
    }

    if (payload.mobile !== mobile) {
      return NextResponse.json({ success: false, message: 'OTP does not match this mobile number' }, { status: 401 });
    }

    const expectedHash = hashOtp(mobile, otp);
    if (!safeEqualHex(payload.otpHash, expectedHash)) {
      return NextResponse.json({ success: false, message: 'Invalid OTP' }, { status: 401 });
    }

    const pool = getPool();
    const [rows] = await pool.query<any[]>(
      `SELECT spa.*, s.Student_Name, s.Email
       FROM student_portal_auth spa
       JOIN student_master s ON spa.Student_Id = s.Student_Id
       WHERE spa.Student_Id = ? AND spa.IsActive = 1
         AND (s.IsDelete = 0 OR s.IsDelete IS NULL)
       LIMIT 1`,
      [payload.studentId]
    );

    if (!rows.length) {
      return NextResponse.json({ success: false, message: 'Account not found or inactive' }, { status: 401 });
    }

    const user = rows[0];

    await pool.query(`UPDATE student_portal_auth SET Last_Login = NOW() WHERE Id = ?`, [user.Id]);

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

    // Consume OTP token
    response.cookies.set(OTP_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (err: unknown) {
    console.error('Student OTP verify error:', err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
