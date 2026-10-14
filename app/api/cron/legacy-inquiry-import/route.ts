import { NextRequest, NextResponse } from 'next/server';
import { importMissingLegacyInquiries } from '@/lib/services/legacy-inquiry-import.service';

export const runtime = 'nodejs';
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get('x-vercel-cron')) return true;
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';
  const auth = req.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return bearer === secret || req.headers.get('x-cron-secret')?.trim() === secret;
}

/**
 * Scheduled: import inquiries created in the old software that are missing from
 * the new CRM (insert-only; see legacy-inquiry-import.service).
 * ?dryRun=1 counts without writing; ?full=1 re-scans every old inquiry.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const summary = await importMissingLegacyInquiries({
      dryRun: searchParams.get('dryRun') === '1',
      full: searchParams.get('full') === '1',
    });
    if (!summary.configured) return NextResponse.json({ ok: false, message: 'OLD_DB_HOST is not configured — skipped' });
    if (summary.imported || summary.errors.length) console.log('[legacy-inquiry-import]', JSON.stringify(summary));
    return NextResponse.json({ ok: summary.errors.length === 0, summary }, { status: summary.errors.length ? 500 : 200 });
  } catch (err: unknown) {
    console.error('[legacy-inquiry-import] failed:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Import failed' }, { status: 500 });
  }
}
