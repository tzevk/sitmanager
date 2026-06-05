/* eslint-disable @typescript-eslint/no-explicit-any */
import { getLegacyPool, getPool } from '@/lib/db';

export interface LegacyBatchSyncOptions {
  batchSize?: number;
  dryRun?: boolean;
}

export interface LegacyBatchSyncTableSummary {
  sourceTable: string;
  targetTable: string;
  fetched: number;
  upserted: number;
  skipped?: string;
}

export interface LegacyBatchSyncSummary {
  configured: boolean;
  dryRun: boolean;
  tables: LegacyBatchSyncTableSummary[];
  totalFetched: number;
  totalUpserted: number;
  errors: string[];
}

const TABLES = [
  {
    sourcePreferred: 'Batch_Mst',
    sourceLower: 'batch_mst',
    targetPreferred: 'batch_mst',
    targetLower: 'batch_mst',
  },
  {
    sourcePreferred: 'MST_BatchCategory',
    sourceLower: 'mst_batchcategory',
    targetPreferred: 'mst_batchcategory',
    targetLower: 'mst_batchcategory',
  },
];

async function resolveTableName(pool: any, lowerName: string, preferredName: string): Promise<string | null> {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = ?
     ORDER BY CASE WHEN TABLE_NAME = ? THEN 0 ELSE 1 END
     LIMIT 1`,
    [lowerName, preferredName]
  );

  return String((rows as any[])[0]?.TABLE_NAME || '').trim() || null;
}

async function getColumns(pool: any, table: string): Promise<string[]> {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME AS c, EXTRA AS extra
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [table]
  );

  return (rows as any[])
    .filter((r) => !String(r.extra ?? '').toLowerCase().includes('generated'))
    .map((r) => String(r.c));
}

async function getSharedColumns(oldPool: any, newPool: any, oldTable: string, newTable: string): Promise<string[]> {
  const [oldColumns, newColumns] = await Promise.all([
    getColumns(oldPool, oldTable),
    getColumns(newPool, newTable),
  ]);

  const targetCols = new Set(newColumns.map((c) => c.toLowerCase()));
  return oldColumns.filter((c) => targetCols.has(c.toLowerCase()));
}

function buildUpsertSql(table: string, columns: string): string {
  return `INSERT INTO \`${table}\` (${columns}) VALUES ? ON DUPLICATE KEY UPDATE ${columns
    .split(', ')
    .map((c) => `${c}=VALUES(${c})`)
    .join(', ')}`;
}

async function upsertRows(
  newPool: any,
  table: string,
  columns: string[],
  rows: any[],
  batchSize: number,
  dryRun: boolean
): Promise<number> {
  if (!rows.length) return 0;
  if (dryRun) return rows.length;

  const colSql = columns.map((c) => `\`${c}\``).join(', ');
  const sql = buildUpsertSql(table, colSql);
  let written = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const values = chunk.map((row) => columns.map((c) => row[c] ?? null));
    await newPool.query(sql, [values]);
    written += chunk.length;
  }

  return written;
}

export async function syncLegacyBatchData(options: LegacyBatchSyncOptions = {}): Promise<LegacyBatchSyncSummary> {
  const summary: LegacyBatchSyncSummary = {
    configured: false,
    dryRun: !!options.dryRun,
    tables: [],
    totalFetched: 0,
    totalUpserted: 0,
    errors: [],
  };

  const oldPool = getLegacyPool();
  if (!oldPool) return summary;

  summary.configured = true;
  const newPool = getPool();
  const batchSize = Math.max(1, Math.min(1000, options.batchSize ?? 500));

  try {
    for (const cfg of TABLES) {
      const sourceTable = await resolveTableName(oldPool, cfg.sourceLower, cfg.sourcePreferred);
      if (!sourceTable) {
        summary.tables.push({
          sourceTable: cfg.sourcePreferred,
          targetTable: cfg.targetPreferred,
          fetched: 0,
          upserted: 0,
          skipped: 'source table not found',
        });
        continue;
      }

      const targetTable = await resolveTableName(newPool, cfg.targetLower, cfg.targetPreferred);
      if (!targetTable) {
        throw new Error(`Target table not found: ${cfg.targetPreferred}`);
      }

      const sharedColumns = await getSharedColumns(oldPool, newPool, sourceTable, targetTable);
      if (!sharedColumns.length) {
        summary.tables.push({
          sourceTable,
          targetTable,
          fetched: 0,
          upserted: 0,
          skipped: 'no shared columns',
        });
        continue;
      }

      const colsSql = sharedColumns.map((c) => `\`${c}\``).join(', ');
      const [rowsRaw] = await oldPool.query(`SELECT ${colsSql} FROM \`${sourceTable}\``);
      const rows = rowsRaw as any[];

      const upserted = await upsertRows(newPool, targetTable, sharedColumns, rows, batchSize, !!options.dryRun);

      summary.tables.push({
        sourceTable,
        targetTable,
        fetched: rows.length,
        upserted,
      });
      summary.totalFetched += rows.length;
      summary.totalUpserted += upserted;
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    summary.errors.push(msg);
    console.error('[legacy-batch-sync] error:', msg);
  }

  return summary;
}
