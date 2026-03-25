import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import xlsx from 'xlsx';

function loadEnv() {
  // Support common Next.js patterns.
  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
    }
  }

  // Also allow shell-provided env vars.
}

function getRequiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function parseArgs(argv) {
  const out = {
    file: 'ct.xlsx',
    prefix: 'ct_',
    dryRun: false,
    truncate: false,
    recreate: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file' && argv[i + 1]) out.file = argv[++i];
    else if (a === '--prefix' && argv[i + 1]) out.prefix = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--truncate') out.truncate = true;
    else if (a === '--recreate') out.recreate = true;
    else if (a === '--help' || a === '-h') {
      console.log(
        [
          'Usage:',
          '  node scripts/db/import-ct-xlsx.mjs [--file ct.xlsx] [--prefix ct_] [--dry-run] [--truncate] [--recreate]',
          '',
          'Env vars (required): DB_HOST, DB_NAME, DB_USER, DB_PASSWORD',
          'Env vars (optional): DB_PORT (default 3306), DB_SSL (true/false)',
          '',
          'Notes:',
          '  --dry-run   parses xlsx and prints planned actions only',
          '  --truncate  DELETEs existing rows before inserting',
          '  --recreate  DROPs and re-CREATEs tables before inserting (destructive)',
        ].join('\n')
      );
      process.exit(0);
    }
  }
  if (out.recreate && out.dryRun) {
    // fine
  }
  return out;
}

function cleanHeaderCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value)
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

function slugifyColumnName(input) {
  let s = String(input || '')
    .trim()
    .toLowerCase();

  s = s
    .replace(/&/g, ' and ')
    .replace(/\//g, ' ')
    .replace(/\(|\)|\[|\]|\{|\}|\.|,|:|;|\?|!/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  s = s
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!s) return null;
  if (s.length > 60) s = s.slice(0, 60);
  return s;
}

function makeUnique(names) {
  const seen = new Map();
  return names.map((n) => {
    let base = n;
    let k = (seen.get(base) || 0) + 1;
    seen.set(base, k);
    if (k === 1) return base;
    // Ensure <= 64
    const suffix = `_${k}`;
    if (base.length + suffix.length > 64) base = base.slice(0, 64 - suffix.length);
    return base + suffix;
  });
}

function isEmptyCell(v) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

function looksNumeric(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return true;
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (!s) return false;
  return /^-?\d+(\.\d+)?$/.test(s);
}

function toNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toDateString(v) {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    // ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // dd/mm/yyyy
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const dd = String(m[1]).padStart(2, '0');
      const mm = String(m[2]).padStart(2, '0');
      const yyyy = m[3];
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return null;
}

function inferColumnType(values) {
  const nonEmpty = values.filter((v) => !isEmptyCell(v));
  if (nonEmpty.length === 0) return { sqlType: 'TEXT', kind: 'text' };

  // Dates
  const dateStrings = nonEmpty.map(toDateString).filter(Boolean);
  if (dateStrings.length === nonEmpty.length) {
    return { sqlType: 'DATE', kind: 'date' };
  }

  // Numbers
  if (nonEmpty.every(looksNumeric)) {
    const nums = nonEmpty.map(toNumber).filter((n) => n !== null);
    const hasDecimal = nums.some((n) => !Number.isInteger(n));
    if (hasDecimal) return { sqlType: 'DECIMAL(18,2)', kind: 'number' };
    const maxAbs = Math.max(...nums.map((n) => Math.abs(n)));
    if (maxAbs <= 2147483647) return { sqlType: 'INT', kind: 'number' };
    return { sqlType: 'BIGINT', kind: 'number' };
  }

  // Strings
  const maxLen = Math.max(...nonEmpty.map((v) => String(v).length));
  if (maxLen <= 255) return { sqlType: 'VARCHAR(255)', kind: 'text' };
  return { sqlType: 'TEXT', kind: 'text' };
}

function findHeaderRowIndex(rows) {
  return rows.findIndex((r) =>
    r.some((c) => {
      const s = cleanHeaderCell(c).toUpperCase();
      return s === 'SR. NO.' || s === 'SR. NO' || s === 'SR NO.' || s === 'SR NO';
    })
  );
}

function buildHeaders(headerRow, subHeaderRow) {
  const raw = [];
  let lastMain = '';

  for (let i = 0; i < Math.max(headerRow.length, subHeaderRow.length); i++) {
    const main = cleanHeaderCell(headerRow[i]);
    const sub = cleanHeaderCell(subHeaderRow[i]);

    if (main) lastMain = main;

    let label = '';
    if (main && sub) label = `${main} ${sub}`;
    else if (main && !sub) label = main;
    else if (!main && sub && lastMain) label = `${lastMain} ${sub}`;
    else if (!main && sub) label = sub;

    raw.push(label);
  }

  // Convert to safe SQL column names, dropping empty headers.
  const mapped = raw.map((h, idx) => ({ idx, header: h, col: slugifyColumnName(h) }));
  const kept = mapped.filter((m) => m.col);
  const uniqueCols = makeUnique(kept.map((m) => m.col));
  return kept.map((m, i) => ({
    colIndex: m.idx,
    header: m.header,
    colName: uniqueCols[i],
  }));
}

function findFirstDataRowIndex(rows, startIdx, srColIndex) {
  for (let i = startIdx; i < rows.length; i++) {
    const r = rows[i] || [];
    const sr = r[srColIndex];
    const nonEmptyCount = r.filter((c) => !isEmptyCell(c)).length;
    if (nonEmptyCount === 0) continue;
    if (looksNumeric(sr)) return i;
  }
  return -1;
}

function extractSheetDataset(sheetName, rows) {
  const headerIdx = findHeaderRowIndex(rows);
  if (headerIdx < 0) {
    return { sheetName, tableSuffix: sheetName, columns: [], data: [] };
  }

  const headerRow = rows[headerIdx] || [];
  const subHeaderRow = rows[headerIdx + 1] || [];

  // Locate SR column index in original sheet.
  const srColIndex = headerRow.findIndex((c) => cleanHeaderCell(c).toUpperCase().startsWith('SR'));
  if (srColIndex < 0) {
    throw new Error(`Could not find SR. NO. column in sheet: ${sheetName}`);
  }

  const columns = buildHeaders(headerRow, subHeaderRow);

  const firstDataIdx = findFirstDataRowIndex(rows, headerIdx + 2, srColIndex);
  if (firstDataIdx < 0) {
    return { sheetName, tableSuffix: sheetName, columns, data: [] };
  }

  const data = [];
  let emptyStreak = 0;

  for (let i = firstDataIdx; i < rows.length; i++) {
    const r = rows[i] || [];

    const nonEmptyCount = r.filter((c) => !isEmptyCell(c)).length;
    if (nonEmptyCount === 0) {
      emptyStreak++;
      if (emptyStreak >= 5) break;
      continue;
    }
    emptyStreak = 0;

    const sr = r[srColIndex];
    if (!looksNumeric(sr)) {
      // Skip totals/notes rows that don't have SR. NO.
      continue;
    }

    const rowObj = {};
    for (const c of columns) {
      rowObj[c.colName] = r[c.colIndex] ?? null;
    }
    data.push(rowObj);
  }

  return {
    sheetName,
    tableSuffix: sheetName,
    columns,
    data,
  };
}

function sanitizeTableName(prefix, sheetName) {
  const slug = slugifyColumnName(sheetName) || 'sheet';
  const name = `${prefix}${slug}`.toLowerCase();
  // MySQL limit is 64.
  return name.length > 64 ? name.slice(0, 64) : name;
}

async function ensureTable(pool, tableName, columnDefs, { recreate }) {
  if (recreate) {
    await pool.query(`DROP TABLE IF EXISTS \`${tableName}\``);
  }

  const colSql = columnDefs
    .map((c) => `\`${c.name}\` ${c.sqlType} NULL`)
    .join(',\n  ');

  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${tableName}\` (\n` +
      `  id INT NOT NULL AUTO_INCREMENT,\n` +
      (colSql ? `  ${colSql},\n` : '') +
      `  PRIMARY KEY (id)\n` +
      `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  // Add missing columns (non-destructive)
  const [existing] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  const existingSet = new Set(existing.map((r) => String(r.COLUMN_NAME)));

  for (const c of columnDefs) {
    if (!existingSet.has(c.name)) {
      await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${c.name}\` ${c.sqlType} NULL`);
    }
  }
}

async function truncateTable(pool, tableName) {
  // TRUNCATE is fast but may require extra privileges; DELETE is safer.
  await pool.query(`DELETE FROM \`${tableName}\``);
}

function convertValueForInsert(kind, value) {
  if (value === undefined) return null;
  if (value === null) return null;

  if (kind === 'date') {
    return toDateString(value);
  }

  if (kind === 'number') {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const n = toNumber(value);
      return n === null ? null : n;
    }
  }

  // default text
  if (typeof value === 'string') {
    const t = value.replace(/\u0000/g, '').trim();
    return t === '' ? null : t;
  }
  return String(value);
}

async function insertRows(pool, tableName, columnDefs, rows) {
  if (rows.length === 0) return { inserted: 0 };

  const cols = columnDefs.map((c) => c.name);
  const kindsByName = new Map(columnDefs.map((c) => [c.name, c.kind]));

  const batchSize = 250;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    const values = [];
    for (const r of batch) {
      for (const col of cols) {
        values.push(convertValueForInsert(kindsByName.get(col), r[col]));
      }
    }

    const placeholders = batch
      .map(() => `(${cols.map(() => '?').join(',')})`)
      .join(',');

    const sql = `INSERT INTO \`${tableName}\` (${cols.map((c) => `\`${c}\``).join(',')}) VALUES ${placeholders}`;
    await pool.query(sql, values);
    inserted += batch.length;
  }

  return { inserted };
}

async function main() {
  const args = parseArgs(process.argv);
  loadEnv();

  const filePath = path.resolve(process.cwd(), args.file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`XLSX file not found: ${args.file}`);
  }

  const wb = xlsx.readFile(filePath, { cellDates: true });

  const datasets = wb.SheetNames.map((sheetName) => {
    const ws = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    return extractSheetDataset(sheetName, rows);
  });

  for (const d of datasets) {
    console.log(`Sheet: ${d.sheetName} → rows: ${d.data.length}, columns: ${d.columns.length}`);
  }

  if (args.dryRun) {
    console.log('\nDry run only; no DB changes made.');
    return;
  }

  // Validate env only when we actually connect.
  const env = {
    DB_HOST: getRequiredEnv('DB_HOST'),
    DB_PORT: Number(process.env.DB_PORT || 3306),
    DB_NAME: getRequiredEnv('DB_NAME'),
    DB_USER: getRequiredEnv('DB_USER'),
    DB_PASSWORD: getRequiredEnv('DB_PASSWORD'),
    DB_SSL: process.env.DB_SSL === 'true',
  };

  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 5,
    namedPlaceholders: true,
    dateStrings: true,
    ...(env.DB_SSL && {
      ssl: {
        rejectUnauthorized: true,
      },
    }),
  });

  try {
    for (const d of datasets) {
      const tableName = sanitizeTableName(args.prefix, d.sheetName);

      // Infer types
      const columnDefs = d.columns.map((c) => {
        const values = d.data.map((r) => r[c.colName]);
        const inferred = inferColumnType(values);
        return { name: c.colName, sqlType: inferred.sqlType, kind: inferred.kind };
      });

      console.log(`\nPreparing table ${tableName}...`);
      await ensureTable(pool, tableName, columnDefs, { recreate: args.recreate });

      if (args.truncate) {
        console.log(`Truncating ${tableName}...`);
        await truncateTable(pool, tableName);
      }

      console.log(`Inserting ${d.data.length} rows into ${tableName}...`);
      const { inserted } = await insertRows(pool, tableName, columnDefs, d.data);
      console.log(`Inserted: ${inserted}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
