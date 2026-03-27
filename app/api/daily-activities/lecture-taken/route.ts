/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';
function normalizeTextKey(v: unknown) {
  return String(v ?? '').trim().toLowerCase();
}

function normalizeDateKey(v: unknown) {
  const s = String(v ?? '');
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/* ---------- GET — List lectures OR single lecture ---------- */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'lecture.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    /* --- Single lecture by id --- */
    const singleId = searchParams.get('id');
    if (singleId) {
      const [rows] = await pool.query(
        `SELECT lt.*, f.Faculty_Name, b.Batch_code, c.Course_Name
         FROM lecture_taken_master lt
         LEFT JOIN faculty_master f ON lt.Faculty_Id = f.Faculty_Id
         LEFT JOIN batch_mst b ON lt.Batch_Id = b.Batch_Id
         LEFT JOIN course_mst c ON lt.Course_Id = c.Course_Id
         WHERE lt.Take_Id = ? AND (lt.IsDelete = 0 OR lt.IsDelete IS NULL)`,
        [parseInt(singleId)]
      );
      const row = (rows as any[])[0];
      if (!row) {
        return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });
      }

      // Get student count for this lecture
      const [childCount] = await pool.query(
        `SELECT COUNT(*) as total FROM lecture_taken_child WHERE Take_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
        [parseInt(singleId)]
      );
      row.studentCount = (childCount as any[])[0]?.total || 0;

      return NextResponse.json({ lecture: row });
    }

    /* --- Dropdown data (courses, batches, faculties) --- */
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

    if (fetchOptions === 'lectures') {
      const batchId = searchParams.get('batchId');
      if (!batchId) return NextResponse.json({ lectures: [] });
      const [lectures] = await pool.query(
        `SELECT id, lecture_no, subject_topic, subject, faculty_name, starttime, endtime, duration, class_room, date
         FROM batch_lecture_master
         WHERE batch_id = ? AND (deleted = '0' OR deleted IS NULL)
         ORDER BY lecture_no`,
        [batchId]
      );
      return NextResponse.json({ lectures });
    }

    /* --- List lectures with pagination --- */
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '25')));
    const offset = (page - 1) * limit;

    const search = searchParams.get('search')?.trim() || '';
    const courseId = searchParams.get('courseId') || '';
    const batchId = searchParams.get('batchId') || '';
    const facultyId = searchParams.get('facultyId') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    const conditions: string[] = [
      '(lt.IsDelete = 0 OR lt.IsDelete IS NULL)',
    ];
    const params: any[] = [];

    if (search) {
      conditions.push(
        '(lt.Topic LIKE ? OR lt.Lecture_Name LIKE ? OR b.Batch_code LIKE ? OR f.Faculty_Name LIKE ?)'
      );
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    if (courseId) {
      conditions.push('lt.Course_Id = ?');
      params.push(parseInt(courseId));
    }

    if (batchId) {
      conditions.push('lt.Batch_Id = ?');
      params.push(parseInt(batchId));
    }

    if (facultyId) {
      conditions.push('lt.Faculty_Id = ?');
      params.push(parseInt(facultyId));
    }

    if (dateFrom) {
      conditions.push('lt.Take_Dt >= ?');
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push('lt.Take_Dt <= ?');
      params.push(dateTo);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Count (avoid joins unless needed for search)
    const countSql = search
      ? `SELECT COUNT(*) as total
         FROM lecture_taken_master lt
         LEFT JOIN batch_mst b ON lt.Batch_Id = b.Batch_Id
         LEFT JOIN faculty_master f ON lt.Faculty_Id = f.Faculty_Id
         ${whereClause}`
      : `SELECT COUNT(*) as total
         FROM lecture_taken_master lt
         ${whereClause}`;

    const [countResult] = await pool.query(countSql, params);
    const total = (countResult as any[])[0]?.total || 0;

    // Fetch rows (no per-row subquery)
    const [rowsRaw] = await pool.query(
      `SELECT lt.Take_Id, lt.Lecture_Name, lt.Topic, lt.Take_Dt,
              lt.Duration, lt.ClassRoom,
              lt.Faculty_Start, lt.Faculty_End,
              lt.Faculty_Id, lt.Course_Id, lt.Batch_Id, lt.Lecture_Id,
              COALESCE(
                s.lecturecontent, s.subject,
                l.lecturecontent, l.subject
              ) AS Subject,
              COALESCE(s.subject_topic, l.subject_topic) AS Subject_Name,
              f.Faculty_Name, b.Batch_code, c.Course_Name
       FROM lecture_taken_master lt
       LEFT JOIN faculty_master f ON lt.Faculty_Id = f.Faculty_Id
       LEFT JOIN batch_mst b ON lt.Batch_Id = b.Batch_Id
       LEFT JOIN course_mst c ON lt.Course_Id = c.Course_Id
       -- Standard Lecture Plan (primary Trainer Portal source)
       LEFT JOIN batch_slecture_master s
         ON s.id = lt.Lecture_Id
        AND s.batch_id = lt.Batch_Id
        AND (s.deleted IS NULL OR s.deleted = '0' OR s.deleted = 0)
       -- Lecture Plan (fallback)
       LEFT JOIN batch_lecture_master l
         ON l.id = lt.Lecture_Id
        AND l.batch_id = lt.Batch_Id
        AND (l.deleted IS NULL OR l.deleted = '0' OR l.deleted = 0)
       ${whereClause}
       ORDER BY lt.Take_Id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Dedupe within the current page results (keeps the latest Take_Id due to ORDER BY Take_Id DESC).
    const seen = new Set<string>();
    const rows = (rowsRaw as any[])
      .filter((r) => {
        const lectureKey = r.Lecture_Id != null && String(r.Lecture_Id).trim() !== ''
          ? `lid:${String(r.Lecture_Id).trim()}`
          : `ln:${normalizeTextKey(r.Lecture_Name)}|tp:${normalizeTextKey(r.Topic)}`;

        const key = [
          `b:${String(r.Batch_Id ?? '')}`,
          `f:${String(r.Faculty_Id ?? '')}`,
          `d:${normalizeDateKey(r.Take_Dt)}`,
          lectureKey,
        ].join('|');

        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((r) => ({ ...r, studentCount: 0 }));

    // Student counts for current page in one query
    const takeIds = rows.map((r) => Number(r.Take_Id)).filter((n) => Number.isFinite(n));
    if (takeIds.length > 0) {
      const placeholders = takeIds.map(() => '?').join(',');
      const [countRows] = await pool.query<any[]>(
        `SELECT Take_Id, COUNT(*) AS studentCount
         FROM lecture_taken_child
         WHERE Take_Id IN (${placeholders})
           AND (IsDelete = 0 OR IsDelete IS NULL)
         GROUP BY Take_Id`,
        takeIds
      );
      const countMap = new Map<number, number>();
      for (const cr of countRows) countMap.set(Number(cr.Take_Id), Number(cr.studentCount) || 0);
      for (const r of rows) r.studentCount = countMap.get(Number(r.Take_Id)) ?? 0;
    }

    return NextResponse.json(
      {
        rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error: any) {
    console.error('Lecture taken GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lecture data', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- POST — Create new lecture taken ---------- */
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'lecture.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const {
      Course_Id,
      Batch_Id,
      Lecture_Id,
      Lecture_Name,
      Faculty_Id,
      Take_Dt,
      Topic,
      Duration,
      ClassRoom,
      Lecture_Start,
      Lecture_End,
      Faculty_Start,
      Faculty_End,
      Material,
      Documents,
      Assign_Given,
      Assign_Start,
      Assign_End,
      Test_Given,
      Next_Planning,
    } = body;

    if (!Course_Id || !Batch_Id || !Take_Dt) {
      return NextResponse.json(
        { error: 'Course, Batch, and Date are required' },
        { status: 400 }
      );
    }

    const sql = `
      INSERT INTO lecture_taken_master (
        Course_Id, Batch_Id, Lecture_Id, Lecture_Name, Faculty_Id,
        Take_Dt, Topic, Duration, ClassRoom,
        Lecture_Start, Lecture_End, Faculty_Start, Faculty_End,
        Material, Documents, Assign_Given, Assign_Start, Assign_End,
        Test_Given, Next_Planning, IsActive, IsDelete
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
    `;

    const params = [
      Course_Id,
      Batch_Id,
      Lecture_Id || null,
      Lecture_Name?.trim() || null,
      Faculty_Id || null,
      Take_Dt,
      Topic?.trim() || null,
      Duration || null,
      ClassRoom || null,
      Lecture_Start || null,
      Lecture_End || null,
      Faculty_Start || null,
      Faculty_End || null,
      Material || null,
      Documents || null,
      Assign_Given || null,
      Assign_Start || null,
      Assign_End || null,
      Test_Given || null,
      Next_Planning || null,
    ];

    const [result] = await pool.query(sql, params);
    const insertId = (result as any).insertId;

    return NextResponse.json({ success: true, Take_Id: insertId });
  } catch (error: any) {
    console.error('Lecture taken POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create lecture', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- PUT — Update lecture taken ---------- */
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'lecture.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { Take_Id } = body;
    if (!Take_Id) {
      return NextResponse.json({ error: 'Take_Id is required' }, { status: 400 });
    }

    const sql = `
      UPDATE lecture_taken_master SET
        Course_Id = ?, Batch_Id = ?, Lecture_Id = ?, Lecture_Name = ?,
        Faculty_Id = ?, Take_Dt = ?, Topic = ?, Duration = ?, ClassRoom = ?,
        Lecture_Start = ?, Lecture_End = ?, Faculty_Start = ?, Faculty_End = ?,
        Material = ?, Documents = ?, Assign_Given = ?, Assign_Start = ?, Assign_End = ?,
        Test_Given = ?, Next_Planning = ?
      WHERE Take_Id = ?
    `;

    const params = [
      body.Course_Id || null,
      body.Batch_Id || null,
      body.Lecture_Id || null,
      body.Lecture_Name?.trim() || null,
      body.Faculty_Id || null,
      body.Take_Dt || null,
      body.Topic?.trim() || null,
      body.Duration || null,
      body.ClassRoom || null,
      body.Lecture_Start || null,
      body.Lecture_End || null,
      body.Faculty_Start || null,
      body.Faculty_End || null,
      body.Material || null,
      body.Documents || null,
      body.Assign_Given || null,
      body.Assign_Start || null,
      body.Assign_End || null,
      body.Test_Given || null,
      body.Next_Planning || null,
      Take_Id,
    ];

    await pool.query(sql, params);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Lecture taken PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update lecture', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- DELETE — Soft delete lecture ---------- */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'lecture.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await pool.query(
      'UPDATE lecture_taken_master SET IsDelete = 1 WHERE Take_Id = ?',
      [parseInt(id)]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Lecture taken DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete lecture', details: error.message },
      { status: 500 }
    );
  }
}
