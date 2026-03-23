import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import type mysql from 'mysql2/promise';
import { getPool } from '@/lib/db';
import { getOldPool } from '@/lib/old-db';
import {
  buildOrderBy,
  buildPkWhereAfter,
  buildUpsertSql,
  ensureSyncStateTable,
  extractPkValues,
  getColumns,
  getLastPk,
  getPrimaryKey,
  isSafeIdentifier,
  parseCsvEnv,
  setLastPk,
} from '@/lib/mysql-sync';

export const runtime = 'nodejs';

const DEFAULT_BATCH_SIZE = 500;
const DEFAULT_MAX_RUN_MS = 25_000;
const DEFAULT_PER_TABLE_MAX_MS = 10_000;

function isAuthorized(request: Request): boolean {
  const vercelCron = request.headers.get('x-vercel-cron');
  if (vercelCron) return true;

  const secret = process.env.CRON_SECRET;
  if (secret) {
    return request.headers.get('x-cron-secret') === secret;
  }

  return process.env.NODE_ENV !== 'production';
}

function nowMs() {
  return Date.now();
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function syncTable(opts: {
  oldPool: mysql.Pool;
  newPool: mysql.Pool;
  table: string;
  startedAt: number;
  maxRunMs: number;
  perTableMaxMs: number;
  batchSize: number;
  excludeTables: Set<string>;
}): Promise<{
  table: string;
  skipped?: string;
  processedRows?: number;
  batches?: number;
  lastPk?: unknown[];
  done?: boolean;
  durationMs?: number;
  error?: string;
}> {
  const { oldPool, newPool, table, startedAt, maxRunMs, perTableMaxMs, batchSize, excludeTables } = opts;

  if (excludeTables.has(table.toLowerCase())) {
    return { table, skipped: 'excluded' };
  }
  if (!isSafeIdentifier(table)) {
    return { table, skipped: 'unsafe table name' };
  }

  const tableStart = nowMs();

  try {
    const primaryKey = await getPrimaryKey(oldPool, table);
    if (primaryKey.length === 0) {
      return { table, skipped: 'no primary key' };
    }

    const columns = await getColumns(oldPool, table);
    if (columns.length === 0) {
      return { table, skipped: 'no columns' };
    }

    const stateName = `table:${table}`;
    const lastPkJson = await getLastPk(newPool, stateName);
    let lastPk: unknown[] = primaryKey.map(() => 0);
    if (lastPkJson) {
      try {
        const parsed = JSON.parse(lastPkJson);
        if (Array.isArray(parsed) && parsed.length === primaryKey.length) {
          lastPk = parsed;
        }
      } catch {
        // ignore corrupt state
      }
    }

    let processedRows = 0;
    let batches = 0;
    let done = false;

    const upsertSql = buildUpsertSql(table, columns);

    while (nowMs() - startedAt < maxRunMs && nowMs() - tableStart < perTableMaxMs) {
      const { where, params } = buildPkWhereAfter(primaryKey, lastPk);
      const orderBy = buildOrderBy(primaryKey);

      type AnyRow = RowDataPacket & Record<string, unknown>;
      const [rows] = await oldPool.query<AnyRow[]>(
        `SELECT ${columns.map((c) => `\`${c}\``).join(', ')}
         FROM \`${table}\`
         ${where}
         ${orderBy}
         LIMIT ?`,
        [...params, batchSize]
      );

      if (!rows.length) {
        done = true;
        break;
      }

      const values = rows.map((r: AnyRow) => columns.map((c) => r[c]));
      await newPool.query(upsertSql, [values]);

      const lastRow = rows[rows.length - 1] as unknown as Record<string, unknown>;
      lastPk = extractPkValues(lastRow, primaryKey);
      await setLastPk(newPool, stateName, JSON.stringify(lastPk));

      processedRows += rows.length;
      batches += 1;
    }

    return {
      table,
      processedRows,
      batches,
      lastPk,
      done,
      durationMs: nowMs() - tableStart,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { table, error: message, durationMs: nowMs() - tableStart };
  }
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const mode = (url.searchParams.get('mode') || '').toLowerCase();
    const latestLimitRaw = url.searchParams.get('limit') || '';
    const latestLimitParsed = latestLimitRaw ? parseInt(latestLimitRaw, 10) : NaN;
    const latestLimit = Number.isFinite(latestLimitParsed)
      ? Math.min(100, Math.max(1, latestLimitParsed))
      : 10;

    const startedAt = nowMs();
    const maxRunMs = envInt('SYNC_MAX_RUN_MS', DEFAULT_MAX_RUN_MS);
    const perTableMaxMs = envInt('SYNC_PER_TABLE_MAX_MS', DEFAULT_PER_TABLE_MAX_MS);
    const batchSize = envInt('SYNC_BATCH_SIZE', DEFAULT_BATCH_SIZE);

    const excludeTables = new Set(
      parseCsvEnv(process.env.SYNC_EXCLUDE_TABLES).map((t) => t.toLowerCase())
    );
    excludeTables.add('sync_state');

    const oldPool = getOldPool();
    const newPool = getPool();
    await ensureSyncStateTable(newPool);

    // Keep inquiry listing fresh.
    const targetTables = ['Student_Inquiry', 'awt_inquirydiscussion'];

    // Fast path: upsert only the newest N inquiries + their discussions.
    // This is useful when you only need the latest rows (e.g., today's inquiries)
    // without running a full backfill.
    if (mode === 'latest') {
      const startedAtFast = startedAt;
      type LatestResult = {
        table: string;
        mode: 'latest';
        limit?: number;
        inquiryIds?: number[];
        processedRows: number;
        durationMs: number;
      };
      const results: LatestResult[] = [];

      const inquiryTable = 'Student_Inquiry';
      const discussionTable = 'awt_inquirydiscussion';

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

      // 1) Upsert latest inquiries
      {
        const tableStart = nowMs();
        const table = inquiryTable;
        if (!excludeTables.has(table.toLowerCase()) && isSafeIdentifier(table)) {
          const columns = await getColumns(oldPool, table);
          const upsertSql = buildUpsertSql(table, columns);

          type AnyRow = RowDataPacket & Record<string, unknown>;
          const [rows] = await oldPool.query<AnyRow[]>(
            `SELECT ${columns.map((c) => `\`${c}\``).join(', ')}
             FROM \`${table}\`
             WHERE (IsDelete = 0 OR IsDelete IS NULL)
             ORDER BY ${inquiryDtAsDateOld} DESC, Inquiry_Id DESC
             LIMIT ?`,
            [latestLimit]
          );

          if (rows.length) {
            const values = rows.map((r: AnyRow) => columns.map((c) => r[c]));
            await newPool.query(upsertSql, [values]);
          }

          const inquiryIds = (rows as AnyRow[])
            .map((r) => Number(r['Inquiry_Id']))
            .filter((n) => Number.isFinite(n));

          results.push({
            table,
            mode: 'latest',
            limit: latestLimit,
            processedRows: rows.length,
            inquiryIds,
            durationMs: nowMs() - tableStart,
          });

          // 2) Upsert discussions only for these inquiry ids
          if (inquiryIds.length && !excludeTables.has(discussionTable.toLowerCase()) && isSafeIdentifier(discussionTable)) {
            const discStart = nowMs();
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
              mode: 'latest',
              inquiryIds,
              processedRows: discRows.length,
              durationMs: nowMs() - discStart,
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        mode: 'sync-inquiry-latest',
        limit: latestLimit,
        durationMs: nowMs() - startedAtFast,
        results,
      });
    }

    const results = [] as Array<Awaited<ReturnType<typeof syncTable>>>;
    for (const table of targetTables) {
      if (nowMs() - startedAt >= maxRunMs) break;
      results.push(
        await syncTable({
          oldPool,
          newPool,
          table,
          startedAt,
          maxRunMs,
          perTableMaxMs,
          batchSize,
          excludeTables,
        })
      );
    }

    return NextResponse.json({
      success: true,
      mode: 'sync-inquiry',
      durationMs: nowMs() - startedAt,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('sync-inquiry failed:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
