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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, ['inquiry.delete', 'inquiry.update']);
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
    const { id } = await params;
    const inquiryId = Number(id);

    if (!Number.isFinite(inquiryId) || inquiryId <= 0) {
      return NextResponse.json({ error: 'Valid inquiry id is required' }, { status: 400 });
    }

    const inquiryIdStr = String(inquiryId);

    await pool.query(`UPDATE ${inquiryTable} SET IsDelete = 1 WHERE Inquiry_Id = ?`, [inquiryId]);

    const [studentRows] = await pool.query(
      `SELECT Student_Id FROM ${inquiryTable} WHERE Inquiry_Id = ? LIMIT 1`,
      [inquiryId]
    );
    const sourceStudentId = (studentRows as any[])[0]?.Student_Id;
    const sourceStudentIdStr = sourceStudentId === null || sourceStudentId === undefined
      ? null
      : String(sourceStudentId).trim();

    if (sourceStudentIdStr) {
      await pool.query(
        `UPDATE awt_inquirydiscussion
         SET deleted = 1
         WHERE CAST(Inquiry_id AS CHAR) = ? OR CAST(Inquiry_id AS CHAR) = ?`,
        [inquiryIdStr, sourceStudentIdStr]
      );
    } else {
      await pool.query(
        `UPDATE awt_inquirydiscussion
         SET deleted = 1
         WHERE CAST(Inquiry_id AS CHAR) = ?`,
        [inquiryIdStr]
      );
    }

    return NextResponse.json({ success: true, message: 'Inquiry deleted successfully' });
  } catch (error: any) {
    console.error('Inquiry DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete inquiry', details: error.message },
      { status: 500 }
    );
  }
}