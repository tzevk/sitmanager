/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { SignJWT } from 'jose';
import crypto from 'crypto';
import { loginRateLimiter } from '@/lib/rate-limit';
import { sendSms } from '@/lib/sms';

const OTP_COOKIE = 'sit_student_otp';
const OTP_DURATION_SECONDS = 60 * 5; // 5 minutes

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

function generateOtp(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function hashOtp(mobile: string, otp: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET not configured');
  return crypto.createHash('sha256').update(`${mobile}:${otp}:${secret}`).digest('hex');
}

export async function POST(req: NextRequest) {
  const blocked = loginRateLimiter(req);
  if (blocked) return blocked;

  try {
    const body = await req.json();
    const mobile = normalizeMobile(body?.mobile);

    if (!mobile) {
      return NextResponse.json({ success: false, message: 'Valid mobile number is required' }, { status: 400 });
    }

    const pool = getPool();

    const [rows] = await pool.query<any[]>(
      `SELECT spa.Student_Id, spa.Id as Auth_Id, s.Student_Name, s.Email, s.Present_Mobile
       FROM student_portal_auth spa
       JOIN student_master s ON spa.Student_Id = s.Student_Id
       WHERE spa.IsActive = 1
         AND (s.IsDelete = 0 OR s.IsDelete IS NULL)
         AND (
           (s.Present_Mobile IS NOT NULL AND s.Present_Mobile LIKE CONCAT('%', ?))
           OR (s.Present_Mobile2 IS NOT NULL AND s.Present_Mobile2 LIKE CONCAT('%', ?))
         )
       LIMIT 1`,
      [mobile, mobile]
    );

    // Always return a generic success to reduce account enumeration.
    // Only set an OTP cookie if a matching, active student exists.
    if (!rows.length) {
      return NextResponse.json({ success: true, message: 'If the mobile number is registered, an OTP has been sent.' });
    }

    const student = rows[0];

    const otp = generateOtp();
    const otpHash = hashOtp(mobile, otp);

    const shouldReturnOtp = process.env.NODE_ENV !== 'production' || process.env.OTP_RETURN_IN_RESPONSE === '1';

    const smsMessage = `Your SIT Student Portal OTP is ${otp}. It is valid for 5 minutes.`;
    try {
      await sendSms(mobile, smsMessage);
    } catch (e) {
      // If explicitly allowed, keep OTP flow usable without a provider.
      if (!shouldReturnOtp) throw e;
      console.warn('[WARN] OTP SMS sending failed, continuing due to OTP_RETURN_IN_RESPONSE mode:', e);
    }

    const otpToken = await new SignJWT({
      type: 'student_otp',
      studentId: student.Student_Id,
      mobile,
      otpHash,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${OTP_DURATION_SECONDS}s`)
      .sign(getSecretKey());

    const responseBody: Record<string, unknown> = {
      success: true,
      message: 'If the mobile number is registered, an OTP has been sent.',
    };

    if (shouldReturnOtp) {
      responseBody.devOtp = otp;
    }

    const response = NextResponse.json(responseBody);
    response.cookies.set(OTP_COOKIE, otpToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: OTP_DURATION_SECONDS,
    });

    return response;
  } catch (err: unknown) {
    console.error('Student OTP request error:', err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
