/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { SignJWT } from 'jose';
import crypto from 'crypto';
import { decryptPassword } from '@/lib/student-password-crypto';
import { checkRateLimitKey, getRequestIp } from '@/lib/rate-limit';

const STUDENT_COOKIE = 'sit_student_session';
const SESSION_DURATION = 60 * 60 * 12; // 12 hours

// Sign-in throttling, counted BEFORE the account lookup so existing and
// non-existent usernames behave identically (no account enumeration).
//  - per IP + username: stops password guessing against one account, without
//    letting an attacker lock the real student out from the student's own IP.
//  - per IP: stops spraying one password across many usernames, while staying
//    loose enough for a classroom signing in together behind one campus IP.
// In-memory and per server instance, like the rest of lib/rate-limit.ts.
const PER_ACCOUNT = { max: 5, windowSeconds: 5 * 60 };
const PER_IP = { max: 60, windowSeconds: 5 * 60 };
const TOO_MANY = 'Too many sign-in attempts. Please wait a few minutes and try again.';

function maskUsername(u: string): string {
  return u.length <= 3 ? '***' : `${u.slice(0, 3)}***(${u.length})`;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET not configured');
  return new TextEncoder().encode(secret);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!username || !password) {
      return NextResponse.json({ success: false, message: 'Username and password are required' }, { status: 400 });
    }

    const ip = getRequestIp(req);
    const perIp = checkRateLimitKey('student-login-ip', ip, PER_IP.max, PER_IP.windowSeconds);
    const perAccount = checkRateLimitKey('student-login-account', `${ip}|${username.toLowerCase()}`, PER_ACCOUNT.max, PER_ACCOUNT.windowSeconds);
    if (!perIp.allowed || !perAccount.allowed) {
      console.warn(`[student-portal] sign-in throttled ip=${ip} user=${maskUsername(username)} scope=${!perIp.allowed ? 'ip' : 'ip+username'}`);
      const retryAfter = Math.max(perIp.allowed ? 0 : perIp.retryAfter, perAccount.allowed ? 0 : perAccount.retryAfter);
      return NextResponse.json(
        { success: false, message: TOO_MANY },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const pool = getPool();

    const [rows] = await pool.query<any[]>(
      `SELECT spa.*, s.Student_Name, s.Email, s.Present_Mobile, s.Course_Id
       FROM student_portal_auth spa
       JOIN student_master s ON spa.Student_Id = s.Student_Id
       WHERE spa.Username = ? AND spa.IsActive = 1
         AND (s.IsDelete = 0 OR s.IsDelete IS NULL)`,
      [username]
    );

    if (!rows.length) {
      return NextResponse.json({ success: false, message: 'Invalid username or password' }, { status: 401 });
    }

    const user = rows[0];

    let passwordMatches = false;
    if (user.Password_Enc) {
      try {
        const decrypted = decryptPassword(Buffer.from(user.Password_Enc));
        const decryptedBuf = Buffer.from(decrypted, 'utf8');
        const submittedBuf = Buffer.from(password, 'utf8');
        passwordMatches =
          decryptedBuf.length === submittedBuf.length &&
          crypto.timingSafeEqual(decryptedBuf, submittedBuf);
      } catch (err) {
        console.error('Student password decrypt error:', err);
        passwordMatches = false;
      }
    } else {
      // Row not yet migrated to encrypted passwords — fall back to legacy MD5 check.
      const hashedPassword = crypto.createHash('md5').update(password).digest('hex');
      passwordMatches = user.Password_Hash === hashedPassword;
    }

    if (!passwordMatches) {
      return NextResponse.json({ success: false, message: 'Invalid username or password' }, { status: 401 });
    }

    // Update last login
    await pool.query(`UPDATE student_portal_auth SET Last_Login = NOW() WHERE Id = ?`, [user.Id]);

    const mustChangePassword = Boolean(user.Must_Change_Password);

    // Create JWT
    const token = await new SignJWT({
      studentId: user.Student_Id,
      name: user.Student_Name,
      email: user.Email,
      type: 'student',
      mustChangePassword,
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
      mustChangePassword,
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
