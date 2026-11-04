/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getPool } from '@/lib/db';
import { canSeeAllTasks } from '@/lib/services/my-tasks.service';
import {
  autoAssignPending,
  ensureAllocationTables,
  getAllocationSettings,
  listAllocationCounsellors,
  saveCounsellorAllocation,
  updateAllocationSettings,
} from '@/lib/services/lead-allocation.service';

export const runtime = 'nodejs';

/** GET — settings, counsellors with their batches, batch options, last 100 allocations. */
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'inquiry.view');
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureAllocationTables();
    const pool = getPool();
    const [settings, counsellors, canManage] = await Promise.all([
      getAllocationSettings(),
      listAllocationCounsellors(),
      canSeeAllTasks(auth.session),
    ]);
    const [batches] = await pool.query(
      `SELECT b.Batch_Id, b.Batch_code, cm.Course_Name, DATE_FORMAT(b.SDate, '%Y-%m-%d') AS SDate
         FROM batch_mst b LEFT JOIN course_mst cm ON cm.Course_Id = b.Course_Id
        WHERE (b.IsDelete = 0 OR b.IsDelete IS NULL) AND (b.Cancel IS NULL OR b.Cancel = 0)
          AND (b.SDate >= CURDATE() - INTERVAL 60 DAY OR b.IsActive = 1
               OR b.Batch_Id IN (SELECT batch_id FROM counsellor_batch))
        ORDER BY b.SDate DESC
        LIMIT 600`
    );
    const [log] = await pool.query(
      `SELECT l.id, l.Inquiry_Id, si.Student_Name, l.rule, l.detail, DATE_FORMAT(l.created_at, '%Y-%m-%d %H:%i') AS created_at,
              COALESCE(NULLIF(TRIM(c.display_name), ''), u.username) AS owner
         FROM inquiry_assignment_log l
         LEFT JOIN student_inquiry si ON si.Inquiry_Id = l.Inquiry_Id
         LEFT JOIN appt_counsellors c ON c.user_id = l.Assigned_User_Id
         LEFT JOIN awt_adminuser u ON u.id = l.Assigned_User_Id
        ORDER BY l.id DESC LIMIT 100`
    );
    const [[pending]] = await pool.query(
      `SELECT COUNT(*) AS n FROM student_inquiry si LEFT JOIN inquiry_assignments ia ON ia.Inquiry_Id = si.Inquiry_Id
        WHERE si.Inquiry_Id > ? AND ia.Inquiry_Id IS NULL AND (si.IsDelete = 0 OR si.IsDelete IS NULL)`,
      [settings.startAfterId]
    ) as any;
    return NextResponse.json({
      settings, counsellors, batches, log, canManage,
      unassignedSinceStart: settings.enabled ? Number(pending?.n || 0) : null,
    });
  } catch (error) {
    console.error('Lead allocation GET error:', error);
    return NextResponse.json({ error: 'Failed to load lead allocation' }, { status: 500 });
  }
}

async function requireManager(req: NextRequest) {
  const auth = await requirePermission(req, 'inquiry.update');
  if (auth instanceof NextResponse) return auth;
  if (!(await canSeeAllTasks(auth.session))) {
    return NextResponse.json({ error: 'Only the sales manager can change lead allocation' }, { status: 403 });
  }
  return auth;
}

/** PUT — { enabled?, firstResponseMinutes? } or { runNow: true } */
export async function PUT(req: NextRequest) {
  const auth = await requireManager(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json();
    if (body.runNow) return NextResponse.json({ result: await autoAssignPending({ limit: 300 }) });
    const settings = await updateAllocationSettings(
      { enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined, firstResponseMinutes: body.firstResponseMinutes },
      auth.session.userId
    );
    return NextResponse.json({ settings });
  } catch (error: any) {
    if (error?.status === 400) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Lead allocation PUT error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

/** POST — { userId, batchIds, acceptsLeads, inFallbackPool } */
export async function POST(req: NextRequest) {
  const auth = await requireManager(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json();
    await saveCounsellorAllocation(
      Number(body.userId),
      { batchIds: Array.isArray(body.batchIds) ? body.batchIds : [], acceptsLeads: body.acceptsLeads !== false, inFallbackPool: body.inFallbackPool !== false },
      auth.session.userId
    );
    return NextResponse.json({ success: true, counsellors: await listAllocationCounsellors() });
  } catch (error: any) {
    if (error?.status === 400) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Lead allocation POST error:', error);
    return NextResponse.json({ error: 'Failed to save counsellor' }, { status: 500 });
  }
}
