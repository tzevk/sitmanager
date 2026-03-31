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
  listBaseTables,
  parseCsvEnv,
  setLastPk,
} from '@/lib/mysql-sync';

export const runtime = 'nodejs';

const DEFAULT_BATCH_SIZE = 500;
const DEFAULT_MAX_RUN_MS = 25_000;
const DEFAULT_PER_TABLE_MAX_MS = 8_000;

type TargetColumnMeta = {
  dataType: string;
  charMaxLen: number | null;
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

function nowMs() {
  return Date.now();
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function getTargetColumnMeta(
  newPool: mysql.Pool,
  table: string,
  columns: string[]
): Promise<Map<string, TargetColumnMeta>> {
  if (!columns.length) return new Map();

  type MetaRow = RowDataPacket & {
    column_name: string;
    data_type: string;
    char_max_len: number | null;
  };

  const [rows] = await newPool.query<MetaRow[]>(
    `SELECT COLUMN_NAME AS column_name,
            DATA_TYPE AS data_type,
            CHARACTER_MAXIMUM_LENGTH AS char_max_len
     FROM information_schema.columns
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME IN (${columns.map(() => '?').join(',')})`,
    [table, ...columns]
  );

  const meta = new Map<string, TargetColumnMeta>();
  for (const row of rows) {
    meta.set(row.column_name, {
      dataType: String(row.data_type || '').toLowerCase(),
      charMaxLen: row.char_max_len == null ? null : Number(row.char_max_len),
    });
  }

  return meta;
}

function normalizeForTarget(value: unknown, meta?: TargetColumnMeta): unknown {
  if (value == null || typeof value !== 'string' || !meta) return value;

  if (meta.dataType === 'date') return value.length > 10 ? value.slice(0, 10) : value;
  if (meta.dataType === 'datetime' || meta.dataType === 'timestamp') {
    return value.length > 19 ? value.slice(0, 19) : value;
  }
  if (meta.dataType === 'time') return value.length > 8 ? value.slice(0, 8) : value;
  if (meta.charMaxLen && meta.charMaxLen > 0 && value.length > meta.charMaxLen) {
    return value.slice(0, meta.charMaxLen);
  }

  return value;
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const tableFilter = (url.searchParams.get('table') || '').trim();

    const queryInt = (name: string): number | null => {
      const raw = url.searchParams.get(name);
      if (!raw) return null;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const startedAt = nowMs();
    const maxRunMs = queryInt('maxRunMs') ?? envInt('SYNC_MAX_RUN_MS', DEFAULT_MAX_RUN_MS);
    const perTableMaxMs = queryInt('perTableMaxMs') ?? envInt('SYNC_PER_TABLE_MAX_MS', DEFAULT_PER_TABLE_MAX_MS);
    const batchSize = queryInt('batchSize') ?? envInt('SYNC_BATCH_SIZE', DEFAULT_BATCH_SIZE);

    const excludeTables = new Set(
      parseCsvEnv(process.env.SYNC_EXCLUDE_TABLES).map((t) => t.toLowerCase())
    );
    excludeTables.add('sync_state');

    const oldPool = getOldPool();
    const newPool = getPool();
    await ensureSyncStateTable(newPool);

    const allTablesRaw = await listBaseTables(oldPool);
    const allTables = tableFilter
      ? allTablesRaw.filter((t) => t.toLowerCase() === tableFilter.toLowerCase())
      : allTablesRaw;

    // Always try to keep high-value tables fresh.
    const priorityTables = ['Student_Inquiry', 'awt_inquirydiscussion', 'batch_mst', 'Batch_Mst'];

    const cursorStateName = 'cursor:sync-all:table-index';
    let startIndex = 0;
    if (!tableFilter) {
      try {
        const cursorRaw = await getLastPk(newPool, cursorStateName);
        if (cursorRaw != null) {
          const parsed = parseInt(String(cursorRaw), 10);
          if (Number.isFinite(parsed) && parsed >= 0) startIndex = parsed;
        }
      } catch {
        // ignore cursor state errors
      }
    }
    if (allTables.length > 0) startIndex = startIndex % allTables.length;

    let processedTables = 0;
    const tableResults: Array<{
      table: string;
      skipped?: string;
      processedRows?: number;
      batches?: number;
      lastPk?: unknown[];
      done?: boolean;
      durationMs?: number;
      error?: string;
      mode?: 'incremental' | 'snapshot';
    }> = [];

    const syncOneTable = async (table: string, perTableLimitMs: number) => {
      if (excludeTables.has(table.toLowerCase())) {
        tableResults.push({ table, skipped: 'excluded' });
        return;
      }
      if (!isSafeIdentifier(table)) {
        tableResults.push({ table, skipped: 'unsafe table name' });
        return;
      }

      const tableStart = nowMs();
      try {
        const columns = await getColumns(oldPool, table);
        if (columns.length === 0) {
          tableResults.push({ table, skipped: 'no columns' });
          return;
        }

        const targetMeta = await getTargetColumnMeta(newPool, table, columns);

        let keyColumns = await getPrimaryKey(oldPool, table);
        if (keyColumns.length === 0 && table.toLowerCase() === 'batch_mst' && columns.includes('Batch_Id')) {
          keyColumns = ['Batch_Id'];
        }

        // No PK: sync via full snapshot replacement in a transaction.
        if (keyColumns.length === 0) {
          const conn = await newPool.getConnection();
          let processedRows = 0;
          let batches = 0;
          let done = false;
          const snapshotPerTableLimitMs = ['s_batch_lec', 'student_report'].includes(table.toLowerCase())
            ? Math.max(perTableLimitMs, 20_000)
            : perTableLimitMs;

          try {
            await conn.beginTransaction();
            await conn.query(`DELETE FROM \`${table}\``);

            let offset = 0;
            while (nowMs() - startedAt < maxRunMs && nowMs() - tableStart < snapshotPerTableLimitMs) {
              type AnyRow = RowDataPacket & Record<string, unknown>;
              const [rows] = await oldPool.query<AnyRow[]>(
                `SELECT ${columns.map((c) => `\`${c}\``).join(', ')}
                 FROM \`${table}\`
                 LIMIT ? OFFSET ?`,
                [batchSize, offset]
              );

              if (!rows.length) {
                done = true;
                break;
              }

              const values = rows.map((r) => columns.map((c) => normalizeForTarget(r[c], targetMeta.get(c))));
              await conn.query(
                `INSERT INTO \`${table}\` (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES ?`,
                [values]
              );

              processedRows += rows.length;
              batches += 1;
              offset += rows.length;
            }

            if (!done) {
              await conn.rollback();
              tableResults.push({
                table,
                skipped: 'snapshot incomplete (time budget exceeded)',
                mode: 'snapshot',
                durationMs: nowMs() - tableStart,
              });
              return;
            }

            await conn.commit();
            tableResults.push({
              table,
              processedRows,
              batches,
              done,
              mode: 'snapshot',
              durationMs: nowMs() - tableStart,
            });
            processedTables += 1;
            return;
          } catch (snapshotErr) {
            await conn.rollback();
            throw snapshotErr;
          } finally {
            conn.release();
          }
        }

        const stateName = `table:${table}`;
        const lastPkJson = await getLastPk(newPool, stateName);
        let lastPk: unknown[] = keyColumns.map(() => 0);
        if (lastPkJson) {
          try {
            const parsed = JSON.parse(lastPkJson);
            if (Array.isArray(parsed) && parsed.length === keyColumns.length) {
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

        while (nowMs() - startedAt < maxRunMs && nowMs() - tableStart < perTableLimitMs) {
          const { where, params } = buildPkWhereAfter(keyColumns, lastPk);
          const orderBy = buildOrderBy(keyColumns);

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

          const values = rows.map((r) => columns.map((c) => normalizeForTarget(r[c], targetMeta.get(c))));
          await newPool.query(upsertSql, [values]);

          const lastRow = rows[rows.length - 1] as unknown as Record<string, unknown>;
          lastPk = extractPkValues(lastRow, keyColumns);
          await setLastPk(newPool, stateName, JSON.stringify(lastPk));

          processedRows += rows.length;
          batches += 1;
        }

        tableResults.push({
          table,
          processedRows,
          batches,
          lastPk,
          done,
          mode: 'incremental',
          durationMs: nowMs() - tableStart,
        });
        processedTables += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        tableResults.push({ table, error: message, durationMs: nowMs() - tableStart });
      }
    };

    if (!tableFilter) {
      for (const t of priorityTables) {
        if (nowMs() - startedAt >= maxRunMs) break;
        if (allTables.includes(t)) {
          await syncOneTable(t, Math.min(perTableMaxMs, 3_000));
        }
      }
    }

    let visitedTables = 0;
    let nextIndex = startIndex;
    for (let i = 0; i < allTables.length; i++) {
      if (nowMs() - startedAt >= maxRunMs) break;

      const idx = (startIndex + i) % allTables.length;
      const table = allTables[idx];

      if (!tableFilter && priorityTables.includes(table)) {
        continue;
      }

      visitedTables += 1;
      nextIndex = (idx + 1) % allTables.length;

      if (!tableFilter) {
        try {
          await setLastPk(newPool, cursorStateName, String(nextIndex));
        } catch {
          // ignore cursor write errors
        }
      }

      await syncOneTable(table, perTableMaxMs);
    }

    return NextResponse.json({
      success: true,
      mode: 'sync-all',
      processedTables,
      totalTables: allTables.length,
      cursor: {
        startIndex,
        nextIndex,
        visitedTables,
      },
      tableFilter: tableFilter || null,
      maxRunMs,
      perTableMaxMs,
      batchSize,
      durationMs: nowMs() - startedAt,
      results: tableResults,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('sync-all failed:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
