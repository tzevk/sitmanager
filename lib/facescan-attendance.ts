/* eslint-disable @typescript-eslint/no-explicit-any */
// Shared facescan biometric log storage + bucketing logic.
//
// SmartOffice's GetDeviceLogs API assumes the device is reachable directly
// from this server. Some institutes' devices sit on a local network only
// (e.g. 172.16.x.x) — for those, a small local relay app polls the device
// and pushes raw punch logs to /api/daily-activities/attendance/facescan-ingest,
// which stores them here. facescan-sync then reads from this table instead
// of calling SmartOffice directly.

export interface PunchLog {
  EmployeeCode: string;
  LogDate: string; // "YYYY-MM-DD HH:mm:ss"
  SerialNumber?: string;
  PunchDirection?: string;
}

let tableReady = false;

export async function ensureFacescanLogsTable(pool: any) {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS facescan_device_logs (
      Id             INT AUTO_INCREMENT PRIMARY KEY,
      EmployeeCode   VARCHAR(50)  NOT NULL,
      LogDate        DATETIME     NOT NULL,
      SerialNumber   VARCHAR(100) NOT NULL DEFAULT '',
      PunchDirection VARCHAR(20)  NULL,
      Received_At    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_facescan_log (EmployeeCode, LogDate, SerialNumber),
      KEY idx_facescan_date (LogDate)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  tableReady = true;
}

/** Bulk-insert pushed punch logs, ignoring exact duplicates (same employee/time/device). */
export async function insertPunchLogs(pool: any, logs: PunchLog[]): Promise<number> {
  if (!logs.length) return 0;
  await ensureFacescanLogsTable(pool);

  const values = logs
    .filter((l) => l.EmployeeCode && l.LogDate)
    .map((l) => [String(l.EmployeeCode), l.LogDate, l.SerialNumber ?? '', l.PunchDirection ?? null]);
  if (!values.length) return 0;

  const [res] = await pool.query(
    `INSERT IGNORE INTO facescan_device_logs (EmployeeCode, LogDate, SerialNumber, PunchDirection) VALUES ?`,
    [values]
  );
  return res.affectedRows ?? 0;
}

/** Read back stored punch logs for a single date (LogDate falls on that calendar day). */
export async function getStoredPunchLogs(pool: any, date: string): Promise<PunchLog[]> {
  await ensureFacescanLogsTable(pool);
  const [rows] = await pool.query(
    `SELECT EmployeeCode, LogDate, SerialNumber, PunchDirection
     FROM facescan_device_logs
     WHERE DATE(LogDate) = ?`,
    [date]
  );
  return (rows as any[]).map((r) => ({
    EmployeeCode: String(r.EmployeeCode),
    LogDate: r.LogDate instanceof Date ? r.LogDate.toISOString().replace('T', ' ').slice(0, 19) : String(r.LogDate),
    SerialNumber: r.SerialNumber,
    PunchDirection: r.PunchDirection,
  }));
}

// Fixed session cutover matching the rest of the app's 09:00AM/02:00PM
// Lecture Taken session markers (see app/api/daily-activities/attendance).
export const SESSION_CUTOVER_HOUR = 13;

export type Session = 'first_half' | 'second_half';

export interface PunchBucket {
  studentId: number;
  session: Session;
  inTime: string;  // "HH:MM:SS"
  outTime: string; // "HH:MM:SS"
}

/** Groups raw punch logs by student + session, keeping earliest (in) and latest (out) punch. */
export function bucketPunches(logs: PunchLog[]): PunchBucket[] {
  const grouped = new Map<number, Map<Session, string[]>>();

  for (const log of logs) {
    const studentId = Number(log.EmployeeCode);
    if (!Number.isFinite(studentId) || studentId <= 0) continue;

    const match = String(log.LogDate || '').match(/(\d{2}):(\d{2}):(\d{2})/);
    if (!match) continue;
    const hour = Number(match[1]);
    const session: Session = hour < SESSION_CUTOVER_HOUR ? 'first_half' : 'second_half';
    const timeStr = `${match[1]}:${match[2]}:${match[3]}`;

    if (!grouped.has(studentId)) grouped.set(studentId, new Map());
    const bySession = grouped.get(studentId)!;
    if (!bySession.has(session)) bySession.set(session, []);
    bySession.get(session)!.push(timeStr);
  }

  const buckets: PunchBucket[] = [];
  for (const [studentId, bySession] of grouped) {
    for (const [session, times] of bySession) {
      times.sort();
      buckets.push({ studentId, session, inTime: times[0], outTime: times[times.length - 1] });
    }
  }
  return buckets;
}

/** Authenticates a pushed request from the local facescan relay app. */
export function isAuthorizedFacescanIngest(req: Request): boolean {
  const secret = process.env.FACESCAN_INGEST_SECRET?.trim();
  if (!secret) return false;
  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const headerSecret = req.headers.get('x-facescan-secret')?.trim() || '';
  return bearer === secret || headerSecret === secret;
}
