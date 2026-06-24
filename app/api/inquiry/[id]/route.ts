/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool, invalidateCache } from '@/lib/db';
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

    // The listing collapses every inquiry row that shares a linked Student_Id into a
    // single row (repeated imports/syncs create many Inquiry_Ids for one person).
    // So deleting just this Inquiry_Id would leave the next duplicate to immediately
    // resurface in the list, making the delete look like it did nothing. Resolve the
    // linked Student_Id first and soft-delete the whole group so the row truly goes away.
    const [studentRows] = await pool.query(
      `SELECT Student_Id FROM ${inquiryTable} WHERE Inquiry_Id = ? LIMIT 1`,
      [inquiryId]
    );
    const sourceStudentId = (studentRows as any[])[0]?.Student_Id;
    const sourceStudentIdStr = sourceStudentId === null || sourceStudentId === undefined
      ? null
      : String(sourceStudentId).trim();
    const hasLinkedStudent = Boolean(sourceStudentIdStr && !['', '0'].includes(sourceStudentIdStr));

    if (hasLinkedStudent) {
      // Soft-delete every inquiry row for this person, plus the row itself as a safety net.
      await pool.query(
        `UPDATE ${inquiryTable} SET IsDelete = 1
         WHERE Inquiry_Id = ? OR TRIM(CAST(Student_Id AS CHAR)) = ?`,
        [inquiryId, sourceStudentIdStr]
      );
    } else {
      await pool.query(`UPDATE ${inquiryTable} SET IsDelete = 1 WHERE Inquiry_Id = ?`, [inquiryId]);
    }

    if (hasLinkedStudent) {
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

    // Drop the cached inquiry listing/count so the deleted row disappears on the
    // immediate refetch instead of lingering for the cache TTL.
    invalidateCache('api:inquiry');
    invalidateCache('inquiry:list-count');

    return NextResponse.json({ success: true, message: 'Inquiry deleted successfully' });
  } catch (error: any) {
    console.error('Inquiry DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete inquiry', details: error.message },
      { status: 500 }
    );
  }
}