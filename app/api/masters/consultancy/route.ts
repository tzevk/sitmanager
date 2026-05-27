/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { logTableActivity } from '@/lib/activity-log';

async function ensureCompanyTypeColumn(pool: ReturnType<typeof getPool>) {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT COUNT(*) AS cnt
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'consultant_mst'
         AND COLUMN_NAME = 'Company_Type'`
    );

    const cnt = rows?.[0]?.cnt ?? 0;
    if (cnt === 0) {
      // Best-effort migration: some production DB users don't have ALTER permission.
      await pool.query(`ALTER TABLE consultant_mst ADD COLUMN Company_Type VARCHAR(20) NULL`);
    }
  } catch (err) {
    console.warn('Unable to ensure consultant_mst.Company_Type column:', err);
  }
}

async function hasCompanyTypeColumn(pool: ReturnType<typeof getPool>) {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT COUNT(*) AS cnt
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'consultant_mst'
         AND COLUMN_NAME = 'Company_Type'`
    );
    return (rows?.[0]?.cnt ?? 0) > 0;
  } catch {
    return false;
  }
}

// GET - list consultancies with pagination, search
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'consultancy.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    await ensureCompanyTypeColumn(pool);
    const hasCompanyType = await hasCompanyTypeColumn(pool);
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';
    const companyType = searchParams.get('companyType')?.trim() || '';
    const city = searchParams.get('city')?.trim() || '';
    const industry = searchParams.get('industry')?.trim() || '';

    const companyTypeExpr = `COALESCE(
      ${hasCompanyType ? "NULLIF(TRIM(cm.Company_Type), '')" : 'NULL'},
      (
        SELECT NULLIF(TRIM(ci.CompanyType), '')
        FROM corporate_inquiry ci
        WHERE (ci.IsDelete = 0 OR ci.IsDelete IS NULL)
          AND (
            ci.Consultancy_Id = cm.Const_Id
            OR LOWER(TRIM(COALESCE(ci.CompanyName, ''))) = LOWER(TRIM(cm.Comp_Name))
          )
          AND ci.CompanyType IS NOT NULL
          AND TRIM(ci.CompanyType) <> ''
        ORDER BY ci.Id DESC
        LIMIT 1
      ),
      CASE
        WHEN LOWER(TRIM(COALESCE(cm.Country, ''))) IN ('india', 'in', 'bharat') THEN 'Local'
        WHEN TRIM(COALESCE(cm.Country, '')) <> '' THEN 'International'
        ELSE NULL
      END
    )`;

    const conditions: string[] = ['(cm.IsDelete = 0 OR cm.IsDelete IS NULL)'];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(`(
        cm.Comp_Name LIKE ?
        OR cm.Contact_Person LIKE ?
        OR cm.Designation LIKE ?
        OR cm.City LIKE ?
        OR cm.State LIKE ?
        OR cm.EMail LIKE ?
        OR cm.Address LIKE ?
        OR cm.Tel LIKE ?
        OR cm.Mobile LIKE ?
        OR cm.Purpose LIKE ?
        OR cm.Country LIKE ?
        OR cm.Industry LIKE ?
        OR cm.Website LIKE ?
        OR cm.Company_Status LIKE ?
        OR ${companyTypeExpr} LIKE ?
      )`);
      params.push(
        `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`,
        `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`,
        `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`
      );
    }
    if (companyType) {
      conditions.push(`${companyTypeExpr} = ?`);
      params.push(companyType);
    }
    if (city) {
      conditions.push(`cm.City = ?`);
      params.push(city);
    }
    if (industry) {
      conditions.push(`cm.Industry = ?`);
      params.push(industry);
    }

    const where = conditions.join(' AND ');

    const [countRows] = await pool.query<any[]>(`SELECT COUNT(*) AS total FROM consultant_mst cm WHERE ${where}`, params);
    const total = countRows[0]?.total ?? 0;

    const [rows] = await pool.query<any[]>(
      `SELECT cm.Const_Id, cm.Comp_Name, cm.Contact_Person, cm.Designation, cm.Address, cm.City, cm.State, cm.Pin, cm.Tel, cm.Fax,
              cm.Mobile, cm.EMail, cm.Date_Added, cm.Industry, cm.Remark, cm.Country, cm.Purpose, cm.Website, cm.Company_Status,
              ${companyTypeExpr} AS Company_Type,
              cm.Course_Id1, cm.Course_Id2, cm.Course_Id3, cm.Course_Id4, cm.Course_Id5, cm.Course_Id6, cm.IsActive
       FROM consultant_mst cm
       WHERE ${where}
       ORDER BY cm.Comp_Name ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [companyTypeRows, cityRows, industryRows] = await Promise.all([
      pool.query<any[]>(
        `SELECT DISTINCT ${companyTypeExpr} AS value
         FROM consultant_mst cm
         WHERE (cm.IsDelete = 0 OR cm.IsDelete IS NULL)
           AND ${companyTypeExpr} IS NOT NULL
           AND TRIM(${companyTypeExpr}) <> ''
         ORDER BY value`
      ),
      pool.query<any[]>(
        `SELECT DISTINCT cm.City AS value
         FROM consultant_mst cm
         WHERE (cm.IsDelete = 0 OR cm.IsDelete IS NULL)
           AND cm.City IS NOT NULL
           AND TRIM(cm.City) <> ''
         ORDER BY cm.City
         LIMIT 500`
      ),
      pool.query<any[]>(
        `SELECT DISTINCT cm.Industry AS value
         FROM consultant_mst cm
         WHERE (cm.IsDelete = 0 OR cm.IsDelete IS NULL)
           AND cm.Industry IS NOT NULL
           AND TRIM(cm.Industry) <> ''
         ORDER BY cm.Industry
         LIMIT 300`
      ),
    ]);

    return NextResponse.json({
      rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      filters: {
        companyTypes: (companyTypeRows[0] as any[]).map((row: any) => String(row.value).trim()).filter(Boolean),
        cities: (cityRows[0] as any[]).map((row: any) => String(row.value).trim()).filter(Boolean),
        industries: (industryRows[0] as any[]).map((row: any) => String(row.value).trim()).filter(Boolean),
      },
    });
  } catch (err: unknown) {
    console.error('Consultancy GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - create consultancy
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'consultancy.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    await ensureCompanyTypeColumn(pool);
    const hasCompanyType = await hasCompanyTypeColumn(pool);
    const body = await req.json();

    const {
      Comp_Name, Contact_Person, Designation, Address, City, State, Pin, Tel, Fax,
      Mobile, EMail, Date_Added, Industry, Remark, Country, Purpose, Website, Company_Status,
      Company_Type,
      Course_Id1, Course_Id2, Course_Id3, Course_Id4, Course_Id5, Course_Id6,
    } = body;

    if (!Comp_Name?.trim()) {
      return NextResponse.json({ error: 'Consultancy name is required' }, { status: 400 });
    }
    if (!Address?.trim()) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const insertColumns = [
      'Comp_Name', 'Contact_Person', 'Designation', 'Address', 'City', 'State', 'Pin', 'Tel', 'Fax',
      'Mobile', 'EMail', 'Date_Added', 'Industry', 'Remark', 'Country', 'Purpose', 'Website', 'Company_Status',
      ...(hasCompanyType ? ['Company_Type'] : []),
      'Course_Id1', 'Course_Id2', 'Course_Id3', 'Course_Id4', 'Course_Id5', 'Course_Id6', 'IsActive', 'IsDelete',
    ];

    const insertValues = [
      Comp_Name.trim(), Contact_Person?.trim() || null, Designation?.trim() || null,
      Address.trim(), City?.trim() || null, State?.trim() || null, Pin?.trim() || null,
      Tel?.trim() || null, Fax?.trim() || null, Mobile?.trim() || null, EMail?.trim() || null,
      Date_Added || null, Industry?.trim() || null, Remark?.trim() || null,
      Country?.trim() || null, Purpose?.trim() || null, Website?.trim() || null,
      Company_Status?.trim() || null,
      ...(hasCompanyType ? [Company_Type?.trim() || null] : []),
      Course_Id1 || null, Course_Id2 || null, Course_Id3 || null,
      Course_Id4 || null, Course_Id5 || null, Course_Id6 || null,
      1, 0,
    ];

    const [result] = await pool.query(
      `INSERT INTO consultant_mst (${insertColumns.join(', ')})
       VALUES (${insertColumns.map(() => '?').join(', ')})`,
      insertValues
    );

    await logTableActivity(req, {
      tableName: 'consultant_mst',
      action: 'CREATE',
      recordId: (result as any).insertId,
      details: { companyName: Comp_Name.trim() },
    });

    return NextResponse.json({ success: true, insertId: (result as any).insertId });
  } catch (err: unknown) {
    console.error('Consultancy POST error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - update consultancy
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'consultancy.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    await ensureCompanyTypeColumn(pool);
    const hasCompanyType = await hasCompanyTypeColumn(pool);
    const body = await req.json();
    const { Const_Id, ...fields } = body;

    if (!Const_Id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    if (!fields.Comp_Name?.trim()) return NextResponse.json({ error: 'Consultancy name is required' }, { status: 400 });
    if (!fields.Address?.trim()) return NextResponse.json({ error: 'Address is required' }, { status: 400 });

    const setParts = [
      'Comp_Name=?', 'Contact_Person=?', 'Designation=?', 'Address=?', 'City=?', 'State=?', 'Pin=?', 'Tel=?', 'Fax=?',
      'Mobile=?', 'EMail=?', 'Date_Added=?', 'Industry=?', 'Remark=?', 'Country=?', 'Purpose=?', 'Website=?', 'Company_Status=?',
      ...(hasCompanyType ? ['Company_Type=?'] : []),
      'Course_Id1=?', 'Course_Id2=?', 'Course_Id3=?', 'Course_Id4=?', 'Course_Id5=?', 'Course_Id6=?',
    ];

    const values = [
      fields.Comp_Name.trim(), fields.Contact_Person?.trim() || null, fields.Designation?.trim() || null,
      fields.Address.trim(), fields.City?.trim() || null, fields.State?.trim() || null, fields.Pin?.trim() || null,
      fields.Tel?.trim() || null, fields.Fax?.trim() || null, fields.Mobile?.trim() || null, fields.EMail?.trim() || null,
      fields.Date_Added || null, fields.Industry?.trim() || null, fields.Remark?.trim() || null,
      fields.Country?.trim() || null, fields.Purpose?.trim() || null, fields.Website?.trim() || null,
      fields.Company_Status?.trim() || null,
      ...(hasCompanyType ? [fields.Company_Type?.trim() || null] : []),
      fields.Course_Id1 || null, fields.Course_Id2 || null, fields.Course_Id3 || null,
      fields.Course_Id4 || null, fields.Course_Id5 || null, fields.Course_Id6 || null,
      Const_Id,
    ];

    await pool.query(
      `UPDATE consultant_mst SET ${setParts.join(', ')} WHERE Const_Id=?`,
      values
    );

    await logTableActivity(req, {
      tableName: 'consultant_mst',
      action: 'UPDATE',
      recordId: Const_Id,
      details: { companyName: fields.Comp_Name.trim() },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Consultancy PUT error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - soft delete
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'consultancy.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await pool.query(`UPDATE consultant_mst SET IsDelete = 1 WHERE Const_Id = ?`, [id]);
    await logTableActivity(req, {
      tableName: 'consultant_mst',
      action: 'DELETE',
      recordId: id,
    });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Consultancy DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
