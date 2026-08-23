import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getDueReminders } from '@/lib/services/inquiry.service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'inquiry.view');
    if (auth instanceof NextResponse) return auth;

    const reminders = await getDueReminders();
    return NextResponse.json({ reminders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Due reminders GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch due reminders', details: message }, { status: 500 });
  }
}
