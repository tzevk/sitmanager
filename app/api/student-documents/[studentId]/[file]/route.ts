/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { createReadStream, statSync } from 'fs';
import { join, basename } from 'path';
import { Readable } from 'stream';

// Derive the uploads root: appp.js stores at __dirname/../uploads/student_document/
// In development/production, process.cwd() = sitmanager project root
// So ../uploads resolves to the sibling uploads folder
const UPLOADS_ROOT =
  process.env.UPLOADS_DIR ||
  join(process.cwd(), '..', 'uploads', 'student_document');

function mimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return map[ext] ?? 'application/octet-stream';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string; file: string }> }
) {
  try {
    const auth = await requirePermission(req, 'student.view');
    if (auth instanceof NextResponse) return auth;

    const { studentId, file } = await params;

    // Sanitize: only allow safe filename characters, no path traversal
    const safeStudentId = studentId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeFile = basename(file); // strip any directory components

    if (!safeStudentId || !safeFile || safeFile.startsWith('.')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Verify the document belongs to this student in the DB
    const pool = getPool();
    const [rows] = await pool.query<any[]>(
      `SELECT id FROM documents WHERE Student_id = ? AND upload_image = ? LIMIT 1`,
      [safeStudentId, safeFile]
    );
    if (!rows.length) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const filePath = join(UPLOADS_ROOT, safeStudentId, safeFile);

    let stat;
    try {
      stat = statSync(filePath);
    } catch {
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
        'Content-Type': mimeType(safeFile),
        'Content-Length': String(stat.size),
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': `inline; filename="${safeFile}"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Student document GET error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
