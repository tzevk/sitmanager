import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

// Public intake submission with token validation
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const body = await req.json();
    const { token } = await params;

    const firstName = String(body?.firstName || '').trim();
    const middleName = String(body?.middleName || '').trim();
    const lastName = String(body?.lastName || '').trim();
    const phone = String(body?.phone || '').trim();
    const companyName = String(body?.companyName || '').trim();

    if (!token) return NextResponse.json({ success: false, error: 'Token required' }, { status: 400 });
    if (!firstName || !lastName) return NextResponse.json({ success: false, error: 'First and last name are required' }, { status: 400 });
    if (!phone || !/^[0-9]{8,18}$/.test(phone)) return NextResponse.json({ success: false, error: 'Phone must be 8-18 digits' }, { status: 400 });

    const pool = getPool();

    // Ensure token table exists (idempotent) and validate token
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

    const [tokens] = await pool.query<any[]>(
      `SELECT InquiryId FROM student_intake_tokens
       WHERE Token = ? AND IsActive = 1 AND (ExpiresAt IS NULL OR ExpiresAt > NOW())
       LIMIT 1`,
      [token]
    );

    if (tokens.length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid or expired link' }, { status: 404 });
    }

    const name = [firstName, middleName, lastName].filter(Boolean).join(' ');

    // Ensure intake table exists (covers legacy environments without migrations)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public_student_intake (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        student_name VARCHAR(255) NOT NULL,
        phone_number VARCHAR(32) NOT NULL,
        company_name VARCHAR(255) NULL,
        token VARCHAR(64) NULL,
        inquiry_id INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_token (token),
        INDEX idx_inquiry (inquiry_id)
      ) ENGINE=InnoDB;
    `);

    // Ensure company column exists for capturing organization names.
    await pool.query(
      'ALTER TABLE public_student_intake ADD COLUMN IF NOT EXISTS company_name VARCHAR(255) NULL'
    );

    // Store intake
    await pool.query(
      `INSERT INTO public_student_intake (student_name, phone_number, company_name, created_at, token, inquiry_id)
       VALUES (?, ?, ?, NOW(), ?, ?)` ,
      [name, phone, companyName || null, token, tokens[0].InquiryId]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('student-intake-token submit error', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// GET: fetch metadata for a token (currently company name)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) return NextResponse.json({ success: false, error: 'Token required' }, { status: 400 });

    const pool = getPool();

    // Ensure token table exists (idempotent) and validate token
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

    const [rows] = await pool.query<any[]>(
      `SELECT ci.CompanyName, t.InquiryId
       FROM student_intake_tokens t
       JOIN corporate_inquiry ci ON ci.Id = t.InquiryId
       WHERE t.Token = ? AND t.IsActive = 1 AND (t.ExpiresAt IS NULL OR t.ExpiresAt > NOW())
       LIMIT 1`,
      [token]
    );

    if ((rows || []).length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid or expired link' }, { status: 404 });
    }

    const companyName = rows[0]?.CompanyName || '';
    const inquiryId = rows[0]?.InquiryId;

    return NextResponse.json({ success: true, companyName, inquiryId });
  } catch (err: unknown) {
    console.error('student-intake-token GET error', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
