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
      'IsActive = 1',
      '(IsDelete = 0 OR IsDelete IS NULL)',
    ];
    const params: any[] = [];

    if (courseId) {
      conditions.push('Course_Id = ?');
      params.push(parseInt(courseId));
    }
    if (category) {
      conditions.push('Category = ?');
      params.push(category);
    }

    const sql = `
      SELECT Batch_Id, Batch_code, Course_Id, Category, SDate
      FROM batch_mst
      WHERE ${conditions.join(' AND ')}
      ORDER BY SDate DESC
      LIMIT 100
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
