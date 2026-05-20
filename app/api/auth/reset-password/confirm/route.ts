import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSession } from '@/lib/session';
import { createHash } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const otp = String(body.otp || '').trim();
    const newPassword = String(body.newPassword || '');

    if (!otp || otp.length !== 6) {
      return NextResponse.json({ success: false, error: 'Invalid code.' }, { status: 400 });
    }
    if (!newPassword || newPassword.length < 4) {
      return NextResponse.json({ success: false, error: 'Password must be at least 4 characters.' }, { status: 400 });
    }

    const pool = getPool();

    // Look up OTP
    const [rows] = await pool.execute(
      `SELECT otp, expires_at FROM password_reset_tokens WHERE user_id = ?`,
      [session.userId]
    ) as [any[], any];

    if (!rows.length) {
      return NextResponse.json({ success: false, error: 'No reset code found. Request a new one.' }, { status: 400 });
    }

    const token = rows[0];

    if (new Date(token.expires_at) < new Date()) {
      await pool.execute(`DELETE FROM password_reset_tokens WHERE user_id = ?`, [session.userId]);
      return NextResponse.json({ success: false, error: 'Code has expired. Request a new one.' }, { status: 400 });
    }

    if (token.otp !== otp) {
      return NextResponse.json({ success: false, error: 'Incorrect code. Please try again.' }, { status: 400 });
    }

    const hashedPassword = createHash('md5').update(newPassword).digest('hex');

    await pool.execute(
      `UPDATE awt_adminuser SET password = ?, updated_date = NOW() WHERE id = ? AND deleted = 0`,
      [hashedPassword, session.userId]
    );

    // Delete used token
    await pool.execute(`DELETE FROM password_reset_tokens WHERE user_id = ?`, [session.userId]);

    return NextResponse.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Reset password confirm error:', error);
    return NextResponse.json({ success: false, error: 'Failed to reset password.' }, { status: 500 });
  }
}
