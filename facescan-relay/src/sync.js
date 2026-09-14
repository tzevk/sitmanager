const path = require('node:path');
const sql = require('mssql');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ---------------------------------------------------------------------------
// Hardcoded defaults, taken from SmartOffice's "Parallel Database Export"
// dialog. An .env file (if present) overrides any of these — see .env.example.
//
// SECURITY NOTE: DB_PASSWORD and INGEST_SECRET below are plaintext secrets
// committed to source control. Only do this if this repo is private and you
// accept that anyone with repo access can read them. Rotate both immediately
// if this file (or the repo) is ever exposed.
// ---------------------------------------------------------------------------
const DEFAULTS = {
  DB_SERVER: 'ATS-PC-026',
  DB_INSTANCE: 'SQLEXPRESS',
  DB_PORT: '1433',
  DB_NAME: 'SmartOfficedb',
  DB_USER: 'sa',
  DB_PASSWORD: 'PUT_SQL_SERVER_PASSWORD_HERE', // <-- fill in the real "sa" password
  DB_TABLE: 'Machine_Final_Log',
  DB_COLUMN_EMPLOYEE_CODE: 'Student_Code',
  DB_COLUMN_LOG_DATETIME: 'Entry_Time',
  DB_COLUMN_PUNCH_DIRECTION: 'Type_of',
  INGEST_URL: 'https://suvidya.app/api/daily-activities/attendance/facescan-ingest',
  INGEST_SECRET: '865e45cf2660bcd8606f7eabc4ac43992af18c4960098bd5a453d70aad9bcfb3', // <-- must match FACESCAN_INGEST_SECRET in Vercel
  POLL_INTERVAL_MINUTES: '10',
};

const get = (key) => process.env[key] || DEFAULTS[key];

const config = {
  dbServer: get('DB_SERVER'),
  dbInstance: get('DB_INSTANCE'),
  dbPort: Number(get('DB_PORT')),
  dbName: get('DB_NAME'),
  dbUser: get('DB_USER'),
  dbPassword: get('DB_PASSWORD'),
  dbTable: get('DB_TABLE'),
  dbColEmployeeCode: get('DB_COLUMN_EMPLOYEE_CODE'),
  dbColLogDateTime: get('DB_COLUMN_LOG_DATETIME'),
  dbColPunchDirection: get('DB_COLUMN_PUNCH_DIRECTION'),
  ingestUrl: get('INGEST_URL'),
  ingestSecret: get('INGEST_SECRET'),
  pollIntervalMinutes: Number(get('POLL_INTERVAL_MINUTES')),
};

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Node's fetch wraps network errors as "fetch failed" with the real reason in .cause (possibly nested). */
function describeError(err) {
  if (!(err instanceof Error)) return String(err);
  let cause = err.cause;
  let detail = '';
  while (cause) {
    detail = cause.code ? `${cause.code}: ${cause.message ?? cause}` : String(cause.message ?? cause);
    cause = cause.cause;
  }
  return detail ? `${err.message} (${detail})` : err.message;
}

/**
 * Pulls today's punch logs from SmartOffice's "Parallel Database Export"
 * SQL Server table. Returns logs shaped for the ingest endpoint:
 * { EmployeeCode, LogDate, PunchDirection }.
 */
async function fetchLogsFromDatabase(date) {
  const poolConfig = {
    server: config.dbServer,
    port: config.dbPort,
    database: config.dbName,
    user: config.dbUser,
    password: config.dbPassword,
    options: {
      // On-prem SQL Server Express instances almost never have a real TLS
      // cert configured; this only ever talks to it over the LAN.
      encrypt: false,
      trustServerCertificate: true,
      ...(config.dbInstance ? { instanceName: config.dbInstance } : {}),
    },
  };

  let dbPool;
  try {
    dbPool = await sql.connect(poolConfig);
    const result = await dbPool.request()
      .input('fromDate', sql.Date, date)
      .query(
        `SELECT [${config.dbColEmployeeCode}] AS EmployeeCode,
                [${config.dbColLogDateTime}] AS LogDate,
                [${config.dbColPunchDirection}] AS PunchDirection
         FROM [${config.dbTable}]
         WHERE CAST([${config.dbColLogDateTime}] AS DATE) = @fromDate`
      );
    return result.recordset.map((row) => ({
      EmployeeCode: String(row.EmployeeCode ?? '').trim(),
      LogDate: row.LogDate instanceof Date
        ? row.LogDate.toISOString().replace('T', ' ').slice(0, 19)
        : String(row.LogDate ?? ''),
      PunchDirection: row.PunchDirection === 1 || row.PunchDirection === '1' ? 'IN'
        : row.PunchDirection === 0 || row.PunchDirection === '0' ? 'OUT'
        : row.PunchDirection != null ? String(row.PunchDirection) : undefined,
    })).filter((l) => l.EmployeeCode && l.LogDate);
  } finally {
    if (dbPool) await dbPool.close().catch(() => {});
  }
}

/**
 * Runs one sync pass: fetch today's punches from SQL Server, push to the
 * ingest endpoint. `onLog` (optional) receives a string for each status
 * line, so callers (CLI, Electron UI) can display progress.
 */
async function syncNow({ dryRun = false, onLog = () => {} } = {}) {
  if (!config.dbServer || !config.dbName || !config.dbUser) {
    const msg = 'DB_SERVER / DB_NAME / DB_USER not set';
    onLog(msg);
    return { ok: false, message: msg };
  }
  if (!dryRun && (!config.ingestUrl || !config.ingestSecret)) {
    const msg = 'INGEST_URL / INGEST_SECRET not set (fill these in src/sync.js)';
    onLog(msg);
    return { ok: false, message: msg };
  }

  const date = todayISO();
  onLog(`Fetching punches for ${date} from ${config.dbServer}${config.dbInstance ? `\\${config.dbInstance}` : ''} / ${config.dbName}.${config.dbTable}...`);

  let logs;
  try {
    logs = await fetchLogsFromDatabase(date);
  } catch (err) {
    const msg = `Database fetch failed: ${describeError(err)}`;
    onLog(msg);
    return { ok: false, message: msg };
  }

  onLog(`Found ${logs.length} punch(es) today.`);

  if (dryRun) {
    onLog('Dry run — not pushing to ingest endpoint.');
    return { ok: true, message: `Found ${logs.length} punch(es) (dry run, not pushed)`, logs };
  }

  try {
    const res = await fetch(config.ingestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-facescan-secret': config.ingestSecret,
      },
      body: JSON.stringify({ logs }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Ingest failed (${res.status})`);
    const msg = `Synced ${data.inserted ?? 0} new punch(es) of ${logs.length} found`;
    onLog(msg);
    return { ok: true, message: msg, logs };
  } catch (err) {
    const msg = `Ingest push failed: ${describeError(err)}`;
    onLog(msg);
    return { ok: false, message: msg };
  }
}

module.exports = { syncNow, config };
