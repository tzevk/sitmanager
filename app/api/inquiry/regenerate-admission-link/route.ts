/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getPool } from '@/lib/db';

const ONLINE_ADMISSION_PAYLOAD_TABLE = 'online_admission_payload';

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

async function ensurePayloadTable(pool: any) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${ONLINE_ADMISSION_PAYLOAD_TABLE} (
      Inquiry_Id INT NOT NULL PRIMARY KEY,
      Payload    LONGTEXT NULL,
      Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      Updated_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['inquiry.create', 'inquiry.update']);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const inquiryId = Number(body?.inquiryId);

    if (!Number.isFinite(inquiryId) || inquiryId <= 0) {
      return NextResponse.json({ error: 'Valid inquiryId is required' }, { status: 400 });
    }

    const pool = getPool();
    const inquiryTable = await resolveInquiryTableName(pool);

    const [inquiryRows] = await pool.query(
      `SELECT Inquiry_Id FROM \`${inquiryTable}\` WHERE Inquiry_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL) LIMIT 1`,
      [inquiryId]
    );

    if ((inquiryRows as any[]).length === 0) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }

    await ensurePayloadTable(pool);

    await pool.query(
      `DELETE FROM ${ONLINE_ADMISSION_PAYLOAD_TABLE} WHERE Inquiry_Id = ?`,
      [inquiryId]
    );

    await pool.query(
      `UPDATE \`${inquiryTable}\` SET OnlineState = 1 WHERE Inquiry_Id = ? AND OnlineState IN (23, 8, 7)`,
      [inquiryId]
    );

    const admissionFormUrl = `${req.nextUrl.origin}/admission/${inquiryId}?resetDraft=${Date.now()}`;

    return NextResponse.json({
      success: true,
      message: 'Admission link regenerated successfully',
      admissionFormUrl,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to regenerate admission link';
    console.error('Regenerate admission link error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}