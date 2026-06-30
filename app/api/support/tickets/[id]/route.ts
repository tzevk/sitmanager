import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { apiRateLimiter } from '@/lib/rate-limit';
import { logTableActivity } from '@/lib/activity-log';
import {
  getTicket,
  getReplies,
  updateTicketStatus,
  TICKET_STATUSES,
  type TicketStatus,
} from '@/lib/support-tickets';

const MANAGE_PERMISSION = 'support_ticket.manage';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

/** GET /api/support/tickets/:id — ticket detail + conversation thread. */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimited = await apiRateLimiter(request);
    if (rateLimited) return rateLimited;

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { session, permissions } = auth;
    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ success: false, error: 'Invalid ticket ID' }, { status: 400 });

    const ticket = await getTicket(id);
    if (!ticket) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });

    const canManage = permissions.includes(MANAGE_PERMISSION);
    // Owners see their own tickets; managers see everyone's.
    if (!canManage && ticket.user_id !== session.userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const replies = await getReplies(id);
    return NextResponse.json({ success: true, data: { ticket, replies }, canManage });
  } catch (error) {
    console.error('Error fetching support ticket:', error);
    return NextResponse.json({ success: false, error: 'Failed to load ticket' }, { status: 500 });
  }
}

/** PATCH /api/support/tickets/:id — change status (managers only). */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimited = await apiRateLimiter(request);
    if (rateLimited) return rateLimited;

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!auth.permissions.includes(MANAGE_PERMISSION)) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to manage tickets' },
        { status: 403 }
      );
    }

    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ success: false, error: 'Invalid ticket ID' }, { status: 400 });

    const ticket = await getTicket(id);
    if (!ticket) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });

    const body = await request.json();
    const status = body.status as TicketStatus;
    if (!TICKET_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    await updateTicketStatus(id, status);
    await logTableActivity(request, {
      tableName: 'support_tickets',
      action: 'UPDATE',
      recordId: id,
      details: { status },
    });

    return NextResponse.json({ success: true, message: 'Status updated' });
  } catch (error) {
    console.error('Error updating support ticket:', error);
    return NextResponse.json({ success: false, error: 'Failed to update ticket' }, { status: 500 });
  }
}
