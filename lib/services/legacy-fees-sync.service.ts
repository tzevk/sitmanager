/* eslint-disable @typescript-eslint/no-explicit-any */
import { getLegacyPool, getPool } from '@/lib/db';

export interface LegacyFeesSyncOptions {
  batchSize?: number;
  dryRun?: boolean;
}

export interface LegacyFeesSyncSummary {
  configured: boolean;
  dryRun: boolean;
  sourceTable: string | null;
  targetTable: string | null;
  currentMaxFeesId: number;
  fetched: number;
  inserted: number;
  errors: string[];
}

const SOURCE_LOWER = 's_fees_mst';
const SOURCE_PREFERRED = 'S_Fees_Mst';
const TARGET_LOWER = 's_fees_mst';
const TARGET_PREFERRED = 's_fees_mst';

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

async function insertRows(
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
  const sql = `INSERT IGNORE INTO \`${table}\` (${colSql}) VALUES ?`;
  let written = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const values = chunk.map((row) => columns.map((c) => row[c] ?? null));
    const [result] = await newPool.query(sql, [values]);
    written += (result as any)?.affectedRows ?? chunk.length;
  }

  return written;
}

/**
 * Inserts only fee records whose Fees_Id is greater than the current
 * max Fees_Id in the new DB. Old/new admission_master rows are known to
 * have colliding IDs for different students, so an upsert-by-PK across
 * the full table range is unsafe. New legacy fee records always get
 * higher Fees_Ids, so this insert-only/high-watermark approach avoids
 * touching any existing row.
 */
export async function syncLegacyFeesData(options: LegacyFeesSyncOptions = {}): Promise<LegacyFeesSyncSummary> {
  const summary: LegacyFeesSyncSummary = {
    configured: false,
    dryRun: !!options.dryRun,
    sourceTable: null,
    targetTable: null,
    currentMaxFeesId: 0,
    fetched: 0,
    inserted: 0,
    errors: [],
  };

  const oldPool = getLegacyPool();
  if (!oldPool) return summary;

  summary.configured = true;
  const newPool = getPool();
  const batchSize = Math.max(1, Math.min(1000, options.batchSize ?? 500));

  try {
    const sourceTable = await resolveTableName(oldPool, SOURCE_LOWER, SOURCE_PREFERRED);
    if (!sourceTable) throw new Error(`Source table not found: ${SOURCE_PREFERRED}`);
    summary.sourceTable = sourceTable;

    const targetTable = await resolveTableName(newPool, TARGET_LOWER, TARGET_PREFERRED);
    if (!targetTable) throw new Error(`Target table not found: ${TARGET_PREFERRED}`);
    summary.targetTable = targetTable;

    const sharedColumns = await getSharedColumns(oldPool, newPool, sourceTable, targetTable);
    if (!sharedColumns.length) throw new Error('No shared columns between source and target fees tables');

    const [maxRows] = await newPool.query(`SELECT MAX(\`Fees_Id\`) AS mx FROM \`${targetTable}\``);
    const currentMaxFeesId = Number((maxRows as any[])[0]?.mx ?? 0);
    summary.currentMaxFeesId = currentMaxFeesId;

    const colsSql = sharedColumns.map((c) => `\`${c}\``).join(', ');
    const [rowsRaw] = await oldPool.query(
      `SELECT ${colsSql} FROM \`${sourceTable}\` WHERE \`Fees_Id\` > ? ORDER BY \`Fees_Id\``,
      [currentMaxFeesId]
    );
    const rows = rowsRaw as any[];
    summary.fetched = rows.length;

    summary.inserted = await insertRows(newPool, targetTable, sharedColumns, rows, batchSize, !!options.dryRun);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    summary.errors.push(msg);
    console.error('[legacy-fees-sync] error:', msg);
  }

  return summary;
}
