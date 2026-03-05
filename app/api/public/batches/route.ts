import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

// Public endpoint — no auth required (used by online admission form)
export async function GET(req: NextRequest) {
  try {
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId');
    const category = searchParams.get('category');

    if (!courseId) {
      return NextResponse.json({ success: true, categories: [], batches: [] });
    }

    // If no category yet, return distinct categories for this course
    if (!category) {
      const [cats] = await pool.query<{ category: string }[]>(
        `SELECT DISTINCT Category AS category
         FROM batch_mst
         WHERE Course_Id = ? AND IsActive = 1 AND (IsDelete = 0 OR IsDelete IS NULL)
           AND Category IS NOT NULL AND Category != ''
         ORDER BY Category ASC`,
        [courseId]
      );
      return NextResponse.json({ success: true, categories: cats.map((r) => r.category), batches: [] });
    }

    // Return batch codes for this course + category
    const [batches] = await pool.query<{ batchCode: string; timings: string | null }[]>(
      `SELECT Batch_code AS batchCode, Timings AS timings
       FROM batch_mst
       WHERE Course_Id = ? AND Category = ? AND IsActive = 1 AND (IsDelete = 0 OR IsDelete IS NULL)
       ORDER BY Batch_Id DESC`,
      [courseId, category]
    );
    return NextResponse.json({ success: true, categories: [], batches });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
