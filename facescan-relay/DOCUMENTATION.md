# SIT Facescan Relay — Documentation

## What this is

A minimal Electron app that runs on a machine inside the institute's local
network and bridges SmartOffice's biometric attendance data into SIT
Manager. One small window shows sync status and a "Sync Now" button — no
tray icon, no installer, nothing beyond `main.js` (Electron process),
`preload.js` (safe bridge to the window), `index.html`/`renderer.js` (the
window itself), and `sync.js` (the actual SQL Server + ingest logic, shared
with the command-line variant below).

## Why it has to run locally (not on Vercel)

SIT Manager is hosted in the cloud. The attendance data lives in a SQL
Server database (`SmartOfficedb`, on host `ATS-PC-026\SQLEXPRESS`) that only
exists on the institute's private network — there's no public address for
Vercel to connect to. So a small script has to sit on that same network,
read the data, and push it out to SIT Manager over the internet. That's all
this script does.

```
SmartOffice (writes punches)
        │
        ▼
Machine_Final_Log table  ──(this script reads it)──▶  facescan-relay
   (SQL Server, LAN-only)                                   │
                                                              ▼ HTTPS POST
                                         /api/daily-activities/attendance/facescan-ingest
                                                              │
                                                              ▼
                                            facescan_device_logs table (SIT Manager DB)
                                                              │
                                                              ▼
                                    Attendance page → "Facescan Sync" button reads this
```

## Where the data comes from

SmartOffice's **Parallel Database Export** feature (configured inside the
SmartOffice desktop app) writes every punch directly into a SQL Server table
as it happens. Per your configuration:

| SmartOffice field         | SQL Server column | Meaning                              |
|----------------------------|--------------------|---------------------------------------|
| Employee Code (Is Unique)  | `Student_Code`     | Must equal the student's `Student_Id` in SIT Manager |
| Log Date (Is Unique)       | `Entry_Date`       | Date of the punch (`yyyy-MM-dd`)      |
| Log Date Time (Is Unique)  | `Entry_Time`       | Full timestamp (`yyyy-MM-dd HH:mm:ss`)|
| Punch Direction            | `Type_of`          | `1` = In, `0` = Out                   |

Connection details:
- Database Type: SQL Server (SQL Server Authentication)
- Server: `ATS-PC-026\SQLEXPRESS`, Port `1433`
- Database: `SmartOfficedb`
- Table: `Machine_Final_Log`
- User: `sa`

## Configuration

All of the above is hardcoded as defaults directly in `src/sync.js` (see
the `DEFAULTS` object near the top of the file), so the app runs with just
`npm install` and no separate `.env` file. If an `.env` file *is* present
(copy `.env.example` → `.env`), its values override the hardcoded defaults —
useful if you ever need to point the same app at a different server without
editing code.

**You must still fill in two values yourself** — they were never visible in
the SmartOffice screenshot, so they're placeholders in the code:
- `DB_PASSWORD` in `DEFAULTS` — the real password for the `sa` SQL Server login.
- `INGEST_SECRET` in `DEFAULTS` — must match `FACESCAN_INGEST_SECRET` in SIT
  Manager's environment variables. Also set `INGEST_URL` to your real
  SIT Manager domain.

**Security note**: because credentials are hardcoded in `src/sync.js`,
that file now contains plaintext secrets. Anyone with read access to this
repository (or this machine) can read them. This is intentional per your
request, for ease of deployment — but it means:
- Rotate `DB_PASSWORD` and `INGEST_SECRET` immediately if this repo or
  machine is ever exposed or decommissioned.
- Don't push this repo to a public GitHub repository.

## Running it

```bash
cd facescan-relay
npm install
```

Then edit `src/sync.js` and fill in `DB_PASSWORD` and `INGEST_SECRET` (and
`INGEST_URL`) inside the `DEFAULTS` object.

**Open the app** (recommended for normal use):
```bash
npm start
```
A small window opens showing connection status. It syncs immediately, then
automatically every `POLL_INTERVAL_MINUTES` (default 10) for as long as the
window stays open. Click "Sync Now" to trigger an extra sync manually.
Closing the window stops the relay (this is intentionally simple — no tray
icon, no background service).

**Test from the command line instead** (no window, useful for first-time
setup or troubleshooting on a machine without a display):
```bash
npm run dry-run     # connects to SQL Server, prints today's punches, sends nothing
npm run test-once   # connects, prints punches, and pushes them once
npm run cli          # same as test-once but keeps polling in the terminal
```
These use the exact same `src/sync.js` logic as the app window, so a
successful `dry-run` here means the app will work too.

## Troubleshooting

- **"Database fetch failed" with a connection error** — check `DB_SERVER`/
  `DB_INSTANCE`/`DB_PORT` match the export dialog exactly, and that SQL
  Server Browser service is running (required for named-instance connections
  like `\SQLEXPRESS`) and that port 1433 / SQL Browser (UDP 1434) isn't
  blocked by the local firewall.
- **"Login failed for user 'sa'"** — the password in `DEFAULTS.DB_PASSWORD`
  is wrong, or the `sa` account is disabled in SQL Server (check SQL Server
  Configuration Manager / SSMS → Security → Logins).
- **Found 0 punches** — the app only queries *today's* date. If you're
  testing with historical data, temporarily change `todayISO()` in
  `src/sync.js` or query the table directly in SSMS to confirm rows exist
  for today.
- **App window doesn't open / crashes on launch** — run `npm run dry-run`
  from a terminal instead; if that also fails, the error message will point
  at the actual problem (usually a bad SQL Server connection) without the
  Electron layer in the way.
- **"Ingest push failed"** — check `INGEST_URL` is reachable from this
  machine (it needs outbound internet access) and `INGEST_SECRET` matches
  `FACESCAN_INGEST_SECRET` in SIT Manager's environment variables exactly.
- **Punches don't show against the right student** — confirm
  `Student_Code` in `Machine_Final_Log` is the student's numeric
  `Student_Id` from SIT Manager, not a roll number or separate code. This is
  a hard requirement of the ingest pipeline (`lib/facescan-attendance.ts` in
  the main app matches punches to students by this number).

## Files in this folder

| File               | Purpose                                                        |
|---------------------|------------------------------------------------------------------|
| `src/sync.js`        | All config (`DEFAULTS`) and the actual SQL Server + ingest logic |
| `src/main.js`        | Electron main process — window, polling timer, IPC handlers      |
| `src/preload.js`     | Safe bridge exposing `getConfig`/`syncNow`/`onStatus` to the window |
| `src/index.html`     | The status window's markup/styles                                |
| `src/renderer.js`    | The status window's behavior (renders sync status, countdown)    |
| `src/index.js`       | Command-line entry point (`npm run cli` / `test-once` / `dry-run`) |
| `.env.example`       | Optional override file (copy to `.env` if needed)                |
| `package.json`       | Dependencies: `electron`, `mssql`, `dotenv`                       |
| `README.md`          | Quick-start version of this document                              |
