/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPool, cached } from '@/lib/db';
import { resolveInquiryTableName } from '@/lib/services/inquiry.service';

let personSchemaReady: Promise<void> | null = null;

async function ensurePersonSchema(pool: ReturnType<typeof getPool>): Promise<void> {
  if (!personSchemaReady) {
    personSchemaReady = cached('schema:person_master', 60 * 60 * 1000, async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS person_master (
          Person_Id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          Name VARCHAR(255) NULL,
          Mobile VARCHAR(30) NULL,
          Email VARCHAR(191) NULL,
          Normalized_Mobile VARCHAR(10) NULL,
          Normalized_Email VARCHAR(191) NULL,
          Created_At TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          Updated_At TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (Person_Id),
          UNIQUE KEY uq_person_mobile (Normalized_Mobile),
          UNIQUE KEY uq_person_email (Normalized_Email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS person_identity_conflicts (
          Id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          Inquiry_Id INT NOT NULL,
          Mobile_Person_Id INT UNSIGNED NULL,
          Email_Person_Id INT UNSIGNED NULL,
          Incoming_Mobile VARCHAR(30) NULL,
          Incoming_Email VARCHAR(191) NULL,
          Status ENUM('pending','resolved') NOT NULL DEFAULT 'pending',
          Created_At TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          Resolved_At TIMESTAMP NULL,
          PRIMARY KEY (Id),
          KEY idx_conflict_status (Status, Created_At)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      return true;
    }).then(() => undefined);
  }
  return personSchemaReady;
}

const inquiryPersonColumnReadyTables = new Set<string>();

/** Adds Person_Id / Is_Re_Enquiry to student_inquiry on demand. Compact types only —
 * the table is already near InnoDB's row-size limit (see inquiry.service.ts). */
export async function ensureInquiryPersonColumns(
  pool: ReturnType<typeof getPool>,
  inquiryTable: string
): Promise<void> {
  if (inquiryPersonColumnReadyTables.has(inquiryTable)) return;

  await cached(`schema:inquiry_person_columns:${inquiryTable}`, 60 * 60 * 1000, async () => {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
         AND COLUMN_NAME IN ('Person_Id','Is_Re_Enquiry')`,
      [inquiryTable]
    );
    const existing = new Set((rows as any[]).map((r) => String(r.COLUMN_NAME)));

    if (!existing.has('Person_Id')) {
      await pool.query(`ALTER TABLE \`${inquiryTable}\` ADD COLUMN Person_Id INT UNSIGNED NULL`);
    }
    if (!existing.has('Is_Re_Enquiry')) {
      await pool.query(`ALTER TABLE \`${inquiryTable}\` ADD COLUMN Is_Re_Enquiry TINYINT(1) NULL DEFAULT 0`);
    }

    const [indexRows] = await pool.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = 'idx_si_person'`,
      [inquiryTable]
    );
    if ((indexRows as any[]).length === 0) {
      await pool.query(`ALTER TABLE \`${inquiryTable}\` ADD INDEX idx_si_person (Person_Id)`);
    }

    return true;
  });

  inquiryPersonColumnReadyTables.add(inquiryTable);
}

// ── Normalization ────────────────────────────────────────────────────────────

/** Strips formatting and keeps the last 10 digits, so +91 98765-43210, 98765 43210,
 * and 9876543210 all resolve to the same identity. Returns null if unusable. */
export function normalizeMobile(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

export function normalizeEmail(raw: unknown): string | null {
  const email = String(raw ?? '').trim().toLowerCase();
  return email || null;
}

// ── Resolve / match ───────────────────────────────────────────────────────────

export interface PersonMatch {
  Inquiry_Id: number;
  CourseName: string | null;
  Inquiry_Dt: string | null;
  StatusLabel: string | null;
  Is_Re_Enquiry?: number | null;
  Discipline?: string | null;
  Source?: string | null;
  Status_id?: number | null;
  Discussion?: string | null;
  DiscussionDate?: string | null;
}

export interface ResolvePersonResult {
  personId: number | null;
  isNew: boolean;
  conflict: boolean;
  mobilePersonId?: number | null;
  emailPersonId?: number | null;
}

interface PersonRow {
  Person_Id: number;
  Name: string | null;
  Mobile: string | null;
  Email: string | null;
}

async function findPersonByNormalizedMobile(
  pool: ReturnType<typeof getPool>,
  normalizedMobile: string
): Promise<PersonRow | null> {
  const [rows] = await pool.query(
    `SELECT Person_Id, Name, Mobile, Email FROM person_master WHERE Normalized_Mobile = ? LIMIT 1`,
    [normalizedMobile]
  );
  return (rows as PersonRow[])[0] ?? null;
}

async function findPersonByNormalizedEmail(
  pool: ReturnType<typeof getPool>,
  normalizedEmail: string
): Promise<PersonRow | null> {
  const [rows] = await pool.query(
    `SELECT Person_Id, Name, Mobile, Email FROM person_master WHERE Normalized_Email = ? LIMIT 1`,
    [normalizedEmail]
  );
  return (rows as PersonRow[])[0] ?? null;
}

async function createPerson(
  pool: ReturnType<typeof getPool>,
  opts: { name: string | null; mobile: string | null; email: string | null; normalizedMobile: string | null; normalizedEmail: string | null }
): Promise<number> {
  const [result] = await pool.query<any>(
    `INSERT INTO person_master (Name, Mobile, Email, Normalized_Mobile, Normalized_Email)
     VALUES (?, ?, ?, ?, ?)`,
    [opts.name || null, opts.mobile || null, opts.email || null, opts.normalizedMobile, opts.normalizedEmail]
  );
  return Number(result.insertId);
}

async function fillBlanksOnPerson(
  pool: ReturnType<typeof getPool>,
  personId: number,
  opts: { name: string | null; mobile: string | null; email: string | null; normalizedMobile: string | null; normalizedEmail: string | null }
): Promise<void> {
  await pool.query(
    `UPDATE person_master SET
       Name = CASE WHEN (Name IS NULL OR TRIM(Name)='') THEN ? ELSE Name END,
       Mobile = CASE WHEN (Mobile IS NULL OR TRIM(Mobile)='') THEN ? ELSE Mobile END,
       Email = CASE WHEN (Email IS NULL OR TRIM(Email)='') THEN ? ELSE Email END,
       Normalized_Mobile = CASE WHEN Normalized_Mobile IS NULL THEN ? ELSE Normalized_Mobile END,
       Normalized_Email = CASE WHEN Normalized_Email IS NULL THEN ? ELSE Normalized_Email END
     WHERE Person_Id = ?`,
    [opts.name || null, opts.mobile || null, opts.email || null, opts.normalizedMobile, opts.normalizedEmail, personId]
  );
}

/**
 * Resolves (and, if needed, creates) the person_master row for an incoming enquiry.
 * Never merges two distinct existing people — a mobile match to Person A and an
 * email match to Person B is returned as a conflict, not auto-linked either way.
 */
export async function resolvePersonForEnquiry(opts: {
  name?: string | null;
  mobile?: string | null;
  email?: string | null;
}): Promise<ResolvePersonResult> {
  const pool = getPool();
  await ensurePersonSchema(pool);

  const normalizedMobile = normalizeMobile(opts.mobile);
  const normalizedEmail = normalizeEmail(opts.email);
  const name = opts.name?.trim() || null;
  const mobile = opts.mobile?.toString().trim() || null;
  const email = opts.email?.toString().trim() || null;

  if (!normalizedMobile && !normalizedEmail) {
    const personId = await createPerson(pool, { name, mobile, email, normalizedMobile, normalizedEmail });
    return { personId, isNew: true, conflict: false };
  }

  const [byMobile, byEmail] = await Promise.all([
    normalizedMobile ? findPersonByNormalizedMobile(pool, normalizedMobile) : Promise.resolve(null),
    normalizedEmail ? findPersonByNormalizedEmail(pool, normalizedEmail) : Promise.resolve(null),
  ]);

  if (byMobile && byEmail && byMobile.Person_Id !== byEmail.Person_Id) {
    return {
      personId: null,
      isNew: false,
      conflict: true,
      mobilePersonId: byMobile.Person_Id,
      emailPersonId: byEmail.Person_Id,
    };
  }

  const matched = byMobile ?? byEmail;
  if (matched) {
    await fillBlanksOnPerson(pool, matched.Person_Id, { name, mobile, email, normalizedMobile, normalizedEmail });
    return { personId: matched.Person_Id, isNew: false, conflict: false };
  }

  const personId = await createPerson(pool, { name, mobile, email, normalizedMobile, normalizedEmail });
  return { personId, isNew: true, conflict: false };
}

/** Read-only preview of resolvePersonForEnquiry — used by the Add-Inquiry popup before
 * it decides whether to ask "Yes / Cancel". Never writes. */
export async function checkExistingPerson(
  mobile?: string | null,
  email?: string | null
): Promise<{ personId: number | null; personName: string | null; conflict: boolean; matches: PersonMatch[] }> {
  const pool = getPool();
  await ensurePersonSchema(pool);

  const normalizedMobile = normalizeMobile(mobile);
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedMobile && !normalizedEmail) {
    return { personId: null, personName: null, conflict: false, matches: [] };
  }

  const [byMobile, byEmail] = await Promise.all([
    normalizedMobile ? findPersonByNormalizedMobile(pool, normalizedMobile) : Promise.resolve(null),
    normalizedEmail ? findPersonByNormalizedEmail(pool, normalizedEmail) : Promise.resolve(null),
  ]);

  if (byMobile && byEmail && byMobile.Person_Id !== byEmail.Person_Id) {
    return { personId: null, personName: null, conflict: true, matches: [] };
  }

  const matched = byMobile ?? byEmail;
  if (!matched) return { personId: null, personName: null, conflict: false, matches: [] };

  const matches = await findPersonEnquiries(matched.Person_Id);
  return { personId: matched.Person_Id, personName: matched.Name, conflict: false, matches };
}

export async function findPersonEnquiries(personId: number): Promise<PersonMatch[]> {
  const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
  const [rows] = await pool.query(
    `SELECT si.Inquiry_Id, c.Course_Name AS CourseName, si.Inquiry_Dt,
            si.Discipline, si.Inquiry_From, si.Inquiry_Type,
            CAST(NULLIF(si.OnlineState,'') AS UNSIGNED) AS Status_id,
            s.Status AS StatusLabel, si.Is_Re_Enquiry, si.Discussion AS InlineDiscussion
     FROM \`${inquiryTable}\` si
     LEFT JOIN course_mst c ON si.Course_Id = c.Course_Id
     LEFT JOIN status_master s ON s.Id = CAST(NULLIF(si.OnlineState,'') AS UNSIGNED)
     WHERE si.Person_Id = ? AND (si.IsDelete = 0 OR si.IsDelete IS NULL)
     ORDER BY si.Inquiry_Dt ASC, si.Inquiry_Id ASC`,
    [personId]
  );
  const enquiries = rows as any[];
  if (enquiries.length === 0) return [];

  // Bounded to this person's own (typically small) enquiry list — cheap IN lookup,
  // not a per-row correlated subquery over the whole discussion table.
  const ids = enquiries.map((r) => r.Inquiry_Id);
  const ph = ids.map(() => '?').join(',');
  const [discRows] = await pool.query(
    `SELECT d1.Inquiry_id, d1.discussion, d1.date
     FROM awt_inquirydiscussion d1
     INNER JOIN (
       SELECT Inquiry_id, MAX(id) AS max_id
       FROM awt_inquirydiscussion
       WHERE deleted = 0 AND Inquiry_id IN (${ph})
       GROUP BY Inquiry_id
     ) latest ON latest.Inquiry_id = d1.Inquiry_id AND latest.max_id = d1.id`,
    ids.map((id) => String(id))
  );
  const discussionByInquiryId = new Map(
    (discRows as any[]).map((r) => [String(r.Inquiry_id), { discussion: r.discussion, date: r.date }])
  );

  return enquiries.map((r) => {
    const latestDisc = discussionByInquiryId.get(String(r.Inquiry_Id));
    return {
      Inquiry_Id: r.Inquiry_Id,
      CourseName: r.CourseName ?? null,
      Inquiry_Dt: r.Inquiry_Dt ?? null,
      StatusLabel: r.StatusLabel ?? null,
      Is_Re_Enquiry: r.Is_Re_Enquiry,
      Discipline: r.Discipline ?? null,
      Source: r.Inquiry_Type || r.Inquiry_From || null,
      Status_id: r.Status_id ?? null,
      Discussion: latestDisc?.discussion ?? r.InlineDiscussion ?? null,
      DiscussionDate: latestDisc?.date ?? null,
    };
  });
}

export async function detectReEnquiry(
  personId: number,
  courseId: number | null | undefined,
  excludeInquiryId?: number | null
): Promise<boolean> {
  if (!personId || !courseId) return false;
  const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
  const [rows] = await pool.query(
    `SELECT 1 FROM \`${inquiryTable}\`
     WHERE Person_Id = ? AND Course_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
       AND (? IS NULL OR Inquiry_Id <> ?)
     LIMIT 1`,
    [personId, courseId, excludeInquiryId ?? null, excludeInquiryId ?? null]
  );
  return (rows as any[]).length > 0;
}

export async function recordIdentityConflict(opts: {
  inquiryId: number;
  mobilePersonId: number | null;
  emailPersonId: number | null;
  mobile: string | null;
  email: string | null;
}): Promise<void> {
  const pool = getPool();
  await ensurePersonSchema(pool);
  await pool.query(
    `INSERT INTO person_identity_conflicts
       (Inquiry_Id, Mobile_Person_Id, Email_Person_Id, Incoming_Mobile, Incoming_Email)
     VALUES (?, ?, ?, ?, ?)`,
    [opts.inquiryId, opts.mobilePersonId, opts.emailPersonId, opts.mobile, opts.email]
  );
}
