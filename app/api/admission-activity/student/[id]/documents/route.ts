/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { extname } from 'path';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { writeStorageFile } from '@/lib/storage-api';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

function sanitize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'file';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'student.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { id } = await params;

    const [rows] = await pool.query<any[]>(
      `SELECT id, doc_name, upload_image FROM documents WHERE Student_id = ? ORDER BY id ASC`,
      [id]
    );

    return NextResponse.json({ documents: rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Student documents GET error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'student.update');
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const formData = await req.formData();
    const file = formData.get('file');
    const docName = String(formData.get('doc_name') || '').trim() || 'Document';

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type. Use PDF, JPG, PNG, or WebP.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5 MB.' }, { status: 400 });
    }

    const ext = extname(file.name || '').toLowerCase() || (file.type === 'application/pdf' ? '.pdf' : '.jpg');
    const filename = `${sanitize(docName)}-${Date.now()}${ext}`;
    const bytes = await file.arrayBuffer();
    await writeStorageFile(`${id}/${filename}`, Buffer.from(bytes));

    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO documents (upload_image, doc_name, Student_id) VALUES (?, ?, ?)`,
      [filename, docName, id]
    ) as [any, any];

    return NextResponse.json({
      document: { id: result.insertId, doc_name: docName, upload_image: filename },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Student documents POST error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
