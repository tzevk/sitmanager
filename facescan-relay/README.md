# SIT Facescan Relay

A small Electron app that runs on a machine inside the institute's local
network (the same LAN as the facescan biometric device) and pushes punch
logs to SIT Manager, so student attendance can be pre-filled from real
facescan data.

## Why this exists

SIT Manager's server can't reach the biometric device directly — it sits on
a private network address (e.g. `172.16.1.40`) that's only visible from
inside the building. This app bridges that gap: it polls the device's
`GetDeviceLogs` API every few minutes and pushes whatever it finds to a
new endpoint, `/api/daily-activities/attendance/facescan-ingest`, which
stores it for the Attendance page's "Facescan Sync" button to read.

It's a small rewrite of an older internal tool that did the same polling
against a different destination — same idea, new target, minimal Electron
app (tray icon + one small status window with a manual "Sync Now" button).

## Setup

1. `cd facescan-relay && npm install`
2. Copy `.env.example` to `.env` and fill in:
   - `DEVICE_BASE_URL` / `DEVICE_API_KEY` — the facescan device's local API (same values the old tool used).
   - `INGEST_URL` — `https://<your-sitmanager-domain>/api/daily-activities/attendance/facescan-ingest`
   - `INGEST_SECRET` — must match `FACESCAN_INGEST_SECRET` set in SIT Manager's environment variables (Vercel → Settings → Environment Variables). Generate any long random string for this.
   - `POLL_INTERVAL_MINUTES` — how often to sync (defaults to 10, matching the old tool).
3. `npm start`

The app minimizes to the system tray on launch. Right-click the tray icon
for "Show App", "Sync Now", or "Quit". The window itself shows sync status
and a manual "Sync Now" button — useful for triggering a sync outside the
regular interval, or checking that the device/ingest connection is healthy.

## Packaging for a shared machine

This repo only includes the source (`npm start` via `electron .`). To hand
someone a double-clickable installer instead, add `@electron-forge/cli` and
run its make command — not set up here to keep this minimal until it's
confirmed working end-to-end.

## Security note

`INGEST_SECRET` authenticates this app to the server (no user login
involved — it's a machine-to-machine push). Treat it like a password: don't
commit `.env`, and rotate it if the relay machine is ever decommissioned.
