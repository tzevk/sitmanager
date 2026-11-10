/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { ensureNsdcColumns } from '@/lib/student-nsdc';

const SEARCH_FIELDS: Record<string, string> = {
  studentId: 'sm.Student_Id',
  batchCode: 'sm.Batch_Code',
  name: 'sm.Student_Name',
  email: 'sm.Email',
  mobile: 'sm.Present_Mobile',
};

function buildSearch(field: string, value: string) {
  if (!value) return { clause: '', params: [] as (string | number)[] };
  const like = `%${value}%`;
  const col = SEARCH_FIELDS[field];
  if (col) {
    if (field === 'studentId') return { clause: 'AND sm.Student_Id = ?', params: [Number(value) || 0] };
    return { clause: `AND ${col} LIKE ?`, params: [like] };
  }
  return {
    clause: `AND (sm.Student_Id = ? OR sm.Batch_Code LIKE ? OR sm.Student_Name LIKE ? OR sm.Email LIKE ? OR sm.Present_Mobile LIKE ?)`,
    params: [Number(value) || 0, like, like, like, like],
  };
}

const mobileKey = (v: unknown) => String(v ?? '').replace(/\D/g, '').slice(-10);
const textKey = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9@.]/g, '');

// Some people were admitted more than once into the same batch, so they have
// 2-3 student records. NSDC needs one row per candidate. Rows are merged only
// when mobile AND batch match AND the name or e-mail also matches, so two
// different people sharing a phone number are never merged. The kept row is
// the one marked Admitted (Status_id 8), otherwise the newest.
function dedupeCandidates(rows: any[]): any[] {
  const groups = new Map<string, any[]>();
  const out: any[] = [];
  for (const r of rows) {
    const m = mobileKey(r.Present_Mobile);
    if (m.length < 10 || /^(\d)\1+$/.test(m)) { out.push(r); continue; }
    const k = `${m}|${String(r.Batch_Code ?? '').trim()}`;
    const g = groups.get(k);
    if (g) g.push(r); else groups.set(k, [r]);
  }
  for (const g of groups.values()) {
    const kept: any[] = [];
    for (const r of g) {
      const same = kept.findIndex((k) =>
        (textKey(k.Student_Name) && textKey(k.Student_Name) === textKey(r.Student_Name)) ||
        (textKey(k.Email) && textKey(k.Email) === textKey(r.Email)));
      if (same < 0) { kept.push(r); continue; }
      const cur = kept[same];
      const better = (Number(r.Status_id) === 8) !== (Number(cur.Status_id) === 8)
        ? Number(r.Status_id) === 8
        : Number(r.Student_Id) > Number(cur.Student_Id);
      if (better) kept[same] = r;
    }
    out.push(...kept);
  }
  return out.sort((a, b) => Number(b.Student_Id) - Number(a.Student_Id));
}

function csvCell(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

// Encrypts the generated CSV into a genuine password-protected XLSX (AES-256,
// real OOXML/MS-OFFCRYPTO encryption — Excel prompts for the password on
// open). No JS library in this project can do this; `secure-spreadsheet`
// (github.com/ankane/secure-spreadsheet) is CLI-only even from its own docs,
// so it's invoked as a subprocess with the CSV piped over stdin.
function encryptCsvToXlsx(csv: string, password: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const bin = path.join(process.cwd(), 'node_modules', '.bin', 'secure-spreadsheet');
    const child = spawn(bin, ['--password', password], { stdio: ['pipe', 'pipe', 'pipe'] });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`secure-spreadsheet exited with code ${code}: ${Buffer.concat(stderr).toString('utf8')}`));
        return;
      }
      resolve(Buffer.concat(stdout));
    });

    child.stdin.write(csv);
    child.stdin.end();
  });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'student.view');
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => ({}));
    const password = typeof body?.password === 'string' ? body.password : '';
    const field = typeof body?.field === 'string' ? body.field.trim() : '';
    const search = typeof body?.search === 'string' ? body.search.trim() : '';

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const pool = getPool();
    await ensureNsdcColumns(pool);

    const { clause, params } = buildSearch(field, search);
    const [rows] = await pool.query<any[]>(
      `SELECT
         sm.Student_Id, sm.Student_Name, sm.Father_Name, sm.Mother_Name, sm.Sex, sm.DOB,
         sm.Aadhar_Number, sm.Social_Category, sm.Present_Mobile, sm.Email,
         sm.Present_Address, sm.Present_City, sm.Present_State, sm.Present_Pin,
         sm.Qualification, sm.Batch_Code, sm.Status_id, c.Course_Name
       FROM student_master sm
       -- Admitted students only, one row each (same rule as the student list).
       -- Without this, enquiry-stage rows for the same person were exported too,
       -- so each candidate appeared 2-3 times (ticket 86).
       JOIN (
         SELECT DISTINCT Student_Id
         FROM admission_master
         WHERE IsDelete = 0 AND IsActive = 1
       ) adm ON adm.Student_Id = sm.Student_Id
       LEFT JOIN course_mst c ON c.Course_Id = sm.Course_Id
       WHERE (sm.IsDelete = 0 OR sm.IsDelete IS NULL) ${clause}
       ORDER BY sm.Student_Id DESC
       LIMIT 5000`,
      params
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No matching students to export' }, { status: 404 });
    }

    const headers = [
      'Student Id', 'Candidate Name', "Father's Name", "Mother's Name", 'Gender', 'DOB',
      'Aadhar Number', 'Category', 'Mobile', 'Email', 'Address', 'City', 'State', 'Pincode',
      'Qualification', 'Course', 'Batch Code',
    ];
    const csvLines = [headers.map(csvCell).join(',')];
    for (const r of dedupeCandidates(rows)) {
      csvLines.push([
        r.Student_Id, r.Student_Name, r.Father_Name, r.Mother_Name, r.Sex, r.DOB,
        r.Aadhar_Number, r.Social_Category, r.Present_Mobile, r.Email,
        r.Present_Address, r.Present_City, r.Present_State, r.Present_Pin,
        r.Qualification, r.Course_Name, r.Batch_Code,
      ].map(csvCell).join(','));
    }

    const xlsxBuffer = await encryptCsvToXlsx(csvLines.join('\n'), password);

    return new NextResponse(new Uint8Array(xlsxBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="nsdc-candidate-format-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate NSDC export';
    console.error('NSDC export error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
