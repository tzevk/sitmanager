import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/lib/db';
import { getOldPool } from '@/lib/old-db';
import {
  buildOrderBy,
  buildUpsertSql,
  getColumns,
  getPrimaryKey,
  isSafeIdentifier,
  listBaseTables,
} from '@/lib/mysql-sync';

export const runtime = 'nodejs';

const TABLES_TO_SYNC = [
  {
    target: 'batch_mst',
    sourceCandidates: ['batch_mst', 'Batch_Mst'],
  },
  {
    target: 'mst_batchcategory',
    sourceCandidates: ['mst_batchcategory', 'MST_BatchCategory'],
  },
  {
    target: 'batch_slecture_master',
    sourceCandidates: ['batch_slecture_master', 'Batch_SLecture_Master'],
  },
  {
    target: 'batch_lecture_master',
    sourceCandidates: ['batch_lecture_master', 'Batch_Lecture_Master'],
  },
] as const;

const DEFAULT_BATCH_SIZE = 500;
const DEFAULT_MAX_RUN_MS = 25_000;

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

function resolveSourceTableName(availableTables: string[], candidates: readonly string[]): string | null {
  for (const name of candidates) {
    const exact = availableTables.find((t) => t === name);
    if (exact) return exact;
  }
  for (const name of candidates) {
    const ci = availableTables.find((t) => t.toLowerCase() === name.toLowerCase());
    if (ci) return ci;
  }
  return null;
}

async function syncSnapshotTable(opts: {
  sourceTable: string;
  targetTable: string;
  oldPool: ReturnType<typeof getOldPool>;
  newPool: ReturnType<typeof getPool>;
  batchSize: number;
  startedAt: number;
  maxRunMs: number;
}) {
  const { sourceTable, targetTable, oldPool, newPool, batchSize, startedAt, maxRunMs } = opts;

  const columns = await getColumns(oldPool, sourceTable);
  if (columns.length === 0) {
    return { table: targetTable, sourceTable, processedRows: 0, batches: 0, done: true, skipped: 'no columns' };
  }

  let keyColumns = await getPrimaryKey(oldPool, sourceTable);
  if (keyColumns.length === 0) {
    if (columns.includes('Batch_Id')) keyColumns = ['Batch_Id'];
    else if (columns.includes('id')) keyColumns = ['id'];
  }
  if (keyColumns.length === 0) {
    return { table: targetTable, sourceTable, processedRows: 0, batches: 0, done: true, skipped: 'no key column' };
  }

  const upsertSql = buildUpsertSql(targetTable, columns);
  const orderBy = buildOrderBy(keyColumns);

  let lastPk = keyColumns.map(() => 0 as unknown);
  let processedRows = 0;
  let batches = 0;
  let done = false;

  while (Date.now() - startedAt < maxRunMs) {
    const where = `WHERE (${keyColumns.map((k) => `\`${k}\``).join(', ')}) > (${keyColumns.map(() => '?').join(', ')})`;

    type AnyRow = RowDataPacket & Record<string, unknown>;
    const [rows] = await oldPool.query<AnyRow[]>(
      `SELECT ${columns.map((c) => `\`${c}\``).join(', ')}
       FROM \`${sourceTable}\`
       ${where}
       ${orderBy}
       LIMIT ?`,
      [...lastPk, batchSize]
    );

    if (!rows.length) {
      done = true;
      break;
    }

    const values = rows.map((r: AnyRow) => columns.map((c) => r[c]));
    await newPool.query(upsertSql, [values]);

    const lastRow = rows[rows.length - 1] as unknown as Record<string, unknown>;
    lastPk = keyColumns.map((k) => lastRow[k]);
    processedRows += rows.length;
    batches += 1;
  }

  return {
    table: targetTable,
    sourceTable,
    processedRows,
    batches,
    lastPk,
    done,
  };
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const startedAt = nowMs();
    const maxRunMs = envInt('SYNC_MAX_RUN_MS', DEFAULT_MAX_RUN_MS);
    const batchSize = envInt('SYNC_BATCH_SIZE', DEFAULT_BATCH_SIZE);

    const oldPool = getOldPool();
    const newPool = getPool();

    const availableOldTables = await listBaseTables(oldPool);
    const results: Array<{
      table: string;
      sourceTable?: string;
      processedRows: number;
      batches: number;
      done: boolean;
      skipped?: string;
      lastPk?: unknown[];
    }> = [];

    for (const tableCfg of TABLES_TO_SYNC) {
      if (!isSafeIdentifier(tableCfg.target)) {
        results.push({ table: tableCfg.target, processedRows: 0, batches: 0, done: true, skipped: 'unsafe table name' });
        continue;
      }

      const sourceTable = resolveSourceTableName(availableOldTables, tableCfg.sourceCandidates);
      if (!sourceTable) {
        results.push({ table: tableCfg.target, processedRows: 0, batches: 0, done: true, skipped: 'source table not found' });
        continue;
      }

      const result = await syncSnapshotTable({
        sourceTable,
        targetTable: tableCfg.target,
        oldPool,
        newPool,
        batchSize,
        startedAt,
        maxRunMs,
      });
      results.push(result);

      if (nowMs() - startedAt >= maxRunMs) {
        break;
      }
    }

    const processedRows = results.reduce((sum, r) => sum + r.processedRows, 0);
    const batches = results.reduce((sum, r) => sum + r.batches, 0);
    const done = results.every((r) => r.done);

    return NextResponse.json({
      success: true,
      mode: 'sync-batch',
      processedRows,
      batches,
      done,
      results,
      durationMs: nowMs() - startedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('sync-batch failed:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
