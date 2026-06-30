/* eslint-disable @typescript-eslint/no-explicit-any */
import { extname } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { ensureDocumentBlobColumns, saveStudentPhotoBlob } from '@/lib/student-documents.server';

export const runtime = 'nodejs';

const MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DOCUMENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const VISIBLE_BATCH_SQL = `
  (b.IsDelete = 0 OR b.IsDelete IS NULL)
  AND (b.Cancel IS NULL OR b.Cancel = 0)
`;

function sanitize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'file';
}

function toInt(value: FormDataEntryValue | null): number | null {
  const parsed = Number(String(value || ''));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function extensionFor(file: File, fallback: string): string {
  const ext = extname(file.name || '').toLowerCase();
  if (ext) return ext;
  if (file.type === 'application/pdf') return '.pdf';
  if (file.type === 'image/jpeg') return '.jpg';
  if (file.type === 'image/png') return '.png';
  if (file.type === 'image/webp') return '.webp';
  return fallback;
}

async function verifyStudentInBatch(studentId: number, batchId: number): Promise<boolean> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT 1
     FROM batch_mst b
     JOIN student_master sm ON sm.Student_Id = ?
     WHERE b.Batch_Id = ?
      AND ${VISIBLE_BATCH_SQL}
       AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
       AND (
         TRIM(sm.Batch_Code) = TRIM(b.Batch_code)
         OR EXISTS (
           SELECT 1
           FROM admission_master am
           WHERE am.Student_Id = sm.Student_Id
             AND am.Batch_Id = b.Batch_Id
             AND am.IsActive = 1
             AND am.IsDelete = 0
             AND (am.Cancel IS NULL OR LOWER(TRIM(am.Cancel)) NOT IN ('yes'))
         )
       )
     LIMIT 1`,
    [studentId, batchId]
  );
  return (rows as any[]).length > 0;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const batchId = toInt(formData.get('batchId'));
    const studentId = toInt(formData.get('studentId'));
    const photo = formData.get('photo');
    const documents = formData.getAll('documents').filter((item): item is File => item instanceof File && item.size > 0);
    const docNames = formData.getAll('docNames').map((item) => String(item || '').trim());

    if (!batchId || !studentId) {
      return NextResponse.json({ success: false, error: 'Please select batch and student.' }, { status: 400 });
    }

    const allowedStudent = await verifyStudentInBatch(studentId, batchId);
    if (!allowedStudent) {
      return NextResponse.json({ success: false, error: 'Selected student was not found in this batch.' }, { status: 404 });
    }

    if (!(photo instanceof File) || photo.size === 0) {
      return NextResponse.json({ success: false, error: 'Student photo is required.' }, { status: 400 });
    }
    if (!PHOTO_TYPES.has(photo.type)) {
      return NextResponse.json({ success: false, error: 'Unsupported photo format. Use JPG, PNG, or WebP.' }, { status: 400 });
    }
    if (photo.size > MAX_BYTES) {
      return NextResponse.json({ success: false, error: 'Photo is too large. Maximum size is 5 MB.' }, { status: 400 });
    }
    if (documents.length === 0) {
      return NextResponse.json({ success: false, error: 'Upload at least one document.' }, { status: 400 });
    }

    for (const document of documents) {
      if (!DOCUMENT_TYPES.has(document.type)) {
        return NextResponse.json({ success: false, error: 'Unsupported document format. Use PDF, JPG, PNG, or WebP.' }, { status: 400 });
      }
      if (document.size > MAX_BYTES) {
        return NextResponse.json({ success: false, error: 'Each document must be 5 MB or smaller.' }, { status: 400 });
      }
    }

    const photoFilename = `student_${studentId}_${Date.now()}${extensionFor(photo, '.jpg')}`;
    const photoUrl = await saveStudentPhotoBlob(
      studentId,
      Buffer.from(await photo.arrayBuffer()),
      photo.type || 'image/jpeg',
      photoFilename
    );

    const pool = getPool();
    await ensureDocumentBlobColumns(pool);

    const uploadedDocuments: Array<{ id: number; docName: string; filename: string }> = [];
    for (const [index, document] of documents.entries()) {
      const docName = docNames[index] || document.name.replace(/\.[^.]+$/, '') || `Document ${index + 1}`;
      const filename = `${sanitize(docName)}-${Date.now()}-${index + 1}${extensionFor(document, '.pdf')}`;
      const bytes = Buffer.from(await document.arrayBuffer());
      const [result] = await pool.query(
        `INSERT INTO documents (upload_image, doc_name, Student_id, File_Data, Content_Type) VALUES (?, ?, ?, ?, ?)`,
        [filename, docName, studentId, bytes, document.type || 'application/octet-stream']
      ) as [any, any];
      uploadedDocuments.push({ id: Number(result.insertId), docName, filename });
    }

    return NextResponse.json({
      success: true,
      message: 'Student photo and documents uploaded successfully.',
      photoUrl,
      documents: uploadedDocuments,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload student documents';
    console.error('Student capture upload error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
