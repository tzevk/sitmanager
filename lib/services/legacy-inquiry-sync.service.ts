/* eslint-disable @typescript-eslint/no-explicit-any */
import { getLegacyPool, getPool } from '@/lib/db';

export interface LegacyInquirySyncOptions {
  sinceHours?: number;   // only pull rows created/updated within this window (0 = all)
  batchSize?: number;    // upsert chunk size
}

export interface LegacyInquirySyncSummary {
  configured: boolean;
  inquiriesFetched: number;
  inquiriesUpserted: number;
  inquiriesSkippedWebDuplicate: number;
  discussionsFetched: number;
  discussionsUpserted: number;
  errors: string[];
}

// Legacy DB uses PascalCase; new DB uses lowercase.
const INQUIRY_SRC  = 'Student_Inquiry';
const INQUIRY_DST  = 'student_inquiry';
const DISCUSSION_TABLE = 'awt_inquirydiscussion'; // same name in both DBs

// Inquiry_Dt is stored as VARCHAR in the legacy DB; this expression normalises
// the many formats (YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY) into a real DATE.
const DT_EXPR = `COALESCE(
  STR_TO_DATE(SUBSTRING(Inquiry_Dt,1,19),'%Y-%m-%d %H:%i:%s'),
  STR_TO_DATE(SUBSTRING(Inquiry_Dt,1,10),'%Y-%m-%d'),
  STR_TO_DATE(SUBSTRING(Inquiry_Dt,1,10),'%d-%m-%Y'),
  STR_TO_DATE(SUBSTRING(Inquiry_Dt,1,10),'%d/%m/%Y'),
  DATE('1970-01-01')
)`;

async function getColumns(pool: any, table: string): Promise<string[]> {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME AS c, EXTRA AS extra
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [table]
  );
  return (rows as any[])
    .filter((r: any) => !String(r.extra ?? '').toLowerCase().includes('generated'))
    .map((r: any) => String(r.c));
}

async function getColumnMaxLengths(pool: any, table: string): Promise<Map<string, number | null>> {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME AS c, CHARACTER_MAXIMUM_LENGTH AS maxLen
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  const map = new Map<string, number | null>();
  for (const r of rows as any[]) {
    map.set(String(r.c).toLowerCase(), r.maxLen == null ? null : Number(r.maxLen));
  }
  return map;
}

async function tableExists(pool: any, table: string): Promise<boolean> {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    [table]
  );
  return (rows as any[]).length > 0;
}

async function getSharedColumns(
  oldPool: any,
  newPool: any,
  srcTable: string,
  dstTable: string
): Promise<string[]> {
  const [oldCols, newCols] = await Promise.all([
    getColumns(oldPool, srcTable),
    getColumns(newPool, dstTable),
  ]);
  const newLower = new Set(newCols.map((c) => c.toLowerCase()));
  return oldCols.filter((c) => newLower.has(c.toLowerCase()));
}

function normalizeMobileForDedup(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  // Use last 10 digits to handle country-code variants
  return digits.slice(-10);
}

function normalizeEmailForDedup(value: unknown): string | null {
  const text = String(value ?? '').trim().toLowerCase();
  return text.includes('@') ? text : null;
}

/**
 * Returns the set of Inquiry_Ids from the new DB that already exist,
 * plus a set of normalized phone/email contact keys for inquiries that
 * were NOT synced from the legacy DB (i.e. came from the website or public form).
 * These are the records the legacy sync must not overwrite with a duplicate insert.
 */
async function loadExistingContactKeys(
  newPool: any,
  dstTable: string,
  legacyIds: number[],
  phones: string[],
  emails: string[],
): Promise<{ existingIds: Set<number>; websiteContactKeys: Set<string> }> {
  const existingIds = new Set<number>();

  // Check which Inquiry_Ids already exist in the new DB
  for (let i = 0; i < legacyIds.length; i += 500) {
    const chunk = legacyIds.slice(i, i + 500);
    const ph = chunk.map(() => '?').join(', ');
    const [rows] = await newPool.query(
      `SELECT Inquiry_Id FROM \`${dstTable}\` WHERE Inquiry_Id IN (${ph})`,
      chunk,
    );
    for (const row of rows as any[]) existingIds.add(Number(row.Inquiry_Id));
  }

  // Among records NOT in the new DB yet (true new inserts), check if
  // phone/email already belongs to a record that was captured from the website.
  // We consider any existing inquiry whose Inquiry_Id is NOT in legacyIds set
  // as a website-origin record (Suvidya API sync gives new auto-increment IDs).
  const websiteContactKeys = new Set<string>();
  if (phones.length === 0 && emails.length === 0) return { existingIds, websiteContactKeys };

  const legacyIdSet = new Set(legacyIds);
  const conditions: string[] = [];
  const params: any[] = [];

  if (phones.length > 0) {
    const phonePh = phones.map(() => '?').join(', ');
    conditions.push(`RIGHT(REGEXP_REPLACE(COALESCE(Present_Mobile,''),'[^0-9]',''), 10) IN (${phonePh})`);
    params.push(...phones);
  }
  if (emails.length > 0) {
    const emailPh = emails.map(() => '?').join(', ');
    conditions.push(`LOWER(TRIM(COALESCE(Email,''))) IN (${emailPh})`);
    params.push(...emails);
  }

  const [contactRows] = await newPool.query(
    `SELECT Inquiry_Id, Present_Mobile, Email
     FROM \`${dstTable}\`
     WHERE (IsDelete = 0 OR IsDelete IS NULL)
       AND (${conditions.join(' OR ')})`,
    params,
  );

  for (const row of contactRows as any[]) {
    const id = Number(row.Inquiry_Id);
    // Only flag as website-origin if this inquiry_id is NOT one the legacy DB owns
    if (legacyIdSet.has(id)) continue;
    const phone = normalizeMobileForDedup(row.Present_Mobile);
    const email = normalizeEmailForDedup(row.Email);
    if (phone) websiteContactKeys.add(`phone:${phone}`);
    if (email) websiteContactKeys.add(`email:${email}`);
  }

  return { existingIds, websiteContactKeys };
}

async function upsertBatched(
  newPool: any,
  table: string,
  columns: string[],
  rows: any[],
  batchSize: number
): Promise<number> {
  if (!rows.length || !columns.length) return 0;

  const colsSql  = columns.map((c) => `\`${c}\``).join(', ');
  const placeholders = `(${columns.map(() => '?').join(', ')})`;
  const updates  = columns.map((c) => `\`${c}\`=VALUES(\`${c}\`)`).join(', ');
  const sql = `INSERT INTO \`${table}\` (${colsSql}) VALUES ${placeholders}
               ON DUPLICATE KEY UPDATE ${updates}`;

  const maxLengths = await getColumnMaxLengths(newPool, table);

  let written = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    // Run each row individually to avoid multi-row INSERT syntax issues with
    // on-duplicate-key and to get accurate counts.
    for (const row of chunk) {
      const values = columns.map((col) => {
        const val = row[col] ?? null;
        if (typeof val !== 'string') return val;
        const max = maxLengths.get(col.toLowerCase());
        return max && val.length > max ? val.slice(0, max) : val;
      });
      await newPool.query(sql, values);
      written += 1;
    }
  }
  return written;
}

export async function syncLegacyInquiries(
  options: LegacyInquirySyncOptions = {}
): Promise<LegacyInquirySyncSummary> {
  const summary: LegacyInquirySyncSummary = {
    configured: false,
    inquiriesFetched: 0,
    inquiriesUpserted: 0,
    inquiriesSkippedWebDuplicate: 0,
    discussionsFetched: 0,
    discussionsUpserted: 0,
    errors: [],
  };

  const oldPool = getLegacyPool();
  if (!oldPool) return summary; // OLD_DB_HOST not configured

  summary.configured = true;
  const newPool = getPool();
  const batchSize = Math.max(1, Math.min(500, options.batchSize ?? 200));

  try {
    // ── 1. Resolve shared inquiry columns ────────────────────────────────────
    const inquiryColumns = await getSharedColumns(oldPool, newPool, INQUIRY_SRC, INQUIRY_DST);
    if (!inquiryColumns.length) {
      summary.errors.push('No shared columns found for Student_Inquiry — skipping');
      return summary;
    }

    // ── 2. Build cutoff date ─────────────────────────────────────────────────
    const sinceHours = (options.sinceHours ?? 0) > 0 ? options.sinceHours! : null;
    const cutoffDate = sinceHours
      ? new Date(Date.now() - sinceHours * 3_600_000).toISOString().slice(0, 10)
      : null;

    // ── 3. Fetch inquiries from legacy DB ────────────────────────────────────
    const colsSql = inquiryColumns.map((c) => `\`${c}\``).join(', ');
    const whereClause = cutoffDate
      ? `(IsDelete = 0 OR IsDelete IS NULL) AND ${DT_EXPR} >= ?`
      : `(IsDelete = 0 OR IsDelete IS NULL)`;
    const queryParams = cutoffDate ? [cutoffDate] : [];

    const [inquiryRows] = await (oldPool as any).query(
      `SELECT ${colsSql} FROM \`${INQUIRY_SRC}\`
       WHERE ${whereClause}
       ORDER BY Inquiry_Id ASC`,
      queryParams
    );

    const rows = inquiryRows as any[];
    summary.inquiriesFetched = rows.length;

    if (rows.length > 0) {
      // ── 3a. Dedup: website leads are primary; legacy is fallback ─────────────
      // Collect identifiers needed for the overlap check
      const legacyIds = rows
        .map((r: any) => Number(r['Inquiry_Id']))
        .filter((id) => Number.isFinite(id) && id > 0);

      const rawPhones = rows.map((r: any) => normalizeMobileForDedup(r['Present_Mobile'])).filter(Boolean) as string[];
      const rawEmails = rows.map((r: any) => normalizeEmailForDedup(r['Email'])).filter(Boolean) as string[];
      const uniquePhones = [...new Set(rawPhones)];
      const uniqueEmails = [...new Set(rawEmails)];

      const { existingIds, websiteContactKeys } = await loadExistingContactKeys(
        newPool, INQUIRY_DST, legacyIds, uniquePhones, uniqueEmails,
      );

      // Split rows: safe to upsert vs. blocked new-inserts
      const rowsToUpsert: any[] = [];
      for (const row of rows) {
        const id = Number(row['Inquiry_Id']);
        if (existingIds.has(id)) {
          // Record already in new DB from a previous legacy sync — safe to update
          rowsToUpsert.push(row);
          continue;
        }
        // New insert candidate: skip if phone or email is owned by a website-origin record
        const phone = normalizeMobileForDedup(row['Present_Mobile']);
        const email = normalizeEmailForDedup(row['Email']);
        const isWebDuplicate =
          (phone && websiteContactKeys.has(`phone:${phone}`)) ||
          (email && websiteContactKeys.has(`email:${email}`));

        if (isWebDuplicate) {
          summary.inquiriesSkippedWebDuplicate += 1;
        } else {
          rowsToUpsert.push(row);
        }
      }

      if (rowsToUpsert.length > 0) {
        summary.inquiriesUpserted = await upsertBatched(newPool, INQUIRY_DST, inquiryColumns, rowsToUpsert, batchSize);
      }
    }

    // ── 4. Fetch & upsert associated discussions ─────────────────────────────
    const inquiryIds = rows
      .map((r: any) => r['Inquiry_Id'])
      .filter((id: any) => id != null && String(id).trim() !== '');

    if (inquiryIds.length > 0 && await tableExists(oldPool, DISCUSSION_TABLE)) {
      const discussionColumns = await getSharedColumns(oldPool, newPool, DISCUSSION_TABLE, DISCUSSION_TABLE);

      if (discussionColumns.length > 0) {
        const discColsSql = discussionColumns.map((c) => `\`${c}\``).join(', ');
        let allDiscussions: any[] = [];

        for (let i = 0; i < inquiryIds.length; i += 500) {
          const chunk = inquiryIds.slice(i, i + 500);
          const placeholders = chunk.map(() => '?').join(', ');
          const [discRows] = await (oldPool as any).query(
            `SELECT ${discColsSql} FROM \`${DISCUSSION_TABLE}\`
             WHERE Inquiry_id IN (${placeholders})
               AND (deleted = 0 OR deleted IS NULL)`,
            chunk
          );
          allDiscussions = allDiscussions.concat(discRows as any[]);
        }

        summary.discussionsFetched = allDiscussions.length;

        if (allDiscussions.length > 0) {
          summary.discussionsUpserted = await upsertBatched(
            newPool, DISCUSSION_TABLE, discussionColumns, allDiscussions, batchSize
          );
        }
      }
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    summary.errors.push(msg);
    console.error('[legacy-inquiry-sync] error:', msg);
  }

  return summary;
}
