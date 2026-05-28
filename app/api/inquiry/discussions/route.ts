/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

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
    const inquiryTable = await resolveInquiryTableName(pool);

    if (!inquiryId) {
      return NextResponse.json({ error: 'inquiryId is required' }, { status: 400 });
    }

    const inquiryIdNum = Number(inquiryId);
    if (!Number.isFinite(inquiryIdNum) || inquiryIdNum <= 0) {
      return NextResponse.json({ error: 'Invalid inquiryId' }, { status: 400 });
    }

    // Canonicalize inquiry id: discussions are stored against a canonical Inquiry_Id.
    // Accept callers providing either Inquiry_Id or Student_Id, but resolve to a single
    // canonical Inquiry_Id to avoid pulling discussions for other linked inquiries.
    const [mapRows] = await pool.query(
      `SELECT Inquiry_Id
       FROM ${inquiryTable}
       WHERE Inquiry_Id = ? OR Student_Id = ?
       ORDER BY Inquiry_Id DESC
       LIMIT 1`,
      [inquiryIdNum, inquiryIdNum]
    );
    const canonicalInquiryId = Number((mapRows as any[])[0]?.Inquiry_Id || inquiryIdNum);

    const withNextDate = await hasNextDateColumn(pool);
    const nextDateSelect = withNextDate ? 'nextdate' : 'NULL as nextdate';
    const [rows] = await pool.query(
      `SELECT id, date, ${nextDateSelect}, discussion, created_by, created_date
       FROM awt_inquirydiscussion
       WHERE Inquiry_id = ? AND (deleted = 0 OR deleted IS NULL)
       ORDER BY id ASC`,
      [canonicalInquiryId]
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
    const inquiryTable = await resolveInquiryTableName(pool);

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
       FROM ${inquiryTable}
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

// PUT — update a discussion entry
export async function PUT(req: NextRequest) {
  try {
    const pool = getPool();
    const body = await req.json();
    const { id, discussion } = body;

    if (!id || !discussion?.trim()) {
      return NextResponse.json({ error: 'id and discussion are required' }, { status: 400 });
    }

    const idNum = Number(id);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    await pool.query(
      `UPDATE awt_inquirydiscussion SET discussion = ? WHERE id = ? AND (deleted = 0 OR deleted IS NULL)`,
      [discussion.trim(), idNum]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Discussions PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update discussion', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE — soft-delete a discussion entry
export async function DELETE(req: NextRequest) {
  try {
    const pool = getPool();
    const url = req.nextUrl;
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const idNum = Number(id);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    await pool.query(
      `UPDATE awt_inquirydiscussion SET deleted = 1 WHERE id = ?`,
      [idNum]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Discussions DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete discussion', details: error.message },
      { status: 500 }
    );
  }
}
