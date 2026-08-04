import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getEmployeeWeeklyMonitoring, saveMonitoringManualFields } from '@/lib/services/monitoring.service';

function isValidDate(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'monitoring.view');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const adminUserId = Number(searchParams.get('adminUserId'));
  const weekStart = searchParams.get('weekStart');

  if (!Number.isInteger(adminUserId) || adminUserId <= 0) {
    return NextResponse.json({ error: 'Valid adminUserId is required' }, { status: 400 });
  }
  if (!isValidDate(weekStart)) {
    return NextResponse.json({ error: 'Valid weekStart (YYYY-MM-DD) is required' }, { status: 400 });
  }

  try {
    const days = await getEmployeeWeeklyMonitoring(adminUserId, weekStart);
    return NextResponse.json({ days });
  } catch (error) {
    console.error('Error fetching weekly monitoring:', error);
    return NextResponse.json({ error: 'Failed to fetch weekly monitoring' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requirePermission(req, 'monitoring.update');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const adminUserId = Number(body?.adminUserId);
    const date = String(body?.date ?? '');

    if (!Number.isInteger(adminUserId) || adminUserId <= 0) {
      return NextResponse.json({ error: 'Valid adminUserId is required' }, { status: 400 });
    }
    if (!isValidDate(date)) {
      return NextResponse.json({ error: 'Valid date (YYYY-MM-DD) is required' }, { status: 400 });
    }

    await saveMonitoringManualFields({
      adminUserId,
      date,
      firstHalfSummary: body?.firstHalfSummary ?? null,
      secondHalfSummary: body?.secondHalfSummary ?? null,
      socialMediaInquiries:
        body?.socialMediaInquiries === '' || body?.socialMediaInquiries == null
          ? null
          : Number(body.socialMediaInquiries),
      updatedBy: auth.session.userId ?? null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving weekly monitoring:', error);
    return NextResponse.json({ error: 'Failed to save weekly monitoring' }, { status: 500 });
  }
}
