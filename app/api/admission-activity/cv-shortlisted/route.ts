/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { cache, cacheTTL } from '@/lib/cache';
import { requirePermission } from '@/lib/api-auth';

// GET - fetch cv_shortlisted records with pagination, search, and filters
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'cv_shortlisted.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';
    const id = searchParams.get('id');

    // Single record fetch (with children)
    if (id) {
      const [rows] = await pool.query<any[]>(
        `SELECT cv.*, b.Batch_Code, c.Course_Name
         FROM cv_shortlisted cv
         LEFT JOIN batch_mst b ON cv.Batch_Id = b.Batch_Id
         LEFT JOIN course_mst c ON cv.Course_id = c.Course_Id
         WHERE cv.id = ? AND (cv.IsDelete = 0 OR cv.IsDelete IS NULL)`,
        [id]
      );
      if (!rows.length) {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 });
      }
      const [children] = await pool.query<any[]>(
        `SELECT * FROM cvchild WHERE CV_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
        [id]
      );
      return NextResponse.json({ record: rows[0], children });
    }

    // Cache check
    const cacheKey = `cv_shortlisted:list:${page}:${limit}:${search}`;
    const cachedData = cache.get<any>(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData, { headers: { 'X-Cache': 'HIT' } });
    }

    // Build WHERE
    const conditions: string[] = ['(cv.IsDelete = 0 OR cv.IsDelete IS NULL)'];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(`(cv.CompanyName LIKE ? OR b.Batch_Code LIKE ? OR c.Course_Name LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const where = conditions.join(' AND ');

    // Count
    const [countRows] = await pool.query<any[]>(
      `SELECT COUNT(*) AS total FROM cv_shortlisted cv
       LEFT JOIN batch_mst b ON cv.Batch_Id = b.Batch_Id
       LEFT JOIN course_mst c ON cv.Course_id = c.Course_Id
       WHERE ${where}`,
      params
    );
    const total = countRows[0]?.total ?? 0;

    // Data
    const [rows] = await pool.query<any[]>(
      `SELECT cv.id, cv.CompanyName, cv.TDate, cv.Course_id, cv.Batch_Id, cv.Company_Id,
              cv.CompanyReqId, b.Batch_Code, c.Course_Name
       FROM cv_shortlisted cv
       LEFT JOIN batch_mst b ON cv.Batch_Id = b.Batch_Id
       LEFT JOIN course_mst c ON cv.Course_id = c.Course_Id
       WHERE ${where}
       ORDER BY cv.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Dropdown options
    const [courses] = await pool.query<any[]>(
      `SELECT Course_Id, Course_Name FROM course_mst WHERE (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Course_Name`
    );
    const [companies] = await pool.query<any[]>(
      `SELECT Const_Id, Comp_Name FROM consultant_mst WHERE (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Comp_Name`
    );

    const responseData = {
      rows,
      courses,
      companies,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };

    cache.set(cacheKey, responseData, cacheTTL.medium);
    return NextResponse.json(responseData, { headers: { 'X-Cache': 'MISS' } });
  } catch (err: unknown) {
    console.error('CV Shortlisted GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - create cv_shortlisted record with children
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'cv_shortlisted.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { CompanyName, TDate, Course_id, Batch_Id, Company_Id, CompanyReqId, students } = body;

    if (!TDate || !Company_Id || !Course_id || !Batch_Id) {
      return NextResponse.json({ error: 'Date, Company, Course and Batch are required' }, { status: 400 });
    }

    // Insert parent
    const [result] = await pool.query<any>(
      `INSERT INTO cv_shortlisted (CompanyName, TDate, Course_id, Batch_Id, Company_Id, CompanyReqId, IsDelete, IsActive)
       VALUES (?, ?, ?, ?, ?, ?, 0, 1)`,
      [CompanyName || null, TDate || null, Course_id || null, Batch_Id || null, Company_Id || null, CompanyReqId || null]
    );
    const cvId = result.insertId;

    // Insert children (students)
    if (students && Array.isArray(students) && students.length > 0) {
      for (const s of students) {
        await pool.query(
          `INSERT INTO cvchild (CV_Id, Student_Name, Student_Id, Student_Code, Batch_id, Result, Placement, Sended, Remark, PlacedBy, Placement_Type, Placement_Block, Placement_BlockReason, BlockReason_Remark, IsActive, IsDelete)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
          [
            cvId,
            s.Student_Name || null,
            s.Student_Id || null,
            s.Student_Code || null,
            Batch_Id || null,
            s.Result || 'No',
            s.Placement || 'No',
            s.Sended || 'No',
            s.Remark || null,
            s.PlacedBy || null,
            s.Placement_Type || null,
            s.Placement_Block || null,
            s.Placement_BlockReason || null,
            s.BlockReason_Remark || null,
          ]
        );
      }
    }

    cache.deleteByPrefix('cv_shortlisted:');
    return NextResponse.json({ success: true, insertId: cvId });
  } catch (err: unknown) {
    console.error('CV Shortlisted POST error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - update cv_shortlisted record and children
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'cv_shortlisted.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { id, CompanyName, TDate, Course_id, Batch_Id, Company_Id, CompanyReqId, students } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Update parent
    await pool.query(
      `UPDATE cv_shortlisted SET CompanyName = ?, TDate = ?, Course_id = ?, Batch_Id = ?, Company_Id = ?, CompanyReqId = ?
       WHERE id = ?`,
      [CompanyName || null, TDate || null, Course_id || null, Batch_Id || null, Company_Id || null, CompanyReqId || null, id]
    );

    // Update children - soft delete existing, re-insert
    if (students && Array.isArray(students)) {
      await pool.query(`UPDATE cvchild SET IsDelete = 1 WHERE CV_Id = ?`, [id]);

      for (const s of students) {
        if (s.Id) {
          // Update existing
          await pool.query(
            `UPDATE cvchild SET Student_Name = ?, Student_Id = ?, Student_Code = ?, Batch_id = ?,
             Result = ?, Placement = ?, Sended = ?, Remark = ?, PlacedBy = ?, Placement_Type = ?,
             Placement_Block = ?, Placement_BlockReason = ?, BlockReason_Remark = ?, IsDelete = 0
             WHERE Id = ?`,
            [
              s.Student_Name || null, s.Student_Id || null, s.Student_Code || null, Batch_Id || null,
              s.Result || 'No', s.Placement || 'No', s.Sended || 'No', s.Remark || null,
              s.PlacedBy || null, s.Placement_Type || null, s.Placement_Block || null,
              s.Placement_BlockReason || null, s.BlockReason_Remark || null, s.Id,
            ]
          );
        } else {
          // Insert new
          await pool.query(
            `INSERT INTO cvchild (CV_Id, Student_Name, Student_Id, Student_Code, Batch_id, Result, Placement, Sended, Remark, PlacedBy, Placement_Type, Placement_Block, Placement_BlockReason, BlockReason_Remark, IsActive, IsDelete)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
            [
              id, s.Student_Name || null, s.Student_Id || null, s.Student_Code || null, Batch_Id || null,
              s.Result || 'No', s.Placement || 'No', s.Sended || 'No', s.Remark || null,
              s.PlacedBy || null, s.Placement_Type || null, s.Placement_Block || null,
              s.Placement_BlockReason || null, s.BlockReason_Remark || null,
            ]
          );
        }
      }
    }

    cache.deleteByPrefix('cv_shortlisted:');
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('CV Shortlisted PUT error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - soft delete cv_shortlisted record
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'cv_shortlisted.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await pool.query(`UPDATE cv_shortlisted SET IsDelete = 1 WHERE id = ?`, [id]);
    await pool.query(`UPDATE cvchild SET IsDelete = 1 WHERE CV_Id = ?`, [id]);

    cache.deleteByPrefix('cv_shortlisted:');
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('CV Shortlisted DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
