import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { logTableActivity } from '@/lib/activity-log';
import { cached, invalidateCache } from '@/lib/db';
import { logEndpointTiming } from '@/lib/perf-log';
import {
  createInquiry,
  getInquiryById,
  listInquiries,
  updateInquiry,
} from '@/lib/services/inquiry.service';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let perfStatus: 'ok' | 'error' = 'ok';
  let perfCode = 200;
  try {
    const auth = await requirePermission(req, 'inquiry.create');
    if (auth instanceof NextResponse) {
      perfCode = auth.status;
      return auth;
    }

    const body = await req.json();

    const insertId = await createInquiry(body, auth.session.userId);

    await logTableActivity(req, {
      tableName: 'Student_Inquiry',
      action: 'CREATE',
      recordId: insertId,
      details: { studentName: body.Student_Name?.trim() ?? null, courseId: body.Course_Id ?? null },
    });

    invalidateCache('api:inquiry');

    return NextResponse.json({ success: true, Student_Id: insertId });
  } catch (error: unknown) {
    perfStatus = 'error';
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = (error as { status?: number }).status ?? 500;
    perfCode = status;
    if (status === 400) return NextResponse.json({ error: message }, { status: 400 });
    console.error('Create inquiry error:', error);
    return NextResponse.json({ error: 'Failed to create inquiry', details: message }, { status: 500 });
  } finally {
    logEndpointTiming({
      endpoint: '/api/inquiry',
      method: 'POST',
      durationMs: Date.now() - startedAt,
      status: perfStatus,
      code: perfCode,
    });
  }
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  let perfStatus: 'ok' | 'error' = 'ok';
  let perfCode = 200;
  try {
    const auth = await requirePermission(req, 'inquiry.view');
    if (auth instanceof NextResponse) {
      perfCode = auth.status;
      return auth;
    }

    const url = req.nextUrl;
    const singleId = url.searchParams.get('id');

    if (singleId) {
      const id = parseInt(singleId);
      const row = await cached(`api:inquiry:single:${id}`, 20_000, () => getInquiryById(id));
      if (!row) {
        perfCode = 404;
        return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
      }
      return NextResponse.json({ inquiry: row });
    }

    const queryKey = url.searchParams.toString();
    const result = await cached(`api:inquiry:list:${queryKey}`, 20_000, async () => listInquiries({
      page: Math.max(1, parseInt(url.searchParams.get('page') || '1')),
      limit: Math.min(100, Math.max(10, parseInt(url.searchParams.get('limit') || '25'))),
      search: url.searchParams.get('search')?.trim() || '',
      discipline: url.searchParams.get('discipline') || '',
      inquiryType: url.searchParams.get('inquiryType') || '',
      leadTag: url.searchParams.get('leadTag')?.trim() || '',
      location: (url.searchParams.get('location') || '').trim(),
      training: url.searchParams.get('training') || '',
      statusId: url.searchParams.get('status') || '',
      duplicatesOnly: url.searchParams.get('duplicatesOnly') === '1',
      dateFrom: url.searchParams.get('dateFrom') || '',
      dateTo: url.searchParams.get('dateTo') || '',
      puneOnly: url.searchParams.get('puneOnly') === '1',
      followUpDue: url.searchParams.get('followUpDue') === '1',
    }));

    return NextResponse.json(result);
  } catch (error: unknown) {
    perfStatus = 'error';
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = (error as { status?: number }).status ?? 500;
    perfCode = status;
    if (status === 400) return NextResponse.json({ error: message }, { status: 400 });
    console.error('Inquiry GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch inquiry data', details: message }, { status: 500 });
  } finally {
    logEndpointTiming({
      endpoint: '/api/inquiry',
      method: 'GET',
      durationMs: Date.now() - startedAt,
      status: perfStatus,
      code: perfCode,
      meta: { hasId: req.nextUrl.searchParams.has('id') },
    });
  }
}

export async function PUT(req: NextRequest) {
  const startedAt = Date.now();
  let perfStatus: 'ok' | 'error' = 'ok';
  let perfCode = 200;
  try {
    const auth = await requirePermission(req, ['inquiry.update', 'inquiry.edit']);
    if (auth instanceof NextResponse) {
      perfCode = auth.status;
      return auth;
    }

    const body = await req.json();
    const { Student_Id } = body;

    if (!Student_Id) {
      perfCode = 400;
      return NextResponse.json({ error: 'Student_Id is required' }, { status: 400 });
    }

    await updateInquiry(Number(Student_Id), body, auth.session.userId);

    await logTableActivity(req, {
      tableName: 'Student_Inquiry',
      action: 'UPDATE',
      recordId: Student_Id,
      details: { studentName: body.Student_Name?.trim() ?? null, statusId: body.Status_id ?? null },
    });

    invalidateCache('api:inquiry');

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    perfStatus = 'error';
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = (error as { status?: number }).status ?? 500;
    perfCode = status;
    if (status === 400) return NextResponse.json({ error: message }, { status: 400 });
    console.error('Update inquiry error:', error);
    return NextResponse.json({ error: 'Failed to update inquiry', details: message }, { status: 500 });
  } finally {
    logEndpointTiming({
      endpoint: '/api/inquiry',
      method: 'PUT',
      durationMs: Date.now() - startedAt,
      status: perfStatus,
      code: perfCode,
    });
  }
}
