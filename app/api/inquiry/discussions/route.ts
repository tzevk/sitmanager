/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { cached, getPool, invalidateCache } from '@/lib/db';
import { logEndpointTiming } from '@/lib/perf-log';
import { requireAuth } from '@/lib/api-auth';

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

async function resolveInquiryLink(pool: any, inquiryTable: string, inquiryIdNum: number) {
  const mapRows = await runGuardedQuery(pool,
    `SELECT Inquiry_Id, Student_Id
     FROM ${inquiryTable}
     WHERE Inquiry_Id = ? OR Student_Id = ?
     ORDER BY Inquiry_Id DESC
     LIMIT 1`,
    [inquiryIdNum, inquiryIdNum]
  );

  const mapped = (mapRows as any[])[0] || {};
  return {
    canonicalInquiryId: Number(mapped.Inquiry_Id || inquiryIdNum),
    canonicalStudentId: mapped.Student_Id == null ? null : Number(mapped.Student_Id),
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
    const { canonicalInquiryId, canonicalStudentId } = await resolveInquiryLink(pool, inquiryTable, inquiryIdNum);

    const withNextDate = await hasNextDateColumn(pool);
    const nextDateSelect = withNextDate ? 'nextdate' : 'NULL as nextdate';
    const cacheKey = `api:inquiry:discussions:${canonicalInquiryId}:${canonicalStudentId ?? inquiryIdNum}`;
    const rows = await cached(cacheKey, 10_000, async () => runGuardedQuery(
      pool,
      `SELECT id, date, ${nextDateSelect}, discussion, created_by, created_date
       FROM awt_inquirydiscussion
       WHERE (Inquiry_id = ? OR student_id = ?) AND (deleted = 0 OR deleted IS NULL)
         AND date IS NOT NULL AND TRIM(COALESCE(date, '')) <> ''
       ORDER BY id ASC`,
      [canonicalInquiryId, canonicalStudentId ?? inquiryIdNum],
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

    const { inquiryId, discussion, nextFollowUpDate } = body;
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

    const createdBy = auth.session.userId;

    // Canonicalize to Inquiry_Id when caller sends Student_Id.
    const { canonicalInquiryId, canonicalStudentId } = await resolveInquiryLink(pool, inquiryTable, inquiryIdNum);

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
    invalidateCache('api:inquiry:discussions');
    return NextResponse.json({ success: true, id: insertId });
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
    const { id, discussion } = body;

    if (!id || !discussion?.trim()) {
      perfCode = 400;
      return NextResponse.json({ error: 'id and discussion are required' }, { status: 400 });
    }

    const idNum = Number(id);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      perfCode = 400;
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    await pool.query(
      `UPDATE awt_inquirydiscussion SET discussion = ? WHERE id = ? AND (deleted = 0 OR deleted IS NULL)`,
      [discussion.trim(), idNum]
    );

    invalidateCache('api:inquiry:discussions');

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
