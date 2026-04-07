import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

type AlumniJob = {
  id?: string | number;
  job_type?: string | number | null;
  designation?: string | null;
  company?: string | null;
  salary?: string | null;
  salary_min?: string | number | null;
  salary_max?: string | number | null;
  experience_min?: string | number | null;
  experience_max?: string | number | null;
  Deadline?: string | number | null;
  created?: string | number | null;
  receive_type?: string | number | null;
  external_link?: string | null;
  locations?: unknown;
  description?: string | null;
  company_desc?: string | null;
};

function isAuthorized(request: Request): boolean {
  const vercelCron = request.headers.get('x-vercel-cron');
  if (vercelCron) return true;

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth && auth.trim() === `Bearer ${secret}`) return true;
    return request.headers.get('x-cron-secret') === secret;
  }

  return process.env.NODE_ENV !== 'production';
}

function parseHeadersJson(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function toText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function toSafeJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return 'null';
  }
}

async function ensureTable() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alumni_jobs_snapshot (
      External_Id VARCHAR(64) NOT NULL,
      Job_Type VARCHAR(16) NULL,
      Designation VARCHAR(255) NULL,
      Company_Name VARCHAR(255) NULL,
      Salary_Text VARCHAR(255) NULL,
      Salary_Min VARCHAR(50) NULL,
      Salary_Max VARCHAR(50) NULL,
      Experience_Min VARCHAR(50) NULL,
      Experience_Max VARCHAR(50) NULL,
      Deadline_Unix BIGINT NULL,
      Created_Unix BIGINT NULL,
      Receive_Type VARCHAR(16) NULL,
      External_Link VARCHAR(500) NULL,
      Locations_JSON LONGTEXT NULL,
      Description_HTML LONGTEXT NULL,
      Company_Desc_HTML LONGTEXT NULL,
      Raw_JSON LONGTEXT NULL,
      Is_Active TINYINT(1) NOT NULL DEFAULT 1,
      Created_At TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      Updated_At TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (External_Id),
      KEY idx_active (Is_Active),
      KEY idx_created_unix (Created_Unix),
      KEY idx_deadline_unix (Deadline_Unix)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const sourceUrl = process.env.ALUMNI_JOBS_SOURCE_URL;
    if (!sourceUrl) {
      return NextResponse.json(
        { success: false, error: 'ALUMNI_JOBS_SOURCE_URL is not configured' },
        { status: 500 }
      );
    }

    const headerJson = parseHeadersJson(process.env.ALUMNI_JOBS_SOURCE_HEADERS_JSON);
    const bearer = process.env.ALUMNI_JOBS_SOURCE_AUTH_BEARER;
    const cookie = process.env.ALUMNI_JOBS_SOURCE_COOKIE;

    const headers: Record<string, string> = {
      accept: 'application/json, text/plain, */*',
      ...headerJson,
    };

    if (bearer) headers.authorization = `Bearer ${bearer}`;
    if (cookie) headers.cookie = cookie;

    const upstream = await fetch(sourceUrl, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    const rawText = await upstream.text();
    if (!upstream.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Upstream request failed: ${upstream.status}`,
          body: rawText.slice(0, 1000),
        },
        { status: 502 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Source response is not valid JSON' },
        { status: 502 }
      );
    }

    const data =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as { data?: unknown }).data
        : null;

    if (!Array.isArray(data)) {
      return NextResponse.json(
        { success: false, error: 'Source JSON does not contain an array in data' },
        { status: 502 }
      );
    }

    const jobs = data as AlumniJob[];

    await ensureTable();
    const pool = getPool();

    if (jobs.length > 0) {
      await pool.query('UPDATE alumni_jobs_snapshot SET Is_Active = 0 WHERE Is_Active = 1');
    }

    let upserted = 0;
    for (const job of jobs) {
      const externalId = toText(job.id);
      if (!externalId) continue;

      await pool.query(
        `
          INSERT INTO alumni_jobs_snapshot (
            External_Id,
            Job_Type,
            Designation,
            Company_Name,
            Salary_Text,
            Salary_Min,
            Salary_Max,
            Experience_Min,
            Experience_Max,
            Deadline_Unix,
            Created_Unix,
            Receive_Type,
            External_Link,
            Locations_JSON,
            Description_HTML,
            Company_Desc_HTML,
            Raw_JSON,
            Is_Active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
          ON DUPLICATE KEY UPDATE
            Job_Type = VALUES(Job_Type),
            Designation = VALUES(Designation),
            Company_Name = VALUES(Company_Name),
            Salary_Text = VALUES(Salary_Text),
            Salary_Min = VALUES(Salary_Min),
            Salary_Max = VALUES(Salary_Max),
            Experience_Min = VALUES(Experience_Min),
            Experience_Max = VALUES(Experience_Max),
            Deadline_Unix = VALUES(Deadline_Unix),
            Created_Unix = VALUES(Created_Unix),
            Receive_Type = VALUES(Receive_Type),
            External_Link = VALUES(External_Link),
            Locations_JSON = VALUES(Locations_JSON),
            Description_HTML = VALUES(Description_HTML),
            Company_Desc_HTML = VALUES(Company_Desc_HTML),
            Raw_JSON = VALUES(Raw_JSON),
            Is_Active = 1
        `,
        [
          externalId,
          toText(job.job_type),
          toText(job.designation),
          toText(job.company),
          toText(job.salary),
          toText(job.salary_min),
          toText(job.salary_max),
          toText(job.experience_min),
          toText(job.experience_max),
          toText(job.Deadline),
          toText(job.created),
          toText(job.receive_type),
          toText(job.external_link),
          toSafeJson(job.locations),
          toText(job.description),
          toText(job.company_desc),
          toSafeJson(job),
        ]
      );

      upserted += 1;
    }

    return NextResponse.json({
      success: true,
      fetched: jobs.length,
      upserted,
      sourceUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('sync-alumni-jobs failed:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
