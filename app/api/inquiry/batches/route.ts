import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

// GET batches filtered by course and/or category
export async function GET(req: NextRequest) {
  try {
    const pool = getPool();
    const url = req.nextUrl;
    const courseId = url.searchParams.get('courseId') || '';
    const category = url.searchParams.get('category') || '';

    const conditions: string[] = [
      'b.IsActive = 1',
      '(b.IsDelete = 0 OR b.IsDelete IS NULL)',
    ];
    const params: any[] = [];

    if (courseId) {
      conditions.push('b.Course_Id = ?');
      params.push(parseInt(courseId));
    }
    if (category) {
      conditions.push('b.Category = ?');
      params.push(category);
    }

    const sql = `
      SELECT b.Batch_Id, b.Batch_code, b.Course_Id, b.Category, b.SDate,
             c.Course_Name
      FROM batch_mst b
      LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
      WHERE ${conditions.join(' AND ')}
      ORDER BY b.SDate DESC
      LIMIT 200
    `;

    const [rows] = await pool.query(sql, params);
    return NextResponse.json({ batches: rows });
  } catch (error: any) {
    console.error('Batches API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch batches', details: error.message },
      { status: 500 }
    );
  }
}
