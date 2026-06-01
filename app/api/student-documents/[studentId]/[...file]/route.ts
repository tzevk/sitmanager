/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { createReadStream, statSync } from 'fs';
import { join, basename } from 'path';
import { Readable } from 'stream';

function getUploadsRoot(): string {
  const dir = process.env.UPLOADS_DIR?.trim();
  if (!dir) throw new Error('UPLOADS_DIR is not set. Run scripts/db/migrate-student-documents.mjs first.');
  return dir;
}

function mimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return map[ext] ?? 'application/octet-stream';
}

function tryStatFile(p: string): { size: number } | null {
  try { return statSync(p); } catch { return null; }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string; file: string[] }> }
) {
  try {
    const auth = await requirePermission(req, 'student.view');
    if (auth instanceof NextResponse) return auth;

    const { studentId, file: fileParts } = await params;

    const safeStudentId = studentId.replace(/[^a-zA-Z0-9_-]/g, '');
    const rawPath = fileParts.join('/');
    const fileBasename = basename(rawPath);

    if (!safeStudentId || !fileBasename || fileBasename.startsWith('.')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Verify the document belongs to this student.
    // Try exact match first, then basename match for legacy paths stored with a prefix.
    const pool = getPool();
    let matchedUploadImage: string | null = null;

    const [exactRows] = await pool.query<any[]>(
      `SELECT upload_image FROM documents WHERE Student_id = ? AND upload_image = ? LIMIT 1`,
      [safeStudentId, rawPath]
    );
    if ((exactRows as any[]).length) {
      matchedUploadImage = (exactRows as any[])[0].upload_image;
    } else {
      const [basenameRows] = await pool.query<any[]>(
        `SELECT upload_image FROM documents WHERE Student_id = ? AND (upload_image = ? OR upload_image LIKE ?) LIMIT 1`,
        [safeStudentId, fileBasename, `%/${fileBasename}`]
      );
      if ((basenameRows as any[]).length) {
        matchedUploadImage = (basenameRows as any[])[0].upload_image;
      }
    }

    if (!matchedUploadImage) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    let uploadsRoot: string;
    try {
      uploadsRoot = getUploadsRoot();
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }

    // Try candidate paths: per-student subdirectory, then flat
    const candidates = [
      join(uploadsRoot, safeStudentId, fileBasename),
      join(uploadsRoot, fileBasename),
      join(uploadsRoot, matchedUploadImage),
      join(uploadsRoot, safeStudentId, matchedUploadImage),
    ];

    let filePath: string | null = null;
    let stat: { size: number } | null = null;
    for (const candidate of candidates) {
      const s = tryStatFile(candidate);
      if (s) { filePath = candidate; stat = s; break; }
    }

    if (!filePath || !stat) {
      return NextResponse.json({ error: 'File not found on server' }, { status: 404 });
    }

    const stream = createReadStream(filePath);
    const nodeReadable = Readable.from(stream);
    const webStream = new ReadableStream({
      start(controller) {
        nodeReadable.on('data', (chunk) => controller.enqueue(chunk));
        nodeReadable.on('end', () => controller.close());
        nodeReadable.on('error', (err) => controller.error(err));
      },
    });

    return new Response(webStream, {
      headers: {
        'Content-Type': mimeType(fileBasename),
        'Content-Length': String(stat.size),
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': `inline; filename="${fileBasename}"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Student document GET error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
