import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/lib/db';
import { getOldPool } from '@/lib/old-db';
import {
  buildUpsertSql,
  ensureSyncStateTable,
  getColumns,
  isSafeIdentifier,
  parseCsvEnv,
} from '@/lib/mysql-sync';

export const runtime = 'nodejs';

const LATEST_LIMIT = 10;

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

function nowMs() {
  return Date.now();
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const startedAt = nowMs();

    const excludeTables = new Set(
      parseCsvEnv(process.env.SYNC_EXCLUDE_TABLES).map((t) => t.toLowerCase())
    );
    excludeTables.add('sync_state');

    const oldPool = getOldPool();
    const newPool = getPool();
    await ensureSyncStateTable(newPool);

    const inquiryTable = 'Student_Inquiry';
    const discussionTable = 'awt_inquirydiscussion';

    if (!isSafeIdentifier(inquiryTable) || !isSafeIdentifier(discussionTable)) {
      return NextResponse.json({ success: false, error: 'Unsafe table name' }, { status: 400 });
    }

    // Sort expression for Inquiry_Dt (stored as VARCHAR in some DBs)
    const inquiryDtAsDateOld =
      `COALESCE(`
      + `STR_TO_DATE(SUBSTRING(Inquiry_Dt, 1, 19), '%Y-%m-%d %H:%i:%s'),`
      + `STR_TO_DATE(SUBSTRING(Inquiry_Dt, 1, 10), '%Y-%m-%d'),`
      + `STR_TO_DATE(SUBSTRING(Inquiry_Dt, 1, 10), '%d-%m-%Y'),`
      + `STR_TO_DATE(SUBSTRING(Inquiry_Dt, 1, 10), '%d/%m/%Y'),`
      + `STR_TO_DATE(SUBSTRING(Inquiry_Dt, 1, 10), '%d.%m.%Y'),`
      + `STR_TO_DATE(SUBSTRING(Inquiry_Dt, 1, 10), '%Y/%m/%d'),`
      + `DATE('1970-01-01')`
      + `)`;

    const results: Array<{
      table: string;
      processedRows: number;
      inquiryIds?: number[];
      durationMs: number;
    }> = [];

    // 1) Upsert latest inquiries
    const inquiryStart = nowMs();
    let inquiryIds: number[] = [];
    if (!excludeTables.has(inquiryTable.toLowerCase())) {
      const columns = await getColumns(oldPool, inquiryTable);
      const upsertSql = buildUpsertSql(inquiryTable, columns);

      type AnyRow = RowDataPacket & Record<string, unknown>;
      const [rows] = await oldPool.query<AnyRow[]>(
        `SELECT ${columns.map((c) => `\`${c}\``).join(', ')}
         FROM \`${inquiryTable}\`
         WHERE (IsDelete = 0 OR IsDelete IS NULL)
         ORDER BY ${inquiryDtAsDateOld} DESC, Inquiry_Id DESC
         LIMIT ?`,
        [LATEST_LIMIT]
      );

      if (rows.length) {
        const values = rows.map((r: AnyRow) => columns.map((c) => r[c]));
        await newPool.query(upsertSql, [values]);
      }

      inquiryIds = (rows as AnyRow[])
        .map((r) => Number(r['Inquiry_Id']))
        .filter((n) => Number.isFinite(n));

      results.push({
        table: inquiryTable,
        processedRows: rows.length,
        inquiryIds,
        durationMs: nowMs() - inquiryStart,
      });
    } else {
      results.push({ table: inquiryTable, processedRows: 0, durationMs: nowMs() - inquiryStart });
    }

    // 2) Upsert discussions for those inquiry ids
    const discStart = nowMs();
    if (inquiryIds.length && !excludeTables.has(discussionTable.toLowerCase())) {
      const discColumns = await getColumns(oldPool, discussionTable);
      const discUpsertSql = buildUpsertSql(discussionTable, discColumns);

      const placeholders = inquiryIds.map(() => '?').join(',');
      type DiscRow = RowDataPacket & Record<string, unknown>;
      const [discRows] = await oldPool.query<DiscRow[]>(
        `SELECT ${discColumns.map((c) => `\`${c}\``).join(', ')}
         FROM \`${discussionTable}\`
         WHERE deleted = 0 AND Inquiry_id IN (${placeholders})`,
        inquiryIds
      );

      if (discRows.length) {
        const discValues = discRows.map((r: DiscRow) => discColumns.map((c) => r[c]));
        await newPool.query(discUpsertSql, [discValues]);
      }

      results.push({
        table: discussionTable,
        processedRows: discRows.length,
        inquiryIds,
        durationMs: nowMs() - discStart,
      });
    } else {
      results.push({ table: discussionTable, processedRows: 0, durationMs: nowMs() - discStart });
    }

    return NextResponse.json({
      success: true,
      mode: 'sync-inquiry-latest',
      limit: LATEST_LIMIT,
      durationMs: nowMs() - startedAt,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('sync-inquiry-latest failed:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
