import { RowDataPacket } from 'mysql2';
import { getPool } from '@/lib/db';
import { resolveInquiryTableName } from '@/lib/services/inquiry.service';

export interface AdminUserOption {
  id: number;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
}

export interface MonitoringDayRow {
  date: string;
  day: string;
  admissions: number;
  incomingCalls: number;
  freshCallsMeta: number;
  freshCallsOthers: number;
  followupCalls: number;
  walkIns: number;
  firstHalfSummary: string | null;
  secondHalfSummary: string | null;
  whatsapp: number | null;
  emailsReplied: number | null;
  socialMediaInquiries: number | null;
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

let monitoringTableReady = false;
async function ensureMonitoringTable(pool: ReturnType<typeof getPool>): Promise<void> {
  if (monitoringTableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS emp_daily_monitoring (
      Id INT NOT NULL AUTO_INCREMENT,
      Admin_User_Id INT NOT NULL,
      Report_Date DATE NOT NULL,
      First_Half_Summary TEXT NULL,
      Second_Half_Summary TEXT NULL,
      WhatsApp_Enquiries INT NULL,
      Emails_Replied INT NULL,
      Social_Media_Inquiries INT NULL,
      Updated_By INT NULL,
      Updated_Date DATETIME NULL,
      PRIMARY KEY (Id),
      UNIQUE KEY uq_emp_date (Admin_User_Id, Report_Date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [cols] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emp_daily_monitoring'
       AND COLUMN_NAME IN ('WhatsApp_Enquiries', 'Emails_Replied')`
  );
  const existing = new Set(cols.map((c) => c.name as string));
  if (!existing.has('WhatsApp_Enquiries')) {
    await pool.query(`ALTER TABLE emp_daily_monitoring ADD COLUMN WhatsApp_Enquiries INT NULL`);
  }
  if (!existing.has('Emails_Replied')) {
    await pool.query(`ALTER TABLE emp_daily_monitoring ADD COLUMN Emails_Replied INT NULL`);
  }

  monitoringTableReady = true;
}

let studentMasterAcceptedByReady = false;
/** Belt-and-suspenders: the admission-accept flow (lib/services/online-admission.service.ts)
 *  also ensures this column, but only runs when someone actually accepts an admission —
 *  the monitoring queries below depend on it existing regardless. */
async function ensureStudentMasterAcceptedByColumn(pool: ReturnType<typeof getPool>): Promise<void> {
  if (studentMasterAcceptedByReady) return;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_master' AND COLUMN_NAME = 'Accepted_By'
     LIMIT 1`
  );
  if (!rows.length) {
    await pool.query(`ALTER TABLE student_master ADD COLUMN Accepted_By INT NULL`);
  }
  studentMasterAcceptedByReady = true;
}

export async function listAdminUsers(): Promise<AdminUserOption[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, firstname, lastname, email
     FROM awt_adminuser
     WHERE deleted_date IS NULL
     ORDER BY firstname ASC, lastname ASC`
  );
  return rows.map((r) => ({
    id: Number(r.id),
    firstname: r.firstname ?? null,
    lastname: r.lastname ?? null,
    email: r.email ?? null,
  }));
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getWeekDates(weekStart: string): string[] {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    out.push(toDateStr(d));
  }
  return out;
}

/** For each inquiry id, the id + created_by of its earliest (non-deleted) discussion row. */
async function loadFirstDiscussions(
  pool: ReturnType<typeof getPool>,
  inquiryIds: number[]
): Promise<Map<number, { discussionId: number; createdBy: number | null }>> {
  const result = new Map<number, { discussionId: number; createdBy: number | null }>();
  if (!inquiryIds.length) return result;

  const placeholders = inquiryIds.map(() => '?').join(',');
  const [minRows] = await pool.query<RowDataPacket[]>(
    `SELECT CAST(Inquiry_id AS UNSIGNED) AS inquiryId, MIN(id) AS minId
     FROM awt_inquirydiscussion
     WHERE (deleted = 0 OR deleted IS NULL) AND CAST(Inquiry_id AS UNSIGNED) IN (${placeholders})
     GROUP BY CAST(Inquiry_id AS UNSIGNED)`,
    inquiryIds
  );
  if (!minRows.length) return result;

  const minIds = minRows.map((r) => Number(r.minId));
  const idPlaceholders = minIds.map(() => '?').join(',');
  const [discRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, created_by FROM awt_inquirydiscussion WHERE id IN (${idPlaceholders})`,
    minIds
  );
  const createdByByMinId = new Map<number, number | null>(
    discRows.map((r) => [Number(r.id), r.created_by != null ? Number(r.created_by) : null])
  );

  for (const r of minRows) {
    const minId = Number(r.minId);
    result.set(Number(r.inquiryId), { discussionId: minId, createdBy: createdByByMinId.get(minId) ?? null });
  }
  return result;
}

/** Subset of the given inquiry ids that are linked to a synced Meta lead. */
async function loadMetaLinkedSet(pool: ReturnType<typeof getPool>, inquiryIds: number[]): Promise<Set<number>> {
  if (!inquiryIds.length) return new Set();
  const placeholders = inquiryIds.map(() => '?').join(',');
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT inquiry_id FROM meta_ads_lead_sync WHERE inquiry_id IN (${placeholders})`,
    inquiryIds
  );
  return new Set(rows.map((r) => Number(r.inquiry_id)));
}

/** Inquiry_From ("mode") value per inquiry id. */
async function loadInquiryModes(
  pool: ReturnType<typeof getPool>,
  inquiryTable: string,
  inquiryIds: number[]
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (!inquiryIds.length) return result;
  const placeholders = inquiryIds.map(() => '?').join(',');
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT Inquiry_Id, Inquiry_From FROM \`${inquiryTable}\` WHERE Inquiry_Id IN (${placeholders})`,
    inquiryIds
  );
  for (const r of rows) result.set(Number(r.Inquiry_Id), String(r.Inquiry_From ?? '').trim());
  return result;
}

export async function getEmployeeWeeklyMonitoring(
  adminUserId: number,
  weekStart: string
): Promise<MonitoringDayRow[]> {
  const pool = getPool();
  await Promise.all([ensureMonitoringTable(pool), ensureStudentMasterAcceptedByColumn(pool)]);
  const inquiryTable = await resolveInquiryTableName(pool);

  const dates = getWeekDates(weekStart);
  const weekEnd = dates[6];

  // 1) Manual fields already saved for this employee/week
  const [manualRows] = await pool.query<RowDataPacket[]>(
    `SELECT Report_Date, First_Half_Summary, Second_Half_Summary, WhatsApp_Enquiries, Emails_Replied, Social_Media_Inquiries
     FROM emp_daily_monitoring
     WHERE Admin_User_Id = ? AND Report_Date BETWEEN ? AND ?`,
    [adminUserId, weekStart, weekEnd]
  );
  const manualByDate = new Map<string, RowDataPacket>();
  for (const r of manualRows) {
    manualByDate.set(toDateStr(new Date(r.Report_Date)), r);
  }

  // 2) New inquiries created this week, by mode (Inquiry_From) — drives Incoming Calls
  //    (mode = Call), Fresh Calls (Meta) (linked to a synced Meta lead), and No. of
  //    Walk-in Enquiries (mode = Walk-In). student_inquiry has no created_by column, so
  //    each new inquiry is attributed to whoever logged its first discussion.
  const [newInquiryRows] = await pool.query<RowDataPacket[]>(
    `SELECT Inquiry_Id, Inquiry_From, DATE(Date_Added) AS d
     FROM \`${inquiryTable}\`
     WHERE (IsDelete = 0 OR IsDelete IS NULL)
       AND DATE(Date_Added) BETWEEN ? AND ?`,
    [weekStart, weekEnd]
  );

  const incomingCallsByDate = new Map<string, number>();
  const freshMetaByDate = new Map<string, number>();
  const walkInsByDate = new Map<string, number>();

  if (newInquiryRows.length) {
    const inquiryIds = [...new Set(newInquiryRows.map((r) => Number(r.Inquiry_Id)))];
    const [firstDiscussionByInquiry, metaLinkedIds] = await Promise.all([
      loadFirstDiscussions(pool, inquiryIds),
      loadMetaLinkedSet(pool, inquiryIds),
    ]);

    for (const r of newInquiryRows) {
      const inquiryId = Number(r.Inquiry_Id);
      const first = firstDiscussionByInquiry.get(inquiryId);
      if (!first || first.createdBy !== adminUserId) continue;

      const d = toDateStr(new Date(r.d));
      const mode = String(r.Inquiry_From ?? '').trim();
      if (mode === 'Call') {
        incomingCallsByDate.set(d, (incomingCallsByDate.get(d) ?? 0) + 1);
      } else if (metaLinkedIds.has(inquiryId)) {
        freshMetaByDate.set(d, (freshMetaByDate.get(d) ?? 0) + 1);
      } else if (mode === 'Walk-In') {
        walkInsByDate.set(d, (walkInsByDate.get(d) ?? 0) + 1);
      }
    }
  }

  // 3) This employee's own discussion activity this week — the first-ever discussion on
  //    a non-Call, non-Meta inquiry counts as "Fresh Calls (Others)"; any later discussion
  //    on an inquiry that already had one counts as "Followup Calls".
  const [discussionRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, CAST(Inquiry_id AS UNSIGNED) AS inquiryId, DATE(created_date) AS d
     FROM awt_inquirydiscussion
     WHERE (deleted = 0 OR deleted IS NULL)
       AND created_by = ?
       AND DATE(created_date) BETWEEN ? AND ?`,
    [adminUserId, weekStart, weekEnd]
  );

  const freshOthersByDate = new Map<string, number>();
  const followupByDate = new Map<string, number>();

  if (discussionRows.length) {
    const inquiryIds = [...new Set(discussionRows.map((r) => Number(r.inquiryId)).filter(Boolean))];
    const [firstDiscussionByInquiry, metaLinkedIds, modeByInquiry] = await Promise.all([
      loadFirstDiscussions(pool, inquiryIds),
      loadMetaLinkedSet(pool, inquiryIds),
      loadInquiryModes(pool, inquiryTable, inquiryIds),
    ]);

    for (const r of discussionRows) {
      const inquiryId = Number(r.inquiryId);
      if (!inquiryId) continue;
      const d = toDateStr(new Date(r.d));
      const first = firstDiscussionByInquiry.get(inquiryId);
      const isFirst = first?.discussionId === Number(r.id);

      if (isFirst) {
        const mode = modeByInquiry.get(inquiryId) ?? '';
        if (mode === 'Call' || metaLinkedIds.has(inquiryId)) continue; // already counted in step 2
        freshOthersByDate.set(d, (freshOthersByDate.get(d) ?? 0) + 1);
      } else {
        followupByDate.set(d, (followupByDate.get(d) ?? 0) + 1);
      }
    }
  }

  // 4) Admissions (Status_id = 8 on student_master). Prefer the real Accepted_By column
  //    (recorded going forward); fall back to whoever's discussion was most recent on
  //    that inquiry on/before the admission date, for admissions that predate that column.
  const admissionsByDate = new Map<string, number>();
  const [admissionRows] = await pool.query<RowDataPacket[]>(
    `SELECT sm.Student_Id, sm.Admission_Dt AS d, sm.Accepted_By, si.Inquiry_Id
     FROM student_master sm
     JOIN \`${inquiryTable}\` si ON si.Student_Id = sm.Student_Id
     WHERE sm.Status_id = 8
       AND sm.Admission_Dt BETWEEN ? AND ?
       AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)`,
    [weekStart, weekEnd]
  );

  const needsFallback = admissionRows.filter((r) => r.Accepted_By == null && r.Inquiry_Id);
  const fallbackAttributionByInquiry = new Map<number, number | null>();
  if (needsFallback.length) {
    const ids = [...new Set(needsFallback.map((r) => Number(r.Inquiry_Id)))];
    const placeholders = ids.map(() => '?').join(',');
    const [discRows] = await pool.query<RowDataPacket[]>(
      `SELECT CAST(Inquiry_id AS UNSIGNED) AS inquiryId, created_by, created_date
       FROM awt_inquirydiscussion
       WHERE (deleted = 0 OR deleted IS NULL) AND CAST(Inquiry_id AS UNSIGNED) IN (${placeholders})
       ORDER BY created_date ASC, id ASC`,
      ids
    );
    const touchesByInquiry = new Map<number, RowDataPacket[]>();
    for (const r of discRows) {
      const id = Number(r.inquiryId);
      const arr = touchesByInquiry.get(id) ?? [];
      arr.push(r);
      touchesByInquiry.set(id, arr);
    }

    for (const r of needsFallback) {
      const inquiryId = Number(r.Inquiry_Id);
      const admissionDate = toDateStr(new Date(r.d));
      const cutoff = new Date(`${admissionDate}T23:59:59Z`).getTime();
      const touches = touchesByInquiry.get(inquiryId) ?? [];
      let lastBefore: RowDataPacket | null = null;
      for (const t of touches) {
        if (!t.created_date) continue;
        const ts = new Date(t.created_date).getTime();
        if (ts <= cutoff) lastBefore = t;
      }
      fallbackAttributionByInquiry.set(inquiryId, lastBefore ? Number(lastBefore.created_by) : null);
    }
  }

  for (const r of admissionRows) {
    const admissionDate = toDateStr(new Date(r.d));
    const attributedTo = r.Accepted_By != null
      ? Number(r.Accepted_By)
      : fallbackAttributionByInquiry.get(Number(r.Inquiry_Id)) ?? null;
    if (attributedTo === adminUserId) {
      admissionsByDate.set(admissionDate, (admissionsByDate.get(admissionDate) ?? 0) + 1);
    }
  }

  return dates.map((date) => {
    const manual = manualByDate.get(date);
    return {
      date,
      day: WEEKDAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()],
      admissions: admissionsByDate.get(date) ?? 0,
      incomingCalls: incomingCallsByDate.get(date) ?? 0,
      freshCallsMeta: freshMetaByDate.get(date) ?? 0,
      freshCallsOthers: freshOthersByDate.get(date) ?? 0,
      followupCalls: followupByDate.get(date) ?? 0,
      walkIns: walkInsByDate.get(date) ?? 0,
      firstHalfSummary: manual ? (manual.First_Half_Summary ?? null) : null,
      secondHalfSummary: manual ? (manual.Second_Half_Summary ?? null) : null,
      whatsapp: manual ? (manual.WhatsApp_Enquiries ?? null) : null,
      emailsReplied: manual ? (manual.Emails_Replied ?? null) : null,
      socialMediaInquiries: manual ? (manual.Social_Media_Inquiries ?? null) : null,
    };
  });
}

export async function saveMonitoringManualFields(params: {
  adminUserId: number;
  date: string;
  firstHalfSummary?: string | null;
  secondHalfSummary?: string | null;
  whatsapp?: number | null;
  emailsReplied?: number | null;
  socialMediaInquiries?: number | null;
  updatedBy?: number | null;
}): Promise<void> {
  const pool = getPool();
  await ensureMonitoringTable(pool);
  const {
    adminUserId,
    date,
    firstHalfSummary = null,
    secondHalfSummary = null,
    whatsapp = null,
    emailsReplied = null,
    socialMediaInquiries = null,
    updatedBy = null,
  } = params;

  await pool.query(
    `INSERT INTO emp_daily_monitoring
       (Admin_User_Id, Report_Date, First_Half_Summary, Second_Half_Summary, WhatsApp_Enquiries, Emails_Replied, Social_Media_Inquiries, Updated_By, Updated_Date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       First_Half_Summary = VALUES(First_Half_Summary),
       Second_Half_Summary = VALUES(Second_Half_Summary),
       WhatsApp_Enquiries = VALUES(WhatsApp_Enquiries),
       Emails_Replied = VALUES(Emails_Replied),
       Social_Media_Inquiries = VALUES(Social_Media_Inquiries),
       Updated_By = VALUES(Updated_By),
       Updated_Date = VALUES(Updated_Date)`,
    [adminUserId, date, firstHalfSummary, secondHalfSummary, whatsapp, emailsReplied, socialMediaInquiries, updatedBy]
  );
}
