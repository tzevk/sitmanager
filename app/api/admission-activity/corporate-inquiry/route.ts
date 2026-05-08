import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { logTableActivity } from '@/lib/activity-log';
import {
  listCorporateInquiries,
  patchCorporateInquiry,
  createCorporateInquiry,
  updateCorporateInquiry,
  deleteCorporateInquiry,
} from '@/lib/services/corporate-inquiry.service';

function errResponse(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  const status = (err as { status?: number }).status ?? 500;
  if (status < 500) return NextResponse.json({ error: message }, { status });
  console.error(`[corporate-inquiry] ${fallback}:`, err);
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.view');
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const result = await listCorporateInquiries({
      page: Math.max(1, Number(searchParams.get('page')) || 1),
      limit: Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25)),
      search: searchParams.get('search')?.trim() || '',
      status: searchParams.get('status')?.trim() || '',
    });

    const cacheHit = false; // service handles cache internally
    return NextResponse.json(result, { headers: { 'X-Cache': cacheHit ? 'HIT' : 'MISS' } });
  } catch (err) { return errResponse(err, 'GET failed'); }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.update');
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    if (!body?.Id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await patchCorporateInquiry({ ...body, Id: Number(body.Id) });
    return NextResponse.json({ success: true });
  } catch (err) { return errResponse(err, 'PATCH failed'); }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.create');
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const { insertId, duplicate } = await createCorporateInquiry(body);

    if (!duplicate) {
      await logTableActivity(req, {
        tableName: 'corporate_inquiry',
        action: 'CREATE',
        recordId: insertId,
        details: { companyName: body.CompanyName || null },
      });
    }

    return NextResponse.json({ success: true, insertId, duplicate });
  } catch (err) { return errResponse(err, 'POST failed'); }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.update');
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    if (!body?.Id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await updateCorporateInquiry({ ...body, Id: Number(body.Id) });

    await logTableActivity(req, {
      tableName: 'corporate_inquiry',
      action: 'UPDATE',
      recordId: body.Id,
      details: { companyName: body.CompanyName || null },
    });

    return NextResponse.json({ success: true });
  } catch (err) { return errResponse(err, 'PUT failed'); }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.delete');
    if (auth instanceof NextResponse) return auth;

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await deleteCorporateInquiry(Number(id));

    await logTableActivity(req, { tableName: 'corporate_inquiry', action: 'DELETE', recordId: id });

    return NextResponse.json({ success: true });
  } catch (err) { return errResponse(err, 'DELETE failed'); }
}
