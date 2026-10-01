/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export const runtime = 'nodejs';

async function tableExists(pool: any): Promise<boolean> {
  try {
    const [rows] = await pool.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'calendly_bookings' LIMIT 1`
    ) as any;
    return (rows as any[]).length > 0;
  } catch { return false; }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'inquiry.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    if (!(await tableExists(pool))) {
      return NextResponse.json({ bookings: [], total: 0 });
    }

    const url = req.nextUrl;
    // windowHours: how far back to look (default 2 hours)
    const windowHours = Math.min(24, Math.max(1, parseInt(url.searchParams.get('windowHours') || '2')));
    const uncalledOnly = url.searchParams.get('uncalledOnly') !== '0';

    const conditions = [
      'IsDelete = 0',
      `received_at >= DATE_SUB(NOW(), INTERVAL ${windowHours} HOUR)`,
    ];
    if (uncalledOnly) conditions.push('called_at IS NULL');

    const [rows] = await pool.query(
      `SELECT id, invitee_name, invitee_email, invitee_mobile, event_start_time,
              event_type, calendly_uri, received_at, called_at, inquiry_id
       FROM calendly_bookings
       WHERE ${conditions.join(' AND ')}
       ORDER BY received_at DESC
       LIMIT 50`
    ) as any;

    const bookings = (rows as any[]).map((r: any) => ({
      id: r.id,
      name: r.invitee_name || '',
      email: r.invitee_email || '',
      mobile: r.invitee_mobile || null,
      eventStartTime: r.event_start_time ? String(r.event_start_time) : null,
      eventType: r.event_type || null,
      calendlyUri: r.calendly_uri || null,
      receivedAt: String(r.received_at),
      calledAt: r.called_at ? String(r.called_at) : null,
      inquiryId: r.inquiry_id || null,
      minutesSinceReceived: Math.floor((Date.now() - new Date(r.received_at).getTime()) / 60000),
    }));

    return NextResponse.json({ bookings, total: bookings.length });
  } catch (error: any) {
    console.error('Calendly bookings GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch bookings', details: error.message }, { status: 500 });
  }
}
