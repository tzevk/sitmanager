/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { cached, getPool, invalidateCache } from '@/lib/db';
import { logEndpointTiming } from '@/lib/perf-log';
import { requireAuth } from '@/lib/api-auth';
import { buildLevel2Link } from '@/lib/appointments/calendly';

let supportsStatementTimeout: boolean | null = null;

function withStatementTimeout(sql: string, seconds: number): string {
  const safeSeconds = Math.max(1, Math.min(30, Math.trunc(seconds)));
  return `SET STATEMENT max_statement_time=${safeSeconds} FOR ${sql}`;
}

async function runGuardedQuery(
  pool: ReturnType<typeof getPool>,
  sql: string,
  params: any[] = [],
  statementTimeoutSeconds = 5,
): Promise<any[]> {
  const timeoutSql = supportsStatementTimeout !== false
    ? withStatementTimeout(sql, statementTimeoutSeconds)
    : sql;

  try {
    const [rows] = await pool.query(timeoutSql, params);
    if (timeoutSql !== sql) supportsStatementTimeout = true;
    return rows as any[];
  } catch (error: any) {
    if (timeoutSql !== sql && supportsStatementTimeout !== false) {
      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('max_statement_time') || msg.includes('syntax')) {
        supportsStatementTimeout = false;
        const [rows] = await pool.query(sql, params);
        return rows as any[];
      }
    }
    throw error;
  }
}

async function resolveInquiryTableName(pool: any): Promise<string> {
  const rows = await runGuardedQuery(pool,
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND LOWER(TABLE_NAME) = 'student_inquiry'
     ORDER BY CASE WHEN TABLE_NAME = 'Student_Inquiry' THEN 0 ELSE 1 END
     LIMIT 1`
  );
  return String((rows as any[])[0]?.TABLE_NAME || '').trim() || 'Student_Inquiry';
}

async function hasNextDateColumn(pool: any): Promise<boolean> {
  const rows = await runGuardedQuery(pool,
    `SELECT COUNT(*) as cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'awt_inquirydiscussion'
       AND COLUMN_NAME = 'nextdate'`
  );
  return Number((rows as any[])[0]?.cnt || 0) > 0;
}

// Level 1 / Level 2 meeting columns on the first (NFABTU) discussion — added in place.
let levelColumnsReady: Promise<void> | null = null;
function ensureLevelColumns(pool: any): Promise<void> {
  if (!levelColumnsReady) {
    levelColumnsReady = (async () => {
      const rows = await runGuardedQuery(pool,
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'awt_inquirydiscussion'
           AND COLUMN_NAME IN ('meeting_level', 'level2_date', 'level2_account_user_id', 'level2_time', 'level2_invitee_uri')`);
      const have = new Set(rows.map((r: any) => r.COLUMN_NAME));
      const add = [
        ['meeting_level', 'TINYINT NULL'], ['level2_date', 'DATE NULL'], ['level2_account_user_id', 'INT NULL'],
        ['level2_time', 'VARCHAR(5) NULL'], ['level2_invitee_uri', 'VARCHAR(255) NULL'],
      ].filter(([c]) => !have.has(c));
      if (!add.length) return;
      await pool.query(`ALTER TABLE awt_inquirydiscussion ${add.map(([c, t]) => `ADD COLUMN ${c} ${t}`).join(', ')}`)
        .catch((err: any) => { if (err?.code !== 'ER_DUP_FIELDNAME') throw err; });
    })().catch((err) => { levelColumnsReady = null; throw err; });
  }
  return levelColumnsReady;
}

async function resolveInquiryLink(pool: any, inquiryTable: string, inquiryIdNum: number) {
  const exactRows = await runGuardedQuery(pool,
    `SELECT Inquiry_Id, Student_Id
     FROM ${inquiryTable}
     WHERE Inquiry_Id = ?
       AND (IsDelete = 0 OR IsDelete IS NULL)
     LIMIT 1`,
    [inquiryIdNum]
  );

  const exact = (exactRows as any[])[0];
  if (exact) {
    const canonicalStudentId = exact.Student_Id == null ? null : Number(exact.Student_Id);
    const linkedInquiryIds = canonicalStudentId && Number.isFinite(canonicalStudentId) && canonicalStudentId > 0
      ? await runGuardedQuery(pool,
          `SELECT Inquiry_Id
           FROM ${inquiryTable}
           WHERE Student_Id = ?
             AND (IsDelete = 0 OR IsDelete IS NULL)`,
          [canonicalStudentId]
        )
      : [];

    return {
      canonicalInquiryId: Number(exact.Inquiry_Id),
      canonicalStudentId,
      linkedInquiryIds: [Number(exact.Inquiry_Id), ...(linkedInquiryIds as any[]).map((row) => Number(row.Inquiry_Id))]
        .filter((value, index, values) => Number.isFinite(value) && value > 0 && values.indexOf(value) === index),
    };
  }

  const mapRows = await runGuardedQuery(pool,
    `SELECT Inquiry_Id, Student_Id
     FROM ${inquiryTable}
     WHERE Student_Id = ?
       AND (IsDelete = 0 OR IsDelete IS NULL)
     ORDER BY Inquiry_Id DESC
     LIMIT 1`,
    [inquiryIdNum]
  );

  const mapped = (mapRows as any[])[0] || {};
  const canonicalStudentId = mapped.Student_Id == null ? null : Number(mapped.Student_Id);
  const linkedInquiryIds = canonicalStudentId && Number.isFinite(canonicalStudentId) && canonicalStudentId > 0
    ? await runGuardedQuery(pool,
        `SELECT Inquiry_Id
         FROM ${inquiryTable}
         WHERE Student_Id = ?
           AND (IsDelete = 0 OR IsDelete IS NULL)`,
        [canonicalStudentId]
      )
    : [];

  return {
    canonicalInquiryId: Number(mapped.Inquiry_Id || inquiryIdNum),
    canonicalStudentId,
    linkedInquiryIds: [Number(mapped.Inquiry_Id || inquiryIdNum), ...(linkedInquiryIds as any[]).map((row) => Number(row.Inquiry_Id))]
      .filter((value, index, values) => Number.isFinite(value) && value > 0 && values.indexOf(value) === index),
  };
}

// GET discussions for an inquiry
export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  let perfStatus: 'ok' | 'error' = 'ok';
  let perfCode = 200;
  try {
    const pool = getPool();
    const url = req.nextUrl;
    const inquiryId = url.searchParams.get('inquiryId');
    const inquiryTable = await resolveInquiryTableName(pool);

    if (!inquiryId) {
      perfCode = 400;
      return NextResponse.json({ error: 'inquiryId is required' }, { status: 400 });
    }

    const inquiryIdNum = Number(inquiryId);
    if (!Number.isFinite(inquiryIdNum) || inquiryIdNum <= 0) {
      perfCode = 400;
      return NextResponse.json({ error: 'Invalid inquiryId' }, { status: 400 });
    }

    // Canonicalize inquiry id: discussions are stored against a canonical Inquiry_Id.
    // Accept callers providing either Inquiry_Id or Student_Id, but resolve to a single
    // canonical Inquiry_Id to avoid pulling discussions for other linked inquiries.
    const { canonicalInquiryId, canonicalStudentId, linkedInquiryIds } = await resolveInquiryLink(pool, inquiryTable, inquiryIdNum);

    await ensureLevelColumns(pool);
    const withNextDate = await hasNextDateColumn(pool);
    const nextDateSelect = withNextDate ? 'd.nextdate' : 'NULL as nextdate';

    // CRITICAL: Inquiry_Id and Student_Id are two SEPARATE numeric id spaces that
    // overlap in value. They must never be cross-matched, otherwise an inquiry
    // whose Student_Id happens to equal an unrelated inquiry's Inquiry_Id pulls
    // that other candidate's discussions. Match Inquiry_id only against real
    // Inquiry_Ids, and student_id only against real Student_Ids.
    const inquiryIds = (linkedInquiryIds.length > 0 ? linkedInquiryIds : [canonicalInquiryId])
      .filter((value, index, values) => Number.isFinite(value) && value > 0 && values.indexOf(value) === index);
    const studentIds = (canonicalStudentId && Number.isFinite(canonicalStudentId) && canonicalStudentId > 0)
      ? [canonicalStudentId]
      : [];

    const conditions: string[] = [];
    const params: number[] = [];
    if (inquiryIds.length > 0) {
      conditions.push(`d.Inquiry_id IN (${inquiryIds.map(() => '?').join(',')})`);
      params.push(...inquiryIds);
    }
    if (studentIds.length > 0) {
      conditions.push(`d.student_id IN (${studentIds.map(() => '?').join(',')})`);
      params.push(...studentIds);
    }
    // No matchable ids → no discussions (never fall back to matching everything).
    if (conditions.length === 0) {
      return NextResponse.json({ discussions: [] });
    }

    const cacheKey = `api:inquiry:discussions:i:${inquiryIds.join(',')}:s:${studentIds.join(',')}`;
    const rows = await cached(cacheKey, 10_000, async () => runGuardedQuery(
      pool,
      `SELECT d.id, d.date, ${nextDateSelect}, d.discussion, d.created_by, d.created_date,
              d.meeting_level, DATE_FORMAT(d.level2_date, '%Y-%m-%d') AS level2_date, d.level2_account_user_id,
              COALESCE(NULLIF(TRIM(CONCAT(COALESCE(a.firstname, ''), ' ', COALESCE(a.lastname, ''))), ''), a.username) AS level2_account_name,
              COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.firstname, ''), ' ', COALESCE(u.lastname, ''))), ''), u.username) AS created_by_name
       FROM awt_inquirydiscussion d
       LEFT JOIN awt_adminuser u ON u.id = d.created_by
       LEFT JOIN awt_adminuser a ON a.id = d.level2_account_user_id
       WHERE (${conditions.join(' OR ')}) AND (d.deleted = 0 OR d.deleted IS NULL)
       ORDER BY d.id ASC`,
      params,
      5,
    ));

    return NextResponse.json({ discussions: rows });
  } catch (error: any) {
    perfStatus = 'error';
    perfCode = 500;
    console.error('Discussions GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch discussions', details: error.message },
      { status: 500 }
    );
  } finally {
    logEndpointTiming({
      endpoint: '/api/inquiry/discussions',
      method: 'GET',
      durationMs: Date.now() - startedAt,
      status: perfStatus,
      code: perfCode,
      meta: { hasInquiryId: req.nextUrl.searchParams.has('inquiryId') },
    });
  }
}

// POST — add a discussion entry
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let perfStatus: 'ok' | 'error' = 'ok';
  let perfCode = 200;
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const body = await req.json();
    const inquiryTable = await resolveInquiryTableName(pool);

    const { inquiryId, discussion, nextFollowUpDate, meetingLevel, level2Date, level2AccountId } = body;
    if (!inquiryId || !discussion?.trim()) {
      return NextResponse.json(
        { error: 'inquiryId and discussion are required' },
        { status: 400 }
      );
    }

    const inquiryIdNum = Number(inquiryId);
    if (!Number.isFinite(inquiryIdNum) || inquiryIdNum <= 0) {
      perfCode = 400;
      return NextResponse.json({ error: 'Invalid inquiryId' }, { status: 400 });
    }

    if (nextFollowUpDate) {
      const [same] = await pool.query(`SELECT 1 AS same FROM DUAL WHERE CURDATE() = DATE(?)`, [nextFollowUpDate]);
      if ((same as any[]).length) {
        perfCode = 400;
        return NextResponse.json({ error: 'Next follow-up date cannot be the same as the current date' }, { status: 400 });
      }
    }

    const level = meetingLevel === 1 || meetingLevel === 2 || meetingLevel === 3 ? meetingLevel : null;
    const l2Date = level === 2 ? String(level2Date || '') : '';
    const l2Account = level === 2 ? Number(level2AccountId) : 0;
    if (level === 2 && (!/^\d{4}-\d{2}-\d{2}$/.test(l2Date) || !Number.isInteger(l2Account) || l2Account <= 0)) {
      perfCode = 400;
      return NextResponse.json({ error: 'Level 2 needs a meeting date and an account name' }, { status: 400 });
    }

    const createdBy = auth.session.userId;

    // Canonicalize to Inquiry_Id when caller sends Student_Id.
    const { canonicalInquiryId, canonicalStudentId } = await resolveInquiryLink(pool, inquiryTable, inquiryIdNum);

    await ensureLevelColumns(pool);
    const withNextDate = await hasNextDateColumn(pool);

    const [result] = withNextDate
      ? await pool.query(
          `INSERT INTO awt_inquirydiscussion
             (Inquiry_id, student_id, date, nextdate, discussion, deleted, created_by, created_date)
           VALUES (?, ?, CURDATE(), ?, ?, 0, ?, NOW())`,
            [canonicalInquiryId, canonicalStudentId, nextFollowUpDate || null, discussion.trim(), createdBy]
        )
      : await pool.query(
          `INSERT INTO awt_inquirydiscussion
             (Inquiry_id, student_id, date, discussion, deleted, created_by, created_date)
           VALUES (?, ?, CURDATE(), ?, 0, ?, NOW())`,
            [canonicalInquiryId, canonicalStudentId, discussion.trim(), createdBy]
        );

    const insertId = (result as any).insertId;
    if (level) {
      await pool.query(
        `UPDATE awt_inquirydiscussion SET meeting_level = ?, level2_date = ?, level2_account_user_id = ? WHERE id = ?`,
        [level, level === 2 ? l2Date : null, level === 2 ? l2Account : null, insertId]
      );
    }
    // Level 2 is booked by opening the prefilled Calendly link; the Calendly sync then creates the appointment.
    const calendlyUrl = level === 2 ? await buildLevel2Link(canonicalInquiryId, l2Date).catch(() => null) : null;
    invalidateCache('api:inquiry:discussions');
    invalidateCache('api:inquiry');
    return NextResponse.json({ success: true, id: insertId, calendlyUrl });
  } catch (error: any) {
    perfStatus = 'error';
    perfCode = 500;
    console.error('Discussions POST error:', error);
    return NextResponse.json(
      { error: 'Failed to add discussion', details: error.message },
      { status: 500 }
    );
  } finally {
    logEndpointTiming({
      endpoint: '/api/inquiry/discussions',
      method: 'POST',
      durationMs: Date.now() - startedAt,
      status: perfStatus,
      code: perfCode,
    });
  }
}

// PUT — update a discussion entry
export async function PUT(req: NextRequest) {
  const startedAt = Date.now();
  let perfStatus: 'ok' | 'error' = 'ok';
  let perfCode = 200;
  try {
    const pool = getPool();
    const body = await req.json();
    const { id, discussion, meetingLevel, level2Date, level2AccountId } = body;
    const editingLevel = meetingLevel === 1 || meetingLevel === 2 || meetingLevel === 3;

    if (!id || (!discussion?.trim() && !editingLevel)) {
      perfCode = 400;
      return NextResponse.json({ error: 'id and discussion are required' }, { status: 400 });
    }

    const idNum = Number(id);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      perfCode = 400;
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    if (discussion?.trim()) {
      await pool.query(
        `UPDATE awt_inquirydiscussion SET discussion = ? WHERE id = ? AND (deleted = 0 OR deleted IS NULL)`,
        [discussion.trim(), idNum]
      );
    }

    if (editingLevel) {
      await ensureLevelColumns(pool);
      const [found] = await pool.query(
        `SELECT Inquiry_id FROM awt_inquirydiscussion WHERE id = ? AND (deleted = 0 OR deleted IS NULL)`,
        [idNum]
      );
      const row = (found as any[])[0];
      if (!row) {
        perfCode = 404;
        return NextResponse.json({ error: 'Discussion not found' }, { status: 404 });
      }
      const isL2 = meetingLevel === 2;
      const l2Date = isL2 ? String(level2Date || '') : '';
      const l2Account = isL2 ? Number(level2AccountId) : 0;
      if (isL2 && (!/^\d{4}-\d{2}-\d{2}$/.test(l2Date) || !Number.isInteger(l2Account) || l2Account <= 0)) {
        perfCode = 400;
        return NextResponse.json({ error: 'Level 2 needs a meeting date and an account name' }, { status: 400 });
      }
      await pool.query(
        `UPDATE awt_inquirydiscussion SET meeting_level = ?, level2_date = ?, level2_account_user_id = ? WHERE id = ?`,
        [meetingLevel, isL2 ? l2Date : null, isL2 ? l2Account : null, idNum]
      );
    }

    invalidateCache('api:inquiry:discussions');
    invalidateCache('api:inquiry');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    perfStatus = 'error';
    perfCode = 500;
    console.error('Discussions PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update discussion', details: error.message },
      { status: 500 }
    );
  } finally {
    logEndpointTiming({
      endpoint: '/api/inquiry/discussions',
      method: 'PUT',
      durationMs: Date.now() - startedAt,
      status: perfStatus,
      code: perfCode,
    });
  }
}

// DELETE — soft-delete a discussion entry
export async function DELETE(req: NextRequest) {
  const startedAt = Date.now();
  let perfStatus: 'ok' | 'error' = 'ok';
  let perfCode = 200;
  try {
    const pool = getPool();
    const url = req.nextUrl;
    const id = url.searchParams.get('id');

    if (!id) {
      perfCode = 400;
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const idNum = Number(id);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      perfCode = 400;
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    await pool.query(
      `UPDATE awt_inquirydiscussion SET deleted = 1 WHERE id = ?`,
      [idNum]
    );

    invalidateCache('api:inquiry:discussions');
    invalidateCache('api:inquiry');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    perfStatus = 'error';
    perfCode = 500;
    console.error('Discussions DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete discussion', details: error.message },
      { status: 500 }
    );
  } finally {
    logEndpointTiming({
      endpoint: '/api/inquiry/discussions',
      method: 'DELETE',
      durationMs: Date.now() - startedAt,
      status: perfStatus,
      code: perfCode,
    });
  }
}
