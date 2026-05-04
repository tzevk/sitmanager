/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

/* PATCH /api/daily-activities/attendance/feedback-reports/[id] */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(req, 'attendance.update');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const feedbackId = Number(id);
    if (!feedbackId || isNaN(feedbackId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }
    const body = await req.json();
    const { rating, comments } = body as { rating?: number; comments?: string };
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating (1–5) is required' }, { status: 400 });
    }
    const pool = getPool();
    const [result] = await pool.query<any>(
      `UPDATE attendance_feedback SET rating = ?, comments = ? WHERE id = ?`,
      [rating, comments?.trim() || null, feedbackId]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Feedback record not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}

/* DELETE /api/daily-activities/attendance/feedback-reports/[id] */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(req, 'attendance.delete');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const feedbackId = Number(id);
    if (!feedbackId || isNaN(feedbackId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }
    const pool = getPool();
    const [result] = await pool.query<any>(
      `DELETE FROM attendance_feedback WHERE id = ?`,
      [feedbackId]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Feedback record not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
