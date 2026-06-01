#!/usr/bin/env node
/**
 * One-time migration: pull all student document files from the legacy server
 * via SFTP and save them to UPLOADS_DIR on this server.
 *
 * Required env vars (add to .env):
 *   SSH_HOST              — defaults to OLD_DB_HOST
 *   SSH_PORT              — defaults to 22
 *   SSH_USER              — SSH username on the legacy server
 *   SSH_PASSWORD          — SSH password  (use this OR SSH_KEY_PATH)
 *   SSH_KEY_PATH          — absolute path to your private key file
 *   SSH_REMOTE_DOCS_PATH  — absolute path on the remote server where documents live
 *                           e.g. /var/www/html/uploads/student_document
 *   UPLOADS_DIR           — absolute path on THIS server where files will be saved
 *                           e.g. /var/www/uploads/student_document
 *
 * Usage:
 *   node scripts/db/migrate-student-documents.mjs
 *   node scripts/db/migrate-student-documents.mjs --dry-run        # list files, no transfer
 *   node scripts/db/migrate-student-documents.mjs --skip-existing  # skip already-downloaded files
 *   node scripts/db/migrate-student-documents.mjs --student 1234   # one student only
 */

import path from 'path';
import fs from 'fs';
import { mkdir } from 'fs/promises';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import SftpClient from 'ssh2-sftp-client';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ── CLI args ───────────────────────────────────────────────────────────────
const args        = process.argv.slice(2);
const DRY_RUN     = args.includes('--dry-run');
const SKIP_EXISTING = args.includes('--skip-existing');
const studentIdx  = args.indexOf('--student');
const ONLY_STUDENT = studentIdx !== -1 ? args[studentIdx + 1] : null;

// ── Config ─────────────────────────────────────────────────────────────────
function requireEnv(name, fallback) {
  const v = process.env[name]?.trim() || fallback?.trim();
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const SSH_HOST     = process.env.SSH_HOST?.trim() || requireEnv('OLD_DB_HOST');
const SSH_PORT     = Number(process.env.SSH_PORT ?? 22);
const SSH_USER     = requireEnv('SSH_USER');
const SSH_PASSWORD = process.env.SSH_PASSWORD?.trim() || null;
const SSH_KEY_PATH = process.env.SSH_KEY_PATH?.trim() || null;
const REMOTE_DOCS  = requireEnv('SSH_REMOTE_DOCS_PATH').replace(/\/$/, '');
const UPLOADS_DIR  = requireEnv('UPLOADS_DIR');

if (!SSH_PASSWORD && !SSH_KEY_PATH) {
  console.error('ERROR: Set SSH_PASSWORD or SSH_KEY_PATH in .env');
  process.exit(1);
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Student Document Migration (SFTP) ===');
  console.log(`  SSH host    : ${SSH_HOST}:${SSH_PORT}`);
  console.log(`  SSH user    : ${SSH_USER}`);
  console.log(`  Auth        : ${SSH_KEY_PATH ? `key (${SSH_KEY_PATH})` : 'password'}`);
  console.log(`  Remote path : ${REMOTE_DOCS}`);
  console.log(`  Save to     : ${UPLOADS_DIR}`);
  console.log(`  Dry run     : ${DRY_RUN}`);
  console.log(`  Skip existing: ${SKIP_EXISTING}`);
  if (ONLY_STUDENT) console.log(`  Only student: ${ONLY_STUDENT}`);
  console.log('');

  // ── DB connection ──────────────────────────────────────────────────────
  const pool = await mysql.createPool({
    host:             requireEnv('DB_HOST'),
    port:             Number(process.env.DB_PORT ?? 3306),
    user:             requireEnv('DB_USER'),
    password:         requireEnv('DB_PASSWORD'),
    database:         requireEnv('DB_NAME'),
    waitForConnections: true,
    connectionLimit:  3,
    dateStrings:      true,
  });

  // ── Load document records ──────────────────────────────────────────────
  const queryParams = [];
  let querySql = 'SELECT id, Student_id, doc_name, upload_image FROM documents ORDER BY Student_id, id';
  if (ONLY_STUDENT) {
    querySql = 'SELECT id, Student_id, doc_name, upload_image FROM documents WHERE Student_id = ? ORDER BY id';
    queryParams.push(ONLY_STUDENT);
  }
  const [rows] = await pool.query(querySql, queryParams);
  await pool.end();

  console.log(`Found ${rows.length} document record(s) in DB\n`);
  if (!rows.length) return;

  if (DRY_RUN) {
    for (const row of rows) {
      const studentId = String(row.Student_id);
      const filename  = path.basename(String(row.upload_image ?? ''));
      const destFile  = path.join(UPLOADS_DIR, studentId, filename);
      console.log(`  [DRY] student=${studentId}  ${filename}  →  ${destFile}`);
    }
    console.log(`\n[dry-run] Would transfer ${rows.length} file(s). Re-run without --dry-run to proceed.`);
    return;
  }

  // ── SFTP connection ────────────────────────────────────────────────────
  const sftp = new SftpClient();
  const connectOpts = {
    host:    SSH_HOST,
    port:    SSH_PORT,
    username: SSH_USER,
    ...(SSH_KEY_PATH
      ? { privateKey: fs.readFileSync(SSH_KEY_PATH) }
      : { password: SSH_PASSWORD }),
    readyTimeout: 20000,
  };

  console.log('Connecting via SFTP…');
  await sftp.connect(connectOpts);
  console.log('Connected.\n');

  let downloaded = 0;
  let skipped    = 0;
  let failed     = 0;
  let alreadyHad = 0;

  try {
    for (const row of rows) {
      const studentId   = String(row.Student_id);
      const uploadImage = String(row.upload_image ?? '').trim();
      const filename    = path.basename(uploadImage);

      if (!filename || filename.startsWith('.')) {
        console.warn(`  [SKIP] id=${row.id} invalid filename: "${uploadImage}"`);
        skipped++;
        continue;
      }

      const destDir  = path.join(UPLOADS_DIR, studentId);
      const destFile = path.join(destDir, filename);

      if (SKIP_EXISTING && fs.existsSync(destFile)) {
        alreadyHad++;
        continue;
      }

      // Try remote paths: per-student subdirectory first, then flat
      const remoteCandidates = [
        `${REMOTE_DOCS}/${studentId}/${filename}`,
        `${REMOTE_DOCS}/${filename}`,
        `${REMOTE_DOCS}/${uploadImage}`,
      ];

      let transferred = false;
      for (const remotePath of remoteCandidates) {
        try {
          const stat = await sftp.stat(remotePath).catch(() => null);
          if (!stat) continue;

          await mkdir(destDir, { recursive: true });
          process.stdout.write(`  ${studentId}/${filename} (${Math.round(stat.size / 1024)} KB) … `);
          await sftp.fastGet(remotePath, destFile);
          console.log('OK');
          downloaded++;
          transferred = true;
          break;
        } catch (e) {
          // try next candidate
        }
      }

      if (!transferred) {
        console.log(`  [FAIL] student=${studentId} ${filename} — not found on remote`);
        failed++;
      }
    }
  } finally {
    await sftp.end();
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('\n=== Summary ===');
  console.log(`  Downloaded  : ${downloaded}`);
  if (alreadyHad) console.log(`  Already had : ${alreadyHad}`);
  if (skipped)    console.log(`  Skipped     : ${skipped}`);
  if (failed)     console.log(`  Failed      : ${failed} (not found on remote — check SSH_REMOTE_DOCS_PATH)`);

  if (downloaded > 0) {
    console.log('\nNext steps:');
    console.log('  1. Spot-check a few files under ' + UPLOADS_DIR);
    console.log('  2. Remove LEGACY_FILES_BASE_URL from .env (if set)');
    console.log('  3. UPLOADS_DIR is already set — documents should now be viewable');
  }
}

main().catch((err) => {
  console.error('\nFATAL:', err?.message ?? err);
  process.exit(1);
});
