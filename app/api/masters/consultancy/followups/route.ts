/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader } from 'mysql2';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { getSession } from '@/lib/session';
import { logTableActivity } from '@/lib/activity-log';

async function ensureFollowupColumn(pool: ReturnType<typeof getPool>, columnName: string, columnType: string) {
  const [rows] = await pool.query<any[]>(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'consultant_follows'
       AND COLUMN_NAME = ?`,
    [columnName]
  );
  const cnt = rows?.[0]?.cnt ?? 0;
  if (cnt === 0) {
    await pool.query(`ALTER TABLE consultant_follows ADD COLUMN ${columnName} ${columnType}`);
  }
}

// GET - list follow-ups for a consultancy
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, [
      'consultancy.view',
      'consultancy.update',
      'consultancy.create',
      'corporate_inquiry.view',
      'corporate_inquiry.update',
      'corporate_inquiry.create',
    ]);
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const constId = searchParams.get('constId') || searchParams.get('Const_Id') || searchParams.get('id');
    const inquiryId = searchParams.get('inquiryId') || searchParams.get('Inquiry_Id');
    const companyName = searchParams.get('companyName')?.trim() || searchParams.get('CompanyName')?.trim() || '';
    const search = searchParams.get('search')?.trim() || '';
    const source = (searchParams.get('source') || 'all').trim().toLowerCase();
    const recent = ['1', 'true', 'yes'].includes((searchParams.get('recent') || '').trim().toLowerCase());
    const limitRaw = Number(searchParams.get('limit') || 8);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(25, Math.floor(limitRaw))) : 8;

    // Ensure table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS consultant_follows (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        Consultant_Id VARCHAR(50),
        CName VARCHAR(255),
        Phone VARCHAR(100),
        Email VARCHAR(255),
        Designation VARCHAR(255),
        Purpose VARCHAR(255),
        Remark MEDIUMTEXT,
        Tdate VARCHAR(50),
        DirectLine MEDIUMTEXT,
        Course VARCHAR(255),
        nextdate VARCHAR(50),
        IsActive VARCHAR(10) DEFAULT '1',
        IsDelete INT DEFAULT 0,
        Course_id VARCHAR(100),
        CreatedBy VARCHAR(100)
      )
    `);

    // Backfill columns for older installs where table existed with partial schema.
    await ensureFollowupColumn(pool, 'Consultant_Id', 'VARCHAR(50) NULL');
    await ensureFollowupColumn(pool, 'CName', 'VARCHAR(255) NULL');
    await ensureFollowupColumn(pool, 'Phone', 'VARCHAR(100) NULL');
    await ensureFollowupColumn(pool, 'Email', 'VARCHAR(255) NULL');
    await ensureFollowupColumn(pool, 'Designation', 'VARCHAR(255) NULL');
    await ensureFollowupColumn(pool, 'Purpose', 'VARCHAR(255) NULL');
    await ensureFollowupColumn(pool, 'Remark', 'MEDIUMTEXT NULL');
    await ensureFollowupColumn(pool, 'Tdate', 'VARCHAR(50) NULL');
    await ensureFollowupColumn(pool, 'DirectLine', 'MEDIUMTEXT NULL');
    await ensureFollowupColumn(pool, 'Course', 'VARCHAR(255) NULL');
    await ensureFollowupColumn(pool, 'nextdate', 'VARCHAR(50) NULL');
    await ensureFollowupColumn(pool, 'IsActive', 'VARCHAR(10) DEFAULT \'1\'');
    await ensureFollowupColumn(pool, 'IsDelete', 'INT DEFAULT 0');
    await ensureFollowupColumn(pool, 'CreatedBy', 'VARCHAR(100) NULL');

    if (recent) {
      const [rows] = await pool.query<any[]>(
        `SELECT
           f.ID AS Followup_Id,
           CAST(NULLIF(TRIM(f.Consultant_Id), '') AS UNSIGNED) AS Const_Id,
           COALESCE(cm.Comp_Name, '') AS Company_Name,
           COALESCE(NULLIF(TRIM(f.Tdate), ''), NULLIF(TRIM(f.nextdate), '')) AS Followup_Date,
           COALESCE(f.CName, '') AS Contact_Person,
           COALESCE(f.Designation, '') AS Designation,
           COALESCE(f.Phone, '') AS Mobile,
           COALESCE(f.Email, '') AS email,
           COALESCE(f.Purpose, '') AS Purpose,
           COALESCE(f.Course, '') AS Course,
           COALESCE(f.DirectLine, '') AS Direct_Line,
           COALESCE(f.Remark, '') AS Remarks,
           COALESCE(
             NULLIF(TRIM(CONCAT(COALESCE(au.firstname, ''), ' ', COALESCE(au.lastname, ''))), ''),
             NULLIF(TRIM(au.username), ''),
             NULLIF(TRIM(au.email), ''),
             NULLIF(TRIM(oe.Employee_Name), ''),
             NULLIF(TRIM(f.CreatedBy), ''),
             'System'
           ) AS Created_By
         FROM consultant_follows f
         LEFT JOIN consultant_mst cm
           ON CAST(NULLIF(TRIM(f.Consultant_Id), '') AS UNSIGNED) = cm.Const_Id
         LEFT JOIN awt_adminuser au
           ON au.id = CAST(NULLIF(TRIM(f.CreatedBy), '') AS UNSIGNED)
         LEFT JOIN office_employee_mst oe
           ON oe.Emp_Id = CAST(NULLIF(TRIM(f.CreatedBy), '') AS UNSIGNED)
         WHERE (f.IsDelete = 0 OR f.IsDelete IS NULL OR f.IsDelete = '' OR f.IsDelete = '0' OR f.IsDelete = 'N' OR f.IsDelete = 'No')
         ORDER BY f.ID DESC
         LIMIT ?`,
        [limit]
      );
      await logTableActivity(req, {
        tableName: 'consultant_follows',
        action: 'VIEW',
        details: { mode: 'recent', limit },
      });
      return NextResponse.json({ rows });
    }

    if (!constId && !inquiryId && !companyName) {
      return NextResponse.json({ error: 'constId or inquiryId or companyName is required' }, { status: 400 });
    }

    let resolvedConstId = constId ? Number(constId) : 0;
    if (resolvedConstId <= 0 && inquiryId) {
      const [inquiryRows] = await pool.query<any[]>(
        `SELECT Consultancy_Id
         FROM corporate_inquiry
         WHERE Id = ?
         LIMIT 1`,
        [inquiryId]
      );
      resolvedConstId = Number(inquiryRows?.[0]?.Consultancy_Id || 0);
    }
    if (resolvedConstId <= 0 && companyName) {
      const [consultancyRows] = await pool.query<any[]>(
        `SELECT Const_Id
         FROM consultant_mst
         WHERE LOWER(TRIM(COALESCE(Comp_Name, ''))) = LOWER(TRIM(?))
         LIMIT 1`,
        [companyName]
      );
      resolvedConstId = Number(consultancyRows?.[0]?.Const_Id || 0);
    }
    if (resolvedConstId <= 0) return NextResponse.json({ rows: [] });

    let where = `(f.IsDelete = 0 OR f.IsDelete IS NULL OR f.IsDelete = '' OR f.IsDelete = '0' OR f.IsDelete = 'N' OR f.IsDelete = 'No')`;
    const params: any[] = [resolvedConstId];
    where += ` AND CAST(NULLIF(TRIM(f.Consultant_Id), '') AS UNSIGNED) = ?`;

    if (search) {
      where += ` AND (f.CName LIKE ? OR f.Purpose LIKE ? OR f.Remark LIKE ? OR f.Course LIKE ? OR f.Email LIKE ? OR f.Designation LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      params.push(`%${search}%`, `%${search}%`);
    }

    // consultant_follows is legacy/manual source; no corporate source linkage.
    if (source === 'corporate') {
      return NextResponse.json({ rows: [] });
    }

    const [rows] = await pool.query<any[]>(
      `SELECT
         f.ID AS Followup_Id,
         CAST(NULLIF(TRIM(f.Consultant_Id), '') AS UNSIGNED) AS Const_Id,
         COALESCE(NULLIF(TRIM(f.Tdate), ''), NULLIF(TRIM(f.nextdate), '')) AS Followup_Date,
         COALESCE(f.CName, '') AS Contact_Person,
         COALESCE(f.Designation, '') AS Designation,
         COALESCE(f.Phone, '') AS Mobile,
         COALESCE(f.Email, '') AS email,
         COALESCE(f.Purpose, '') AS Purpose,
         COALESCE(f.Course, '') AS Course,
         COALESCE(f.DirectLine, '') AS Direct_Line,
         COALESCE(f.Remark, '') AS Remarks,
         COALESCE(
           NULLIF(TRIM(CONCAT(COALESCE(au.firstname, ''), ' ', COALESCE(au.lastname, ''))), ''),
           NULLIF(TRIM(au.username), ''),
           NULLIF(TRIM(au.email), ''),
           NULLIF(TRIM(oe.Employee_Name), ''),
           NULLIF(TRIM(f.CreatedBy), ''),
           'System'
         ) AS Created_By,
         NULL AS Source_Inquiry_Id
       FROM consultant_follows f
       LEFT JOIN awt_adminuser au
         ON au.id = CAST(NULLIF(TRIM(f.CreatedBy), '') AS UNSIGNED)
       LEFT JOIN office_employee_mst oe
         ON oe.Emp_Id = CAST(NULLIF(TRIM(f.CreatedBy), '') AS UNSIGNED)
       WHERE ${where}
       ORDER BY f.ID DESC`,
      params
    );
    await logTableActivity(req, {
      tableName: 'consultant_follows',
      action: 'VIEW',
      recordId: resolvedConstId,
      details: { mode: 'by_constituency', search: search || null, source },
    });
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
      CREATE TABLE IF NOT EXISTS consultant_follows (
        ID INT AUTO_INCREMENT PRIMARY KEY,
        Consultant_Id VARCHAR(50),
        CName VARCHAR(255),
        Phone VARCHAR(100),
        Email VARCHAR(255),
        Designation VARCHAR(255),
        Purpose VARCHAR(255),
        Remark MEDIUMTEXT,
        Tdate VARCHAR(50),
        DirectLine MEDIUMTEXT,
        Course VARCHAR(255),
        nextdate VARCHAR(50),
        IsActive VARCHAR(10) DEFAULT '1',
        IsDelete INT DEFAULT 0,
        Course_id VARCHAR(100),
        CreatedBy VARCHAR(100)
      )
    `);

    // Backfill columns for older installs where table existed with partial schema.
    await ensureFollowupColumn(pool, 'Consultant_Id', 'VARCHAR(50) NULL');
    await ensureFollowupColumn(pool, 'CName', 'VARCHAR(255) NULL');
    await ensureFollowupColumn(pool, 'Phone', 'VARCHAR(100) NULL');
    await ensureFollowupColumn(pool, 'Email', 'VARCHAR(255) NULL');
    await ensureFollowupColumn(pool, 'Designation', 'VARCHAR(255) NULL');
    await ensureFollowupColumn(pool, 'Purpose', 'VARCHAR(255) NULL');
    await ensureFollowupColumn(pool, 'Remark', 'MEDIUMTEXT NULL');
    await ensureFollowupColumn(pool, 'Tdate', 'VARCHAR(50) NULL');
    await ensureFollowupColumn(pool, 'DirectLine', 'MEDIUMTEXT NULL');
    await ensureFollowupColumn(pool, 'Course', 'VARCHAR(255) NULL');
    await ensureFollowupColumn(pool, 'nextdate', 'VARCHAR(50) NULL');
    await ensureFollowupColumn(pool, 'IsActive', 'VARCHAR(10) DEFAULT \'1\'');
    await ensureFollowupColumn(pool, 'IsDelete', 'INT DEFAULT 0');
    await ensureFollowupColumn(pool, 'CreatedBy', 'VARCHAR(100) NULL');

    const [insertResult] = await pool.query<ResultSetHeader>(
      `INSERT INTO consultant_follows
       (Consultant_Id, CName, Phone, Email, Designation, Purpose, Remark, Tdate, DirectLine, Course, nextdate, IsActive, IsDelete, CreatedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, '1', 0, ?)`,
      [
        String(constId),
        Contact_Person || null,
        Mobile || null,
        email || null,
        Designation || null,
        Purpose || null,
        Remarks || null,
        Followup_Date || null,
        Direct_Line || null,
        Course || null,
        session?.userId != null ? String(session.userId) : null,
      ]
    );

    await logTableActivity(req, {
      tableName: 'consultant_follows',
      action: 'CREATE',
      recordId: insertResult?.insertId ?? null,
      details: {
        constId: String(constId),
        followupDate: Followup_Date || null,
        contactPerson: Contact_Person || null,
      },
    });

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

    await pool.query(`UPDATE consultant_follows SET IsDelete = 1 WHERE ID = ?`, [id]);
    await logTableActivity(req, {
      tableName: 'consultant_follows',
      action: 'DELETE',
      recordId: id,
    });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Consultancy followups DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
