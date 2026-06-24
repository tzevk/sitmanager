/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { basename } from 'path';
import { readStorageFile } from '@/lib/storage-api';
import { ensureDocumentBlobColumns } from '@/lib/student-documents.server';

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
    await ensureDocumentBlobColumns(pool);
    let matchedUploadImage: string | null = null;
    let matchedRow: { File_Data?: Buffer | null; Content_Type?: string | null } | null = null;

    const [exactRows] = await pool.query<any[]>(
      `SELECT upload_image, File_Data, Content_Type FROM documents WHERE Student_id = ? AND upload_image = ? LIMIT 1`,
      [safeStudentId, rawPath]
    );
    if ((exactRows as any[]).length) {
      matchedUploadImage = (exactRows as any[])[0].upload_image;
      matchedRow = (exactRows as any[])[0];
    } else {
      const [basenameRows] = await pool.query<any[]>(
        `SELECT upload_image, File_Data, Content_Type FROM documents WHERE Student_id = ? AND (upload_image = ? OR upload_image LIKE ?) LIMIT 1`,
        [safeStudentId, fileBasename, `%/${fileBasename}`]
      );
      if ((basenameRows as any[]).length) {
        matchedUploadImage = (basenameRows as any[])[0].upload_image;
        matchedRow = (basenameRows as any[])[0];
      }
    }

    if (!matchedUploadImage) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Preferred path: the file bytes are stored directly in the DB.
    if (matchedRow?.File_Data) {
      const data = Buffer.from(matchedRow.File_Data);
      return new Response(new Uint8Array(data), {
        headers: {
          'Content-Type': matchedRow.Content_Type || 'application/octet-stream',
          'Cache-Control': 'private, max-age=3600',
          'Content-Disposition': `inline; filename="${fileBasename}"`,
          'Content-Length': String(data.length),
        },
      });
    }

    // Legacy fallback: older documents whose bytes still live on the file store.
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
