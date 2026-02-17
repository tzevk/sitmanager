import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pool = getPool();
    const { id } = await params;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        b.Batch_Id,
        b.Course_Id,
        c.Course_Name,
        b.Batch_code,
        b.Category,
        b.Timings,
        b.SDate,
        b.ActualDate,
        b.Admission_Date,
        b.EDate,
        b.Duration,
        b.Training_Coordinator,
        b.Max_Students,
        b.Min_Qualification,
        b.No_of_Lectures,
        b.INR_Basic,
        b.INR_Total,
        b.Dollar_Basic,
        b.Dollar_Total,
        b.CourseName,
        b.Course_description,
        b.Batch_Category_id,
        b.IsActive
       FROM batch_mst b
       LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
       WHERE b.Batch_Id = ?`,
      [id]
    );

    if (!rows.length) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch batch';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
