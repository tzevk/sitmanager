/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

/* ---------- GET — List site visits OR single visit OR dropdown options ---------- */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'site_visit.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    /* --- Single visit by id --- */
    const singleId = searchParams.get('id');
    if (singleId) {
      const [rows] = await pool.query(
        `SELECT sv.Visit_Id, sv.Region, sv.Location,
                sv.Visit_Date, sv.Visit_Time,
                sv.Bus_No      AS Students_Bus,
                sv.ConfirmDAte AS Confirm_Date,
                sv.Course_Name,
                sv.Batch_ID    AS Batch_Id,
                b.Course_Id,
                b.Batch_code
         FROM site_visit_master sv
         LEFT JOIN batch_mst b ON sv.Batch_ID = b.Batch_Id
         WHERE sv.Visit_Id = ? AND (sv.IsDelete = 0 OR sv.IsDelete IS NULL)`,
        [parseInt(singleId)]
      );
      const row = (rows as any[])[0];
      if (!row) {
        return NextResponse.json({ error: 'Site visit not found' }, { status: 404 });
      }
      return NextResponse.json({ visit: row });
    }

    /* --- Dropdown data --- */
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

    if (fetchOptions === 'regions') {
      const [regions] = await pool.query(
        `SELECT DISTINCT Region FROM site_visit_master
         WHERE Region IS NOT NULL AND Region != ''
           AND (IsDelete = 0 OR IsDelete IS NULL)
         ORDER BY Region`
      );
      return NextResponse.json({ regions });
    }

    /* --- List site visits with pagination --- */
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '25')));
    const offset = (page - 1) * limit;

    const search = searchParams.get('search')?.trim() || '';
    const courseId = searchParams.get('courseId') || '';
    const batchId = searchParams.get('batchId') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    const conditions: string[] = [
      '(sv.IsDelete = 0 OR sv.IsDelete IS NULL)',
    ];
    const params: any[] = [];

    if (search) {
      conditions.push(
        '(sv.Region LIKE ? OR sv.Location LIKE ? OR b.Batch_code LIKE ? OR sv.Course_Name LIKE ?)'
      );
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    if (courseId) {
      conditions.push('b.Course_Id = ?');
      params.push(parseInt(courseId));
    }

    if (batchId) {
      conditions.push('sv.Batch_ID = ?');
      params.push(parseInt(batchId));
    }

    if (dateFrom) {
      conditions.push('sv.Visit_Date >= ?');
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push('sv.Visit_Date <= ?');
      params.push(dateTo);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Count
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total
       FROM site_visit_master sv
       LEFT JOIN batch_mst b ON sv.Batch_ID = b.Batch_Id
       ${whereClause}`,
      params
    );
    const total = (countResult as any[])[0]?.total || 0;

    // Fetch rows
    const [rows] = await pool.query(
      `SELECT sv.Visit_Id, sv.Batch_ID AS Batch_Id, sv.Region,
              sv.Location, sv.Bus_No AS Students_Bus,
              sv.Visit_Date, sv.Visit_Time,
              sv.ConfirmDAte AS Confirm_Date,
              sv.Course_Name, b.Batch_code,
              b.Course_Id
       FROM site_visit_master sv
       LEFT JOIN batch_mst b ON sv.Batch_ID = b.Batch_Id
       ${whereClause}
       ORDER BY sv.Visit_Id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Site visit GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch site visit data', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- POST — Create new site visit ---------- */
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'site_visit.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const {
      Course_Id,
      Batch_Id,
      Region,
      Location,
      Students_Bus,
      Visit_Date,
      Visit_Time,
      Confirm_Date,
    } = body;

    if (!Course_Id || !Batch_Id || !Region || !Visit_Time) {
      return NextResponse.json(
        { error: 'Course, Batch, Region and Time are required' },
        { status: 400 }
      );
    }

    // Look up Course_Name from course_mst
    const [courseRows] = await pool.query(
      'SELECT Course_Name FROM course_mst WHERE Course_Id = ?',
      [Course_Id]
    );
    const courseName = (courseRows as any[])[0]?.Course_Name || null;

    const sql = `
      INSERT INTO site_visit_master (
        Course_Name, Batch_ID, Region, Location, Bus_No,
        Visit_Date, Visit_Time, ConfirmDAte, IsActive, IsDelete
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
    `;

    const params = [
      courseName,
      Batch_Id,
      Region?.trim() || null,
      Location?.trim() || null,
      Students_Bus || null,
      Visit_Date || null,
      Visit_Time || null,
      Confirm_Date || null,
    ];

    const [result] = await pool.query(sql, params);
    const insertId = (result as any).insertId;

    return NextResponse.json({ success: true, Visit_Id: insertId });
  } catch (error: any) {
    console.error('Site visit POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create site visit', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- PUT — Update site visit ---------- */
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'site_visit.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { Visit_Id } = body;
    if (!Visit_Id) {
      return NextResponse.json({ error: 'Visit_Id is required' }, { status: 400 });
    }

    // Look up Course_Name from course_mst if Course_Id provided
    let courseName: string | null = null;
    if (body.Course_Id) {
      const [courseRows] = await pool.query(
        'SELECT Course_Name FROM course_mst WHERE Course_Id = ?',
        [body.Course_Id]
      );
      courseName = (courseRows as any[])[0]?.Course_Name || null;
    }

    const sql = `
      UPDATE site_visit_master SET
        Course_Name = ?, Batch_ID = ?, Region = ?, Location = ?,
        Bus_No = ?, Visit_Date = ?, Visit_Time = ?, ConfirmDAte = ?
      WHERE Visit_Id = ?
    `;

    const params = [
      courseName,
      body.Batch_Id || null,
      body.Region?.trim() || null,
      body.Location?.trim() || null,
      body.Students_Bus || null,
      body.Visit_Date || null,
      body.Visit_Time || null,
      body.Confirm_Date || null,
      Visit_Id,
    ];

    await pool.query(sql, params);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Site visit PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update site visit', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- DELETE — Soft delete site visit ---------- */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'site_visit.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await pool.query(
      'UPDATE site_visit_master SET IsDelete = 1 WHERE Visit_Id = ?',
      [parseInt(id)]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Site visit DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete site visit', details: error.message },
      { status: 500 }
    );
  }
}
