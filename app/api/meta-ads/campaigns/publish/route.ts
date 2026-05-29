import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import {
  listMetaCampaignPublishLog,
  publishMetaCampaign,
  type MetaCampaignPublishInput,
} from '@/lib/services/meta-ads.service';

function normalizeSpecialAdCategories(value: unknown): MetaCampaignPublishInput['specialAdCategories'] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean) as MetaCampaignPublishInput['specialAdCategories'];
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['inquiry.view', 'report_inquiry.view']);
    if (auth instanceof NextResponse) return auth;

    const limit = Number(req.nextUrl.searchParams.get('limit') || '10');
    const rows = await listMetaCampaignPublishLog(limit);
    return NextResponse.json({ rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch Meta campaign publish log';
    console.error('Meta campaign publish log GET error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['inquiry.update']);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => ({}));
    const input: MetaCampaignPublishInput = {
      name: typeof body?.name === 'string' ? body.name : '',
      objective: typeof body?.objective === 'string' ? body.objective as MetaCampaignPublishInput['objective'] : 'OUTCOME_LEADS',
      status: typeof body?.status === 'string' ? body.status as MetaCampaignPublishInput['status'] : 'PAUSED',
      specialAdCategories: normalizeSpecialAdCategories(body?.specialAdCategories),
    };

    const campaign = await publishMetaCampaign(input, {
      requestedBy: auth.session.userId,
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to publish Meta campaign';
    console.error('Meta campaign publish POST error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}