import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
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

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

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

    const allTables = await listBaseTables(oldPool);

    // Always try to keep high-value tables fresh.
    const priorityTables = ['Student_Inquiry', 'awt_inquirydiscussion'];

    // Persist a cursor so each run continues from the next table.
    // Without this, short time budgets can repeatedly process only the first N tables.
    const cursorStateName = 'cursor:sync-all:table-index';
    let startIndex = 0;
    try {
      const cursorRaw = await getLastPk(newPool, cursorStateName);
      if (cursorRaw != null) {
        const parsed = parseInt(String(cursorRaw), 10);
        if (Number.isFinite(parsed) && parsed >= 0) startIndex = parsed;
      }
    } catch {
      // ignore cursor state errors
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
        const primaryKey = await getPrimaryKey(oldPool, table);
        if (primaryKey.length === 0) {
          tableResults.push({ table, skipped: 'no primary key' });
          return;
        }

        const columns = await getColumns(oldPool, table);
        if (columns.length === 0) {
          tableResults.push({ table, skipped: 'no columns' });
          return;
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

        while (nowMs() - startedAt < maxRunMs && nowMs() - tableStart < perTableLimitMs) {
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

          const values = rows.map((r) => columns.map((c) => r[c]));
          await newPool.query(upsertSql, [values]);

          const lastRow = rows[rows.length - 1] as unknown as Record<string, unknown>;
          lastPk = extractPkValues(lastRow, primaryKey);
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
          durationMs: nowMs() - tableStart,
        });
        processedTables += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        tableResults.push({ table, error: message, durationMs: nowMs() - tableStart });
      }
    };

    // Run priority tables first with a small per-table budget.
    for (const t of priorityTables) {
      if (nowMs() - startedAt >= maxRunMs) break;
      if (allTables.includes(t)) {
        await syncOneTable(t, Math.min(perTableMaxMs, 3_000));
      }
    }

    let visitedTables = 0;
    let nextIndex = startIndex;
    for (let i = 0; i < allTables.length; i++) {
      if (nowMs() - startedAt >= maxRunMs) break;

      const idx = (startIndex + i) % allTables.length;
      const table = allTables[idx];

      // Avoid re-processing priority tables in the same run.
      if (priorityTables.includes(table)) {
        continue;
      }
      visitedTables += 1;
      nextIndex = (idx + 1) % allTables.length;

      // Update cursor early so even if we time out mid-run, we don't get stuck.
      try {
        await setLastPk(newPool, cursorStateName, String(nextIndex));
      } catch {
        // ignore cursor write errors
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
      durationMs: nowMs() - startedAt,
      results: tableResults,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('sync-all failed:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
