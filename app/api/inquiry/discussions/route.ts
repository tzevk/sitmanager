/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

async function hasNextDateColumn(pool: any): Promise<boolean> {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'awt_inquirydiscussion'
       AND COLUMN_NAME = 'nextdate'`
  );
  return Number((rows as any[])[0]?.cnt || 0) > 0;
}

// GET discussions for an inquiry
export async function GET(req: NextRequest) {
  try {
    const pool = getPool();
    const url = req.nextUrl;
    const inquiryId = url.searchParams.get('inquiryId');

    if (!inquiryId) {
      return NextResponse.json({ error: 'inquiryId is required' }, { status: 400 });
    }

    const inquiryIdNum = Number(inquiryId);
    if (!Number.isFinite(inquiryIdNum) || inquiryIdNum <= 0) {
      return NextResponse.json({ error: 'Invalid inquiryId' }, { status: 400 });
    }

    // Legacy compatibility: discussions may reference either Inquiry_Id or Student_Id.
    const [mapRows] = await pool.query(
      `SELECT Inquiry_Id, Student_Id
       FROM Student_Inquiry
       WHERE Inquiry_Id = ? OR Student_Id = ?`,
      [inquiryIdNum, inquiryIdNum]
    );

    const ids = Array.from(new Set([
      inquiryIdNum,
      ...(mapRows as any[]).flatMap((r: any) => [Number(r?.Inquiry_Id), Number(r?.Student_Id)]),
    ].filter((v) => Number.isFinite(v) && Number(v) > 0)));

    const withNextDate = await hasNextDateColumn(pool);
    const nextDateSelect = withNextDate ? 'nextdate' : 'NULL as nextdate';
    const idPlaceholders = ids.map(() => '?').join(',');

    const [rows] = await pool.query(
      `SELECT id, date, ${nextDateSelect}, discussion, created_by, created_date
       FROM awt_inquirydiscussion
       WHERE Inquiry_id IN (${idPlaceholders}) AND (deleted = 0 OR deleted IS NULL)
       ORDER BY id DESC`,
      ids
    );

    return NextResponse.json({ discussions: rows });
  } catch (error: any) {
    console.error('Discussions GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch discussions', details: error.message },
      { status: 500 }
    );
  }
}

// POST — add a discussion entry
export async function POST(req: NextRequest) {
  try {
    const pool = getPool();
    const body = await req.json();

    const { inquiryId, discussion, nextFollowUpDate } = body;
    if (!inquiryId || !discussion?.trim()) {
      return NextResponse.json(
        { error: 'inquiryId and discussion are required' },
        { status: 400 }
      );
    }

    const inquiryIdNum = Number(inquiryId);
    if (!Number.isFinite(inquiryIdNum) || inquiryIdNum <= 0) {
      return NextResponse.json({ error: 'Invalid inquiryId' }, { status: 400 });
    }

    // Canonicalize to Inquiry_Id when caller sends Student_Id.
    const [mapRows] = await pool.query(
      `SELECT Inquiry_Id
       FROM Student_Inquiry
       WHERE Inquiry_Id = ? OR Student_Id = ?
       ORDER BY Inquiry_Id DESC
       LIMIT 1`,
      [inquiryIdNum, inquiryIdNum]
    );
    const canonicalInquiryId = Number((mapRows as any[])[0]?.Inquiry_Id || inquiryIdNum);

    const withNextDate = await hasNextDateColumn(pool);

    const [result] = withNextDate
      ? await pool.query(
          `INSERT INTO awt_inquirydiscussion
             (Inquiry_id, date, nextdate, discussion, deleted, created_by, created_date)
           VALUES (?, CURDATE(), ?, ?, 0, 1, NOW())`,
            [canonicalInquiryId, nextFollowUpDate || null, discussion.trim()]
        )
      : await pool.query(
          `INSERT INTO awt_inquirydiscussion
             (Inquiry_id, date, discussion, deleted, created_by, created_date)
           VALUES (?, CURDATE(), ?, 0, 1, NOW())`,
            [canonicalInquiryId, discussion.trim()]
        );

    const insertId = (result as any).insertId;
    return NextResponse.json({ success: true, id: insertId });
  } catch (error: any) {
    console.error('Discussions POST error:', error);
    return NextResponse.json(
      { error: 'Failed to add discussion', details: error.message },
      { status: 500 }
    );
  }
}
