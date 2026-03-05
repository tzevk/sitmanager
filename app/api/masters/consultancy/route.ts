/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

// GET - list consultancies with pagination, search
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'consultancy.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';

    const conditions: string[] = ['(IsDelete = 0 OR IsDelete IS NULL)'];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(`(Comp_Name LIKE ? OR Contact_Person LIKE ? OR Designation LIKE ? OR City LIKE ? OR EMail LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const where = conditions.join(' AND ');

    const [countRows] = await pool.query<any[]>(`SELECT COUNT(*) AS total FROM consultant_mst WHERE ${where}`, params);
    const total = countRows[0]?.total ?? 0;

    const [rows] = await pool.query<any[]>(
      `SELECT Const_Id, Comp_Name, Contact_Person, Designation, Address, City, State, Pin, Tel, Fax,
              Mobile, EMail, Date_Added, Industry, Remark, Country, Purpose, Website, Company_Status,
              Course_Id1, CourseName1, Course_Id2, CourseName2, Course_Id3, CourseName3,
              Course_Id4, CourseName4, Course_Id5, CourseName5, Course_Id6, CourseName6, IsActive
       FROM consultant_mst
       WHERE ${where}
       ORDER BY Comp_Name ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
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
    const body = await req.json();

    const {
      Comp_Name, Contact_Person, Designation, Address, City, State, Pin, Tel, Fax,
      Mobile, EMail, Date_Added, Industry, Remark, Country, Purpose, Website, Company_Status,
      Course_Id1, Course_Id2, Course_Id3, Course_Id4, Course_Id5, Course_Id6,
    } = body;

    if (!Comp_Name?.trim()) {
      return NextResponse.json({ error: 'Consultancy name is required' }, { status: 400 });
    }
    if (!Address?.trim()) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO consultant_mst (
        Comp_Name, Contact_Person, Designation, Address, City, State, Pin, Tel, Fax,
        Mobile, EMail, Date_Added, Industry, Remark, Country, Purpose, Website, Company_Status,
        Course_Id1, Course_Id2, Course_Id3, Course_Id4, Course_Id5, Course_Id6, IsActive, IsDelete
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
      [
        Comp_Name.trim(), Contact_Person?.trim() || null, Designation?.trim() || null,
        Address.trim(), City?.trim() || null, State?.trim() || null, Pin?.trim() || null,
        Tel?.trim() || null, Fax?.trim() || null, Mobile?.trim() || null, EMail?.trim() || null,
        Date_Added || null, Industry?.trim() || null, Remark?.trim() || null,
        Country?.trim() || null, Purpose?.trim() || null, Website?.trim() || null,
        Company_Status?.trim() || null, Course_Id1 || null, Course_Id2 || null, Course_Id3 || null,
        Course_Id4 || null, Course_Id5 || null, Course_Id6 || null,
      ]
    );

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
    const body = await req.json();
    const { Const_Id, ...fields } = body;

    if (!Const_Id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    if (!fields.Comp_Name?.trim()) return NextResponse.json({ error: 'Consultancy name is required' }, { status: 400 });
    if (!fields.Address?.trim()) return NextResponse.json({ error: 'Address is required' }, { status: 400 });

    await pool.query(
      `UPDATE consultant_mst SET
        Comp_Name=?, Contact_Person=?, Designation=?, Address=?, City=?, State=?, Pin=?, Tel=?, Fax=?,
        Mobile=?, EMail=?, Date_Added=?, Industry=?, Remark=?, Country=?, Purpose=?, Website=?, Company_Status=?,
        Course_Id1=?, Course_Id2=?, Course_Id3=?, Course_Id4=?, Course_Id5=?, Course_Id6=?
       WHERE Const_Id=?`,
      [
        fields.Comp_Name.trim(), fields.Contact_Person?.trim() || null, fields.Designation?.trim() || null,
        fields.Address.trim(), fields.City?.trim() || null, fields.State?.trim() || null, fields.Pin?.trim() || null,
        fields.Tel?.trim() || null, fields.Fax?.trim() || null, fields.Mobile?.trim() || null, fields.EMail?.trim() || null,
        fields.Date_Added || null, fields.Industry?.trim() || null, fields.Remark?.trim() || null,
        fields.Country?.trim() || null, fields.Purpose?.trim() || null, fields.Website?.trim() || null,
        fields.Company_Status?.trim() || null, fields.Course_Id1 || null, fields.Course_Id2 || null, fields.Course_Id3 || null,
        fields.Course_Id4 || null, fields.Course_Id5 || null, fields.Course_Id6 || null, Const_Id,
      ]
    );

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
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Consultancy DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
