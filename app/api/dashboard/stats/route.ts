import { NextRequest, NextResponse } from 'next/server';
import { getPool, cached } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

const CACHE_TTL = 10 * 60 * 1000; // 10 min — slow-moving counts

async function safeQuery<T>(pool: ReturnType<typeof getPool>, sql: string, fallback: T): Promise<T> {
  try {
    const [rows] = await pool.query(sql);
    return rows as T;
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const pool = getPool();

    const [totalStudentsRows, activeCoursesRows, activeBatchesRows, totalFacultyRows] =
      await Promise.all([
        cached('qs:students', CACHE_TTL, () =>
          safeQuery(pool, "SELECT COUNT(*) as cnt FROM student_master WHERE (IsDelete IS NULL OR IsDelete = 0)", [{ cnt: 0 }])
        ),
        cached('qs:courses', CACHE_TTL, () =>
          safeQuery(pool, "SELECT COUNT(*) as cnt FROM course_mst WHERE IsActive = 1 AND (IsDelete IS NULL OR IsDelete = 0)", [{ cnt: 0 }])
        ),
        cached('qs:batches', CACHE_TTL, () =>
          safeQuery(pool, "SELECT COUNT(*) as cnt FROM batch_mst WHERE (IsDelete IS NULL OR IsDelete = 0) AND (Cancel IS NULL OR Cancel = 0) AND SDate <= CURDATE() AND EDate >= CURDATE()", [{ cnt: 0 }])
        ),
        cached('qs:faculty', CACHE_TTL, () =>
          safeQuery(pool, "SELECT COUNT(*) as cnt FROM faculty_master WHERE (IsDelete IS NULL OR IsDelete = 0)", [{ cnt: 0 }])
        ),
      ]);

    return NextResponse.json({
      totalStudents: (totalStudentsRows as Record<string, number>[])[0]?.cnt || 0,
      activeCourses: (activeCoursesRows as Record<string, number>[])[0]?.cnt || 0,
      activeBatches: (activeBatchesRows as Record<string, number>[])[0]?.cnt || 0,
      totalFaculty: (totalFacultyRows as Record<string, number>[])[0]?.cnt || 0,
    }, {
      headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300' },
    });
  } catch (error: unknown) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { totalStudents: 0, activeCourses: 0, activeBatches: 0, totalFaculty: 0 },
      { status: 500 }
    );
  }
}
