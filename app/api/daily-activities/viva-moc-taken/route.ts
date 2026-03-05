/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

/*
  Actual table: awt_vivamoctaken
  Columns: id (PK), coursename (varchar), batchcode (varchar — stores Batch_Id),
           vivamocname (varchar), marks (varchar), date (varchar),
           created_by, updated_by, created_date, updated_date, deleted (int)
*/

/* ---------- GET — List viva/moc taken OR single OR dropdown options ---------- */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'viva_moc.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    /* --- Single record by id --- */
    const singleId = searchParams.get('id');
    if (singleId) {
      const [rows] = await pool.query(
        `SELECT vm.id, vm.coursename, vm.batchcode, vm.vivamocname, vm.marks, vm.date,
                b.Batch_Id, b.Batch_code AS Batch_code_display, b.Course_Id,
                c.Course_Name
         FROM awt_vivamoctaken vm
         LEFT JOIN batch_mst b ON CAST(vm.batchcode AS UNSIGNED) = b.Batch_Id
         LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
         WHERE vm.id = ? AND (vm.deleted = 0 OR vm.deleted IS NULL)`,
        [parseInt(singleId)]
      );
      const row = (rows as any[])[0];
      if (!row) {
        return NextResponse.json({ error: 'Viva/MOC record not found' }, { status: 404 });
      }
      return NextResponse.json({ vivaMoc: row });
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

    if (fetchOptions === 'mocs') {
      const batchId = searchParams.get('batchId');
      if (!batchId) return NextResponse.json({ mocs: [] });
      const [mocs] = await pool.query(
        `SELECT id, subject, marks, date
         FROM batch_moc_master
         WHERE batch_id = ? AND (deleted = 0 OR deleted IS NULL)
         ORDER BY id DESC`,
        [batchId]
      );
      return NextResponse.json({ mocs });
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

    const conditions: string[] = ['(vm.deleted = 0 OR vm.deleted IS NULL)'];
    const params: any[] = [];

    if (search) {
      conditions.push(
        '(vm.vivamocname LIKE ? OR b.Batch_code LIKE ? OR c.Course_Name LIKE ?)'
      );
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (courseId) { conditions.push('b.Course_Id = ?'); params.push(parseInt(courseId)); }
    if (batchId) { conditions.push('vm.batchcode = ?'); params.push(batchId); }
    if (dateFrom) { conditions.push('vm.date >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('vm.date <= ?'); params.push(dateTo); }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Count
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total
       FROM awt_vivamoctaken vm
       LEFT JOIN batch_mst b ON CAST(vm.batchcode AS UNSIGNED) = b.Batch_Id
       LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
       ${whereClause}`,
      params
    );
    const total = (countResult as any[])[0]?.total || 0;

    // Rows
    const [rows] = await pool.query(
      `SELECT vm.id, vm.batchcode, vm.vivamocname, vm.marks, vm.date,
              b.Batch_code AS Batch_code_display, c.Course_Name
       FROM awt_vivamoctaken vm
       LEFT JOIN batch_mst b ON CAST(vm.batchcode AS UNSIGNED) = b.Batch_Id
       LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
       ${whereClause}
       ORDER BY vm.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Filter options
    const [coursesResult] = await pool.query(
      `SELECT DISTINCT c.Course_Id, c.Course_Name
       FROM awt_vivamoctaken vm
       JOIN batch_mst b ON CAST(vm.batchcode AS UNSIGNED) = b.Batch_Id
       JOIN course_mst c ON b.Course_Id = c.Course_Id
       WHERE (vm.deleted = 0 OR vm.deleted IS NULL)
       ORDER BY c.Course_Name`
    );
    const [batchesResult] = await pool.query(
      `SELECT DISTINCT b.Batch_Id, b.Batch_code
       FROM awt_vivamoctaken vm
       JOIN batch_mst b ON CAST(vm.batchcode AS UNSIGNED) = b.Batch_Id
       WHERE (vm.deleted = 0 OR vm.deleted IS NULL)
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
    console.error('Viva/MOC taken GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch viva/moc data', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- POST — Create new viva/moc taken ---------- */
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'viva_moc.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { batchcode, vivamocname, marks, date } = body;

    if (!batchcode || !vivamocname || !date) {
      return NextResponse.json({ error: 'Batch, Viva/MOC Name, and Date are required' }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO awt_vivamoctaken
       (batchcode, vivamocname, marks, date, deleted, created_date)
       VALUES (?, ?, ?, ?, 0, NOW())`,
      [
        batchcode,
        vivamocname,
        marks || null,
        date,
      ]
    );
    const insertId = (result as any).insertId;

    return NextResponse.json({ success: true, id: insertId });
  } catch (error: any) {
    console.error('Viva/MOC taken POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create viva/moc record', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- PUT — Update viva/moc taken ---------- */
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'viva_moc.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await pool.query(
      `UPDATE awt_vivamoctaken SET
        batchcode = ?, vivamocname = ?,
        marks = ?, date = ?, updated_date = NOW()
       WHERE id = ?`,
      [
        body.batchcode || null, body.vivamocname || null,
        body.marks || null, body.date || null,
        id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Viva/MOC taken PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update viva/moc record', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- DELETE — Soft delete ---------- */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'viva_moc.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await pool.query(
      'UPDATE awt_vivamoctaken SET deleted = 1 WHERE id = ?',
      [parseInt(id)]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Viva/MOC taken DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete viva/moc record', details: error.message },
      { status: 500 }
    );
  }
}
