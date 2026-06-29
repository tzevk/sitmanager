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

    // Query by Inquiry_id OR student_id to cover both old and new records.
    // Resolve created_by → the admin account name that logged the discussion.
    const [rows] = await pool.query<any[]>(
      `SELECT d.id, d.date, d.discussion, d.created_by, d.created_date, d.nextdate,
              COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.firstname, ''), ' ', COALESCE(u.lastname, ''))), ''), u.username) AS created_by_name
       FROM awt_inquirydiscussion d
       LEFT JOIN awt_adminuser u ON u.id = d.created_by
       WHERE d.deleted = 0 AND (d.Inquiry_id = ? OR d.student_id = ?)
       ORDER BY d.id DESC`,
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

    // Log the account that created the discussion.
    const createdBy = auth.session.userId;

    const [result] = await pool.query(
      `INSERT INTO awt_inquirydiscussion
         (Inquiry_id, student_id, date, discussion, deleted, created_by, created_date)
       VALUES (?, ?, CURDATE(), ?, 0, ?, NOW())`,
      [inquiryId, id, discussion.trim(), createdBy]
    );

    return NextResponse.json({ success: true, id: (result as any).insertId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
