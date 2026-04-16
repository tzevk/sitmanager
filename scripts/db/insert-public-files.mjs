#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: '.env.local' });

dotenv.config();

function parseArgs(argv) {
  const opts = {
    files: ['31', 'offshore', 'randomeone'],
    dir: 'public',
    table: 'public_file_assets',
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--files') {
      opts.files = String(argv[++i] || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    } else if (a === '--dir') {
      opts.dir = String(argv[++i] || 'public').trim() || 'public';
    } else if (a === '--table') {
      opts.table = String(argv[++i] || 'public_file_assets').trim() || 'public_file_assets';
    } else if (a === '--dry-run') {
      opts.dryRun = true;
    } else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/db/insert-public-files.mjs [--files 31,offshore,randomeone] [--dir public] [--table public_file_assets] [--dry-run]');
      process.exit(0);
    }
  }

  return opts;
}

function mimeFromExt(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.xls') return 'application/vnd.ms-excel';
  if (ext === '.xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (ext === '.csv') return 'text/csv';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function normalizeBaseName(v) {
  return String(v || '')
    .toLowerCase()
    .trim()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '');
}

function sanitizeTableName(input) {
  const t = String(input || '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) {
    throw new Error(`Unsafe table name: ${input}`);
  }
  return t;
}

function findFileByBaseName(fileList, wantedBaseName) {
  const wanted = normalizeBaseName(wantedBaseName);

  // Explicit typo alias support requested by user text.
  const aliases = new Map([
    ['randomeone', 'randomone'],
  ]);
  const effectiveWanted = aliases.get(wanted) || wanted;

  return fileList.find((name) => normalizeBaseName(name) === effectiveWanted) || null;
}

async function ensureTable(conn, table) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`${table}\` (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      file_key VARCHAR(255) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      source_path VARCHAR(500) NOT NULL,
      mime_type VARCHAR(150) NOT NULL,
      file_size_bytes BIGINT NOT NULL,
      file_blob LONGBLOB NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_public_file_assets_key (file_key)
    )
  `);
}

async function main() {
  const opts = parseArgs(process.argv);
  const table = sanitizeTableName(opts.table);
  const targetDir = path.resolve(opts.dir);

  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    throw new Error(`Directory not found: ${targetDir}`);
  }

  const entries = fs.readdirSync(targetDir).filter((name) => {
    const full = path.join(targetDir, name);
    return fs.statSync(full).isFile();
  });

  const resolvedFiles = [];
  const notFound = [];

  for (const requested of opts.files) {
    const matched = findFileByBaseName(entries, requested);
    if (!matched) {
      notFound.push(requested);
      continue;
    }
    resolvedFiles.push({ requested, fileName: matched, fullPath: path.join(targetDir, matched) });
  }

  if (notFound.length) {
    throw new Error(`Could not find file(s) in ${targetDir}: ${notFound.join(', ')}`);
  }

  if (!resolvedFiles.length) {
    throw new Error('No files resolved to insert.');
  }

  console.log(`Resolved ${resolvedFiles.length} file(s):`);
  for (const f of resolvedFiles) {
    console.log(`- ${f.requested} -> ${f.fileName}`);
  }

  if (opts.dryRun) {
    console.log('Dry run enabled. No DB changes made.');
    return;
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    dateStrings: true,
  });

  try {
    await ensureTable(conn, table);

    const upsertSql = `
      INSERT INTO \`${table}\`
      (file_key, file_name, source_path, mime_type, file_size_bytes, file_blob)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        file_name = VALUES(file_name),
        source_path = VALUES(source_path),
        mime_type = VALUES(mime_type),
        file_size_bytes = VALUES(file_size_bytes),
        file_blob = VALUES(file_blob)
    `;

    for (const file of resolvedFiles) {
      const bytes = fs.readFileSync(file.fullPath);
      const mime = mimeFromExt(file.fileName);
      const key = normalizeBaseName(file.fileName);
      const sourcePath = path.posix.join(path.basename(opts.dir), file.fileName);

      await conn.query(upsertSql, [
        key,
        file.fileName,
        sourcePath,
        mime,
        bytes.length,
        bytes,
      ]);

      console.log(`Inserted/updated: ${file.fileName} (${bytes.length} bytes)`);
    }

    console.log(`Done. Files inserted into table: ${table}`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('insert-public-files failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
