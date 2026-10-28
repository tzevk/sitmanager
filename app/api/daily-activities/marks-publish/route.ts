import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { getPublishedSheetIds, isMarksModule, MARKS_MODULE_RESOURCE, setSheetPublished } from '@/lib/marks-publish';

/**
 * "Publish to students" switch for one marks sheet.
 * GET  ?module=UNIT_TEST&sheetId=123      → { published }
 * POST { module, sheetId, published }      → { published }
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sourceModule = searchParams.get('module');
    const sheetId = Number(searchParams.get('sheetId') || 0);
    if (!isMarksModule(sourceModule) || !sheetId) {
      return NextResponse.json({ error: 'module and sheetId are required' }, { status: 400 });
    }
    const auth = await requirePermission(req, `${MARKS_MODULE_RESOURCE[sourceModule]}.view`);
    if (auth instanceof NextResponse) return auth;

    const published = await getPublishedSheetIds(getPool(), sourceModule, [sheetId]);
    return NextResponse.json({ published: published.has(sheetId) });
  } catch (err: unknown) {
    console.error('Marks publish GET error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sourceModule = body?.module;
    const sheetId = Number(body?.sheetId || 0);
    if (!isMarksModule(sourceModule) || !sheetId || typeof body?.published !== 'boolean') {
      return NextResponse.json({ error: 'module, sheetId and published are required' }, { status: 400 });
    }
    const auth = await requirePermission(req, `${MARKS_MODULE_RESOURCE[sourceModule]}.update`);
    if (auth instanceof NextResponse) return auth;

    const who = `${auth.session.firstName || ''} ${auth.session.lastName || ''}`.trim() || auth.session.email || null;
    await setSheetPublished(getPool(), sourceModule, sheetId, body.published, who);
    return NextResponse.json({ published: body.published });
  } catch (err: unknown) {
    console.error('Marks publish POST error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
