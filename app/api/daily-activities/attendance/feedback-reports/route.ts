/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

/* GET /api/daily-activities/attendance/feedback-reports
   Returns all attendance feedback grouped by date → batch → students.
   Requires attendance.view permission.
*/
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'attendance.view');
  if (auth instanceof NextResponse) return auth;

  try {
    const pool = getPool();

    /* Flat list — order: newest date first, then batch name, then roll number */
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
