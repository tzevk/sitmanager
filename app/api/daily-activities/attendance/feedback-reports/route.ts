/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

/* GET /api/daily-activities/attendance/feedback-reports
   - No params → all feedback grouped by date → batch → students
   - ?batchId=X&date=YYYY-MM-DD → flat list for the attendance table column
   Requires attendance.view permission.
*/
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'attendance.view');
  if (auth instanceof NextResponse) return auth;

  try {
    const pool = getPool();
    const sp = req.nextUrl.searchParams;
    const batchId = sp.get('batchId');
    const date    = sp.get('date');

    /* ── Attendance-page column mode: flat per-student feedback ── */
    if (batchId && date) {
      const [rows] = await pool.query<any[]>(`
        SELECT
          af.roll_no,
          af.rating,
          af.comments,
          af.first_half_rating,
          af.first_half_comments,
          af.second_half_rating,
          af.second_half_comments
        FROM attendance_feedback af
        LEFT JOIN attendance_feedback_token aft ON aft.token = af.token
        WHERE af.Batch_Id = ? AND DATE(af.date) = ?
          AND (af.roll_no IS NOT NULL AND af.roll_no != '')
        ORDER BY CAST(af.roll_no AS UNSIGNED), af.roll_no
      `, [batchId, date]);
      const map: Record<string, {
        firstHalf: { rating: number; comments: string | null } | null;
        secondHalf: { rating: number; comments: string | null } | null;
      }> = {};
      for (const r of rows) {
        map[r.roll_no] = {
          firstHalf: (r.first_half_rating ?? (r.second_half_rating == null ? r.rating : null))
            ? { rating: r.first_half_rating ?? r.rating, comments: r.first_half_comments ?? r.comments ?? null }
            : null,
          secondHalf: r.second_half_rating
            ? { rating: r.second_half_rating, comments: r.second_half_comments ?? null }
            : null,
        };
      }
      return NextResponse.json({ feedback: map });
    }

    /* ── Full grouped report mode ── */
    const [rows] = await pool.query<any[]>(`
      SELECT
        af.id,
        DATE_FORMAT(af.date, '%Y-%m-%d')  AS date,
        af.Batch_Id,
        COALESCE(aft.batch_name, CONCAT('Batch #', af.Batch_Id)) AS batch_name,
        af.roll_no,
        af.student_name,
        af.rating,
        af.comments,
        af.first_half_rating,
        af.first_half_comments,
        af.second_half_rating,
        af.second_half_comments,
        DATE_FORMAT(af.submitted_at, '%Y-%m-%d %H:%i:%s') AS submitted_at
      FROM attendance_feedback af
      LEFT JOIN attendance_feedback_token aft ON aft.token = af.token
      ORDER BY af.date DESC, aft.batch_name ASC, CAST(af.roll_no AS UNSIGNED) ASC, af.roll_no ASC
    `);

    /* Group client-side-friendly: dates → batches */
    type StudentRow = {
      id: number;
      rollNo: string;
      studentName: string;
      rating: number;
      comments: string | null;
      firstHalfRating: number | null;
      firstHalfComments: string | null;
      secondHalfRating: number | null;
      secondHalfComments: string | null;
      submittedAt: string;
    };
    type BatchGroup = { batchId: number; batchName: string; students: StudentRow[] };
    type DateGroup  = { date: string; batches: BatchGroup[] };

    const dateMap = new Map<string, Map<number, BatchGroup>>();

    for (const r of rows) {
      if (!dateMap.has(r.date)) dateMap.set(r.date, new Map());
      const batchMap = dateMap.get(r.date)!;
      if (!batchMap.has(r.Batch_Id)) {
        batchMap.set(r.Batch_Id, { batchId: r.Batch_Id, batchName: r.batch_name, students: [] });
      }
      batchMap.get(r.Batch_Id)!.students.push({
        id: r.id,
        rollNo: r.roll_no ?? '',
        studentName: r.student_name ?? '',
        rating: r.rating,
        comments: r.comments ?? null,
        firstHalfRating: r.first_half_rating ?? (r.second_half_rating == null ? r.rating : null),
        firstHalfComments: r.first_half_comments ?? (r.second_half_rating == null ? r.comments ?? null : null),
        secondHalfRating: r.second_half_rating ?? null,
        secondHalfComments: r.second_half_comments ?? null,
        submittedAt: r.submitted_at,
      });
    }

    const result: DateGroup[] = [];
    for (const [date, batchMap] of dateMap) {
      result.push({ date, batches: Array.from(batchMap.values()) });
    }

    return NextResponse.json({ data: result });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
