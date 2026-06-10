/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { basename } from 'path';
import { readStorageFile } from '@/lib/storage-api';

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

    const candidates = [
      `${safeStudentId}/${fileBasename}`,
      fileBasename,
      matchedUploadImage,
      `${safeStudentId}/${matchedUploadImage}`,
    ];

    let file: Awaited<ReturnType<typeof readStorageFile>> = null;
    try {
      for (const candidate of candidates) {
        file = await readStorageFile(candidate);
        if (file) break;
      }
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }

    if (!file) {
      return NextResponse.json({ error: 'File not found on server' }, { status: 404 });
    }

    const headers: Record<string, string> = {
      'Content-Type': file.contentType,
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': `inline; filename="${fileBasename}"`,
    };
    if (file.contentLength) headers['Content-Length'] = file.contentLength;

    return new Response(file.body, { headers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Student document GET error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
