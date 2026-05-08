import { getPool, cached } from '@/lib/db';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DashboardStatsInput {
  role: number | string;
  department: string;
}

export interface DashboardStats {
  totalStudents: number;
  activeCourses: number;
  activeBatches: number;
  totalFaculty: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

type CountRow = Record<string, number>;

async function safeCount(pool: ReturnType<typeof getPool>, sql: string): Promise<number> {
  try {
    const [rows] = await pool.query(sql);
    return (rows as CountRow[])[0]?.cnt ?? 0;
  } catch {
    return 0;
  }
}

// ── Public service functions ──────────────────────────────────────────────────

export async function getDashboardStats(input: DashboardStatsInput): Promise<DashboardStats> {
  const pool = getPool();
  const roleKey = String(input.role ?? 'na');
  const deptKey = (input.department || 'unknown').trim().toLowerCase().replace(/\s+/g, '_');

  const [totalStudents, activeCourses, activeBatches, totalFaculty] = await Promise.all([
    cached(`qs:students:role:${roleKey}:dept:${deptKey}`, CACHE_TTL, () =>
      safeCount(pool, 'SELECT COUNT(*) as cnt FROM student_master WHERE (IsDelete IS NULL OR IsDelete = 0)')
    ),
    cached(`qs:courses:role:${roleKey}:dept:${deptKey}`, CACHE_TTL, () =>
      safeCount(pool, 'SELECT COUNT(*) as cnt FROM course_mst WHERE IsActive = 1 AND (IsDelete IS NULL OR IsDelete = 0)')
    ),
    cached(`qs:batches:role:${roleKey}:dept:${deptKey}`, CACHE_TTL, () =>
      safeCount(pool, 'SELECT COUNT(*) as cnt FROM batch_mst WHERE (IsDelete IS NULL OR IsDelete = 0) AND (Cancel IS NULL OR Cancel = 0) AND SDate <= CURDATE() AND EDate >= CURDATE()')
    ),
    cached(`qs:faculty:role:${roleKey}:dept:${deptKey}`, CACHE_TTL, () =>
      safeCount(pool, 'SELECT COUNT(*) as cnt FROM faculty_master WHERE (IsDelete IS NULL OR IsDelete = 0)')
    ),
  ]);

  return { totalStudents, activeCourses, activeBatches, totalFaculty };
}
