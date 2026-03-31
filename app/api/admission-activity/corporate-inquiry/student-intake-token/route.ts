import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getPool } from '@/lib/db';

// POST: create or reuse an active student-intake link token for an inquiry
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const inquiryId = Number(body?.inquiryId);
    const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null;

    if (!inquiryId || Number.isNaN(inquiryId)) {
      return NextResponse.json({ success: false, error: 'Invalid inquiry id' }, { status: 400 });
    }

    const pool = getPool();

    // Ensure token table exists (idempotent)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_intake_tokens (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        InquiryId INT NOT NULL,
        Token VARCHAR(64) NOT NULL UNIQUE,
        IsActive TINYINT(1) NOT NULL DEFAULT 1,
        ExpiresAt DATETIME NULL,
        CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_inquiry (InquiryId)
      ) ENGINE=InnoDB;
    `);

    // Reuse active token if present and not expired
    const [existing] = await pool.query<any[]>(
      `SELECT Token FROM student_intake_tokens
       WHERE InquiryId = ? AND IsActive = 1 AND (ExpiresAt IS NULL OR ExpiresAt > NOW())
       ORDER BY CreatedAt DESC LIMIT 1`,
      [inquiryId]
    );

    let token: string;
    if (existing.length > 0) {
      token = existing[0].Token as string;
    } else {
      token = crypto.randomBytes(16).toString('hex');
      await pool.query(
        `INSERT INTO student_intake_tokens (InquiryId, Token, ExpiresAt)
         VALUES (?, ?, ?)` ,
        [inquiryId, token, expiresAt ? expiresAt.toISOString().slice(0, 19).replace('T', ' ') : null]
      );
    }

    const origin = req.nextUrl.origin;
    const link = `${origin}/public/student-intake/${token}`;

    return NextResponse.json({ success: true, token, link });
  } catch (err: unknown) {
    console.error('student-intake-token error', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
