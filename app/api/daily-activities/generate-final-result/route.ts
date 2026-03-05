/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

/* ---------- GET — List final results OR single OR dropdown options ---------- */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'final_result.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    /* --- Single final result by id --- */
    const singleId = searchParams.get('id');
    if (singleId) {
      const [rows] = await pool.query(
        `SELECT fr.Id AS Result_Id, fr.Course_Id, fr.Batch_Id,
                fr.Result_date AS Result_Dt, fr.Print_date AS Print_Dt,
                fr.Approve AS Approved_By, e.Employee_Name AS Approved_By_Name,
                fr.Start_date AS Period_Start, fr.End_date AS Period_End,
                fr.Label1, fr.Faculty1, fr.Label2, fr.Faculty2,
                fr.IsActive, fr.IsDelete,
                c.Course_Name, b.Batch_code
         FROM generate_final_result fr
         LEFT JOIN course_mst c ON fr.Course_Id = c.Course_Id
         LEFT JOIN batch_mst b ON fr.Batch_Id = b.Batch_Id
         LEFT JOIN office_employee_mst e ON fr.Approve = e.Emp_Id
         WHERE fr.Id = ? AND (fr.IsDelete = 0 OR fr.IsDelete IS NULL)`,
        [parseInt(singleId)]
      );
      const row = (rows as any[])[0];
      if (!row) {
        return NextResponse.json({ error: 'Final result not found' }, { status: 404 });
      }
      return NextResponse.json({ finalResult: row });
    }

    /* --- Dropdown options --- */
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
      if (!courseId) return NextResponse.json({ batches: [] });
      const [batches] = await pool.query(
        `SELECT Batch_Id, Batch_code, Category, Timings
         FROM batch_mst
         WHERE Course_Id = ? AND IsActive = 1
           AND (IsDelete = 0 OR IsDelete IS NULL)
           AND (Cancel = 0 OR Cancel IS NULL)
         ORDER BY Batch_Id DESC`,
        [parseInt(courseId)]
      );
      return NextResponse.json({ batches });
    }

    if (fetchOptions === 'employees') {
      const [employees] = await pool.query(
        `SELECT Emp_Id, Employee_Name FROM office_employee_mst
         WHERE IsActive = 1 AND (IsDelete = 0 OR IsDelete IS NULL)
         ORDER BY Employee_Name`
      );
      return NextResponse.json({ employees });
    }

    /* --- List with pagination --- */
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '25')));
    const offset = (page - 1) * limit;

    const search = searchParams.get('search')?.trim() || '';
    const courseId = searchParams.get('courseId') || '';
    const batchId = searchParams.get('batchId') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    const conditions: string[] = ['(fr.IsDelete = 0 OR fr.IsDelete IS NULL)'];
    const params: any[] = [];

    if (search) {
      conditions.push(
        '(b.Batch_code LIKE ? OR c.Course_Name LIKE ? OR fr.Approve LIKE ?)'
      );
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (courseId) { conditions.push('fr.Course_Id = ?'); params.push(parseInt(courseId)); }
    if (batchId) { conditions.push('fr.Batch_Id = ?'); params.push(parseInt(batchId)); }
    if (dateFrom) { conditions.push('fr.Result_date >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('fr.Result_date <= ?'); params.push(dateTo); }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Count
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total
       FROM generate_final_result fr
       LEFT JOIN batch_mst b ON fr.Batch_Id = b.Batch_Id
       LEFT JOIN course_mst c ON fr.Course_Id = c.Course_Id
       ${whereClause}`,
      params
    );
    const total = (countResult as any[])[0]?.total || 0;

    // Rows
    const [rows] = await pool.query(
      `SELECT fr.Id AS Result_Id, fr.Course_Id, fr.Batch_Id,
              fr.Result_date AS Result_Dt, fr.Print_date AS Print_Dt,
              fr.Approve AS Approved_By, e.Employee_Name AS Approved_By_Name,
              fr.Start_date AS Period_Start, fr.End_date AS Period_End,
              fr.Label1, fr.Faculty1, fr.Label2, fr.Faculty2,
              c.Course_Name, b.Batch_code
       FROM generate_final_result fr
       LEFT JOIN course_mst c ON fr.Course_Id = c.Course_Id
       LEFT JOIN batch_mst b ON fr.Batch_Id = b.Batch_Id
       LEFT JOIN office_employee_mst e ON fr.Approve = e.Emp_Id
       ${whereClause}
       ORDER BY fr.Id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Filter options
    const [coursesResult] = await pool.query(
      `SELECT DISTINCT c.Course_Id, c.Course_Name
       FROM generate_final_result fr
       JOIN course_mst c ON fr.Course_Id = c.Course_Id
       WHERE (fr.IsDelete = 0 OR fr.IsDelete IS NULL)
       ORDER BY c.Course_Name`
    );
    const [batchesResult] = await pool.query(
      `SELECT DISTINCT b.Batch_Id, b.Batch_code
       FROM generate_final_result fr
       JOIN batch_mst b ON fr.Batch_Id = b.Batch_Id
       WHERE (fr.IsDelete = 0 OR fr.IsDelete IS NULL)
       ORDER BY b.Batch_Id DESC
       LIMIT 50`
    );

    return NextResponse.json({
      rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      filters: {
        courses: coursesResult,
        batches: batchesResult,
      },
    });
  } catch (error: any) {
    console.error('Generate final result GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch final result data', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- POST — Create / Generate final result ---------- */
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'final_result.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { Course_Id, Batch_Id, Result_Dt, Print_Dt, Approved_By, Period_Start, Period_End } = body;

    if (!Course_Id || !Batch_Id || !Result_Dt) {
      return NextResponse.json(
        { error: 'Course, Batch, and Result Date are required' },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO generate_final_result
       (Course_Id, Batch_Id, Result_date, Print_date, Approve, Start_date, End_date, IsActive, IsDelete)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)`,
      [
        Course_Id, Batch_Id,
        Result_Dt, Print_Dt || null,
        Approved_By || null,
        Period_Start || null, Period_End || null,
      ]
    );
    const insertId = (result as any).insertId;

    return NextResponse.json({ success: true, Result_Id: insertId });
  } catch (error: any) {
    console.error('Generate final result POST error:', error);
    return NextResponse.json(
      { error: 'Failed to generate final result', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- PUT — Update final result ---------- */
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'final_result.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { Result_Id } = body;
    if (!Result_Id) {
      return NextResponse.json({ error: 'Result_Id is required' }, { status: 400 });
    }

    await pool.query(
      `UPDATE generate_final_result SET
        Course_Id = ?, Batch_Id = ?, Result_date = ?, Print_date = ?,
        Approve = ?, Start_date = ?, End_date = ?
       WHERE Id = ?`,
      [
        body.Course_Id || null, body.Batch_Id || null,
        body.Result_Dt || null, body.Print_Dt || null,
        body.Approved_By || null,
        body.Period_Start || null, body.Period_End || null,
        Result_Id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Generate final result PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update final result', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- DELETE — Soft delete ---------- */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'final_result.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await pool.query(
      'UPDATE generate_final_result SET IsDelete = 1 WHERE Id = ?',
      [parseInt(id)]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Generate final result DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete final result', details: error.message },
      { status: 500 }
    );
  }
}
