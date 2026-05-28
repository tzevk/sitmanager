import { NextRequest, NextResponse } from 'next/server';
import {
  syncMetaLead,
  verifyMetaSignature,
  verifyMetaWebhookChallenge,
  type MetaWebhookLeadEvent,
} from '@/lib/services/meta-ads.service';
import { webhookRateLimiter } from '@/lib/rate-limit';

// Lead flow ownership:
// Meta Ads Lead Form -> Facebook Webhook -> this Backend API -> MariaDB / CRM -> Dashboard Display

function extractLeadEvents(payload: unknown): MetaWebhookLeadEvent[] {
  const root = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const entries = Array.isArray(root.entry) ? root.entry : [];
  const events: MetaWebhookLeadEvent[] = [];

  for (const entry of entries) {
    const record = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    const changes = Array.isArray(record.changes) ? record.changes : [];
    for (const change of changes) {
      const changeRecord = change && typeof change === 'object' ? change as Record<string, unknown> : {};
      if (String(changeRecord.field || '') !== 'leadgen') continue;
      const value = changeRecord.value && typeof changeRecord.value === 'object'
        ? changeRecord.value as Record<string, unknown>
        : {};
      events.push(value as MetaWebhookLeadEvent);
    }
  }

  return events;
}

export async function GET(req: NextRequest) {
  const rateLimited = await webhookRateLimiter(req);
  if (rateLimited) return rateLimited;

  const result = verifyMetaWebhookChallenge(req.nextUrl.searchParams);
  return new NextResponse(result.body, {
    status: result.status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export async function POST(req: NextRequest) {
  try {
    const rateLimited = await webhookRateLimiter(req);
    if (rateLimited) return rateLimited;

    const rawBody = await req.text();
    const signatureHeader = req.headers.get('x-hub-signature-256');
    console.info('Meta Ads webhook POST received', {
      hasSignature: Boolean(signatureHeader),
      contentLength: rawBody.length,
      userAgent: req.headers.get('user-agent') || null,
    });

    if (!verifyMetaSignature(rawBody, signatureHeader)) {
      console.error('Meta Ads webhook signature verification failed', {
        hasSignature: Boolean(signatureHeader),
      });
      return NextResponse.json({ error: 'Invalid Meta signature' }, { status: 401 });
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};
    const entries = Array.isArray((payload as { entry?: unknown }).entry)
      ? (payload as { entry: unknown[] }).entry.length
      : 0;
    console.info('Meta Ads webhook payload parsed', {
      object: (payload as { object?: unknown }).object ?? null,
      entryCount: entries,
    });

    const events = extractLeadEvents(payload);
    console.info('Meta Ads webhook lead events extracted', {
      eventCount: events.length,
      leadIds: events.map((event) => event.leadgen_id || null),
    });

    if (events.length === 0) {
      return NextResponse.json({ ok: true, received: 0 });
    }

    const results = [] as Array<{ leadId: string; inquiryId: number; duplicate: boolean; created: boolean }>;
    for (const event of events) {
      console.info('Meta Ads webhook syncing lead', {
        leadId: event.leadgen_id || null,
        pageId: event.page_id || null,
        formId: event.form_id || null,
        createdTime: event.created_time || null,
      });

      const result = await syncMetaLead(event, payload);
      console.info('Meta Ads webhook lead synced', {
        leadId: result.leadId,
        inquiryId: result.inquiryId,
        duplicate: result.duplicate,
        created: result.created,
      });

      results.push({
        leadId: result.leadId,
        inquiryId: result.inquiryId,
        duplicate: result.duplicate,
        created: result.created,
      });
    }

    return NextResponse.json({ ok: true, received: results.length, results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process Meta webhook';
    console.error('Meta Ads webhook error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}