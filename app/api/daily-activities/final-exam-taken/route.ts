/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

/* ---------- GET — List final exams OR single OR dropdown options ---------- */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'final_exam.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    /* --- Single final exam by id --- */
    const singleId = searchParams.get('id');
    if (singleId) {
      const [rows] = await pool.query(
        `SELECT ft.Take_Id, ft.Course_Id, ft.Batch_Id, ft.Test_Id AS Exam_Id,
                ft.Test_No, ft.Marks AS Max_Marks, ft.Test_Dt AS Exam_Dt,
                ft.IsActive, ft.IsDelete,
                c.Course_Name, b.Batch_code,
                fe.Subject AS ExamName, fe.Max_Marks AS FE_MaxMarks,
                fe.Duration AS FE_Duration, fe.Exam_Date AS FE_Date
         FROM final_exam_master ft
         LEFT JOIN course_mst c ON ft.Course_Id = c.Course_Id
         LEFT JOIN batch_mst b ON ft.Batch_Id = b.Batch_Id
         LEFT JOIN batch_final_exam fe ON ft.Test_Id = fe.Exam_Id
         WHERE ft.Take_Id = ? AND (ft.IsDelete = 0 OR ft.IsDelete IS NULL)`,
        [parseInt(singleId)]
      );
      const row = (rows as any[])[0];
      if (!row) {
        return NextResponse.json({ error: 'Final exam record not found' }, { status: 404 });
      }
      return NextResponse.json({ finalExam: row });
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

    if (fetchOptions === 'exams') {
      const batchId = searchParams.get('batchId');
      if (!batchId) return NextResponse.json({ exams: [] });
      const [exams] = await pool.query(
        `SELECT Exam_Id AS id, Subject AS subject, Max_Marks AS max_marks,
                Duration AS duration, Exam_Date AS exam_date
         FROM batch_final_exam
         WHERE Batch_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
         ORDER BY Exam_Id DESC`,
        [batchId]
      );
      return NextResponse.json({ exams });
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

    const conditions: string[] = ['(ft.IsDelete = 0 OR ft.IsDelete IS NULL)'];
    const params: any[] = [];

    if (search) {
      conditions.push(
        '(fe.Subject LIKE ? OR b.Batch_code LIKE ? OR c.Course_Name LIKE ?)'
      );
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (courseId) { conditions.push('ft.Course_Id = ?'); params.push(parseInt(courseId)); }
    if (batchId) { conditions.push('ft.Batch_Id = ?'); params.push(parseInt(batchId)); }
    if (dateFrom) { conditions.push('ft.Test_Dt >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('ft.Test_Dt <= ?'); params.push(dateTo); }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Count
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total
       FROM final_exam_master ft
       LEFT JOIN batch_mst b ON ft.Batch_Id = b.Batch_Id
       LEFT JOIN course_mst c ON ft.Course_Id = c.Course_Id
       LEFT JOIN batch_final_exam fe ON ft.Test_Id = fe.Exam_Id
       ${whereClause}`,
      params
    );
    const total = (countResult as any[])[0]?.total || 0;

    // Rows
    const [rows] = await pool.query(
      `SELECT ft.Take_Id, ft.Course_Id, ft.Batch_Id, ft.Test_Id AS Exam_Id,
              ft.Test_No, ft.Marks AS Max_Marks, ft.Test_Dt AS Exam_Dt,
              c.Course_Name, b.Batch_code,
              fe.Subject AS ExamName, fe.Max_Marks AS FE_MaxMarks, fe.Duration AS FE_Duration
       FROM final_exam_master ft
       LEFT JOIN course_mst c ON ft.Course_Id = c.Course_Id
       LEFT JOIN batch_mst b ON ft.Batch_Id = b.Batch_Id
       LEFT JOIN batch_final_exam fe ON ft.Test_Id = fe.Exam_Id
       ${whereClause}
       ORDER BY ft.Take_Id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Filter options
    const [coursesResult] = await pool.query(
      `SELECT DISTINCT c.Course_Id, c.Course_Name
       FROM final_exam_master ft
       JOIN course_mst c ON ft.Course_Id = c.Course_Id
       WHERE (ft.IsDelete = 0 OR ft.IsDelete IS NULL)
       ORDER BY c.Course_Name`
    );
    const [batchesResult] = await pool.query(
      `SELECT DISTINCT b.Batch_Id, b.Batch_code
       FROM final_exam_master ft
       JOIN batch_mst b ON ft.Batch_Id = b.Batch_Id
       WHERE (ft.IsDelete = 0 OR ft.IsDelete IS NULL)
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
    console.error('Final exam taken GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch final exam data', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- POST — Create new final exam taken ---------- */
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'final_exam.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { Course_Id, Batch_Id, Exam_Id, Test_No, Max_Marks, Exam_Dt } = body;

    if (!Course_Id || !Batch_Id || !Exam_Dt) {
      return NextResponse.json({ error: 'Course, Batch, and Exam Date are required' }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO final_exam_master
       (Course_Id, Batch_Id, Test_Id, Test_No, Marks, Test_Dt, IsActive, IsDelete)
       VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
      [
        Course_Id, Batch_Id,
        Exam_Id || null, Test_No || null, Max_Marks || null,
        Exam_Dt,
      ]
    );
    const insertId = (result as any).insertId;

    return NextResponse.json({ success: true, Take_Id: insertId });
  } catch (error: any) {
    console.error('Final exam taken POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create final exam record', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- PUT — Update final exam taken ---------- */
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'final_exam.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { Take_Id } = body;
    if (!Take_Id) {
      return NextResponse.json({ error: 'Take_Id is required' }, { status: 400 });
    }

    await pool.query(
      `UPDATE final_exam_master SET
        Course_Id = ?, Batch_Id = ?, Test_Id = ?, Test_No = ?,
        Marks = ?, Test_Dt = ?
       WHERE Take_Id = ?`,
      [
        body.Course_Id || null, body.Batch_Id || null,
        body.Exam_Id || null, body.Test_No || null,
        body.Max_Marks || null, body.Exam_Dt || null,
        Take_Id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Final exam taken PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update final exam record', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- DELETE — Soft delete ---------- */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'final_exam.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await pool.query(
      'UPDATE final_exam_master SET IsDelete = 1 WHERE Take_Id = ?',
      [parseInt(id)]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Final exam taken DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete final exam record', details: error.message },
      { status: 500 }
    );
  }
}
