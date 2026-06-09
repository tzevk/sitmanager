import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { publicFormRateLimiter } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const rateLimited = await publicFormRateLimiter(req);
    if (rateLimited) return rateLimited;

    const body = await req.json().catch(() => ({}));
    const password = String(body?.password ?? '');
    const configured = process.env.PAY_AT_OFFICE_OVERRIDE_PASSWORD;

    if (!configured) {
      return NextResponse.json(
        { error: 'Pay at Office override is not configured' },
        { status: 503 }
      );
    }

    const providedBuffer = Buffer.from(password);
    const expectedBuffer = Buffer.from(configured);

    if (
      providedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid override password' }, { status: 403 });
  } catch (error) {
    console.error('Pay at Office override error:', error);
    return NextResponse.json(
      { error: 'Failed to validate override password' },
      { status: 500 }
    );
  }
}
