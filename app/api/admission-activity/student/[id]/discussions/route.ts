/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

// GET – fetch discussions for a student
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'student.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { id } = await params;

    const [rows] = await pool.query<any[]>(
      `SELECT id, date, discussion, created_by, created_date
       FROM awt_inquirydiscussion
       WHERE Inquiry_id = ? AND deleted = 0
       ORDER BY id DESC`,
      [id]
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
    const { id } = await params;
    const { discussion } = await req.json();

    if (!discussion?.trim()) {
      return NextResponse.json({ error: 'Discussion text is required' }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO awt_inquirydiscussion
         (Inquiry_id, date, discussion, deleted, created_by, created_date)
       VALUES (?, CURDATE(), ?, 0, 1, NOW())`,
      [id, discussion.trim()]
    );

    return NextResponse.json({ success: true, id: (result as any).insertId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
