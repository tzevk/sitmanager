/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { dashboardRateLimiter } from '@/lib/rate-limit';

/* ── Schema discovery for test_taken_child ─────────────────────────────────── */
async function getTestChildSchema(pool: any): Promise<{
  studentCol: string;
  marksCol: string;
  statusCol: string;
  idCol: string;
  deleteClause: string;
}> {
  try {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'test_taken_child'`
    );
    const cols = new Set((rows as any[]).map((r: any) => String(r.COLUMN_NAME)));

    let studentCol = 'Student_Id';
    let marksCol = 'Marks';
    let statusCol = 'Status';
    let idCol = 'ID';
    for (const col of cols) {
      const lc = col.toLowerCase();
      if (studentCol === 'Student_Id' && ['student_id', 'admission_id', 'studentid'].some(c => lc.includes(c))) {
        studentCol = col;
      }
      if (marksCol === 'Marks' && ['mark', 'score', 'obtain'].some(c => lc.includes(c))) {
        marksCol = col;
      }
      if (lc === 'status') statusCol = col;
      if (lc === 'id') idCol = col;
    }

    const hasDelete = cols.has('IsDelete') || cols.has('isdelete');
    return {
      studentCol,
      marksCol,
      statusCol,
      idCol,
      deleteClause: hasDelete ? 'AND (ttc.IsDelete = 0 OR ttc.IsDelete IS NULL)' : '',
    };
  } catch {
    return { studentCol: 'Student_Id', marksCol: 'Marks', statusCol: 'Status', idCol: 'ID', deleteClause: '' };
  }
}

/* ---------- GET — List unit tests OR single OR dropdown options ---------- */
export async function GET(req: NextRequest) {
  try {
    const rateLimited = await dashboardRateLimiter(req);
    if (rateLimited) return rateLimited;

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

    /* --- Students for a batch with their marks for a given test --- */
    if (fetchOptions === 'students') {
      const batchId = searchParams.get('batchId');
      const takeId = searchParams.get('takeId');
      if (!batchId) return NextResponse.json({ students: [] });

      const [students] = await pool.query(
        `SELECT a.Admission_Id, a.Student_Id, a.Student_Code, s.Student_Name, a.Roll_No
         FROM admission_master a
         JOIN student_master s ON a.Student_Id = s.Student_Id
         WHERE a.Batch_Id = ?
           AND (a.IsDelete = 0 OR a.IsDelete IS NULL)
           AND (a.Cancel = 0 OR a.Cancel IS NULL)
         ORDER BY CAST(COALESCE(a.Roll_No, '0') AS UNSIGNED), s.Student_Name`,
        [parseInt(batchId)]
      );

      const marksMap: Record<string, number | null> = {};
      const statusMap: Record<string, string | null> = {};
      const childIdMap: Record<string, number | null> = {};
      if (takeId && parseInt(takeId) > 0) {
        try {
          const { studentCol, marksCol, statusCol, idCol, deleteClause } = await getTestChildSchema(pool);
          const [childRows] = await pool.query(
            `SELECT ttc.\`${studentCol}\` AS raw_sid,
                    IFNULL(ttc.\`${marksCol}\`, NULL) AS marks_obtained,
                    ttc.\`${statusCol}\` AS status,
                    ttc.\`${idCol}\` AS child_id
             FROM test_taken_child ttc
             WHERE ttc.Take_Id = ? ${deleteClause}`,
            [parseInt(takeId)]
          );
          for (const row of childRows as any[]) {
            marksMap[String(row.raw_sid)] = row.marks_obtained ?? null;
            statusMap[String(row.raw_sid)] = row.status ?? null;
            childIdMap[String(row.raw_sid)] = row.child_id ?? null;
          }
        } catch { /* schema may differ — marks stay null */ }
      }

      const result = (students as any[]).map((s: any, idx: number) => ({
        row_num: idx + 1,
        Admission_Id: s.Admission_Id,
        Student_Id: s.Student_Id,
        Student_Code: s.Student_Code,
        Student_Name: s.Student_Name,
        Roll_No: s.Roll_No,
        marks_obtained: marksMap[String(s.Student_Id)] ?? marksMap[String(s.Admission_Id)] ?? null,
        status: statusMap[String(s.Student_Id)] ?? statusMap[String(s.Admission_Id)] ?? null,
        child_id: childIdMap[String(s.Student_Id)] ?? childIdMap[String(s.Admission_Id)] ?? null,
      }));

      return NextResponse.json({ students: result });
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
    const rateLimited = await dashboardRateLimiter(req);
    if (rateLimited) return rateLimited;

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
    const rateLimited = await dashboardRateLimiter(req);
    if (rateLimited) return rateLimited;

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

    /* ── Save student marks if provided ── */
    if (body.studentMarks && Array.isArray(body.studentMarks) && body.studentMarks.length > 0) {
      const { studentCol, marksCol, statusCol, idCol } = await getTestChildSchema(pool);
      for (const sm of body.studentMarks) {
        if (sm.child_id) {
          await pool.query(
            `UPDATE test_taken_child SET \`${marksCol}\` = ?, \`${statusCol}\` = ?
             WHERE \`${idCol}\` = ? AND Take_Id = ?`,
            [sm.marks_obtained ?? null, sm.status ?? null, sm.child_id, Take_Id]
          );
        } else {
          await pool.query(
            `INSERT INTO test_taken_child
               (Take_Id, Test_Id, \`${studentCol}\`, Student_Name, \`${marksCol}\`, Marks_from, \`${statusCol}\`, IsActive, IsDelete)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)`,
            [
              Take_Id, body.Test_Id || null,
              sm.Student_Id, sm.Student_Name || '',
              sm.marks_obtained ?? null,
              body.Marks || null,
              sm.status ?? null,
            ]
          );
        }
      }
    }

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
    const rateLimited = await dashboardRateLimiter(req);
    if (rateLimited) return rateLimited;

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
