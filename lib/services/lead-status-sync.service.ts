/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPool, invalidateCache } from '@/lib/db';

/**
 * Read with a hard time limit. SET STATEMENT max_statement_time alone was not enough: a run
 * blocked on / holding a MyISAM table lock kept going for 28 minutes. So the query runs on its
 * own connection and a watchdog issues KILL QUERY on that connection when the limit passes.
 */
async function boundedQuery(sql: string, params: unknown[], seconds = 20): Promise<any[]> {
  const pool = getPool();
  const conn = await pool.getConnection();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const [[{ id }]] = (await conn.query('SELECT CONNECTION_ID() AS id')) as any;
    timer = setTimeout(() => { pool.query(`KILL QUERY ${Number(id)}`).catch(() => {}); }, seconds * 1000);
    const [rows] = await conn.query(`SET STATEMENT max_statement_time=${seconds} FOR ${sql}`, params);
    return rows as any[];
  } finally {
    if (timer) clearTimeout(timer);
    conn.release();
  }
}

/** True while a previous run's query is still executing on the database server. */
async function previousRunStillGoing(): Promise<boolean> {
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS n FROM information_schema.PROCESSLIST
      WHERE INFO LIKE '%lead-status-sync%' AND INFO NOT LIKE '%PROCESSLIST%'`
  );
  return Number((rows as any[])[0]?.n || 0) > 0;
}

/**
 * Keeps the two "admitted" flags in step:
 *   student_inquiry.OnlineState   — the lead's status (inquiry list, My Tasks, reports)
 *   student_master.Status_id      — the student's status (CBD "Confirmed Admissions", student pages)
 *
 * Single source of truth for "admission confirmed" = the student has an active, non-cancelled
 * admission_master row. From that:
 *   A. the student's Status_id is set to Admission confirmed, but only if it is still at an
 *      open-lead status (New / Contacted… / Follow up pending / Lost lead / Irrelevant) or empty.
 *      Any other status (Left, Transferred, …) is someone's deliberate choice and is kept.
 *   B. every inquiry linked to that student is set to Admission confirmed, but only when the
 *      inquiry really is the same person (phone or e-mail matches). student_inquiry.Student_Id
 *      sometimes holds an old-software inquiry id, not a student id, so the id alone is not proof.
 *
 * Nothing is ever moved *away* from Admission confirmed here; cancellations stay a manual action.
 * Each run is bounded (statement time limit + row cap) and every change is logged.
 */

const ADMITTED_LABEL = 'admission confirmed';
const OPEN_LEAD_LABELS = [
  'new', 'contacted (not recieved call)', 'contacted (not received call)', 'contacted (interested)',
  'contacted (next batch)', 'contacted - eligible', 'contacted (not interested)', 'follow up pending',
  'lost lead', 'irrelevant',
];

let logReady: Promise<void> | null = null;
function ensureLog(): Promise<void> {
  if (!logReady) {
    logReady = getPool().query(
      `CREATE TABLE IF NOT EXISTS lead_status_sync_log (
         id BIGINT AUTO_INCREMENT PRIMARY KEY,
         target VARCHAR(20) NOT NULL COMMENT 'inquiry | student',
         target_id INT NOT NULL,
         old_status INT NULL,
         new_status INT NOT NULL,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         KEY idx_lssl_target (target, target_id)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    ).then(() => undefined).catch((err: unknown) => { logReady = null; throw err; });
  }
  return logReady;
}

async function statusIds(): Promise<{ admitted: number | null; open: number[] }> {
  const [rows] = await getPool().query(
    `SELECT Id, LOWER(TRIM(Status)) AS label FROM status_master WHERE (IsDelete = 0 OR IsDelete IS NULL)`
  );
  let admitted: number | null = null;
  const open: number[] = [];
  for (const r of rows as any[]) {
    if (r.label === ADMITTED_LABEL && admitted == null) admitted = Number(r.Id);
    if (OPEN_LEAD_LABELS.includes(r.label)) open.push(Number(r.Id));
  }
  return { admitted, open };
}

/**
 * Students with a live, non-cancelled admission taken in the last RECENT_DAYS days.
 * admission_master.Student_Id is varchar while student_master.Student_Id is int, so the
 * ids are converted once here (in a small derived set) instead of per row in a join —
 * the old correlated EXISTS compared int to varchar and could not use any index. sid_txt keeps
 * the text form so student_inquiry (also varchar) is matched through idx_si_student_dedup;
 * STRAIGHT_JOIN keeps the small recent-admission set as the driving table (≈40 ms vs 28 min).
 * Older admissions were reconciled by earlier runs; nothing ever un-admits them here.
 */
const RECENT_DAYS = 120;
const RECENT_ADMITTED = `(
  SELECT DISTINCT am.Student_Id AS sid_txt, CAST(am.Student_Id AS UNSIGNED) AS sid
    FROM admission_master am
   WHERE am.IsDelete = 0 AND am.IsActive = 1
     AND LOWER(TRIM(COALESCE(am.Cancel, ''))) NOT IN ('yes', '1', 'true')
     AND am.Admission_Date >= DATE_FORMAT(CURDATE() - INTERVAL ${RECENT_DAYS} DAY, '%Y-%m-%d')
)`;
/** Tag so a run can see whether an earlier one is still executing on the server. */
const RUN_TAG = '/* lead-status-sync */';

/** Last 10 digits, so +91 / leading-zero variants match. */
const digits10 = (col: string) =>
  `RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${col}, ''), ' ', ''), '-', ''), '+', ''), '(', ''), 10)`;

export interface StatusSyncResult {
  admittedStatusId: number | null;
  studentsFixed: number;
  inquiriesFixed: number;
  dryRun: boolean;
  sampleStudentIds: number[];
  sampleInquiryIds: number[];
  skipped?: string;
}

export async function reconcileAdmissionStatuses(opts: { dryRun?: boolean; limit?: number } = {}): Promise<StatusSyncResult> {
  const dryRun = Boolean(opts.dryRun);
  const limit = Math.max(1, Math.min(2000, opts.limit ?? 500));
  const pool = getPool();
  await ensureLog();
  const { admitted, open } = await statusIds();
  const out: StatusSyncResult = { admittedStatusId: admitted, studentsFixed: 0, inquiriesFixed: 0, dryRun, sampleStudentIds: [], sampleInquiryIds: [] };
  if (!admitted || !open.length) return out;
  if (await previousRunStillGoing()) { out.skipped = 'previous run still running'; return out; }

  // A. Students with a live admission whose Status_id is still an open-lead value / empty.
  const stuRows = await boundedQuery(
    `${RUN_TAG} SELECT sm.Student_Id, sm.Status_id
       FROM ${RECENT_ADMITTED} ra
       JOIN student_master sm ON sm.Student_Id = ra.sid
      WHERE (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
        AND (sm.Status_id IS NULL OR sm.Status_id = 0 OR sm.Status_id IN (?))
      LIMIT ?`,
    [open, limit]
  );
  const students = stuRows as any[];
  out.sampleStudentIds = students.slice(0, 20).map((r) => Number(r.Student_Id));
  if (!dryRun && students.length) {
    const ids = students.map((r) => Number(r.Student_Id));
    await pool.query(
      `UPDATE student_master SET Status_id = ?, Status_date = COALESCE(Status_date, NOW())
        WHERE Student_Id IN (?) AND (Status_id IS NULL OR Status_id = 0 OR Status_id IN (?))`,
      [admitted, ids, open]
    );
    await pool.query(
      `INSERT INTO lead_status_sync_log (target, target_id, old_status, new_status) VALUES ${students.map(() => `('student', ?, ?, ?)`).join(',')}`,
      students.flatMap((r) => [Number(r.Student_Id), r.Status_id == null ? null : Number(r.Status_id), admitted])
    );
  }
  out.studentsFixed = students.length;

  // B. Inquiries of admitted students that still show an open-lead status, same person only.
  const inqRows = await boundedQuery(
    `${RUN_TAG} SELECT STRAIGHT_JOIN si.Inquiry_Id, CAST(NULLIF(si.OnlineState, '') AS UNSIGNED) AS old_status
       FROM ${RECENT_ADMITTED} ra
       JOIN student_master sm ON sm.Student_Id = ra.sid AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
       JOIN student_inquiry si ON si.Student_Id = ra.sid_txt
      WHERE (si.IsDelete = 0 OR si.IsDelete IS NULL)
        AND (NULLIF(si.OnlineState, '') IS NULL OR CAST(si.OnlineState AS UNSIGNED) IN (?))
        AND (
          (LENGTH(${digits10('si.Present_Mobile')}) = 10 AND ${digits10('si.Present_Mobile')} = ${digits10('sm.Present_Mobile')})
          OR (NULLIF(TRIM(si.Email), '') IS NOT NULL AND LOWER(TRIM(si.Email)) = LOWER(TRIM(sm.Email)))
        )
      LIMIT ?`,
    [open, limit]
  );
  const inquiries = inqRows as any[];
  out.sampleInquiryIds = inquiries.slice(0, 20).map((r) => Number(r.Inquiry_Id));
  if (!dryRun && inquiries.length) {
    const ids = inquiries.map((r) => Number(r.Inquiry_Id));
    await pool.query(
      `UPDATE student_inquiry SET OnlineState = ?, Status_Changed_At = NOW()
        WHERE Inquiry_Id IN (?) AND (NULLIF(OnlineState, '') IS NULL OR CAST(OnlineState AS UNSIGNED) IN (?))`,
      [admitted, ids, open]
    ).catch(async (err: any) => {
      // Status_Changed_At is added lazily by the inquiry service; older DBs may not have it yet.
      if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err;
      await pool.query(
        `UPDATE student_inquiry SET OnlineState = ?
          WHERE Inquiry_Id IN (?) AND (NULLIF(OnlineState, '') IS NULL OR CAST(OnlineState AS UNSIGNED) IN (?))`,
        [admitted, ids, open]
      );
    });
    await pool.query(
      `INSERT INTO lead_status_sync_log (target, target_id, old_status, new_status) VALUES ${inquiries.map(() => `('inquiry', ?, ?, ?)`).join(',')}`,
      inquiries.flatMap((r) => [Number(r.Inquiry_Id), r.old_status == null ? null : Number(r.old_status), admitted])
    );
    invalidateCache('inquiry:filters');
    invalidateCache('inquiry:list-count');
    invalidateCache('api:inquiry');
  }
  out.inquiriesFixed = inquiries.length;
  return out;
}
