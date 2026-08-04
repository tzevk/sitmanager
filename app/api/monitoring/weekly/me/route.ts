import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getEmployeeWeeklyMonitoring, saveMonitoringManualFields } from '@/lib/services/monitoring.service';

/**
 * Self-service variant of /api/monitoring/weekly: always scoped to the
 * logged-in user's own awt_adminuser id (the same id session.userId is set
 * from at login) — no monitoring.view/update permission required, since
 * a user filling in their own daily report isn't an admin-only action.
 */

function isValidDate(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toNullableNumber(value: unknown): number | null {
  return value === '' || value == null ? null : Number(value);
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const weekStart = searchParams.get('weekStart');
  if (!isValidDate(weekStart)) {
    return NextResponse.json({ error: 'Valid weekStart (YYYY-MM-DD) is required' }, { status: 400 });
  }

  try {
    const days = await getEmployeeWeeklyMonitoring(session.userId, weekStart);
    return NextResponse.json({ days });
  } catch (error) {
    console.error('Error fetching own weekly monitoring:', error);
    return NextResponse.json({ error: 'Failed to fetch weekly monitoring' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const date = String(body?.date ?? '');
    if (!isValidDate(date)) {
      return NextResponse.json({ error: 'Valid date (YYYY-MM-DD) is required' }, { status: 400 });
    }

    await saveMonitoringManualFields({
      adminUserId: session.userId,
      date,
      firstHalfSummary: body?.firstHalfSummary ?? null,
      secondHalfSummary: body?.secondHalfSummary ?? null,
      whatsapp: toNullableNumber(body?.whatsapp),
      emailsReplied: toNullableNumber(body?.emailsReplied),
      socialMediaInquiries: toNullableNumber(body?.socialMediaInquiries),
      updatedBy: session.userId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving own weekly monitoring:', error);
    return NextResponse.json({ error: 'Failed to save weekly monitoring' }, { status: 500 });
  }
}
