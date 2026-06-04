/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { cached, getPool, invalidateCache } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { logTableActivity } from '@/lib/activity-log';
import crypto from 'crypto';
import { logEndpointTiming } from '@/lib/perf-log';

let supportsStatementTimeout: boolean | null = null;

function withStatementTimeout(sql: string, seconds: number): string {
  const safeSeconds = Math.max(1, Math.min(30, Math.trunc(seconds)));
  return `SET STATEMENT max_statement_time=${safeSeconds} FOR ${sql}`;
}

async function runGuardedQuery(
  pool: ReturnType<typeof getPool>,
  sql: string,
  params: any[] = [],
  statementTimeoutSeconds?: number,
): Promise<any[]> {
  const timeoutSql = statementTimeoutSeconds && supportsStatementTimeout !== false
    ? withStatementTimeout(sql, statementTimeoutSeconds)
    : sql;

  try {
    const [rows] = await pool.query(timeoutSql, params);
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
    if (timeoutSql !== sql) supportsStatementTimeout = true;
    throw error;
  }
}

// GET — list placement jobs
export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  let perfStatus: 'ok' | 'error' = 'ok';
  let perfCode = 200;
  try {
    const auth = await requirePermission(req, 'placement.view');
    if (auth instanceof NextResponse) {
      perfCode = auth.status;
      return auth;
    }

    const pool = getPool();
    const url = req.nextUrl;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || '';

    const conditions: string[] = ['j.IsDelete = 0'];
    const params: any[] = [];

    if (search) {
      conditions.push('(j.Company_Name LIKE ? OR j.Job_Title LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status) {
      conditions.push('j.Status = ?');
      params.push(status);
    }

    const where = conditions.join(' AND ');

    const cacheKey = `placement:jobs:list:${page}:${limit}:${search}:${status}`;
    const result = await cached(cacheKey, 20_000, async () => {
      const countPromise = runGuardedQuery(
        pool,
        `SELECT COUNT(*) AS total FROM placement_jobs j WHERE ${where}`,
        params,
        4,
      );

      const rowsPromise = runGuardedQuery(
        pool,
        `SELECT j.*, 
                (SELECT COUNT(*) FROM placement_applications a WHERE a.Job_Id = j.Job_Id AND a.IsDelete = 0) AS application_count
         FROM placement_jobs j
         WHERE ${where}
         ORDER BY j.Created_Date DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
        8,
      );

      const [rows, countRows] = await Promise.all([rowsPromise, countPromise]);
      const total = Number((countRows as any[])[0]?.total ?? 0);
      return { rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    perfStatus = 'error';
    perfCode = 500;
    console.error('Placement jobs GET error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  } finally {
    logEndpointTiming({
      endpoint: '/api/placement/jobs',
      method: 'GET',
      durationMs: Date.now() - startedAt,
      status: perfStatus,
      code: perfCode,
      meta: { search: Boolean(req.nextUrl.searchParams.get('search')), statusFilter: Boolean(req.nextUrl.searchParams.get('status')) },
    });
  }
}

// POST — create new job posting
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let perfStatus: 'ok' | 'error' = 'ok';
  let perfCode = 200;
  try {
    const auth = await requirePermission(req, 'placement.create');
    if (auth instanceof NextResponse) {
      perfCode = auth.status;
      return auth;
    }

    const pool = getPool();
    const body = await req.json();

    const token = crypto.randomBytes(32).toString('hex');

    const [result] = await pool.query(
      `INSERT INTO placement_jobs
         (Company_Name, Company_Email, Job_Title, Job_Description, Requirements,
          Location, Package, Min_Percentage, Eligible_Courses, Eligible_Batches,
          Max_Backlogs, Application_Deadline, Status, Token, Created_By)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?)`,
      [
        body.Company_Name || null,
        body.Company_Email || null,
        body.Job_Title || null,
        body.Job_Description || null,
        body.Requirements || null,
        body.Location || null,
        body.Package || null,
        body.Min_Percentage ? parseFloat(body.Min_Percentage) : 0,
        body.Eligible_Courses || null,
        body.Eligible_Batches || null,
        body.Max_Backlogs ? parseInt(body.Max_Backlogs) : 0,
        body.Application_Deadline || null,
        token,
        (auth as any).userId || null,
      ]
    );

    const jobId = (result as any).insertId;

    await logTableActivity(req, {
      tableName: 'placement_jobs',
      action: 'CREATE',
      recordId: jobId,
      details: { companyName: body.Company_Name || null, jobTitle: body.Job_Title || null },
    });

    invalidateCache('placement:jobs:list');

    return NextResponse.json({ success: true, Job_Id: jobId, token });
  } catch (err: unknown) {
    perfStatus = 'error';
    perfCode = 500;
    console.error('Placement jobs POST error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  } finally {
    logEndpointTiming({
      endpoint: '/api/placement/jobs',
      method: 'POST',
      durationMs: Date.now() - startedAt,
      status: perfStatus,
      code: perfCode,
    });
  }
}
