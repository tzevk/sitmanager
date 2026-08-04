/* eslint-disable @typescript-eslint/no-explicit-any */
import { extname } from 'path';
import { getPool } from '@/lib/db';
import { getTableCols } from '@/lib/db-schema';
import { resizeToThumbnail } from '@/lib/image-thumbnail.server';

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const DOCUMENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MANAGED_DOC_PREFIX = 'oa:';
const STUDENT_PHOTO_COLUMNS = ['Photo', 'Student_Photo', 'PhotoPath', 'Photo_Path'];

export interface AdmissionUploadBundle {
  photoFile?: File | null;
  documents: Array<{
    key: string;
    file: File;
  }>;
}

export interface AdmissionAssetSummary {
  photo: boolean;
  documents: boolean;
  count: number;
}

function sanitizeSegment(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'file';
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

export async function updateStudentPhoto(studentId: number, photoUrl: string): Promise<void> {
  const pool = getPool();
  const cols = await getTableCols(pool, 'student_master');
  const column = STUDENT_PHOTO_COLUMNS.find((candidate) => cols.has(candidate));
  if (!column) return;

  const [columnInfo] = await pool.query(
    `SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_master' AND COLUMN_NAME = ?
     LIMIT 1`,
    [column]
  ) as [any[], any];
  const info = columnInfo[0];
  if (info && String(info.DATA_TYPE).toLowerCase() === 'varchar' && Number(info.CHARACTER_MAXIMUM_LENGTH || 0) < 255) {
    await pool.query(`ALTER TABLE student_master MODIFY COLUMN \`${column}\` VARCHAR(255) NULL`);
  }

  await pool.query(`UPDATE student_master SET \`${column}\` = ? WHERE Student_Id = ?`, [photoUrl, studentId]);
}

let studentPhotoBlobColumnsReady = false;
export async function ensureStudentPhotoBlobColumns(pool: ReturnType<typeof getPool>): Promise<void> {
  if (studentPhotoBlobColumnsReady) return;
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_master'`
  ) as [any[], any];
  const existing = new Set((cols as any[]).map((r) => String(r.COLUMN_NAME)));
  const additions: string[] = [];
  if (!existing.has('Photo_Data')) additions.push('ADD COLUMN Photo_Data LONGBLOB NULL');
  if (!existing.has('Photo_Content_Type')) additions.push('ADD COLUMN Photo_Content_Type VARCHAR(100) NULL');
  if (!existing.has('Photo_File_Name')) additions.push('ADD COLUMN Photo_File_Name VARCHAR(255) NULL');
  if (additions.length) {
    await pool.query(`ALTER TABLE student_master ${additions.join(', ')}`);
  }
  studentPhotoBlobColumnsReady = true;
}

export async function saveStudentPhotoBlob(
  studentId: number,
  bytes: Buffer,
  contentType: string,
  filename: string,
): Promise<string> {
  const pool = getPool();
  await ensureStudentPhotoBlobColumns(pool);
  const photoSrc = `/api/student-photo/${studentId}`;
  await updateStudentPhoto(studentId, photoSrc);
  await pool.query(
    `UPDATE student_master
     SET Photo_Data = ?, Photo_Content_Type = ?, Photo_File_Name = ?
     WHERE Student_Id = ?`,
    [bytes, contentType || 'image/jpeg', filename, studentId]
  );
  return photoSrc;
}

export async function getStudentPhotoDataUrl(studentId: number): Promise<string | null> {
  const pool = getPool();
  await ensureStudentPhotoBlobColumns(pool);
  const [rows] = await pool.query(
    `SELECT Photo_Data, Photo_Content_Type
     FROM student_master
     WHERE Student_Id = ? AND Photo_Data IS NOT NULL
     LIMIT 1`,
    [studentId]
  ) as [any[], any];
  const row = rows[0];
  if (!row?.Photo_Data) return null;
  const bytes = Buffer.from(row.Photo_Data);
  const contentType = String(row.Photo_Content_Type || 'image/jpeg');
  return `data:${contentType};base64,${bytes.toString('base64')}`;
}

/**
 * Same as getStudentPhotoDataUrl, but resized down to a small JPEG first.
 * For bulk endpoints (e.g. ID card batch import) that return many students'
 * photos in one response — full-resolution originals in bulk blow past
 * Vercel's 4.5MB response cap for any batch of more than a handful of
 * photographed students.
 */
export async function getStudentPhotoThumbnailDataUrl(studentId: number): Promise<string | null> {
  const pool = getPool();
  await ensureStudentPhotoBlobColumns(pool);
  const [rows] = await pool.query(
    `SELECT Photo_Data
     FROM student_master
     WHERE Student_Id = ? AND Photo_Data IS NOT NULL
     LIMIT 1`,
    [studentId]
  ) as [any[], any];
  const row = rows[0];
  if (!row?.Photo_Data) return null;
  const resized = await resizeToThumbnail(Buffer.from(row.Photo_Data), { width: 300, height: 360, quality: 82 });
  if (!resized) return null;
  return `data:image/jpeg;base64,${resized.toString('base64')}`;
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

    const extension = normaliseExtension(photo, '.jpg');
    const filename = `student_${studentId}_${Date.now()}${extension}`;
    const bytes = Buffer.from(await photo.arrayBuffer());
    await saveStudentPhotoBlob(studentId, bytes, photo.type || 'image/jpeg', filename);
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
      `DELETE FROM ${INQUIRY_DOC_MANIFEST_TABLE} WHERE Inquiry_Id = ? AND Doc_Key = ? AND Is_Photo = 0`,
      [inquiryId, doc.key]
    );
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
      `DELETE FROM ${INQUIRY_DOC_MANIFEST_TABLE} WHERE Inquiry_Id = ? AND Is_Photo = 1`,
      [inquiryId]
    );
    await pool.query(
      `INSERT INTO ${INQUIRY_DOC_MANIFEST_TABLE} (Inquiry_Id, Doc_Key, Filename, Content_Type, Is_Photo, File_Data) VALUES (?, ?, ?, ?, 1, ?)`,
      [inquiryId, 'photo', filename, photo.type || 'image/jpeg', bytes]
    );
  }
}

export async function getAdmissionInquiryAssetSummary(inquiryId: number): Promise<AdmissionAssetSummary> {
  if (!inquiryId) return { photo: false, documents: false, count: 0 };
  const pool = getPool();
  await ensureInquiryDocManifestTable(pool);
  const [rows] = await pool.query(
    `SELECT
       SUM(CASE WHEN Is_Photo = 1 THEN 1 ELSE 0 END) as PhotoCount,
       SUM(CASE WHEN Is_Photo = 0 THEN 1 ELSE 0 END) as DocumentCount,
       COUNT(*) as TotalCount
     FROM ${INQUIRY_DOC_MANIFEST_TABLE}
     WHERE Inquiry_Id = ? AND File_Data IS NOT NULL`,
    [inquiryId]
  ) as [any[], any];
  const row = (rows as any[])[0] || {};
  const photoCount = Number(row.PhotoCount || 0);
  const documentCount = Number(row.DocumentCount || 0);
  return {
    photo: photoCount > 0,
    documents: documentCount > 0,
    count: Number(row.TotalCount || 0),
  };
}

export interface AdmissionAssetDetail {
  key: string;
  isPhoto: boolean;
  filename: string;
  contentType: string | null;
}

/** List saved inquiry-scoped assets (photo + documents) with enough info to build view links. */
export async function getAdmissionInquiryAssetDetails(inquiryId: number): Promise<AdmissionAssetDetail[]> {
  if (!inquiryId) return [];
  const pool = getPool();
  await ensureInquiryDocManifestTable(pool);
  const [rows] = await pool.query(
    `SELECT Doc_Key, Filename, Content_Type, Is_Photo
     FROM ${INQUIRY_DOC_MANIFEST_TABLE}
     WHERE Inquiry_Id = ? AND File_Data IS NOT NULL
     ORDER BY Is_Photo DESC, Doc_Key ASC`,
    [inquiryId]
  ) as [any[], any];
  return (rows as any[]).map((row) => ({
    key: String(row.Doc_Key),
    isPhoto: Number(row.Is_Photo) === 1,
    filename: String(row.Filename || ''),
    contentType: row.Content_Type ? String(row.Content_Type) : null,
  }));
}

export interface AdmissionInquiryDocumentBlob {
  data: Buffer;
  contentType: string;
  filename: string;
}

/** Fetch a single saved inquiry-scoped asset's bytes, scoped strictly to that inquiry. */
export async function getAdmissionInquiryDocumentBlob(
  inquiryId: number,
  docKey: string,
): Promise<AdmissionInquiryDocumentBlob | null> {
  if (!inquiryId || !docKey) return null;
  const pool = getPool();
  await ensureInquiryDocManifestTable(pool);
  const [rows] = await pool.query(
    `SELECT Filename, Content_Type, File_Data
     FROM ${INQUIRY_DOC_MANIFEST_TABLE}
     WHERE Inquiry_Id = ? AND Doc_Key = ? AND File_Data IS NOT NULL
     LIMIT 1`,
    [inquiryId, docKey]
  ) as [any[], any];
  const row = (rows as any[])[0];
  if (!row?.File_Data) return null;
  return {
    data: Buffer.from(row.File_Data),
    contentType: String(row.Content_Type || 'application/octet-stream'),
    filename: String(row.Filename || 'file'),
  };
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
      const ext = extname(String(row.Filename)) || '.jpg';
      const filename = `student_${studentId}_${Date.now()}${ext}`;
      await saveStudentPhotoBlob(studentId, data, row.Content_Type || 'image/jpeg', filename);
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