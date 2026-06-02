import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import {
  META_BATCH_SCORE_FORMULA,
  generateMetaBatchRecommendations,
  getPersistedMetaBatchRecommendations,
} from '@/lib/services/meta-batch-recommendation.service';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['inquiry.view', 'report_inquiry.view']);
    if (auth instanceof NextResponse) return auth;

    const url = req.nextUrl;
    const limitRaw = Number(url.searchParams.get('limit') || '10');
    const totalBudgetRaw = Number(url.searchParams.get('totalBudget') || process.env.META_ADS_RECOMMENDATION_BUDGET || '300');
    const scoreDate = url.searchParams.get('scoreDate') || undefined;
    const source = (url.searchParams.get('source') || 'persisted').toLowerCase();

    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(100, Math.trunc(limitRaw)) : 10;
    const totalBudget = Number.isFinite(totalBudgetRaw) && totalBudgetRaw > 0
      ? Math.min(300, totalBudgetRaw)
      : 300;

    if (source === 'persisted') {
      const rows = await getPersistedMetaBatchRecommendations({ scoreDate, limit });
      if (rows.length > 0) {
        return NextResponse.json({
          source: 'persisted',
          formula: META_BATCH_SCORE_FORMULA,
          scoreDate: rows[0].scoreDate,
          totalBudget,
          recommendations: rows,
        });
      }
    }

    const live = await generateMetaBatchRecommendations({ totalBudget, scoreDate });
    return NextResponse.json({
      source: 'live',
      formula: live.formula,
      scoreDate: live.scoreDate,
      totalBudget: live.totalBudget,
      recommendations: live.recommendations.slice(0, limit),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to compute Meta batch recommendations';
    console.error('Meta batch recommendations GET error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
