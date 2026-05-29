import { NextRequest, NextResponse } from 'next/server';
import { logMetaLeadEmailClick } from '@/lib/services/meta-ads.service';

function extractIpAddress(req: NextRequest): string | null {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip');
}

export async function GET(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const destinationUrl = await logMetaLeadEmailClick({
      token,
      ipAddress: extractIpAddress(req),
      userAgent: req.headers.get('user-agent'),
      referer: req.headers.get('referer'),
    });

    return NextResponse.redirect(destinationUrl, { status: 307 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid lead email link';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}