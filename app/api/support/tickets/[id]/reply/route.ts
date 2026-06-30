import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { apiRateLimiter } from '@/lib/rate-limit';
import { logTableActivity } from '@/lib/activity-log';
import { getTicket, addReply } from '@/lib/support-tickets';

const MANAGE_PERMISSION = 'support_ticket.manage';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/support/tickets/:id/reply
 * Managers can reply to any ticket; owners can reply on their own thread.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimited = await apiRateLimiter(request);
    if (rateLimited) return rateLimited;

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { session, permissions } = auth;
    const id = parseInt((await params).id, 10);
    if (isNaN(id)) return NextResponse.json({ success: false, error: 'Invalid ticket ID' }, { status: 400 });

    const ticket = await getTicket(id);
    if (!ticket) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });

    const canManage = permissions.includes(MANAGE_PERMISSION);
    const isOwner = ticket.user_id === session.userId;
    if (!canManage && !isOwner) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const message = String(body.message ?? '').trim();
    if (!message) {
      return NextResponse.json({ success: false, error: 'Reply message is required' }, { status: 400 });
    }

    const authorName = [session.firstName, session.lastName].filter(Boolean).join(' ').trim() || session.email || null;
    const replyId = await addReply({
      ticketId: id,
      message,
      authorUserId: session.userId,
      authorName,
      isAdmin: canManage,
    });

    await logTableActivity(request, {
      tableName: 'support_ticket_replies',
      action: 'CREATE',
      recordId: replyId,
      details: { ticketId: id, isAdmin: canManage },
    });

    return NextResponse.json({ success: true, id: replyId, message: 'Reply added' });
  } catch (error) {
    console.error('Error replying to support ticket:', error);
    return NextResponse.json({ success: false, error: 'Failed to add reply' }, { status: 500 });
  }
}
