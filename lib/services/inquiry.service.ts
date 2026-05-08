/* eslint-disable @typescript-eslint/no-explicit-any */
import { cached, getPool } from '@/lib/db';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateInquiryInput {
  Student_Name: string;
  Sex?: string | null;
  DOB?: string | null;
  Present_Mobile?: string | null;
  Present_Mobile2?: string | null;
  Email?: string | null;
  Nationality?: string | null;
  Present_Country?: string | null;
  Discussion?: string | null;
  Status_id?: number | null;
  Inquiry_Dt?: string | null;
  Inquiry_From?: string | null;
  Inquiry_Type?: string | null;
  Course_Id?: number | null;
  Batch_Category_id?: number | null;
  Batch_Code?: string | null;
  Qualification?: string | null;
  Discipline?: string | null;
  Percentage?: string | null;
}

export interface UpdateInquiryInput extends Omit<CreateInquiryInput, 'Student_Name'> {
  Student_Name: string;
}

export interface InquiryListParams {
  page: number;
  limit: number;
  search?: string;
  discipline?: string;
  inquiryType?: string;
  location?: string;
  training?: string;
  statusId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface InquiryRow {
  Student_Id: number;
  Student_Name: string;
  CourseName: string | null;
  Inquiry_Dt: string | null;
  Present_Mobile: string | null;
  Email: string | null;
  Location: string | null;
  Discipline: string | null;
  Inquiry_From: string | null;
  Inquiry_Type: string | null;
  Status_id: number | null;
  StatusLabel: string;
  Discussion: string | null;
  DiscussionDate: string | null;
  NextFollowUpDate: string | null;
  FollowUpBy: string | null;
}

export interface StatusOption { id: number; label: string }

export interface InquiryListResult {
  rows: InquiryRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filters: {
    disciplines: string[];
    inquiryTypes: string[];
    trainings: string[];
    statusOptions: StatusOption[];
  };
}

// ── Schema helpers ────────────────────────────────────────────────────────────

async function ensureInquirySchema(pool: ReturnType<typeof getPool>): Promise<void> {
  await cached('schema:inquiry_indexes', 60 * 60 * 1000, async () => {
    // Add virtual generated column so _inquiry_date can be indexed
    const [colRows] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Student_Inquiry'
         AND COLUMN_NAME = '_inquiry_date'`
    );
    if ((colRows as any[]).length === 0) {
      await pool.query(
        `ALTER TABLE Student_Inquiry ADD COLUMN _inquiry_date DATE GENERATED ALWAYS AS (` +
        `COALESCE(` +
        `STR_TO_DATE(LEFT(NULLIF(TRIM(Inquiry_Dt),''),19),'%Y-%m-%d %H:%i:%s'),` +
        `STR_TO_DATE(LEFT(NULLIF(TRIM(Inquiry_Dt),''),10),'%Y-%m-%d'),` +
        `STR_TO_DATE(LEFT(NULLIF(TRIM(Inquiry_Dt),''),10),'%d-%m-%Y'),` +
        `STR_TO_DATE(LEFT(NULLIF(TRIM(Inquiry_Dt),''),10),'%d/%m/%Y')` +
        `)) VIRTUAL`
      );
    }

    const indexes: Array<{ table: string; name: string; cols: string }> = [
      { table: 'Student_Inquiry',       name: 'idx_si_list',     cols: 'IsDelete, _inquiry_date, Inquiry_Id' },
      { table: 'Student_Inquiry',       name: 'idx_si_status',   cols: 'IsDelete, OnlineState, Inquiry_Id' },
      { table: 'Student_Inquiry',       name: 'idx_si_type',     cols: 'IsDelete, Inquiry_Type, Inquiry_Id' },
      { table: 'Student_Inquiry',       name: 'idx_si_course',   cols: 'IsDelete, Course_Id, Inquiry_Id' },
      { table: 'awt_inquirydiscussion', name: 'idx_disc_lookup', cols: 'Inquiry_id, deleted, id' },
    ];

    const [existingRows] = await pool.query(
      `SELECT INDEX_NAME, TABLE_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN ('Student_Inquiry','awt_inquirydiscussion')
       GROUP BY TABLE_NAME, INDEX_NAME`
    );
    const existing = new Set(
      (existingRows as any[]).map((r: any) => `${r.TABLE_NAME}.${r.INDEX_NAME}`)
    );

    await Promise.all(
      indexes
        .filter((ix) => !existing.has(`${ix.table}.${ix.name}`))
        .map((ix) => pool.query(`ALTER TABLE \`${ix.table}\` ADD INDEX \`${ix.name}\` (${ix.cols})`))
    );

    return true;
  });
}

const DISCIPLINE_NAME_EXPR =
  `COALESCE(NULLIF(TRIM(md.Deciplin),''), NULLIF(TRIM(si.Discipline),''))`;

const FALLBACK_STATUSES: Record<number, string> = {
  1: 'New', 2: 'Contacted', 3: 'Inquiry', 4: 'Follow Up', 5: 'Interested',
  6: 'Not Interested', 7: 'Admitted', 8: 'Closed', 9: 'DNC', 10: 'Converted',
  12: 'Pending', 15: 'Callback', 16: 'Visited', 18: 'On Hold', 19: 'Lost',
  24: 'Hot Lead', 25: 'Warm Lead', 26: 'Cold Lead', 27: 'Enrolled',
  29: 'Dropped', 33: 'Archived', 34: 'Duplicate Entry', 35: 'Next Batch',
  36: 'Not Eligible',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Detect which column on Student_Inquiry stores the branch/city. */
async function resolveLocationColumn(pool: ReturnType<typeof getPool>): Promise<string | null> {
  try {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Student_Inquiry'`
    );
    const cols = new Set((rows as any[]).map((r: any) => String(r.COLUMN_NAME)));
    for (const candidate of ['Branch', 'Location', 'Present_City', 'City']) {
      if (cols.has(candidate)) return candidate;
    }
  } catch { /* best-effort */ }
  return null;
}

async function loadStatusOptions(pool: ReturnType<typeof getPool>): Promise<StatusOption[]> {
  try {
    const [rows] = await pool.query(
      `SELECT Status_id as id, Status as label FROM awt_status
       WHERE (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Status_id`
    );
    const options = (rows as any[])
      .map((r: any) => ({ id: Number(r.id), label: String(r.label ?? '').trim() }))
      .filter((s) => Number.isFinite(s.id) && s.id > 0 && s.label.length > 0);
    if (options.length) return options;
  } catch { /* fallback below */ }
  return Object.entries(FALLBACK_STATUSES).map(([id, label]) => ({ id: +id, label }));
}

// ── Public service functions ──────────────────────────────────────────────────

export async function createInquiry(data: CreateInquiryInput): Promise<number> {
  if (!data.Student_Name?.trim()) throw new Error('Name is required');

  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO Student_Inquiry (
       Student_Name, Sex, DOB, Present_Mobile, Present_Mobile2,
       Email, Nationality, Present_Country, Discussion,
       OnlineState, Inquiry_Dt, Inquiry_From, Inquiry_Type,
       Course_Id, Batch_Category_id, Batch_Code,
       Qualification, Discipline, Percentage,
       IsDelete, Inquiry, Date_Added
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,'Inquiry',NOW())`,
    [
      data.Student_Name.trim(),
      data.Sex ?? null,
      data.DOB ?? null,
      data.Present_Mobile ?? null,
      data.Present_Mobile2 ?? null,
      data.Email?.trim() ?? null,
      data.Nationality ?? null,
      data.Present_Country ?? null,
      data.Discussion?.trim() ?? null,
      data.Status_id ?? 1,
      data.Inquiry_Dt ?? new Date().toISOString().slice(0, 10),
      data.Inquiry_From ?? null,
      data.Inquiry_Type ?? null,
      data.Course_Id ?? null,
      data.Batch_Category_id ?? null,
      data.Batch_Code ?? null,
      data.Qualification ?? null,
      data.Discipline ?? null,
      data.Percentage ?? null,
    ]
  );
  const insertId = (result as any).insertId as number;

  if (data.Discussion?.trim()) {
    await pool.query(
      `INSERT INTO awt_inquirydiscussion (Inquiry_id, date, discussion, deleted, created_by, created_date)
       VALUES (?, CURDATE(), ?, 0, 1, NOW())`,
      [insertId, data.Discussion.trim()]
    );
  }

  return insertId;
}

export async function getInquiryById(id: number): Promise<any | null> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT
       si.Inquiry_Id as Student_Id, si.Student_Name, si.Sex, si.DOB,
       si.Present_Mobile, si.Present_Mobile2, si.Email,
       si.Nationality, si.Present_Country, si.Discussion,
       CAST(NULLIF(si.OnlineState,'') AS UNSIGNED) as Status_id,
       si.Inquiry_Dt, si.Inquiry_From, si.Inquiry_Type,
       si.Course_Id, si.Batch_Category_id, si.Batch_Code,
       si.Qualification, si.Discipline, ${DISCIPLINE_NAME_EXPR} as DisciplineName, si.Percentage,
       c.Course_Name as CourseName
     FROM Student_Inquiry si
     LEFT JOIN course_mst c ON si.Course_Id = c.Course_Id
     LEFT JOIN MST_Deciplin md ON md.Id = CAST(NULLIF(TRIM(si.Discipline),'') AS UNSIGNED)
     WHERE si.Inquiry_Id = ? AND (si.IsDelete = 0 OR si.IsDelete IS NULL)`,
    [id]
  );
  return (rows as any[])[0] ?? null;
}

export async function listInquiries(params: InquiryListParams): Promise<InquiryListResult> {
  const pool = getPool();
  try { await ensureInquirySchema(pool); } catch { /* best-effort schema migration */ }
  const {
    page, limit, search = '', discipline = '', inquiryType = '',
    location = '', training = '', statusId = '', dateFrom = '', dateTo = '',
  } = params;
  const offset = (page - 1) * limit;

  const ALLOWED_LOCATIONS = new Set(['pune', 'mumbai']);
  const normalizedLocation = location.trim().toLowerCase();
  if (normalizedLocation && !ALLOWED_LOCATIONS.has(normalizedLocation)) {
    throw Object.assign(new Error('Invalid location filter'), { status: 400 });
  }

  const locationColumn = await resolveLocationColumn(pool);

  // Build WHERE
  const conditions: string[] = ['(si.IsDelete = 0 OR si.IsDelete IS NULL)'];
  const queryParams: any[] = [];

  if (search) {
    const resolvedBatchCodeExpr = `NULLIF(TRIM(CAST(si.Batch_Code AS CHAR)),'')`;
    conditions.push(
      `(si.Student_Name LIKE ? OR si.Email LIKE ? OR si.Present_Mobile LIKE ? OR c.Course_Name LIKE ? OR ${resolvedBatchCodeExpr} LIKE ?)`
    );
    const s = `%${search}%`;
    queryParams.push(s, s, s, s, s);
  }
  if (discipline) {
    conditions.push(`${DISCIPLINE_NAME_EXPR} = ?`);
    queryParams.push(discipline);
  }
  if (inquiryType) {
    conditions.push('si.Inquiry_Type = ?');
    queryParams.push(inquiryType);
  }
  if (normalizedLocation && locationColumn) {
    conditions.push(`LOWER(TRIM(si.${locationColumn})) LIKE ?`);
    queryParams.push(`%${normalizedLocation}%`);
  }
  if (statusId) {
    conditions.push('si.OnlineState = ?');
    queryParams.push(parseInt(statusId));
  }
  const INQUIRY_DATE_EXPR =
    `COALESCE(` +
    `STR_TO_DATE(LEFT(NULLIF(TRIM(si.Inquiry_Dt),''),19),'%Y-%m-%d %H:%i:%s'),` +
    `STR_TO_DATE(LEFT(NULLIF(TRIM(si.Inquiry_Dt),''),10),'%Y-%m-%d'),` +
    `STR_TO_DATE(LEFT(NULLIF(TRIM(si.Inquiry_Dt),''),10),'%d-%m-%Y'),` +
    `STR_TO_DATE(LEFT(NULLIF(TRIM(si.Inquiry_Dt),''),10),'%d/%m/%Y'))`;
  if (dateFrom) {
    conditions.push(`${INQUIRY_DATE_EXPR} >= ?`);
    queryParams.push(dateFrom);
  }
  if (dateTo) {
    conditions.push(`${INQUIRY_DATE_EXPR} <= ?`);
    queryParams.push(dateTo);
  }
  if (training) {
    conditions.push('c.Course_Name = ?');
    queryParams.push(training);
  }

  const whereClause = `WHERE (${conditions.join(') AND (')})`;

  let total = 0;
  let pageIds: number[] = [];
  let sortOrder = new Map<number, number>();

  const [countResult] = await pool.query(
    `SELECT COUNT(*) as total
     FROM Student_Inquiry si
     LEFT JOIN course_mst c ON si.Course_Id = c.Course_Id
     LEFT JOIN MST_Deciplin md ON md.Id = CAST(NULLIF(TRIM(si.Discipline),'') AS UNSIGNED)
     ${whereClause}`,
    queryParams
  );
  total = (countResult as any[])[0]?.total || 0;

  const [sortedIds] = await pool.query(
    `SELECT si.Inquiry_Id
     FROM Student_Inquiry si
     LEFT JOIN course_mst c ON si.Course_Id = c.Course_Id
     LEFT JOIN MST_Deciplin md ON md.Id = CAST(NULLIF(TRIM(si.Discipline),'') AS UNSIGNED)
     ${whereClause}
     ORDER BY COALESCE(
       STR_TO_DATE(LEFT(NULLIF(TRIM(si.Inquiry_Dt),''),19),'%Y-%m-%d %H:%i:%s'),
       STR_TO_DATE(LEFT(NULLIF(TRIM(si.Inquiry_Dt),''),10),'%Y-%m-%d'),
       STR_TO_DATE(LEFT(NULLIF(TRIM(si.Inquiry_Dt),''),10),'%d-%m-%Y'),
       STR_TO_DATE(LEFT(NULLIF(TRIM(si.Inquiry_Dt),''),10),'%d/%m/%Y')
     ) DESC, si.Inquiry_Id DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, limit, offset]
  );
  pageIds = (sortedIds as any[]).map((r: any) => r.Inquiry_Id);
  sortOrder = new Map((sortedIds as any[]).map((r: any, i: number) => [r.Inquiry_Id, i]));

  // Fetch full rows for page IDs
  let dataRows: any[] = [];
  if (pageIds.length > 0) {
    const ph = pageIds.map(() => '?').join(',');
    const locationSelect = locationColumn ? `si.${locationColumn} as Location,` : 'NULL as Location,';
    const [rows] = await pool.query(
      `SELECT
         si.Inquiry_Id as Student_Id, si.Student_Id as SourceStudentId,
         si.Student_Name, c.Course_Name as CourseName, si.Inquiry_Dt,
         si.Present_Mobile, si.Email, ${locationSelect}
         si.Discipline, ${DISCIPLINE_NAME_EXPR} as DisciplineName,
         si.Inquiry_From, si.Inquiry_Type,
         si.OnlineState as OnlineStateRaw,
         CAST(NULLIF(si.OnlineState,'') AS UNSIGNED) as Status_id,
         si.Discussion as InlineDiscussion,
         ld.discussion as LatestDiscussion, ld.date as LatestDiscDate,
         ld.nextdate as NextFollowUpDate, ld.created_by as LatestDiscussionById,
         COALESCE(
           NULLIF(TRIM(CONCAT(COALESCE(au.firstname,''),' ',COALESCE(au.lastname,''))),''),
           NULLIF(TRIM(au.username),''), NULLIF(TRIM(au.email),''),
           NULLIF(TRIM(oe.Employee_Name),'')
         ) as LatestDiscussionByName
       FROM Student_Inquiry si
       LEFT JOIN course_mst c ON si.Course_Id = c.Course_Id
       LEFT JOIN MST_Deciplin md ON md.Id = CAST(NULLIF(TRIM(si.Discipline),'') AS UNSIGNED)
       LEFT JOIN (
         SELECT si_map.Inquiry_Id as InquiryId, MAX(d.id) as max_id
         FROM Student_Inquiry si_map
         INNER JOIN awt_inquirydiscussion d ON d.deleted = 0 AND (
           d.Inquiry_id = si_map.Inquiry_Id OR d.Inquiry_id = si_map.Student_Id
         )
         WHERE si_map.Inquiry_Id IN (${ph})
         GROUP BY si_map.Inquiry_Id
       ) tld ON tld.InquiryId = si.Inquiry_Id
       LEFT JOIN awt_inquirydiscussion ld ON ld.id = tld.max_id
       LEFT JOIN awt_adminuser au ON au.id = ld.created_by
       LEFT JOIN office_employee_mst oe ON oe.Emp_Id = ld.created_by
       WHERE si.Inquiry_Id IN (${ph})`,
      [...pageIds, ...pageIds]
    );
    dataRows = (rows as any[]).sort(
      (a: any, b: any) => (sortOrder.get(a.Student_Id) ?? 0) - (sortOrder.get(b.Student_Id) ?? 0)
    );
  }

  // Filter option queries (run in parallel)
  const [disciplinesResult, typesResult, trainingsResult, statusOptions] = await Promise.all([
    pool.query(
      `SELECT DISTINCT ${DISCIPLINE_NAME_EXPR} as Discipline
       FROM Student_Inquiry si
       LEFT JOIN MST_Deciplin md ON md.Id = CAST(NULLIF(TRIM(si.Discipline),'') AS UNSIGNED)
       WHERE ${DISCIPLINE_NAME_EXPR} IS NOT NULL
         AND ${DISCIPLINE_NAME_EXPR} NOT IN ('NULL','Select')
         AND (si.IsDelete = 0 OR si.IsDelete IS NULL)
       ORDER BY Discipline`
    ),
    pool.query(
      `SELECT DISTINCT Inquiry_Type FROM Student_Inquiry
       WHERE Inquiry_Type IS NOT NULL AND Inquiry_Type != ''
         AND (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Inquiry_Type`
    ),
    pool.query(
      `SELECT DISTINCT c.Course_Name FROM Student_Inquiry si
       LEFT JOIN course_mst c ON si.Course_Id = c.Course_Id
       WHERE c.Course_Name IS NOT NULL AND c.Course_Name != ''
         AND (si.IsDelete = 0 OR si.IsDelete IS NULL) ORDER BY c.Course_Name`
    ),
    loadStatusOptions(pool),
  ]);

  const statusMap = Object.fromEntries(statusOptions.map((s) => [s.id, s.label]));

  const rows: InquiryRow[] = dataRows.map((r: any) => {
    const inlineDisc = r.InlineDiscussion && r.InlineDiscussion !== 'NULL' ? r.InlineDiscussion : null;
    const sourceStudentId = r.SourceStudentId == null ? '' : String(r.SourceStudentId).trim();
    const inquiryTypeVal = r.Inquiry_Type?.trim()
      ? r.Inquiry_Type.trim()
      : sourceStudentId === '' ? 'Online Inquiry' : null;
    const disciplineVal =
      (r.DisciplineName?.trim() || r.Discipline?.trim() || null);
    const cleanDiscipline =
      disciplineVal && !['NULL', 'Select'].includes(disciplineVal) ? disciplineVal : null;

    return {
      Student_Id: r.Student_Id,
      Student_Name: r.Student_Name,
      CourseName: r.CourseName ?? null,
      Inquiry_Dt: r.Inquiry_Dt ?? null,
      Present_Mobile: r.Present_Mobile ?? null,
      Email: r.Email ?? null,
      Location: r.Location?.trim() || null,
      Discipline: cleanDiscipline,
      Inquiry_From: r.Inquiry_From ?? null,
      Inquiry_Type: inquiryTypeVal,
      Status_id: r.Status_id ?? null,
      StatusLabel:
        statusMap[r.Status_id] ??
        (r.OnlineStateRaw?.trim() || null) ??
        (r.Status_id != null ? `Status ${r.Status_id}` : 'Open'),
      Discussion: r.LatestDiscussion || inlineDisc || null,
      DiscussionDate: r.LatestDiscDate ?? null,
      NextFollowUpDate: r.NextFollowUpDate ?? null,
      FollowUpBy: r.LatestDiscussionByName || (r.LatestDiscussionById != null ? `User ${r.LatestDiscussionById}` : null),
    };
  });

  return {
    rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    filters: {
      disciplines: (disciplinesResult[0] as any[]).map((d: any) => d.Discipline),
      inquiryTypes: (typesResult[0] as any[]).map((t: any) => t.Inquiry_Type),
      trainings: (trainingsResult[0] as any[]).map((r: any) => r.Course_Name),
      statusOptions,
    },
  };
}

export async function updateInquiry(id: number, data: UpdateInquiryInput): Promise<void> {
  if (!data.Student_Name?.trim()) throw new Error('Name is required');

  const pool = getPool();
  await pool.query(
    `UPDATE Student_Inquiry SET
       Student_Name=?, Sex=?, DOB=?,
       Present_Mobile=?, Present_Mobile2=?,
       Email=?, Nationality=?, Present_Country=?,
       Discussion=?, OnlineState=?, Inquiry_Dt=?,
       Inquiry_From=?, Inquiry_Type=?,
       Course_Id=?, Batch_Category_id=?, Batch_Code=?,
       Qualification=?, Discipline=?, Percentage=?
     WHERE Inquiry_Id=?`,
    [
      data.Student_Name.trim(),
      data.Sex ?? null,
      data.DOB ?? null,
      data.Present_Mobile ?? null,
      data.Present_Mobile2 ?? null,
      data.Email?.trim() ?? null,
      data.Nationality ?? null,
      data.Present_Country ?? null,
      data.Discussion?.trim() ?? null,
      data.Status_id ?? 1,
      data.Inquiry_Dt ?? null,
      data.Inquiry_From ?? null,
      data.Inquiry_Type ?? null,
      data.Course_Id ?? null,
      data.Batch_Category_id ?? null,
      data.Batch_Code ?? null,
      data.Qualification ?? null,
      data.Discipline ?? null,
      data.Percentage ?? null,
      id,
    ]
  );

  if (data.Discussion?.trim()) {
    await pool.query(
      `INSERT INTO awt_inquirydiscussion (Inquiry_id, date, discussion, deleted, created_by, created_date)
       VALUES (?, CURDATE(), ?, 0, 1, NOW())`,
      [id, data.Discussion.trim()]
    );
  }
}
