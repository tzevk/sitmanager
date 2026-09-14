# SIT Facescan Relay

A minimal Electron app that runs on a machine inside the institute's local
network (the same machine/LAN as the SmartOffice SQL Server database) and
pushes today's punch logs to SIT Manager, so student attendance can be
pre-filled from real facescan data.

Kept deliberately simple: one small window showing sync status and a
"Sync Now" button, no tray icon, no installer/packaging step. Config
(server, credentials, table/column names) is hardcoded directly in
`src/sync.js` — no `.env` file required, though one is still supported as
an override.

**See [DOCUMENTATION.md](./DOCUMENTATION.md) for full setup, configuration,
and troubleshooting details.**

## Quick start

```bash
cd facescan-relay
npm install
```

Open `src/sync.js`, fill in `DB_PASSWORD` and `INGEST_SECRET` (and
`INGEST_URL`) inside the `DEFAULTS` object, then:

```bash
npm start
```

This opens the app window, which syncs immediately and then every
`POLL_INTERVAL_MINUTES` (default 10) automatically.

To test from the command line instead (no window):
```bash
npm run dry-run     # test the SQL Server connection only, nothing sent
npm run test-once   # fetch today's punches and push them once
```

## Security note

Credentials live in plaintext in `src/sync.js` by design (for easy
deployment). Don't push this repo publicly, and rotate `DB_PASSWORD` /
`INGEST_SECRET` if this machine or repo is ever exposed.
