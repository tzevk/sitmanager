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

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
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
      pageId: typeof body?.pageId === 'string' ? body.pageId : null,
      websiteUrl: typeof body?.websiteUrl === 'string' ? body.websiteUrl : null,
      instantForm: body?.instantForm && typeof body.instantForm === 'object'
        ? {
            name: typeof body.instantForm.name === 'string' ? body.instantForm.name : '',
            privacyPolicyUrl: typeof body.instantForm.privacyPolicyUrl === 'string' ? body.instantForm.privacyPolicyUrl : '',
            thankYouTitle: typeof body.instantForm.thankYouTitle === 'string' ? body.instantForm.thankYouTitle : null,
            thankYouBody: typeof body.instantForm.thankYouBody === 'string' ? body.instantForm.thankYouBody : null,
            followUpActionUrl: typeof body.instantForm.followUpActionUrl === 'string' ? body.instantForm.followUpActionUrl : null,
            questionKeys: normalizeStringArray(body.instantForm.questionKeys),
          }
        : null,
      creative: body?.creative && typeof body.creative === 'object'
        ? {
            name: typeof body.creative.name === 'string' ? body.creative.name : '',
            message: typeof body.creative.message === 'string' ? body.creative.message : '',
            headline: typeof body.creative.headline === 'string' ? body.creative.headline : null,
            linkUrl: typeof body.creative.linkUrl === 'string' ? body.creative.linkUrl : null,
            imageHash: typeof body.creative.imageHash === 'string' ? body.creative.imageHash : null,
            imageUrl: typeof body.creative.imageUrl === 'string' ? body.creative.imageUrl : null,
            callToActionType: typeof body.creative.callToActionType === 'string'
              ? body.creative.callToActionType as NonNullable<NonNullable<MetaCampaignPublishInput['creative']>['callToActionType']>
              : null,
          }
        : null,
      adSet: body?.adSet && typeof body.adSet === 'object'
        ? {
            name: typeof body.adSet.name === 'string' ? body.adSet.name : '',
            dailyBudget: Number(body.adSet.dailyBudget || 0),
            countries: normalizeStringArray(body.adSet.countries),
            billingEvent: typeof body.adSet.billingEvent === 'string'
              ? body.adSet.billingEvent as NonNullable<NonNullable<MetaCampaignPublishInput['adSet']>['billingEvent']>
              : null,
            optimizationGoal: typeof body.adSet.optimizationGoal === 'string'
              ? body.adSet.optimizationGoal as NonNullable<NonNullable<MetaCampaignPublishInput['adSet']>['optimizationGoal']>
              : null,
            destinationType: typeof body.adSet.destinationType === 'string'
              ? body.adSet.destinationType as NonNullable<NonNullable<MetaCampaignPublishInput['adSet']>['destinationType']>
              : null,
            startTime: typeof body.adSet.startTime === 'string' ? body.adSet.startTime : null,
            endTime: typeof body.adSet.endTime === 'string' ? body.adSet.endTime : null,
            status: typeof body.adSet.status === 'string'
              ? body.adSet.status as NonNullable<NonNullable<MetaCampaignPublishInput['adSet']>['status']>
              : null,
          }
        : null,
      ad: body?.ad && typeof body.ad === 'object'
        ? {
            name: typeof body.ad.name === 'string' ? body.ad.name : '',
            status: typeof body.ad.status === 'string'
              ? body.ad.status as NonNullable<NonNullable<MetaCampaignPublishInput['ad']>['status']>
              : null,
          }
        : null,
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