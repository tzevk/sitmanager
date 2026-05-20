import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSession } from '@/lib/session';
import { withEmailSignature } from '@/lib/mailer';
import nodemailer from 'nodemailer';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const MAIL_PROVIDER = (process.env.ADMISSION_MAIL_PROVIDER || 'smtp').trim().toLowerCase();

function generate6DigitOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const inputEmail = String(body.email || '').trim().toLowerCase();

    if (!inputEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputEmail)) {
      return NextResponse.json({ success: false, error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const pool = getPool();

    // Ensure token table exists
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        user_id INT NOT NULL PRIMARY KEY,
        otp VARCHAR(6) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT NOW()
      )
    `);

    // Match the provided email to the logged-in user's account
    const [rows] = await pool.execute(
      `SELECT id, email, firstname, lastname FROM awt_adminuser WHERE id = ? AND deleted = 0`,
      [session.userId]
    ) as [any[], any];

    if (!rows.length) {
      return NextResponse.json({ success: false, error: 'Account not found.' }, { status: 404 });
    }

    const user = { ...rows[0], email: inputEmail }; // send to whatever email they entered
    const otp = generate6DigitOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Upsert OTP
    await pool.execute(
      `INSERT INTO password_reset_tokens (user_id, otp, expires_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE otp = VALUES(otp), expires_at = VALUES(expires_at), created_at = NOW()`,
      [user.id, otp, expiresAt.toISOString().slice(0, 19).replace('T', ' ')]
    );

    const displayName = [user.firstname, user.lastname].filter(Boolean).join(' ') || 'User';
    const subject = 'Your SIT Manager Password Reset Code';
    const html = withEmailSignature(`
      <p>Dear <strong>${displayName}</strong>,</p>
      <p>You requested a password reset for your SIT Manager account.</p>
      <p>Your one-time code is:</p>
      <div style="text-align:center;margin:24px 0;">
        <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#2E3093;background:#f0f1ff;padding:12px 24px;border-radius:8px;display:inline-block;">
          ${otp}
        </span>
      </div>
      <p style="color:#6b7280;font-size:13px;">This code expires in <strong>10 minutes</strong>. If you did not request this, you can ignore this email.</p>
    `);
    const text = `Dear ${displayName},\n\nYour SIT Manager password reset code is: ${otp}\n\nThis code expires in 10 minutes.`;

    if (MAIL_PROVIDER === 'ses') {
      const sesClient = new SESClient({
        region: process.env.ADMISSION_AWS_SES_REGION || 'us-east-1',
        ...(process.env.ADMISSION_AWS_SES_ACCESS_KEY && {
          credentials: {
            accessKeyId: process.env.ADMISSION_AWS_SES_ACCESS_KEY!,
            secretAccessKey: process.env.ADMISSION_AWS_SES_SECRET_KEY!,
          },
        }),
      });
      await sesClient.send(new SendEmailCommand({
        Source: process.env.ADMISSION_AWS_SES_FROM_EMAIL,
        Destination: { ToAddresses: [user.email] },
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            Text: { Data: text, Charset: 'UTF-8' },
            Html: { Data: html, Charset: 'UTF-8' },
          },
        },
      }));
    } else {
      const transporter = nodemailer.createTransport({
        host: process.env.ADMISSION_SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.ADMISSION_SMTP_PORT || '587', 10),
        secure: process.env.ADMISSION_SMTP_SECURE === '1',
        auth: { user: process.env.ADMISSION_SMTP_USER, pass: process.env.ADMISSION_SMTP_PASS },
      });
      await transporter.sendMail({
        from: process.env.ADMISSION_SMTP_FROM || process.env.ADMISSION_SMTP_USER,
        to: user.email,
        subject,
        text,
        html,
      });
    }

    // Mask email for display: e.g. ab***@gmail.com
    const [localPart, domain] = user.email.split('@');
    const maskedEmail = localPart.slice(0, 2) + '***@' + domain;

    return NextResponse.json({ success: true, maskedEmail });
  } catch (error) {
    console.error('Reset password request error:', error);
    return NextResponse.json({ success: false, error: 'Failed to send reset code.' }, { status: 500 });
  }
}
