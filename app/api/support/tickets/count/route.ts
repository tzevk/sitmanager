import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { apiRateLimiter } from '@/lib/rate-limit';
import { getTicketStats } from '@/lib/support-tickets';

const MANAGE_PERMISSION = 'support_ticket.manage';

/**
 * GET /api/support/tickets/count
 * Lightweight badge/poll endpoint. Managers (and super admins) see counts across
 * all tickets; regular users only see their own. `attention` = tickets that still
 * need action (open + in_progress).
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimited = await apiRateLimiter(request);
    if (rateLimited) return rateLimited;

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { session, permissions } = auth;
    const canManage = permissions.includes(MANAGE_PERMISSION);
    const stats = await getTicketStats(canManage ? undefined : session.userId);
    const attention = (stats.open || 0) + (stats.in_progress || 0);

    return NextResponse.json({
      success: true,
      canManage,
      open: stats.open,
      inProgress: stats.in_progress,
      attention,
      total: stats.total,
    });
  } catch (error) {
    console.error('Error counting support tickets:', error);
    return NextResponse.json({ success: false, error: 'Failed to count tickets' }, { status: 500 });
  }
}
