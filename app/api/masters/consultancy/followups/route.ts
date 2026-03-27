/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { getSession } from '@/lib/session';

async function ensureFollowupColumn(pool: ReturnType<typeof getPool>, columnName: string, columnType: string) {
  const [rows] = await pool.query<any[]>(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'consultant_followup'
       AND COLUMN_NAME = ?`,
    [columnName]
  );
  const cnt = rows?.[0]?.cnt ?? 0;
  if (cnt === 0) {
    await pool.query(`ALTER TABLE consultant_followup ADD COLUMN ${columnName} ${columnType}`);
  }
}

async function getTableColumns(pool: ReturnType<typeof getPool>, tableName: string): Promise<Set<string>> {
  const [rows] = await pool.query<any[]>(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    [tableName]
  );
  return new Set((rows ?? []).map((r: any) => String(r.COLUMN_NAME)));
}

function pickFirst(existing: Set<string>, candidates: string[]): string | null {
  for (const c of candidates) {
    if (existing.has(c)) return c;
  }
  return null;
}

async function fetchLegacyFollowups(pool: ReturnType<typeof getPool>, constId: string, search: string, companyName?: string | null) {
  const candidates = ['consultant_followup', 'consultancy_followup', 'consultant_followups', 'consultancy_followups'];
  const merged: any[] = [];

  for (const table of candidates) {
    const cols = await getTableColumns(pool, table);
    if (cols.size === 0) continue;

    const idCol = pickFirst(cols, ['Followup_Id', 'FollowUp_Id', 'id', 'Id']);
    const constCol = pickFirst(cols, ['Const_Id', 'const_id', 'Consultancy_Id', 'consultancy_id', 'Company_Id', 'company_id', 'ConstId']);
    const companyCol = pickFirst(cols, ['Comp_Name', 'CompanyName', 'Company_Name', 'Consultancy', 'Company']);
    const dateCol = pickFirst(cols, ['Followup_Date', 'FollowUpDate', 'followup_date', 'Date', 'CreatedDate', 'Date_Added']);
    const contactCol = pickFirst(cols, ['Contact_Person', 'ContactPerson', 'contact_person', 'PersonName', 'Name']);
    const designationCol = pickFirst(cols, ['Designation', 'designation']);
    const mobileCol = pickFirst(cols, ['Mobile', 'mobile', 'Phone', 'Telephone']);
    const emailCol = pickFirst(cols, ['email', 'Email', 'EMail']);
    const purposeCol = pickFirst(cols, ['Purpose', 'purpose', 'Followup_Purpose']);
    const courseCol = pickFirst(cols, ['Course', 'course', 'Course_Name']);
    const directLineCol = pickFirst(cols, ['Direct_Line', 'DirectLine', 'direct_line']);
    const remarksCol = pickFirst(cols, ['Remarks', 'Remark', 'remarks', 'Notes', 'Discussion']);
    const addedByCol = pickFirst(cols, ['Added_By', 'AddedBy', 'added_by', 'created_by']);
    const isDeleteCol = pickFirst(cols, ['IsDelete', 'is_delete', 'deleted', 'isDeleted']);

    if (!constCol && !companyCol) continue;

    const whereParts: string[] = [];
    const params: any[] = [];

    if (constCol) {
      whereParts.push(`f.${constCol} = ?`);
      params.push(constId);
    }
    if (companyCol && companyName) {
      whereParts.push(`TRIM(f.${companyCol}) = TRIM(?)`);
      params.push(companyName);
    }
    if (whereParts.length === 0) continue;

    const idCondition = whereParts.length === 1 ? whereParts[0] : `(${whereParts.join(' OR ')})`;
    const whereFinal: string[] = [idCondition];

    if (isDeleteCol) {
      whereFinal.push(`(f.${isDeleteCol} = 0 OR f.${isDeleteCol} IS NULL OR f.${isDeleteCol} = '' OR f.${isDeleteCol} = '0' OR f.${isDeleteCol} = false OR f.${isDeleteCol} = 'N' OR f.${isDeleteCol} = 'No')`);
    }

    if (search) {
      const searchCols = [contactCol, purposeCol, remarksCol, courseCol].filter(Boolean) as string[];
      if (searchCols.length > 0) {
        whereFinal.push(`(${searchCols.map((c) => `f.${c} LIKE ?`).join(' OR ')})`);
        for (let i = 0; i < searchCols.length; i += 1) params.push(`%${search}%`);
      }
    }

    const [rows] = await pool.query<any[]>(
      `SELECT
         ${idCol ? `f.${idCol}` : 'NULL'} AS Followup_Id,
         f.${constCol} AS Const_Id,
         ${dateCol ? `f.${dateCol}` : 'NULL'} AS Followup_Date,
         ${contactCol ? `f.${contactCol}` : 'NULL'} AS Contact_Person,
         ${designationCol ? `f.${designationCol}` : 'NULL'} AS Designation,
         ${mobileCol ? `f.${mobileCol}` : 'NULL'} AS Mobile,
         ${emailCol ? `f.${emailCol}` : 'NULL'} AS email,
         ${purposeCol ? `f.${purposeCol}` : 'NULL'} AS Purpose,
         ${courseCol ? `f.${courseCol}` : 'NULL'} AS Course,
         ${directLineCol ? `f.${directLineCol}` : 'NULL'} AS Direct_Line,
         ${remarksCol ? `f.${remarksCol}` : 'NULL'} AS Remarks,
         ${addedByCol ? `f.${addedByCol}` : 'NULL'} AS Added_By,
         '' AS added_by_name
       FROM ${table} f
         WHERE ${whereFinal.join(' AND ')}
       ORDER BY ${idCol ? `f.${idCol}` : `f.${constCol}`} DESC`,
      params
    );

    merged.push(...(rows ?? []));
  }

  return merged;
}

// GET - list follow-ups for a consultancy
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['consultancy.view', 'consultancy.update', 'consultancy.create']);
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const constId = searchParams.get('constId') || searchParams.get('Const_Id') || searchParams.get('id');
    const search = searchParams.get('search')?.trim() || '';

    if (!constId) return NextResponse.json({ error: 'constId is required' }, { status: 400 });

    // Ensure table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS consultant_followup (
        Followup_Id INT AUTO_INCREMENT PRIMARY KEY,
        Const_Id INT NOT NULL,
        Followup_Date DATE,
        Contact_Person VARCHAR(255),
        Designation VARCHAR(255),
        Mobile VARCHAR(50),
        email VARCHAR(255),
        Purpose VARCHAR(255),
        Course VARCHAR(255),
        Direct_Line VARCHAR(100),
        Remarks TEXT,
        Added_By INT,
        IsDelete TINYINT DEFAULT 0,
        Date_Added DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_const_id (Const_Id)
      )
    `);

    // Backfill columns for older installs where table existed with partial schema.
    await ensureFollowupColumn(pool, 'Const_Id', 'INT NOT NULL DEFAULT 0');
    await ensureFollowupColumn(pool, 'Followup_Date', 'DATE NULL');
    await ensureFollowupColumn(pool, 'Contact_Person', 'VARCHAR(255) NULL');
    await ensureFollowupColumn(pool, 'Designation', 'VARCHAR(255) NULL');
    await ensureFollowupColumn(pool, 'Mobile', 'VARCHAR(50) NULL');
    await ensureFollowupColumn(pool, 'email', 'VARCHAR(255) NULL');
    await ensureFollowupColumn(pool, 'Purpose', 'VARCHAR(255) NULL');
    await ensureFollowupColumn(pool, 'Course', 'VARCHAR(255) NULL');
    await ensureFollowupColumn(pool, 'Direct_Line', 'VARCHAR(100) NULL');
    await ensureFollowupColumn(pool, 'Remarks', 'TEXT NULL');
    await ensureFollowupColumn(pool, 'Added_By', 'INT NULL');
    await ensureFollowupColumn(pool, 'IsDelete', 'TINYINT DEFAULT 0');
    await ensureFollowupColumn(pool, 'Date_Added', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

    let where = "f.Const_Id = ? AND (f.IsDelete = 0 OR f.IsDelete IS NULL OR f.IsDelete = '' OR f.IsDelete = '0' OR f.IsDelete = 'N' OR f.IsDelete = 'No')";
    const params: any[] = [constId];

    const [consRows] = await pool.query<any[]>(
      `SELECT Comp_Name FROM consultant_mst WHERE Const_Id = ? LIMIT 1`,
      [constId]
    );
    const consultancyName = consRows?.[0]?.Comp_Name ? String(consRows[0].Comp_Name) : null;

    if (search) {
      where += ` AND (f.Contact_Person LIKE ? OR f.Purpose LIKE ? OR f.Remarks LIKE ? OR f.Course LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    let [rows] = await pool.query<any[]>(
      `SELECT f.Followup_Id, f.Const_Id, f.Followup_Date, f.Contact_Person, f.Designation,
              f.Mobile, f.email, f.Purpose, f.Course, f.Direct_Line, f.Remarks, f.Added_By,
              COALESCE(u.firstname, '') as added_by_name
       FROM consultant_followup f
       LEFT JOIN awt_adminuser u ON f.Added_By = u.id
       WHERE ${where}
       ORDER BY f.Followup_Id DESC`,
      params
    );

    if (!rows || rows.length === 0) {
      rows = await fetchLegacyFollowups(pool, String(constId), search, consultancyName);
    }

    return NextResponse.json({ rows });
  } catch (err: unknown) {
    console.error('Consultancy followups GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - add follow-up
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['consultancy.create', 'consultancy.update']);
    if (auth instanceof NextResponse) return auth;
    const session = await getSession(req);
    const pool = getPool();
    const body = await req.json();

    const constId = body.constId || body.Const_Id || body.id;
    const { Followup_Date, Contact_Person, Designation, Mobile, email, Purpose, Course, Direct_Line, Remarks } = body;
    if (!constId) return NextResponse.json({ error: 'constId is required' }, { status: 400 });

    // Ensure table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS consultant_followup (
        Followup_Id INT AUTO_INCREMENT PRIMARY KEY,
        Const_Id INT NOT NULL,
        Followup_Date DATE,
        Contact_Person VARCHAR(255),
        Designation VARCHAR(255),
        Mobile VARCHAR(50),
        email VARCHAR(255),
        Purpose VARCHAR(255),
        Course VARCHAR(255),
        Direct_Line VARCHAR(100),
        Remarks TEXT,
        Added_By INT,
        IsDelete TINYINT DEFAULT 0,
        Date_Added DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_const_id (Const_Id)
      )
    `);

    // Backfill columns for older installs where table existed with partial schema.
    await ensureFollowupColumn(pool, 'Const_Id', 'INT NOT NULL DEFAULT 0');
    await ensureFollowupColumn(pool, 'Followup_Date', 'DATE NULL');
    await ensureFollowupColumn(pool, 'Contact_Person', 'VARCHAR(255) NULL');
    await ensureFollowupColumn(pool, 'Designation', 'VARCHAR(255) NULL');
    await ensureFollowupColumn(pool, 'Mobile', 'VARCHAR(50) NULL');
    await ensureFollowupColumn(pool, 'email', 'VARCHAR(255) NULL');
    await ensureFollowupColumn(pool, 'Purpose', 'VARCHAR(255) NULL');
    await ensureFollowupColumn(pool, 'Course', 'VARCHAR(255) NULL');
    await ensureFollowupColumn(pool, 'Direct_Line', 'VARCHAR(100) NULL');
    await ensureFollowupColumn(pool, 'Remarks', 'TEXT NULL');
    await ensureFollowupColumn(pool, 'Added_By', 'INT NULL');
    await ensureFollowupColumn(pool, 'IsDelete', 'TINYINT DEFAULT 0');
    await ensureFollowupColumn(pool, 'Date_Added', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

    await pool.query(
      `INSERT INTO consultant_followup (Const_Id, Followup_Date, Contact_Person, Designation, Mobile, email, Purpose, Course, Direct_Line, Remarks, Added_By)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [constId, Followup_Date || null, Contact_Person || null, Designation || null,
       Mobile || null, email || null, Purpose || null, Course || null, Direct_Line || null,
       Remarks || null, session?.userId || null]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Consultancy followups POST error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - soft delete follow-up
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'consultancy.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    await pool.query(`UPDATE consultant_followup SET IsDelete = 1 WHERE Followup_Id = ?`, [id]);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Consultancy followups DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
