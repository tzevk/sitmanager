import type { Pool } from 'mysql2/promise';
import { getPool } from '@/lib/db';

export interface PlacementDeputationOpeningRow {
  id: number;
  company_name: string;
  role: string;
  no_of_positions: number;
  deadline: string | null;
  status: string;
}

export interface PlacementCompanyVisitRow {
  id: number;
  visit_date: string;
  company_name: string;
  person_to_meet: string;
  place: string;
}

export interface PlacementCampusInterviewRow {
  id: number;
  interview_code: string;
  interview_date: string;
  company_name: string;
  role: string;
  interview_type: string;
}

let ensurePlacementDashboardTablesPromise: Promise<void> | null = null;

export async function ensurePlacementDashboardTables(pool: Pool = getPool()): Promise<void> {
  if (!ensurePlacementDashboardTablesPromise) {
    ensurePlacementDashboardTablesPromise = Promise.all([
      pool.query(`
      CREATE TABLE IF NOT EXISTS placement_deputation_openings (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_name VARCHAR(160) NOT NULL,
        role VARCHAR(160) NOT NULL,
        no_of_positions INT NOT NULL DEFAULT 1,
        deadline DATE NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'Open',
        is_deleted TINYINT NOT NULL DEFAULT 0,
        created_by INT NULL,
        updated_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_placement_deputation_openings_active (is_deleted, status, deadline),
        KEY idx_placement_deputation_openings_updated (updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `),
      pool.query(`
      CREATE TABLE IF NOT EXISTS placement_company_visits (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        visit_date DATE NOT NULL,
        company_name VARCHAR(160) NOT NULL,
        person_to_meet VARCHAR(160) NOT NULL,
        place VARCHAR(160) NOT NULL,
        is_deleted TINYINT NOT NULL DEFAULT 0,
        created_by INT NULL,
        updated_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_placement_company_visits_active (is_deleted, visit_date),
        KEY idx_placement_company_visits_updated (updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `),
      pool.query(`
      CREATE TABLE IF NOT EXISTS placement_interview_master (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        interview_code VARCHAR(20) NULL,
        interview_date DATE NOT NULL,
        company_name VARCHAR(160) NOT NULL,
        role VARCHAR(160) NOT NULL,
        interview_type VARCHAR(20) NOT NULL DEFAULT 'On Campus',
        is_deleted TINYINT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_placement_interview_master_code (interview_code),
        KEY idx_interview_master_active (is_deleted, interview_date),
        KEY idx_interview_master_company (company_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `),
    ]).then(() => undefined).catch((error) => {
      ensurePlacementDashboardTablesPromise = null;
      throw error;
    });
  }

  await ensurePlacementDashboardTablesPromise;
  await ensurePlacementInterviewCodeColumn(pool);
}

async function ensurePlacementInterviewCodeColumn(pool: Pool): Promise<void> {
  const [columnRows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'placement_interview_master'
       AND COLUMN_NAME = 'interview_code'`,
  );
  const hasCodeColumn = Number((columnRows as Array<{ count?: number }>)[0]?.count ?? 0) > 0;
  if (!hasCodeColumn) {
    await pool.query(`ALTER TABLE placement_interview_master ADD COLUMN interview_code VARCHAR(20) NULL AFTER id`);
  }

  await pool.query(`
    UPDATE placement_interview_master
    SET interview_code = CONCAT('INT-', LPAD(id, 5, '0'))
    WHERE interview_code IS NULL OR TRIM(interview_code) = ''
  `);

  const [indexRows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'placement_interview_master'
       AND INDEX_NAME = 'uq_placement_interview_master_code'`,
  );
  const hasCodeIndex = Number((indexRows as Array<{ count?: number }>)[0]?.count ?? 0) > 0;
  if (!hasCodeIndex) {
    await pool.query(`ALTER TABLE placement_interview_master ADD UNIQUE KEY uq_placement_interview_master_code (interview_code)`);
  }
}

function normalizeStatus(value: unknown): string {
  const status = String(value ?? 'Open').trim();
  return ['Open', 'Closed', 'On Hold'].includes(status) ? status : 'Open';
}

export async function getPlacementDeputationOpenings(pool: Pool = getPool()): Promise<PlacementDeputationOpeningRow[]> {
  await ensurePlacementDashboardTables(pool);
  const [rows] = await pool.query(`
    SELECT
      id,
      company_name,
      role,
      no_of_positions,
      DATE_FORMAT(deadline, '%Y-%m-%d') AS deadline,
      status
    FROM placement_deputation_openings
    WHERE is_deleted = 0
    ORDER BY
      CASE status WHEN 'Open' THEN 0 WHEN 'On Hold' THEN 1 ELSE 2 END,
      deadline IS NULL ASC,
      deadline ASC,
      updated_at DESC
    LIMIT 50
  `);
  return rows as PlacementDeputationOpeningRow[];
}

export async function createPlacementDeputationOpening(params: {
  companyName: string;
  role: string;
  noOfPositions: number;
  deadline?: string | null;
  status?: string | null;
  userId?: number | null;
}, pool: Pool = getPool()): Promise<PlacementDeputationOpeningRow> {
  await ensurePlacementDashboardTables(pool);

  const companyName = params.companyName.trim().slice(0, 160);
  const role = params.role.trim().slice(0, 160);
  if (!companyName) throw new Error('Company name is required');
  if (!role) throw new Error('Role is required');

  const noOfPositions = Math.max(1, Math.min(9999, Math.floor(Number(params.noOfPositions) || 1)));
  const deadline = params.deadline?.trim() || null;
  const status = normalizeStatus(params.status);

  const [result] = await pool.query(
    `INSERT INTO placement_deputation_openings
       (company_name, role, no_of_positions, deadline, status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [companyName, role, noOfPositions, deadline, status, params.userId ?? null, params.userId ?? null],
  );

  const id = Number((result as { insertId?: number }).insertId || 0);
  return {
    id,
    company_name: companyName,
    role,
    no_of_positions: noOfPositions,
    deadline,
    status,
  };
}

export async function deletePlacementDeputationOpening(params: {
  id: number;
  userId?: number | null;
}, pool: Pool = getPool()): Promise<void> {
  await ensurePlacementDashboardTables(pool);
  await pool.query(
    `UPDATE placement_deputation_openings
     SET is_deleted = 1, updated_by = ?
     WHERE id = ? AND is_deleted = 0`,
    [params.userId ?? null, params.id],
  );
}

export async function getPlacementCompanyVisits(pool: Pool = getPool()): Promise<PlacementCompanyVisitRow[]> {
  await ensurePlacementDashboardTables(pool);
  const [rows] = await pool.query(`
    SELECT
      id,
      DATE_FORMAT(visit_date, '%Y-%m-%d') AS visit_date,
      company_name,
      person_to_meet,
      place
    FROM placement_company_visits
    WHERE is_deleted = 0
    ORDER BY visit_date ASC, updated_at DESC
    LIMIT 50
  `);
  return rows as PlacementCompanyVisitRow[];
}

export async function createPlacementCompanyVisit(params: {
  visitDate: string;
  companyName: string;
  personToMeet: string;
  place: string;
  userId?: number | null;
}, pool: Pool = getPool()): Promise<PlacementCompanyVisitRow> {
  await ensurePlacementDashboardTables(pool);

  const visitDate = params.visitDate.trim();
  const companyName = params.companyName.trim().slice(0, 160);
  const personToMeet = params.personToMeet.trim().slice(0, 160);
  const place = params.place.trim().slice(0, 160);
  if (!visitDate) throw new Error('Date is required');
  if (!companyName) throw new Error('Company name is required');
  if (!personToMeet) throw new Error('Person to meet is required');
  if (!place) throw new Error('Place is required');

  const [result] = await pool.query(
    `INSERT INTO placement_company_visits
       (visit_date, company_name, person_to_meet, place, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [visitDate, companyName, personToMeet, place, params.userId ?? null, params.userId ?? null],
  );

  const id = Number((result as { insertId?: number }).insertId || 0);
  return {
    id,
    visit_date: visitDate,
    company_name: companyName,
    person_to_meet: personToMeet,
    place,
  };
}

export async function deletePlacementCompanyVisit(params: {
  id: number;
  userId?: number | null;
}, pool: Pool = getPool()): Promise<void> {
  await ensurePlacementDashboardTables(pool);
  await pool.query(
    `UPDATE placement_company_visits
     SET is_deleted = 1, updated_by = ?
     WHERE id = ? AND is_deleted = 0`,
    [params.userId ?? null, params.id],
  );
}

export async function getPlacementCampusInterviews(pool: Pool = getPool()): Promise<PlacementCampusInterviewRow[]> {
  await ensurePlacementDashboardTables(pool);
  const [rows] = await pool.query(`
    SELECT
      id,
      COALESCE(NULLIF(TRIM(interview_code), ''), CONCAT('INT-', LPAD(id, 5, '0'))) AS interview_code,
      DATE_FORMAT(interview_date, '%Y-%m-%d') AS interview_date,
      company_name,
      role,
      interview_type
    FROM placement_interview_master
    WHERE is_deleted = 0
    ORDER BY interview_date ASC, updated_at DESC, id DESC
    LIMIT 50
  `);
  return rows as PlacementCampusInterviewRow[];
}