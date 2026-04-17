/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader } from 'mysql2';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { getSession } from '@/lib/session';
import { logTableActivity } from '@/lib/activity-log';

async function ensureColumn(
  pool: ReturnType<typeof getPool>,
  table: string,
  columnName: string,
  columnType: string
) {
  const [rows] = await pool.query<any[]>(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, columnName]
  );
  const cnt = rows?.[0]?.cnt ?? 0;
  if (cnt === 0) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${columnName} ${columnType}`);
  }
}

async function ensureDeputationTables(pool: ReturnType<typeof getPool>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS deputation_entries (
      ID INT AUTO_INCREMENT PRIMARY KEY,
      Const_Id INT NULL,
      Company_Name VARCHAR(255) NULL,
      Is_Other TINYINT(1) DEFAULT 0,
      Agreement_Status VARCHAR(50) NULL,
      JD_Shared TINYINT(1) DEFAULT 0,
      JD_Shared_Date VARCHAR(50) NULL,
      IsDelete TINYINT(1) DEFAULT 0,
      CreatedBy VARCHAR(100) NULL,
      Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      Updated_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_const (Const_Id),
      INDEX idx_deleted (IsDelete)
    )
  `);
  // Additive columns for evolving schema
  await ensureColumn(pool, 'deputation_entries', 'Contact_Name', 'VARCHAR(255) NULL');
  await ensureColumn(pool, 'deputation_entries', 'Contact_Designation', 'VARCHAR(255) NULL');
  await ensureColumn(pool, 'deputation_entries', 'Contact_Mobile', 'VARCHAR(100) NULL');
  await ensureColumn(pool, 'deputation_entries', 'Contact_Mobile2', 'VARCHAR(100) NULL');
  await ensureColumn(pool, 'deputation_entries', 'Contact_Email', 'VARCHAR(255) NULL');
  await ensureColumn(pool, 'deputation_entries', 'Initial_Discussion', 'MEDIUMTEXT NULL');
  await ensureColumn(pool, 'deputation_entries', 'Current_Phase', `VARCHAR(30) DEFAULT 'proposal'`);
  await ensureColumn(pool, 'deputation_entries', 'Proposal_Status', 'VARCHAR(30) NULL');
  await ensureColumn(pool, 'deputation_entries', 'Agreement_Title', 'VARCHAR(255) NULL');
  await ensureColumn(pool, 'deputation_entries', 'Agreement_Attachment', 'VARCHAR(500) NULL');
  await ensureColumn(pool, 'deputation_entries', 'Deputation_Percentage', 'VARCHAR(50) NULL');
  await ensureColumn(pool, 'deputation_entries', 'Negotiation_Decision', 'VARCHAR(30) NULL');
  await ensureColumn(pool, 'deputation_entries', 'Tenure_Details', 'MEDIUMTEXT NULL');
  await ensureColumn(pool, 'deputation_entries', 'Service_Type', `VARCHAR(30) DEFAULT 'deputation'`);
  await ensureColumn(pool, 'deputation_entries', 'Agreement_Client_Name', 'VARCHAR(500) NULL');
  await ensureColumn(pool, 'deputation_entries', 'Agreement_Client_Address', 'MEDIUMTEXT NULL');
  await ensureColumn(pool, 'deputation_entries', 'Agreement_Date', 'VARCHAR(50) NULL');
  await ensureColumn(pool, 'deputation_entries', 'Agreement_Scope', 'MEDIUMTEXT NULL');
  await ensureColumn(pool, 'deputation_entries', 'Fee_Annual_CTC', 'VARCHAR(100) NULL');
  await ensureColumn(pool, 'deputation_entries', 'Fee_Internship', 'VARCHAR(100) NULL');
  await ensureColumn(pool, 'deputation_entries', 'Fee_Deputation_Monthly', 'VARCHAR(100) NULL');
  await ensureColumn(pool, 'deputation_entries', 'Fee_Replacement_Period', 'VARCHAR(100) NULL');
  await ensureColumn(pool, 'deputation_entries', 'Fee_Payment_Credit', 'VARCHAR(100) NULL');
  await ensureColumn(pool, 'deputation_entries', 'Fee_Agreement_Tenure', 'VARCHAR(100) NULL');
  await ensureColumn(pool, 'deputation_entries', 'Followup_Id', 'INT NULL');
  // Allow Company_Name nullable for legacy rows
  try {
    await pool.query(`ALTER TABLE deputation_entries MODIFY COLUMN Company_Name VARCHAR(255) NULL`);
  } catch { /* ignore */ }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS deputation_negotiations (
      ID INT AUTO_INCREMENT PRIMARY KEY,
      Deputation_Id INT NOT NULL,
      Negotiation_Date VARCHAR(50) NULL,
      Discussion MEDIUMTEXT NULL,
      CreatedBy VARCHAR(100) NULL,
      Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_deputation (Deputation_Id)
    )
  `);
  await ensureColumn(pool, 'deputation_negotiations', 'Phase', `VARCHAR(20) DEFAULT 'negotiation'`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS deputation_positions (
      ID INT AUTO_INCREMENT PRIMARY KEY,
      Deputation_Id INT NOT NULL,
      Position_Title VARCHAR(255) NULL,
      Total_Requirement INT NULL,
      Short_Description MEDIUMTEXT NULL,
      Working_Location VARCHAR(255) NULL,
      Status VARCHAR(20) DEFAULT 'Open',
      Interview_Arrangement MEDIUMTEXT NULL,
      Went_Ahead TINYINT(1) DEFAULT 0,
      Joining_Date VARCHAR(50) NULL,
      Closed_By VARCHAR(100) NULL,
      Closing_Notes MEDIUMTEXT NULL,
      IsDelete TINYINT(1) DEFAULT 0,
      CreatedBy VARCHAR(100) NULL,
      Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      Updated_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_deputation (Deputation_Id),
      INDEX idx_status (Status)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS deputation_candidates (
      ID INT AUTO_INCREMENT PRIMARY KEY,
      Position_Id INT NOT NULL,
      Deputation_Id INT NULL,
      Candidate_Name VARCHAR(255) NULL,
      Mobile VARCHAR(100) NULL,
      Email VARCHAR(255) NULL,
      Status VARCHAR(30) DEFAULT 'Shortlisted',
      Offer_Letter_Shared TINYINT(1) DEFAULT 0,
      Offer_Letter_Date VARCHAR(50) NULL,
      Joining_Date VARCHAR(50) NULL,
      Notes MEDIUMTEXT NULL,
      IsDelete TINYINT(1) DEFAULT 0,
      CreatedBy VARCHAR(100) NULL,
      Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      Updated_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_position (Position_Id),
      INDEX idx_deputation (Deputation_Id)
    )
  `);

  await ensureColumn(pool, 'consultant_follows', 'Entry_Type', `VARCHAR(20) NULL`);
}

async function resolveCompanyName(pool: ReturnType<typeof getPool>, constId: number): Promise<string> {
  const [rows] = await pool.query<any[]>(
    `SELECT Comp_Name FROM consultant_mst WHERE Const_Id = ? LIMIT 1`,
    [constId]
  );
  return String(rows?.[0]?.Comp_Name || '').trim();
}

// GET - list deputation entries for a consultancy (with nested negotiations + positions + candidates)
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, [
      'consultancy.view',
      'consultancy.update',
      'consultancy.create',
    ]);
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    await ensureDeputationTables(pool);

    const { searchParams } = new URL(req.url);
    const constId = Number(searchParams.get('constId') || searchParams.get('Const_Id') || 0);

    if (!constId) return NextResponse.json({ error: 'constId is required' }, { status: 400 });

    const [entries] = await pool.query<any[]>(
      `SELECT e.ID AS Deputation_Id,
              e.Const_Id,
              e.Company_Name,
              e.Contact_Name,
              e.Contact_Designation,
              e.Contact_Mobile,
              e.Contact_Mobile2,
              e.Contact_Email,
              e.Initial_Discussion,
              e.Current_Phase,
              e.Proposal_Status,
              e.Agreement_Title,
              e.Agreement_Attachment,
              e.Deputation_Percentage,
              e.Negotiation_Decision,
              e.Tenure_Details,
              e.Service_Type,
              e.Agreement_Client_Name,
              e.Agreement_Client_Address,
              e.Agreement_Date,
              e.Agreement_Scope,
              e.Fee_Annual_CTC,
              e.Fee_Internship,
              e.Fee_Deputation_Monthly,
              e.Fee_Replacement_Period,
              e.Fee_Payment_Credit,
              e.Fee_Agreement_Tenure,
              e.Agreement_Status,
              e.JD_Shared,
              e.JD_Shared_Date,
              e.Followup_Id,
              e.Created_At,
              e.Updated_At,
              COALESCE(
                NULLIF(TRIM(CONCAT(COALESCE(au.firstname, ''), ' ', COALESCE(au.lastname, ''))), ''),
                NULLIF(TRIM(au.username), ''),
                NULLIF(TRIM(au.email), ''),
                NULLIF(TRIM(oe.Employee_Name), ''),
                NULLIF(TRIM(e.CreatedBy), ''),
                'System'
              ) AS Created_By
       FROM deputation_entries e
       LEFT JOIN awt_adminuser au
         ON au.id = CAST(NULLIF(TRIM(e.CreatedBy), '') AS UNSIGNED)
       LEFT JOIN office_employee_mst oe
         ON oe.Emp_Id = CAST(NULLIF(TRIM(e.CreatedBy), '') AS UNSIGNED)
       WHERE e.Const_Id = ? AND (e.IsDelete = 0 OR e.IsDelete IS NULL)
       ORDER BY e.ID DESC`,
      [constId]
    );

    const ids = entries.map(e => e.Deputation_Id);
    let negotiations: any[] = [];
    let positions: any[] = [];
    let candidates: any[] = [];
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      const [negRows] = await pool.query<any[]>(
        `SELECT ID, Deputation_Id, Negotiation_Date, Discussion, Phase, Created_At
         FROM deputation_negotiations
         WHERE Deputation_Id IN (${placeholders})
         ORDER BY ID DESC`,
        ids
      );
      negotiations = negRows;
      const [posRows] = await pool.query<any[]>(
        `SELECT ID, Deputation_Id, Position_Title, Total_Requirement, Short_Description,
                Working_Location, Status, Interview_Arrangement, Went_Ahead, Joining_Date,
                Closed_By, Closing_Notes, Created_At, Updated_At
         FROM deputation_positions
         WHERE Deputation_Id IN (${placeholders})
           AND (IsDelete = 0 OR IsDelete IS NULL)
         ORDER BY ID DESC`,
        ids
      );
      positions = posRows;

      if (posRows.length) {
        const positionIds = posRows.map(p => p.ID);
        const posPlaceholders = positionIds.map(() => '?').join(',');
        const [candRows] = await pool.query<any[]>(
          `SELECT ID, Position_Id, Deputation_Id, Candidate_Name, Mobile, Email,
                  Status, Offer_Letter_Shared, Offer_Letter_Date, Joining_Date, Notes,
                  Created_At, Updated_At
           FROM deputation_candidates
           WHERE Position_Id IN (${posPlaceholders})
             AND (IsDelete = 0 OR IsDelete IS NULL)
           ORDER BY ID DESC`,
          positionIds
        );
        candidates = candRows;
      }
    }

    const byEntry = new Map<number, { negotiations: any[]; positions: any[] }>();
    entries.forEach(e => byEntry.set(e.Deputation_Id, { negotiations: [], positions: [] }));
    negotiations.forEach(n => byEntry.get(n.Deputation_Id)?.negotiations.push(n));
    positions.forEach(p => byEntry.get(p.Deputation_Id)?.positions.push(p));

    const candidatesByPosition = new Map<number, any[]>();
    candidates.forEach(c => {
      if (!candidatesByPosition.has(c.Position_Id)) candidatesByPosition.set(c.Position_Id, []);
      candidatesByPosition.get(c.Position_Id)!.push(c);
    });

    const rows = entries.map(e => ({
      ...e,
      JD_Shared: !!e.JD_Shared,
      negotiations: byEntry.get(e.Deputation_Id)?.negotiations ?? [],
      positions: (byEntry.get(e.Deputation_Id)?.positions ?? []).map(p => ({
        ...p,
        Went_Ahead: !!p.Went_Ahead,
        candidates: (candidatesByPosition.get(p.ID) ?? []).map(c => ({
          ...c,
          Offer_Letter_Shared: !!c.Offer_Letter_Shared,
        })),
      })),
    }));

    await logTableActivity(req, {
      tableName: 'deputation_entries',
      action: 'VIEW',
      recordId: constId,
    });

    return NextResponse.json({ rows });
  } catch (err: unknown) {
    console.error('Deputation GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - create a deputation entry (also logs into consultant_follows as a purple-tagged row)
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['consultancy.create', 'consultancy.update']);
    if (auth instanceof NextResponse) return auth;
    const session = await getSession(req);
    const pool = getPool();
    await ensureDeputationTables(pool);

    const body = await req.json();
    const constId = Number(body.constId || body.Const_Id || 0);
    if (!constId) return NextResponse.json({ error: 'constId is required' }, { status: 400 });

    const contactName = body.Contact_Name ? String(body.Contact_Name).trim() : '';
    const contactDesignation = body.Contact_Designation ? String(body.Contact_Designation).trim() : null;
    const contactMobile = body.Contact_Mobile ? String(body.Contact_Mobile).trim() : null;
    const contactMobile2 = body.Contact_Mobile2 ? String(body.Contact_Mobile2).trim() : null;
    const contactEmail = body.Contact_Email ? String(body.Contact_Email).trim() : null;
    const initialDiscussion = body.Initial_Discussion ? String(body.Initial_Discussion).trim() : null;
    const rawServiceType = body.Service_Type ? String(body.Service_Type).trim().toLowerCase() : 'deputation';
    const serviceType = ['deputation', 'permanent', 'contract'].includes(rawServiceType) ? rawServiceType : 'deputation';

    if (!contactName) return NextResponse.json({ error: 'Contact name is required' }, { status: 400 });

    const companyName = await resolveCompanyName(pool, constId);
    const createdBy = session?.userId != null ? String(session.userId) : null;

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO deputation_entries
       (Const_Id, Company_Name, Contact_Name, Contact_Designation, Contact_Mobile, Contact_Mobile2,
        Contact_Email, Initial_Discussion, Service_Type, Current_Phase, IsDelete, CreatedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposal', 0, ?)`,
      [
        constId,
        companyName || null,
        contactName,
        contactDesignation,
        contactMobile,
        contactMobile2,
        contactEmail,
        initialDiscussion,
        serviceType,
        createdBy,
      ]
    );

    const deputationId = result.insertId;

    // Mirror the entry into consultant_follows so it shows up in the follow-up list (purple).
    let followupId: number | null = null;
    try {
      const [followupInsert] = await pool.query<ResultSetHeader>(
        `INSERT INTO consultant_follows
         (Consultant_Id, CName, Phone, Email, Designation, Purpose, Remark, Tdate, DirectLine,
          Course, nextdate, IsActive, IsDelete, CreatedBy, Entry_Type)
         VALUES (?, ?, ?, ?, ?, 'Deputation', ?, ?, ?, NULL, NULL, '1', 0, ?, 'deputation')`,
        [
          String(constId),
          contactName,
          contactMobile,
          contactEmail,
          contactDesignation,
          initialDiscussion,
          new Date().toISOString().slice(0, 10),
          contactMobile2,
          createdBy,
        ]
      );
      followupId = followupInsert.insertId;
      await pool.query(
        `UPDATE deputation_entries SET Followup_Id = ? WHERE ID = ?`,
        [followupId, deputationId]
      );
    } catch (err) {
      console.warn('Deputation entry created but follow-up mirror failed:', err);
    }

    await logTableActivity(req, {
      tableName: 'deputation_entries',
      action: 'CREATE',
      recordId: deputationId,
      details: { constId, contactName, followupId },
    });

    return NextResponse.json({ success: true, insertId: deputationId, followupId });
  } catch (err: unknown) {
    console.error('Deputation POST error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - patch selected fields on an entry (phase transitions, agreement info, tenure, etc.)
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'consultancy.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    await ensureDeputationTables(pool);

    const body = await req.json();
    const id = Number(body.id || body.Deputation_Id || 0);
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const updatable: Record<string, unknown> = {
      Contact_Name: body.Contact_Name,
      Contact_Designation: body.Contact_Designation,
      Contact_Mobile: body.Contact_Mobile,
      Contact_Mobile2: body.Contact_Mobile2,
      Contact_Email: body.Contact_Email,
      Initial_Discussion: body.Initial_Discussion,
      Service_Type: body.Service_Type,
      Current_Phase: body.Current_Phase,
      Proposal_Status: body.Proposal_Status,
      Agreement_Title: body.Agreement_Title,
      Agreement_Attachment: body.Agreement_Attachment,
      Deputation_Percentage: body.Deputation_Percentage,
      Agreement_Status: body.Agreement_Status,
      Agreement_Client_Name: body.Agreement_Client_Name,
      Agreement_Client_Address: body.Agreement_Client_Address,
      Agreement_Date: body.Agreement_Date,
      Agreement_Scope: body.Agreement_Scope,
      Fee_Annual_CTC: body.Fee_Annual_CTC,
      Fee_Internship: body.Fee_Internship,
      Fee_Deputation_Monthly: body.Fee_Deputation_Monthly,
      Fee_Replacement_Period: body.Fee_Replacement_Period,
      Fee_Payment_Credit: body.Fee_Payment_Credit,
      Fee_Agreement_Tenure: body.Fee_Agreement_Tenure,
      Negotiation_Decision: body.Negotiation_Decision,
      JD_Shared: body.JD_Shared === true ? 1 : body.JD_Shared === false ? 0 : undefined,
      JD_Shared_Date: body.JD_Shared_Date,
      Tenure_Details: body.Tenure_Details,
    };

    const setParts: string[] = [];
    const values: unknown[] = [];
    for (const [col, val] of Object.entries(updatable)) {
      if (val === undefined) continue;
      setParts.push(`${col} = ?`);
      values.push(typeof val === 'string' ? val.trim() || null : val);
    }

    if (!setParts.length) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    values.push(id);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE deputation_entries
       SET ${setParts.join(', ')}
       WHERE ID = ?
         AND (IsDelete = 0 OR IsDelete IS NULL)`,
      values
    );

    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Deputation entry not found' }, { status: 404 });
    }

    await logTableActivity(req, {
      tableName: 'deputation_entries',
      action: 'UPDATE',
      recordId: id,
      details: { fields: Object.keys(updatable).filter(k => updatable[k] !== undefined) },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Deputation PUT error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - soft delete a deputation entry (and its follow-up mirror)
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'consultancy.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    await ensureDeputationTables(pool);

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get('id') || 0);
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const [rows] = await pool.query<any[]>(
      `SELECT Followup_Id FROM deputation_entries WHERE ID = ? LIMIT 1`,
      [id]
    );
    const followupId = rows?.[0]?.Followup_Id ?? null;

    await pool.query(`UPDATE deputation_entries SET IsDelete = 1 WHERE ID = ?`, [id]);
    if (followupId) {
      await pool.query(`UPDATE consultant_follows SET IsDelete = 1 WHERE ID = ?`, [followupId]);
    }

    await logTableActivity(req, {
      tableName: 'deputation_entries',
      action: 'DELETE',
      recordId: id,
      details: { followupId },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Deputation DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
