import { RowDataPacket } from 'mysql2';
import { getPool } from '@/lib/db';

/** Idempotently adds the structured timing columns to batch_mst (replacing the old free-text Timings field). */
export async function ensureBatchTimingColumns(pool: ReturnType<typeof getPool>) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME AS name
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'batch_mst'
       AND COLUMN_NAME IN ('Day_Start', 'Day_End', 'Start_Time', 'End_Time')`
  );
  const existing = new Set(rows.map((r) => r.name as string));

  const toAdd = [
    { name: 'Day_Start', ddl: 'ADD COLUMN Day_Start VARCHAR(20) NULL' },
    { name: 'Day_End', ddl: 'ADD COLUMN Day_End VARCHAR(20) NULL' },
    { name: 'Start_Time', ddl: 'ADD COLUMN Start_Time VARCHAR(20) NULL' },
    { name: 'End_Time', ddl: 'ADD COLUMN End_Time VARCHAR(20) NULL' },
  ].filter((c) => !existing.has(c.name));

  for (const c of toAdd) {
    await pool.query(`ALTER TABLE batch_mst ${c.ddl}`);
  }
}
