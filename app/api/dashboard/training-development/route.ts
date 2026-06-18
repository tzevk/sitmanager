import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { invalidateCache } from '@/lib/db';
import {
  TrainingDashboardWidgetType,
  upsertTrainingDashboardMeta,
} from '@/lib/services/training-dashboard.service';

const WIDGET_TYPES = new Set<TrainingDashboardWidgetType>(['upcoming_exam', 'finished_exam', 'google_review']);

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json().catch(() => ({}));
    const widgetType = String(body?.widgetType || '').trim() as TrainingDashboardWidgetType;
    const entityKey = String(body?.entityKey || '').trim();

    if (!WIDGET_TYPES.has(widgetType)) {
      return NextResponse.json({ error: 'Invalid widget type' }, { status: 400 });
    }
    if (!entityKey) {
      return NextResponse.json({ error: 'Entity key is required' }, { status: 400 });
    }

    await upsertTrainingDashboardMeta({
      widgetType,
      entityKey,
      status: body?.status == null ? null : String(body.status),
      numericValue: body?.numericValue == null ? null : Number(body.numericValue),
      dateValue: body?.dateValue == null ? null : String(body.dateValue),
      notes: body?.notes == null ? null : String(body.notes),
      updatedBy: auth.session.userId,
    });

    invalidateCache('dashboard:data:training_and_development');
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update training dashboard';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
