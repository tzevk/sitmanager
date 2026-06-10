/* eslint-disable @typescript-eslint/no-explicit-any */
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { getPool } from '@/lib/db';
import { getTableCols } from '@/lib/db-schema';
import { writeStorageFile } from '@/lib/storage-api';

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const DOCUMENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MANAGED_DOC_PREFIX = 'oa:';

export interface AdmissionUploadBundle {
  photoFile?: File | null;
  documents: Array<{
    key: string;
    file: File;
  }>;
}

function sanitizeSegment(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'file';
}

function resolvePhotoUploadsRoot(): string {
  return join(process.cwd(), 'public', 'uploads', 'students');
}

function normaliseExtension(file: File, fallback = '.bin'): string {
  const ext = extname(file.name || '').toLowerCase();
  if (ext) return ext;
  if (file.type === 'application/pdf') return '.pdf';
  if (file.type === 'image/jpeg') return '.jpg';
  if (file.type === 'image/png') return '.png';
  if (file.type === 'image/webp') return '.webp';
  return fallback;
}

function hasUploads(bundle?: AdmissionUploadBundle | null): bundle is AdmissionUploadBundle {
  return Boolean(bundle && (bundle.photoFile || bundle.documents.length > 0));
}

async function updateStudentPhoto(studentId: number, photoUrl: string): Promise<void> {
  const pool = getPool();
  const cols = await getTableCols(pool, 'student_master');
  const column = ['Photo', 'Student_Photo', 'PhotoPath', 'Photo_Path'].find((candidate) => cols.has(candidate));
  if (!column) return;

  await pool.query(`UPDATE student_master SET \`${column}\` = ? WHERE Student_Id = ?`, [photoUrl, studentId]);
}

export async function saveAdmissionAssetsForStudent(studentId: number, bundle?: AdmissionUploadBundle | null): Promise<void> {
  if (!studentId || !hasUploads(bundle)) return;

  const pool = getPool();

  if (bundle.documents.length > 0) {
    await pool.query(`DELETE FROM documents WHERE Student_id = ? AND doc_name LIKE ?`, [studentId, `${MANAGED_DOC_PREFIX}%`]);

    for (const doc of bundle.documents) {
      if (!DOCUMENT_TYPES.has(doc.file.type)) {
        throw Object.assign(new Error(`Unsupported file type for ${doc.key}`), { status: 400 });
      }
      if (doc.file.size > MAX_DOCUMENT_BYTES) {
        throw Object.assign(new Error(`File too large for ${doc.key}. Maximum size is 5 MB.`), { status: 400 });
      }

      const extension = normaliseExtension(doc.file, '.pdf');
      const filename = `${sanitizeSegment(doc.key)}-${Date.now()}${extension}`;
      const bytes = await doc.file.arrayBuffer();
      await writeStorageFile(`${studentId}/${filename}`, Buffer.from(bytes));

      await pool.query(
        `INSERT INTO documents (upload_image, doc_name, Student_id) VALUES (?, ?, ?)`,
        [filename, `${MANAGED_DOC_PREFIX}${doc.key}`, studentId]
      );
    }
  }

  if (bundle.photoFile) {
    const photo = bundle.photoFile;
    if (!PHOTO_TYPES.has(photo.type)) {
      throw Object.assign(new Error('Unsupported photo format. Use JPG, PNG, or WebP.'), { status: 400 });
    }
    if (photo.size > MAX_PHOTO_BYTES) {
      throw Object.assign(new Error('Photo is too large. Maximum size is 5 MB.'), { status: 400 });
    }

    const photoDir = resolvePhotoUploadsRoot();
    await mkdir(photoDir, { recursive: true });
    const extension = normaliseExtension(photo, '.jpg');
    const filename = `student_${studentId}_${Date.now()}${extension}`;
    const bytes = await photo.arrayBuffer();
    await writeFile(join(photoDir, filename), Buffer.from(bytes));
    await updateStudentPhoto(studentId, `/uploads/students/${filename}`);
  }
}

export function hasAdmissionUploads(bundle?: AdmissionUploadBundle | null): boolean {
  return hasUploads(bundle);
}