/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { cache, cacheTTL } from '@/lib/cache';
import { requirePermission } from '@/lib/api-auth';

// GET - fetch company_requirements_apk records with pagination, search
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'shortlisted_sit.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';
    const id = searchParams.get('id');

    // Single record fetch (with batch children)
    if (id) {
      const [rows] = await pool.query<any[]>(
        `SELECT cr.*, cm.Comp_Name, co.Course_Name
         FROM company_requirements_apk cr
         LEFT JOIN consultant_mst cm ON cr.CompanyId = cm.Const_Id
         LEFT JOIN course_mst co ON cr.CourseId = co.Course_Id
         WHERE cr.CompReqId = ? AND (cr.IsDelete = 0 OR cr.IsDelete IS NULL)`,
        [id]
      );
      if (!rows.length) {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 });
      }
      const [children] = await pool.query<any[]>(
        `SELECT cbd.*, b.Batch_Code
         FROM company_req_batch_details_apk cbd
         LEFT JOIN batch_mst b ON cbd.BatchId = b.Batch_Id
         WHERE cbd.CompanyReqId = ? AND (cbd.IsDelete = 0 OR cbd.IsDelete IS NULL)`,
        [id]
      );
      return NextResponse.json({ record: rows[0], children });
    }

    // Cache check
    const cacheKey = `shortlisted_sit:list:${page}:${limit}:${search}`;
    const cachedData = cache.get<any>(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData, { headers: { 'X-Cache': 'HIT' } });
    }

    // Build WHERE
    const conditions: string[] = ['(cr.IsDelete = 0 OR cr.IsDelete IS NULL)'];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(
        `(cm.Comp_Name LIKE ? OR co.Course_Name LIKE ? OR cr.Profile LIKE ? OR cr.Location LIKE ?)`
      );
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const where = conditions.join(' AND ');

    // Count
    const [countRows] = await pool.query<any[]>(
      `SELECT COUNT(*) AS total FROM company_requirements_apk cr
       LEFT JOIN consultant_mst cm ON cr.CompanyId = cm.Const_Id
       LEFT JOIN course_mst co ON cr.CourseId = co.Course_Id
       WHERE ${where}`,
      params
    );
    const total = countRows[0]?.total ?? 0;

    // Data
    const [rows] = await pool.query<any[]>(
      `SELECT cr.CompReqId, cr.CompanyId, cr.CourseId, cr.Profile, cr.Location,
              cr.Eligibility, cr.Responsibility, cr.IsPassStudents, cr.PostedDate,
              cm.Comp_Name, co.Course_Name
       FROM company_requirements_apk cr
       LEFT JOIN consultant_mst cm ON cr.CompanyId = cm.Const_Id
       LEFT JOIN course_mst co ON cr.CourseId = co.Course_Id
       WHERE ${where}
       ORDER BY cr.CompReqId DESC
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
    const [allBatches] = await pool.query<any[]>(
      `SELECT Batch_Id, Batch_Code, Course_Id FROM batch_mst WHERE (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Batch_Code`
    );

    const responseData = {
      rows,
      courses,
      companies,
      batches: allBatches,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };

    cache.set(cacheKey, responseData, cacheTTL.medium);
    return NextResponse.json(responseData, { headers: { 'X-Cache': 'MISS' } });
  } catch (err: unknown) {
    console.error('Shortlisted By SIT GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - create company requirement with batch details
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'shortlisted_sit.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { CompanyId, CourseId, Profile, Location, Eligibility, Responsibility, IsPassStudents, PostedDate, batches } = body;

    if (!CompanyId || !CourseId) {
      return NextResponse.json({ error: 'Company and Course are required' }, { status: 400 });
    }

    // Insert parent
    const [result] = await pool.query<any>(
      `INSERT INTO company_requirements_apk (CompanyId, CourseId, Profile, Location, Eligibility, Responsibility, IsPassStudents, PostedDate, IsActive, IsDelete)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
      [
        CompanyId, CourseId,
        Profile || null, Location || null,
        Eligibility || null, Responsibility || null,
        IsPassStudents || 0, PostedDate || null,
      ]
    );
    const compReqId = result.insertId;

    // Insert batch children
    if (batches && Array.isArray(batches) && batches.length > 0) {
      for (const b of batches) {
        await pool.query(
          `INSERT INTO company_req_batch_details_apk (CompanyReqId, BatchId, IsActive, IsDelete)
           VALUES (?, ?, 1, 0)`,
          [compReqId, b.BatchId]
        );
      }
    }

    cache.deleteByPrefix('shortlisted_sit:');
    return NextResponse.json({ success: true, insertId: compReqId });
  } catch (err: unknown) {
    console.error('Shortlisted By SIT POST error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - update company requirement and batch details
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'shortlisted_sit.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { CompReqId, CompanyId, CourseId, Profile, Location, Eligibility, Responsibility, IsPassStudents, PostedDate, batches } = body;

    if (!CompReqId) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Update parent
    await pool.query(
      `UPDATE company_requirements_apk
       SET CompanyId = ?, CourseId = ?, Profile = ?, Location = ?, Eligibility = ?, Responsibility = ?, IsPassStudents = ?, PostedDate = ?
       WHERE CompReqId = ?`,
      [
        CompanyId, CourseId,
        Profile || null, Location || null,
        Eligibility || null, Responsibility || null,
        IsPassStudents || 0, PostedDate || null,
        CompReqId,
      ]
    );

    // Update batch children – soft delete existing, re-insert
    if (batches && Array.isArray(batches)) {
      await pool.query(`UPDATE company_req_batch_details_apk SET IsDelete = 1 WHERE CompanyReqId = ?`, [CompReqId]);

      for (const b of batches) {
        if (b.CompReqBatchId) {
          await pool.query(
            `UPDATE company_req_batch_details_apk SET BatchId = ?, IsDelete = 0 WHERE CompReqBatchId = ?`,
            [b.BatchId, b.CompReqBatchId]
          );
        } else {
          await pool.query(
            `INSERT INTO company_req_batch_details_apk (CompanyReqId, BatchId, IsActive, IsDelete)
             VALUES (?, ?, 1, 0)`,
            [CompReqId, b.BatchId]
          );
        }
      }
    }

    cache.deleteByPrefix('shortlisted_sit:');
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Shortlisted By SIT PUT error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - soft delete company requirement
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'shortlisted_sit.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await pool.query(`UPDATE company_requirements_apk SET IsDelete = 1 WHERE CompReqId = ?`, [id]);
    await pool.query(`UPDATE company_req_batch_details_apk SET IsDelete = 1 WHERE CompanyReqId = ?`, [id]);

    cache.deleteByPrefix('shortlisted_sit:');
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Shortlisted By SIT DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
