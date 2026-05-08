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

function makeTraceId(): string {
  return crypto.randomBytes(6).toString('hex');
}

export async function POST(req: NextRequest) {
  const blocked = await loginRateLimiter(req);
  if (blocked) return blocked;

  try {
    const body = await req.json();
    const mobile = normalizeMobile(body?.mobile);

    if (!mobile) {
      return NextResponse.json({ success: false, message: 'Valid mobile number is required' }, { status: 400 });
    }

    const pool = getPool();

    const [rows] = await pool.query<any[]>(
      `SELECT s.Student_Id, s.Student_Name, s.Email, s.Present_Mobile
       FROM student_master s
       WHERE (s.IsDelete = 0 OR s.IsDelete IS NULL)
         AND (
           (s.Present_Mobile IS NOT NULL AND s.Present_Mobile LIKE CONCAT('%', ?))
           OR (s.Present_Mobile2 IS NOT NULL AND s.Present_Mobile2 LIKE CONCAT('%', ?))
         )
       LIMIT 1`,
      [mobile, mobile]
    );

    const student = rows.length ? rows[0] : null;

    const otp = generateOtp();
    const otpHash = hashOtp(mobile, otp);

    const shouldReturnOtp = process.env.NODE_ENV !== 'production' || process.env.OTP_RETURN_IN_RESPONSE === '1';

    const smsMessage = `Your SIT Student Portal OTP is ${otp}. It is valid for 5 minutes.`;
    try {
      await sendSms(mobile, smsMessage);
    } catch (e: unknown) {
      // If explicitly allowed, keep OTP flow usable without a provider.
      if (!shouldReturnOtp) {
        const providerError = e instanceof Error ? e.message : 'SMS sending failed';
        const traceId = makeTraceId();
        console.error(`Student OTP SMS send error [${traceId}]:`, providerError);

        const isProd = process.env.NODE_ENV === 'production';
        const allowDebugDetails = process.env.OTP_SMS_DEBUG_RESPONSE === '1';
        return NextResponse.json(
          {
            success: false,
            message: isProd && !allowDebugDetails
              ? `OTP delivery service is temporarily unavailable. Ref: ${traceId}`
              : `OTP delivery service failed: ${providerError}`,
          },
          { status: 503 }
        );
      }
      console.warn('[WARN] OTP SMS sending failed, continuing due to OTP_RETURN_IN_RESPONSE mode:', e);
    }

    const otpToken = await new SignJWT({
      type: 'student_otp',
      studentId: student?.Student_Id ?? null,
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
    const message =
      process.env.NODE_ENV !== 'production' && err instanceof Error
        ? err.message
        : 'Server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
