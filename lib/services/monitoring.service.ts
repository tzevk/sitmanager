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

export async function getEmployeeWeeklyMonitoring(
  adminUserId: number,
  weekStart: string
): Promise<MonitoringDayRow[]> {
  const pool = getPool();
  await ensureMonitoringTable(pool);
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

  // 2) Contact-log channel counts (Incoming Calls / Walk-ins), this employee only
  const [channelRows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE(Created_At) AS d, Channel, COUNT(*) AS cnt
     FROM inquiry_contact_log
     WHERE Created_By = ? AND DATE(Created_At) BETWEEN ? AND ?
     GROUP BY DATE(Created_At), Channel`,
    [adminUserId, weekStart, weekEnd]
  );
  const channelCounts = new Map<string, Record<string, number>>();
  for (const r of channelRows) {
    const d = toDateStr(new Date(r.d));
    const bucket = channelCounts.get(d) ?? {};
    bucket[String(r.Channel)] = Number(r.cnt) || 0;
    channelCounts.set(d, bucket);
  }

  // 3) Fresh vs followup split for this employee's 'call' rows this week
  const [callRows] = await pool.query<RowDataPacket[]>(
    `SELECT c.Id, c.Inquiry_Id, DATE(c.Created_At) AS d
     FROM inquiry_contact_log c
     WHERE c.Channel = 'call' AND c.Created_By = ? AND DATE(c.Created_At) BETWEEN ? AND ?`,
    [adminUserId, weekStart, weekEnd]
  );

  const freshMetaByDate = new Map<string, number>();
  const freshOthersByDate = new Map<string, number>();
  const followupByDate = new Map<string, number>();

  if (callRows.length) {
    const inquiryIds = [...new Set(callRows.map((r) => Number(r.Inquiry_Id)))];
    const placeholders = inquiryIds.map(() => '?').join(',');

    const [firstContactRows] = await pool.query<RowDataPacket[]>(
      `SELECT Inquiry_Id, MIN(Id) AS minId
       FROM inquiry_contact_log
       WHERE Inquiry_Id IN (${placeholders})
       GROUP BY Inquiry_Id`,
      inquiryIds
    );
    const firstIdByInquiry = new Map<number, number>();
    for (const r of firstContactRows) firstIdByInquiry.set(Number(r.Inquiry_Id), Number(r.minId));

    const [inquiryDateRows] = await pool.query<RowDataPacket[]>(
      `SELECT Inquiry_Id, _inquiry_date AS d
       FROM \`${inquiryTable}\`
       WHERE Inquiry_Id IN (${placeholders})`,
      inquiryIds
    );
    const inquiryDateById = new Map<number, string | null>();
    for (const r of inquiryDateRows) {
      inquiryDateById.set(Number(r.Inquiry_Id), r.d ? toDateStr(new Date(r.d)) : null);
    }

    const [metaRows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT inquiry_id FROM meta_ads_lead_sync WHERE inquiry_id IN (${placeholders})`,
      inquiryIds
    );
    const metaInquiryIds = new Set(metaRows.map((r) => Number(r.inquiry_id)));

    for (const r of callRows) {
      const inquiryId = Number(r.Inquiry_Id);
      const d = toDateStr(new Date(r.d));
      const isFirstContact = firstIdByInquiry.get(inquiryId) === Number(r.Id);
      const inquiryDate = inquiryDateById.get(inquiryId);
      const isFresh = isFirstContact && inquiryDate === d;

      if (isFresh) {
        if (metaInquiryIds.has(inquiryId)) {
          freshMetaByDate.set(d, (freshMetaByDate.get(d) ?? 0) + 1);
        } else {
          freshOthersByDate.set(d, (freshOthersByDate.get(d) ?? 0) + 1);
        }
      } else {
        followupByDate.set(d, (followupByDate.get(d) ?? 0) + 1);
      }
    }
  }

  // 4) Admissions attributed to this employee this week (Status_id = 8 on student_master,
  //    credited to whichever employee last touched the linked inquiry on/before the admission date).
  const admissionsByDate = new Map<string, number>();
  const [admissionRows] = await pool.query<RowDataPacket[]>(
    `SELECT sm.Student_Id, sm.Admission_Dt AS d, si.Inquiry_Id
     FROM student_master sm
     JOIN \`${inquiryTable}\` si ON si.Student_Id = sm.Student_Id
     WHERE sm.Status_id = 8
       AND sm.Admission_Dt BETWEEN ? AND ?
       AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)`,
    [weekStart, weekEnd]
  );

  if (admissionRows.length) {
    const admittedInquiryIds = [...new Set(admissionRows.map((r) => Number(r.Inquiry_Id)).filter(Boolean))];
    if (admittedInquiryIds.length) {
      const placeholders = admittedInquiryIds.map(() => '?').join(',');
      const [touchRows] = await pool.query<RowDataPacket[]>(
        `SELECT Inquiry_Id, Created_By, Created_At
         FROM inquiry_contact_log
         WHERE Inquiry_Id IN (${placeholders})
         ORDER BY Created_At ASC, Id ASC`,
        admittedInquiryIds
      );
      const touchesByInquiry = new Map<number, RowDataPacket[]>();
      for (const t of touchRows) {
        const id = Number(t.Inquiry_Id);
        const arr = touchesByInquiry.get(id) ?? [];
        arr.push(t);
        touchesByInquiry.set(id, arr);
      }

      for (const r of admissionRows) {
        const inquiryId = Number(r.Inquiry_Id);
        if (!inquiryId) continue;
        const admissionDate = toDateStr(new Date(r.d));
        const cutoff = new Date(`${admissionDate}T23:59:59Z`).getTime();
        const touches = touchesByInquiry.get(inquiryId) ?? [];
        let lastBefore: RowDataPacket | null = null;
        for (const t of touches) {
          const ts = new Date(t.Created_At).getTime();
          if (ts <= cutoff) lastBefore = t;
        }
        if (lastBefore && Number(lastBefore.Created_By) === adminUserId) {
          admissionsByDate.set(admissionDate, (admissionsByDate.get(admissionDate) ?? 0) + 1);
        }
      }
    }
  }

  return dates.map((date) => {
    const manual = manualByDate.get(date);
    const channels = channelCounts.get(date) ?? {};
    return {
      date,
      day: WEEKDAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()],
      admissions: admissionsByDate.get(date) ?? 0,
      incomingCalls: channels['call'] ?? 0,
      freshCallsMeta: freshMetaByDate.get(date) ?? 0,
      freshCallsOthers: freshOthersByDate.get(date) ?? 0,
      followupCalls: followupByDate.get(date) ?? 0,
      walkIns: channels['personal-inquiry'] ?? 0,
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
