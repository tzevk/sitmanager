/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { SignJWT } from 'jose';
import crypto from 'crypto';

const TRAINER_COOKIE = 'sit_trainer_session';
const SESSION_DURATION = 60 * 60 * 12; // 12 hours
const DEFAULT_TRAINER_PASSWORD = 'Suvidya@2026';

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

    const loginInput = String(username).trim();
    const normalizedInput = loginInput.toLowerCase().replace(/[\s._-]+/g, '');

    const [rows] = await pool.query<any[]>(
      `SELECT tpa.*, f.Faculty_Name, f.EMail, f.Mobile, f.Specialization
       FROM trainer_portal_auth tpa
       JOIN faculty_master f ON tpa.Faculty_Id = f.Faculty_Id
       WHERE (
         LOWER(tpa.Username) = LOWER(?)
         OR LOWER(f.Faculty_Name) = LOWER(?)
         OR REPLACE(REPLACE(REPLACE(REPLACE(LOWER(tpa.Username), ' ', ''), '.', ''), '_', ''), '-', '') = ?
         OR REPLACE(REPLACE(REPLACE(REPLACE(LOWER(f.Faculty_Name), ' ', ''), '.', ''), '_', ''), '-', '') = ?
       )
         AND tpa.Password_Hash = ? AND tpa.IsActive = 1
         AND (f.IsDelete = 0 OR f.IsDelete IS NULL)`,
      [loginInput, loginInput, normalizedInput, normalizedInput, hashedPassword]
    );

    let user = rows[0] ?? null;

    // Backward compatibility: if trainer uses default password but account has old hash,
    // reset to default for this trainer-name/username match and continue login.
    if (!user && password === DEFAULT_TRAINER_PASSWORD) {
      const [legacyRows] = await pool.query<any[]>(
        `SELECT tpa.*, f.Faculty_Name, f.EMail, f.Mobile, f.Specialization
         FROM trainer_portal_auth tpa
         JOIN faculty_master f ON tpa.Faculty_Id = f.Faculty_Id
         WHERE (
           LOWER(tpa.Username) = LOWER(?)
           OR LOWER(f.Faculty_Name) = LOWER(?)
           OR REPLACE(REPLACE(REPLACE(REPLACE(LOWER(tpa.Username), ' ', ''), '.', ''), '_', ''), '-', '') = ?
           OR REPLACE(REPLACE(REPLACE(REPLACE(LOWER(f.Faculty_Name), ' ', ''), '.', ''), '_', ''), '-', '') = ?
         )
           AND tpa.IsActive = 1
           AND (f.IsDelete = 0 OR f.IsDelete IS NULL)
         ORDER BY tpa.Id DESC
         LIMIT 1`,
        [loginInput, loginInput, normalizedInput, normalizedInput]
      );

      if (legacyRows.length) {
        const legacyUser = legacyRows[0];
        await pool.query(
          `UPDATE trainer_portal_auth
           SET Password_Hash = ?
           WHERE Id = ?`,
          [hashedPassword, legacyUser.Id]
        );
        user = legacyUser;
      }
    }

    if (!user) {
      return NextResponse.json({ success: false, message: 'Invalid username or password' }, { status: 401 });
    }

    await pool.query(`UPDATE trainer_portal_auth SET Last_Login = NOW() WHERE Id = ?`, [user.Id]);

    const token = await new SignJWT({
      facultyId: user.Faculty_Id,
      name: user.Faculty_Name,
      email: user.EMail || '',
      type: 'trainer',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${SESSION_DURATION}s`)
      .sign(getSecretKey());

    const response = NextResponse.json({
      success: true,
      user: {
        facultyId: user.Faculty_Id,
        name: user.Faculty_Name,
        email: user.EMail,
      },
    });

    response.cookies.set(TRAINER_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION,
    });

    return response;
  } catch (err: unknown) {
    console.error('Trainer login error:', err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
