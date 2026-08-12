import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

// NSDC's exact candidate_upload column template isn't known in advance, so this
// stores whatever columns the uploaded sheet actually has (per-row JSON) rather
// than assuming a fixed schema — the header row drives the preview/export shape.
async function ensureTables() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS nsdc_candidate_upload_batch (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source_filename VARCHAR(255) NOT NULL,
      row_count INT NOT NULL DEFAULT 0,
      columns_json JSON NOT NULL,
      uploaded_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS nsdc_candidate_upload (
      id INT AUTO_INCREMENT PRIMARY KEY,
      batch_id INT NOT NULL,
      row_index INT NOT NULL,
      row_data JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_nsdc_batch (batch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'nsdc_format.view');
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureTables();
    const pool = getPool();
    const batchId = req.nextUrl.searchParams.get('batchId');

    if (batchId) {
      const [rows]: any = await pool.query(
        `SELECT id, row_index, row_data FROM nsdc_candidate_upload WHERE batch_id = ? ORDER BY row_index ASC LIMIT 2000`,
        [Number(batchId)]
      );
      const [[batch]]: any = await pool.query(
        `SELECT id, source_filename, row_count, columns_json, created_at FROM nsdc_candidate_upload_batch WHERE id = ?`,
        [Number(batchId)]
      );
      return NextResponse.json({
        batch: batch ? { ...batch, columns_json: JSON.parse(batch.columns_json || '[]') } : null,
        rows: rows.map((r: any) => ({ ...r, row_data: JSON.parse(r.row_data || '{}') })),
      });
    }

    const [batches]: any = await pool.query(
      `SELECT id, source_filename, row_count, columns_json, uploaded_by, created_at
       FROM nsdc_candidate_upload_batch ORDER BY id DESC LIMIT 25`
    );
    const batchesParsed = batches.map((b: any) => ({ ...b, columns_json: JSON.parse(b.columns_json || '[]') }));
    return NextResponse.json({ batches: batchesParsed });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load NSDC uploads';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'nsdc_format.create');
  if (auth instanceof NextResponse) return auth;

  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    const headerRowIdx = raw.findIndex((r) => r.filter(Boolean).length >= 2);
    if (headerRowIdx === -1) {
      return NextResponse.json({ error: 'Could not detect a header row in the uploaded sheet' }, { status: 422 });
    }

    const headers = raw[headerRowIdx].map((h) => String(h ?? '').trim());
    const dataRows = raw.slice(headerRowIdx + 1).filter((r) => r.some((cell) => String(cell ?? '').trim() !== ''));

    if (dataRows.length === 0) {
      return NextResponse.json({ error: 'No data rows found after the header' }, { status: 422 });
    }
    if (dataRows.length > 5000) {
      return NextResponse.json({ error: 'Too many rows in one upload (max 5000) — split into batches' }, { status: 422 });
    }

    const rows = dataRows.map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (!h) return;
        const cell = r[i];
        obj[h] = cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell ?? '').trim();
      });
      return obj;
    });

    await ensureTables();
    const pool = getPool();

    const [batchResult]: any = await pool.query(
      `INSERT INTO nsdc_candidate_upload_batch (source_filename, row_count, columns_json, uploaded_by)
       VALUES (?, ?, ?, ?)`,
      [file.name || 'upload.xlsx', rows.length, JSON.stringify(headers.filter(Boolean)), auth.session.userId]
    );
    const batchId = batchResult.insertId as number;

    await pool.query(
      `INSERT INTO nsdc_candidate_upload (batch_id, row_index, row_data) VALUES ?`,
      [rows.map((row, idx) => [batchId, idx, JSON.stringify(row)])]
    );

    return NextResponse.json({
      ok: true,
      batchId,
      rowCount: rows.length,
      columns: headers.filter(Boolean),
      preview: rows.slice(0, 20),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process NSDC upload';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
