/* eslint-disable @typescript-eslint/no-explicit-any */
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { getPool } from '@/lib/db';
import { getTableCols } from '@/lib/db-schema';

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

// Documents are stored directly in the DB (LONGBLOB) rather than on the Plesk file
// manager. Make sure the columns exist before reading/writing them.
let documentBlobColumnsReady = false;
export async function ensureDocumentBlobColumns(pool: ReturnType<typeof getPool>): Promise<void> {
  if (documentBlobColumnsReady) return;
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents'`
  ) as [any[], any];
  const existing = new Set((cols as any[]).map((r) => String(r.COLUMN_NAME)));
  const additions: string[] = [];
  if (!existing.has('File_Data')) additions.push('ADD COLUMN File_Data LONGBLOB NULL');
  if (!existing.has('Content_Type')) additions.push('ADD COLUMN Content_Type VARCHAR(100) NULL');
  if (additions.length) {
    await pool.query(`ALTER TABLE documents ${additions.join(', ')}`);
  }
  documentBlobColumnsReady = true;
}

export async function saveAdmissionAssetsForStudent(studentId: number, bundle?: AdmissionUploadBundle | null): Promise<void> {
  if (!studentId || !hasUploads(bundle)) return;

  const pool = getPool();

  if (bundle.documents.length > 0) {
    await ensureDocumentBlobColumns(pool);
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
      const bytes = Buffer.from(await doc.file.arrayBuffer());

      // Store the file bytes directly in the DB (no external file store).
      await pool.query(
        `INSERT INTO documents (upload_image, doc_name, Student_id, File_Data, Content_Type) VALUES (?, ?, ?, ?, ?)`,
        [filename, `${MANAGED_DOC_PREFIX}${doc.key}`, studentId, bytes, doc.file.type || 'application/octet-stream']
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

// ── Inquiry-scoped admission assets ────────────────────────────────────────────
// At submit time an online admission usually has NO student yet (the student is
// only created when the admission is granted). To avoid losing the uploaded files,
// we stash the bytes in a manifest table keyed by Inquiry_Id, then move them onto
// the real student's `documents` rows via attachInquiryAssetsToStudent() on grant.
// Everything is kept in the database — no external/Plesk file store.

const INQUIRY_DOC_MANIFEST_TABLE = 'online_admission_documents';

async function ensureInquiryDocManifestTable(pool: ReturnType<typeof getPool>): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${INQUIRY_DOC_MANIFEST_TABLE} (
       Id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
       Inquiry_Id   INT NOT NULL,
       Doc_Key      VARCHAR(120) NOT NULL,
       Filename     VARCHAR(255) NOT NULL,
       Content_Type VARCHAR(100) NULL,
       Is_Photo     TINYINT(1) NOT NULL DEFAULT 0,
       File_Data    LONGBLOB NULL,
       Created_At   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       INDEX idx_oadoc_inquiry (Inquiry_Id)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
}

/** Persist admission-form uploads against an inquiry (no student yet), in the DB. */
export async function saveAdmissionAssetsForInquiry(
  inquiryId: number,
  bundle?: AdmissionUploadBundle | null,
): Promise<void> {
  if (!inquiryId || !hasUploads(bundle)) return;
  const pool = getPool();
  await ensureInquiryDocManifestTable(pool);

  // Re-submits replace the prior set.
  await pool.query(`DELETE FROM ${INQUIRY_DOC_MANIFEST_TABLE} WHERE Inquiry_Id = ?`, [inquiryId]);

  for (const doc of bundle.documents) {
    if (!DOCUMENT_TYPES.has(doc.file.type)) {
      throw Object.assign(new Error(`Unsupported file type for ${doc.key}`), { status: 400 });
    }
    if (doc.file.size > MAX_DOCUMENT_BYTES) {
      throw Object.assign(new Error(`File too large for ${doc.key}. Maximum size is 5 MB.`), { status: 400 });
    }
    const extension = normaliseExtension(doc.file, '.pdf');
    const filename = `${sanitizeSegment(doc.key)}-${Date.now()}${extension}`;
    const bytes = Buffer.from(await doc.file.arrayBuffer());
    await pool.query(
      `INSERT INTO ${INQUIRY_DOC_MANIFEST_TABLE} (Inquiry_Id, Doc_Key, Filename, Content_Type, Is_Photo, File_Data) VALUES (?, ?, ?, ?, 0, ?)`,
      [inquiryId, doc.key, filename, doc.file.type || 'application/octet-stream', bytes]
    );
  }

  if (bundle.photoFile) {
    const photo = bundle.photoFile;
    if (!PHOTO_TYPES.has(photo.type)) {
      throw Object.assign(new Error('Unsupported photo format. Use JPG, PNG, or WebP.'), { status: 400 });
    }
    if (photo.size > MAX_PHOTO_BYTES) {
      throw Object.assign(new Error('Photo is too large. Maximum size is 5 MB.'), { status: 400 });
    }
    const extension = normaliseExtension(photo, '.jpg');
    const filename = `photo-${Date.now()}${extension}`;
    const bytes = Buffer.from(await photo.arrayBuffer());
    await pool.query(
      `INSERT INTO ${INQUIRY_DOC_MANIFEST_TABLE} (Inquiry_Id, Doc_Key, Filename, Content_Type, Is_Photo, File_Data) VALUES (?, ?, ?, ?, 1, ?)`,
      [inquiryId, 'photo', filename, photo.type || 'image/jpeg', bytes]
    );
  }
}

/** Move inquiry-scoped uploads onto the real student once it exists (on grant). */
export async function attachInquiryAssetsToStudent(inquiryId: number, studentId: number): Promise<void> {
  if (!inquiryId || !studentId) return;
  const pool = getPool();
  await ensureInquiryDocManifestTable(pool);
  await ensureDocumentBlobColumns(pool);

  const [rows] = await pool.query(
    `SELECT Doc_Key, Filename, Content_Type, Is_Photo, File_Data FROM ${INQUIRY_DOC_MANIFEST_TABLE} WHERE Inquiry_Id = ?`,
    [inquiryId]
  ) as [any[], any];
  if (!(rows as any[]).length) return;

  // Refresh the managed (admission-origin) docs for this student.
  await pool.query(`DELETE FROM documents WHERE Student_id = ? AND doc_name LIKE ?`, [studentId, `${MANAGED_DOC_PREFIX}%`]);

  for (const row of rows as any[]) {
    const data: Buffer | null = row.File_Data ? Buffer.from(row.File_Data) : null;
    if (!data) continue;

    if (Number(row.Is_Photo) === 1) {
      // Profile photo stays a static URL on the student record.
      const photoDir = resolvePhotoUploadsRoot();
      await mkdir(photoDir, { recursive: true });
      const ext = extname(String(row.Filename)) || '.jpg';
      const filename = `student_${studentId}_${Date.now()}${ext}`;
      await writeFile(join(photoDir, filename), data);
      await updateStudentPhoto(studentId, `/uploads/students/${filename}`);
    } else {
      await pool.query(
        `INSERT INTO documents (upload_image, doc_name, Student_id, File_Data, Content_Type) VALUES (?, ?, ?, ?, ?)`,
        [row.Filename, `${MANAGED_DOC_PREFIX}${row.Doc_Key}`, studentId, data, row.Content_Type || 'application/octet-stream']
      );
    }
  }

  // Manifest consumed.
  await pool.query(`DELETE FROM ${INQUIRY_DOC_MANIFEST_TABLE} WHERE Inquiry_Id = ?`, [inquiryId]);
}