/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

/* ---------- GET — List unit tests OR single OR dropdown options ---------- */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'unit_test.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    /* --- Single unit test by id --- */
    const singleId = searchParams.get('id');
    if (singleId) {
      const [rows] = await pool.query(
        `SELECT tt.*, c.Course_Name, b.Batch_code,
                ut.subject AS UT_Subject, ut.marks AS UT_Marks, ut.duration AS UT_Duration, ut.utdate AS UT_Date
         FROM test_taken_master tt
         LEFT JOIN course_mst c ON tt.Course_Id = c.Course_Id
         LEFT JOIN batch_mst b ON tt.Batch_Id = b.Batch_Id
         LEFT JOIN awt_unittesttaken ut ON tt.Test_Id = ut.id
         WHERE tt.Take_Id = ? AND (tt.IsDelete = 0 OR tt.IsDelete IS NULL)`,
        [parseInt(singleId)]
      );
      const row = (rows as any[])[0];
      if (!row) {
        return NextResponse.json({ error: 'Unit test not found' }, { status: 404 });
      }

      const [childCount] = await pool.query(
        `SELECT COUNT(*) as total FROM test_taken_child WHERE Take_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
        [parseInt(singleId)]
      );
      row.studentCount = (childCount as any[])[0]?.total || 0;

      return NextResponse.json({ unitTest: row });
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

    if (fetchOptions === 'tests') {
      const batchId = searchParams.get('batchId');
      if (!batchId) return NextResponse.json({ tests: [] });
      const [tests] = await pool.query(
        `SELECT id, subject, marks, duration, utdate
         FROM awt_unittesttaken
         WHERE batch_id = ? AND (deleted = 0 OR deleted IS NULL)
         ORDER BY id DESC`,
        [batchId]
      );
      return NextResponse.json({ tests });
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

    const conditions: string[] = ['(tt.IsDelete = 0 OR tt.IsDelete IS NULL)'];
    const params: any[] = [];

    if (search) {
      conditions.push(
        '(ut.subject LIKE ? OR b.Batch_code LIKE ? OR c.Course_Name LIKE ?)'
      );
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (courseId) { conditions.push('tt.Course_Id = ?'); params.push(parseInt(courseId)); }
    if (batchId) { conditions.push('tt.Batch_Id = ?'); params.push(parseInt(batchId)); }
    if (dateFrom) { conditions.push('tt.Test_Dt >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('tt.Test_Dt <= ?'); params.push(dateTo); }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Count
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total
       FROM test_taken_master tt
       LEFT JOIN batch_mst b ON tt.Batch_Id = b.Batch_Id
       LEFT JOIN course_mst c ON tt.Course_Id = c.Course_Id
       LEFT JOIN awt_unittesttaken ut ON tt.Test_Id = ut.id
       ${whereClause}`,
      params
    );
    const total = (countResult as any[])[0]?.total || 0;

    // Rows
    const [rows] = await pool.query(
      `SELECT tt.Take_Id, tt.Course_Id, tt.Batch_Id, tt.Test_Id,
              tt.Test_No, tt.Marks, tt.Test_Dt,
              c.Course_Name, b.Batch_code,
              ut.subject AS TestName, ut.marks AS UT_Marks, ut.duration AS UT_Duration,
              (SELECT COUNT(*) FROM test_taken_child tc
               WHERE tc.Take_Id = tt.Take_Id AND (tc.IsDelete = 0 OR tc.IsDelete IS NULL)
              ) as studentCount
       FROM test_taken_master tt
       LEFT JOIN course_mst c ON tt.Course_Id = c.Course_Id
       LEFT JOIN batch_mst b ON tt.Batch_Id = b.Batch_Id
       LEFT JOIN awt_unittesttaken ut ON tt.Test_Id = ut.id
       ${whereClause}
       ORDER BY tt.Take_Id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Filter options
    const [coursesResult] = await pool.query(
      `SELECT DISTINCT c.Course_Id, c.Course_Name
       FROM test_taken_master tt
       JOIN course_mst c ON tt.Course_Id = c.Course_Id
       WHERE (tt.IsDelete = 0 OR tt.IsDelete IS NULL)
       ORDER BY c.Course_Name`
    );
    const [batchesResult] = await pool.query(
      `SELECT DISTINCT b.Batch_Id, b.Batch_code
       FROM test_taken_master tt
       JOIN batch_mst b ON tt.Batch_Id = b.Batch_Id
       WHERE (tt.IsDelete = 0 OR tt.IsDelete IS NULL)
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
    console.error('Unit test taken GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unit test data', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- POST — Create new unit test taken ---------- */
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'unit_test.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { Course_Id, Batch_Id, Test_Id, Test_No, Marks, Test_Dt } = body;

    if (!Course_Id || !Batch_Id || !Test_Dt) {
      return NextResponse.json({ error: 'Course, Batch, and Test Date are required' }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO test_taken_master
       (Course_Id, Batch_Id, Test_Id, Test_No, Marks, Test_Dt, IsActive, IsDelete)
       VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
      [
        Course_Id, Batch_Id,
        Test_Id || null, Test_No || null, Marks || null,
        Test_Dt,
      ]
    );
    const insertId = (result as any).insertId;

    return NextResponse.json({ success: true, Take_Id: insertId });
  } catch (error: any) {
    console.error('Unit test taken POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create unit test', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- PUT — Update unit test taken ---------- */
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'unit_test.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { Take_Id } = body;
    if (!Take_Id) {
      return NextResponse.json({ error: 'Take_Id is required' }, { status: 400 });
    }

    await pool.query(
      `UPDATE test_taken_master SET
        Course_Id = ?, Batch_Id = ?, Test_Id = ?, Test_No = ?,
        Marks = ?, Test_Dt = ?
       WHERE Take_Id = ?`,
      [
        body.Course_Id || null, body.Batch_Id || null,
        body.Test_Id || null, body.Test_No || null,
        body.Marks || null, body.Test_Dt || null,
        Take_Id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Unit test taken PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update unit test', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- DELETE — Soft delete ---------- */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'unit_test.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await pool.query(
      'UPDATE test_taken_master SET IsDelete = 1 WHERE Take_Id = ?',
      [parseInt(id)]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Unit test taken DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete unit test', details: error.message },
      { status: 500 }
    );
  }
}
