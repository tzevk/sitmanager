/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'batch.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;

    const search = searchParams.get('search')?.trim() || '';
    const category = searchParams.get('category')?.trim() || '';

    /* ---- Build WHERE ---- */
    const conditions: string[] = [
      'b.IsActive = 1',
      '(b.IsDelete = 0 OR b.IsDelete IS NULL)',
    ];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(
        `(b.Batch_code LIKE ? OR c.Course_Name LIKE ? OR b.Category LIKE ? OR b.Training_Coordinator LIKE ?)`
      );
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    if (category) {
      conditions.push('b.Category = ?');
      params.push(category);
    }

    const where = conditions.join(' AND ');

    /* ---- Count ---- */
    const countSql = `
      SELECT COUNT(*) AS total
      FROM batch_mst b
      LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
      WHERE ${where}
    `;
    const [countRows] = await pool.query<any[]>(countSql, params);
    const total = countRows[0]?.total ?? 0;

    /* ---- Data ---- */
    const dataSql = `
      SELECT
        b.Batch_Id AS id,
        b.Batch_code AS batchNo,
        c.Course_Name AS courseName,
        b.Category AS category,
        b.Timings AS timings,
        b.SDate AS plannedStartDate,
        b.Admission_Date AS lastDateOfAdmission,
        b.Training_Coordinator AS trainingCoordinator
      FROM batch_mst b
      LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
      WHERE ${where}
      ORDER BY b.Batch_Id DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query<any[]>(dataSql, [...params, limit, offset]);

    return NextResponse.json({
      rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Batch API error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
