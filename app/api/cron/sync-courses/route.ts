import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/lib/db';
import { getOldPool } from '@/lib/old-db';

export const runtime = 'nodejs';

const COURSE_TABLE = 'course_mst';
const SYNC_NAME = 'courses';
const BATCH_SIZE = 500;
const MAX_RUN_MS = 25_000;

const COURSE_COLUMNS = [
  'Course_Id',
  'Course_Name',
  'Course_Code',
  'FileName1',
  'FileName2',
  'FileName3',
  'FileName4',
  'FileName5',
  'FileName6',
  'FileName7',
  'FileName8',
  'FileName9',
  'FileName10',
  'Course_syllabus',
  'course_Preparation',
  'Date_Added',
  'Assignment',
  'Basic_Subject',
  'Detailed_Study_Of',
  'Discipline_1',
  'Discipline_2',
  'Discipline_3',
  'Discipline_4',
  'Document_Study',
  'Eligibility',
  'ImageName',
  'Introduction',
  'IsActive',
  'IsDelete',
  'Link',
  'Objective',
  'Publish',
  'Qualification_1',
  'Qualification_2',
  'Qualification_3',
  'Qualification_4',
  'Scope_Of',
  'Course_Description',
] as const;

function isAuthorized(request: Request): boolean {
  // Vercel Cron adds this header.
  const vercelCron = request.headers.get('x-vercel-cron');
  if (vercelCron) return true;

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth && auth.trim() === `Bearer ${secret}`) return true;
    return request.headers.get('x-cron-secret') === secret;
  }

  // Allow local testing if no secret configured.
  return process.env.NODE_ENV !== 'production';
}

async function ensureSyncStateTable(): Promise<void> {
  const newPool = getPool();
  await newPool.query(
    `CREATE TABLE IF NOT EXISTS sync_state (
      name VARCHAR(128) NOT NULL,
      last_id BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
}

async function getLastId(): Promise<number> {
  const newPool = getPool();
  type SyncRow = RowDataPacket & { last_id: number };
  const [rows] = await newPool.query<SyncRow[]>(
    'SELECT last_id FROM sync_state WHERE name = ? LIMIT 1',
    [SYNC_NAME]
  );
  return rows[0]?.last_id ?? 0;
}

async function setLastId(lastId: number): Promise<void> {
  const newPool = getPool();
  await newPool.query(
    `INSERT INTO sync_state (name, last_id) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE last_id = VALUES(last_id)`,
    [SYNC_NAME, lastId]
  );
}

type CourseRow = RowDataPacket & Record<(typeof COURSE_COLUMNS)[number], unknown>;

function buildUpsertSql(): string {
  const cols = COURSE_COLUMNS.join(', ');
  const updateCols = COURSE_COLUMNS.filter((c) => c !== 'Course_Id')
    .map((c) => `${c}=VALUES(${c})`)
    .join(', ');
  return `INSERT INTO ${COURSE_TABLE} (${cols}) VALUES ? ON DUPLICATE KEY UPDATE ${updateCols}`;
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const startedAt = Date.now();
    await ensureSyncStateTable();

    const oldPool = getOldPool();
    const newPool = getPool();

    let lastId = await getLastId();
    let processed = 0;
    let batches = 0;
    let done = false;

    const upsertSql = buildUpsertSql();

    while (Date.now() - startedAt < MAX_RUN_MS) {
      const [rows] = await oldPool.query<CourseRow[]>(
        `SELECT ${COURSE_COLUMNS.join(', ')}
         FROM ${COURSE_TABLE}
         WHERE Course_Id > ?
         ORDER BY Course_Id ASC
         LIMIT ?`,
        [lastId, BATCH_SIZE]
      );

      if (!rows.length) {
        done = true;
        break;
      }

      const values = rows.map((r) => COURSE_COLUMNS.map((c) => r[c]));
      await newPool.query(upsertSql, [values]);

      batches += 1;
      processed += rows.length;
      lastId = Number(rows[rows.length - 1]?.Course_Id ?? lastId);
      await setLastId(lastId);
    }

    return NextResponse.json({
      success: true,
      sync: SYNC_NAME,
      processed,
      batches,
      lastId,
      done,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('sync-courses failed:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
