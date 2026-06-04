/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

let _inquiryTableCache: string | null = null;
let _supportsStatementTimeout: boolean | null = null;
const STUDENT_COUNT_CACHE_TTL_MS = 30_000;
const COURSE_CACHE_TTL_MS = 10 * 60_000;

type CacheEntry = { value: number; expiresAt: number };
const studentCountCache = new Map<string, CacheEntry>();
const studentCountInFlight = new Map<string, Promise<number>>();
let courseCache: { rows: any[]; expiresAt: number } | null = null;

async function resolveInquiryTableName(pool: ReturnType<typeof getPool>): Promise<string> {
  if (_inquiryTableCache) return _inquiryTableCache;
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND LOWER(TABLE_NAME) = 'student_inquiry'
     ORDER BY CASE WHEN TABLE_NAME = 'Student_Inquiry' THEN 0 ELSE 1 END
     LIMIT 1`
  );
  _inquiryTableCache = String((rows as any[])[0]?.TABLE_NAME || '').trim() || 'Student_Inquiry';
  return _inquiryTableCache;
}

function withStatementTimeout(sql: string, seconds: number): string {
  const safeSeconds = Math.max(1, Math.min(30, Math.trunc(seconds)));
  return `SET STATEMENT max_statement_time=${safeSeconds} FOR ${sql}`;
}

function buildCountCacheKey(where: string, params: (string | number)[]): string {
  return `${where}::${JSON.stringify(params)}`;
}

function readCountCache(key: string): number | null {
  const hit = studentCountCache.get(key);
  if (!hit) return null;
  if (Date.now() >= hit.expiresAt) {
    studentCountCache.delete(key);
    return null;
  }
  return hit.value;
}

function writeCountCache(key: string, value: number): number {
  const normalized = Number.isFinite(Number(value)) ? Number(value) : 0;
  studentCountCache.set(key, { value: normalized, expiresAt: Date.now() + STUDENT_COUNT_CACHE_TTL_MS });
  return normalized;
}

async function getDedupedCount(key: string, loader: () => Promise<number>): Promise<number> {
  const cached = readCountCache(key);
  if (cached != null) return cached;

  const existing = studentCountInFlight.get(key);
  if (existing) return existing;

  const promise = loader()
    .then((value) => writeCountCache(key, value))
    .finally(() => {
      studentCountInFlight.delete(key);
    });

  studentCountInFlight.set(key, promise);
  return promise;
}

function readCourseCache(): any[] | null {
  if (!courseCache) return null;
  if (Date.now() >= courseCache.expiresAt) {
    courseCache = null;
    return null;
  }
  return courseCache.rows;
}

function writeCourseCache(rows: any[]): any[] {
  courseCache = { rows, expiresAt: Date.now() + COURSE_CACHE_TTL_MS };
  return rows;
}

// GET - fetch all students with pagination and search
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'student.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const inquiryTable = await resolveInquiryTableName(pool);
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';
    const courseId = searchParams.get('courseId')?.trim() || '';
    const sex = searchParams.get('sex')?.trim() || '';
    const admittedOnlyRaw = (searchParams.get('admittedOnly') || '1').trim().toLowerCase();
    const admittedOnly = !['0', 'false', 'no', 'all'].includes(admittedOnlyRaw);

    // Build WHERE clause
    const conditions: string[] = ['(s.IsDelete = 0 OR s.IsDelete IS NULL)'];
    const params: (string | number)[] = [];

    if (admittedOnly) {
      conditions.push(`(
        EXISTS (
          SELECT 1
          FROM admission_master am
          WHERE am.Student_Id = s.Student_Id
            AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
            AND (am.Cancel = 0 OR am.Cancel IS NULL)
        )
        OR EXISTS (
          SELECT 1
          FROM \`${inquiryTable}\` si_adm
          WHERE si_adm.Student_Id = s.Student_Id
            AND (si_adm.IsDelete = 0 OR si_adm.IsDelete IS NULL)
            AND (
              si_adm.OnlineState = 8
              OR IFNULL(si_adm.admission_done, 0) IN (1, 2)
              OR LOWER(TRIM(CAST(COALESCE(si_adm.Admission,'') AS CHAR))) IN (
                'yes','y','1','true',
                'admission taken','admissiontaken',
                'admitted','done','complete','completed','taken'
              )
              OR LOWER(TRIM(CAST(COALESCE(si_adm.Admission,'') AS CHAR))) LIKE '%admission%'
            )
        )
      )`);
    }

    if (search) {
      const like = `%${search}%`;
      conditions.push(`(
        s.Student_Name LIKE ?
        OR CONCAT_WS(' ', s.FName, s.MName, s.LName) LIKE ?
        OR s.Email LIKE ?
        OR s.Present_Mobile LIKE ?
        OR s.Present_City LIKE ?
        OR s.Batch_Code LIKE ?
        OR CAST(s.Student_Id AS CHAR) LIKE ?
        OR EXISTS (
          SELECT 1
          FROM course_mst c2
          WHERE c2.Course_Id = s.Course_Id
            AND c2.Course_Name LIKE ?
        )
      )`);
      params.push(like, like, like, like, like, like, like, like);
    }

    if (courseId) {
      conditions.push(`s.Course_Id = ?`);
      params.push(Number(courseId));
    }

    if (sex) {
      conditions.push(`s.Sex = ?`);
      params.push(sex);
    }

    const where = conditions.join(' AND ');

    const runQuery = async (
      sql: string,
      queryParams: (string | number)[] = [],
      options: { statementTimeoutSeconds?: number } = {}
    ) => {
      const timeoutSql = options.statementTimeoutSeconds && _supportsStatementTimeout !== false
        ? withStatementTimeout(sql, options.statementTimeoutSeconds)
        : sql;

      try {
        return await pool.query<any[]>(timeoutSql, queryParams);
      } catch (error: any) {
        if (error?.code === 'PROTOCOL_CONNECTION_LOST') {
          const retryPool = getPool();
          return await retryPool.query<any[]>(timeoutSql, queryParams);
        }

        if (timeoutSql !== sql && _supportsStatementTimeout !== false) {
          const msg = String(error?.message || '').toLowerCase();
          if (msg.includes('max_statement_time') || msg.includes('syntax')) {
            _supportsStatementTimeout = false;
            return await pool.query<any[]>(sql, queryParams);
          }
        }

        if (timeoutSql !== sql) _supportsStatementTimeout = true;
        throw error;
      }
    };

    const countKey = buildCountCacheKey(where, params);
    const countPromise = getDedupedCount(countKey, async () => {
      const [countRows] = await runQuery(
        `SELECT COUNT(*) AS total FROM student_master s WHERE ${where}`,
        params,
        { statementTimeoutSeconds: 4 }
      );
      return Number((countRows as any[])[0]?.total ?? 0);
    });

    const rowsPromise = runQuery(
        `SELECT
          s.Student_Id, s.Student_Name, s.FName, s.LName, s.MName,
          s.Qualification, s.Course_Id, s.Batch_Code, s.DOB, s.Sex, s.Nationality,
          s.Present_Address, s.Present_City, s.Present_State, s.Present_Country, s.Present_Pin, s.Present_Mobile,
          s.Email, s.IsActive,
          c.Course_Name
        FROM student_master s
        LEFT JOIN course_mst c ON s.Course_Id = c.Course_Id
        WHERE ${where}
        ORDER BY s.Student_Id DESC
        LIMIT ? OFFSET ?`,
        [...params, limit, offset],
        { statementTimeoutSeconds: 8 }
      );

    const coursesPromise = (async () => {
      const cached = readCourseCache();
      if (cached) return cached;
      const [courseRows] = await runQuery(
        `SELECT Course_Id, Course_Name FROM course_mst
         WHERE (IsDelete = 0 OR IsDelete IS NULL)
         ORDER BY Course_Name`
      );
      return writeCourseCache(courseRows as any[]);
    })();

    const [[rows], courses] = await Promise.all([rowsPromise, coursesPromise]);

    let total = readCountCache(countKey);
    let totalIsEstimate = false;

    if (total == null) {
      const countOrTimeout = await Promise.race<number | null>([
        countPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200)),
      ]);

      if (countOrTimeout == null) {
        total = offset + (rows as any[]).length + ((rows as any[]).length === limit ? 1 : 0);
        totalIsEstimate = true;
      } else {
        total = countOrTimeout;
      }
    }

    return NextResponse.json({
      rows,
      courses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        totalIsEstimate,
      },
    });
  } catch (err: unknown) {
    console.error('Student API error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - soft delete student
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'student.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await pool.query(`UPDATE student_master SET IsDelete = 1 WHERE Student_Id = ?`, [id]);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Student DELETE error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}
