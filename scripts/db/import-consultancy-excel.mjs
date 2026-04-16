#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import xlsx from 'xlsx';

function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) dotenv.config({ path: p });
  }
}

function getRequiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function parseArgs(argv) {
  const out = {
    file: 'public/offshore.xlsx',
    sheet: '',
    dryRun: false,
    updateExisting: true,
    limit: 0,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--file' && argv[i + 1]) out.file = argv[++i];
    else if (a === '--sheet' && argv[i + 1]) out.sheet = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--no-update-existing') out.updateExisting = false;
    else if (a === '--limit' && argv[i + 1]) out.limit = Math.max(0, Number(argv[++i]) || 0);
    else if (a === '--help' || a === '-h') {
      console.log(
        [
          'Usage:',
          '  node scripts/db/import-consultancy-excel.mjs --file public/offshore.xlsx [--sheet "Sheet1"] [--dry-run] [--no-update-existing] [--limit 100]',
          '',
          'Imports consultancy/company rows into consultant_mst.',
          'Required env: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD',
        ].join('\n')
      );
      process.exit(0);
    }
  }

  return out;
}

function clean(v) {
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}

function slug(v) {
  return clean(v)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toDateOnly(v) {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const s = clean(v);
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const dd = String(Number(dmy[1])).padStart(2, '0');
    const mm = String(Number(dmy[2])).padStart(2, '0');
    return `${dmy[3]}-${mm}-${dd}`;
  }

  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return null;
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    const s = clean(v);
    if (s) return s;
  }
  return '';
}

function extractEmail(text) {
  const s = clean(text);
  if (!s) return '';
  const m = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : '';
}

function hasDataRow(arr) {
  return arr.some((v) => clean(v) !== '');
}

function pickSheet(wb, requested) {
  if (!requested) return wb.SheetNames[0];
  const exact = wb.SheetNames.find((n) => n === requested);
  if (exact) return exact;
  const ci = wb.SheetNames.find((n) => n.toLowerCase() === requested.toLowerCase());
  return ci || wb.SheetNames[0];
}

function detectHeaderIndex(rows) {
  for (let i = 0; i < Math.min(rows.length, 20); i += 1) {
    const row = rows[i].map((c) => slug(c));
    if (
      row.includes('company_name') ||
      row.includes('name') ||
      row.includes('created_date') ||
      row.includes('sr_no') ||
      row.includes('sr_no_')
    ) {
      return i;
    }
  }
  return 0;
}

function buildHeaders(rows, headerIdx) {
  const h1 = rows[headerIdx] || [];
  const h2 = rows[headerIdx + 1] || [];

  const h2Useful = h2.some((v) => {
    const s = slug(v);
    return ['name', 'designation', 'contact_no', 'email_id', 'follow_up_1'].includes(s);
  });

  const headers = [];
  const maxLen = Math.max(h1.length, h2.length);
  for (let c = 0; c < maxLen; c += 1) {
    const a = slug(h1[c]);
    const b = slug(h2[c]);
    let k = '';

    if (h2Useful) {
      if (a && b) k = `${a}_${b}`;
      else k = a || b;
    } else {
      k = a;
    }

    headers.push(k || `col_${c + 1}`);
  }

  return { headers, dataStart: headerIdx + (h2Useful ? 2 : 1) };
}

function rowToObject(headers, row) {
  const obj = {};
  for (let i = 0; i < headers.length; i += 1) obj[headers[i]] = row[i] ?? '';
  return obj;
}

function mapConsultancy(obj) {
  const companyName = firstNonEmpty(obj.company_name, obj.name, obj.send_email_details, obj.col_2);
  const contactPerson = firstNonEmpty(
    obj.contact_person_name,
    obj.company_authority_details_name,
    obj.company_authority,
    obj.company_authority_details,
    obj.col_3
  );
  const designation = firstNonEmpty(obj.company_authority_details_designation, obj.designation);

  const contactNo = firstNonEmpty(obj.contact_no, obj.contact_details, obj.company_authority_details_contact_no, obj.mobile, obj.tel);
  const email = firstNonEmpty(
    obj.email_id,
    extractEmail(obj.company_website_email),
    extractEmail(obj.company_authority),
    extractEmail(obj.company_authority_details_email_id),
    extractEmail(obj.remarks_and_discussion)
  );

  const address = firstNonEmpty(obj.address, obj.location, obj.col_4, 'Not Provided');
  const remark = firstNonEmpty(obj.remarks_and_discussion, obj.discussion, obj.follow_up_1, obj.col_8);
  const purpose = firstNonEmpty(obj.company_nature_of_business, obj.new_existing);
  const dateAdded = toDateOnly(firstNonEmpty(obj.created_date, obj.send_email_date, obj.calling_date));

  return {
    Comp_Name: clean(companyName),
    Contact_Person: clean(contactPerson),
    Designation: clean(designation),
    Address: clean(address),
    Tel: clean(contactNo),
    Mobile: clean(contactNo),
    EMail: clean(email),
    Date_Added: dateAdded,
    Purpose: clean(purpose),
    Remark: clean(remark),
  };
}

async function hasCompanyTypeColumn(pool) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'consultant_mst'
       AND COLUMN_NAME = 'Company_Type'`
  );
  return Number(rows?.[0]?.cnt || 0) > 0;
}

async function getColumnLimits(pool) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'consultant_mst'`
  );

  const limits = new Map();
  for (const r of rows || []) {
    const name = String(r.COLUMN_NAME || '');
    const len = r.CHARACTER_MAXIMUM_LENGTH == null ? null : Number(r.CHARACTER_MAXIMUM_LENGTH);
    limits.set(name, Number.isFinite(len) ? len : null);
  }
  return limits;
}

function applyFieldLimits(rec, limits) {
  const out = { ...rec };
  const fields = [
    'Comp_Name',
    'Contact_Person',
    'Designation',
    'Address',
    'Tel',
    'Mobile',
    'EMail',
    'Purpose',
    'Remark',
  ];

  for (const f of fields) {
    const max = limits.get(f);
    if (!max || typeof max !== 'number') continue;
    const value = clean(out[f]);
    out[f] = value.length > max ? value.slice(0, max) : value;
  }

  return out;
}

async function insertOrUpdate(pool, rec, updateExisting, hasCompanyType) {
  const [existing] = await pool.query(
    `SELECT Const_Id FROM consultant_mst
     WHERE LOWER(TRIM(COALESCE(Comp_Name, ''))) = LOWER(TRIM(?))
       AND (IsDelete = 0 OR IsDelete IS NULL)
     ORDER BY Const_Id DESC
     LIMIT 1`,
    [rec.Comp_Name]
  );

  if ((existing || []).length > 0) {
    if (!updateExisting) return { action: 'skipped', id: Number(existing[0].Const_Id) };

    const setParts = [
      'Contact_Person = COALESCE(NULLIF(?, \"\"), Contact_Person)',
      'Designation = COALESCE(NULLIF(?, \"\"), Designation)',
      'Address = COALESCE(NULLIF(?, \"\"), Address)',
      'Tel = COALESCE(NULLIF(?, \"\"), Tel)',
      'Mobile = COALESCE(NULLIF(?, \"\"), Mobile)',
      'EMail = COALESCE(NULLIF(?, \"\"), EMail)',
      'Date_Added = COALESCE(?, Date_Added)',
      'Purpose = COALESCE(NULLIF(?, \"\"), Purpose)',
      'Remark = COALESCE(NULLIF(?, \"\"), Remark)',
    ];

    const values = [
      rec.Contact_Person,
      rec.Designation,
      rec.Address,
      rec.Tel,
      rec.Mobile,
      rec.EMail,
      rec.Date_Added,
      rec.Purpose,
      rec.Remark,
    ];

    if (hasCompanyType) {
      setParts.push('Company_Type = COALESCE(NULLIF(?, \"\"), Company_Type)');
      values.push('International');
    }

    values.push(existing[0].Const_Id);

    await pool.query(
      `UPDATE consultant_mst SET ${setParts.join(', ')} WHERE Const_Id = ?`,
      values
    );

    return { action: 'updated', id: Number(existing[0].Const_Id) };
  }

  const cols = [
    'Comp_Name', 'Contact_Person', 'Designation', 'Address', 'Tel', 'Mobile', 'EMail',
    'Date_Added', 'Purpose', 'Remark',
  ];
  const vals = [
    rec.Comp_Name,
    rec.Contact_Person || null,
    rec.Designation || null,
    rec.Address,
    rec.Tel || null,
    rec.Mobile || null,
    rec.EMail || null,
    rec.Date_Added || null,
    rec.Purpose || null,
    rec.Remark || null,
  ];

  if (hasCompanyType) {
    cols.push('Company_Type');
    vals.push('International');
  }

  cols.push('IsActive', 'IsDelete');
  vals.push(1, 0);

  const [result] = await pool.query(
    `INSERT INTO consultant_mst (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    vals
  );

  return { action: 'inserted', id: Number(result.insertId || 0) };
}

async function main() {
  const args = parseArgs(process.argv);
  loadEnv();

  const filePath = path.resolve(args.file);
  if (!fs.existsSync(filePath)) throw new Error(`Excel file not found: ${filePath}`);

  const wb = xlsx.readFile(filePath, { cellDates: true });
  const sheetName = pickSheet(wb, args.sheet);
  const ws = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const headerIdx = detectHeaderIndex(rows);
  const { headers, dataStart } = buildHeaders(rows, headerIdx);

  const records = [];
  for (let i = dataStart; i < rows.length; i += 1) {
    const row = rows[i] || [];
    if (!hasDataRow(row)) continue;

    const obj = rowToObject(headers, row);
    const mapped = mapConsultancy(obj);
    if (!mapped.Comp_Name) continue;

    records.push(mapped);
    if (args.limit > 0 && records.length >= args.limit) break;
  }

  if (!records.length) {
    throw new Error('No valid consultancy rows found in sheet.');
  }

  console.log(`File: ${filePath}`);
  console.log(`Sheet: ${sheetName}`);
  console.log(`Rows prepared: ${records.length}`);

  if (args.dryRun) {
    console.log('Dry run enabled. Sample mapped rows:');
    console.table(records.slice(0, 5));
    return;
  }

  const pool = mysql.createPool({
    host: getRequiredEnv('DB_HOST'),
    port: Number(process.env.DB_PORT || 3306),
    user: getRequiredEnv('DB_USER'),
    password: getRequiredEnv('DB_PASSWORD'),
    database: getRequiredEnv('DB_NAME'),
    waitForConnections: true,
    connectionLimit: 4,
    dateStrings: true,
  });

  try {
    const hasType = await hasCompanyTypeColumn(pool);
    const limits = await getColumnLimits(pool);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const rec of records) {
      const bounded = applyFieldLimits(rec, limits);
      const res = await insertOrUpdate(pool, bounded, args.updateExisting, hasType);
      if (res.action === 'inserted') inserted += 1;
      else if (res.action === 'updated') updated += 1;
      else skipped += 1;
    }

    console.log(`Done. inserted=${inserted}, updated=${updated}, skipped=${skipped}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('import-consultancy-excel failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
