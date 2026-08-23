import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { setInquiryReminder, clearInquiryReminder } from '@/lib/services/inquiry.service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['inquiry.update', 'inquiry.edit']);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => ({}));
    const inquiryId = Number(body?.inquiryId);
    const hours = Number(body?.hours);

    const reminderAt = await setInquiryReminder(inquiryId, hours);
    return NextResponse.json({ success: true, reminderAt });
  } catch (error: unknown) {
    const status = (error as { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (status === 400) return NextResponse.json({ error: message }, { status: 400 });
    console.error('Set inquiry reminder error:', error);
    return NextResponse.json({ error: 'Failed to set reminder', details: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['inquiry.update', 'inquiry.edit']);
    if (auth instanceof NextResponse) return auth;

    const inquiryId = Number(req.nextUrl.searchParams.get('inquiryId'));
    await clearInquiryReminder(inquiryId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const status = (error as { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (status === 400) return NextResponse.json({ error: message }, { status: 400 });
    console.error('Clear inquiry reminder error:', error);
    return NextResponse.json({ error: 'Failed to clear reminder', details: message }, { status: 500 });
  }
}
