import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { fetchMetaCampaignPerformance } from '@/lib/services/meta-ads.service';

interface CampaignTotals {
  reach: number;
  impressions: number;
  clicks: number;
  leads: number;
  spend: number;
}

interface CampaignRow {
  reach?: number | null;
  impressions?: number | null;
  clicks?: number | null;
  leads?: number | null;
  spend?: number | null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['inquiry.view', 'report_inquiry.view']);
    if (auth instanceof NextResponse) return auth;

    const url = req.nextUrl;
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');
    const campaigns = await fetchMetaCampaignPerformance({ dateFrom, dateTo }) as CampaignRow[];

    const totals = campaigns.reduce(
      (acc: CampaignTotals, row: CampaignRow): CampaignTotals => ({
        reach: acc.reach + Number(row.reach || 0),
        impressions: acc.impressions + Number(row.impressions || 0),
        clicks: acc.clicks + Number(row.clicks || 0),
        leads: acc.leads + Number(row.leads || 0),
        spend: acc.spend + Number(row.spend || 0),
      }),
      { reach: 0, impressions: 0, clicks: 0, leads: 0, spend: 0 }
    );

    return NextResponse.json({
      campaigns,
      totals: {
        ...totals,
        ctr: totals.impressions > 0 ? totals.clicks / totals.impressions * 100 : 0,
        cpl: totals.leads > 0 ? totals.spend / totals.leads : null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch Meta campaign performance';
    console.error('Meta campaign performance error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}