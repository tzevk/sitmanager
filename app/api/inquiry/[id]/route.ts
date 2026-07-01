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

function sqlPlaceholders(values: unknown[]): string {
  return values.map(() => '?').join(',');
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, ['inquiry.delete', 'inquiry.update', 'inquiry.edit']);
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
    const { id } = await params;
    const inquiryId = Number(id);

    if (!Number.isFinite(inquiryId) || inquiryId <= 0) {
      return NextResponse.json({ error: 'Valid inquiry id is required' }, { status: 400 });
    }

    const deleteDuplicates = req.nextUrl.searchParams.get('deleteDuplicates') === '1';

    const [sourceRows] = await pool.query(
      `SELECT
         Inquiry_Id,
         Student_Id,
         RIGHT(REGEXP_REPLACE(COALESCE(Present_Mobile,''), '[^0-9]', ''), 10) AS PresentMobileKey,
         RIGHT(REGEXP_REPLACE(COALESCE(Present_Mobile2,''), '[^0-9]', ''), 10) AS PresentMobile2Key,
         LOWER(TRIM(COALESCE(Email,''))) AS EmailKey
       FROM ${inquiryTable}
       WHERE Inquiry_Id = ?
       LIMIT 1`,
      [inquiryId]
    );
    const sourceRow = (sourceRows as any[])[0];
    if (!sourceRow) {
      return NextResponse.json({ success: true, message: 'Inquiry deleted successfully' });
    }

    const sourceStudentIdStr = sourceRow.Student_Id === null || sourceRow.Student_Id === undefined
      ? null
      : String(sourceRow.Student_Id).trim();
    const hasLinkedStudent = Boolean(sourceStudentIdStr && !['', '0'].includes(sourceStudentIdStr));
    const mobileKeys = [sourceRow.PresentMobileKey, sourceRow.PresentMobile2Key]
      .map((value) => String(value ?? '').trim())
      .filter((value, index, values) => value.length === 10 && values.indexOf(value) === index);
    const emailKey = String(sourceRow.EmailKey ?? '').trim();

    const matchConditions = ['Inquiry_Id = ?'];
    const matchParams: any[] = [inquiryId];

    if (hasLinkedStudent) {
      matchConditions.push('TRIM(CAST(Student_Id AS CHAR)) = ?');
      matchParams.push(sourceStudentIdStr);
    }

    if (deleteDuplicates) {
      if (mobileKeys.length > 0) {
        matchConditions.push(`(
          RIGHT(REGEXP_REPLACE(COALESCE(Present_Mobile,''), '[^0-9]', ''), 10) IN (${sqlPlaceholders(mobileKeys)})
          OR RIGHT(REGEXP_REPLACE(COALESCE(Present_Mobile2,''), '[^0-9]', ''), 10) IN (${sqlPlaceholders(mobileKeys)})
        )`);
        matchParams.push(...mobileKeys, ...mobileKeys);
      }
      if (emailKey && emailKey.includes('@')) {
        matchConditions.push('LOWER(TRIM(COALESCE(Email,\'\'))) = ?');
        matchParams.push(emailKey);
      }
    }

    const [matchedRows] = await pool.query(
      `SELECT Inquiry_Id, Student_Id
       FROM ${inquiryTable}
       WHERE (IsDelete = 0 OR IsDelete IS NULL)
         AND (${matchConditions.join(' OR ')})`,
      matchParams
    );
    const matched = matchedRows as any[];
    const inquiryIds = matched.length > 0
      ? matched.map((row) => Number(row.Inquiry_Id)).filter((value) => Number.isFinite(value) && value > 0)
      : [inquiryId];
    const discussionLookupIds = Array.from(new Set(
      matched.flatMap((row) => [row.Inquiry_Id, row.Student_Id])
        .map((value) => String(value ?? '').trim())
        .filter((value) => value && value !== '0')
    ));

    await pool.query(
      `UPDATE ${inquiryTable} SET IsDelete = 1 WHERE Inquiry_Id IN (${sqlPlaceholders(inquiryIds)})`,
      inquiryIds
    );

    if (discussionLookupIds.length > 0) {
      await pool.query(
        `UPDATE awt_inquirydiscussion
         SET deleted = 1
         WHERE CAST(Inquiry_id AS CHAR) IN (${sqlPlaceholders(discussionLookupIds)})
            OR CAST(student_id AS CHAR) IN (${sqlPlaceholders(discussionLookupIds)})`,
        [...discussionLookupIds, ...discussionLookupIds]
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