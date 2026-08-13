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
         sm.Student_Id, sm.Student_Name, sm.Father_Name, sm.Sex, sm.DOB,
         sm.Aadhar_Number, sm.Social_Category, sm.Present_Mobile, sm.Email,
         sm.Present_Address, sm.Present_City, sm.Present_State, sm.Present_Pin,
         sm.Qualification, sm.Batch_Code, c.Course_Name
       FROM student_master sm
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
      'Student Id', 'Candidate Name', "Father's Name", 'Gender', 'DOB',
      'Aadhar Number', 'Category', 'Mobile', 'Email', 'Address', 'City', 'State', 'Pincode',
      'Qualification', 'Course', 'Batch Code',
    ];
    const csvLines = [headers.map(csvCell).join(',')];
    for (const r of rows) {
      csvLines.push([
        r.Student_Id, r.Student_Name, r.Father_Name, r.Sex, r.DOB,
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
