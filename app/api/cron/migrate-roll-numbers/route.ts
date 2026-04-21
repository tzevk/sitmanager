/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * POST /api/cron/migrate-roll-numbers
 *
 * One-shot migration: copies Roll_No values from the legacy database
 * (OLD_DB_*) into the current database (DB_*) for every admission record
 * that has a roll number assigned.
 *
 * Safety guarantees:
 *   - Old DB is accessed via getOldPool() which blocks any non-SELECT query
 *     at the pool level (throws "Blocked non-read query on OLD DB").
 *   - New DB writes only touch `admission_master.Roll_No`.
 *   - Records that already have a Roll_No in the new DB are SKIPPED
 *     (never overwritten) unless ?force=1 is passed.
 *   - Defaults to dry-run — pass ?dryRun=false to actually commit changes.
 *
 * Matching strategy (tried in order, first match wins):
 *   1. Student_Id + Batch_Id  (works if IDs were preserved across DBs)
 *   2. Student_Name + Batch_code  (fallback when IDs differ)
 *
 * Auth: Bearer CRON_SECRET  |  x-cron-secret header  |  x-vercel-cron  |  dev mode
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getOldPool } from '@/lib/old-db';

export const runtime = 'nodejs';
// Allow up to 5 minutes — large batches can be slow across two remote DBs.
export const maxDuration = 300;

/* ── Auth ─────────────────────────────────────────────────────────── */
function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get('x-vercel-cron')) return true;
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth?.trim() === `Bearer ${secret}`) return true;
    if (req.headers.get('x-cron-secret') === secret) return true;
    return false;
  }
  return process.env.NODE_ENV !== 'production';
}

/* ── Types ────────────────────────────────────────────────────────── */
interface OldRecord {
  Student_Id: number;
  Batch_Id: number;
  Roll_No: string;
  Student_Name: string;
  Batch_code: string;
}

interface Result {
  roll_no: string;
  student_name: string;
  batch_code: string;
  match_strategy: 'id' | 'name+batch' | 'none';
  action: 'updated' | 'skipped_existing' | 'not_found' | 'dry_run';
  existing_roll_no?: string;
}

/* ── Handler ──────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get('dryRun') !== 'false';   // default: true
  const force  = searchParams.get('force') === '1';         // overwrite existing
  const limit  = Math.min(10_000, parseInt(searchParams.get('limit') || '10000', 10));

  const oldPool = getOldPool();
  const newPool = getPool();

  /* ── 1. Read roll numbers from OLD DB (read-only pool enforces this) ── */
  let oldRecords: OldRecord[];
  try {
    const [rows] = await oldPool.query<any[]>(`
      SELECT
        am.Student_Id,
        am.Batch_Id,
        am.Roll_No,
        COALESCE(s.Student_Name, '') AS Student_Name,
        COALESCE(b.Batch_code,   '') AS Batch_code
      FROM admission_master am
      LEFT JOIN student_master s ON s.Student_Id = am.Student_Id
      LEFT JOIN batch_mst      b ON b.Batch_Id   = am.Batch_Id
      WHERE am.Roll_No IS NOT NULL
        AND am.Roll_No != ''
        AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
      ORDER BY am.Batch_Id, am.Student_Id
      LIMIT ?
    `, [limit]);
    oldRecords = rows as OldRecord[];
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to read from old DB', detail: err?.message },
      { status: 500 }
    );
  }

  if (oldRecords.length === 0) {
    return NextResponse.json({
      message: 'No roll numbers found in old DB.',
      total: 0, updated: 0, skipped: 0, not_found: 0,
    });
  }

  /* ── 2. Pre-fetch new DB admission index for fast lookup ── */
  // Index 1: by (Student_Id, Batch_Id)
  // Index 2: by (normalised Student_Name, Batch_code)
  let newByIds:   Map<string, { Admission_Id: number; Roll_No: string | null }>;
  let newByNames: Map<string, { Admission_Id: number; Roll_No: string | null }>;

  try {
    const [newRows] = await newPool.query<any[]>(`
      SELECT
        am.Admission_Id,
        am.Student_Id,
        am.Batch_Id,
        am.Roll_No,
        COALESCE(s.Student_Name, '') AS Student_Name,
        COALESCE(b.Batch_code,   '') AS Batch_code
      FROM admission_master am
      LEFT JOIN student_master s ON s.Student_Id = am.Student_Id
      LEFT JOIN batch_mst      b ON b.Batch_Id   = am.Batch_Id
      WHERE (am.IsDelete = 0 OR am.IsDelete IS NULL)
        AND (am.Cancel   = 0 OR am.Cancel   IS NULL)
    `);

    newByIds   = new Map();
    newByNames = new Map();

    for (const r of newRows as any[]) {
      const idKey   = `${r.Student_Id}::${r.Batch_Id}`;
      const nameKey = `${String(r.Student_Name).trim().toLowerCase()}::${String(r.Batch_code).trim().toLowerCase()}`;
      const entry   = { Admission_Id: r.Admission_Id, Roll_No: r.Roll_No ?? null };
      if (!newByIds.has(idKey))   newByIds.set(idKey, entry);
      if (!newByNames.has(nameKey)) newByNames.set(nameKey, entry);
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to read from new DB', detail: err?.message },
      { status: 500 }
    );
  }

  /* ── 3. Match and build update plan ── */
  const results: Result[] = [];
  const toUpdate: { admissionId: number; rollNo: string }[] = [];

  for (const old of oldRecords) {
    const rollNo = String(old.Roll_No).trim();
    if (!rollNo) continue;

    // Try ID-based match first
    const idKey = `${old.Student_Id}::${old.Batch_Id}`;
    let match = newByIds.get(idKey);
    let strategy: Result['match_strategy'] = match ? 'id' : 'none';

    // Fallback: name + batch_code match
    if (!match) {
      const nameKey = `${String(old.Student_Name).trim().toLowerCase()}::${String(old.Batch_code).trim().toLowerCase()}`;
      if (nameKey !== '::') {          // skip empty-name records
        match = newByNames.get(nameKey);
        if (match) strategy = 'name+batch';
      }
    }

    if (!match) {
      results.push({
        roll_no: rollNo,
        student_name: old.Student_Name,
        batch_code: old.Batch_code,
        match_strategy: 'none',
        action: 'not_found',
      });
      continue;
    }

    const existingRollNo = match.Roll_No ? String(match.Roll_No).trim() : '';

    // Skip if new DB already has a roll number and force is off
    if (existingRollNo && !force) {
      results.push({
        roll_no: rollNo,
        student_name: old.Student_Name,
        batch_code: old.Batch_code,
        match_strategy: strategy,
        action: 'skipped_existing',
        existing_roll_no: existingRollNo,
      });
      continue;
    }

    toUpdate.push({ admissionId: match.Admission_Id, rollNo });
    results.push({
      roll_no: rollNo,
      student_name: old.Student_Name,
      batch_code: old.Batch_code,
      match_strategy: strategy,
      action: dryRun ? 'dry_run' : 'updated',
      ...(existingRollNo ? { existing_roll_no: existingRollNo } : {}),
    });
  }

  /* ── 4. Commit updates to new DB (skipped in dry-run) ── */
  let actuallyUpdated = 0;

  if (!dryRun && toUpdate.length > 0) {
    const conn = await newPool.getConnection();
    try {
      await conn.beginTransaction();

      // Process in chunks of 200 to avoid overly long transactions
      const CHUNK = 200;
      for (let i = 0; i < toUpdate.length; i += CHUNK) {
        const chunk = toUpdate.slice(i, i + CHUNK);
        for (const { admissionId, rollNo } of chunk) {
          await conn.query(
            `UPDATE admission_master SET Roll_No = ? WHERE Admission_Id = ?`,
            [rollNo, admissionId]
          );
          actuallyUpdated++;
        }
      }

      await conn.commit();
    } catch (err: any) {
      await conn.rollback();
      return NextResponse.json(
        { error: 'Transaction failed; all changes rolled back', detail: err?.message },
        { status: 500 }
      );
    } finally {
      conn.release();
    }
  }

  /* ── 5. Summary ── */
  const summary = {
    dry_run: dryRun,
    force_overwrite: force,
    old_db_records_read: oldRecords.length,
    matched_by_id:         results.filter(r => r.match_strategy === 'id').length,
    matched_by_name_batch: results.filter(r => r.match_strategy === 'name+batch').length,
    not_found:             results.filter(r => r.action === 'not_found').length,
    skipped_existing:      results.filter(r => r.action === 'skipped_existing').length,
    updated:               dryRun ? 0 : actuallyUpdated,
    would_update:          dryRun ? toUpdate.length : 0,
  };

  return NextResponse.json({ summary, results }, { status: 200 });
}

/* GET — quick status / dry-run shortcut */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Redirect to POST with dryRun=true
  const url = new URL(req.url);
  url.searchParams.set('dryRun', 'true');
  const fakeReq = new NextRequest(url, { method: 'POST' });
  // Copy auth headers
  req.headers.forEach((v, k) => fakeReq.headers.set(k, v));
  return POST(fakeReq);
}
