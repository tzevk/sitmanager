import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission } from '@/lib/api-auth';
import { findEmployeeSheet, getScoreboard, parseScoreboardWorkbook, saveScoreboard } from '@/lib/services/sales-scoreboard.service';

export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Sales scoreboard figures for the dashboard widgets, from the latest uploaded
 * SALES_PERFORMANCE_SCOREBOARD sheet. ?view=tracker → weekly Sales Tracker rows
 * (every signed-in user); ?view=individual → every salesperson's prospect log
 * (individual_sales_tracker.view); ?view=mine → the signed-in user's own sheet,
 * matched by name (every signed-in user, own data only).
 */
export async function GET(req: NextRequest) {
  const view = req.nextUrl.searchParams.get('view');
  if (view === 'mine') {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    try {
      const board = await getScoreboard();
      const mine = findEmployeeSheet(board, auth.session.firstName ?? '', auth.session.lastName ?? '');
      return NextResponse.json({
        source: board.source, dataThrough: board.dataThrough, uploadedAt: board.uploadedAt ?? null, uploadedBy: board.uploadedBy ?? null,
        individuals: mine ? [mine] : [],
      });
    } catch (error) {
      console.error('Sales scoreboard (mine) GET error:', error);
      return NextResponse.json({ error: 'Could not load your sales tracker' }, { status: 500 });
    }
  }
  if (view !== 'tracker' && view !== 'individual') {
    return NextResponse.json({ error: 'view must be "tracker", "individual" or "mine"' }, { status: 400 });
  }
  const auth = view === 'tracker' ? await requireAuth(req) : await requirePermission(req, 'individual_sales_tracker.view');
  if (auth instanceof NextResponse) return auth;

  try {
    const board = await getScoreboard();
    const meta = { source: board.source, dataThrough: board.dataThrough, uploadedAt: board.uploadedAt ?? null, uploadedBy: board.uploadedBy ?? null };
    return NextResponse.json(view === 'tracker' ? { ...meta, rows: board.tracker } : { ...meta, individuals: board.individuals });
  } catch (error) {
    console.error('Sales scoreboard GET error:', error);
    return NextResponse.json({ error: 'Could not load the sales scoreboard' }, { status: 500 });
  }
}

/** Upload a new SALES_PERFORMANCE_SCOREBOARD workbook (sales_scoreboard.create). */
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'sales_scoreboard.create');
  if (auth instanceof NextResponse) return auth;

  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose the scoreboard sheet to upload.' }, { status: 400 });
    if (!/\.xlsx?$/i.test(file.name)) return NextResponse.json({ error: 'Upload the sheet as an Excel file (.xlsx).' }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'The file is larger than 10 MB.' }, { status: 400 });

    let board;
    try {
      board = parseScoreboardWorkbook(Buffer.from(await file.arrayBuffer()), file.name);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'The sheet could not be read.' }, { status: 422 });
    }

    const { firstName, lastName, email, userId } = auth.session;
    const uploader = `${firstName ?? ''} ${lastName ?? ''}`.trim() || email || `User ${userId}`;
    await saveScoreboard(board, uploader);

    return NextResponse.json({
      success: true,
      trackerWeeks: new Set(board.tracker.map((t) => t.week_key)).size,
      employees: board.individuals.map((i) => ({ employee: i.employee, entries: i.rows.length })),
      dataThrough: board.dataThrough,
    });
  } catch (error) {
    console.error('Sales scoreboard upload error:', error);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
