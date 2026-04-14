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
  setLastPk,
} from '@/lib/mysql-sync';

export const runtime = 'nodejs';

const TARGET_TABLE = 'consultant_mst';
const SOURCE_CANDIDATES = ['consultant_mst', 'Consultant_Mst', 'CONSULTANT_MST'];
const SYNC_NAME = 'consultancy-master';
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

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSafeIdentifier(TARGET_TABLE)) {
      return NextResponse.json({ success: false, error: 'Unsafe table name configured' }, { status: 400 });
    }

    const startedAt = Date.now();
    const maxRunMs = envInt('SYNC_MAX_RUN_MS', DEFAULT_MAX_RUN_MS);
    const batchSize = envInt('SYNC_BATCH_SIZE', DEFAULT_BATCH_SIZE);

    const oldPool = getOldPool();
    const newPool = getPool();
    await ensureSyncStateTable(newPool);

    const availableOldTables = await listBaseTables(oldPool);
    const sourceTable = resolveSourceTableName(availableOldTables, SOURCE_CANDIDATES);
    if (!sourceTable) {
      return NextResponse.json({
        success: false,
        mode: 'sync-consultancy',
        error: 'Source consultancy table not found in old DB',
      }, { status: 404 });
    }

    let keyColumns = await getPrimaryKey(oldPool, sourceTable);
    if (keyColumns.length === 0) {
      const sourceColumnsProbe = await getColumns(oldPool, sourceTable);
      if (sourceColumnsProbe.includes('Const_Id')) keyColumns = ['Const_Id'];
      else if (sourceColumnsProbe.includes('const_id')) keyColumns = ['const_id'];
      else if (sourceColumnsProbe.includes('id')) keyColumns = ['id'];
    }
    if (keyColumns.length === 0) {
      return NextResponse.json({
        success: false,
        mode: 'sync-consultancy',
        error: 'No primary key/key column found for consultancy source table',
      }, { status: 400 });
    }

    const sourceColumns = await getColumns(oldPool, sourceTable);
    const targetColumns = await getColumns(newPool, TARGET_TABLE);
    const targetSet = new Set(targetColumns);
    const syncColumns = sourceColumns.filter((c) => targetSet.has(c));

    if (syncColumns.length === 0) {
      return NextResponse.json({
        success: false,
        mode: 'sync-consultancy',
        error: 'No common columns between old and new consultancy tables',
      }, { status: 400 });
    }

    for (const keyCol of keyColumns) {
      if (!syncColumns.includes(keyCol)) {
        return NextResponse.json({
          success: false,
          mode: 'sync-consultancy',
          error: `Key column ${keyCol} missing in sync column set`,
        }, { status: 400 });
      }
    }

    const stateName = `table:${SYNC_NAME}`;
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

    const upsertSql = buildUpsertSql(TARGET_TABLE, syncColumns);
    let processedRows = 0;
    let batches = 0;
    let done = false;

    while (Date.now() - startedAt < maxRunMs) {
      const { where, params } = buildPkWhereAfter(keyColumns, lastPk);
      const orderBy = buildOrderBy(keyColumns);

      type AnyRow = RowDataPacket & Record<string, unknown>;
      const [rows] = await oldPool.query<AnyRow[]>(
        `SELECT ${syncColumns.map((c) => `\`${c}\``).join(', ')}
         FROM \`${sourceTable}\`
         ${where}
         ${orderBy}
         LIMIT ?`,
        [...params, batchSize]
      );

      if (!rows.length) {
        done = true;
        break;
      }

      const values = rows.map((r) => syncColumns.map((c) => r[c]));
      await newPool.query(upsertSql, [values]);

      const lastRow = rows[rows.length - 1] as unknown as Record<string, unknown>;
      lastPk = extractPkValues(lastRow, keyColumns);
      await setLastPk(newPool, stateName, JSON.stringify(lastPk));

      processedRows += rows.length;
      batches += 1;
    }

    return NextResponse.json({
      success: true,
      mode: 'sync-consultancy',
      sourceTable,
      targetTable: TARGET_TABLE,
      processedRows,
      batches,
      lastPk,
      done,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('sync-consultancy failed:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
