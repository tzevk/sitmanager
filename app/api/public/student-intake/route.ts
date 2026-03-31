import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

// Public endpoint: create a minimal student intake record (name + phone).
// Ensure the table exists with at least (student_name VARCHAR, phone_number VARCHAR, created_at DATETIME DEFAULT CURRENT_TIMESTAMP).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const firstName = String(body?.firstName || '').trim();
    const middleName = String(body?.middleName || '').trim();
    const lastName = String(body?.lastName || '').trim();
    const phone = String(body?.phone || '').trim();
    const companyName = String(body?.companyName || '').trim();

    if (!firstName || !lastName) {
      return NextResponse.json({ success: false, error: 'First and last name are required' }, { status: 400 });
    }
    const name = [firstName, middleName, lastName].filter(Boolean).join(' ');
    if (!phone || !/^[0-9]{8,18}$/.test(phone)) {
      return NextResponse.json({ success: false, error: 'Phone must be 8-18 digits' }, { status: 400 });
    }

    const pool = getPool();

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
    await pool.query(
      `INSERT INTO public_student_intake (student_name, phone_number, company_name, created_at)
       VALUES (?, ?, ?, NOW())`,
      [name, phone, companyName || null]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('student-intake POST error', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
