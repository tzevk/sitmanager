import type mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';

const IDENT_RE = /^[A-Za-z0-9_]+$/;

export function isSafeIdentifier(id: string): boolean {
  return IDENT_RE.test(id);
}

export function qid(id: string): string {
  if (!isSafeIdentifier(id)) {
    throw new Error(`Unsafe identifier: ${id}`);
  }
  return `\`${id}\``;
}

export interface TableInfo {
  table: string;
  primaryKey: string[];
  columns: string[];
}

export async function listBaseTables(pool: mysql.Pool): Promise<string[]> {
  type TRow = RowDataPacket & { table_name: string };
  const [rows] = await pool.query<TRow[]>(
    `SELECT TABLE_NAME AS table_name
     FROM information_schema.tables
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME ASC`
  );
  return rows.map((r) => r.table_name);
}

export async function getPrimaryKey(pool: mysql.Pool, table: string): Promise<string[]> {
  if (!isSafeIdentifier(table)) return [];

  type PKRow = RowDataPacket & { column_name: string; seq: number };
  const [rows] = await pool.query<PKRow[]>(
    `SELECT COLUMN_NAME AS column_name, SEQ_IN_INDEX AS seq
     FROM information_schema.statistics
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = 'PRIMARY'
     ORDER BY SEQ_IN_INDEX ASC`,
    [table]
  );
  return rows.map((r) => r.column_name);
}

export async function getColumns(pool: mysql.Pool, table: string): Promise<string[]> {
  if (!isSafeIdentifier(table)) return [];

  type CRow = RowDataPacket & { column_name: string; extra: string | null };
  const [rows] = await pool.query<CRow[]>(
    `SELECT COLUMN_NAME AS column_name, EXTRA AS extra
     FROM information_schema.columns
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION ASC`,
    [table]
  );

  // Skip generated columns (can't insert into them reliably)
  return rows
    .filter((r) => !(r.extra || '').toLowerCase().includes('generated'))
    .map((r) => r.column_name);
}

export function parseCsvEnv(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface SyncState {
  lastPkJson: string | null;
}

export async function ensureSyncStateTable(newPool: mysql.Pool): Promise<void> {
  await newPool.query(
    `CREATE TABLE IF NOT EXISTS sync_state (
      name VARCHAR(255) NOT NULL,
      last_pk_json TEXT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
}

export async function getLastPk(newPool: mysql.Pool, name: string): Promise<string | null> {
  type SRow = RowDataPacket & { last_pk_json: string | null };
  const [rows] = await newPool.query<SRow[]>(
    `SELECT last_pk_json FROM sync_state WHERE name = ? LIMIT 1`,
    [name]
  );
  return rows[0]?.last_pk_json ?? null;
}

export async function setLastPk(newPool: mysql.Pool, name: string, lastPkJson: string): Promise<void> {
  await newPool.query(
    `INSERT INTO sync_state (name, last_pk_json) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE last_pk_json = VALUES(last_pk_json)`,
    [name, lastPkJson]
  );
}

export function buildPkWhereAfter(primaryKey: string[], lastPk: unknown[]): { where: string; params: unknown[] } {
  if (primaryKey.length === 0) return { where: '', params: [] };
  if (primaryKey.length !== lastPk.length) return { where: '', params: [] };

  const pkExpr = primaryKey.map(qid).join(', ');
  const placeholders = primaryKey.map(() => '?').join(', ');
  return {
    where: `WHERE (${pkExpr}) > (${placeholders})`,
    params: lastPk,
  };
}

export function buildOrderBy(primaryKey: string[]): string {
  if (primaryKey.length === 0) return '';
  return `ORDER BY ${primaryKey.map(qid).join(', ')} ASC`;
}

export function buildUpsertSql(table: string, columns: string[]): string {
  const safeTable = qid(table);
  const cols = columns.map(qid);
  const insertCols = cols.join(', ');
  const updateCols = columns
    .map((c) => qid(c))
    .map((c) => `${c}=VALUES(${c})`)
    .join(', ');
  return `INSERT INTO ${safeTable} (${insertCols}) VALUES ? ON DUPLICATE KEY UPDATE ${updateCols}`;
}

export function extractPkValues(row: Record<string, unknown>, primaryKey: string[]): unknown[] {
  return primaryKey.map((k) => row[k]);
}
