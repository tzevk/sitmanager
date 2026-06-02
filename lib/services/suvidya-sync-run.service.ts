import { getPool } from '@/lib/db';

export type SuvidyaSyncScope = 'main' | 'pune';
export type SuvidyaSyncStatus = 'success' | 'failed';

export interface SuvidyaSyncRunRecord {
  id: number;
  scope: SuvidyaSyncScope;
  status: SuvidyaSyncStatus;
  runAt: string;
  errorMessage: string | null;
  summary: Record<string, unknown> | null;
}

let ensureTablePromise: Promise<void> | null = null;

async function ensureRunTable(): Promise<void> {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      const pool = getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS suvidya_inquiry_sync_runs (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          scope VARCHAR(20) NOT NULL,
          status VARCHAR(20) NOT NULL,
          run_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          summary_json LONGTEXT NULL,
          error_message TEXT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_suvidya_sync_runs_scope_id (scope, id),
          KEY idx_suvidya_sync_runs_run_at (run_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    })().catch((error) => {
      ensureTablePromise = null;
      throw error;
    });
  }

  await ensureTablePromise;
}

export async function recordSuvidyaSyncRun(params: {
  scope: SuvidyaSyncScope;
  status: SuvidyaSyncStatus;
  summary?: unknown;
  errorMessage?: string | null;
}): Promise<void> {
  await ensureRunTable();
  const pool = getPool();
  await pool.query(
    `INSERT INTO suvidya_inquiry_sync_runs (scope, status, summary_json, error_message)
     VALUES (?, ?, ?, ?)`,
    [
      params.scope,
      params.status,
      params.summary == null ? null : JSON.stringify(params.summary),
      params.errorMessage?.trim() || null,
    ],
  );
}

function parseSummary(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(String(raw));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function getLatestSuvidyaSyncRuns(): Promise<{
  main: SuvidyaSyncRunRecord | null;
  pune: SuvidyaSyncRunRecord | null;
}> {
  await ensureRunTable();
  const pool = getPool();

  const [rows] = await pool.query<any[]>(
    `SELECT r.id, r.scope, r.status, DATE_FORMAT(r.run_at, '%Y-%m-%d %H:%i:%s') AS run_at, r.error_message, r.summary_json
     FROM suvidya_inquiry_sync_runs r
     INNER JOIN (
       SELECT scope, MAX(id) AS max_id
       FROM suvidya_inquiry_sync_runs
       WHERE scope IN ('main', 'pune')
       GROUP BY scope
     ) latest ON latest.max_id = r.id`
  );

  let main: SuvidyaSyncRunRecord | null = null;
  let pune: SuvidyaSyncRunRecord | null = null;

  for (const row of rows as any[]) {
    const mapped: SuvidyaSyncRunRecord = {
      id: Number(row.id || 0),
      scope: String(row.scope) === 'pune' ? 'pune' : 'main',
      status: String(row.status) === 'failed' ? 'failed' : 'success',
      runAt: String(row.run_at || ''),
      errorMessage: row.error_message ? String(row.error_message) : null,
      summary: parseSummary(row.summary_json),
    };

    if (mapped.scope === 'pune') pune = mapped;
    else main = mapped;
  }

  return { main, pune };
}
