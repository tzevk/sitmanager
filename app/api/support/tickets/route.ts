import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { apiRateLimiter } from '@/lib/rate-limit';
import { logTableActivity } from '@/lib/activity-log';
import {
  listTickets,
  createTicket,
  getTicketStats,
  TICKET_STATUSES,
  type TicketStatus,
} from '@/lib/support-tickets';

const MANAGE_PERMISSION = 'support_ticket.manage';

/**
 * GET /api/support/tickets
 *   - Managers (super admin / support_ticket.manage): all accounts' tickets
 *   - Everyone else: only their own tickets
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimited = await apiRateLimiter(request);
    if (rateLimited) return rateLimited;

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { session, permissions } = auth;
    const canManage = permissions.includes(MANAGE_PERMISSION);

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') as TicketStatus | 'all' | null;
    const status = statusParam && (statusParam === 'all' || TICKET_STATUSES.includes(statusParam))
      ? statusParam
      : 'all';

    const [tickets, stats] = await Promise.all([
      listTickets({
        userId: canManage ? undefined : session.userId,
        status,
        search: searchParams.get('search') || undefined,
      }),
      getTicketStats(canManage ? undefined : session.userId),
    ]);

    return NextResponse.json({ success: true, data: tickets, stats, canManage });
  } catch (error) {
    console.error('Error listing support tickets:', error);
    return NextResponse.json({ success: false, error: 'Failed to load tickets' }, { status: 500 });
  }
}

/**
 * POST /api/support/tickets — any authenticated account can raise a query.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimited = await apiRateLimiter(request);
    if (rateLimited) return rateLimited;

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { session } = auth;
    const body = await request.json();

    const subject = String(body.subject ?? '').trim();
    const message = String(body.message ?? '').trim();
    if (!subject || !message) {
      return NextResponse.json(
        { success: false, error: 'Subject and message are required' },
        { status: 400 }
      );
    }

    const userName = [session.firstName, session.lastName].filter(Boolean).join(' ').trim() || null;
    const id = await createTicket({
      subject: subject.slice(0, 255),
      message,
      category: body.category ? String(body.category).slice(0, 80) : null,
      priority: body.priority,
      userId: session.userId,
      userName,
      userEmail: session.email ?? null,
      roleId: session.role ?? null,
      department: session.department ?? null,
    });

    await logTableActivity(request, {
      tableName: 'support_tickets',
      action: 'CREATE',
      recordId: id,
      details: { subject, priority: body.priority ?? 'normal' },
    });

    return NextResponse.json({ success: true, id, message: 'Ticket submitted' });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    return NextResponse.json({ success: false, error: 'Failed to submit ticket' }, { status: 500 });
  }
}
