/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPool } from '@/lib/db';
import { sendOnlineAdmissionSubmissionEmail } from '@/lib/mailer';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OnlineAdmissionListParams {
  page: number;
  limit: number;
  search?: string;
  statusCategory?: string;
  dateFrom?: string;
  dateTo?: string;
}

type StatusCategory = 'open' | 'accepted' | 'closed';

export interface AdmissionRow {
  Admission_Id: number;
  Inquiry_Id: number;
  Student_Name: string;
  Email: string;
  Present_Mobile: string;
  Batch_code: string;
  Admission_Date: string | null;
  Status_id: number | null;
  StatusText: string;
  StatusLabel: string;
  StatusCategory: StatusCategory;
  IsLegacy: 0 | 1;
}

export interface StatusOption { id: number; label: string }

export interface OnlineAdmissionListResult {
  rows: AdmissionRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  statusOptions: StatusOption[];
}

export interface SubmitAdmissionInput {
  inquiryId: number;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  mobile?: string;
  batchCode?: string;
  [key: string]: any;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAYLOAD_TABLE = 'online_admission_payload';

const FALLBACK_STATUSES: Record<number, string> = {
  0: 'New Inquiry', 1: 'Follow Up', 2: 'Interested', 3: 'Confirmed',
  4: 'Not Interested', 5: 'Batch Started', 6: 'Batch Completed',
  7: 'Cancelled', 8: 'Admitted', 9: 'Left', 10: 'On Hold',
  12: 'Prospective', 13: 'Walk In', 15: 'Re-inquiry', 16: 'Demo Attended',
  17: 'Demo Scheduled', 19: 'Online Inquiry', 23: 'Document Pending',
  24: 'Fees Pending', 25: 'Transfer', 26: 'Need Based Training',
  27: 'Duplicate', 29: 'Corporate', 34: 'Assessment Done',
  35: 'Refund', 40: 'Counselling Done',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

let payloadTableReady = false;

async function ensurePayloadTable(pool: ReturnType<typeof getPool>): Promise<void> {
  if (payloadTableReady) return;
  try {
    const [pkRows] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY' LIMIT 1`,
      [PAYLOAD_TABLE]
    ) as [any[], any];
    const pkCol = String((pkRows as any[])[0]?.COLUMN_NAME ?? '');
    if (pkCol && pkCol !== 'Inquiry_Id') {
      await pool.query(`DROP TABLE \`${PAYLOAD_TABLE}\``);
    } else if (pkCol === 'Inquiry_Id') {
      // If a legacy Student_Id NOT NULL column exists, make it nullable so the
      // INSERT (which only specifies Inquiry_Id + Payload) doesn't fail.
      const [badCol] = await pool.query(
        `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
           AND COLUMN_NAME = 'Student_Id' AND IS_NULLABLE = 'NO' LIMIT 1`,
        [PAYLOAD_TABLE]
      ) as [any[], any];
      if ((badCol as any[]).length > 0) {
        await pool.query(`ALTER TABLE \`${PAYLOAD_TABLE}\` MODIFY COLUMN Student_Id INT NULL`);
      }
    }
  } catch { /* table doesn't exist yet */ }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${PAYLOAD_TABLE} (
       Inquiry_Id INT NOT NULL PRIMARY KEY,
       Payload    LONGTEXT NULL,
       Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       Updated_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
  payloadTableReady = true;
}

function safeDate(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value);
  if (!s || s.startsWith('0000-')) return null;
  const t = new Date(s).getTime();
  if (!Number.isFinite(t) || t <= 0) return null;
  return s;
}

function resolveCategory(statusId: number, statusText: string): StatusCategory {
  if ([8, 9, 10].includes(statusId)) return 'accepted';
  if ([5, 11, 13, 27].includes(statusId)) return 'closed';
  const base = (statusText || '').toLowerCase();
  if (/accepted|admitted|confirm|taken/.test(base)) return 'accepted';
  if (/cancel|reject|closed|not interested|drop|left|denied/.test(base)) return 'closed';
  return 'open';
}

// ── Public service functions ──────────────────────────────────────────────────

export async function listOnlineAdmissions(
  params: OnlineAdmissionListParams
): Promise<OnlineAdmissionListResult> {
  const pool = getPool();
  const { page, limit, search = '', statusCategory = '', dateFrom = '', dateTo = '' } = params;
  const offset = (page - 1) * limit;
  const fetchCap = Math.min(2000, offset + limit * 4);

  await ensurePayloadTable(pool);

  // New entries (have a payload record)
  const newConds: string[] = ['(si.IsDelete = 0 OR si.IsDelete IS NULL)'];
  const newParams: any[] = [];
  if (search) {
    newConds.push(
      `(si.Student_Name LIKE ? OR si.Email LIKE ? OR si.Present_Mobile LIKE ? OR CAST(si.Inquiry_Id AS CHAR) LIKE ?)`
    );
    const like = `%${search}%`;
    newParams.push(like, like, like, like);
  }
  if (dateFrom) { newConds.push('oap.Created_At >= ?'); newParams.push(dateFrom); }
  if (dateTo)   { newConds.push('oap.Created_At <= ?'); newParams.push(dateTo); }

  const [newRows] = await pool.query<any[]>(
    `SELECT
       si.Inquiry_Id AS Inquiry_Id,
       COALESCE(si.Student_Name, sm.Student_Name, '') AS Student_Name,
       COALESCE(si.Email, sm.Email, '') AS Email,
       COALESCE(si.Present_Mobile, sm.Present_Mobile, '') AS Present_Mobile,
       COALESCE(sm.Batch_Code, si.Batch_Code, '') AS Batch_code,
       COALESCE(sm.Admission_Dt, oap.Created_At) AS Admission_Date,
       COALESCE(sm.Status_id, si.OnlineState) AS Status_id,
       COALESCE(stm_sm.Status, stm_si.Status, '') AS StatusText
     FROM ${PAYLOAD_TABLE} oap
     JOIN Student_Inquiry si ON si.Inquiry_Id = oap.Inquiry_Id
     LEFT JOIN student_master sm ON sm.Student_Id = si.Student_Id AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
     LEFT JOIN Status_Master stm_sm ON stm_sm.Id = sm.Status_id
     LEFT JOIN Status_Master stm_si ON stm_si.Id = si.OnlineState
     WHERE ${newConds.join(' AND ')}
     ORDER BY oap.Created_At DESC LIMIT ?`,
    [...newParams, fetchCap]
  );

  // Legacy link-sent entries
  let oldRows: any[] = [];
  try {
    const oldConds: string[] = [
      'si.admission_done = 2',
      'si.Student_Id IS NOT NULL',
      '(si.IsDelete = 0 OR si.IsDelete IS NULL)',
      `NOT EXISTS (SELECT 1 FROM ${PAYLOAD_TABLE} oap2 WHERE oap2.Inquiry_Id = si.Inquiry_Id)`,
    ];
    const oldParams: any[] = [];
    if (search) {
      oldConds.push(
        `(si.Student_Name LIKE ? OR sm.Student_Name LIKE ? OR si.Email LIKE ? OR sm.Email LIKE ? OR si.Present_Mobile LIKE ? OR sm.Present_Mobile LIKE ? OR CAST(si.Inquiry_Id AS CHAR) LIKE ?)`
      );
      const like = `%${search}%`;
      oldParams.push(like, like, like, like, like, like, like);
    }
    if (dateFrom) { oldConds.push('sm.Admission_Dt >= ?'); oldParams.push(dateFrom); }
    if (dateTo)   { oldConds.push('sm.Admission_Dt <= ?'); oldParams.push(dateTo); }

    const [result] = await pool.query<any[]>(
      `SELECT
         si.Inquiry_Id AS Admission_Id, si.Inquiry_Id AS Inquiry_Id,
         COALESCE(sm.Student_Name, si.Student_Name, '') AS Student_Name,
         COALESCE(sm.Email, si.Email, '') AS Email,
         COALESCE(sm.Present_Mobile, si.Present_Mobile, '') AS Present_Mobile,
         COALESCE(sm.Batch_Code, si.Batch_Code, '') AS Batch_code,
         sm.Admission_Dt AS Admission_Date,
         sm.Status_id AS Status_id,
         COALESCE(stm.Status, '') AS StatusText, 1 AS IsLegacy
       FROM Student_Inquiry si
       JOIN student_master sm ON sm.Student_Id = si.Student_Id AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
       LEFT JOIN Status_Master stm ON stm.Id = sm.Status_id
       WHERE ${oldConds.join(' AND ')}
       ORDER BY si.Inquiry_Id DESC LIMIT ?`,
      [...oldParams, fetchCap]
    );
    oldRows = result;
  } catch (e: any) {
    console.warn('[OnlineAdmission] legacy query skipped:', e?.message);
  }

  // Build status options
  const statusOptions: StatusOption[] = [];
  const seen = new Set<number>();
  const push = (id: number, label: string) => {
    if (!Number.isFinite(id) || seen.has(id)) return;
    statusOptions.push({ id, label });
    seen.add(id);
  };
  try {
    const [dbStatuses] = await pool.query<any[]>(
      `SELECT DISTINCT sm.Status_id as id, COALESCE(MAX(stm.Status),'') as label
       FROM Student_Inquiry si
       JOIN student_master sm ON sm.Student_Id = si.Student_Id AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
       LEFT JOIN Status_Master stm ON stm.Id = sm.Status_id
       WHERE si.admission_done = 2 AND (si.IsDelete = 0 OR si.IsDelete IS NULL)
       GROUP BY sm.Status_id ORDER BY sm.Status_id`
    );
    for (const r of dbStatuses) push(Number(r.id), r.label);
  } catch { /* ignore */ }
  for (const [id, label] of Object.entries(FALLBACK_STATUSES)) push(Number(id), label);
  statusOptions.sort((a, b) => a.id - b.id);

  const statusLabelMap = Object.fromEntries(statusOptions.map((s) => [s.id, s.label]));

  let allRows: any[] = [
    ...(newRows as any[]).map((r) => ({ ...r, Admission_Id: r.Inquiry_Id, IsLegacy: 0 })),
    ...oldRows,
  ].map((r) => {
    const label = String(r.StatusText || statusLabelMap[r.Status_id] || '').trim() || 'Open';
    return {
      ...r,
      Admission_Date: safeDate(r.Admission_Date),
      DOB: safeDate(r.DOB),
      StatusLabel: label,
      StatusCategory: resolveCategory(Number(r.Status_id), label),
    };
  });

  const normalizedCategory = statusCategory.trim().toLowerCase();
  if (normalizedCategory) {
    allRows = allRows.filter((r) => r.StatusCategory === normalizedCategory);
  }

  allRows.sort((a, b) => {
    const da = a.Admission_Date ? new Date(a.Admission_Date).getTime() : 0;
    const db = b.Admission_Date ? new Date(b.Admission_Date).getTime() : 0;
    return db - da;
  });

  const total = allRows.length;
  return {
    rows: allRows.slice(offset, offset + limit),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    statusOptions,
  };
}

export async function submitOnlineAdmission(input: SubmitAdmissionInput): Promise<number> {
  const { inquiryId, firstName, middleName, lastName, email, mobile, batchCode, ...rest } = input;

  if (!Number.isFinite(inquiryId) || inquiryId <= 0) throw new Error('Invalid Inquiry ID');

  const pool = getPool();

  const [siRows] = await pool.query<any[]>(
    `SELECT Inquiry_Id, Student_Name, Email FROM Student_Inquiry
     WHERE Inquiry_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
    [inquiryId]
  );
  if (!siRows.length) throw Object.assign(new Error('Inquiry not found'), { status: 404 });
  const inquiry = siRows[0];

  // Strip File objects from KT arrays before persisting
  const stripFiles = (arr: any[]) =>
    Array.isArray(arr) ? arr.map(({ marksheetFile: _f, ...r }: any) => r) : arr;

  const cleanBody = {
    ...input,
    ssc_ktDetails: stripFiles(rest.ssc_ktDetails),
    hsc_ktDetails: stripFiles(rest.hsc_ktDetails),
    diploma_ktDetails: stripFiles(rest.diploma_ktDetails),
    grad_ktDetails: stripFiles(rest.grad_ktDetails),
    postgrad_ktDetails: stripFiles(rest.postgrad_ktDetails),
  };

  await ensurePayloadTable(pool);
  await pool.query(
    `INSERT INTO ${PAYLOAD_TABLE} (Inquiry_Id, Payload)
     VALUES (?, ?) ON DUPLICATE KEY UPDATE Payload=VALUES(Payload), Updated_At=NOW()`,
    [inquiryId, JSON.stringify(cleanBody)]
  );

  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
  try {
    await pool.query(
      `UPDATE Student_Inquiry
       SET OnlineState=23,
           Student_Name=COALESCE(NULLIF(?,''), Student_Name),
           Email=COALESCE(NULLIF(?,''), Email),
           Present_Mobile=COALESCE(NULLIF(?,''), Present_Mobile),
           Batch_Code=COALESCE(NULLIF(?,''), Batch_Code)
       WHERE Inquiry_Id=?`,
      [fullName || null, email || null, mobile || null, batchCode || null, inquiryId]
    );
  } catch (e: any) {
    console.warn('[OnlineAdmission] Student_Inquiry update skipped:', e?.message);
  }

  const recipientEmail = String(email || inquiry.Email || '').trim();
  const studentName = fullName || String(inquiry.Student_Name || '').trim();
  if (recipientEmail) {
    try {
      await sendOnlineAdmissionSubmissionEmail({
        toEmail: recipientEmail,
        studentName,
        applicationId: inquiryId,
      });
    } catch (e) {
      console.error('[OnlineAdmission] confirmation email error:', e);
    }
  }

  return inquiryId;
}
