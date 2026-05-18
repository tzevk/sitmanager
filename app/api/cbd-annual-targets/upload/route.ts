/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { ensureTable } from '../route';

/* ── Normalise a header string for loose matching ── */
function norm(s: unknown): string {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/* ── Pick column index by keyword priority ── */
function findCol(headers: string[], ...keywords: string[]): number {
  for (const kw of keywords) {
    const i = headers.findIndex(h => norm(h).includes(kw));
    if (i !== -1) return i;
  }
  return -1;
}

function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'finance.create');
  if (auth instanceof NextResponse) return auth;

  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer   = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    /* find the header row (first row that has at least 2 non-empty cells) */
    const headerRowIdx = raw.findIndex(r => r.filter(Boolean).length >= 2);
    if (headerRowIdx === -1) {
      return NextResponse.json({ error: 'Could not detect a header row' }, { status: 422 });
    }

    const headers = raw[headerRowIdx].map(String);
    const dataRows = raw.slice(headerRowIdx + 1).filter(r => r.some(Boolean));

    const colName  = findCol(headers, 'training', 'course', 'programme', 'program');
    const colFreq  = findCol(headers, 'frequency', 'freq', 'batches', 'noofbatch');
    const colTgt   = findCol(headers, 'targetstudent', 'target');
    const colAdm   = findCol(headers, 'admitted', 'actual', 'achieved', 'studentsadmit');

    if (colName === -1) {
      return NextResponse.json(
        { error: 'Cannot find a Training/Course Name column. Expected a header containing "Training", "Course", or "Programme".' },
        { status: 422 },
      );
    }

    const rows = dataRows
      .map(r => ({
        training_name:     String(r[colName] ?? '').trim(),
        target_frequency:  colFreq  !== -1 ? toInt(r[colFreq])  : 0,
        target_students:   colTgt   !== -1 ? toInt(r[colTgt])   : 0,
        students_admitted: colAdm   !== -1 ? toInt(r[colAdm])   : 0,
      }))
      .filter(r => r.training_name);

    if (!rows.length) {
      return NextResponse.json({ error: 'No data rows found after the header' }, { status: 422 });
    }

    const pool = getPool();
    await ensureTable();

    /* Replace all existing data with the new upload */
    await pool.query(`DELETE FROM cbd_annual_targets`);
    await pool.query(
      `INSERT INTO cbd_annual_targets (training_name, target_frequency, target_students, students_admitted)
       VALUES ?`,
      [rows.map(r => [r.training_name, r.target_frequency, r.target_students, r.students_admitted])],
    );

    return NextResponse.json(
      { ok: true, inserted: rows.length },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
