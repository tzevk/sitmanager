import { cached, getPool, invalidateCache } from '@/lib/db';
import bundledScoreboard from '@/lib/data/sales-scoreboard.json';
import type { Scoreboard } from '@/lib/sales-scoreboard-parser';

export { parseScoreboardWorkbook } from '@/lib/sales-scoreboard-parser';
export type { Scoreboard, TrackerRow, ProspectRow } from '@/lib/sales-scoreboard-parser';

const TABLE = 'sales_scoreboard_uploads';
const CACHE_KEY = 'sales-scoreboard:latest';

async function ensureTable() {
  await getPool().query(
    `CREATE TABLE IF NOT EXISTS ${TABLE} (
       id INT AUTO_INCREMENT PRIMARY KEY,
       file_name VARCHAR(255) NOT NULL,
       uploaded_by VARCHAR(150) NULL,
       uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       data_json LONGTEXT NOT NULL
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
}

/** Keeps every upload (newest wins), so an earlier sheet can be restored if one goes wrong. */
export async function saveScoreboard(board: Scoreboard, uploadedBy: string): Promise<void> {
  await ensureTable();
  await getPool().query(
    `INSERT INTO ${TABLE} (file_name, uploaded_by, data_json) VALUES (?, ?, ?)`,
    [board.source.slice(0, 255), uploadedBy.slice(0, 150), JSON.stringify(board)]
  );
  invalidateCache(CACHE_KEY);
}

/** The latest uploaded sheet, or the sheet bundled with the app until the first upload. */
export async function getScoreboard(): Promise<Scoreboard> {
  return cached(CACHE_KEY, 60_000, async () => {
    await ensureTable();
    const [rows] = await getPool().query(
      `SELECT data_json, uploaded_by, DATE_FORMAT(uploaded_at, '%Y-%m-%dT%H:%i:%s') AS uploaded_at
       FROM ${TABLE} ORDER BY id DESC LIMIT 1`
    );
    const latest = (rows as { data_json: string; uploaded_by: string | null; uploaded_at: string }[])[0];
    if (!latest) return bundledScoreboard as Scoreboard;
    const board = JSON.parse(latest.data_json) as Scoreboard;
    return { ...board, uploadedAt: latest.uploaded_at, uploadedBy: latest.uploaded_by ?? undefined };
  });
}
