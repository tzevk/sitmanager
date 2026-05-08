import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { dashboardRateLimiter } from '@/lib/rate-limit';
import { getDashboardStats } from '@/lib/services/dashboard.service';

export async function GET(request: NextRequest) {
  try {
    const rateLimited = await dashboardRateLimiter(request);
    if (rateLimited) return rateLimited;

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const stats = await getDashboardStats({
      role: auth.session.role,
      department: auth.session.department || 'unknown',
    });

    return NextResponse.json(stats, {
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
