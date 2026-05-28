/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

async function resolveInquiryTableName(pool: any): Promise<string> {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND LOWER(TABLE_NAME) = 'student_inquiry'
     ORDER BY CASE WHEN TABLE_NAME = 'Student_Inquiry' THEN 0 ELSE 1 END
     LIMIT 1`
  );
  return String((rows as any[])[0]?.TABLE_NAME || '').trim() || 'Student_Inquiry';
}

// GET – fetch discussions for a student
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'student.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
    const { id } = await params;

    // Look up the actual Inquiry_Id for this student
    const [inqRows] = await pool.query<any[]>(
      `SELECT Inquiry_Id FROM ${inquiryTable}
       WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
       ORDER BY Inquiry_Id DESC LIMIT 1`,
      [id]
    );
    const inquiryId = inqRows[0]?.Inquiry_Id ?? null;

    // Query by Inquiry_id OR student_id to cover both old and new records
    const [rows] = await pool.query<any[]>(
      `SELECT id, date, discussion, created_by, created_date, nextdate
       FROM awt_inquirydiscussion
       WHERE deleted = 0 AND (Inquiry_id = ? OR student_id = ?)
       ORDER BY id DESC`,
      [inquiryId ?? -1, id]
    );

    return NextResponse.json({ discussions: rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST – add a discussion entry for a student
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'student.update');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
    const { id } = await params;
    const { discussion } = await req.json();

    if (!discussion?.trim()) {
      return NextResponse.json({ error: 'Discussion text is required' }, { status: 400 });
    }

    // Look up the actual Inquiry_Id for this student
    const [inqRows] = await pool.query<any[]>(
      `SELECT Inquiry_Id FROM ${inquiryTable}
       WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
       ORDER BY Inquiry_Id DESC LIMIT 1`,
      [id]
    );
    const inquiryId = inqRows[0]?.Inquiry_Id ?? null;

    if (!inquiryId) {
      return NextResponse.json({ error: 'No inquiry record found for this student' }, { status: 404 });
    }

    const [result] = await pool.query(
      `INSERT INTO awt_inquirydiscussion
         (Inquiry_id, date, discussion, deleted, created_by, created_date)
       VALUES (?, CURDATE(), ?, 0, 1, NOW())`,
      [inquiryId, discussion.trim()]
    );

    return NextResponse.json({ success: true, id: (result as any).insertId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
