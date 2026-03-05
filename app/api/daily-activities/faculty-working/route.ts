/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth'; // Assuming permission check is needed

/*
  Table: awt_facultyworking
  Columns:
  id: int(11)
  date: varchar(15)
  course: varchar(255)
  batch: varchar(150)
  faculty: varchar(250)
  facultytime: varchar(250) (Time From)
  to: varchar(250) (Time To - likely needs escaping due to reserved word)
  work: varchar(250)
  created_by: varchar(11)
  updated_by: int(11)
  created_date: datetime
  updated_date: datetime
  active: varchar(10) (0 or 1?)
  deleted: varchar(11) (0 or 1?)
*/

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'faculty_working_hours.view');
  if (auth instanceof NextResponse) return auth;
  const pool = getPool();
  const { searchParams } = new URL(req.url);

  const singleId = searchParams.get('id');
  if (singleId) {
    // Fetch single record
    const [rows] = await pool.query(
      `SELECT fw.id, fw.date, fw.course, fw.batch, fw.faculty, fw.facultytime, fw.\`to\`, fw.work,
              e.Employee_Name
       FROM awt_facultyworking fw
       LEFT JOIN office_employee_mst e ON fw.faculty = CAST(e.Emp_Id AS CHAR) COLLATE utf8mb4_unicode_ci
       WHERE fw.id = ? AND (fw.deleted = '0' OR fw.deleted IS NULL)`,
      [parseInt(singleId)]
    );
    const row = (rows as any[])[0];
    if (!row) return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    return NextResponse.json(row);
  }

  const fetchOptions = searchParams.get('options');
  if (fetchOptions === 'courses') {
    const [courses] = await pool.query(
      `SELECT Course_Id, Course_Name FROM course_mst
       WHERE (IsDelete = 0 OR IsDelete IS NULL) AND IsActive = 1
       ORDER BY Course_Name`
    );
    return NextResponse.json({ courses });
  }

  if (fetchOptions === 'batches') {
    const courseId = searchParams.get('courseId');
    let sql = `SELECT Batch_Id, Batch_Code FROM batch_mst WHERE (IsDelete = 0 OR IsDelete IS NULL) AND IsActive = 1`;
    const params: any[] = [];
    if (courseId) {
      sql += ` AND Course_Id = ?`;
      params.push(courseId);
    }
    sql += ` ORDER BY Batch_Code`;
    const [batches] = await pool.query(sql, params);
    return NextResponse.json({ batches });
  }

  if (fetchOptions === 'faculties') {
    const [faculties] = await pool.query(
      `SELECT Emp_Id as id, Employee_Name as facultyname FROM office_employee_mst
       WHERE (IsDelete = 0 OR IsDelete IS NULL) AND IsActive = 1
       ORDER BY Employee_Name`
    );
    return NextResponse.json({ faculties });
  }

  // Fetch list with pagination/filtering if needed
  // For now, simple list
  const [rows] = await pool.query(
    `SELECT fw.id, fw.date, fw.course, fw.batch, fw.faculty, fw.facultytime, fw.\`to\`, fw.work,
            c.Course_Name, b.Batch_Code, e.Employee_Name
     FROM awt_facultyworking fw
     LEFT JOIN course_mst c ON fw.course = CAST(c.Course_Id AS CHAR) COLLATE utf8mb4_unicode_ci
     LEFT JOIN batch_mst b ON fw.batch = CAST(b.Batch_Id AS CHAR) COLLATE utf8mb4_unicode_ci
     LEFT JOIN office_employee_mst e ON fw.faculty = CAST(e.Emp_Id AS CHAR) COLLATE utf8mb4_unicode_ci
     WHERE (fw.deleted = '0' OR fw.deleted IS NULL)
     ORDER BY fw.id DESC`
  );

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'faculty_working_hours.create');
  if (auth instanceof NextResponse) return auth;
  const pool = getPool();
  
  try {
    const body = await req.json();
    const { date, course, batch, faculty, facultytime, to, work } = body; // 'to' is 'Time To'

    // Validation
    if (!course || !batch || !faculty) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO awt_facultyworking 
       (date, course, batch, faculty, facultytime, \`to\`, work, created_date, deleted, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), '0', '1')`,
      [date, course, batch, faculty, facultytime, to, work]
    );

    return NextResponse.json({ message: 'Record created successfully', id: (result as any).insertId });
  } catch (error: any) {
    console.error('Error creating faculty working record:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requirePermission(req, 'faculty_working_hours.update');
  if (auth instanceof NextResponse) return auth;
  const pool = getPool();
  
  try {
    const body = await req.json();
    const { id, date, course, batch, faculty, facultytime, to, work } = body;

    if (!id) return NextResponse.json({ error: 'Check ID is required' }, { status: 400 });

    await pool.query(
      `UPDATE awt_facultyworking
       SET date = ?, course = ?, batch = ?, faculty = ?, facultytime = ?, \`to\` = ?, work = ?, updated_date = NOW()
       WHERE id = ?`,
      [date, course, batch, faculty, facultytime, to, work, id]
    );

    return NextResponse.json({ message: 'Record updated successfully' });
  } catch (error: any) {
    console.error('Error updating faculty working record:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission(req, 'faculty_working_hours.delete');
  if (auth instanceof NextResponse) return auth;
  const pool = getPool();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

  await pool.query(
    `UPDATE awt_facultyworking SET deleted = '1', updated_date = NOW() WHERE id = ?`,
    [id]
  );
  
  return NextResponse.json({ message: 'Record deleted successfully' });
}
