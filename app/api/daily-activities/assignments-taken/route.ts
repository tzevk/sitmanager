/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

/* ---------- GET — List assignments OR single OR dropdown options ---------- */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'assignment.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    /* --- Single assignment by id --- */
    const singleId = searchParams.get('id');
    if (singleId) {
      const [rows] = await pool.query(
        `SELECT at.*, c.Course_Name, b.Batch_code,
                am.assignmentname AS AssignmentName, am.subjects, am.marks AS AssignmentMarks,
                f.Faculty_Name
         FROM assignment_taken at
         LEFT JOIN course_mst c ON at.Course_Id = c.Course_Id
         LEFT JOIN batch_mst b ON at.Batch_Id = b.Batch_Id
         LEFT JOIN assignmentstaken am ON at.Assignment_Id = am.id
         LEFT JOIN faculty_master f ON at.Faculty_Id = f.Faculty_Id
         WHERE at.Given_Id = ? AND (at.IsDelete = 0 OR at.IsDelete IS NULL)`,
        [parseInt(singleId)]
      );
      const row = (rows as any[])[0];
      if (!row) {
        return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
      }

      const [childCount] = await pool.query(
        `SELECT COUNT(*) as total FROM assignment_given_child WHERE Given_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
        [parseInt(singleId)]
      );
      row.studentCount = (childCount as any[])[0]?.total || 0;

      return NextResponse.json({ assignment: row });
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

    if (fetchOptions === 'faculties') {
      const [faculties] = await pool.query(
        `SELECT Faculty_Id, Faculty_Name FROM faculty_master
         WHERE (IsDelete = 0 OR IsDelete IS NULL)
         ORDER BY Faculty_Name`
      );
      return NextResponse.json({ faculties });
    }

    if (fetchOptions === 'assignments') {
      const batchId = searchParams.get('batchId');
      if (!batchId) return NextResponse.json({ assignments: [] });
      const [assignments] = await pool.query(
        `SELECT id, assignmentname, subjects, marks, assignmentdate
         FROM assignmentstaken
         WHERE batch_id = ? AND (deleted = 0 OR deleted IS NULL)
         ORDER BY id DESC`,
        [batchId]
      );
      return NextResponse.json({ assignments });
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

    const conditions: string[] = ['(at.IsDelete = 0 OR at.IsDelete IS NULL)'];
    const params: any[] = [];

    if (search) {
      conditions.push(
        '(am.assignmentname LIKE ? OR b.Batch_code LIKE ? OR c.Course_Name LIKE ? OR f.Faculty_Name LIKE ?)'
      );
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (courseId) { conditions.push('at.Course_Id = ?'); params.push(parseInt(courseId)); }
    if (batchId) { conditions.push('at.Batch_Id = ?'); params.push(parseInt(batchId)); }
    if (dateFrom) { conditions.push('at.Assign_Dt >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('at.Assign_Dt <= ?'); params.push(dateTo); }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Count
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total
       FROM assignment_taken at
       LEFT JOIN batch_mst b ON at.Batch_Id = b.Batch_Id
       LEFT JOIN course_mst c ON at.Course_Id = c.Course_Id
       LEFT JOIN assignmentstaken am ON at.Assignment_Id = am.id
       LEFT JOIN faculty_master f ON at.Faculty_Id = f.Faculty_Id
       ${whereClause}`,
      params
    );
    const total = (countResult as any[])[0]?.total || 0;

    // Rows
    const [rows] = await pool.query(
      `SELECT at.Given_Id, at.Course_Id, at.Batch_Id, at.Assignment_Id,
              at.Assign_No, at.Marks, at.Faculty_Id, at.Assign_Dt, at.Return_Dt,
              c.Course_Name, b.Batch_code,
              am.assignmentname AS AssignmentName, am.subjects,
              f.Faculty_Name,
              (SELECT COUNT(*) FROM assignment_given_child agc
               WHERE agc.Given_Id = at.Given_Id AND (agc.IsDelete = 0 OR agc.IsDelete IS NULL)
              ) as studentCount
       FROM assignment_taken at
       LEFT JOIN course_mst c ON at.Course_Id = c.Course_Id
       LEFT JOIN batch_mst b ON at.Batch_Id = b.Batch_Id
       LEFT JOIN assignmentstaken am ON at.Assignment_Id = am.id
       LEFT JOIN faculty_master f ON at.Faculty_Id = f.Faculty_Id
       ${whereClause}
       ORDER BY at.Given_Id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Filter options
    const [coursesResult] = await pool.query(
      `SELECT DISTINCT c.Course_Id, c.Course_Name
       FROM assignment_taken at
       JOIN course_mst c ON at.Course_Id = c.Course_Id
       WHERE (at.IsDelete = 0 OR at.IsDelete IS NULL)
       ORDER BY c.Course_Name`
    );
    const [batchesResult] = await pool.query(
      `SELECT DISTINCT b.Batch_Id, b.Batch_code
       FROM assignment_taken at
       JOIN batch_mst b ON at.Batch_Id = b.Batch_Id
       WHERE (at.IsDelete = 0 OR at.IsDelete IS NULL)
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
    console.error('Assignments taken GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assignment data', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- POST — Create new assignment taken ---------- */
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'assignment.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { Course_Id, Batch_Id, Assignment_Id, Assign_No, Marks, Faculty_Id, Assign_Dt, Return_Dt } = body;

    if (!Course_Id || !Batch_Id || !Assign_Dt) {
      return NextResponse.json({ error: 'Course, Batch, and Assignment Date are required' }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO assignment_taken
       (Course_Id, Batch_Id, Assignment_Id, Assign_No, Marks, Faculty_Id, Assign_Dt, Return_Dt, IsActive, IsDelete)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
      [
        Course_Id, Batch_Id,
        Assignment_Id || null, Assign_No || null, Marks || null,
        Faculty_Id || null, Assign_Dt, Return_Dt || null,
      ]
    );
    const insertId = (result as any).insertId;

    return NextResponse.json({ success: true, Given_Id: insertId });
  } catch (error: any) {
    console.error('Assignments taken POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create assignment', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- PUT — Update assignment taken ---------- */
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'assignment.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { Given_Id } = body;
    if (!Given_Id) {
      return NextResponse.json({ error: 'Given_Id is required' }, { status: 400 });
    }

    await pool.query(
      `UPDATE assignment_taken SET
        Course_Id = ?, Batch_Id = ?, Assignment_Id = ?, Assign_No = ?,
        Marks = ?, Faculty_Id = ?, Assign_Dt = ?, Return_Dt = ?
       WHERE Given_Id = ?`,
      [
        body.Course_Id || null, body.Batch_Id || null,
        body.Assignment_Id || null, body.Assign_No || null,
        body.Marks || null, body.Faculty_Id || null,
        body.Assign_Dt || null, body.Return_Dt || null,
        Given_Id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Assignments taken PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update assignment', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- DELETE — Soft delete ---------- */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'assignment.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await pool.query(
      'UPDATE assignment_taken SET IsDelete = 1 WHERE Given_Id = ?',
      [parseInt(id)]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Assignments taken DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete assignment', details: error.message },
      { status: 500 }
    );
  }
}
