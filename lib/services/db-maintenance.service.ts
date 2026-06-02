import type mysql from 'mysql2/promise';
import { getPool } from '@/lib/db';

interface ProcessListRow {
  Id?: unknown;
  User?: unknown;
  db?: unknown;
  Command?: unknown;
  Time?: unknown;
  State?: unknown;
  Info?: unknown;
}

export interface DbConnectionCleanupOptions {
  longRunningSeconds?: number;
}

export interface DbConnectionCleanupSummary {
  scanned: number;
  matched: number;
  killed: number;
  skipped: number;
  victims: Array<{
    id: number;
    user: string;
    command: string;
    timeSeconds: number;
    state: string;
    reason: string;
  }>;
  skippedVictims: Array<{
    id: number;
    reason: string;
    error: string;
  }>;
}

function toTrimmedString(value: unknown): string {
  return String(value ?? '').trim();
}

function toFiniteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getNoisyConnectionReason(
  row: ProcessListRow,
  dbName: string,
  longRunningSeconds: number,
  currentConnectionId: number
): string | null {
  const id = toFiniteNumber(row.Id);
  if (!id || id === currentConnectionId) return null;

  const db = toTrimmedString(row.db);
  if (db !== dbName) return null;

  const command = toTrimmedString(row.Command);
  const timeSeconds = toFiniteNumber(row.Time);
  const state = toTrimmedString(row.State);
  const info = toTrimmedString(row.Info);
  const normalizedInfo = info.replace(/\s+/g, ' ').trim();

  if (/Waiting for table level lock|Waiting for table metadata lock|Locked/i.test(state)) {
    if (/student_inquiry|awt_inquirydiscussion/i.test(normalizedInfo)) {
      return 'inquiry-table lock wait';
    }
  }

  if (
    timeSeconds >= longRunningSeconds
    && command !== 'Sleep'
    && /SELECT COUNT\(\*\) AS total FROM student_master s WHERE/i.test(normalizedInfo)
  ) {
    return 'long-running student_master count';
  }

  return null;
}

export async function cleanupNoisyDbConnections(
  options: DbConnectionCleanupOptions = {}
): Promise<DbConnectionCleanupSummary> {
  const longRunningSeconds = Number.isFinite(options.longRunningSeconds)
    && Number(options.longRunningSeconds) > 0
    ? Math.trunc(Number(options.longRunningSeconds))
    : 60;

  const dbName = toTrimmedString(process.env.DB_NAME);
  if (!dbName) {
    throw new Error('DB_NAME is required for DB connection cleanup');
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    const [idRows] = await connection.query('SELECT CONNECTION_ID() AS id');
    const currentConnectionId = toFiniteNumber((idRows as Array<{ id?: unknown }>)[0]?.id);

    const [rows] = await connection.query('SHOW FULL PROCESSLIST');
    const processRows = rows as ProcessListRow[];

    const victims = processRows
      .map((row) => {
        const reason = getNoisyConnectionReason(row, dbName, longRunningSeconds, currentConnectionId);
        if (!reason) return null;

        return {
          id: toFiniteNumber(row.Id),
          user: toTrimmedString(row.User),
          command: toTrimmedString(row.Command),
          timeSeconds: toFiniteNumber(row.Time),
          state: toTrimmedString(row.State),
          reason,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    const skippedVictims: DbConnectionCleanupSummary['skippedVictims'] = [];
    let killed = 0;

    for (const victim of victims) {
      try {
        await connection.query(`KILL ${victim.id}`);
        killed += 1;
      } catch (error) {
        skippedVictims.push({
          id: victim.id,
          reason: victim.reason,
          error: error instanceof Error ? error.message : 'Unknown kill error',
        });
      }
    }

    return {
      scanned: processRows.length,
      matched: victims.length,
      killed,
      skipped: skippedVictims.length,
      victims,
      skippedVictims,
    };
  } finally {
    connection.release();
  }
}