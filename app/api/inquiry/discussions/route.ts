/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

// GET discussions for an inquiry
export async function GET(req: NextRequest) {
  try {
    const pool = getPool();
    const url = req.nextUrl;
    const inquiryId = url.searchParams.get('inquiryId');

    if (!inquiryId) {
      return NextResponse.json({ error: 'inquiryId is required' }, { status: 400 });
    }

    const [rows] = await pool.query(
      `SELECT id, date, discussion, created_by, created_date
       FROM awt_inquirydiscussion
       WHERE Inquiry_id = ? AND deleted = 0
       ORDER BY id DESC`,
      [inquiryId]
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

    const { inquiryId, discussion } = body;
    if (!inquiryId || !discussion?.trim()) {
      return NextResponse.json(
        { error: 'inquiryId and discussion are required' },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO awt_inquirydiscussion
         (Inquiry_id, date, discussion, deleted, created_by, created_date)
       VALUES (?, CURDATE(), ?, 0, 1, NOW())`,
      [inquiryId, discussion.trim()]
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
