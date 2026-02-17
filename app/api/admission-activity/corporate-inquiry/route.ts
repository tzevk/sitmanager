/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { cache, cacheKeys, cacheTTL } from '@/lib/cache';
import { requirePermission } from '@/lib/api-auth';

// GET - fetch all corporate inquiries with pagination and search
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';

    // Check cache first
    const cacheKey = cacheKeys.corporateInquiry.list({ page, limit, search });
    const cached = cache.get<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT' }
      });
    }

    // Build WHERE clause
    const conditions: string[] = ['(IsDelete = 0 OR IsDelete IS NULL)'];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(`(FullName LIKE ? OR Fname LIKE ? OR Lname LIKE ? OR Email LIKE ? OR CompanyName LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const where = conditions.join(' AND ');

    // Count
    const countSql = `SELECT COUNT(*) AS total FROM corporate_inquiry WHERE ${where}`;
    const [countRows] = await pool.query<any[]>(countSql, params);
    const total = countRows[0]?.total ?? 0;

    // Data
    const dataSql = `
      SELECT Id, Fname, Lname, MName, FullName, CompanyName, Designation,
             Address, City, State, Country, Pin, Phone, Mobile, Email,
             Course_Id, Place, business, Remark, Idate, IsActive
      FROM corporate_inquiry 
      WHERE ${where}
      ORDER BY Id DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query<any[]>(dataSql, [...params, limit, offset]);

    // Get courses for reference
    const [courses] = await pool.query<any[]>(`
      SELECT Course_Id, Course_Name FROM course_mst 
      WHERE (IsDelete = 0 OR IsDelete IS NULL)
      ORDER BY Course_Name
    `);

    const responseData = {
      rows,
      courses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Store in cache for future requests
    cache.set(cacheKey, responseData, cacheTTL.medium);

    return NextResponse.json(responseData, {
      headers: { 'X-Cache': 'MISS' }
    });
  } catch (err: unknown) {
    console.error('Corporate Inquiry API error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - add new corporate inquiry
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const {
      Fname, Lname, MName, CompanyName, Designation, Address, City, State,
      Country, Pin, Phone, Mobile, Email, Course_Id, Place, business, Remark
    } = body;

    const FullName = [Fname, MName, Lname].filter(Boolean).join(' ');

    const [result] = await pool.query(
      `INSERT INTO corporate_inquiry (
        Fname, Lname, MName, FullName, CompanyName, Designation, Address, City, State,
        Country, Pin, Phone, Mobile, Email, Course_Id, Place, business, Remark, Idate, IsActive, IsDelete
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), 1, 0)`,
      [
        Fname || null, Lname || null, MName || null, FullName || null,
        CompanyName || null, Designation || null, Address || null, City || null,
        State || null, Country || null, Pin || null, Phone || null, Mobile || null,
        Email || null, Course_Id || null, Place || null, business || null, Remark || null
      ]
    );

    // Invalidate cache on data modification
    cache.deleteByPrefix(cacheKeys.corporateInquiry.prefix);

    return NextResponse.json({ success: true, insertId: (result as any).insertId });
  } catch (err: unknown) {
    console.error('Corporate Inquiry POST error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - update corporate inquiry
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const {
      Id, Fname, Lname, MName, CompanyName, Designation, Address, City, State,
      Country, Pin, Phone, Mobile, Email, Course_Id, Place, business, Remark
    } = body;

    if (!Id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const FullName = [Fname, MName, Lname].filter(Boolean).join(' ');

    await pool.query(
      `UPDATE corporate_inquiry SET 
        Fname = ?, Lname = ?, MName = ?, FullName = ?, CompanyName = ?, Designation = ?,
        Address = ?, City = ?, State = ?, Country = ?, Pin = ?, Phone = ?, Mobile = ?,
        Email = ?, Course_Id = ?, Place = ?, business = ?, Remark = ?
      WHERE Id = ?`,
      [
        Fname || null, Lname || null, MName || null, FullName || null,
        CompanyName || null, Designation || null, Address || null, City || null,
        State || null, Country || null, Pin || null, Phone || null, Mobile || null,
        Email || null, Course_Id || null, Place || null, business || null, Remark || null,
        Id
      ]
    );

    // Invalidate cache on data modification
    cache.deleteByPrefix(cacheKeys.corporateInquiry.prefix);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Corporate Inquiry PUT error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - soft delete corporate inquiry
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await pool.query(`UPDATE corporate_inquiry SET IsDelete = 1 WHERE Id = ?`, [id]);

    // Invalidate cache on data modification
    cache.deleteByPrefix(cacheKeys.corporateInquiry.prefix);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Corporate Inquiry DELETE error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}
