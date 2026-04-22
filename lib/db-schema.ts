/* eslint-disable @typescript-eslint/no-explicit-any */

/** Module-level cache — survives between requests in the same process/lambda warm start. */
const _colCache = new Map<string, Set<string>>();

/**
 * Returns the set of column names that actually exist in `table`.
 * Falls back to an empty Set if the table doesn't exist or the query fails.
 */
export async function getTableCols(pool: any, table: string): Promise<Set<string>> {
  if (_colCache.has(table)) return _colCache.get(table)!;
  try {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table]
    );
    const cols = new Set((rows as any[]).map((r: any) => String(r.COLUMN_NAME)));
    _colCache.set(table, cols);
    return cols;
  } catch {
    return new Set();
  }
}

/** Reset the cache (useful in tests or after schema migrations). */
export function clearTableColsCache() {
  _colCache.clear();
}
