#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import xlsx from 'xlsx';

dotenv.config({ path: '.env.local' });

function parseArgs(argv) {
  const opts = {
    file: 'public/standard.xlsx',
    batch: '08066',
    replace: true,
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--file') opts.file = argv[++i];
    else if (a === '--batch') opts.batch = argv[++i];
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--no-replace') opts.replace = false;
    else if (a === '--replace') opts.replace = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/db/import-standard-xlsx.mjs [--file public/standard.xlsx] [--batch 08066] [--replace|--no-replace] [--dry-run]');
      process.exit(0);
    }
  }

  return opts;
}

function normHeader(v) {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toDateOnly(v) {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const yyyy = v.getFullYear();
    const mm = String(v.getMonth() + 1).padStart(2, '0');
    const dd = String(v.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const dd = String(m[1]).padStart(2, '0');
    const mm = String(m[2]).padStart(2, '0');
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function toTime(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const totalSeconds = Math.round(v * 24 * 60 * 60);
    const hh = String(Math.floor(totalSeconds / 3600) % 24).padStart(2, '0');
    const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    return `${hh}:${mm}:00`;
  }
  const s = String(v).trim();
  if (!s) return null;

  const ampm = s.match(/^(\d{1,2}):(\d{2})\s*([aApP][mM])$/);
  if (ampm) {
    let hh = Number(ampm[1]);
    const mm = ampm[2];
    const ap = ampm[3].toLowerCase();
    if (ap === 'pm' && hh < 12) hh += 12;
    if (ap === 'am' && hh === 12) hh = 0;
    return `${String(hh).padStart(2, '0')}:${mm}:00`;
  }

  const t24 = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (t24) {
    const hh = String(Number(t24[1])).padStart(2, '0');
    const mm = t24[2];
    const ss = t24[3] || '00';
    return `${hh}:${mm}:${ss}`;
  }

  return null;
}

function strOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function readRows(filePath) {
  const wb = xlsx.readFile(filePath, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  if (!grid.length) return [];

  const headers = grid[0].map(normHeader);
  const rows = [];

  for (let i = 1; i < grid.length; i += 1) {
    const arr = grid[i];
    const row = {};
    for (let c = 0; c < headers.length; c += 1) row[headers[c]] = arr[c] ?? null;

    const lectureNo = row.lecture_no == null || row.lecture_no === '' ? null : Number(row.lecture_no);
    const subject = strOrNull(row.subject);
    const subjectTopic = strOrNull(row.sub_topic ?? row.subject_topic);

    if (!lectureNo && !subject && !subjectTopic) continue;

    rows.push({
      lecture_no: Number.isFinite(lectureNo) ? lectureNo : null,
      lectureday: strOrNull(row.day),
      date: toDateOnly(row.date),
      module: strOrNull(row.module),
      department: strOrNull(row.department),
      subject,
      subject_topic: subjectTopic,
      starttime: toTime(row.start_time),
      endtime: toTime(row.end_time),
      assignment: strOrNull(row.assignment),
      assignment_date: toDateOnly(row.assignment_date),
      unit_test: strOrNull(row.unit_test),
      faculty_name: strOrNull(row.faculty_name),
      status: strOrNull(row.status),
      duration: strOrNull(row.duration),
      class_room: strOrNull(row.class_room),
      documents: strOrNull(row.documents),
      publish: strOrNull(row.publish) || 'No',
      lecturecontent: subject,
    });
  }

  return rows;
}

async function resolveBatch(pool, batchInput) {
  const trimmed = String(batchInput).trim();
  const noLead = trimmed.replace(/^0+/, '') || '0';

  const [rows] = await pool.query(
    `SELECT Batch_Id, Batch_code
     FROM batch_mst
     WHERE CAST(Batch_code AS CHAR) = ?
        OR LPAD(CAST(Batch_code AS CHAR), 5, '0') = ?
        OR CAST(Batch_Id AS CHAR) = ?
        OR CAST(Batch_Id AS CHAR) = ?
     ORDER BY Batch_Id DESC
     LIMIT 1`,
    [trimmed, trimmed, trimmed, noLead]
  );

  return rows[0] || null;
}

async function main() {
  const opts = parseArgs(process.argv);
  const filePath = path.resolve(opts.file);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 3,
    dateStrings: true,
  });

  try {
    const batch = await resolveBatch(pool, opts.batch);
    if (!batch) throw new Error(`Batch not found for input: ${opts.batch}`);

    const parsedRows = readRows(filePath);
    if (!parsedRows.length) throw new Error('No data rows found in workbook');
    const batchIdKey = String(batch.Batch_Id);

    const [existing] = await pool.query(
      `SELECT COUNT(*) AS c
       FROM batch_slecture_master
       WHERE CAST(batch_id AS CHAR) = ? AND (deleted IS NULL OR TRIM(CAST(deleted AS CHAR)) IN ('', '0'))`,
      [batchIdKey]
    );

    console.log(`Batch resolved: Batch_Id=${batch.Batch_Id}, Batch_code=${batch.Batch_code}`);
    console.log(`Excel rows parsed: ${parsedRows.length}`);
    console.log(`Existing active rows: ${existing[0].c}`);
    console.log(`Mode: ${opts.replace ? 'replace-existing' : 'append'}`);

    if (opts.dryRun) {
      console.log('Dry run enabled. No DB changes made.');
      return;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      if (opts.replace) {
        await conn.query(
          `UPDATE batch_slecture_master
           SET deleted = '1', updated_date = NOW()
           WHERE CAST(batch_id AS CHAR) = ?`,
          [batchIdKey]
        );
      }

      const insertSql = `
        INSERT INTO batch_slecture_master
        (batch_id, lecture_no, subject, subject_topic, date, lectureday, starttime, endtime,
         assignment, assignment_date, faculty_name, duration, class_room, documents,
         unit_test, publish, module, department, lecturecontent, status, deleted, created_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '0', NOW())
      `;

      for (let i = 0; i < parsedRows.length; i += 1) {
        const r = parsedRows[i];
        try {
          await conn.query(insertSql, [
            batchIdKey,
            r.lecture_no,
            r.subject,
            r.subject_topic,
            r.date,
            r.lectureday,
            r.starttime,
            r.endtime,
            r.assignment,
            r.assignment_date,
            r.faculty_name,
            r.duration,
            r.class_room,
            r.documents,
            r.unit_test,
            r.publish,
            r.module,
            r.department,
            r.lecturecontent,
            r.status,
          ]);
        } catch (e) {
          const info = {
            rowIndex: i + 2,
            lecture_no: r.lecture_no,
            subject: r.subject,
            module: r.module,
            department: r.department,
            duration: r.duration,
          };
          throw new Error(
            `Insert failed at Excel row ${info.rowIndex}: ${e.message}; row=${JSON.stringify(info)}`,
            { cause: e }
          );
        }
      }

      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    const [after] = await pool.query(
      `SELECT COUNT(*) AS c
       FROM batch_slecture_master
       WHERE CAST(batch_id AS CHAR) = ? AND (deleted IS NULL OR TRIM(CAST(deleted AS CHAR)) IN ('', '0'))`,
      [batchIdKey]
    );

    console.log(`Import complete. Active rows now: ${after[0].c}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Import failed:', err?.message || err);
  if (err?.code || err?.sqlMessage || err?.sql) {
    console.error({
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState,
      sqlMessage: err.sqlMessage,
      sql: err.sql,
    });
  }
  if (err?.cause) {
    console.error('Cause:', err.cause);
  }
  process.exit(1);
});
