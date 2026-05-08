import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { apiRateLimiter } from '@/lib/rate-limit';
import { listOnlineAdmissions, submitOnlineAdmission } from '@/lib/services/online-admission.service';

export async function GET(req: NextRequest) {
  try {
    const rateLimited = await apiRateLimiter(req);
    if (rateLimited) return rateLimited;

    const auth = await requirePermission(req, 'online_admission.view');
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);

    const result = await listOnlineAdmissions({
      page: Math.max(1, Number(searchParams.get('page')) || 1),
      limit: Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25)),
      search: searchParams.get('search')?.trim() || '',
      statusCategory: searchParams.get('statusCategory') || '',
      dateFrom: searchParams.get('dateFrom') || '',
      dateTo: searchParams.get('dateTo') || '',
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Online Admission GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const rateLimited = await apiRateLimiter(req);
    if (rateLimited) return rateLimited;

    const body = await req.json();

    if (!body.inquiryId) {
      return NextResponse.json({ error: 'Inquiry ID is required' }, { status: 400 });
    }

    const inquiryId = await submitOnlineAdmission({ ...body, inquiryId: Number(body.inquiryId) });

    return NextResponse.json({ success: true, inquiryId, message: 'Application submitted successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = (err as { status?: number }).status ?? 500;
    if (status === 404 || status === 400) return NextResponse.json({ error: message }, { status });
    console.error('Online Admission POST error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
