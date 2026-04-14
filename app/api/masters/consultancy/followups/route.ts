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

// GET - list follow-ups for a consultancy
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['consultancy.view', 'consultancy.update', 'consultancy.create']);
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const constId = searchParams.get('constId') || searchParams.get('Const_Id') || searchParams.get('id');
    const search = searchParams.get('search')?.trim() || '';
    const source = (searchParams.get('source') || 'all').trim().toLowerCase();

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
        Source_Inquiry_Id INT,
        IsDelete TINYINT DEFAULT 0,
        Date_Added DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_const_id (Const_Id),
        INDEX idx_source_inquiry (Source_Inquiry_Id)
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
    await ensureFollowupColumn(pool, 'Source_Inquiry_Id', 'INT NULL');
    await ensureFollowupColumn(pool, 'IsDelete', 'TINYINT DEFAULT 0');
    await ensureFollowupColumn(pool, 'Date_Added', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

    let where = `f.Const_Id = ? AND (f.IsDelete = 0 OR f.IsDelete IS NULL OR f.IsDelete = '' OR f.IsDelete = '0' OR f.IsDelete = 'N' OR f.IsDelete = 'No')`;
    const params: any[] = [constId];

    if (search) {
      where += ` AND (f.Contact_Person LIKE ? OR f.Purpose LIKE ? OR f.Remarks LIKE ? OR f.Course LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (source === 'corporate') {
      where += ` AND (f.Source_Inquiry_Id IS NOT NULL AND f.Source_Inquiry_Id > 0)`;
    } else if (source === 'manual') {
      where += ` AND (f.Source_Inquiry_Id IS NULL OR f.Source_Inquiry_Id = 0)`;
    }

    const [rows] = await pool.query<any[]>(
      `SELECT f.Followup_Id, f.Const_Id, f.Followup_Date, f.Contact_Person, f.Designation,
              f.Mobile, f.email, f.Purpose, f.Course, f.Direct_Line, f.Remarks, f.Source_Inquiry_Id
       FROM consultant_followup f
       WHERE ${where}
       ORDER BY f.Followup_Id DESC`,
      params
    );

    // Also pull inline follow-ups from corporate_inquiry FollowUp JSON for this company
    // so older un-synced inquiries are included
    const trackedSourceIds = new Set(
      (rows || [])
        .filter((r: any) => r.Source_Inquiry_Id)
        .map((r: any) => Number(r.Source_Inquiry_Id))
    );

    const inlineRows: any[] = [];
    try {
      const [corpRows] = await pool.query<any[]>(
        `SELECT Id, FollowUp, CompanyAuthority, FullName, Designation, Mobile, Email
         FROM corporate_inquiry
         WHERE Consultancy_Id = ?
           AND (IsDelete = 0 OR IsDelete IS NULL)
           AND FollowUp IS NOT NULL AND FollowUp != ''`,
        [constId]
      );

      for (const corp of corpRows || []) {
        if (trackedSourceIds.has(Number(corp.Id))) continue;
        try {
          const parsed = JSON.parse(String(corp.FollowUp));
          const obj = typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : null;
          const fuArr = obj && Array.isArray(obj.followUps) ? obj.followUps
            : obj && Array.isArray(obj.followup) ? obj.followup
            : [];
          for (const fu of fuArr) {
            const f = typeof fu === 'object' && fu !== null ? fu as Record<string, unknown> : {};
            inlineRows.push({
              Followup_Id: null,
              Const_Id: Number(constId),
              Followup_Date: f.date || null,
              Contact_Person: f.contactPerson || corp.CompanyAuthority || corp.FullName || '',
              Designation: f.designation || corp.Designation || '',
              Mobile: f.mobile || corp.Mobile || '',
              email: f.email || corp.Email || '',
              Purpose: f.purpose || '',
              Course: f.course || '',
              Direct_Line: f.directLine || '',
              Remarks: f.remark || '',
              Source_Inquiry_Id: corp.Id,
            });
          }
        } catch { /* malformed JSON, skip */ }
      }
    } catch { /* corporate_inquiry table might not have these columns yet */ }

    return NextResponse.json({ rows: [...rows, ...inlineRows] });
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
        Source_Inquiry_Id INT,
        IsDelete TINYINT DEFAULT 0,
        Date_Added DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_const_id (Const_Id),
        INDEX idx_source_inquiry (Source_Inquiry_Id)
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
    await ensureFollowupColumn(pool, 'Source_Inquiry_Id', 'INT NULL');
    await ensureFollowupColumn(pool, 'IsDelete', 'TINYINT DEFAULT 0');
    await ensureFollowupColumn(pool, 'Date_Added', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

    await pool.query(
      `INSERT INTO consultant_followup (Const_Id, Followup_Date, Contact_Person, Designation, Mobile, email, Purpose, Course, Direct_Line, Remarks, Added_By, Source_Inquiry_Id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
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
